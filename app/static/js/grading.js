// EduPulse Ops — Grading Module
// Handles uploading scanned OMR sheets, grading review wizard, assessments list, and subjects list

import { state, authFetch, API_BASE, mockStudents, mockSubjects, mockAssessments, mockGrades } from './api.js';
import { showToast } from './ui.js';

// Dynamic OMR grid generator helper
function generateOMRGrid(containerId, count, rangeType, targetObject) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    const rangeOptions = rangeType === 'A-E' ? ['A', 'B', 'C', 'D', 'E'] : ['A', 'B', 'C', 'D'];

    for (let i = 1; i <= count; i++) {
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0';

        const label = document.createElement('span');
        label.className = 'text-xs font-bold text-slate-700 shrink-0 w-8';
        label.textContent = `Q${i}`;
        row.appendChild(label);

        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'flex gap-2.5';

        rangeOptions.forEach(opt => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'w-7 h-7 rounded-full border border-slate-200 text-xs font-bold text-slate-500 hover:border-brand-teal hover:text-brand-teal transition-all flex items-center justify-center cursor-pointer';
            btn.textContent = opt;

            // Restore selection state from backing object
            if (targetObject[i] === opt) {
                btn.className = 'w-7 h-7 rounded-full border border-brand-teal text-xs font-bold bg-brand-teal text-white shadow-sm flex items-center justify-center cursor-pointer';
            }

            btn.addEventListener('click', () => {
                if (targetObject[i] === opt) {
                    // Deselect
                    delete targetObject[i];
                    btn.className = 'w-7 h-7 rounded-full border border-slate-200 text-xs font-bold text-slate-500 hover:border-brand-teal hover:text-brand-teal transition-all flex items-center justify-center cursor-pointer';
                } else {
                    // Update selection
                    targetObject[i] = opt;
                    // Clear other options in same row
                    Array.from(optionsDiv.children).forEach(sibling => {
                        if (sibling !== btn) {
                            sibling.className = 'w-7 h-7 rounded-full border border-slate-200 text-xs font-bold text-slate-500 hover:border-brand-teal hover:text-brand-teal transition-all flex items-center justify-center cursor-pointer';
                        }
                    });
                    btn.className = 'w-7 h-7 rounded-full border border-brand-teal text-xs font-bold bg-brand-teal text-white shadow-sm flex items-center justify-center cursor-pointer';
                }
            });

            optionsDiv.appendChild(btn);
        });

        row.appendChild(optionsDiv);
        container.appendChild(row);
    }
}

export function initGrading() {
    const btnTabAssessments = document.getElementById('btn-tab-assessments');
    const btnTabBatchOMR = document.getElementById('btn-tab-batch-omr');
    const btnTabSubjects = document.getElementById('btn-tab-subjects');
    const subViewAssessments = document.getElementById('sub-view-assessments');
    const subViewBatchOMR = document.getElementById('sub-view-batch-omr');
    const subViewSubjects = document.getElementById('sub-view-subjects');
    
    function deactivateAllTabs() {
        [btnTabAssessments, btnTabBatchOMR, btnTabSubjects].forEach(btn => {
            if (btn) btn.className = 'border-b-2 border-transparent text-slate-400 hover:text-slate-600 pb-4 px-1 text-sm font-medium tracking-wide flex items-center gap-2 transition-all cursor-pointer';
        });
        [subViewAssessments, subViewBatchOMR, subViewSubjects].forEach(view => {
            if (view) view.classList.add('hidden');
        });
    }
    
    if (btnTabAssessments) {
        btnTabAssessments.addEventListener('click', () => {
            deactivateAllTabs();
            btnTabAssessments.className = 'border-b-2 border-brand-teal text-brand-teal pb-4 px-1 text-sm font-semibold tracking-wide flex items-center gap-2 transition-all cursor-pointer';
            subViewAssessments.classList.remove('hidden');
        });
    }

    if (btnTabBatchOMR) {
        btnTabBatchOMR.addEventListener('click', () => {
            deactivateAllTabs();
            btnTabBatchOMR.className = 'border-b-2 border-brand-teal text-brand-teal pb-4 px-1 text-sm font-semibold tracking-wide flex items-center gap-2 transition-all cursor-pointer';
            subViewBatchOMR.classList.remove('hidden');
            loadBatchDropdowns();
        });
    }

    if (btnTabSubjects) {
        btnTabSubjects.addEventListener('click', () => {
            deactivateAllTabs();
            btnTabSubjects.className = 'border-b-2 border-brand-teal text-brand-teal pb-4 px-1 text-sm font-semibold tracking-wide flex items-center gap-2 transition-all cursor-pointer';
            subViewSubjects.classList.remove('hidden');
        });
    }

    // =====================================================================
    // BATCH OMR GRADING WIZARD LOGIC
    // =====================================================================
    let batchSheets = [];
    let batchCurrentIndex = 0;
    let batchSelectedClassId = null;
    let batchSelectedAssessmentId = null;
    let currentZoom = 1.0;
    let currentRotation = 0;

    // Visual feedback for file input selection
    const zipInput = document.getElementById('batch-zip-input');
    const fileLabel = document.getElementById('batch-file-label');
    if (zipInput && fileLabel) {
        zipInput.addEventListener('change', () => {
            if (zipInput.files && zipInput.files.length > 0) {
                fileLabel.textContent = `Selected: ${zipInput.files[0].name} (${(zipInput.files[0].size / 1024).toFixed(1)} KB)`;
                fileLabel.className = "text-xs font-semibold text-brand-teal";
            } else {
                fileLabel.textContent = "Drag & drop your ZIP file here or click to browse";
                fileLabel.className = "text-xs font-semibold text-slate-605";
            }
        });
    }

    const batchUploadForm = document.getElementById('batch-upload-form');
    if (batchUploadForm) {
        batchUploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('batch-upload-submit-btn');
            const originalHtml = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Processing...';
            
            const class_id = parseInt(document.getElementById('batch-classroom-select').value);
            const assessment_id = parseInt(document.getElementById('batch-assessment-select').value);
            const fileInput = document.getElementById('batch-zip-input');
            
            if (!fileInput.files || fileInput.files.length === 0) {
                showToast("Please select a ZIP file to upload.", "error");
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalHtml;
                return;
            }
            
            batchSelectedClassId = class_id;
            batchSelectedAssessmentId = assessment_id;
            
            const formData = new FormData();
            formData.append('class_id', class_id);
            formData.append('assessment_id', assessment_id);
            formData.append('file', fileInput.files[0]);
            
            if (state.isSimulated) {
                setTimeout(() => {
                    const classStudents = state.studentsList.filter(s => s.class_id === class_id);
                    if (classStudents.length === 0) {
                        showToast("No active students found in selected classroom for mock mode.", "error");
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = originalHtml;
                        return;
                    }
                    
                    const mockMatches = [
                        { name: "Ravi Kumar", filename: "WhatsApp Image 2026-06-20 at 12.23.53 AM.jpeg" },
                        { name: "Nurul Izzah", filename: "WhatsApp Image 2026-06-20 at 12.23.53 AM (1).jpeg" },
                        { name: "Ahmad Danial", filename: "WhatsApp Image 2026-06-20 at 12.23.54 AM.jpeg" }
                    ];
                    
                    batchSheets = mockMatches.map(m => {
                        const dbStudent = classStudents.find(s => s.full_name === m.name) || classStudents[0];
                        return {
                            filename: m.filename,
                            image_url: `/static/temp_submissions/test_session/${m.filename}`,
                            crop_url: `/static/temp_submissions/test_session/crop_${m.filename}`,
                            student_id: dbStudent.id,
                            student_name: dbStudent.full_name,
                            confidence: 0.95,
                            answers: {"1":"B","2":"C","3":"D","4":"A","5":"B","6":"C","7":"D","8":"A","9":"B","10":"C"},
                            status: "Matched",
                            approved: false
                        };
                    });
                    
                    showToast("ZIP processed successfully (Mock Mode)");
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalHtml;
                    startReviewWizard();
                }, 1000);
                return;
            }
            
            try {
                const response = await authFetch(`${API_BASE}/grading/batch-upload`, {
                    method: 'POST',
                    body: formData
                });
                
                if (response.ok) {
                    const data = await response.json();
                    batchSheets = data.sheets.map(s => ({ ...s, approved: false }));
                    showToast(`Successfully processed ZIP file with ${batchSheets.length} sheets`);
                    startReviewWizard();
                } else {
                    const err = await response.json();
                    showToast(`Failed to process batch upload: ${err.detail || 'Server error'}`, 'error');
                }
            } catch (error) {
                console.error("Error batch uploading:", error);
                showToast("Network error. Failed to process batch upload.", "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalHtml;
            }
        });
    }

    function startReviewWizard() {
        const uploadState = document.getElementById('batch-upload-state');
        const reviewState = document.getElementById('batch-review-state');
        
        if (uploadState && reviewState) {
            uploadState.classList.add('hidden');
            reviewState.classList.remove('hidden');
        }
        
        const classroom = state.classroomsList.find(c => c.id === batchSelectedClassId);
        const assessment = state.assessmentsList.find(a => a.id === batchSelectedAssessmentId);
        
        document.getElementById('batch-review-class-title').textContent = classroom ? classroom.name : '-';
        document.getElementById('batch-review-assessment-title').textContent = `Assessment: ${assessment ? assessment.title : '-'}`;
        
        const verifyStudentSelect = document.getElementById('batch-student-select-verify');
        if (verifyStudentSelect) {
            verifyStudentSelect.innerHTML = '';
            const placeholderOpt = document.createElement('option');
            placeholderOpt.value = '';
            placeholderOpt.textContent = '-- Select Student --';
            verifyStudentSelect.appendChild(placeholderOpt);
            
            const classStudents = state.studentsList.filter(s => s.class_id === batchSelectedClassId);
            classStudents.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.id;
                opt.textContent = s.full_name;
                verifyStudentSelect.appendChild(opt);
            });
        }
        
        batchCurrentIndex = 0;
        renderCurrentReviewSheet();
    }

    function updateImageTransform() {
        const img = document.getElementById('batch-sheet-image');
        if (img) {
            img.style.transform = `scale(${currentZoom}) rotate(${currentRotation}deg)`;
        }
    }

    const zoomInBtn = document.getElementById('batch-zoom-in');
    const zoomOutBtn = document.getElementById('batch-zoom-out');
    const zoomResetBtn = document.getElementById('batch-zoom-reset');
    const rotateCcwBtn = document.getElementById('batch-rotate-ccw');
    const rotateCwBtn = document.getElementById('batch-rotate-cw');
    
    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => {
            currentZoom = Math.min(3.0, currentZoom + 0.15);
            updateImageTransform();
        });
    }
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => {
            currentZoom = Math.max(0.5, currentZoom - 0.15);
            updateImageTransform();
        });
    }
    if (zoomResetBtn) {
        zoomResetBtn.addEventListener('click', () => {
            currentZoom = 1.0;
            currentRotation = 0;
            updateImageTransform();
        });
    }
    if (rotateCcwBtn) {
        rotateCcwBtn.addEventListener('click', () => {
            currentRotation = (currentRotation - 90) % 360;
            updateImageTransform();
        });
    }
    if (rotateCwBtn) {
        rotateCwBtn.addEventListener('click', () => {
            currentRotation = (currentRotation + 90) % 360;
            updateImageTransform();
        });
    }

    // Drag to scroll image container panner
    const canvasWrapper = document.getElementById('batch-canvas-wrapper');
    let isDragging = false;
    let startX, startY, scrollLeft, scrollTop;
    
    if (canvasWrapper) {
        canvasWrapper.addEventListener('mousedown', (e) => {
            isDragging = true;
            canvasWrapper.style.cursor = 'grabbing';
            startX = e.pageX - canvasWrapper.offsetLeft;
            startY = e.pageY - canvasWrapper.offsetTop;
            scrollLeft = canvasWrapper.scrollLeft;
            scrollTop = canvasWrapper.scrollTop;
        });
        
        canvasWrapper.addEventListener('mouseleave', () => {
            isDragging = false;
            canvasWrapper.style.cursor = 'grab';
        });
        
        canvasWrapper.addEventListener('mouseup', () => {
            isDragging = false;
            canvasWrapper.style.cursor = 'grab';
        });
        
        canvasWrapper.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            const x = e.pageX - canvasWrapper.offsetLeft;
            const y = e.pageY - canvasWrapper.offsetTop;
            const walkX = (x - startX) * 1.5;
            const walkY = (y - startY) * 1.5;
            canvasWrapper.scrollLeft = scrollLeft - walkX;
            canvasWrapper.scrollTop = scrollTop - walkY;
        });
    }

    function renderCurrentReviewSheet() {
        if (batchSheets.length === 0) return;
        const sheet = batchSheets[batchCurrentIndex];
        
        document.getElementById('batch-wizard-progress').textContent = `Sheet ${batchCurrentIndex + 1} / ${batchSheets.length}`;
        document.getElementById('batch-sheet-image').src = sheet.image_url;
        document.getElementById('batch-name-crop').src = sheet.crop_url;
        
        const badge = document.getElementById('batch-confidence-badge');
        if (badge) {
            badge.textContent = `${(sheet.confidence * 100).toFixed(0)}% Confidence (${sheet.status})`;
            if (sheet.confidence > 0.8) {
                badge.className = 'px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100';
            } else {
                badge.className = 'px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-100';
            }
        }
        
        const verifyStudentSelect = document.getElementById('batch-student-select-verify');
        if (verifyStudentSelect) {
            verifyStudentSelect.value = sheet.student_id || '';
        }
        
        const approveCheck = document.getElementById('batch-sheet-approve-check');
        if (approveCheck) {
            approveCheck.checked = sheet.approved || false;
        }
        
        renderOverrideGrid(sheet);
        recalculateLiveScore();
        
        currentZoom = 1.0;
        currentRotation = 0;
        updateImageTransform();
        updateWizardButtons();
    }

    function renderOverrideGrid(sheet) {
        const container = document.getElementById('batch-omr-override-grid');
        if (!container) return;
        container.innerHTML = '';
        
        const assessment = state.assessmentsList.find(a => a.id === batchSelectedAssessmentId);
        if (!assessment) return;
        
        let answersKey = {};
        try {
            answersKey = JSON.parse(assessment.config);
        } catch (e) {}
        
        let count = 10;
        let optionRange = 'A-D';
        const keys = Object.keys(answersKey).map(Number);
        if (keys.length > 0) {
            count = Math.max(...keys);
        }
        if (Object.values(answersKey).includes('E')) {
            optionRange = 'A-E';
        }
        
        const options = optionRange === 'A-D' ? ['A', 'B', 'C', 'D'] : ['A', 'B', 'C', 'D', 'E'];
        
        for (let i = 1; i <= count; i++) {
            const qKey = i.toString();
            const correctChoice = answersKey[qKey];
            
            const row = document.createElement('div');
            row.className = 'flex items-center justify-between py-2 border-b border-slate-100 last:border-0 text-xs';
            
            const label = document.createElement('span');
            label.className = 'font-bold text-slate-700 shrink-0 w-8';
            label.textContent = `Q${i}`;
            row.appendChild(label);
            
            const optionsDiv = document.createElement('div');
            optionsDiv.className = 'flex items-center gap-1.5';
            
            options.forEach(opt => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.textContent = opt;
                
                const isSelected = sheet.answers[qKey] === opt;
                const isCorrect = correctChoice === opt;
                
                let btnStyle = 'w-7 h-7 rounded-full border border-slate-200 text-[10px] font-bold text-slate-500 hover:border-brand-teal hover:text-brand-teal transition-all flex items-center justify-center cursor-pointer';
                
                if (isSelected) {
                    if (isCorrect) {
                        btnStyle = 'w-7 h-7 rounded-full border border-emerald-500 bg-emerald-500 text-white text-[10px] font-bold shadow-sm flex items-center justify-center cursor-pointer';
                    } else {
                        btnStyle = 'w-7 h-7 rounded-full border border-rose-500 bg-rose-500 text-white text-[10px] font-bold shadow-sm flex items-center justify-center cursor-pointer';
                    }
                } else if (isCorrect) {
                    btnStyle = 'w-7 h-7 rounded-full border border-dashed border-emerald-500 bg-emerald-50 text-[10px] font-bold text-emerald-600 flex items-center justify-center cursor-pointer';
                }
                
                btn.className = btnStyle;
                
                btn.addEventListener('click', () => {
                    if (sheet.answers[qKey] === opt) {
                        delete sheet.answers[qKey];
                    } else {
                        sheet.answers[qKey] = opt;
                    }
                    renderOverrideGrid(sheet);
                    recalculateLiveScore();
                });
                
                optionsDiv.appendChild(btn);
            });
            
            row.appendChild(optionsDiv);
            container.appendChild(row);
        }
    }

    function recalculateLiveScore() {
        if (batchSheets.length === 0) return;
        const sheet = batchSheets[batchCurrentIndex];
        
        const assessment = state.assessmentsList.find(a => a.id === batchSelectedAssessmentId);
        if (!assessment) return;
        
        let answersKey = {};
        try {
            answersKey = JSON.parse(assessment.config);
        } catch (e) {}
        
        const totalQuestions = Object.keys(answersKey).length;
        if (totalQuestions === 0) return;
        
        let correctCount = 0;
        for (let q in answersKey) {
            if (sheet.answers[q] === answersKey[q]) {
                correctCount++;
            }
        }
        
        const scorePct = (correctCount / totalQuestions) * 100.0;
        document.getElementById('batch-wizard-live-score').textContent = `${scorePct.toFixed(1)}%`;
    }

    function updateWizardButtons() {
        const prevBtn = document.getElementById('batch-prev-sheet');
        const nextBtn = document.getElementById('batch-next-sheet');
        const saveBtn = document.getElementById('batch-save-confirm-btn');
        
        if (prevBtn) {
            prevBtn.disabled = batchCurrentIndex === 0;
            prevBtn.className = batchCurrentIndex === 0
                ? 'py-2.5 bg-slate-100 border border-slate-200 text-slate-400 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-not-allowed opacity-50'
                : 'py-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer';
        }
        
        if (nextBtn) {
            nextBtn.disabled = batchCurrentIndex === batchSheets.length - 1;
            nextBtn.className = batchCurrentIndex === batchSheets.length - 1
                ? 'py-2.5 bg-slate-100 border border-slate-200 text-slate-400 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-not-allowed opacity-50'
                : 'py-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer';
        }
        
        const allApproved = batchSheets.length > 0 && batchSheets.every(s => s.approved);
        if (saveBtn) {
            saveBtn.disabled = !allApproved;
            if (allApproved) {
                saveBtn.className = 'w-full py-3.5 bg-brand-teal hover:bg-teal-700 border border-brand-teal text-white rounded-xl font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-brand-teal/20';
            } else {
                saveBtn.className = 'w-full py-3.5 bg-slate-200 text-slate-400 border border-slate-300 rounded-xl font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-not-allowed';
            }
        }
    }

    const verifyStudentSelectVerify = document.getElementById('batch-student-select-verify');
    if (verifyStudentSelectVerify) {
        verifyStudentSelectVerify.addEventListener('change', () => {
            const studentId = parseInt(verifyStudentSelectVerify.value);
            const sheet = batchSheets[batchCurrentIndex];
            if (sheet) {
                sheet.student_id = studentId;
                const s = state.studentsList.find(std => std.id === studentId);
                sheet.student_name = s ? s.full_name : '';
            }
        });
    }

    const approveCheck = document.getElementById('batch-sheet-approve-check');
    if (approveCheck) {
        approveCheck.addEventListener('change', () => {
            const sheet = batchSheets[batchCurrentIndex];
            if (sheet) {
                sheet.approved = approveCheck.checked;
                updateWizardButtons();
            }
        });
    }

    const prevSheetBtn = document.getElementById('batch-prev-sheet');
    const nextSheetBtn = document.getElementById('batch-next-sheet');
    if (prevSheetBtn) {
        prevSheetBtn.addEventListener('click', () => {
            if (batchCurrentIndex > 0) {
                batchCurrentIndex--;
                renderCurrentReviewSheet();
            }
        });
    }
    if (nextSheetBtn) {
        nextSheetBtn.addEventListener('click', () => {
            if (batchCurrentIndex < batchSheets.length - 1) {
                batchCurrentIndex++;
                renderCurrentReviewSheet();
            }
        });
    }

    const exitReviewBtn = document.getElementById('batch-exit-review-btn');
    if (exitReviewBtn) {
        exitReviewBtn.addEventListener('click', () => {
            if (confirm("Are you sure you want to exit? Your current verification progress on these sheets will be lost.")) {
                const uploadState = document.getElementById('batch-upload-state');
                const reviewState = document.getElementById('batch-review-state');
                if (uploadState && reviewState) {
                    reviewState.classList.add('hidden');
                    uploadState.classList.remove('hidden');
                }
            }
        });
    }

    function triggerCSVDownload(rows) {
        let csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
            + rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `grades_report_class_${batchSelectedClassId}_assessment_${batchSelectedAssessmentId}.csv`);
        document.body.appendChild(link);
        
        link.click();
        document.body.removeChild(link);
        showToast("CSV report downloaded successfully");
    }

    const saveConfirmBtn = document.getElementById('batch-save-confirm-btn');
    if (saveConfirmBtn) {
        saveConfirmBtn.addEventListener('click', async () => {
            const originalHtml = saveConfirmBtn.innerHTML;
            saveConfirmBtn.disabled = true;
            saveConfirmBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Saving Grades...';
            
            const payload = {
                assessment_id: batchSelectedAssessmentId,
                grades: batchSheets.map(s => ({
                    student_id: s.student_id,
                    student_response: JSON.stringify(s.answers)
                }))
            };
            
            if (state.isSimulated) {
                setTimeout(() => {
                    const assessment = mockAssessments.find(a => a.id === batchSelectedAssessmentId);
                    
                    payload.grades.forEach(item => {
                        const student = mockStudents.find(s => s.id === item.student_id);
                        let correct_count = 0;
                        const answers = JSON.parse(assessment.config);
                        const responseDict = JSON.parse(item.student_response);
                        const total_questions = Object.keys(answers).length;
                        
                        for (let q in answers) {
                            if (responseDict[q] === answers[q]) correct_count++;
                        }
                        const rawScore = parseFloat(((correct_count / total_questions) * assessment.max_points).toFixed(2));
                        
                        const newGradeId = mockGrades.length + 1;
                        const newGrade = {
                            id: newGradeId,
                            student_id: item.student_id,
                            assessment_id: batchSelectedAssessmentId,
                            student_response: item.student_response,
                            score: rawScore,
                            status: 'COMPLETED',
                            feedback: JSON.stringify({ message: "Graded", correct_count, total_questions }),
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        };
                        
                        const existingIdx = mockGrades.findIndex(g => g.student_id === item.student_id && g.assessment_id === batchSelectedAssessmentId);
                        if (existingIdx !== -1) {
                            mockGrades[existingIdx] = newGrade;
                        } else {
                            mockGrades.push(newGrade);
                        }
                    });
                    
                    showToast("Batch grades saved successfully (Mock Mode)");
                    saveConfirmBtn.disabled = false;
                    saveConfirmBtn.innerHTML = originalHtml;
                    
                    const csvRows = [["Student Name", "Score"]];
                    payload.grades.forEach(item => {
                        const student = mockStudents.find(s => s.id === item.student_id);
                        const answers = JSON.parse(assessment.config);
                        const responseDict = JSON.parse(item.student_response);
                        const total_questions = Object.keys(answers).length;
                        let correct_count = 0;
                        for (let q in answers) {
                            if (responseDict[q] === answers[q]) correct_count++;
                        }
                        const rawScore = parseFloat(((correct_count / total_questions) * assessment.max_points).toFixed(2));
                        csvRows.push([student ? student.full_name : `Student ${item.student_id}`, rawScore]);
                    });
                    
                    triggerCSVDownload(csvRows);
                    
                    const uploadState = document.getElementById('batch-upload-state');
                    const reviewState = document.getElementById('batch-review-state');
                    if (uploadState && reviewState) {
                        reviewState.classList.add('hidden');
                        uploadState.classList.remove('hidden');
                    }
                    
                    loadGradingData();
                }, 1000);
                return;
            }
            
            try {
                const response = await authFetch(`${API_BASE}/grading/batch-confirm`, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                
                if (response.ok) {
                    showToast("All student responses successfully graded and saved to database");
                    
                    const assessment = state.assessmentsList.find(a => a.id === batchSelectedAssessmentId);
                    const answers = JSON.parse(assessment.config);
                    const total_questions = Object.keys(answers).length;
                    
                    const csvRows = [["Student Name", "Score"]];
                    batchSheets.forEach(sheet => {
                        let correct_count = 0;
                        for (let q in answers) {
                            if (sheet.answers[q] === answers[q]) {
                                    correct_count++;
                                }
                            }
                        const score = parseFloat(((correct_count / total_questions) * assessment.max_points).toFixed(2));
                        csvRows.push([sheet.student_name, score]);
                    });
                    
                    triggerCSVDownload(csvRows);
                    
                    const uploadState = document.getElementById('batch-upload-state');
                    const reviewState = document.getElementById('batch-review-state');
                    if (uploadState && reviewState) {
                        reviewState.classList.add('hidden');
                        uploadState.classList.remove('hidden');
                    }
                    
                    loadGradingData();
                } else {
                    const err = await response.json();
                    showToast(`Failed to confirm grades: ${err.detail || 'Server error'}`, 'error');
                }
            } catch (error) {
                console.error("Error confirming batch grades:", error);
                showToast("Network error. Failed to save grades.", "error");
            } finally {
                saveConfirmBtn.disabled = false;
                saveConfirmBtn.innerHTML = originalHtml;
            }
        });
    }

    // Active local selections mapping objects
    let activeOmrAnswerKey = {}; // E.g., {"1": "A", "2": "C"}

    // Toggle configuration panels based on grading type
    const gradingTypeSelect = document.getElementById('assessment-grading-type');
    const panelOmrConfig = document.getElementById('panel-omr-config');
    const panelMathConfig = document.getElementById('panel-math-config');

    // Builders for new Assessment
    const omrQuestionCountInput = document.getElementById('omr-question-count');
    const omrOptionRangeSelect = document.getElementById('omr-option-range');

    function triggerOMRBuilderGeneration() {
        if (gradingTypeSelect && gradingTypeSelect.value === 'OMR') {
            const count = parseInt(omrQuestionCountInput.value) || 10;
            const range = omrOptionRangeSelect.value;
            
            // Clear out of bounds keys if count decreased
            Object.keys(activeOmrAnswerKey).forEach(k => {
                if (parseInt(k) > count) {
                    delete activeOmrAnswerKey[k];
                }
            });

            generateOMRGrid('omr-builder-container', count, range, activeOmrAnswerKey);
        }
    }

    if (gradingTypeSelect && panelOmrConfig && panelMathConfig) {
        gradingTypeSelect.addEventListener('change', () => {
            const val = gradingTypeSelect.value;
            if (val === 'OMR') {
                panelOmrConfig.classList.remove('hidden');
                panelMathConfig.classList.add('hidden');
                triggerOMRBuilderGeneration();
            } else {
                panelMathConfig.classList.remove('hidden');
                panelOmrConfig.classList.add('hidden');
            }
        });
        // Initial state trigger
        gradingTypeSelect.dispatchEvent(new Event('change'));
    }

    if (omrQuestionCountInput && omrOptionRangeSelect) {
        omrQuestionCountInput.addEventListener('input', triggerOMRBuilderGeneration);
        omrOptionRangeSelect.addEventListener('change', triggerOMRBuilderGeneration);
    }

    // Create Assessment Form submit
    const createAssessmentForm = document.getElementById('create-assessment-form');
    if (createAssessmentForm) {
        createAssessmentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('create-assessment-submit-btn');
            const originalHtml = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Creating...';

            const title = document.getElementById('assessment-title').value;
            const subject_id = parseInt(document.getElementById('assessment-subject').value);
            const grading_type = document.getElementById('assessment-grading-type').value;
            const max_points = parseInt(document.getElementById('assessment-max-points').value) || 100;

            let config = '';
            if (grading_type === 'OMR') {
                const count = parseInt(omrQuestionCountInput.value) || 10;
                // Validate that all questions have an answer selected
                if (Object.keys(activeOmrAnswerKey).length < count) {
                    showToast(`Please specify correct answers for all ${count} questions before saving.`, "error");
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalHtml;
                    return;
                }
                config = JSON.stringify(activeOmrAnswerKey);
            } else {
                config = document.getElementById('assessment-math-answer').value.trim();
                if (!config) {
                    showToast("Please provide expected math expression answer.", "error");
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalHtml;
                    return;
                }
            }

            const payload = { title, subject_id, grading_type, max_points, config };

            if (state.isSimulated) {
                setTimeout(() => {
                    const newId = mockAssessments.length + 1;
                    mockAssessments.push({
                        id: newId,
                        title,
                        subject_id,
                        teacher_id: 1,
                        grading_type,
                        config,
                        max_points,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    });
                    showToast(`Assessment "${title}" created successfully`);
                    createAssessmentForm.reset();
                    activeOmrAnswerKey = {}; // Reset local map
                    if (gradingTypeSelect) gradingTypeSelect.dispatchEvent(new Event('change'));
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalHtml;
                    loadGradingData();
                }, 600);
                return;
            }

            try {
                const response = await authFetch(`${API_BASE}/grading/assessments`, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    showToast(`Assessment "${title}" created successfully`);
                    createAssessmentForm.reset();
                    activeOmrAnswerKey = {}; // Reset local map
                    if (gradingTypeSelect) gradingTypeSelect.dispatchEvent(new Event('change'));
                    loadGradingData();
                } else {
                    const err = await response.json();
                    showToast(`Failed to create assessment: ${err.detail || 'Server error'}`, 'error');
                }
            } catch (error) {
                console.error("Error creating assessment:", error);
                showToast("Network error. Failed to create assessment.", "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalHtml;
            }
        });
    }

    // Create Subject Form submit
    const createSubjectForm = document.getElementById('create-subject-form');
    if (createSubjectForm) {
        createSubjectForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('create-subject-submit-btn');
            const originalHtml = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Creating...';

            const name = document.getElementById('subject-name').value;
            const code = document.getElementById('subject-code').value.toUpperCase();
            const school_id = state.currentSchoolId || 1;

            const payload = { name, code, school_id };

            if (state.isSimulated) {
                setTimeout(() => {
                    const newId = mockSubjects.length > 0 ? Math.max(...mockSubjects.map(s => s.id)) + 1 : 1;
                    const newSub = { id: newId, name, code, school_id };
                    mockSubjects.push(newSub);
                    state.subjectsList.push(newSub);
                    showToast(`Subject "${name}" created successfully`);
                    createSubjectForm.reset();
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalHtml;
                    loadGradingData();
                }, 500);
                return;
            }

            try {
                const response = await authFetch(`${API_BASE}/grading/subjects`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Failed to create subject');
                }

                showToast(`Subject "${name}" created successfully`);
                createSubjectForm.reset();
                loadGradingData();
            } catch (error) {
                console.error('Error creating subject:', error);
                showToast(error.message, 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalHtml;
            }
        });
    }
}

export function loadBatchDropdowns() {
    const batchClassroomSelect = document.getElementById('batch-classroom-select');
    const batchAssessmentSelect = document.getElementById('batch-assessment-select');
    
    if (batchClassroomSelect) {
        const firstOpt = batchClassroomSelect.options[0];
        batchClassroomSelect.innerHTML = '';
        batchClassroomSelect.appendChild(firstOpt);
        state.classroomsList.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name;
            batchClassroomSelect.appendChild(opt);
        });
    }
    
    if (batchAssessmentSelect) {
        const firstOpt = batchAssessmentSelect.options[0];
        batchAssessmentSelect.innerHTML = '';
        batchAssessmentSelect.appendChild(firstOpt);
        const omrAssessments = state.assessmentsList.filter(a => a.grading_type.toUpperCase() === 'OMR');
        omrAssessments.forEach(a => {
            const opt = document.createElement('option');
            opt.value = a.id;
            opt.textContent = a.title;
            batchAssessmentSelect.appendChild(opt);
        });
    }
}

export async function loadGradingData() {
    // Render immediately from cache if available to prevent UI lag
    if (state.subjectsList.length > 0 || state.assessmentsList.length > 0) {
        populateGradingDropdowns(state.subjectsList, state.assessmentsList, state.studentsList);
        renderAssessmentsTable(state.assessmentsList, state.subjectsList);
        renderSubjectsTable(state.subjectsList);
    }

    if (state.isSimulated) {
        state.assessmentsList = mockAssessments;
        state.subjectsList = mockSubjects;
        state.studentsList = mockStudents;

        populateGradingDropdowns(mockSubjects, mockAssessments, mockStudents);
        renderAssessmentsTable(mockAssessments, mockSubjects);
        renderSubjectsTable(mockSubjects);
        return;
    }

    try {
        // Load subjects, students, and assessments in background
        const [subjectsRes, studentsRes, assessmentsRes] = await Promise.allSettled([
            authFetch(`${API_BASE}/grading/subjects`),
            authFetch(`${API_BASE}/students/?skip=0&limit=500`),
            authFetch(`${API_BASE}/grading/assessments`)
        ]);

        if (subjectsRes.status === 'fulfilled' && subjectsRes.value.ok) {
            const data = await subjectsRes.value.json();
            state.subjectsList = data.items || [];
        }

        if (studentsRes.status === 'fulfilled' && studentsRes.value.ok) {
            const data = await studentsRes.value.json();
            state.studentsList = data.items || [];
        }

        if (assessmentsRes.status === 'fulfilled' && assessmentsRes.value.ok) {
            const data = await assessmentsRes.value.json();
            state.assessmentsList = data.items || [];
        }

        populateGradingDropdowns(state.subjectsList, state.assessmentsList, state.studentsList);
        renderAssessmentsTable(state.assessmentsList, state.subjectsList);
        renderSubjectsTable(state.subjectsList);
    } catch (error) {
        console.error("Error loading grading data:", error);
        showToast("Failed to fetch live grading data, running in offline backup mode.", "warning");
        // Fallback to simulation
        state.isSimulated = true;
        loadGradingData();
    }
}

export function populateGradingDropdowns(subjects, assessments, students) {
    const assessmentSubjectSelect = document.getElementById('assessment-subject');

    if (assessmentSubjectSelect) {
        const firstOpt = assessmentSubjectSelect.options[0];
        assessmentSubjectSelect.innerHTML = '';
        assessmentSubjectSelect.appendChild(firstOpt);
        subjects.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = `${s.name} (${s.code})`;
            assessmentSubjectSelect.appendChild(opt);
        });
    }
}

function renderSubjectsTable(subjects) {
    const tbody = document.getElementById('subjects-table-body');
    if (!tbody) return;

    if (subjects.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" class="py-8 text-center text-slate-400">
                    <i class="fas fa-book text-lg mb-2 block"></i>
                    No subjects created yet.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = subjects.map(sub => `
        <tr class="hover:bg-slate-50/50 transition-colors">
            <td class="py-3 px-4 font-mono text-xs font-bold text-slate-650">${sub.code}</td>
            <td class="py-3 px-4 font-semibold text-slate-800">${sub.name}</td>
            <td class="py-3 px-4 text-center">
                <div class="flex items-center justify-center gap-2">
                    <button onclick="openEditModal('subject', ${sub.id})" class="p-1.5 bg-slate-100 hover:bg-brand-accent hover:text-brand-teal text-slate-600 rounded-lg transition-colors cursor-pointer" title="Edit Subject">
                        <i class="fas fa-pen text-xs"></i>
                    </button>
                    <button onclick="deleteSubject(${sub.id})" class="p-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 rounded-lg transition-colors cursor-pointer" title="Delete Subject">
                        <i class="fas fa-trash-can text-xs"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

export async function deleteSubject(subjectId) {
    if (!confirm('Are you sure you want to delete this subject?')) return;

    if (state.isSimulated) {
        const idx = mockSubjects.findIndex(s => s.id === subjectId);
        if (idx !== -1) {
            mockSubjects.splice(idx, 1);
            showToast('Subject deleted successfully (simulation)');
            loadGradingData();
        }
        return;
    }

    try {
        const response = await authFetch(`${API_BASE}/grading/subjects/${subjectId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to delete subject');
        }

        showToast('Subject deleted successfully');
        loadGradingData();
    } catch (error) {
        console.error('Error deleting subject:', error);
        showToast(error.message, 'error');
    }
}

function renderAssessmentsTable(assessments, subjects) {
    const tableBody = document.getElementById('assessments-table-body');
    if (!tableBody) return;

    if (assessments.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="py-8 text-center text-slate-400">
                    <i class="fas fa-folder-open text-2xl block mb-2 opacity-50"></i>
                    No assessments created yet. Set up one using the form.
                </td>
            </tr>`;
        return;
    }

    let html = '';
    assessments.forEach(a => {
        const subject = subjects.find(s => s.id === a.subject_id);
        const subjectName = subject ? `${subject.name} (${subject.code})` : 'Unknown Subject';
        const engineBadge = a.grading_type === 'OMR' 
            ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-brand-teal">OMR ENGINE</span>'
            : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-600">MATH STUB</span>';

        html += `
            <tr class="hover:bg-slate-50/50 transition-colors">
                <td class="py-3.5 px-4 font-bold text-slate-800">${a.title}</td>
                <td class="py-3.5 px-4 text-slate-600">${subjectName}</td>
                <td class="py-3.5 px-4">${engineBadge}</td>
                <td class="py-3.5 px-4 text-center font-semibold text-slate-700">${a.max_points}</td>
                <td class="py-3.5 px-4 text-center">
                    <button onclick="openEditModal('assessment', ${a.id})" class="text-xs text-amber-600 hover:text-amber-800 font-semibold px-2 py-1 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer mr-2">
                        Modify
                    </button>
                    <button onclick="deleteAssessment(${a.id})" class="text-xs text-rose-500 hover:text-rose-700 font-semibold px-2 py-1 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer">
                        Delete
                    </button>
                </td>
            </tr>`;
    });
    tableBody.innerHTML = html;
}

export async function deleteAssessment(id) {
    if (!confirm("Are you sure you want to delete this assessment? All associated student grades will be deleted as well.")) return;

    if (state.isSimulated) {
        const idx = mockAssessments.findIndex(a => a.id === id);
        if (idx !== -1) {
            const title = mockAssessments[idx].title;
            mockAssessments.splice(idx, 1);
            // Also clean grades
            for (let i = mockGrades.length - 1; i >= 0; i--) {
                if (mockGrades[i].assessment_id === id) {
                    mockGrades.splice(i, 1);
                }
            }
            showToast(`Assessment "${title}" deleted successfully`);
            loadGradingData();
        }
        return;
    }

    try {
        const response = await authFetch(`${API_BASE}/grading/assessments/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast("Assessment deleted successfully");
            loadGradingData();
        } else {
            const err = await response.json();
            showToast(`Failed to delete assessment: ${err.detail || 'Server error'}`, 'error');
        }
    } catch (error) {
        console.error("Error deleting assessment:", error);
        showToast("Network error. Failed to delete assessment.", "error");
    }
}

// Bind to window for HTML events compatibility
window.deleteSubject = deleteSubject;
window.deleteAssessment = deleteAssessment;
window.loadGradingData = loadGradingData;
