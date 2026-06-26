// EduPulse Ops — Attendance Module
// Handles daily roll calls, period-based presence checks, roster updates, and statistics

import { state, authFetch, API_BASE, mockAttendanceSessions, mockStudents, mockClassrooms } from './api.js';
import { showToast } from './ui.js';

export function initAttendance() {
    const btnDaily = document.getElementById('btn-attendance-mode-daily');
    const btnPeriod = document.getElementById('btn-attendance-mode-period');
    const classSelect = document.getElementById('attendance-class-select');
    const dateInput = document.getElementById('attendance-date-select');
    const periodSelect = document.getElementById('attendance-period-select');
    const periodContainer = document.getElementById('attendance-period-container');
    const btnLoadRoster = document.getElementById('btn-load-roster');
    const btnMarkAllPresent = document.getElementById('btn-mark-all-present');
    const btnSaveAttendance = document.getElementById('btn-save-attendance');
    const btnSaveAttendanceMobile = document.getElementById('btn-save-attendance-mobile');

    const rosterCard = document.getElementById('attendance-roster-card');
    const emptyState = document.getElementById('attendance-empty-state');
    const mobileSaveBar = document.getElementById('attendance-mobile-save-bar');

    function hideRoster() {
        if (rosterCard) rosterCard.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
        if (mobileSaveBar) mobileSaveBar.classList.add('hidden');
    }

    if (btnDaily && btnPeriod) {
        btnDaily.addEventListener('click', () => {
            state.attendanceMode = 'daily';
            btnDaily.classList.add('bg-white', 'text-slate-800', 'shadow-sm');
            btnDaily.classList.remove('text-slate-500', 'hover:text-slate-800');
            btnPeriod.classList.remove('bg-white', 'text-slate-800', 'shadow-sm');
            btnPeriod.classList.add('text-slate-500', 'hover:text-slate-800');
            
            if (periodContainer) periodContainer.classList.add('hidden');
            hideRoster();
        });

        btnPeriod.addEventListener('click', () => {
            state.attendanceMode = 'period';
            btnPeriod.classList.add('bg-white', 'text-slate-800', 'shadow-sm');
            btnPeriod.classList.remove('text-slate-500', 'hover:text-slate-800');
            btnDaily.classList.remove('bg-white', 'text-slate-800', 'shadow-sm');
            btnDaily.classList.add('text-slate-500', 'hover:text-slate-800');
            
            if (periodContainer) periodContainer.classList.remove('hidden');
            hideRoster();
            loadAttendancePeriods();
        });
    }

    if (classSelect) {
        classSelect.addEventListener('change', () => {
            hideRoster();
            if (state.attendanceMode === 'period') {
                loadAttendancePeriods();
            }
        });
    }

    if (dateInput) {
        dateInput.addEventListener('change', () => {
            hideRoster();
            if (state.attendanceMode === 'period') {
                loadAttendancePeriods();
            }
        });
    }

    if (periodSelect) {
        periodSelect.addEventListener('change', () => {
            hideRoster();
        });
    }

    if (btnLoadRoster) {
        btnLoadRoster.addEventListener('click', () => {
            fetchAndRenderAttendanceRoster();
        });
    }

    if (btnMarkAllPresent) {
        btnMarkAllPresent.addEventListener('click', () => {
            state.attendanceRoster.forEach(student => {
                setStudentStatus(student.student_id, 'PRESENT');
            });
        });
    }

    if (btnSaveAttendance) {
        btnSaveAttendance.addEventListener('click', () => {
            submitAttendance();
        });
    }

    if (btnSaveAttendanceMobile) {
        btnSaveAttendanceMobile.addEventListener('click', () => {
            submitAttendance();
        });
    }
}

export async function loadAttendanceViewData() {
    const classSelect = document.getElementById('attendance-class-select');
    const dateInput = document.getElementById('attendance-date-select');
    const periodSelect = document.getElementById('attendance-period-select');

    // Reset roster to empty state when loading/revisiting the Attendance module
    const rosterCard = document.getElementById('attendance-roster-card');
    const emptyState = document.getElementById('attendance-empty-state');
    const mobileSaveBar = document.getElementById('attendance-mobile-save-bar');
    if (rosterCard) rosterCard.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
    if (mobileSaveBar) mobileSaveBar.classList.add('hidden');
    if (classSelect) classSelect.value = '';
    if (periodSelect) periodSelect.value = '';

    if (dateInput && !dateInput.value) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
    }

    if (state.classroomsList.length > 0) {
        populateAttendanceClassDropdown(state.classroomsList);
    } else {
        if (classSelect) {
            classSelect.innerHTML = '<option value="">Loading classes...</option>';
        }
    }

    if (state.isSimulated) {
        populateAttendanceClassDropdown(mockClassrooms);
        if (window.populateDefaultDropdowns) {
            window.populateDefaultDropdowns();
        }
        return;
    }

    try {
        const classesRes = await authFetch(`${API_BASE}/classes/?school_id=${state.currentSchoolId}`);
        if (classesRes.ok) {
            const data = await classesRes.json();
            state.classroomsList = data.items || [];
            populateAttendanceClassDropdown(state.classroomsList);
        } else {
            populateAttendanceClassDropdown(mockClassrooms);
        }
        
        if (window.populateDefaultDropdowns) {
            window.populateDefaultDropdowns();
        }
    } catch (error) {
        console.error("Error loading attendance classes:", error);
        populateAttendanceClassDropdown(mockClassrooms);
    }
}

export function populateAttendanceClassDropdown(classes) {
    const select = document.getElementById('attendance-class-select');
    if (!select) return;
    select.innerHTML = '<option value="">Select Class...</option>';
    classes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.name} (Grade ${c.grade_level})`;
        select.appendChild(opt);
    });
}

export async function loadAttendancePeriods() {
    const classSelect = document.getElementById('attendance-class-select');
    const dateInput = document.getElementById('attendance-date-select');
    const periodSelect = document.getElementById('attendance-period-select');

    if (!classSelect || !dateInput || !periodSelect) return;

    const classId = classSelect.value;
    const dateVal = dateInput.value;

    if (!classId || !dateVal) {
        periodSelect.innerHTML = '<option value="">Select Class & Date first...</option>';
        return;
    }

    periodSelect.innerHTML = '<option value="">Loading periods...</option>';

    const jsDate = new Date(dateVal);
    let dayOfWeek = jsDate.getDay();
    let apiDay = (dayOfWeek === 0 || dayOfWeek === 6) ? 0 : dayOfWeek - 1;

    if (state.isSimulated) {
        setTimeout(() => {
            const slots = [
                { id: 1, period_number: 1, start_time: '07:30', end_time: '08:10', subject: 'Mathematics' },
                { id: 2, period_number: 2, start_time: '08:10', end_time: '08:50', subject: 'Science' },
                { id: 3, period_number: 3, start_time: '08:50', end_time: '09:30', subject: 'English' },
                { id: 5, period_number: 5, start_time: '10:30', end_time: '11:10', subject: 'Bahasa Melayu' }
            ];
            renderPeriodDropdown(slots);
        }, 200);
        return;
    }

    try {
        let active = state.activeTimetable;
        let slots = state.timeSlotsList;
        let subjects = state.subjectsList;

        if (!active) {
            const timetablesRes = await authFetch(`${API_BASE}/schedules/timetables?school_id=${state.currentSchoolId}`);
            if (timetablesRes.ok) {
                const timetables = (await timetablesRes.json()).items || [];
                active = timetables.find(t => t.is_active) || timetables[0] || null;
                state.activeTimetable = active;
            }
        }

        if (active) {
            const entriesRes = await authFetch(`${API_BASE}/schedules/timetables/${active.id}/entries?class_id=${classId}`);
            
            if (!slots || slots.length === 0) {
                const slotsRes = await authFetch(`${API_BASE}/schedules/time-slots?school_id=${state.currentSchoolId}`);
                if (slotsRes.ok) {
                    slots = (await slotsRes.json()).items || [];
                    state.timeSlotsList = slots;
                }
            }

            if (!subjects || subjects.length === 0) {
                const subjectsRes = await authFetch(`${API_BASE}/grading/subjects?limit=200`);
                if (subjectsRes.ok) {
                    subjects = (await subjectsRes.json()).items || [];
                    state.subjectsList = subjects;
                }
            }
            
            if (entriesRes.ok) {
                const entries = (await entriesRes.json()).items || [];
                const daySlots = slots.filter(s => s.day_of_week === apiDay);
                const classEntries = entries.filter(e => e.time_slot && e.time_slot.day_of_week === apiDay);
                
                const periodOptions = classEntries.map(entry => {
                    const slot = entry.time_slot;
                    const subject = subjects.find(s => s.id === entry.subject_id);
                    const subjectName = subject ? subject.name : 'Class';
                    return {
                        id: slot.id,
                        period_number: slot.period_number,
                        start_time: slot.start_time,
                        end_time: slot.end_time,
                        subject: subjectName
                    };
                }).sort((a, b) => a.period_number - b.period_number);
                
                if (periodOptions.length > 0) {
                    renderPeriodDropdown(periodOptions);
                } else {
                    const genericPeriods = daySlots.map(slot => ({
                        id: slot.id,
                        period_number: slot.period_number,
                        start_time: slot.start_time,
                        end_time: slot.end_time,
                        subject: 'Standard Slot'
                    })).sort((a, b) => a.period_number - b.period_number);
                    
                    renderPeriodDropdown(genericPeriods);
                }
            } else {
                renderGenericPeriodsFallback(apiDay);
            }
        } else {
            renderGenericPeriodsFallback(apiDay);
        }
    } catch (error) {
        console.error("Error loading periods:", error);
        renderGenericPeriodsFallback(apiDay);
    }
}

function renderPeriodDropdown(periods) {
    const select = document.getElementById('attendance-period-select');
    if (!select) return;
    select.innerHTML = '<option value="">Select Period...</option>';
    periods.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `Period ${p.period_number}: ${p.subject} (${p.start_time} - ${p.end_time})`;
        select.appendChild(opt);
    });
}

function renderGenericPeriodsFallback(apiDay) {
    const periods = [
        { id: 1, period_number: 1, start_time: '07:30', end_time: '08:10', subject: 'Period 1' },
        { id: 2, period_number: 2, start_time: '08:10', end_time: '08:50', subject: 'Period 2' },
        { id: 3, period_number: 3, start_time: '08:50', end_time: '09:30', subject: 'Period 3' },
        { id: 4, period_number: 4, start_time: '09:30', end_time: '10:10', subject: 'Period 4' },
        { id: 5, period_number: 5, start_time: '10:30', end_time: '11:10', subject: 'Period 5' },
        { id: 6, period_number: 6, start_time: '11:10', end_time: '11:50', subject: 'Period 6' },
        { id: 7, period_number: 7, start_time: '11:50', end_time: '12:30', subject: 'Period 7' },
        { id: 8, period_number: 8, start_time: '12:30', end_time: '13:10', subject: 'Period 8' }
    ];
    renderPeriodDropdown(periods);
}

export async function fetchAndRenderAttendanceRoster() {
    const classSelect = document.getElementById('attendance-class-select');
    const dateInput = document.getElementById('attendance-date-select');
    const periodSelect = document.getElementById('attendance-period-select');
    const rosterCard = document.getElementById('attendance-roster-card');
    const emptyState = document.getElementById('attendance-empty-state');
    const tableBody = document.getElementById('attendance-roster-body');

    if (!classSelect || !dateInput || !rosterCard || !emptyState || !tableBody) return;

    const classId = classSelect.value;
    const dateVal = dateInput.value;
    const periodId = periodSelect ? periodSelect.value : '';

    if (!classId || !dateVal) {
        showToast("Please select Classroom and Date.", "warning");
        return;
    }

    if (state.attendanceMode === 'period' && !periodId) {
        showToast("Please select a Period.", "warning");
        return;
    }

    emptyState.classList.add('hidden');
    rosterCard.classList.remove('hidden');
    const mobileSaveBar = document.getElementById('attendance-mobile-save-bar');
    if (mobileSaveBar) mobileSaveBar.classList.remove('hidden');
    tableBody.innerHTML = `
        <tr>
            <td colspan="4" class="py-8 text-center text-slate-400">
                <i class="fas fa-circle-notch fa-spin text-brand-teal text-lg mr-2"></i> Loading roster and records...
            </td>
        </tr>`;

    const targetTimeSlotId = state.attendanceMode === 'period' ? parseInt(periodId) : null;

    if (state.isSimulated) {
        setTimeout(() => {
            let session = mockAttendanceSessions.find(s => 
                String(s.class_id) === String(classId) && 
                s.date === dateVal && 
                ((s.time_slot_id === targetTimeSlotId) || (s.time_slot_id === null && targetTimeSlotId === null))
            );

            const classStudents = mockStudents.filter(s => String(s.class_id) === String(classId));
            
            if (session) {
                state.currentAttendanceSession = session;
                state.attendanceRoster = classStudents.map(student => {
                    const record = session.records.find(r => r.student_id === student.id);
                    return {
                        student_id: student.id,
                        student_id_number: student.student_id_number,
                        full_name: student.full_name,
                        status: record ? record.status : 'PRESENT',
                        notes: record ? record.notes || '' : ''
                    };
                });
                renderRosterRows(state.attendanceRoster, true);
            } else {
                state.currentAttendanceSession = null;
                state.attendanceRoster = classStudents.map(student => ({
                    student_id: student.id,
                    student_id_number: student.student_id_number,
                    full_name: student.full_name,
                    status: 'PRESENT',
                    notes: ''
                }));
                renderRosterRows(state.attendanceRoster, false);
            }
        }, 300);
        return;
    }

    try {
        const sessionsRes = await authFetch(`${API_BASE}/attendance/sessions?class_id=${classId}&date_from=${dateVal}&date_to=${dateVal}`);
        const studentsRes = await authFetch(`${API_BASE}/students/?class_id=${classId}&limit=200`);

        if (sessionsRes.ok && studentsRes.ok) {
            const sessionsData = await sessionsRes.json();
            const studentsData = await studentsRes.json();
            const classStudents = studentsData.items || [];
            const sessions = sessionsData.items || [];
            
            const matchingSession = sessions.find(s => 
                (s.time_slot_id === targetTimeSlotId || (s.time_slot_id === null && targetTimeSlotId === null))
            );

            if (matchingSession) {
                const detailRes = await authFetch(`${API_BASE}/attendance/sessions/${matchingSession.id}`);
                if (detailRes.ok) {
                    const detail = await detailRes.json();
                    state.currentAttendanceSession = detail;
                    state.attendanceRoster = classStudents.map(student => {
                        const record = detail.records.find(r => r.student_id === student.id);
                        return {
                            student_id: student.id,
                            student_id_number: student.student_id_number,
                            full_name: student.full_name,
                            status: record ? record.status : 'PRESENT',
                            notes: record ? record.notes || '' : ''
                        };
                    });
                    renderRosterRows(state.attendanceRoster, true);
                } else {
                    throw new Error("Failed to load session details");
                }
            } else {
                state.currentAttendanceSession = null;
                state.attendanceRoster = classStudents.map(student => ({
                    student_id: student.id,
                    student_id_number: student.student_id_number,
                    full_name: student.full_name,
                    status: 'PRESENT',
                    notes: ''
                }));
                renderRosterRows(state.attendanceRoster, false);
            }
        } else {
            throw new Error("Failed to load attendance roster dependencies");
        }
    } catch (error) {
        console.error("Error loading roster:", error);
        showToast("Failed to fetch roster. Falling back to simulation.", "error");
        state.isSimulated = true;
        fetchAndRenderAttendanceRoster();
    }
}

function renderRosterRows(roster, isExisting) {
    const tableBody = document.getElementById('attendance-roster-body');
    const cardsContainer = document.getElementById('attendance-roster-cards');
    const statusDot = document.getElementById('attendance-session-status-dot');
    const statusText = document.getElementById('attendance-session-status-text');
    const methodText = document.getElementById('attendance-session-method-text');

    if (!tableBody) return;

    if (statusDot && statusText && methodText) {
        if (isExisting && state.currentAttendanceSession) {
            statusDot.className = "w-2.5 h-2.5 rounded-full bg-emerald-500";
            statusText.textContent = `Recorded Session #${state.currentAttendanceSession.id}`;
            methodText.textContent = `Method: ${state.currentAttendanceSession.method}`;
        } else {
            statusDot.className = "w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse";
            statusText.textContent = "Unrecorded Session";
            methodText.textContent = "Method: MANUAL";
        }
    }

    if (roster.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="py-8 text-center text-slate-400">
                    <i class="fas fa-user-slash text-2xl block mb-2 opacity-50"></i>
                    No students found in this class. Enroll students first in the Students directory.
                </td>
            </tr>`;
        if (cardsContainer) {
            cardsContainer.innerHTML = `
                <div class="py-8 text-center text-slate-400 border border-dashed border-slate-205/60 rounded-2xl">
                    <i class="fas fa-user-slash text-2xl block mb-2 opacity-50"></i>
                    No students found in this class.
                </div>`;
        }
        updateRosterStats();
        return;
    }

    let tableHtml = '';
    let cardsHtml = '';
    roster.forEach((student) => {
        // Render table row for desktop
        tableHtml += `
            <tr class="hover:bg-slate-50/50 transition-all align-middle" data-student-id="${student.student_id}">
                <td class="py-3 px-4 font-bold text-slate-400 font-mono text-2xs">${student.student_id_number}</td>
                <td class="py-3 px-4">
                    <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-xl bg-teal-50 text-brand-teal flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                            ${student.full_name.charAt(0)}
                        </div>
                        <span class="font-semibold text-slate-800 text-xs">${student.full_name}</span>
                    </div>
                </td>
                <td class="py-3 px-4 text-center">
                    <div class="inline-flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/50 gap-0.5">
                        <button type="button" onclick="setStudentStatus(${student.student_id}, 'PRESENT')" 
                            class="status-pill-present px-3.5 py-1.5 text-3xs font-bold rounded-lg transition-all cursor-pointer ${student.status === 'PRESENT' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}" 
                            id="btn-status-present-${student.student_id}">
                            PRESENT
                        </button>
                        <button type="button" onclick="setStudentStatus(${student.student_id}, 'ABSENT')" 
                            class="status-pill-absent px-3.5 py-1.5 text-3xs font-bold rounded-lg transition-all cursor-pointer ${student.status === 'ABSENT' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}" 
                            id="btn-status-absent-${student.student_id}">
                            ABSENT
                        </button>
                        <button type="button" onclick="setStudentStatus(${student.student_id}, 'LATE')" 
                            class="status-pill-late px-3.5 py-1.5 text-3xs font-bold rounded-lg transition-all cursor-pointer ${student.status === 'LATE' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}" 
                            id="btn-status-late-${student.student_id}">
                            LATE
                        </button>
                        <button type="button" onclick="setStudentStatus(${student.student_id}, 'EXCUSED')" 
                            class="status-pill-excused px-3.5 py-1.5 text-3xs font-bold rounded-lg transition-all cursor-pointer ${student.status === 'EXCUSED' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}" 
                            id="btn-status-excused-${student.student_id}">
                            EXCUSED
                        </button>
                    </div>
                </td>
                <td class="py-3 px-4">
                    <input type="text" id="note-input-table-${student.student_id}" value="${student.notes || ''}" onchange="updateStudentNotes(${student.student_id}, this.value)"
                        placeholder="Add reason or note..." 
                        class="w-full px-3 py-1.5 bg-slate-50 border border-slate-200/50 rounded-xl text-slate-800 text-2xs focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal">
                </td>
            </tr>`;

        // Render mobile card
        cardsHtml += `
            <div class="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 space-y-3.5" data-student-id="${student.student_id}">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-xl bg-teal-50 text-brand-teal flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                        ${student.full_name.charAt(0)}
                    </div>
                    <div class="min-w-0">
                        <span class="font-bold text-slate-800 text-xs block">${student.full_name}</span>
                        <span class="font-mono text-3xs text-slate-400 font-bold">${student.student_id_number}</span>
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-1.5 bg-slate-100 p-0.5 rounded-xl border border-slate-200/30">
                    <button type="button" onclick="setStudentStatus(${student.student_id}, 'PRESENT')" 
                        class="status-pill-card-present py-2 text-3xs font-bold rounded-lg transition-all cursor-pointer text-center ${student.status === 'PRESENT' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}" 
                        id="btn-status-card-present-${student.student_id}">
                        PRESENT
                    </button>
                    <button type="button" onclick="setStudentStatus(${student.student_id}, 'ABSENT')" 
                        class="status-pill-card-absent py-2 text-3xs font-bold rounded-lg transition-all cursor-pointer text-center ${student.status === 'ABSENT' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}" 
                        id="btn-status-card-absent-${student.student_id}">
                        ABSENT
                    </button>
                    <button type="button" onclick="setStudentStatus(${student.student_id}, 'LATE')" 
                        class="status-pill-card-late py-2 text-3xs font-bold rounded-lg transition-all cursor-pointer text-center ${student.status === 'LATE' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}" 
                        id="btn-status-card-late-${student.student_id}">
                        LATE
                    </button>
                    <button type="button" onclick="setStudentStatus(${student.student_id}, 'EXCUSED')" 
                        class="status-pill-card-excused py-2 text-3xs font-bold rounded-lg transition-all cursor-pointer text-center ${student.status === 'EXCUSED' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}" 
                        id="btn-status-card-excused-${student.student_id}">
                        EXCUSED
                    </button>
                </div>

                <div class="space-y-1">
                    <label class="text-[10px] font-semibold text-slate-400">Notes / Remarks</label>
                    <input type="text" id="note-input-card-${student.student_id}" value="${student.notes || ''}" onchange="updateStudentNotes(${student.student_id}, this.value)"
                        placeholder="Add reason or note..." 
                        class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-2xs focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal">
                </div>
            </div>`;
    });
    tableBody.innerHTML = tableHtml;
    if (cardsContainer) {
        cardsContainer.innerHTML = cardsHtml;
    }
    updateRosterStats();
}

export function setStudentStatus(studentId, status) {
    const student = state.attendanceRoster.find(s => s.student_id === studentId);
    if (!student) return;

    student.status = status;

    // Table Buttons
    const btnP = document.getElementById(`btn-status-present-${studentId}`);
    const btnA = document.getElementById(`btn-status-absent-${studentId}`);
    const btnL = document.getElementById(`btn-status-late-${studentId}`);
    const btnE = document.getElementById(`btn-status-excused-${studentId}`);

    if (btnP) btnP.className = `status-pill-present px-3.5 py-1.5 text-3xs font-bold rounded-lg transition-all cursor-pointer ${status === 'PRESENT' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`;
    if (btnA) btnA.className = `status-pill-absent px-3.5 py-1.5 text-3xs font-bold rounded-lg transition-all cursor-pointer ${status === 'ABSENT' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`;
    if (btnL) btnL.className = `status-pill-late px-3.5 py-1.5 text-3xs font-bold rounded-lg transition-all cursor-pointer ${status === 'LATE' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`;
    if (btnE) btnE.className = `status-pill-excused px-3.5 py-1.5 text-3xs font-bold rounded-lg transition-all cursor-pointer ${status === 'EXCUSED' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`;

    // Card Buttons
    const btnP_card = document.getElementById(`btn-status-card-present-${studentId}`);
    const btnA_card = document.getElementById(`btn-status-card-absent-${studentId}`);
    const btnL_card = document.getElementById(`btn-status-card-late-${studentId}`);
    const btnE_card = document.getElementById(`btn-status-card-excused-${studentId}`);

    if (btnP_card) btnP_card.className = `status-pill-card-present py-2 text-3xs font-bold rounded-lg transition-all cursor-pointer text-center ${status === 'PRESENT' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`;
    if (btnA_card) btnA_card.className = `status-pill-card-absent py-2 text-3xs font-bold rounded-lg transition-all cursor-pointer text-center ${status === 'ABSENT' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`;
    if (btnL_card) btnL_card.className = `status-pill-card-late py-2 text-3xs font-bold rounded-lg transition-all cursor-pointer text-center ${status === 'LATE' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`;
    if (btnE_card) btnE_card.className = `status-pill-card-excused py-2 text-3xs font-bold rounded-lg transition-all cursor-pointer text-center ${status === 'EXCUSED' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`;

    updateRosterStats();
}

export function updateStudentNotes(studentId, value) {
    const student = state.attendanceRoster.find(s => s.student_id === studentId);
    if (student) {
        student.notes = value;
        
        // Sync values between table input and card input
        const inputTable = document.getElementById(`note-input-table-${studentId}`);
        const inputCard = document.getElementById(`note-input-card-${studentId}`);
        
        if (inputTable && inputTable.value !== value) inputTable.value = value;
        if (inputCard && inputCard.value !== value) inputCard.value = value;
    }
}

export function updateRosterStats() {
    const statTotal = document.getElementById('stat-total-students');
    const statPresent = document.getElementById('stat-present-students');
    const statAbsent = document.getElementById('stat-absent-students');
    const statLate = document.getElementById('stat-late-students');
    const statExcused = document.getElementById('stat-excused-students');

    if (!statTotal) return;

    const total = state.attendanceRoster.length;
    const present = state.attendanceRoster.filter(s => s.status === 'PRESENT').length;
    const absent = state.attendanceRoster.filter(s => s.status === 'ABSENT').length;
    const late = state.attendanceRoster.filter(s => s.status === 'LATE').length;
    const excused = state.attendanceRoster.filter(s => s.status === 'EXCUSED').length;

    statTotal.textContent = `Students: ${total}`;
    statPresent.textContent = `Present: ${present}`;
    statAbsent.textContent = `Absent: ${absent}`;
    statLate.textContent = `Late: ${late}`;
    statExcused.textContent = `Excused: ${excused}`;
}

export async function submitAttendance() {
    const classSelect = document.getElementById('attendance-class-select');
    const dateInput = document.getElementById('attendance-date-select');
    const periodSelect = document.getElementById('attendance-period-select');
    const btnSave = document.getElementById('btn-save-attendance');
    const btnSaveMobile = document.getElementById('btn-save-attendance-mobile');

    if (!classSelect || !dateInput) return;

    const classId = parseInt(classSelect.value);
    const dateVal = dateInput.value;
    const periodId = periodSelect ? periodSelect.value : '';

    if (!classId || !dateVal) {
        showToast("Please make sure class and date are selected.", "warning");
        return;
    }

    const targetTimeSlotId = state.attendanceMode === 'period' ? parseInt(periodId) : null;

    const records = state.attendanceRoster.map(student => ({
        student_id: student.student_id,
        status: student.status,
        notes: student.notes || null
    }));

    const setButtonsLoading = (isLoading) => {
        [btnSave, btnSaveMobile].forEach(btn => {
            if (btn) {
                btn.disabled = isLoading;
                if (isLoading) {
                    btn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> Saving...`;
                } else {
                    btn.innerHTML = `<i class="fas fa-save"></i> Save Attendance`;
                }
            }
        });
    };

    setButtonsLoading(true);

    if (state.isSimulated) {
        setTimeout(() => {
            let session = mockAttendanceSessions.find(s => 
                String(s.class_id) === String(classId) && 
                s.date === dateVal && 
                ((s.time_slot_id === targetTimeSlotId) || (s.time_slot_id === null && targetTimeSlotId === null))
            );

            if (session) {
                session.records = records.map((r, i) => ({ id: i + 1, session_id: session.id, ...r }));
            } else {
                const newId = mockAttendanceSessions.length + 1;
                session = {
                    id: newId,
                    class_id: classId,
                    date: dateVal,
                    time_slot_id: targetTimeSlotId,
                    recorded_by_id: 1,
                    method: 'MANUAL',
                    created_at: new Date().toISOString(),
                    records: records.map((r, i) => ({ id: i + 1, session_id: newId, ...r }))
                };
                mockAttendanceSessions.push(session);
            }
            
            showToast("Attendance saved successfully (Demo Mode)", "success");
            setButtonsLoading(false);
            fetchAndRenderAttendanceRoster();
        }, 500);
        return;
    }

    try {
        const payload = {
            class_id: classId,
            date: dateVal,
            time_slot_id: targetTimeSlotId,
            method: 'MANUAL',
            records: records
        };

        const response = await authFetch(`${API_BASE}/attendance/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            showToast("Attendance saved successfully!", "success");
            fetchAndRenderAttendanceRoster();
        } else {
            const err = await response.json();
            showToast(err.detail || "Failed to save attendance", "error");
        }
    } catch (error) {
        console.error("Error saving attendance:", error);
        showToast("Network error. Failed to save attendance.", "error");
    } finally {
        setButtonsLoading(false);
    }
}

// Bind to window for HTML events compatibility
window.setStudentStatus = setStudentStatus;
window.updateStudentNotes = updateStudentNotes;
window.initAttendance = initAttendance;
window.loadAttendanceViewData = loadAttendanceViewData;
window.fetchAndRenderAttendanceRoster = fetchAndRenderAttendanceRoster;
window.loadAttendancePeriods = loadAttendancePeriods;
window.populateAttendanceClassDropdown = populateAttendanceClassDropdown;
