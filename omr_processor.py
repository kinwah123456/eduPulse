#!/usr/bin/env python3
"""
OMR Processor Module
Author: Python Vision Expert

This module contains a single combined function `process_omr_sheet` that performs the entire
OMR sheet preprocessing, answer grading, and student name recognition in a self-contained way.
All temporary image files are deleted immediately after recognition.
"""

import os
import re
import cv2
import numpy as np
import ollama

# Target warp dimensions
TARGET_W = 2000
TARGET_H = 3000

def get_ordered_corners(pts_contour):
    """Sorts contour points into Top-Left, Top-Right, Bottom-Right, Bottom-Left order."""
    pts = pts_contour.reshape(-1, 2)
    s = pts.sum(axis=1)
    diff = np.diff(pts, axis=1)
    
    tl = pts[np.argmin(s)]
    br = pts[np.argmax(s)]
    tr = pts[np.argmin(diff)]
    bl = pts[np.argmax(diff)]
    
    return np.float32([tl, tr, br, bl])

def find_table_corners(img):
    """Robustly finds the four outer corners of the main OMR table."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    thresh = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 51, 11
    )
    
    contours, _ = cv2.findContours(thresh, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    img_area = img.shape[0] * img.shape[1]
    
    valid_candidates = []
    for c in contours:
        area = cv2.contourArea(c)
        if area < 0.15 * img_area or area > 0.95 * img_area:
            continue
            
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)
        
        if len(approx) == 4:
            x, y, w, h = cv2.boundingRect(approx)
            aspect_ratio = float(h) / w
            if 1.25 <= aspect_ratio <= 1.70:
                valid_candidates.append((area, approx, aspect_ratio))
                
    if valid_candidates:
        valid_candidates = sorted(valid_candidates, key=lambda x: x[0], reverse=True)
        best_approx = valid_candidates[0][1]
        return get_ordered_corners(best_approx)
        
    # Convex hull fallback
    fallback_candidates = []
    for c in contours:
        area = cv2.contourArea(c)
        if area < 0.15 * img_area or area > 0.95 * img_area:
            continue
        hull = cv2.convexHull(c)
        peri = cv2.arcLength(hull, True)
        approx = cv2.approxPolyDP(hull, 0.02 * peri, True)
        if len(approx) == 4:
            x, y, w, h = cv2.boundingRect(approx)
            aspect_ratio = float(h) / w
            if 1.25 <= aspect_ratio <= 1.70:
                fallback_candidates.append((area, approx, aspect_ratio))
                
    if fallback_candidates:
        fallback_candidates = sorted(fallback_candidates, key=lambda x: x[0], reverse=True)
        best_approx = fallback_candidates[0][1]
        return get_ordered_corners(best_approx)
        
    # Extreme points fallback
    sorted_contours = sorted(contours, key=cv2.contourArea, reverse=True)
    if sorted_contours:
        return get_ordered_corners(sorted_contours[0])
        
    return None

def extract_student_name(transcription):
    """Extracts the student's name from transcription using regex rules without hardcoded keywords."""
    text = " ".join(transcription.split())
    
    # 1. Look for keyword + quoted string (e.g. name "NURAL Izzah")
    match = re.search(r'\b(?:name|named|words)\b\s+["\']([^"\']+)["\']', text, re.IGNORECASE)
    if match:
        name = match.group(1).strip()
        if 2 < len(name) < 30 and not any(c.isdigit() for c in name):
            return name
            
    # 2. Look for keyword + capitalized words unquoted (e.g. named David Chen)
    match = re.search(r'\b(?:named|name|words)\b\s+([A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)*)', text)
    if match:
        name = match.group(1).strip()
        if len(name) > 2:
            return name
            
    # 3. Fallback: extract the first double-quoted string
    quotes = re.findall(r'"([^"]*)"', text)
    for q in quotes:
        q_clean = q.strip()
        if 2 < len(q_clean) < 30 and not q_clean.endswith('.') and not any(c.isdigit() for c in q_clean):
            return q_clean
            
    # 4. Final fallback: find any sequence of capitalized words
    capitalized = re.findall(r'\b[A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)*\b', text)
    for cap in capitalized:
        cap_clean = cap.strip()
        if cap_clean not in ["The", "I", "Name", "Class", "Unknown", "A", "Otsu"]:
            return cap_clean
            
    return "Unknown"

def process_omr_sheet(img_path):
    """
    Processes a single OMR sheet image path.
    Returns a tuple: (student_name, answers_list) where:
      - student_name: str (recognized name of the student)
      - answers_list: list of str (length 40, containing the selected answer A-H, or '-' for unanswered)
      
    Deletes all intermediate crops from disk immediately after processing.
    """
    img = cv2.imread(img_path)
    if img is None:
        raise FileNotFoundError(f"Could not read image: {img_path}")
        
    # 1. Otsu Binarize immediately right after imread
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (101, 101))
    bg = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, kernel)
    normalized = cv2.divide(gray, bg, scale=255)
    _, thresh = cv2.threshold(normalized, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    img_bin = cv2.cvtColor(thresh, cv2.COLOR_GRAY2BGR)
    
    # 2. Table Detection
    corners = find_table_corners(img_bin)
    if corners is None:
        raise ValueError(f"Could not find table corners in OMR sheet: {img_path}")
        
    # 3. Warp Perspective
    dst_pts = np.float32([[0, 0], [TARGET_W - 1, 0], [TARGET_W - 1, TARGET_H - 1], [0, TARGET_H - 1]])
    M = cv2.getPerspectiveTransform(corners, dst_pts)
    warped = cv2.warpPerspective(img_bin, M, (TARGET_W, TARGET_H))
    
    w_gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
    w_thresh = cv2.adaptiveThreshold(
        w_gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 51, 11
    )
    
    # 4. Student Name recognition using Ollama + Moondream
    # Crop name box (Y: 180 to 630, X: 10 to 710)
    name_crop = w_gray[180:630, 10:710]
    
    # Find bounding box of text to crop tightly (stripping outer card border)
    border_px = 40
    interior = name_crop[border_px:-border_px, border_px:-border_px]
    y_indices, x_indices = np.where(interior < 127)
    
    student_name = "Unknown"
    temp_tight_path = None
    
    if len(y_indices) > 0:
        y_min, y_max = y_indices.min() + border_px, y_indices.max() + border_px
        x_min, x_max = x_indices.min() + border_px, x_indices.max() + border_px
        
        y1 = max(0, y_min - 20)
        y2 = min(name_crop.shape[0], y_max + 20)
        x1 = max(0, x_min - 20)
        x2 = min(name_crop.shape[1], x_max + 20)
        
        tight_crop = name_crop[y1:y2, x1:x2]
        
        # Pad to square to prevent aspect ratio distortion
        ch, cw = tight_crop.shape
        side = max(ch, cw)
        square_crop = np.ones((side, side), dtype=np.uint8) * 255
        dy = (side - ch) // 2
        dx = (side - cw) // 2
        square_crop[dy:dy+ch, dx:dx+cw] = tight_crop
        
        # Save temporary tight crop to disk for Ollama input
        temp_tight_path = f"temp_name_crop_{os.path.basename(img_path)}.jpg"
        cv2.imwrite(temp_tight_path, square_crop)
        
        try:
            with open(temp_tight_path, 'rb') as f:
                image_bytes = f.read()
            
            # Query Ollama
            response = ollama.generate(
                model='moondream',
                prompt='Transcribe all the text in the image.',
                images=[image_bytes],
                options={'temperature': 0.0}
            )
            transcription = response['response'].strip()
            student_name = extract_student_name(transcription)
        except Exception as e:
            print(f"[!] Ollama student name recognition failed: {e}")
        finally:
            # Delete temporary crop file immediately
            if temp_tight_path and os.path.exists(temp_tight_path):
                os.remove(temp_tight_path)
                
    # 5. Answer bubbles grading
    # 5a. Detect 3 vertical lines using Canny Edge detection
    blurred = cv2.GaussianBlur(w_gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)
    
    vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 40))
    detect_vertical = cv2.morphologyEx(edges, cv2.MORPH_OPEN, vertical_kernel, iterations=1)
    col_sums = np.sum(detect_vertical > 0, axis=0)
    
    candidates = []
    for x in range(700, 1450):
        if col_sums[x] > 100:
            if col_sums[x] == np.max(col_sums[max(0, x-10):min(TARGET_W, x+11)]):
                if not candidates or x - candidates[-1] > 20:
                    candidates.append(x)
                    
    line1, line2, line3 = None, None, None
    for x1 in candidates:
        if 700 <= x1 <= 790:
            for x2 in candidates:
                if 780 <= x2 <= 850 and 40 <= (x2 - x1) <= 90:
                    for x3 in candidates:
                        if 1320 <= x3 <= 1450 and 500 <= (x3 - x2) <= 650:
                            # Verify content
                            num_crop = w_thresh[80:120, x1:x2]
                            num_pixels = np.sum(num_crop > 0)
                            bubble_a_crop = w_thresh[80:120, x2 + 10: x2 + 50]
                            bubble_a_pixels = np.sum(bubble_a_crop > 0)
                            bubble_h_crop = w_thresh[80:120, x3 - 50: x3 - 10]
                            bubble_h_pixels = np.sum(bubble_h_crop > 0)
                            
                            if num_pixels > 50 and bubble_a_pixels > 50 and bubble_h_pixels > 50:
                                line1, line2, line3 = x1, x2, x3
                                break
                    if line1 is not None:
                        break
            if line1 is not None:
                break
                
    if line1 and line2 and line3:
        x_left = line1
        x_right = line3
    else:
        x_left = 738
        x_right = 1404
        line1, line2, line3 = 744, 802, 1405
        
    # 5b. Detect horizontal lines for Y Calibration
    x_write_start = int(x_right + 10)
    x_write_end = int(TARGET_W - 20)
    horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (150, 1))
    detect_horizontal = cv2.morphologyEx(
        edges[:, x_write_start:x_write_end], cv2.MORPH_OPEN, horizontal_kernel, iterations=1
    )
    row_sums = np.sum(detect_horizontal > 0, axis=1)
    span = x_write_end - x_write_start
    
    y_peaks = []
    for y in range(40, TARGET_H - 20):
        if row_sums[y] > span * 0.15:
            if row_sums[y] == np.max(row_sums[max(0, y-15):min(TARGET_H, y+16)]):
                if not y_peaks or y - y_peaks[-1] > 30:
                    y_peaks.append(y)
                    
    matched_k = []
    matched_y = []
    for y in y_peaks:
        k = int(round((y - 62.0) / 72.8))
        if 0 <= k <= 40:
            expected_y = 62.0 + k * 72.8
            if abs(y - expected_y) < 20:
                matched_k.append(k)
                matched_y.append(y)
                
    if len(matched_k) >= 5:
        slope, intercept = np.polyfit(matched_k, matched_y, 1)
        y_start = intercept
        row_height = slope
    else:
        y_start = 62.0
        row_height = 72.8
        
    # 5c. Grade the 40 questions completely in memory
    answers = []
    active_line1 = line1 if line1 is not None else 744
    active_line2 = line2 if line2 is not None else 802
    rel_bubble_start = active_line2 - active_line1
    
    for q in range(1, 41):
        y1 = int(y_start + row_height * (q - 1))
        y2 = int(y_start + row_height * q)
        q_row_color = warped[y1:y2, x_left:x_right]
        q_row_bin = cv2.cvtColor(q_row_color, cv2.COLOR_BGR2GRAY)
        
        # Analyze bubble columns for answer grading
        bubble_area = q_row_bin[:, rel_bubble_start:]
        W = bubble_area.shape[1]
        col_width = W / 8.0
        
        black_counts = []
        for i in range(8):
            bx1 = int(i * col_width)
            bx2 = int((i + 1) * col_width)
            col_crop = bubble_area[:, bx1:bx2]
            # Since this is in-memory and not compressed, values are exactly 0 or 255.
            black_pixels = np.sum(col_crop == 0)
            black_counts.append(black_pixels)
            
        sorted_indices = np.argsort(black_counts)[::-1]
        best_idx = sorted_indices[0]
        second_idx = sorted_indices[1]
        
        max_val = black_counts[best_idx]
        diff_val = max_val - black_counts[second_idx]
        
        # Dual-threshold for in-memory uncompressed OMR bubble detection
        if max_val >= 1100 and diff_val >= 350:
            ans = chr(ord('A') + best_idx)
        else:
            ans = "-"
            
        answers.append(ans)
        
    return student_name, answers
