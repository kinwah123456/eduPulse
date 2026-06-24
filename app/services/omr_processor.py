import os
import re
import difflib
import cv2
import numpy as np

import asyncio
from app.services.ocr_service import ocr_manager
from PIL import Image

def run_sync(coro):
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
    if loop.is_running():
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(lambda: asyncio.run(coro))
            return future.result()
    else:
        return loop.run_until_complete(coro)

def extract_student_from_header(image_path: str, db, class_id: int) -> tuple[int | None, str | None, float, str]:
    """
    Extracts student identification details from the header crop.
    Returns: (student_id, student_name, confidence, status)
    """
    from app.models.student import Student
    from app.models.academic import SchoolClass

    try:
        # Load image with PIL to crop and pass to winocr
        if not os.path.exists(image_path):
            print(f"[OMR OCR] Error: Image path {image_path} does not exist")
            return None, None, 0.0, "Unrecognized"
            
        with Image.open(image_path) as pil_img:
            w, h = pil_img.size
            header_crop = pil_img.crop((0, 0, w, int(h * 0.22)))
            
            # Run OCR using the platform-independent wrapper
            print("[OMR OCR] Running platform-independent OCR on header crop...")
            full_text = ocr_manager.recognize(header_crop)
            
        if not full_text:
            print("[OMR OCR] No text detected in header crop.")
            return None, None, 0.0, "Unrecognized"
            
        normalized_text = full_text.upper().strip()
        print(f"[OMR OCR] Raw Extracted Header Text: {normalized_text}")
        
        # Fetch class name
        class_obj = db.query(SchoolClass).filter(SchoolClass.id == class_id).first()
        class_name = class_obj.name.upper() if class_obj else ""
        
        students = db.query(Student).filter(Student.class_id == class_id, Student.is_active == True).all()
        if not students:
            print(f"[OMR OCR] No active students found in class {class_id}")
            return None, None, 0.0, "Unrecognized"
            
        # 1. Look for Student ID pattern (e.g. STU0001, STU-0015, or STU 0005)
        student_id_match = re.search(r'STU\s*-?\s*(\d+)', normalized_text)
        if student_id_match:
            digits = student_id_match.group(1)
            possible_id = f"STU{int(digits):04d}"
            student_by_id = db.query(Student).filter(
                Student.student_id_number == possible_id,
                Student.class_id == class_id
            ).first()
            if student_by_id:
                print(f"[OMR OCR] Matched via Student ID: {possible_id} -> {student_by_id.full_name}")
                return student_by_id.id, student_by_id.full_name, 0.99, "Matched"
                
        # 2. Clean candidate text for fuzzy name matching
        clean_text = normalized_text
        
        # Strip student ID patterns
        clean_text = re.sub(r'STU\s*-?\s*\d+', '', clean_text)
        
        # Strip class name variations
        if class_name:
            clean_text = clean_text.replace(class_name, '')
            class_parts = class_name.split()
            if len(class_parts) > 1:
                clean_text = re.sub(rf'{class_parts[0]}\s*{class_parts[-1]}', '', clean_text)
                
        # Strip common boilerplates
        keywords = ["NAME", "NAMA", "CLASS", "KELAS", "STUDENT ID", "ID STUDENT", "NO", "INDEX", "NUM", "NUMBER", "TARIKH", "DATE", "SUBJECT", "SUBJEK"]
        for kw in keywords:
            clean_text = re.sub(rf'\b{kw}\b', '', clean_text)
            
        # Clean double spaces
        clean_text = re.sub(r'\s+', ' ', clean_text).strip()
        print(f"[OMR OCR] Cleaned Name Candidate: '{clean_text}'")
        
        if not clean_text or len(clean_text) < 2:
            return None, None, 0.0, "Unrecognized"
            
        # 3. Fuzzy Name Matching
        best_student = None
        best_score = 0.0
        
        for student in students:
            std_name = student.full_name.upper().strip()
            score = difflib.SequenceMatcher(None, std_name, clean_text).ratio()
            
            # Substring match bonus
            if std_name in normalized_text:
                score = max(score, 0.85)
                
            # Token matching bonus (handle word order changes or extra words)
            std_tokens = set(std_name.split())
            text_tokens = set(clean_text.split())
            if std_tokens:
                token_intersection = std_tokens.intersection(text_tokens)
                token_score = len(token_intersection) / len(std_tokens)
                score = max(score, token_score * 0.9)
                
            if score > best_score:
                best_score = score
                best_student = student
                
        print(f"[OMR OCR] Fuzzy Match Candidate: {best_student.full_name if best_student else 'None'} (score: {best_score:.3f})")
        
        if best_student and best_score >= 0.45:
            status = "Matched" if best_score >= 0.70 else "Verification Required"
            confidence = round(best_score, 2)
            return best_student.id, best_student.full_name, confidence, status
            
        return None, None, 0.30, "Unrecognized"
        
    except Exception as e:
        print(f"[OMR OCR] Error in student identification: {str(e)}")
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
    Supports up to 50 questions by dynamically locating bubble rows and columns.
    Returns a dict mapping question number string (e.g. "1") to the detected option (e.g. "A").
    """
    try:
        # Load image
        img = cv2.imread(image_path)
        if img is None:
            print(f"[OMR Scan] Error: Could not read image {image_path}")
            return {}
            
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # 1. Image Dimensions (skip deskew_image since projection profile alignment handles skew dynamically)
        h, w = gray.shape
        
        # 2. Gaussian Blur & Adaptive Thresholding (optimized for shadow regions)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        binary = cv2.adaptiveThreshold(
            blurred, 255, 
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY_INV, 
            35, 9
        )
        
        # 3. Find Bubble Contours
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # 4. Filter bubble candidates (size & OMR region)
        candidates = []
        for cnt in contours:
            x_c, y_c, w_c, h_c = cv2.boundingRect(cnt)
            aspect_ratio = w_c / h_c if h_c > 0 else 0
            area = cv2.contourArea(cnt)
            
            if 7 <= w_c <= 35 and 5 <= h_c <= 35 and 0.4 <= aspect_ratio <= 2.2 and 15 <= area <= 700:
                cx = x_c + w_c / 2
                cy = y_c + h_c / 2
                if cx > w * 0.35 and cy >= h * 0.22:
                    candidates.append((cx, cy, w_c, h_c, area))
                    
        if not candidates:
            print("[OMR Scan] Error: No bubble candidates found.")
            return {}
            
        # Statistical filtering near the median size of candidates
        widths = [c[2] for c in candidates]
        heights = [c[3] for c in candidates]
        med_w = np.median(widths)
        med_h = np.median(heights)
        
        clean_candidates = []
        for cx, cy, wc, hc, area in candidates:
            if 0.65 * med_w <= wc <= 1.35 * med_w and 0.65 * med_h <= hc <= 1.35 * med_h:
                clean_candidates.append((cx, cy, wc, hc, area))
                
        if not clean_candidates:
            print("[OMR Scan] Error: No clean bubble candidates remaining after size filtering.")
            return {}
            
        # 5. Determine Layout Type
        ys = [b[1] for b in clean_candidates]
        max_y = max(ys)
        is_multi_column = (max_y < 700)
        print(f"[OMR Scan] Detected layout: {'MULTI-COLUMN' if is_multi_column else 'SINGLE-COLUMN'} (max_y={max_y:.1f})")
        
        answers = {}
        options = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]
        
        if is_multi_column:
            # Multi-column (UPSR): Q1-20 (<300), Q21-40 (300-420), Q41-50 (>=420)
            g1 = [b for b in clean_candidates if b[0] < 300]
            g2 = [b for b in clean_candidates if 300 <= b[0] < 420]
            g3 = [b for b in clean_candidates if b[0] >= 420]
            
            for g_idx, (g_bubbles, q_start, q_end) in enumerate([
                (g1, 1, 20),
                (g2, 21, 40),
                (g3, 41, 50)
            ]):
                if len(g_bubbles) < 5:
                    continue
                    
                best_m, cols = find_best_skew_and_peaks(g_bubbles)
                
                # Determine option columns (skipping question numbers column if detected)
                if len(cols) >= 5 and (cols[1] - cols[0] < 16.0):
                    option_cols = cols[1:5]
                else:
                    option_cols = cols[:4]
                    
                while len(option_cols) < 4:
                    spacing = 24.0
                    if len(option_cols) > 0:
                        option_cols.append(option_cols[-1] + spacing)
                    else:
                        option_cols = [200.0, 224.0, 248.0, 272.0]
                        
                # Group bubbles in group into rows to fit row Y coordinates
                g_bubbles.sort(key=lambda b: b[1])
                g_rows = []
                curr_row = []
                last_y = -999
                for b in g_bubbles:
                    cy = b[1]
                    if cy - last_y > 10:
                        if curr_row:
                            g_rows.append(curr_row)
                        curr_row = [b]
                    else:
                        curr_row.append(b)
                    last_y = cy
                if curr_row:
                    g_rows.append(curr_row)
                    
                row_ys = sorted([np.median([b[1] for b in r]) for r in g_rows])
                y_diffs = np.diff(row_ys)
                row_spacing = np.median([d for d in y_diffs if 12 < d < 32]) if len(y_diffs) > 0 else 19.5
                
                y_indices = [round((y - row_ys[0]) / row_spacing) for y in row_ys]
                y_slope, y_intercept = np.polyfit(y_indices, row_ys, 1)
                
                num_group_questions = q_end - q_start + 1
                for i in range(num_group_questions):
                    q_num = q_start + i
                    if q_num > num_questions:
                        break
                    y_exp = int(y_intercept + i * y_slope)
                    
                    cell_brightnesses = []
                    for col_idx in range(4):
                        x_exp = int(option_cols[col_idx] + best_m * y_exp)
                        
                        # Snapping: Find nearest bubble candidate
                        nearest_dist = 999.0
                        best_pt = (x_exp, y_exp)
                        for b in clean_candidates:
                            dist = np.hypot(b[0] - x_exp, b[1] - y_exp)
                            if dist < 12.0 and dist < nearest_dist:
                                nearest_dist = dist
                                best_pt = (int(b[0]), int(b[1]))
                                
                        x_snap, y_snap = best_pt
                        
                        # Sample pixels
                        pixels = []
                        for dy in range(-7, 8):
                            for dx in range(-7, 8):
                                px = x_snap + dx
                                py = y_snap + dy
                                if 0 <= px < w and 0 <= py < h:
                                    pixels.append(gray[py, px])
                        avg_val = np.mean(pixels) if pixels else 255.0
                        cell_brightnesses.append(avg_val)
                        
                    min_brightness = min(cell_brightnesses)
                    darkest_idx = cell_brightnesses.index(min_brightness)
                    other_brightness = [v for idx, v in enumerate(cell_brightnesses) if idx != darkest_idx]
                    avg_others = np.mean(other_brightness) if other_brightness else 255.0
                    contrast = avg_others - min_brightness
                    
                    if min_brightness < 165 and contrast > 7.5:
                        answers[str(q_num)] = options[darkest_idx]
                        
        else:
            # Single-column (SPM): Q1-40 with options A-H
            best_m, cols = find_best_skew_and_peaks(clean_candidates)
            
            if len(cols) >= 9 and (cols[1] - cols[0] < 16.0):
                option_cols = cols[1:9]
            else:
                option_cols = cols[:8]
                
            while len(option_cols) < 8:
                spacing = 24.0
                if len(option_cols) > 0:
                    option_cols.append(option_cols[-1] + spacing)
                else:
                    option_cols = [200.0, 224.0, 248.0, 272.0, 296.0, 320.0, 344.0, 368.0]
                    
            clean_candidates.sort(key=lambda b: b[1])
            g_rows = []
            curr_row = []
            last_y = -999
            for b in clean_candidates:
                cy = b[1]
                if cy - last_y > 10:
                    if curr_row:
                        g_rows.append(curr_row)
                    curr_row = [b]
                else:
                    curr_row.append(b)
                last_y = cy
            if curr_row:
                g_rows.append(curr_row)
                
            row_ys = sorted([np.median([b[1] for b in r]) for r in g_rows])
            y_diffs = np.diff(row_ys)
            row_spacing = np.median([d for d in y_diffs if 12 < d < 32]) if len(y_diffs) > 0 else 18.5
            
            y_indices = [round((y - row_ys[0]) / row_spacing) for y in row_ys]
            y_slope, y_intercept = np.polyfit(y_indices, row_ys, 1)
            
            for i in range(num_questions):
                q_num = i + 1
                y_exp = int(y_intercept + i * y_slope)
                
                cell_brightnesses = []
                for col_idx in range(8):
                    x_exp = int(option_cols[col_idx] + best_m * y_exp)
                    
                    nearest_dist = 999.0
                    best_pt = (x_exp, y_exp)
                    for b in clean_candidates:
                        dist = np.hypot(b[0] - x_exp, b[1] - y_exp)
                        if dist < 12.0 and dist < nearest_dist:
                            nearest_dist = dist
                            best_pt = (int(b[0]), int(b[1]))
                            
                    x_snap, y_snap = best_pt
                    pixels = []
                    for dy in range(-7, 8):
                        for dx in range(-7, 8):
                            px = x_snap + dx
                            py = y_snap + dy
                            if 0 <= px < w and 0 <= py < h:
                                pixels.append(gray[py, px])
                    avg_val = np.mean(pixels) if pixels else 255.0
                    cell_brightnesses.append(avg_val)
                    
                min_brightness = min(cell_brightnesses)
                darkest_idx = cell_brightnesses.index(min_brightness)
                other_brightness = [v for idx, v in enumerate(cell_brightnesses) if idx != darkest_idx]
                avg_others = np.mean(other_brightness) if other_brightness else 255.0
                contrast = avg_others - min_brightness
                
                if min_brightness < 165 and contrast > 7.5:
                    answers[str(q_num)] = options[darkest_idx]
                    
        return answers
        
    except Exception as e:
        print(f"[OMR Scan] Error during OMR answer detection: {str(e)}")
        return {}
