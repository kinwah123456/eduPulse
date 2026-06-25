// EduPulse Ops — Merit & Discipline Module
// Manages student point roster, activities logs, custom rules CRUD, and Feedback Inbox submissions/acknowledgement

import { state, authFetch, API_BASE } from './api.js';
import { showToast } from './ui.js';

export let meritOptionsList = [];
export let meritLogsList = [];
export let feedbackSubmissionsList = [];

export const mockMeritOptions = [
    { id: 1, name: "Outstanding Classroom Helpfulness", points: 10, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 2, name: "Active Participation in Discussions", points: 5, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 3, name: "Perfect Weekly Attendance", points: 15, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 4, name: "Excellent Team Project Leadership", points: 20, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 5, name: "Classroom Disruption or Noise", points: -10, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 6, name: "Failure to Submit Homework on Time", points: -5, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
];

export const mockMeritLogs = [
    {
        id: 1,
        student_id: 1,
        user_id: 999,
        merit_option_id: 1,
        points_changed: 10,
        justification: "Assisted Cikgu in moving textbooks from the staff room.",
        created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        student: { id: 1, full_name: "Muhammad Ali Bin Hassan", student_id_number: "S2001" },
        user: { id: 999, full_name: "Noraini Binti Abdullah", role: "TEACHER" },
        merit_option: { id: 1, name: "Outstanding Classroom Helpfulness", points: 10 }
    },
    {
        id: 2,
        student_id: 2,
        user_id: 999,
        merit_option_id: 5,
        points_changed: -10,
        justification: "Threw paper airplanes across the room during Science lecture.",
        created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
        student: { id: 2, full_name: "Lim Wei Seng", student_id_number: "S2002" },
        user: { id: 999, full_name: "Noraini Binti Abdullah", role: "TEACHER" },
        merit_option: { id: 5, name: "Classroom Disruption or Noise", points: -10 }
    }
];
export function initMerit() {
    // No explicit setup needed as functions are exposed globally
}

export async function loadMeritViewData() {
    const isAdmin = state.currentUser && state.currentUser.role === 'ADMIN';
    const rulesTabBtn = document.getElementById('btn-tab-merit-rules');
    if (rulesTabBtn) {
        if (isAdmin) {
            rulesTabBtn.classList.remove('hidden');
        } else {
            rulesTabBtn.classList.add('hidden');
        }
    }

    switchMeritSubTab('roster');

    if (state.classroomsList.length === 0) {
        await fetchClassroomsForFilter();
    }
    populateMeritClassFilter();

    if (state.isSimulated) {
        state.mockStudents = state.mockStudents || [];
        mockStudents.forEach(s => {
            if (s.merit_points === undefined) s.merit_points = 50;
        });
        state.studentsList = mockStudents;
        meritOptionsList = mockMeritOptions;
        if (meritLogsList.length === 0) {
            meritLogsList = mockMeritLogs;
        }
        updateAndRenderMeritAll();
    } else {
        try {
            const stuRes = await authFetch(`${API_BASE}/students/?skip=0&limit=500`);
            if (stuRes.ok) {
                const data = await stuRes.json();
                state.studentsList = data.items || [];
            }

            const optRes = await authFetch(`${API_BASE}/merit/options`);
            if (optRes.ok) {
                meritOptionsList = await optRes.json();
            }

            const logRes = await authFetch(`${API_BASE}/merit/logs`);
            if (logRes.ok) {
                meritLogsList = await logRes.json();
            }

            updateAndRenderMeritAll();
        } catch (error) {
            console.error("Error loading merit view data:", error);
            showToast("Failed to fetch merit data from server", "error");
        }
    }
}

async function fetchClassroomsForFilter() {
    if (state.isSimulated) {
        state.classroomsList = mockClassrooms;
        return;
    }
    try {
        const res = await authFetch(`${API_BASE}/classes/?school_id=${state.currentSchoolId}`);
        if (res.ok) {
            const data = await res.json();
            state.classroomsList = data.items || [];
        }
    } catch (error) {
        console.error("Error fetching classrooms for filter:", error);
    }
}

function populateMeritClassFilter() {
    const select = document.getElementById('merit-class-filter');
    if (!select) return;
    select.innerHTML = '<option value="">All Classrooms</option>';
    state.classroomsList.forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
}

export function switchMeritSubTab(tabName) {
    const tabs = ['roster', 'inbox', 'logs', 'rules'];
    tabs.forEach(t => {
        const btn = document.getElementById(`btn-tab-merit-${t}`);
        const view = document.getElementById(`sub-view-merit-${t}`);
        if (btn && view) {
            if (t === tabName) {
                btn.classList.add('border-b-2', 'border-brand-teal', 'text-brand-teal');
                btn.classList.remove('border-transparent', 'text-slate-400', 'hover:text-slate-600');
                view.classList.remove('hidden');
            } else {
                btn.classList.remove('border-b-2', 'border-brand-teal', 'text-brand-teal');
                btn.classList.add('border-transparent', 'text-slate-400', 'hover:text-slate-600');
                view.classList.add('hidden');
            }
        }
    });
    if (tabName === 'inbox') {
        loadFeedbackSubmissions();
    }
}

export function updateAndRenderMeritAll() {
    updateMeritKPIs();
    renderMeritRoster();
    renderMeritLogs();
    renderMeritRules();
}

export function updateMeritKPIs() {
    const kpiAvg = document.getElementById('kpi-merit-avg');
    const kpiActions = document.getElementById('kpi-merit-actions');
    const kpiPos = document.getElementById('kpi-merit-positive');
    const kpiNeg = document.getElementById('kpi-merit-negative');

    if (state.studentsList.length > 0) {
        const sum = state.studentsList.reduce((acc, s) => acc + (s.merit_points !== undefined ? s.merit_points : 50), 0);
        const avg = (sum / state.studentsList.length).toFixed(1);
        if (kpiAvg) kpiAvg.textContent = avg;
    } else {
        if (kpiAvg) kpiAvg.textContent = '50.0';
    }

    if (kpiActions) kpiActions.textContent = meritLogsList.length;

    let posSum = 0;
    let negSum = 0;
    meritLogsList.forEach(log => {
        if (log.points_changed > 0) {
            posSum += log.points_changed;
        } else {
            negSum += log.points_changed;
        }
    });

    if (kpiPos) kpiPos.textContent = `+${posSum}`;
    if (kpiNeg) kpiNeg.textContent = `${negSum}`;
}

export function renderMeritRoster() {
    const tableBody = document.getElementById('merit-roster-table-body');
    if (!tableBody) return;

    const searchText = (document.getElementById('merit-student-search')?.value || '').toLowerCase();
    const classFilterVal = document.getElementById('merit-class-filter')?.value || '';

    const filtered = state.studentsList.filter(s => {
        const matchesSearch = s.full_name.toLowerCase().includes(searchText) || s.student_id_number.toLowerCase().includes(searchText);
        const matchesClass = !classFilterVal || String(s.class_id) === classFilterVal;
        return matchesSearch && matchesClass;
    });

    if (filtered.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="py-8 text-center text-slate-400">No students found matching the criteria.</td>
            </tr>`;
        return;
    }

    tableBody.innerHTML = '';
    filtered.forEach(s => {
        const cls = state.classroomsList.find(c => c.id === s.class_id);
        const className = cls ? cls.name : 'Unassigned';
        const pts = s.merit_points !== undefined ? s.merit_points : 50;
        
        let badgeClass = 'bg-teal-50 text-brand-teal';
        if (pts < 50) {
            badgeClass = 'bg-rose-50 text-rose-600';
        } else if (pts > 50) {
            badgeClass = 'bg-emerald-50 text-emerald-700 font-bold';
        }

        tableBody.innerHTML += `
            <tr class="hover:bg-slate-50/50 transition-colors duration-150">
                <td class="py-4 px-6 text-sm font-semibold text-slate-700">${s.student_id_number}</td>
                <td class="py-4 px-6 text-sm font-medium text-slate-900">${s.full_name}</td>
                <td class="py-4 px-6 text-sm text-slate-500">${className}</td>
                <td class="py-4 px-6 text-sm">
                    <span class="px-2.5 py-1 rounded-full text-xs font-semibold ${badgeClass}">
                        ${pts} pts
                    </span>
                </td>
                <td class="py-4 px-6 text-sm text-right">
                    <button onclick="openAwardPointsModal(${s.id})"
                        class="px-3 py-1.5 bg-slate-100 hover:bg-brand-teal hover:text-white text-slate-600 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-1.5 ml-auto cursor-pointer">
                        <i class="fas fa-plus-minus"></i> Award/Reduce
                    </button>
                </td>
            </tr>`;
    });
}

export function filterMeritRoster() {
    renderMeritRoster();
}

export function renderMeritLogs() {
    const tableBody = document.getElementById('merit-logs-table-body');
    if (!tableBody) return;

    const isAdmin = state.currentUser && state.currentUser.role === 'ADMIN';

    document.querySelectorAll('.admin-merit-delete-header').forEach(el => {
        if (isAdmin) el.classList.remove('hidden');
        else el.classList.add('hidden');
    });

    if (meritLogsList.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="${isAdmin ? 6 : 5}" class="py-8 text-center text-slate-400">No activity logs recorded yet.</td>
            </tr>`;
        return;
    }

    tableBody.innerHTML = '';
    meritLogsList.forEach(log => {
        const studentName = log.student ? log.student.full_name : `Student #${log.student_id}`;
        const studentIdNum = log.student ? ` (${log.student.student_id_number})` : '';
        const teacherName = log.user ? log.user.full_name : `User #${log.user_id}`;
        
        const isPos = log.points_changed > 0;
        const pointsText = isPos ? `+${log.points_changed}` : log.points_changed;
        const pointsClass = isPos ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold';

        const optName = log.merit_option ? log.merit_option.name : 'Predefined Rule';
        
        const dateStr = new Date(log.created_at).toLocaleString('en-MY', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        let actionsCell = '';
        if (isAdmin) {
            actionsCell = `
                <td class="py-4 px-6 text-sm text-right">
                    <button onclick="deleteMeritLog(${log.id})" class="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer" title="Delete log entry">
                        <i class="fas fa-trash-can text-sm"></i>
                    </button>
                </td>`;
        }

        tableBody.innerHTML += `
            <tr class="hover:bg-slate-50/50 transition-colors duration-150">
                <td class="py-4 px-6 text-sm text-slate-500">${dateStr}</td>
                <td class="py-4 px-6 text-sm font-semibold text-slate-700">${studentName}${studentIdNum}</td>
                <td class="py-4 px-6 text-sm text-slate-600">${teacherName}</td>
                <td class="py-4 px-6 text-sm ${pointsClass}">${pointsText}</td>
                <td class="py-4 px-6 text-sm text-slate-600">
                    <div class="font-medium text-slate-800">${optName}</div>
                    <div class="text-xs text-slate-500 italic mt-0.5">${log.justification}</div>
                </td>
                ${actionsCell}
            </tr>`;
    });
}

export function renderMeritLeaderboard(students) {
    const container = document.getElementById('merit-leaderboard-container');
    if (!container) return;

    students.forEach(s => {
        if (s.merit_points === undefined) s.merit_points = 50;
    });

    const sorted = [...students]
        .filter(s => s.is_active)
        .sort((a, b) => b.merit_points - a.merit_points)
        .slice(0, 5);

    if (sorted.length === 0) {
        container.innerHTML = `<div class="text-center text-xs text-slate-400 py-4">No student data available.</div>`;
        return;
    }

    container.innerHTML = '';
    sorted.forEach((student, index) => {
        const rank = index + 1;
        
        let rankBadge = '';
        if (rank === 1) {
            rankBadge = '<span class="w-6 h-6 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xs font-bold shrink-0"><i class="fas fa-trophy text-[10px]"></i></span>';
        } else if (rank === 2) {
            rankBadge = '<span class="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold shrink-0">2</span>';
        } else if (rank === 3) {
            rankBadge = '<span class="w-6 h-6 rounded-full bg-amber-50 text-amber-700/80 flex items-center justify-center text-xs font-bold shrink-0">3</span>';
        } else {
            rankBadge = `<span class="w-6 h-6 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center text-xs font-medium shrink-0">${rank}</span>`;
        }

        const pts = student.merit_points;
        let ptsClass = 'text-brand-teal bg-teal-50';
        if (pts < 50) {
            ptsClass = 'text-rose-500 bg-rose-50';
        } else if (pts > 50) {
            ptsClass = 'text-emerald-600 bg-emerald-50 font-bold';
        }

        container.innerHTML += `
            <div class="flex items-center justify-between p-2.5 hover:bg-slate-50 rounded-xl transition-colors duration-150">
                <div class="flex items-center gap-3 min-w-0">
                    ${rankBadge}
                    <div class="truncate">
                        <div class="text-xs font-semibold text-slate-800 truncate">${student.full_name}</div>
                        <div class="text-[9px] text-slate-400">${student.student_id_number}</div>
                    </div>
                </div>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${ptsClass}">
                    ${pts} pts
                </span>
            </div>
        `;
    });
}

export function renderMeritRules() {
    const tableBody = document.getElementById('merit-rules-table-body');
    if (!tableBody) return;

    if (meritOptionsList.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="py-8 text-center text-slate-400">No rules configured.</td>
            </tr>`;
        return;
    }

    tableBody.innerHTML = '';
    meritOptionsList.forEach(opt => {
        const isPos = opt.points > 0;
        const ptsText = isPos ? `+${opt.points}` : opt.points;
        const ptsClass = isPos ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'bg-rose-50 text-rose-600 font-semibold';
        const statusText = opt.is_active ? 'Active' : 'Inactive';
        const statusClass = opt.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800';

        tableBody.innerHTML += `
            <tr class="hover:bg-slate-50/50 transition-colors duration-150">
                <td class="py-4 px-6 text-sm font-medium text-slate-900">${opt.name}</td>
                <td class="py-4 px-6 text-sm">
                    <span class="px-2.5 py-1 rounded-full text-xs ${ptsClass}">
                        ${ptsText} pts
                    </span>
                </td>
                <td class="py-4 px-6 text-sm">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${statusClass}">
                        ${statusText}
                    </span>
                </td>
                <td class="py-4 px-6 text-sm text-right space-x-2">
                    <button onclick="openEditMeritOptionModal(${opt.id})" class="p-1.5 text-slate-500 hover:text-brand-teal hover:bg-slate-100 rounded-lg transition-colors cursor-pointer" title="Edit rule">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteMeritOption(${opt.id})" class="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer" title="Delete rule">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>`;
    });
}

export async function loadFeedbackSubmissions() {
    if (state.isSimulated) {
        const stored = localStorage.getItem('simulated_feedback_submissions');
        if (stored) {
            try {
                feedbackSubmissionsList = JSON.parse(stored);
            } catch (e) {
                console.error("Failed to parse simulated feedback submissions:", e);
                feedbackSubmissionsList = [];
            }
        } else {
            feedbackSubmissionsList = [
                {
                    id: 101,
                    is_anonymous: true,
                    identity_card_number: null,
                    description: "Witnessed senior student bullying a junior behind the canteen during recess.",
                    location: "Canteen",
                    images: ["/static/assets/education_hero.png"],
                    status: "unread",
                    acknowledged_by_id: null,
                    acknowledged_at: null,
                    student_id: null,
                    created_at: new Date(Date.now() - 3600000).toISOString()
                },
                {
                    id: 102,
                    is_anonymous: false,
                    identity_card_number: "120101-14-1111",
                    description: "Complain about toilet cleanliness on Block B level 3. The pipes are leaking.",
                    location: "Block B Level 3",
                    images: [],
                    status: "acknowledged",
                    acknowledged_by_id: 999,
                    acknowledged_at: new Date().toISOString(),
                    student_id: 1,
                    student: { id: 1, full_name: "Muhammad Ali Bin Hassan", student_id_number: "S2001" },
                    acknowledged_by: { id: 999, full_name: "Noraini Binti Abdullah", role: "TEACHER" },
                    created_at: new Date(Date.now() - 7200000).toISOString()
                }
            ];
        }

        const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);
        feedbackSubmissionsList = feedbackSubmissionsList.filter(sub => {
            return new Date(sub.created_at).getTime() >= oneYearAgo;
        });

        localStorage.setItem('simulated_feedback_submissions', JSON.stringify(feedbackSubmissionsList));
        renderFeedbackSubmissions();
    } else {
        try {
            const res = await authFetch(`${API_BASE}/merit/submissions`);
            if (res.ok) {
                feedbackSubmissionsList = await res.json();
            }
            renderFeedbackSubmissions();
        } catch (error) {
            console.error("Error loading feedback submissions:", error);
            showToast("Failed to fetch feedback submissions", "error");
        }
    }
}

export function renderFeedbackSubmissions() {
    const tableBody = document.getElementById('merit-inbox-table-body');
    if (!tableBody) return;

    if (feedbackSubmissionsList.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="py-8 text-center text-slate-400">No feedback submissions found.</td>
            </tr>`;
        return;
    }

    tableBody.innerHTML = '';
    feedbackSubmissionsList.forEach(sub => {
        const dateStr = new Date(sub.created_at).toLocaleString('en-MY', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        const location = sub.location || 'General';

        let submitterText = '';
        if (sub.is_anonymous) {
            submitterText = `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                <i class="fas fa-user-secret text-[10px]"></i> Anonymous
            </span>`;
        } else if (sub.student) {
            submitterText = `
                <div class="font-semibold text-slate-800">${sub.student.full_name}</div>
                <div class="text-[10px] text-slate-400 font-medium">Student ID: ${sub.student.student_id_number}</div>
                <div class="text-[10px] text-slate-400 font-medium">IC: ${sub.identity_card_number}</div>
            `;
        } else {
            submitterText = `
                <div class="font-semibold text-rose-700">IC (Unregistered)</div>
                <div class="text-[10px] text-slate-500 font-semibold">${sub.identity_card_number}</div>
            `;
        }

        let evidenceHtml = '';
        if (sub.images && sub.images.length > 0) {
            evidenceHtml = '<div class="flex flex-wrap gap-2 mt-2.5">';
            sub.images.forEach(imgUrl => {
                evidenceHtml += `
                    <img src="${imgUrl}" onclick="openLightboxModal('${imgUrl}')" 
                         class="w-11 h-11 object-cover rounded-xl border border-slate-200 cursor-zoom-in hover:scale-105 transition-all shadow-sm" 
                         title="Click to view full size">
                `;
            });
            evidenceHtml += '</div>';
        }

        const isUnread = sub.status === 'unread';
        const statusBadge = isUnread 
            ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                 <i class="fas fa-circle text-[6px]"></i> Unread
               </span>`
            : `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                 <i class="fas fa-circle-check"></i> Acknowledged
               </span>`;

        const isAdmin = state.currentUser && state.currentUser.role === 'ADMIN';
        let actionHtml = '';
        if (isUnread) {
            actionHtml = `
                <div class="flex items-center justify-end gap-2">
                    <button onclick="acknowledgeSubmission(${sub.id})" 
                            class="px-3 py-1.5 bg-brand-teal hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm shadow-brand-teal/10 cursor-pointer">
                        Acknowledge
                    </button>
                    ${isAdmin ? `
                    <button onclick="deleteSubmission(${sub.id})" 
                            class="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer" title="Delete submission">
                        <i class="fas fa-trash"></i>
                    </button>
                    ` : ''}
                </div>
            `;
        } else {
            const teacherName = sub.acknowledged_by ? sub.acknowledged_by.full_name : 'Teacher';
            const ackDate = sub.acknowledged_at ? new Date(sub.acknowledged_at).toLocaleString('en-MY', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
            }) : '';
            actionHtml = `
                <div class="flex items-center justify-end gap-3">
                    <div class="flex flex-col items-end text-xs font-semibold text-slate-700">
                        <span class="text-[10px] text-slate-400 font-bold uppercase">Acknowledged by:</span>
                        <span>${teacherName}</span>
                        <span class="text-[9px] text-slate-400 font-medium">${ackDate}</span>
                    </div>
                    ${isAdmin ? `
                    <button onclick="deleteSubmission(${sub.id})" 
                            class="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer" title="Delete submission">
                        <i class="fas fa-trash"></i>
                    </button>
                    ` : ''}
                </div>
            `;
        }

        tableBody.innerHTML += `
            <tr class="hover:bg-slate-50/50 transition-colors duration-150">
                <td class="py-4 px-6 text-sm text-slate-500 font-medium">${dateStr}</td>
                <td class="py-4 px-6 text-sm font-semibold text-slate-700">
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs">
                        <i class="fas fa-location-dot text-[10px]"></i> ${location}
                    </span>
                </td>
                <td class="py-4 px-6 text-sm">${submitterText}</td>
                <td class="py-4 px-6 text-sm text-slate-600 leading-relaxed font-medium max-w-xs break-words">
                    <div>${sub.description}</div>
                    ${evidenceHtml}
                </td>
                <td class="py-4 px-6 text-sm">${statusBadge}</td>
                <td class="py-4 px-6 text-sm text-right">${actionHtml}</td>
            </tr>`;
    });

    const unreadCount = feedbackSubmissionsList.filter(sub => sub.status === 'unread').length;
    updateUnreadFeedbackBadge(unreadCount);
}

export function updateUnreadFeedbackBadge(unreadCount) {
    const badge = document.getElementById('sidebar-merit-badge');
    const dot = document.getElementById('sidebar-merit-dot');
    const dotSolid = document.getElementById('sidebar-merit-dot-solid');
    const tabBadge = document.getElementById('inbox-unread-count');
    
    if (!badge || !dot || !dotSolid || !tabBadge) return;
    
    if (unreadCount > 0) {
        tabBadge.textContent = unreadCount;
        tabBadge.classList.remove('hidden');
        
        badge.textContent = unreadCount;
        badge.classList.remove('hidden');
        
        const sidebarEl = document.getElementById('sidebar');
        const isCollapsed = sidebarEl && sidebarEl.classList.contains('w-20');
        if (isCollapsed) {
            dot.classList.remove('hidden');
            dotSolid.classList.remove('hidden');
        } else {
            dot.classList.add('hidden');
            dotSolid.classList.add('hidden');
        }
    } else {
        tabBadge.classList.add('hidden');
        badge.classList.add('hidden');
        dot.classList.add('hidden');
        dotSolid.classList.add('hidden');
    }
}

export async function acknowledgeSubmission(subId) {
    showToast('Acknowledging feedback...', 'info');
    if (state.isSimulated) {
        const sub = feedbackSubmissionsList.find(s => s.id === subId);
        if (sub) {
            sub.status = 'acknowledged';
            sub.acknowledged_by = { id: 999, full_name: state.currentUser ? state.currentUser.full_name : "Teacher", role: "TEACHER" };
            sub.acknowledged_at = new Date().toISOString();
            
            localStorage.setItem('simulated_feedback_submissions', JSON.stringify(feedbackSubmissionsList));
            showToast(`Feedback acknowledged by ${sub.acknowledged_by.full_name} at ${new Date().toLocaleTimeString('en-MY')}`, 'success');
            renderFeedbackSubmissions();
        }
    } else {
        try {
            const res = await authFetch(`${API_BASE}/merit/submissions/${subId}/acknowledge`, {
                method: 'POST'
            });
            if (res.ok) {
                const updated = await res.json();
                const teacherName = updated.acknowledged_by ? updated.acknowledged_by.full_name : 'Teacher';
                const timeStr = new Date(updated.acknowledged_at).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
                showToast(`Feedback acknowledged by ${teacherName} at ${timeStr}`, 'success');
                loadFeedbackSubmissions();
            } else {
                const data = await res.json();
                showToast(data.detail || "Failed to acknowledge submission", "error");
            }
        } catch (err) {
            console.error("Acknowledge error:", err);
            showToast("Network error during acknowledgement", "error");
        }
    }
}

export async function deleteSubmission(subId) {
    if (!confirm("Are you sure you want to delete this feedback submission? This action cannot be undone.")) {
        return;
    }
    
    showToast('Deleting feedback submission...', 'info');
    if (state.isSimulated) {
        const index = feedbackSubmissionsList.findIndex(s => s.id === subId);
        if (index !== -1) {
            feedbackSubmissionsList.splice(index, 1);
            localStorage.setItem('simulated_feedback_submissions', JSON.stringify(feedbackSubmissionsList));
            showToast("Feedback submission deleted", "success");
            renderFeedbackSubmissions();
        }
    } else {
        try {
            const res = await authFetch(`${API_BASE}/merit/submissions/${subId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                showToast("Feedback submission deleted successfully", "success");
                loadFeedbackSubmissions();
            } else {
                const data = await res.json();
                showToast(data.detail || "Failed to delete feedback submission", "error");
            }
        } catch (err) {
            console.error("Delete submission error:", err);
            showToast("Network error during deletion", "error");
        }
    }
}

export function openLightboxModal(src) {
    const modal = document.getElementById('image-lightbox-modal');
    const img = document.getElementById('lightbox-image');
    const caption = document.getElementById('lightbox-caption');
    if (modal && img) {
        img.src = src;
        if (caption) caption.textContent = src.substring(src.lastIndexOf('/') + 1);
        modal.classList.remove('hidden');
    }
}

export function closeLightboxModal() {
    const modal = document.getElementById('image-lightbox-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

export function openAwardPointsModal(studentId) {
    const student = state.studentsList.find(s => s.id === studentId);
    if (!student) return;

    const modal = document.getElementById('edit-modal');
    const content = document.getElementById('edit-modal-content');
    if (!modal || !content) return;

    let optionsHtml = '';
    meritOptionsList.forEach(opt => {
        if (opt.is_active) {
            const pointsLabel = opt.points > 0 ? `+${opt.points}` : opt.points;
            optionsHtml += `<option value="${opt.id}">${opt.name} (${pointsLabel} pts)</option>`;
        }
    });

    content.innerHTML = `
        <div class="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
                <i class="fas fa-award text-brand-teal"></i>
                Award or Reduce Points
            </h3>
            <button onclick="closeEditModal()" class="text-slate-400 hover:text-slate-600 transition-colors">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <form onsubmit="submitAwardPoints(event, ${student.id})" class="p-6 space-y-4">
            <div>
                <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Student Name</label>
                <input type="text" value="${student.full_name} (${student.student_id_number})" disabled
                    class="w-full px-4 py-2.5 bg-slate-100 rounded-xl border border-slate-200 text-sm font-medium text-slate-500 outline-none">
            </div>
            <div>
                <label for="award-option-id" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Select Action / Rule</label>
                <select id="award-option-id" required
                    class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 outline-none transition-all">
                    <option value="" disabled selected>Select option...</option>
                    ${optionsHtml}
                </select>
            </div>
            <div>
                <label for="award-justification" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Justification (Required)</label>
                <textarea id="award-justification" required rows="3" placeholder="Provide specific details about the behavior..."
                    class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 placeholder-slate-400 outline-none transition-all resize-none"></textarea>
            </div>
            <div class="flex gap-3 pt-2">
                <button type="button" onclick="closeEditModal()"
                    class="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm transition-all text-center cursor-pointer">
                    Cancel
                </button>
                <button type="submit"
                    class="flex-1 py-3 bg-brand-teal hover:bg-teal-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-brand-teal/10 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer">
                    Confirm Action
                </button>
            </div>
        </form>
    `;

    modal.classList.remove('hidden');
    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    }, 10);
}

export async function submitAwardPoints(event, studentId) {
    event.preventDefault();
    const optionId = parseInt(document.getElementById('award-option-id').value);
    const justification = document.getElementById('award-justification').value.trim();

    if (!justification) {
        showToast("Justification is required", "error");
        return;
    }

    if (state.isSimulated) {
        const student = state.studentsList.find(s => s.id === studentId);
        const opt = mockMeritOptions.find(o => o.id === optionId);
        if (!student || !opt) return;

        student.merit_points = (student.merit_points || 50) + opt.points;

        const newLog = {
            id: meritLogsList.length + 1,
            student_id: studentId,
            user_id: state.currentUser ? state.currentUser.id : 999,
            merit_option_id: optionId,
            points_changed: opt.points,
            justification: justification,
            created_at: new Date().toISOString(),
            student: student,
            user: state.currentUser || { id: 999, full_name: "Noraini Binti Abdullah", role: "TEACHER" },
            merit_option: opt
        };

        meritLogsList.unshift(newLog);
        closeEditModal();
        showToast(`Points successfully recorded (${opt.points > 0 ? '+' : ''}${opt.points} pts)`);
        updateAndRenderMeritAll();
    } else {
        try {
            const res = await authFetch(`${API_BASE}/merit/award`, {
                method: 'POST',
                body: JSON.stringify({
                    student_id: studentId,
                    option_id: optionId,
                    justification: justification
                })
            });

            if (res.ok) {
                closeEditModal();
                showToast("Points successfully awarded");
                loadMeritViewData();
            } else {
                const err = await res.json();
                showToast(err.detail || "Failed to record points", "error");
            }
        } catch (error) {
            console.error("Error submitting points:", error);
            showToast("Connection error. Failed to record points", "error");
        }
    }
}

export function openCreateMeritOptionModal() {
    const modal = document.getElementById('edit-modal');
    const content = document.getElementById('edit-modal-content');
    if (!modal || !content) return;

    content.innerHTML = `
        <div class="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
                <i class="fas fa-plus-circle text-brand-teal"></i>
                Create Merit / Discipline Rule
            </h3>
            <button onclick="closeEditModal()" class="text-slate-400 hover:text-slate-600 transition-colors">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <form onsubmit="submitCreateMeritOption(event)" class="p-6 space-y-4">
            <div>
                <label for="rule-name" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Rule Name</label>
                <input type="text" id="rule-name" placeholder="e.g. Excellent Leadership" required
                    class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 placeholder-slate-400 outline-none transition-all">
            </div>
            <div>
                <label for="rule-points" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Point Delta (positive or negative)</label>
                <input type="number" id="rule-points" placeholder="e.g. 15 or -10" required
                    class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 placeholder-slate-400 outline-none transition-all">
            </div>
            <div class="flex gap-3 pt-2">
                <button type="button" onclick="closeEditModal()"
                    class="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm transition-all text-center cursor-pointer">
                    Cancel
                </button>
                <button type="submit"
                    class="flex-1 py-3 bg-brand-teal hover:bg-teal-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-brand-teal/10 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer">
                    Create Rule
                </button>
            </div>
        </form>
    `;

    modal.classList.remove('hidden');
    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    }, 10);
}

export async function submitCreateMeritOption(event) {
    event.preventDefault();
    const name = document.getElementById('rule-name').value.trim();
    const points = parseInt(document.getElementById('rule-points').value);

    if (state.isSimulated) {
        const newOpt = {
            id: meritOptionsList.length + 1,
            name: name,
            points: points,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        meritOptionsList.push(newOpt);
        closeEditModal();
        showToast("Merit rule successfully created");
        updateAndRenderMeritAll();
    } else {
        try {
            const res = await authFetch(`${API_BASE}/merit/options`, {
                method: 'POST',
                body: JSON.stringify({ name, points })
            });

            if (res.ok) {
                closeEditModal();
                showToast("Merit rule successfully created");
                loadMeritViewData();
            } else {
                const err = await res.json();
                showToast(err.detail || "Failed to create merit rule", "error");
            }
        } catch (error) {
            console.error("Error creating rule:", error);
            showToast("Connection error. Failed to create rule", "error");
        }
    }
}

export function openEditMeritOptionModal(optionId) {
    const opt = meritOptionsList.find(o => o.id === optionId);
    if (!opt) return;

    const modal = document.getElementById('edit-modal');
    const content = document.getElementById('edit-modal-content');
    if (!modal || !content) return;

    content.innerHTML = `
        <div class="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
                <i class="fas fa-edit text-brand-teal"></i>
                Edit Merit / Discipline Rule
            </h3>
            <button onclick="closeEditModal()" class="text-slate-400 hover:text-slate-600 transition-colors">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <form onsubmit="submitEditMeritOption(event, ${opt.id})" class="p-6 space-y-4">
            <div>
                <label for="edit-rule-name" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Rule Name</label>
                <input type="text" id="edit-rule-name" value="${opt.name}" required
                    class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 placeholder-slate-400 outline-none transition-all">
            </div>
            <div>
                <label for="edit-rule-points" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Point Delta</label>
                <input type="number" id="edit-rule-points" value="${opt.points}" required
                    class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 placeholder-slate-400 outline-none transition-all">
            </div>
            <div>
                <label for="edit-rule-status" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Status</label>
                <select id="edit-rule-status" required
                    class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 outline-none transition-all">
                    <option value="true" ${opt.is_active ? 'selected' : ''}>Active</option>
                    <option value="false" ${!opt.is_active ? 'selected' : ''}>Inactive</option>
                </select>
            </div>
            <div class="flex gap-3 pt-2">
                <button type="button" onclick="closeEditModal()"
                    class="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm transition-all text-center cursor-pointer">
                    Cancel
                </button>
                <button type="submit"
                    class="flex-1 py-3 bg-brand-teal hover:bg-teal-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-brand-teal/10 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer">
                    Save Changes
                </button>
            </div>
        </form>
    `;

    modal.classList.remove('hidden');
    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    }, 10);
}

export async function submitEditMeritOption(event, optionId) {
    event.preventDefault();
    const name = document.getElementById('edit-rule-name').value.trim();
    const points = parseInt(document.getElementById('edit-rule-points').value);
    const is_active = document.getElementById('edit-rule-status').value === 'true';

    if (state.isSimulated) {
        const opt = meritOptionsList.find(o => o.id === optionId);
        if (opt) {
            opt.name = name;
            opt.points = points;
            opt.is_active = is_active;
            opt.updated_at = new Date().toISOString();
        }
        closeEditModal();
        showToast("Merit rule successfully updated");
        updateAndRenderMeritAll();
    } else {
        try {
            const res = await authFetch(`${API_BASE}/merit/options/${optionId}`, {
                method: 'PUT',
                body: JSON.stringify({ name, points, is_active })
            });

            if (res.ok) {
                closeEditModal();
                showToast("Merit rule successfully updated");
                loadMeritViewData();
            } else {
                const err = await res.json();
                showToast(err.detail || "Failed to update merit rule", "error");
            }
        } catch (error) {
            console.error("Error updating rule:", error);
            showToast("Connection error. Failed to update rule", "error");
        }
    }
}

export async function deleteMeritOption(optionId) {
    if (!confirm("Are you sure you want to delete this merit rule? This will not affect existing student point scores.")) return;

    if (state.isSimulated) {
        meritOptionsList = meritOptionsList.filter(o => o.id !== optionId);
        showToast("Merit rule deleted");
        updateAndRenderMeritAll();
    } else {
        try {
            const res = await authFetch(`${API_BASE}/merit/options/${optionId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                showToast("Merit rule deleted");
                loadMeritViewData();
            } else {
                const err = await res.json();
                showToast(err.detail || "Failed to delete merit rule", "error");
            }
        } catch (error) {
            console.error("Error deleting rule:", error);
            showToast("Connection error. Failed to delete rule", "error");
        }
    }
}

export async function deleteMeritLog(logId) {
    if (!confirm("Are you sure you want to delete this activity log? This is a permanent action and cannot be undone.")) return;

    if (state.isSimulated) {
        meritLogsList = meritLogsList.filter(l => l.id !== logId);
        showToast("Log entry deleted");
        updateAndRenderMeritAll();
    } else {
        try {
            const res = await authFetch(`${API_BASE}/merit/logs/${logId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                showToast("Log entry deleted");
                loadMeritViewData();
            } else {
                const err = await res.json();
                showToast(err.detail || "Failed to delete log entry", "error");
            }
        } catch (error) {
            console.error("Error deleting log entry:", error);
            showToast("Connection error. Failed to delete log entry", "error");
        }
    }
}

// Bind Merit Search query input
const meritStudentSearch = document.getElementById('merit-student-search');
if (meritStudentSearch) {
    meritStudentSearch.addEventListener('input', () => {
        renderMeritRoster();
    });
}

// Bind Merit Class Filter change listener
const meritClassFilter = document.getElementById('merit-class-filter');
if (meritClassFilter) {
    meritClassFilter.addEventListener('change', () => {
        renderMeritRoster();
    });
}

// Expose functions globally for legacy HTML event handlers
window.loadMeritViewData = loadMeritViewData;
window.switchMeritSubTab = switchMeritSubTab;
window.filterMeritRoster = filterMeritRoster;
window.openAwardPointsModal = openAwardPointsModal;
window.submitAwardPoints = submitAwardPoints;
window.openCreateMeritOptionModal = openCreateMeritOptionModal;
window.submitCreateMeritOption = submitCreateMeritOption;
window.openEditMeritOptionModal = openEditMeritOptionModal;
window.submitEditMeritOption = submitEditMeritOption;
window.deleteMeritOption = deleteMeritOption;
window.deleteMeritLog = deleteMeritLog;
window.deleteSubmission = deleteSubmission;
window.acknowledgeSubmission = acknowledgeSubmission;
window.loadFeedbackSubmissions = loadFeedbackSubmissions;
window.openLightboxModal = openLightboxModal;
window.closeLightboxModal = closeLightboxModal;
window.updateUnreadFeedbackBadge = updateUnreadFeedbackBadge;
