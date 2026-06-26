import os
import re
import sys
import difflib
import cv2
import numpy as np

from PIL import Image
from app.core.concurrency import run_sync  # re-exported for automation.py backward compat

# ---------------------------------------------------------------------------
# Import the validated root-level OMR processor (Moondream/Ollama + CV grading)
# ---------------------------------------------------------------------------
_ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _ROOT_DIR not in sys.path:
    sys.path.insert(0, _ROOT_DIR)

try:
    from omr_processor import process_omr_sheet as _process_omr_sheet
    _OMR_PROCESSOR_AVAILABLE = True
except ImportError as _e:
    print(f"[OMR] WARNING: root omr_processor.py not importable: {_e}")
    _OMR_PROCESSOR_AVAILABLE = False

# rapidfuzz for fuzzy name matching (installed via pip install rapidfuzz)
try:
    from rapidfuzz import fuzz as _rfuzz, process as _rfprocess
    _RAPIDFUZZ_AVAILABLE = True
except ImportError:
    _RAPIDFUZZ_AVAILABLE = False
    print("[OMR] WARNING: rapidfuzz not installed, falling back to difflib")


# ---------------------------------------------------------------------------
# Internal helper: fuzzy-match a raw OCR'd name against the class roster
# ---------------------------------------------------------------------------
def _fuzzy_match_student(raw_name: str, students: list, threshold: float = 0.45):
    """
    Given a raw student name string (from Moondream OCR) and a list of Student
    ORM objects, returns (best_student, confidence_0_to_1, status_str).

    Uses rapidfuzz WRatio (handles abbreviations, word transpositions, OCR noise)
    if available, otherwise falls back to difflib SequenceMatcher + token scoring.
    """
    if not students or not raw_name:
        return None, 0.0, "Unrecognized"

    raw_upper = raw_name.upper().strip()

    if _RAPIDFUZZ_AVAILABLE:
        # Build (name_upper, student) pairs
        choices = {s.full_name.upper().strip(): s for s in students}
        # rapidfuzz process.extractOne returns (match, score, key) — score is 0-100
        result = _rfprocess.extractOne(
            raw_upper,
            choices.keys(),
            scorer=_rfuzz.WRatio,
            score_cutoff=threshold * 100
        )
        if result:
            matched_name, score_100, _ = result
            best_student = choices[matched_name]
            confidence = round(score_100 / 100.0, 2)
            status = "Matched" if confidence >= 0.70 else "Verification Required"
            print(f"[OMR Fuzzy] rapidfuzz WRatio: '{raw_upper}' -> '{matched_name}' ({score_100:.1f})")
            return best_student, confidence, status
        return None, 0.30, "Unrecognized"
    else:
        # difflib fallback
        best_student = None
        best_score = 0.0
        for student in students:
            std_name = student.full_name.upper().strip()
            score = difflib.SequenceMatcher(None, std_name, raw_upper).ratio()
            if std_name in raw_upper:
                score = max(score, 0.85)
            std_tokens = set(std_name.split())
            text_tokens = set(raw_upper.split())
            if std_tokens:
                token_score = len(std_tokens & text_tokens) / len(std_tokens)
                score = max(score, token_score * 0.9)
            if score > best_score:
                best_score = score
                best_student = student
        if best_student and best_score >= threshold:
            status = "Matched" if best_score >= 0.70 else "Verification Required"
            return best_student, round(best_score, 2), status
        return None, 0.30, "Unrecognized"

def extract_student_from_header(image_path: str, db, class_id: int) -> tuple[int | None, str | None, float, str]:
    """
    Extracts student identification details from the OMR sheet image.

    Uses the validated root-level omr_processor.process_omr_sheet() which runs
    Moondream via Ollama to read the handwritten student name, then applies
    rapidfuzz fuzzy matching against the class roster.

    Falls back to the original OCR + difflib path when the root processor is
    unavailable (e.g. Ollama not running).

    Returns: (student_id, student_name, confidence, status)
    """
    from app.models.student import Student
    from app.models.academic import SchoolClass

    try:
        if not os.path.exists(image_path):
            print(f"[OMR] Error: Image path {image_path} does not exist")
            return None, None, 0.0, "Unrecognized"

        students = db.query(Student).filter(
            Student.class_id == class_id, Student.is_active == True
        ).all()
        if not students:
            print(f"[OMR] No active students found in class {class_id}")
            return None, None, 0.0, "Unrecognized"

        if _OMR_PROCESSOR_AVAILABLE:
            # ----------------------------------------------------------------
            # Primary path: use validated omr_processor.process_omr_sheet
            # ----------------------------------------------------------------
            print("[OMR] Running process_omr_sheet for student name detection...")
            try:
                raw_name, _answers = _process_omr_sheet(image_path)
                print(f"[OMR] Moondream extracted name: '{raw_name}'")
            except Exception as omr_err:
                print(f"[OMR] process_omr_sheet failed: {omr_err}. Falling back to legacy OCR.")
                return _legacy_extract_student_from_header(image_path, db, class_id, students)

            if not raw_name or raw_name.strip().lower() in ("unknown", ""):
                print("[OMR] Name not detected by Moondream, falling back to legacy OCR.")
                return _legacy_extract_student_from_header(image_path, db, class_id, students)

            # Fuzzy-match the Moondream name against the class roster
            best_student, confidence, status = _fuzzy_match_student(raw_name, students)
            if best_student:
                print(f"[OMR] Matched '{raw_name}' -> '{best_student.full_name}' ({confidence})")
                return best_student.id, best_student.full_name, confidence, status

            # If fuzzy match failed, return the raw name for manual review
            print(f"[OMR] No roster match for '{raw_name}', flagging for review.")
            return None, raw_name, 0.30, "Verification Required"

        else:
            # ----------------------------------------------------------------
            # Fallback path: legacy OCR-based approach
            # ----------------------------------------------------------------
            return _legacy_extract_student_from_header(image_path, db, class_id, students)

    except Exception as e:
        print(f"[OMR] Error in student identification: {str(e)}")
        return None, None, 0.0, "Unrecognized"


def _legacy_extract_student_from_header(image_path: str, db, class_id: int, students: list) -> tuple[int | None, str | None, float, str]:
    """
    Legacy OCR-based student name extraction used as a fallback when the
    root omr_processor (Moondream/Ollama) is unavailable.
    """
    from app.services.ocr_service import ocr_manager
    from app.models.academic import SchoolClass

    try:
        with Image.open(image_path) as pil_img:
            w, h = pil_img.size
            left_panel_crop = pil_img.crop((0, 0, int(w * 0.35), int(h * 0.45)))
            print("[OMR Legacy] Running OCR on left-panel name region...")
            full_text = ocr_manager.recognize(left_panel_crop)

        if not full_text:
            print("[OMR Legacy] No text detected in name region crop.")
            return None, None, 0.0, "Unrecognized"

        normalized_text = full_text.upper().strip()
        print(f"[OMR Legacy] Raw Extracted Header Text: {normalized_text}")

        class_obj = db.query(SchoolClass).filter(SchoolClass.id == class_id).first()
        class_name = class_obj.name.upper() if class_obj else ""

        # STU-number match
        student_id_match = re.search(r'STU\s*-?\s*(\d+)', normalized_text)
        if student_id_match:
            digits = student_id_match.group(1)
            possible_id = f"STU{int(digits):04d}"
            student_by_id = db.query(__import__('app.models.student', fromlist=['Student']).Student).filter_by(
                student_id_number=possible_id, class_id=class_id
            ).first()
            if student_by_id:
                return student_by_id.id, student_by_id.full_name, 0.99, "Matched"

        # Clean text
        clean_text = normalized_text
        if class_name:
            clean_text = clean_text.replace(class_name, '')
        keywords = [
            "NAME", "NAMA", "CLASS", "KELAS", "STUDENT ID", "ID STUDENT",
            "NO", "INDEX", "NUM", "NUMBER", "TARIKH", "DATE", "SUBJECT", "SUBJEK",
            "SEKOLAH", "KERTAS", "JAWAPAN", "OBJEKTIF", "CONTOH", "LAMPIRAN",
            "ANGKA", "GILIRAN", "KOD", "PENGENALAN", "DIRI", "NOMBOR",
            "SPM", "ANSWER", "BOX", "LETTERS", "MULTIPLE", "CHOICE", "SPACE",
        ]
        for kw in keywords:
            clean_text = re.sub(rf'\b{re.escape(kw)}\b', ' ', clean_text)
        clean_text = re.sub(r'\b\d+\b', ' ', clean_text)
        clean_text = re.sub(r'[^\w\s]', ' ', clean_text)
        clean_text = re.sub(r'\s+', ' ', clean_text).strip()
        print(f"[OMR Legacy] Cleaned Name Candidate: '{clean_text}'")

        if not clean_text or len(clean_text) < 2:
            return None, None, 0.0, "Unrecognized"

        best_student, confidence, status = _fuzzy_match_student(clean_text, students)
        if best_student:
            return best_student.id, best_student.full_name, confidence, status

        return None, None, 0.30, "Unrecognized"

    except Exception as e:
        print(f"[OMR Legacy] Error: {e}")
        return None, None, 0.0, "Unrecognized"

def deskew_image(img, gray):
    """
    Detects the rotation angle of the page and rotates it horizontally.
    """
    try:
        # Binarize inverted to find long borders/boxes
        _, thresh = cv2.threshold(gray, 50, 255, cv2.THRESH_BINARY_INV)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        best_angle = 0.0
        max_area = 0
        for cnt in contours:
            x, y, w, h = cv2.boundingRect(cnt)
            area = cv2.contourArea(cnt)
            aspect = w / h if h > 0 else 0
            
            # Find the long horizontal name box header contour
            if w > 120 and aspect > 3.0 and area > 800:
                if area > max_area:
                    max_area = area
                    rect = cv2.minAreaRect(cnt)
                    angle = rect[-1]
                    # Convert to actual rotation angle
                    if angle < -45:
                        angle = 90 + angle
                    elif angle > 45:
                        angle = angle - 90
                    best_angle = angle
                    
        print(f"[OMR Scan] Detected deskew angle: {best_angle:.2f} degrees")
        
        # If rotation is significant, rotate
        if abs(best_angle) > 0.15 and abs(best_angle) < 45:
            h, w = img.shape[:2]
            center = (w // 2, h // 2)
            M = cv2.getRotationMatrix2D(center, best_angle, 1.0)
            rotated_img = cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=(255, 255, 255))
            rotated_gray = cv2.warpAffine(gray, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=255)
            return rotated_img, rotated_gray
            
        return img, gray
    except Exception as e:
        print(f"[OMR Scan] Deskew error: {str(e)}") 
        return img, gray

def find_best_skew_and_peaks(g_bubbles):
    best_m = 0.0
    best_sharpness = 0
    slopes = np.linspace(-0.08, 0.08, 161)
    
    for m in slopes:
        x_proj = [b[0] - m * b[1] for b in g_bubbles]
        min_p, max_p = min(x_proj), max(x_proj)
        bins = np.arange(min_p - 2, max_p + 4, 2.0)
        hist, _ = np.histogram(x_proj, bins=bins)
        
        sharpness = np.sum(hist ** 2)
        if sharpness > best_sharpness:
            best_sharpness = sharpness
            best_m = m
            
    x_proj = np.array([b[0] - best_m * b[1] for b in g_bubbles])
    x_proj_sorted = sorted(x_proj)
    
    cols = []
    curr = []
    for x in x_proj_sorted:
        if not curr:
            curr = [x]
        elif x - curr[-1] > 10.0:
            cols.append(np.median(curr))
            curr = [x]
        else:
            curr.append(x)
    if curr:
        cols.append(np.median(curr))
        
    return best_m, sorted(cols)

def detect_answers_from_image(image_path: str, num_questions: int) -> dict:
    """
    Detects OMR answers from the student sheet image.

    Primary path: delegates to the validated root-level omr_processor.process_omr_sheet()
    which uses the perspective-warp + pixel black-count bubble grading algorithm.
    process_omr_sheet always returns exactly 40 answer slots; we slice to num_questions.

    Fallback path (when root processor is unavailable): uses the original Hough circle
    detection algorithm (_hough_detect_answers).

    Returns a dict mapping question number string (e.g. "1") to the detected option (e.g. "A"),
    or "" for unanswered bubbles.
    """
    if _OMR_PROCESSOR_AVAILABLE:
        try:
            print(f"[OMR Scan] Using process_omr_sheet for answer detection ({num_questions} questions)...")
            _name, answers_list = _process_omr_sheet(image_path)
            # answers_list is always length 40 (A-H or '-')
            # Slice to num_questions and convert '-' (unanswered) to ""
            answers = {}
            for i in range(min(num_questions, len(answers_list))):
                raw = answers_list[i]
                answers[str(i + 1)] = raw if raw != '-' else ""
            answered_count = sum(1 for v in answers.values() if v)
            print(f"[OMR Scan] process_omr_sheet graded {answered_count}/{num_questions} questions answered")
            return answers
        except Exception as omr_err:
            print(f"[OMR Scan] process_omr_sheet answer detection failed: {omr_err}. Falling back to Hough circles.")

    # Fallback: original Hough-circle based answer detection
    return _hough_detect_answers(image_path, num_questions)


def _hough_detect_answers(image_path: str, num_questions: int) -> dict:
    """
    Legacy Hough-circle answer detection used as fallback when the root
    omr_processor is unavailable.

    Supports SPM-style Malaysian OMR sheets (A4, single column, 8 options A-H,
    40 questions) and UPSR-style sheets (multi-column, 4 options A-D, 40 questions).

    Returns a dict mapping question number string (e.g. "1") to the detected option (e.g. "A").
    """
    try:
        img = cv2.imread(image_path)
        if img is None:
            print(f"[OMR Scan] Error: Could not read image {image_path}")
            return {}

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape

        # ── Step 1: Hough Circle Detection ────────────────────────────────────
        # Scale radius bounds to image resolution.
        # SPM sheets scanned at ~300dpi on A4 ≈ 3400×4900px → circles ~35-70px radius
        # Smaller scans (~1200×1700) → circles ~12-25px radius
        scale = w / 3400.0
        min_r = max(8, int(15 * scale))
        max_r = max(25, int(65 * scale))
        min_dist = max(15, int(25 * scale))

        blurred = cv2.GaussianBlur(gray, (9, 9), 0)
        circles = cv2.HoughCircles(
            blurred,
            cv2.HOUGH_GRADIENT,
            dp=1,
            minDist=min_dist,
            param1=50,
            param2=25,
            minRadius=min_r,
            maxRadius=max_r
        )

        if circles is None:
            # Fallback: relax thresholds
            circles = cv2.HoughCircles(
                blurred,
                cv2.HOUGH_GRADIENT,
                dp=1,
                minDist=max(10, int(15 * scale)),
                param1=40,
                param2=18,
                minRadius=max(6, int(10 * scale)),
                maxRadius=max(30, int(80 * scale))
            )

        if circles is None:
            print("[OMR Scan] Error: HoughCircles could not find any circles.")
            return {}

        circles_arr = np.round(circles[0, :]).astype('int')
        print(f"[OMR Scan] HoughCircles detected {len(circles_arr)} raw circles")

        # ── Step 2: Identify the answer column zone ────────────────────────────
        # The answer bubble grid occupies a specific X band of the sheet.
        # We find it by X-histogram: the answer columns produce tall, narrow peaks
        # concentrated in a contiguous band. The left edge of the sheet (form fields,
        # name box) and the far-right (text writing space) produce sparse or zero counts.

        # First pass: exclude far-right noise (text writing region > 70% width)
        # and far-left (circle stubs/marks < 5% width)
        all_x = np.array([int(c[0]) for c in circles_arr])
        all_y = np.array([int(c[1]) for c in circles_arr])

        candidate_mask = (all_x > w * 0.05) & (all_x < w * 0.78)
        candidate_x = all_x[candidate_mask]
        candidate_y = all_y[candidate_mask]
        candidate_circles = circles_arr[candidate_mask]

        if len(candidate_circles) < num_questions:
            print(f"[OMR Scan] Too few circles ({len(candidate_circles)}) after region filter.")
            candidate_circles = circles_arr  # fallback: use all
            candidate_x = all_x
            candidate_y = all_y

        # Build X histogram with bin width = ~2% of image width
        bin_w = max(20, int(w * 0.02))
        bins = list(range(0, w + bin_w, bin_w))
        hist_x, edges_x = np.histogram(candidate_x, bins=bins)

        # Find the answer grid band: the largest contiguous X-zone with many circles
        # A "dense bin" threshold is >5% of total candidates
        density_threshold = max(3, len(candidate_circles) * 0.03)
        dense_bins = [i for i, cnt in enumerate(hist_x) if cnt >= density_threshold]

        if not dense_bins:
            print("[OMR Scan] No dense X-column clusters found.")
            return {}

        # Merge contiguous dense bins into segments; pick the largest segment
        segments = []
        curr_seg = [dense_bins[0]]
        for i in range(1, len(dense_bins)):
            if dense_bins[i] - dense_bins[i-1] <= 3:  # allow small gaps
                curr_seg.append(dense_bins[i])
            else:
                segments.append(curr_seg)
                curr_seg = [dense_bins[i]]
        segments.append(curr_seg)

        # Choose segment with most circles
        best_seg = max(segments, key=lambda seg: sum(hist_x[i] for i in seg))
        x_min_band = edges_x[best_seg[0]]
        x_max_band = edges_x[best_seg[-1] + 1]
        print(f"[OMR Scan] Answer grid X band: {x_min_band:.0f} - {x_max_band:.0f}px  (image width={w})")

        # ── Step 3: Filter circles to the answer zone ─────────────────────────
        zone_mask = (candidate_x >= x_min_band) & (candidate_x <= x_max_band)
        zone_circles = candidate_circles[zone_mask]
        zone_x = candidate_x[zone_mask]
        zone_y = candidate_y[zone_mask]
        print(f"[OMR Scan] Circles in answer zone: {len(zone_circles)}")

        if len(zone_circles) < num_questions:
            print(f"[OMR Scan] Warning: Only {len(zone_circles)} circles in answer zone, expected >= {num_questions}. Using all candidates.")
            zone_circles = candidate_circles
            zone_x = candidate_x
            zone_y = candidate_y

        # ── Step 4: Determine number of option columns ─────────────────────────
        # Cluster zone_x values into columns
        zone_x_sorted = np.sort(np.unique(zone_x))

        # Use the same X histogram approach on the zone to find column peaks
        zone_hist, zone_edges = np.histogram(zone_x, bins=list(range(int(x_min_band), int(x_max_band) + bin_w, max(5, bin_w // 4))))
        col_threshold = max(2, num_questions * 0.3)
        col_peak_bins = [i for i, cnt in enumerate(zone_hist) if cnt >= col_threshold]

        # Group adjacent peak bins into column centers
        option_cols = []
        if col_peak_bins:
            col_seg = [col_peak_bins[0]]
            for i in range(1, len(col_peak_bins)):
                if col_peak_bins[i] - col_peak_bins[i-1] <= 2:
                    col_seg.append(col_peak_bins[i])
                else:
                    center_bin = col_seg[len(col_seg) // 2]
                    option_cols.append(float(zone_edges[center_bin] + zone_edges[center_bin + 1]) / 2.0)
                    col_seg = [col_peak_bins[i]]
            center_bin = col_seg[len(col_seg) // 2]
            option_cols.append(float(zone_edges[center_bin] + zone_edges[center_bin + 1]) / 2.0)

        # Fallback: derive from circle x positions
        if len(option_cols) < 2:
            x_vals = sorted(set([int(c[0]) for c in zone_circles]))
            col_groups = []
            curr_group = [x_vals[0]]
            for x in x_vals[1:]:
                if x - curr_group[-1] <= bin_w * 2:
                    curr_group.append(x)
                else:
                    col_groups.append(np.median(curr_group))
                    curr_group = [x]
            col_groups.append(np.median(curr_group))
            option_cols = sorted(col_groups)

        print(f"[OMR Scan] Detected {len(option_cols)} option columns at x={[f'{c:.0f}' for c in option_cols]}")

        # Clamp to reasonable number of options (A-H = 8 max)
        num_options = min(len(option_cols), 8)
        if num_options < 4:
            print(f"[OMR Scan] Warning: Only {num_options} option columns found, answer detection will be unreliable.")
        option_cols = option_cols[:num_options]
        options = ["A", "B", "C", "D", "E", "F", "G", "H"][:num_options]

        # ── Step 5: Sort circles into rows (by Y) and assign to questions ──────
        # Sort zone circles by Y position
        zone_list = sorted(zip(zone_y.tolist(), zone_x.tolist()), key=lambda c: c[0])

        # Group into row bands
        row_y_tol = max(15, int(scale * 20))  # tolerance in Y to be "same row"
        rows = []
        curr_row_ys = []
        curr_row_circles = []

        for (cy, cx) in zone_list:
            if not curr_row_ys or abs(cy - np.mean(curr_row_ys)) <= row_y_tol:
                curr_row_ys.append(cy)
                curr_row_circles.append((cx, cy))
            else:
                rows.append((float(np.mean(curr_row_ys)), curr_row_circles))
                curr_row_ys = [cy]
                curr_row_circles = [(cx, cy)]
        if curr_row_circles:
            rows.append((float(np.mean(curr_row_ys)), curr_row_circles))

        print(f"[OMR Scan] Detected {len(rows)} bubble rows for {num_questions} questions")

        # If we have too many rows vs questions, filter to the most consistent ones
        # (e.g. rows with num_options circles are likely valid question rows)
        valid_rows = [(ry, rcs) for (ry, rcs) in rows if len(rcs) >= max(2, num_options - 2)]
        if len(valid_rows) >= num_questions:
            rows = sorted(valid_rows, key=lambda r: r[0])[:num_questions]
        else:
            rows = sorted(rows, key=lambda r: r[0])

        # ── Step 6: Read pixel brightness at each bubble position ───────────────
        answers = {}
        patch_r = max(5, int(scale * 8))  # sampling radius around bubble center

        for row_idx, (row_y_center, row_circles) in enumerate(rows):
            q_num = row_idx + 1
            if q_num > num_questions:
                break

            # Assign each circle in this row to the nearest option column
            col_brightnesses = [255.0] * num_options

            for (cx, cy) in row_circles:
                # Find nearest option column
                dists = [abs(cx - oc) for oc in option_cols]
                nearest_col = int(np.argmin(dists))
                if nearest_col >= num_options:
                    continue

                # Sample pixel brightness in a patch around this circle center
                x_snap, y_snap = int(cx), int(cy)
                pixels = []
                for dy in range(-patch_r, patch_r + 1):
                    for dx in range(-patch_r, patch_r + 1):
                        px, py = x_snap + dx, y_snap + dy
                        if 0 <= px < w and 0 <= py < h:
                            pixels.append(int(gray[py, px]))
                avg_brightness = float(np.mean(pixels)) if pixels else 255.0
                col_brightnesses[nearest_col] = min(col_brightnesses[nearest_col], avg_brightness)

            # The filled bubble has the lowest brightness
            min_brightness = min(col_brightnesses)
            darkest_idx = col_brightnesses.index(min_brightness)
            other_brightness = [v for i, v in enumerate(col_brightnesses) if i != darkest_idx]
            avg_others = float(np.mean(other_brightness)) if other_brightness else 255.0
            contrast = avg_others - min_brightness

            # Only record if the bubble is significantly darker than its neighbors
            if min_brightness < 180 and contrast > 10:
                answers[str(q_num)] = options[darkest_idx]

        print(f"[OMR Scan] Detected answers for {len(answers)}/{num_questions} questions")
        return answers

    except Exception as e:
        print(f"[OMR Scan] Error during OMR answer detection: {str(e)}")
        import traceback
        traceback.print_exc()
        return {}

