// EduPulse Ops — Schedules Module
// Manages timetable configuration, period definitions, scheduling wizard, and grid layout rendering

import { state, authFetch, API_BASE } from './api.js';
import { showToast, formatTime12h } from './ui.js';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

let timetablesCache = [];

export async function loadSchedulesViewData() {
    const gridBody = document.getElementById('timetable-grid-body');
    
    // Render immediately from cache if available to prevent UI lag
    if (state.classroomsList.length > 0 && state.activeTimetable) {
        populateScheduleTargetDropdown();
        await fetchAndRenderScheduleGrid();
    } else {
        if (gridBody) {
            gridBody.innerHTML = `
                <tr>
                    <td colspan="6" class="py-8 text-center text-slate-400">
                        <i class="fas fa-circle-notch fa-spin text-lg text-brand-teal mr-2"></i> Loading schedule dependencies...
                    </td>
                </tr>`;
        }
    }

    if (state.isSimulated) {
        populateScheduleTargetDropdown();
        await fetchAndRenderScheduleGrid();
        return;
    }

    try {
        // Load classrooms, teachers, students, subjects, timetables, and timeslots in background
        const [classesRes, teachersRes, studentsRes, subjectsRes, timetablesRes, slotsRes] = await Promise.allSettled([
            authFetch(`${API_BASE}/classes/?school_id=${state.currentSchoolId}`),
            authFetch(`${API_BASE}/teachers/?limit=500`),
            authFetch(`${API_BASE}/students/?skip=0&limit=500`),
            authFetch(`${API_BASE}/grading/subjects?limit=500`),
            authFetch(`${API_BASE}/schedules/timetables?school_id=${state.currentSchoolId}`),
            authFetch(`${API_BASE}/schedules/time-slots?school_id=${state.currentSchoolId}`)
        ]);

        if (classesRes.status === 'fulfilled' && classesRes.value.ok) {
            state.classroomsList = (await classesRes.value.json()).items || [];
        }
        if (teachersRes.status === 'fulfilled' && teachersRes.value.ok) {
            state.teachersList = (await teachersRes.value.json()).items || [];
        }
        if (studentsRes.status === 'fulfilled' && studentsRes.value.ok) {
            state.studentsList = (await studentsRes.value.json()).items || [];
        }
        if (subjectsRes.status === 'fulfilled' && subjectsRes.value.ok) {
            state.subjectsList = (await subjectsRes.value.json()).items || [];
        }
        if (slotsRes.status === 'fulfilled' && slotsRes.value.ok) {
            state.timeSlotsList = (await slotsRes.value.json()).items || [];
        }

        // Handle Timetable
        if (timetablesRes.status === 'fulfilled' && timetablesRes.value.ok) {
            const timetablesData = await timetablesRes.value.json();
            const timetables = timetablesData.items || [];
            state.activeTimetable = timetables.find(t => t.is_active) || timetables[0] || null;

            const badge = document.getElementById('active-timetable-badge');
            if (badge) {
                if (state.activeTimetable) {
                    badge.textContent = `Active Timetable: ${state.activeTimetable.name} (${state.activeTimetable.term})`;
                } else {
                    badge.innerHTML = `
                        <button onclick="createDefaultTimetable()" class="px-3 py-1 bg-brand-teal text-white rounded-lg text-xs font-semibold hover:bg-teal-700 transition-all cursor-pointer">
                            + Create Timetable
                        </button>
                    `;
                }
            }
        }

        populateScheduleTargetDropdown();
        await fetchAndRenderScheduleGrid();
        
        if (window.populateDefaultDropdowns) {
            window.populateDefaultDropdowns();
        }
    } catch (error) {
        console.error("Error loading schedule data:", error);
        if (!state.classroomsList.length) {
            showToast("Failed to load schedule data dependencies", "error");
        }
    }
}

export async function createDefaultTimetable() {
    try {
        const res = await authFetch(`${API_BASE}/schedules/timetables`, {
            method: 'POST',
            body: JSON.stringify({
                name: "Main School Term 1",
                school_id: state.currentSchoolId,
                term: "Term 1 2026"
            })
        });
        if (res.ok) {
            const timetable = await res.json();
            // Make it active
            await authFetch(`${API_BASE}/schedules/timetables/${timetable.id}`, {
                method: 'PUT',
                body: JSON.stringify({ is_active: true })
            });
            showToast("Default Timetable created successfully");
            loadSchedulesViewData();
        } else {
            showToast("Failed to create default timetable", "error");
        }
    } catch (err) {
        console.error(err);
        showToast("Network error. Failed to create timetable.", "error");
    }
}

export function populateScheduleTargetDropdown() {
    const viewTypeSelect = document.getElementById('schedule-view-type');
    const targetSelect = document.getElementById('schedule-target-select');
    const targetLabel = document.getElementById('schedule-target-label');
    if (!viewTypeSelect || !targetSelect) return;

    const viewType = viewTypeSelect.value;
    let optionsHtml = '';
    if (viewType === 'classroom') {
        targetLabel.textContent = "Select Classroom";
        state.classroomsList.forEach(c => {
            optionsHtml += `<option value="${c.id}">${c.name} (Grade ${c.grade_level})</option>`;
        });
    } else if (viewType === 'teacher') {
        targetLabel.textContent = "Select Teacher";
        state.teachersList.forEach(t => {
            optionsHtml += `<option value="${t.id}">${t.full_name} (${t.employee_id})</option>`;
        });
    } else if (viewType === 'student') {
        targetLabel.textContent = "Select Student";
        state.studentsList.forEach(s => {
            optionsHtml += `<option value="${s.id}">${s.full_name} (${s.student_id_number})</option>`;
        });
    }

    targetSelect.innerHTML = optionsHtml;
}

export async function fetchAndRenderScheduleGrid() {
    const gridBody = document.getElementById('timetable-grid-body');
    if (!gridBody) return;

    if (!state.activeTimetable) {
        gridBody.innerHTML = `
            <tr>
                <td colspan="6" class="py-12 text-center text-slate-400">
                    <i class="fas fa-calendar-xmark text-2xl text-slate-300 mb-2 block text-center"></i>
                    No active timetable found. Please create one first.
                </td>
            </tr>`;
        return;
    }

    const viewTypeSelect = document.getElementById('schedule-view-type');
    const targetSelect = document.getElementById('schedule-target-select');
    if (!viewTypeSelect || !targetSelect || !targetSelect.value) {
        gridBody.innerHTML = `
            <tr>
                <td colspan="6" class="py-12 text-center text-slate-400">
                    No targets available for selection.
                </td>
            </tr>`;
        return;
    }

    const viewType = viewTypeSelect.value;
    const targetId = parseInt(targetSelect.value);

    gridBody.innerHTML = `
        <tr>
            <td colspan="6" class="py-8 text-center text-slate-400">
                <i class="fas fa-circle-notch fa-spin text-lg text-brand-teal mr-2"></i> Fetching schedule entries...
            </td>
        </tr>`;

    try {
        let url = `${API_BASE}/schedules/timetables/${state.activeTimetable.id}/entries`;
        if (viewType === 'classroom') {
            url += `?class_id=${targetId}`;
        } else if (viewType === 'teacher') {
            url += `?teacher_id=${targetId}`;
        } else if (viewType === 'student') {
            url += `?student_id=${targetId}`;
        }

        const res = await authFetch(url);
        if (res.ok) {
            const data = await res.json();
            state.scheduleEntriesList = data.items || [];
            renderTimetableGrid();
        } else {
            showToast("Failed to fetch schedule entries", "error");
        }
    } catch (error) {
        console.error("Error fetching entries:", error);
        showToast("Network error. Failed to load schedule.", "error");
    }
}

export function renderTimetableGrid() {
    const gridBody = document.getElementById('timetable-grid-body');
    if (!gridBody) return;

    const viewTypeSelect = document.getElementById('schedule-view-type');
    if (!viewTypeSelect) return;
    const viewType = viewTypeSelect.value;

    // Group time slots by period number to make rows
    const uniquePeriods = [];
    const periodMap = {}; 
    state.timeSlotsList.forEach(slot => {
        if (!periodMap[slot.period_number]) {
            periodMap[slot.period_number] = {
                start_time: slot.start_time,
                end_time: slot.end_time
            };
            uniquePeriods.push(slot.period_number);
        }
    });
    uniquePeriods.sort((a, b) => a - b);

    if (uniquePeriods.length === 0) {
        gridBody.innerHTML = `
            <tr>
                <td colspan="6" class="py-12 text-center text-slate-400">
                    No time slots configured for the school.
                </td>
            </tr>`;
        return;
    }

    let html = '';

    uniquePeriods.forEach(pNum => {
        const pTime = periodMap[pNum];
        html += `<tr>`;
        html += `
            <td class="py-3 px-2 border border-slate-150 text-left font-medium text-slate-800 bg-slate-50/20 text-xs shrink-0">
                <div class="font-bold text-slate-900">Period ${pNum}</div>
                <div class="text-[10px] text-slate-400 font-medium mt-0.5">${formatTime12h(pTime.start_time)} - ${formatTime12h(pTime.end_time)}</div>
            </td>
        `;

        for (let day = 0; day < 5; day++) {
            const slot = state.timeSlotsList.find(s => s.period_number === pNum && s.day_of_week === day);
            if (!slot) {
                html += `<td class="p-1 border border-slate-150 bg-slate-50/10"></td>`;
                continue;
            }

            const entry = state.scheduleEntriesList.find(e => e.time_slot_id === slot.id);

            html += `<td class="p-1.5 border border-slate-150 h-full align-top">`;

            if (entry) {
                const subject = state.subjectsList.find(s => s.id === entry.subject_id);
                const subjectName = subject ? subject.name : 'Unknown Subject';

                let subText = '';
                if (viewType === 'classroom' || viewType === 'student') {
                    const teacher = state.teachersList.find(t => t.id === entry.teacher_id);
                    subText = teacher ? teacher.full_name : 'No Teacher';
                } else if (viewType === 'teacher') {
                    const classroom = state.classroomsList.find(c => c.id === entry.class_id);
                    subText = classroom ? classroom.name : 'No Class';
                }

                html += `
                    <div class="relative bg-brand-accent border border-brand-teal/20 rounded-xl p-2.5 h-full min-h-[72px] hover:border-brand-teal hover:shadow-sm hover:bg-brand-accent/70 transition-all duration-150 group cursor-pointer" 
                         onclick="openScheduleModal(${day}, ${pNum}, ${slot.id}, ${entry.id})">
                        <div class="font-bold text-slate-900 text-xs truncate" title="${subjectName}">${subjectName}</div>
                        <div class="text-[10px] text-slate-500 truncate mt-0.5" title="${subText}">${subText}</div>
                        <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-brand-teal text-[10px]">
                            <i class="fas fa-pen text-[9px]"></i>
                        </div>
                    </div>
                `;
            } else {
                if (viewType === 'student') {
                    html += `
                        <div class="bg-slate-50/50 rounded-xl p-2.5 h-full min-h-[72px] border border-dashed border-slate-200/50 text-slate-400 flex items-center justify-center text-[10px] select-none">
                            Free Period
                        </div>
                    `;
                } else {
                    html += `
                        <div class="bg-slate-50/20 rounded-xl p-2.5 h-full min-h-[72px] border border-dashed border-slate-200 hover:bg-slate-100/50 hover:border-brand-teal/30 hover:border-solid transition-all duration-150 flex items-center justify-center text-slate-300 hover:text-brand-teal cursor-pointer group" 
                             onclick="openScheduleModal(${day}, ${pNum}, ${slot.id}, null)">
                            <span class="text-xs group-hover:scale-115 transition-transform font-medium"><i class="fas fa-plus"></i></span>
                        </div>
                    `;
                }
            }

            html += `</td>`;
        }

        html += `</tr>`;
    });

    gridBody.innerHTML = html;
}

export function openScheduleModal(day, period, timeSlotId, entryId = null) {
    const modal = document.getElementById('edit-modal');
    const content = document.getElementById('edit-modal-content');
    if (!modal || !content) return;

    const viewTypeSelect = document.getElementById('schedule-view-type');
    const targetSelect = document.getElementById('schedule-target-select');
    if (!viewTypeSelect || !targetSelect) return;

    const viewType = viewTypeSelect.value;
    const targetId = parseInt(targetSelect.value);

    const dayName = DAY_NAMES[day + 1] || 'Today'; 
    const slot = state.timeSlotsList.find(s => s.id === timeSlotId);
    const timeRange = slot ? `${formatTime12h(slot.start_time)} - ${formatTime12h(slot.end_time)}` : '';

    let entry = null;
    if (entryId) {
        entry = state.scheduleEntriesList.find(e => e.id === entryId);
    }

    let subjectOptions = '<option value="">Select subject...</option>';
    state.subjectsList.forEach(s => {
        const selected = (entry && s.id === entry.subject_id) ? 'selected' : '';
        subjectOptions += `<option value="${s.id}" ${selected}>${s.name} (${s.code})</option>`;
    });

    let teacherOptions = '<option value="">Select teacher...</option>';
    state.teachersList.forEach(t => {
        const selected = (entry && t.id === entry.teacher_id) ? 'selected' : '';
        teacherOptions += `<option value="${t.id}" ${selected}>${t.full_name} (${t.employee_id})</option>`;
    });

    let classOptions = '<option value="">Select classroom...</option>';
    state.classroomsList.forEach(c => {
        const selected = (entry && c.id === entry.class_id) ? 'selected' : '';
        classOptions += `<option value="${c.id}" ${selected}>${c.name}</option>`;
    });

    let title = entry 
        ? `<i class="fas fa-edit text-brand-teal"></i> Edit Schedule Entry`
        : `<i class="fas fa-calendar-plus text-brand-teal"></i> Add Schedule Entry`;

    let contextHtml = '';
    if (viewType === 'classroom') {
        const cls = state.classroomsList.find(c => c.id === targetId);
        contextHtml = `
            <div class="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 border border-slate-100 flex flex-col gap-1">
                <div><strong>Classroom:</strong> ${cls ? cls.name : 'Unknown'}</div>
                <div><strong>Time Slot:</strong> ${dayName}, Period ${period} (${timeRange})</div>
            </div>
        `;
    } else if (viewType === 'teacher') {
        const teacher = state.teachersList.find(t => t.id === targetId);
        contextHtml = `
            <div class="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 border border-slate-100 flex flex-col gap-1">
                <div><strong>Teacher:</strong> ${teacher ? teacher.full_name : 'Unknown'}</div>
                <div><strong>Time Slot:</strong> ${dayName}, Period ${period} (${timeRange})</div>
            </div>
        `;
    }

    let modalHtml = `
        <div class="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
                ${title}
            </h3>
            <button onclick="closeEditModal()" class="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
                <i class="fas fa-xmark text-lg"></i>
            </button>
        </div>
        
        <form id="schedule-entry-form" class="p-6 space-y-4" onsubmit="submitScheduleEntryForm(event, ${timeSlotId}, ${entryId})">
            ${contextHtml}
            
            ${viewType === 'teacher' ? `
                <div>
                    <label for="modal-entry-class" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Classroom</label>
                    <select id="modal-entry-class" required
                        class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 outline-none transition-all">
                        ${classOptions}
                    </select>
                </div>
            ` : ''}

            <div>
                <label for="modal-entry-subject" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Subject</label>
                <select id="modal-entry-subject" required
                    class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 outline-none transition-all">
                    ${subjectOptions}
                </select>
            </div>

            ${viewType === 'classroom' ? `
                <div>
                    <label for="modal-entry-teacher" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Teacher</label>
                    <select id="modal-entry-teacher" required
                        class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 outline-none transition-all">
                        ${teacherOptions}
                    </select>
                </div>
            ` : ''}

            <div class="flex items-center gap-3 pt-4 border-t border-slate-100">
                <button type="submit" id="schedule-entry-submit-btn"
                    class="flex-1 py-2.5 px-4 bg-brand-teal hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-md transition-all cursor-pointer">
                    ${entry ? 'Save Changes' : 'Add Entry'}
                </button>
                
                ${entry ? `
                    <button type="button" onclick="deleteScheduleEntryConfirm(${entry.id})"
                        class="py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-semibold border border-rose-100 transition-all cursor-pointer">
                        <i class="fas fa-trash-can mr-1"></i> Delete
                    </button>
                ` : ''}
                
                <button type="button" onclick="closeEditModal()"
                    class="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition-all cursor-pointer">
                    Cancel
                </button>
            </div>
        </form>
    `;

    content.innerHTML = modalHtml;
    modal.classList.remove('hidden');
    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    }, 50);
}

export async function submitScheduleEntryForm(event, timeSlotId, entryId) {
    event.preventDefault();
    const submitBtn = document.getElementById('schedule-entry-submit-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Saving...';
    }

    const viewTypeSelect = document.getElementById('schedule-view-type');
    const targetSelect = document.getElementById('schedule-target-select');
    if (!viewTypeSelect || !targetSelect) return;

    const viewType = viewTypeSelect.value;
    const targetId = parseInt(targetSelect.value);

    const subjectId = parseInt(document.getElementById('modal-entry-subject').value);

    let teacherId = null;
    let classId = null;

    if (viewType === 'classroom') {
        classId = targetId;
        teacherId = parseInt(document.getElementById('modal-entry-teacher').value);
    } else if (viewType === 'teacher') {
        teacherId = targetId;
        classId = parseInt(document.getElementById('modal-entry-class').value);
    }

    try {
        let response;
        if (entryId) {
            const payload = {
                subject_id: subjectId,
                teacher_id: teacherId
            };
            response = await authFetch(`${API_BASE}/schedules/entries/${entryId}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
        } else {
            const payload = {
                timetable_id: state.activeTimetable.id,
                class_id: classId,
                subject_id: subjectId,
                teacher_id: teacherId,
                time_slot_id: timeSlotId
            };
            response = await authFetch(`${API_BASE}/schedules/timetables/${state.activeTimetable.id}/entries`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        }

        if (response.ok) {
            showToast(entryId ? "Schedule entry updated successfully" : "Schedule entry added successfully");
            closeEditModal();
            await fetchAndRenderScheduleGrid();
        } else {
            const err = await response.json();
            showToast(err.detail || "Conflict or validation error occurred", "error");
        }
    } catch (error) {
        console.error("Error saving schedule entry:", error);
        showToast("Network error. Failed to save schedule entry.", "error");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
        }
    }
}

export async function deleteScheduleEntryConfirm(entryId) {
    if (!confirm("Are you sure you want to delete this schedule entry?")) return;

    try {
        const response = await authFetch(`${API_BASE}/schedules/entries/${entryId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast("Schedule entry deleted successfully");
            closeEditModal();
            await fetchAndRenderScheduleGrid();
        } else {
            const err = await response.json();
            showToast(err.detail || "Failed to delete schedule entry", "error");
        }
    } catch (error) {
        console.error("Error deleting schedule entry:", error);
        showToast("Network error. Failed to delete schedule entry.", "error");
    }
}

export function openTimeSlotsModal() {
    const modal = document.getElementById('edit-modal');
    const content = document.getElementById('edit-modal-content');
    if (!modal || !content) return;

    // Group time slots by period number to find unique periods and their times
    const uniquePeriods = [];
    const periodMap = {}; 
    state.timeSlotsList.forEach(slot => {
        if (!periodMap[slot.period_number]) {
            periodMap[slot.period_number] = {
                start_time: slot.start_time,
                end_time: slot.end_time
            };
            uniquePeriods.push(slot.period_number);
        }
    });
    uniquePeriods.sort((a, b) => a - b);

    let slotsHtml = '';
    uniquePeriods.forEach(pNum => {
        const pTime = periodMap[pNum];
        slotsHtml += `
            <div class="flex items-center justify-between gap-4 py-3 px-1 border-b border-slate-100 last:border-b-0" data-period="${pNum}">
                <span class="font-bold text-slate-800 text-sm">Period ${pNum}</span>
                <div class="flex items-center gap-2">
                    <input type="text" id="slot-start-${pNum}" value="${pTime.start_time}" placeholder="08:00" required 
                        class="w-20 px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-teal text-center font-medium text-slate-800 bg-slate-50 focus:bg-white transition-all">
                    <span class="text-slate-400 text-xs">to</span>
                    <input type="text" id="slot-end-${pNum}" value="${pTime.end_time}" placeholder="08:45" required 
                        class="w-20 px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-teal text-center font-medium text-slate-800 bg-slate-50 focus:bg-white transition-all">
                </div>
            </div>
        `;
    });

    let modalHtml = `
        <div class="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
                <i class="fas fa-clock text-brand-teal"></i> Configure School Periods
            </h3>
            <button onclick="closeEditModal()" class="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
                <i class="fas fa-xmark text-lg"></i>
            </button>
        </div>
        
        <form id="timeslots-config-form" class="p-6 space-y-4" onsubmit="submitTimeSlotsConfig(event)">
            <div class="text-xs text-slate-500 mb-2 leading-relaxed">
                Set the daily start and end times for each period. Saving will apply these times across all school days (Monday to Friday). Use HH:MM format.
            </div>
            
            <!-- Period Count Adjustment -->
            <div class="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4">
                <label for="modal-period-count" class="text-xs font-bold text-slate-700 uppercase tracking-wider">Number of Periods</label>
                <div class="flex items-center gap-2">
                    <button type="button" onclick="adjustModalPeriodCount(-1)" class="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-all font-bold text-slate-600 flex items-center justify-center cursor-pointer shadow-sm">-</button>
                    <input type="number" id="modal-period-count" value="${uniquePeriods.length}" min="1" max="15" readonly 
                        class="w-12 text-center font-bold text-sm bg-transparent border-0 focus:outline-none focus:ring-0">
                    <button type="button" onclick="adjustModalPeriodCount(1)" class="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-all font-bold text-slate-600 flex items-center justify-center cursor-pointer shadow-sm">+</button>
                </div>
            </div>

            <div id="modal-periods-list-container" class="max-h-[220px] overflow-y-auto pr-1">
                ${slotsHtml}
            </div>
            
            <div class="flex items-center gap-3 pt-4 border-t border-slate-100">
                <button type="submit" id="timeslots-config-submit-btn"
                    class="flex-1 py-2.5 px-4 bg-brand-teal hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-md transition-all cursor-pointer">
                    Save Configuration
                </button>
                <button type="button" onclick="closeEditModal()"
                    class="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition-all cursor-pointer">
                    Cancel
                </button>
            </div>
        </form>
    `;

    content.innerHTML = modalHtml;
    modal.classList.remove('hidden');
    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    }, 50);
}

export function adjustModalPeriodCount(change) {
    const input = document.getElementById('modal-period-count');
    const container = document.getElementById('modal-periods-list-container');
    if (!input || !container) return;

    let count = parseInt(input.value) + change;
    if (count < 1) count = 1;
    if (count > 15) count = 15;
    input.value = count;

    const currentTimes = {};
    const oldRows = container.querySelectorAll('[data-period]');
    oldRows.forEach(row => {
        const pNum = row.getAttribute('data-period');
        const startInput = document.getElementById(`slot-start-${pNum}`);
        const endInput = document.getElementById(`slot-end-${pNum}`);
        if (startInput && endInput) {
            currentTimes[pNum] = {
                start_time: startInput.value,
                end_time: endInput.value
            };
        }
    });

    let slotsHtml = '';
    for (let pNum = 1; pNum <= count; pNum++) {
        let start = '';
        let end = '';
        if (currentTimes[pNum]) {
            start = currentTimes[pNum].start_time;
            end = currentTimes[pNum].end_time;
        } else {
            const prev = currentTimes[pNum - 1] || (pNum > 1 ? { start_time: '12:30', end_time: '13:10' } : { start_time: '07:30', end_time: '08:10' });
            const [h, m] = prev.end_time.split(':').map(Number);
            const prevEndMinutes = h * 60 + m;
            const newStartMinutes = prevEndMinutes + 10;
            const newEndMinutes = newStartMinutes + 40;

            const startH = Math.floor(newStartMinutes / 60) % 24;
            const startM = newStartMinutes % 60;
            const endH = Math.floor(newEndMinutes / 60) % 24;
            const endM = newEndMinutes % 60;

            start = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
            end = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
        }

        slotsHtml += `
            <div class="flex items-center justify-between gap-4 py-3 px-1 border-b border-slate-100 last:border-b-0" data-period="${pNum}">
                <span class="font-bold text-slate-800 text-sm">Period ${pNum}</span>
                <div class="flex items-center gap-2">
                    <input type="text" id="slot-start-${pNum}" value="${start}" placeholder="08:00" required 
                        class="w-20 px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-teal text-center font-medium text-slate-800 bg-slate-50 focus:bg-white transition-all">
                    <span class="text-slate-400 text-xs">to</span>
                    <input type="text" id="slot-end-${pNum}" value="${end}" placeholder="08:45" required 
                        class="w-20 px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-teal text-center font-medium text-slate-800 bg-slate-50 focus:bg-white transition-all">
                </div>
            </div>
        `;
    }
    container.innerHTML = slotsHtml;
}

export async function submitTimeSlotsConfig(event) {
    event.preventDefault();
    const submitBtn = document.getElementById('timeslots-config-submit-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Saving...';
    }

    const newCount = parseInt(document.getElementById('modal-period-count').value);

    const oldPeriods = [];
    state.timeSlotsList.forEach(slot => {
        if (!oldPeriods.includes(slot.period_number)) {
            oldPeriods.push(slot.period_number);
        }
    });
    const oldCount = oldPeriods.length;

    const updatePromises = [];
    
    const periodTimes = {};
    for (let pNum = 1; pNum <= newCount; pNum++) {
        const startVal = document.getElementById(`slot-start-${pNum}`).value.trim();
        const endVal = document.getElementById(`slot-end-${pNum}`).value.trim();
        periodTimes[pNum] = { start_time: startVal, end_time: endVal };
    }

    state.timeSlotsList.forEach(slot => {
        if (slot.period_number <= newCount) {
            const newTime = periodTimes[slot.period_number];
            if (newTime && (slot.start_time !== newTime.start_time || slot.end_time !== newTime.end_time)) {
                const payload = {
                    start_time: newTime.start_time,
                    end_time: newTime.end_time,
                    day_of_week: slot.day_of_week,
                    period_number: slot.period_number
                };
                const promise = authFetch(`${API_BASE}/schedules/time-slots/${slot.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
                updatePromises.push(promise);
            }
        }
    });

    if (newCount > oldCount) {
        for (let pNum = oldCount + 1; pNum <= newCount; pNum++) {
            const newTime = periodTimes[pNum];
            for (let day = 0; day < 5; day++) {
                const payload = {
                    day_of_week: day,
                    period_number: pNum,
                    start_time: newTime.start_time,
                    end_time: newTime.end_time,
                    school_id: state.currentSchoolId
                };
                const promise = authFetch(`${API_BASE}/schedules/time-slots`, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                updatePromises.push(promise);
            }
        }
    }

    if (newCount < oldCount) {
        state.timeSlotsList.forEach(slot => {
            if (slot.period_number > newCount) {
                const promise = authFetch(`${API_BASE}/schedules/time-slots/${slot.id}`, {
                    method: 'DELETE'
                });
                updatePromises.push(promise);
            }
        });
    }

    if (updatePromises.length === 0) {
        showToast("No changes detected.");
        closeEditModal();
        return;
    }

    try {
        const results = await Promise.allSettled(updatePromises);
        const failed = results.filter(r => r.status === 'rejected' || !r.value.ok);

        if (failed.length === 0) {
            showToast("School periods updated successfully");
            closeEditModal();
            await loadSchedulesViewData(); 
        } else {
            console.error("Some updates failed:", failed);
            let errMsg = "Failed to update some periods. Check time format (HH:MM).";
            for (let i = 0; i < failed.length; i++) {
                const f = failed[i];
                if (f.status === 'fulfilled' && f.value.status === 409) {
                    const errData = await f.value.json();
                    errMsg = errData.detail || errMsg;
                    break;
                }
            }
            showToast(errMsg, "error");
            await loadSchedulesViewData(); 
        }
    } catch (error) {
        console.error("Error updating time slots:", error);
        showToast("Network error. Failed to save periods.", "error");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
        }
    }
}

export async function openTimetablesModal() {
    const modal = document.getElementById('edit-modal');
    const content = document.getElementById('edit-modal-content');
    if (!modal || !content) return;

    // Show loading state first
    content.innerHTML = `
        <div class="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
                <i class="fas fa-list text-brand-teal"></i> Manage Timetables
            </h3>
            <button onclick="closeEditModal()" class="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
                <i class="fas fa-xmark text-lg"></i>
            </button>
        </div>
        <div class="p-12 text-center text-slate-500">
            <i class="fas fa-circle-notch fa-spin text-2xl text-brand-teal mb-2"></i>
            <div class="text-xs">Loading timetables...</div>
        </div>
    `;
    modal.classList.remove('hidden');
    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    }, 50);

    try {
        const res = await authFetch(`${API_BASE}/schedules/timetables?school_id=${state.currentSchoolId}`);
        if (!res.ok) throw new Error("Failed to fetch timetables");
        const data = await res.json();
        const timetables = data.items || [];
        renderTimetablesModalContent(timetables);
    } catch (error) {
        console.error("Error fetching timetables:", error);
        showToast("Failed to load timetables.", "error");
        closeEditModal();
    }
}

export function renderTimetablesModalContent(timetables) {
    timetablesCache = timetables;
    window.timetablesCache = timetables;
    const content = document.getElementById('edit-modal-content');
    if (!content) return;

    let rowsHtml = '';
    if (timetables.length === 0) {
        rowsHtml = `
            <div class="text-center py-8 text-slate-400 text-xs">
                No timetables found. Click below to create one.
            </div>
        `;
    } else {
        timetables.forEach(t => {
            const statusBadge = t.is_active 
                ? `<span class="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full border border-emerald-100 flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Active</span>`
                : `<span class="px-2.5 py-1 bg-slate-50 text-slate-500 text-[10px] font-bold rounded-full border border-slate-100">Inactive</span>`;

            const actionButton = t.is_active
                ? `<span class="text-slate-400 text-xs font-semibold px-2">Active</span>`
                : `<button onclick="activateTimetable(${t.id})" class="px-2.5 py-1 bg-brand-teal/10 hover:bg-brand-teal/20 text-brand-teal rounded-lg text-xs font-semibold transition-all cursor-pointer">Activate</button>`;

            rowsHtml += `
                <div class="flex items-center justify-between gap-4 py-4 border-b border-slate-100 last:border-b-0">
                    <div class="flex-1 min-w-0">
                        <div class="font-bold text-slate-800 text-sm truncate">${t.name}</div>
                        <div class="text-xs text-slate-500 mt-0.5">${t.term}</div>
                    </div>
                    <div class="flex items-center gap-3 shrink-0">
                        ${statusBadge}
                        ${actionButton}
                        <button onclick="showEditTimetableForm(${t.id})" class="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 transition-all flex items-center justify-center cursor-pointer border border-slate-200/50" title="Edit">
                            <i class="fas fa-pencil text-xs"></i>
                        </button>
                        <button onclick="deleteTimetableConfirm(${t.id})" class="w-8 h-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-all flex items-center justify-center cursor-pointer border border-rose-100/50" title="Delete">
                            <i class="fas fa-trash text-xs"></i>
                        </button>
                    </div>
                </div>
            `;
        });
    }

    content.innerHTML = `
        <div class="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
                <i class="fas fa-list text-brand-teal"></i> Manage Timetables
            </h3>
            <button onclick="closeEditModal()" class="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
                <i class="fas fa-xmark text-lg"></i>
            </button>
        </div>
        
        <div class="p-6 space-y-4">
            <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Timetables List</span>
                <button onclick="showCreateTimetableForm()" class="px-3 py-1.5 bg-brand-teal hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer flex items-center gap-1">
                    <i class="fas fa-plus"></i> Create Timetable
                </button>
            </div>
            
            <div class="max-h-[300px] overflow-y-auto pr-1">
                ${rowsHtml}
            </div>
            
            <div class="flex items-center justify-end pt-4 border-t border-slate-100">
                <button type="button" onclick="closeEditModal()"
                    class="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition-all cursor-pointer">
                    Close
                </button>
            </div>
        </div>
    `;
}

export function showCreateTimetableForm() {
    const content = document.getElementById('edit-modal-content');
    if (!content) return;

    content.innerHTML = `
        <div class="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
                <i class="fas fa-plus text-brand-teal"></i> Create Timetable
            </h3>
            <button onclick="openTimetablesModal()" class="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer" title="Back">
                <i class="fas fa-arrow-left text-lg"></i>
            </button>
        </div>
        
        <form id="timetable-create-form" class="p-6 space-y-4" onsubmit="saveNewTimetable(event)">
            <div>
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Timetable Name</label>
                <input type="text" id="new-timetable-name" placeholder="e.g. Main School Term 2" required 
                    class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal transition-all">
            </div>
            <div>
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Academic Term / Year</label>
                <input type="text" id="new-timetable-term" placeholder="e.g. Term 2 2026" required 
                    class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal transition-all">
            </div>
            
            <div class="flex items-center gap-3 pt-4 border-t border-slate-100">
                <button type="submit" id="timetable-create-btn"
                    class="flex-1 py-2.5 px-4 bg-brand-teal hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-md transition-all cursor-pointer">
                    Create & Activate
                </button>
                <button type="button" onclick="openTimetablesModal()"
                    class="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition-all cursor-pointer">
                    Cancel
                </button>
            </div>
        </form>
    `;
}

export function showEditTimetableForm(timetableId) {
    const t = timetablesCache.find(x => x.id === timetableId);
    if (!t) return;
    const content = document.getElementById('edit-modal-content');
    if (!content) return;

    content.innerHTML = `
        <div class="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
                <i class="fas fa-pencil text-brand-teal"></i> Edit Timetable
            </h3>
            <button onclick="openTimetablesModal()" class="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer" title="Back">
                <i class="fas fa-arrow-left text-lg"></i>
            </button>
        </div>
        
        <form id="timetable-edit-form" class="p-6 space-y-4" onsubmit="saveTimetableEdit(event, ${t.id})">
            <div>
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Timetable Name</label>
                <input type="text" id="edit-timetable-name" value="${t.name.replace(/"/g, '&quot;')}" required 
                    class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal transition-all">
            </div>
            <div>
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Academic Term / Year</label>
                <input type="text" id="edit-timetable-term" value="${t.term.replace(/"/g, '&quot;')}" required 
                    class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal transition-all">
            </div>
            
            <div class="flex items-center gap-3 pt-4 border-t border-slate-100">
                <button type="submit" id="timetable-edit-btn"
                    class="flex-1 py-2.5 px-4 bg-brand-teal hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-md transition-all cursor-pointer">
                    Save Changes
                </button>
                <button type="button" onclick="openTimetablesModal()"
                    class="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition-all cursor-pointer">
                    Cancel
                </button>
            </div>
        </form>
    `;
}

export async function saveNewTimetable(event) {
    event.preventDefault();
    const submitBtn = document.getElementById('timetable-create-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Creating...';
    }

    const nameVal = document.getElementById('new-timetable-name').value.trim();
    const termVal = document.getElementById('new-timetable-term').value.trim();

    try {
        const res = await authFetch(`${API_BASE}/schedules/timetables`, {
            method: 'POST',
            body: JSON.stringify({
                name: nameVal,
                school_id: state.currentSchoolId,
                term: termVal
            })
        });

        if (res.ok) {
            const timetable = await res.json();
            // Automatically activate it
            await authFetch(`${API_BASE}/schedules/timetables/${timetable.id}`, {
                method: 'PUT',
                body: JSON.stringify({ is_active: true })
            });

            showToast(`Timetable "${nameVal}" created and activated successfully!`);
            await loadSchedulesViewData();
            openTimetablesModal();
        } else {
            showToast("Failed to create timetable", "error");
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Create & Activate';
            }
        }
    } catch (error) {
        console.error("Error creating timetable:", error);
        showToast("Network error. Failed to create timetable.", "error");
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create & Activate';
        }
    }
}

export async function saveTimetableEdit(event, timetableId) {
    event.preventDefault();
    const submitBtn = document.getElementById('timetable-edit-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Saving...';
    }

    const nameVal = document.getElementById('edit-timetable-name').value.trim();
    const termVal = document.getElementById('edit-timetable-term').value.trim();

    try {
        const res = await authFetch(`${API_BASE}/schedules/timetables/${timetableId}`, {
            method: 'PUT',
            body: JSON.stringify({
                name: nameVal,
                term: termVal
            })
        });

        if (res.ok) {
            showToast("Timetable updated successfully!");
            await loadSchedulesViewData();
            openTimetablesModal();
        } else {
            showToast("Failed to update timetable", "error");
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Save Changes';
            }
        }
    } catch (error) {
        console.error("Error updating timetable:", error);
        showToast("Network error. Failed to update timetable.", "error");
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Save Changes';
        }
    }
}

export async function activateTimetable(timetableId) {
    try {
        const res = await authFetch(`${API_BASE}/schedules/timetables/${timetableId}`, {
            method: 'PUT',
            body: JSON.stringify({ is_active: true })
        });

        if (res.ok) {
            showToast("Timetable activated successfully!");
            await loadSchedulesViewData();
            openTimetablesModal();
        } else {
            showToast("Failed to activate timetable", "error");
        }
    } catch (error) {
        console.error("Error activating timetable:", error);
        showToast("Network error. Failed to activate timetable.", "error");
    }
}

export function deleteTimetableConfirm(timetableId) {
    const t = timetablesCache.find(x => x.id === timetableId);
    if (!t) return;
    const content = document.getElementById('edit-modal-content');
    if (!content) return;

    content.innerHTML = `
        <div class="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 class="text-lg font-bold text-rose-600 flex items-center gap-2">
                <i class="fas fa-triangle-exclamation text-rose-500"></i> Delete Timetable?
            </h3>
            <button onclick="openTimetablesModal()" class="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer" title="Back">
                <i class="fas fa-arrow-left text-lg"></i>
            </button>
        </div>
        
        <div class="p-6 space-y-4">
            <div class="bg-rose-50 border border-rose-100 rounded-xl p-4 text-xs text-rose-700 leading-relaxed">
                <i class="fas fa-circle-exclamation mr-1 text-sm align-middle"></i>
                <strong>WARNING:</strong> Deleting the timetable <strong>"${t.name.replace(/"/g, '&quot;')}"</strong> will permanently delete all weekly scheduled entries (lessons, teachers, classes) allocated under this timetable. This action <strong>cannot</strong> be undone.
            </div>
            <p class="text-slate-600 text-xs">Are you sure you want to proceed with deleting this timetable?</p>
            
            <div class="flex items-center gap-3 pt-4 border-t border-slate-100">
                <button onclick="executeDeleteTimetable(${t.id})" id="timetable-delete-confirm-btn"
                    class="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-md transition-all cursor-pointer">
                    Yes, Delete Permanently
                </button>
                <button type="button" onclick="openTimetablesModal()"
                    class="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition-all cursor-pointer">
                    Cancel
                </button>
            </div>
        </div>
    `;
}

export async function executeDeleteTimetable(timetableId) {
    const btn = document.getElementById('timetable-delete-confirm-btn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Deleting...';
    }

    try {
        const res = await authFetch(`${API_BASE}/schedules/timetables/${timetableId}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            showToast("Timetable deleted successfully!");
            await loadSchedulesViewData();
            openTimetablesModal();
        } else {
            showToast("Failed to delete timetable", "error");
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Yes, Delete Permanently';
            }
        }
    } catch (error) {
        console.error("Error deleting timetable:", error);
        showToast("Network error. Failed to delete timetable.", "error");
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Yes, Delete Permanently';
        }
    }
}

export function initSchedules() {
    const viewTypeSelect = document.getElementById('schedule-view-type');
    const targetSelect = document.getElementById('schedule-target-select');

    if (viewTypeSelect && targetSelect) {
        viewTypeSelect.addEventListener('change', () => {
            populateScheduleTargetDropdown();
            fetchAndRenderScheduleGrid();
        });

        targetSelect.addEventListener('change', () => {
            fetchAndRenderScheduleGrid();
        });
    }
}

// Bind to window for HTML events compatibility
window.createDefaultTimetable = createDefaultTimetable;
window.openScheduleModal = openScheduleModal;
window.submitScheduleEntryForm = submitScheduleEntryForm;
window.deleteScheduleEntryConfirm = deleteScheduleEntryConfirm;
window.openTimeSlotsModal = openTimeSlotsModal;
window.adjustModalPeriodCount = adjustModalPeriodCount;
window.submitTimeSlotsConfig = submitTimeSlotsConfig;
window.openTimetablesModal = openTimetablesModal;
window.showCreateTimetableForm = showCreateTimetableForm;
window.showEditTimetableForm = showEditTimetableForm;
window.saveNewTimetable = saveNewTimetable;
window.saveTimetableEdit = saveTimetableEdit;
window.activateTimetable = activateTimetable;
window.deleteTimetableConfirm = deleteTimetableConfirm;
window.executeDeleteTimetable = executeDeleteTimetable;
window.initSchedules = initSchedules;
window.loadSchedulesViewData = loadSchedulesViewData;
