// EduPulse Ops — Automation Module
// Handles bulk csv/image uploads, OCR parsing, drag-and-drop ingestion, and import summaries

import { state, authFetch, API_BASE } from './api.js';
import { showToast } from './ui.js';

let selectedAutomationFile = null;

export function initAutomationView() {
    console.log("Initializing Automation View...");
    
    // Hide teachers selection for non-admin users
    const optTeachers = document.getElementById('opt-automation-teachers');
    const taskSelect = document.getElementById('automation-task-select');
    
    if (state.currentUser && state.currentUser.role !== 'ADMIN') {
        if (optTeachers) {
            optTeachers.style.display = 'none';
        }
        if (taskSelect && taskSelect.value === 'teachers') {
            taskSelect.value = 'students';
            onAutomationTaskChanged();
        }
    } else if (optTeachers) {
        optTeachers.style.display = 'block';
    }
    
    // Setup Drag & Drop
    const dropZone = document.getElementById('automation-drag-drop-zone');
    const fileInput = document.getElementById('automation-file-input');
    
    if (dropZone && fileInput) {
        // Click to upload
        dropZone.onclick = () => fileInput.click();
        
        // Drag and drop events
        dropZone.ondragover = (e) => {
            e.preventDefault();
            dropZone.classList.add('border-brand-teal', 'bg-teal-50/10');
        };
        
        dropZone.ondragleave = () => {
            dropZone.classList.remove('border-brand-teal', 'bg-teal-50/10');
        };
        
        dropZone.ondrop = (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-brand-teal', 'bg-teal-50/10');
            if (e.dataTransfer.files.length > 0) {
                handleSelectedAutomationFile(e.dataTransfer.files[0]);
            }
        };
        
        fileInput.onchange = () => {
            if (fileInput.files.length > 0) {
                handleSelectedAutomationFile(fileInput.files[0]);
            }
        };
    }
}

export function onAutomationTaskChanged() {
    const select = document.getElementById('automation-task-select');
    const desc = document.getElementById('automation-template-desc');
    const downloadBtn = document.getElementById('automation-template-download-btn');
    
    if (!select || !desc || !downloadBtn) return;
    
    const task = select.value;
    downloadBtn.href = `${API_BASE}/automation/templates/${task}`;
    
    const descriptions = {
        teachers: "The teachers template includes employee ID, full name, email, contact number, emergency contact, and status (is_active).",
        classrooms: "The classrooms template includes classroom name, grade level, capacity, and the employee ID of the form teacher.",
        students: "The students template includes student ID, full name, classroom name, gender, IC number, birth date, enroll date, parent contacts, residential address, default merit points, and status.",
        schedules: "The schedules template includes timetable name, class name, subject code, teacher employee ID, day of week (e.g., Monday), and period number (1-8).",
        attendance: "The attendance template includes student ID number, date (YYYY-MM-DD), status (PRESENT, ABSENT, LATE, EXCUSED), period number (optional), and notes.",
        merit: "The merit template includes student ID number, merit option name, points, and justification."
    };
    
    desc.textContent = descriptions[task] || "Select a target dataset to view instructions.";
}

export function handleSelectedAutomationFile(file) {
    selectedAutomationFile = file;
    const statusDiv = document.getElementById('automation-file-status');
    const statusName = document.getElementById('status-file-name');
    const statusIcon = document.getElementById('status-file-icon');
    const submitBtn = document.getElementById('automation-submit-btn');
    
    if (!statusDiv || !statusName || !statusIcon || !submitBtn) return;
    
    statusName.textContent = file.name;
    
    const isImage = file.type.startsWith('image/');
    statusIcon.className = isImage ? 'fas fa-file-image text-brand-teal text-base shrink-0' : 'fas fa-file-csv text-emerald-500 text-base shrink-0';
    
    statusDiv.classList.remove('hidden');
    
    submitBtn.disabled = false;
    submitBtn.className = 'w-full py-3 bg-brand-teal hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-teal-500/10 hover:shadow-teal-500/20 active:scale-[0.97]';
}

export function clearSelectedAutomationFile() {
    selectedAutomationFile = null;
    const statusDiv = document.getElementById('automation-file-status');
    const submitBtn = document.getElementById('automation-submit-btn');
    const fileInput = document.getElementById('automation-file-input');
    
    if (fileInput) fileInput.value = '';
    if (statusDiv) statusDiv.classList.add('hidden');
    
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.className = 'w-full py-3 bg-slate-200 text-slate-400 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-not-allowed';
    }
}

export async function handleAutomationSubmit(e) {
    e.preventDefault();
    if (!selectedAutomationFile) return;
    
    const select = document.getElementById('automation-task-select');
    if (!select) return;
    const task = select.value;
    
    const submitBtn = document.getElementById('automation-submit-btn');
    const prevContent = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Processing Dataset...';
    
    if (state.isSimulated) {
        // Simulate processing
        setTimeout(() => {
            const results = getMockAutomationResults(task, selectedAutomationFile.name);
            renderAutomationResults(results);
            showToast("Demo Import processed successfully (Simulated mode)");
            submitBtn.disabled = false;
            submitBtn.innerHTML = prevContent;
            clearSelectedAutomationFile();
        }, 1500);
        return;
    }
    
    const formData = new FormData();
    formData.append('task', task);
    formData.append('file', selectedAutomationFile);
    
    try {
        const response = await authFetch(`${API_BASE}/automation/upload`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast(`Successfully processed ${data.success_count} entries. Failed: ${data.failed_count}.`);
            renderAutomationResults(data);
            clearSelectedAutomationFile();
        } else {
            showToast(data.detail || "Failed to process dataset. Please check format.", "error");
        }
    } catch (err) {
        console.error("Error running automation:", err);
        showToast("Network error. Failed to process automation upload.", "error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = prevContent;
    }
}

export function renderAutomationResults(data) {
    const subtitle = document.getElementById('automation-results-subtitle');
    const badges = document.getElementById('automation-badges-container');
    const badgeSuccess = document.getElementById('automation-badge-success');
    const badgeFailed = document.getElementById('automation-badge-failed');
    const emptyState = document.getElementById('automation-empty-state');
    const tableContainer = document.getElementById('automation-results-table-container');
    const tbody = document.getElementById('automation-results-tbody');
    const ocrContainer = document.getElementById('automation-ocr-container');
    const ocrPre = document.getElementById('automation-ocr-pre');
    
    if (!subtitle || !badges || !badgeSuccess || !badgeFailed || !emptyState || !tableContainer || !tbody) return;
    
    // Update headers and badges
    subtitle.textContent = `Results for upload: ${data.filename || 'unknown'}`;
    badgeSuccess.textContent = `${data.success_count} Success`;
    badgeFailed.textContent = `${data.failed_count} Failed`;
    
    badges.classList.remove('hidden');
    emptyState.classList.add('hidden');
    tableContainer.classList.remove('hidden');
    
    // Render rows
    let html = '';
    if (!data.results || data.results.length === 0) {
        html = `<tr><td colspan="5" class="py-4 text-center text-slate-400">No rows extracted or processed.</td></tr>`;
    } else {
        data.results.forEach(r => {
            const statusClass = r.status === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100';
            const statusText = r.status.toUpperCase();
            const detailText = r.status === 'success' ? (r.details || 'Success') : (r.error || 'Unknown error');
            
            html += `
                <tr class="hover:bg-slate-50/50 transition-colors">
                    <td class="py-3 px-4 font-semibold text-slate-500">Row ${r.row}</td>
                    <td class="py-3 px-4 font-bold text-slate-800">${r.identifier || '-'}</td>
                    <td class="py-3 px-4 text-slate-600">${r.name || '-'}</td>
                    <td class="py-3 px-4 text-center">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${statusClass}">
                            ${statusText}
                        </span>
                    </td>
                    <td class="py-3 px-4 ${r.status === 'success' ? 'text-slate-600' : 'text-rose-600 font-medium'}">${detailText}</td>
                </tr>
            `;
        });
    }
    tbody.innerHTML = html;
    
    // Handle OCR text display
    if (ocrContainer && ocrPre) {
        if (data.ocr_extracted_text) {
            ocrPre.textContent = data.ocr_extracted_text;
            ocrContainer.classList.remove('hidden');
        } else {
            ocrContainer.classList.add('hidden');
        }
    }
}

function getMockAutomationResults(task, filename) {
    const isImage = /\.(png|jpg|jpeg|bmp|tiff)$/i.test(filename);
    const ocrText = isImage ? `Raw OCR Extracted Text:\n--------------------\nEMPLOYEE_ID, FULL_NAME, EMAIL, IS_ACTIVE\nT8010, Ahmad Bin Kassim, ahmadk@school.edu.my, true\nT8002, Noraini Binti Abdullah, noraini@school.edu.my, true` : null;
    
    let results = [];
    if (task === 'teachers') {
        results = [
            { row: 2, identifier: "T8010", name: "Ahmad Bin Kassim", status: "success", action: "created", details: "Teacher created successfully" },
            { row: 3, identifier: "T8002", name: "Noraini Binti Abdullah", status: "success", action: "updated", details: "Teacher updated successfully" }
        ];
    } else if (task === 'classrooms') {
        results = [
            { row: 2, identifier: "3 Cempaka", name: "3 Cempaka", status: "success", action: "updated", details: "Classroom updated successfully" },
            { row: 3, identifier: "6 Lily", name: "6 Lily", status: "success", action: "created", details: "Classroom created successfully" }
        ];
    } else if (task === 'students') {
        results = [
            { row: 2, identifier: "S2001", name: "Muhammad Ali Bin Hassan", status: "success", action: "updated", details: "Student updated successfully" },
            { row: 3, identifier: "S2007", name: "Chong Wei Liang", status: "success", action: "created", details: "Student created successfully" }
        ];
    } else if (task === 'schedules') {
        results = [
            { row: 2, identifier: "Period 1 - 3 Cempaka", name: "MAT101 (Noraini Binti Abdullah)", status: "success", action: "created", details: "Schedule entry created successfully" },
            { row: 3, identifier: "Period 2 - 3 Cempaka", name: "SCI101 (Noraini Binti Abdullah)", status: "success", action: "updated", details: "Schedule entry updated successfully" }
        ];
    } else if (task === 'attendance') {
        results = [
            { row: 2, identifier: "S2001", name: "Muhammad Ali Bin Hassan", status: "success", action: "updated", details: "Attendance record updated as PRESENT" },
            { row: 3, identifier: "S2002", name: "Lim Wei Seng", status: "success", action: "created", details: "Attendance record created as ABSENT" }
        ];
    } else if (task === 'merit') {
        results = [
            { row: 2, identifier: "S2001", name: "Muhammad Ali Bin Hassan", status: "success", action: "points_awarded", details: "Points awarded (+10 pts) for 'Excellent Homework'" },
            { row: 3, identifier: "S2002", name: "Lim Wei Seng", status: "success", action: "points_reduced", details: "Points reduced (-5 pts) for 'Tardy'" }
        ];
    }
    
    return {
        task: task,
        filename: filename,
        success_count: results.length,
        failed_count: 0,
        results: results,
        ocr_extracted_text: ocrText
    };
}

// Bind to window for HTML events compatibility
window.onAutomationTaskChanged = onAutomationTaskChanged;
window.handleAutomationSubmit = handleAutomationSubmit;
window.clearSelectedAutomationFile = clearSelectedAutomationFile;
window.initAutomationView = initAutomationView;
