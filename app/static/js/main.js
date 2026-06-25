// EduPulse Ops — Main Entry Orchestrator Module
// Co-ordinates startup auth guard, profile matching, timelines, routing, and global views switching

import { state, authFetch, API_BASE, decodeJwtPayload, mockClassrooms, mockTeachers, mockStudents, mockSubjects, mockAssessments } from './api.js';
import { showToast, escapeHtml, formatTodayDate, formatTime12h, getCurrentTime24h, getGreeting } from './ui.js';
import { loadClassroomsData, populateTeacherDropdown } from './classrooms.js';
import { loadStudentsData, populateClassDropdowns } from './students.js';
import { loadTeachersData } from './teachers.js';
import { loadGradingData, populateGradingDropdowns, loadBatchDropdowns } from './grading.js';
import { loadSchedulesViewData, populateScheduleTargetDropdown, initSchedules } from './schedules.js';
import { loadAttendanceViewData, populateAttendanceClassDropdown, initAttendance } from './attendance.js';
import { loadMeritViewData, loadFeedbackSubmissions, renderMeritLeaderboard, initMerit } from './merit.js';
import { loadNotificationsViewData } from './notifications.js';
import { initAutomationView } from './automation.js';

document.addEventListener('DOMContentLoaded', () => {
    // =========================================================================
    // DOM REFERENCES
    // =========================================================================
    const authOverlay       = document.getElementById('auth-guard-overlay');
    const teacherNameGreet  = document.getElementById('teacher-name-greet');
    const teacherRoleBadge  = document.getElementById('teacher-role-badge');
    const logoutBtn         = document.getElementById('logout-btn');
    const todayDateText     = document.getElementById('today-date-text');
    const greetingText      = document.getElementById('greeting-text');
    const scheduleContainer = document.getElementById('schedule-timeline-container');
    const alertsContainer   = document.getElementById('alerts-list-container');
    const kpiAttendance     = document.getElementById('kpi-attendance');
    const kpiPeriods        = document.getElementById('kpi-periods');
    const kpiAlerts         = document.getElementById('kpi-alerts');
    const kpiTrend          = document.getElementById('kpi-trend');
    const kpiNextClass      = document.getElementById('kpi-next-class');
    const kpiAlertAction    = document.getElementById('kpi-alert-action');

    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // =========================================================================
    // AUTH GUARD
    // =========================================================================
    const token = localStorage.getItem('token');

    if (!token) {
        window.location.href = '/';
        return;
    }

    // Check for simulated token
    state.isSimulated = token.startsWith('simulated-jwt-token');

    // Check JWT expiration (skip for simulated tokens)
    if (!state.isSimulated) {
        const payload = decodeJwtPayload(token);
        if (!payload) {
            window.location.href = '/';
            return;
        }
        if (payload.exp && (payload.exp * 1000) < (Date.now() - 60000)) {
            console.warn('JWT token has expired. Redirecting to login.');
            localStorage.removeItem('token');
            window.location.href = '/';
            return;
        }
    }

    // =========================================================================
    // OVERLAY TRANSITION
    // =========================================================================
    function hideAuthOverlay() {
        if (!authOverlay) return;
        authOverlay.style.transition = 'opacity 0.4s ease-out';
        authOverlay.style.opacity = '0';
        setTimeout(() => {
            authOverlay.style.display = 'none';
        }, 400);
    }

    function clearSessionAndRedirect() {
        localStorage.removeItem('token');
        window.location.href = '/';
    }

    // =========================================================================
    // SKELETON LOADERS
    // =========================================================================
    function showScheduleSkeleton() {
        if (!scheduleContainer) return;
        const skeletonCount = 3;
        let html = '';
        for (let i = 0; i < skeletonCount; i++) {
            html += `
            <div class="relative animate-pulse">
                <span class="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-slate-200"></span>
                <div class="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
                    <div class="h-3 bg-slate-200 rounded w-1/3"></div>
                    <div class="h-5 bg-slate-200 rounded w-1/2"></div>
                    <div class="h-3 bg-slate-200 rounded w-2/3"></div>
                </div>
            </div>`;
        }
        scheduleContainer.innerHTML = html;
    }

    function showAlertsSkeleton() {
        if (!alertsContainer) return;
        let html = '';
        for (let i = 0; i < 2; i++) {
            html += `
            <div class="p-3 bg-slate-50 border border-slate-100 rounded-xl animate-pulse flex gap-3">
                <div class="w-4 h-4 bg-slate-200 rounded-full mt-0.5 shrink-0"></div>
                <div class="space-y-2 flex-1">
                    <div class="h-3 bg-slate-200 rounded w-2/3"></div>
                    <div class="h-2.5 bg-slate-200 rounded w-1/3"></div>
                    <div class="h-2.5 bg-slate-200 rounded w-full"></div>
                </div>
            </div>`;
        }
        alertsContainer.innerHTML = html;
    }

    // Show skeletons immediately
    showScheduleSkeleton();
    showAlertsSkeleton();

    // =========================================================================
    // DATE & GREETING
    // =========================================================================
    if (todayDateText) todayDateText.textContent = formatTodayDate();
    if (greetingText) greetingText.textContent = getGreeting();

    // =========================================================================
    // ACTIVE VIEW DATA ROUTER
    // =========================================================================
    function loadActiveViewData() {
        const hash = window.location.hash.substring(1);
        const validViews = ['dashboard', 'classrooms', 'students', 'teachers', 'attendance', 'schedules', 'grading', 'merit', 'automation'];
        let viewName = validViews.includes(hash) ? hash : 'dashboard';

        if (viewName === 'teachers' && state.currentUser && state.currentUser.role !== 'ADMIN') {
            window.location.hash = '#dashboard';
            return;
        }

        console.log(`Loading initial data for view: ${viewName}`);

        if (viewName === 'classrooms') {
            loadClassroomsData();
        } else if (viewName === 'students') {
            loadStudentsData();
        } else if (viewName === 'teachers') {
            loadTeachersData();
        } else if (viewName === 'grading') {
            loadGradingData();
        } else if (viewName === 'schedules') {
            loadSchedulesViewData();
        } else if (viewName === 'attendance') {
            loadAttendanceViewData();
        } else if (viewName === 'merit') {
            loadMeritViewData();
        } else if (viewName === 'automation') {
            initAutomationView();
        } else {
            fetchDashboardData();
        }
    }

    // =========================================================================
    // PROFILE LOADING
    // =========================================================================
    async function loadUserProfile() {
        if (state.isSimulated) {
            loadSimulatedProfile();
            return;
        }

        try {
            const response = await authFetch(`${API_BASE}/auth/me`);

            if (response.ok) {
                const user = await response.json();
                state.currentUser = user;
                populateProfile(user.full_name, user.role);

                try {
                    const teachersRes = await authFetch(`${API_BASE}/teachers/?limit=500`);
                    if (teachersRes.ok) {
                        const teachersData = await teachersRes.json();
                        state.currentTeacher = (teachersData.items || []).find(t => t.user_id === user.id);
                        if (state.currentTeacher) {
                            state.currentSchoolId = state.currentTeacher.school_id;
                            console.log("Teacher profile matched. School ID:", state.currentSchoolId);
                        }
                    }
                } catch (err) {
                    console.warn("Could not retrieve teacher record, using school_id=1:", err);
                }

                await prefetchMetadataDependencies();
                loadFeedbackSubmissions();

                hideAuthOverlay();
                loadActiveViewData();
            } else {
                console.error('Session validation failed:', response.status);
                clearSessionAndRedirect();
            }
        } catch (error) {
            console.error('Network error during profile load:', error);
            loadSimulatedProfile();
        }
    }

    async function prefetchMetadataDependencies() {
        if (state.isSimulated) {
            state.classroomsList = mockClassrooms;
            state.teachersList = mockTeachers;
            state.studentsList = mockStudents;
            state.subjectsList = mockSubjects;
            state.assessmentsList = mockAssessments;
            state.timeSlotsList = [
                { id: 1, day_of_week: 0, period_number: 1, start_time: '07:30', end_time: '08:10' },
                { id: 2, day_of_week: 0, period_number: 2, start_time: '08:10', end_time: '08:50' },
                { id: 3, day_of_week: 0, period_number: 3, start_time: '08:50', end_time: '09:30' },
                { id: 4, day_of_week: 0, period_number: 4, start_time: '09:30', end_time: '10:10' },
                { id: 5, day_of_week: 0, period_number: 5, start_time: '10:30', end_time: '11:10' }
            ];
            state.activeTimetable = { id: 999, name: "Demo Timetable", school_id: 1, term: "Term 1", is_active: true };
            populateDefaultDropdowns();
            return;
        }

        try {
            console.log("Starting prefetch of metadata dependencies...");
            const [classesRes, teachersRes, studentsRes, subjectsRes, assessmentsRes, timetablesRes, slotsRes] = await Promise.allSettled([
                authFetch(`${API_BASE}/classes/?school_id=${state.currentSchoolId}`),
                authFetch(`${API_BASE}/teachers/?limit=500`),
                authFetch(`${API_BASE}/students/?skip=0&limit=500`),
                authFetch(`${API_BASE}/grading/subjects?limit=500`),
                authFetch(`${API_BASE}/grading/assessments`),
                authFetch(`${API_BASE}/schedules/timetables?school_id=${state.currentSchoolId}`),
                authFetch(`${API_BASE}/schedules/time-slots?school_id=${state.currentSchoolId}`)
            ]);

            if (classesRes.status === 'fulfilled' && classesRes.value.ok) {
                state.classroomsList = (await classesRes.value.json()).items || [];
            } else {
                state.classroomsList = mockClassrooms;
            }

            if (teachersRes.status === 'fulfilled' && teachersRes.value.ok) {
                state.teachersList = (await teachersRes.value.json()).items || [];
            } else {
                state.teachersList = mockTeachers;
            }

            if (studentsRes.status === 'fulfilled' && studentsRes.value.ok) {
                state.studentsList = (await studentsRes.value.json()).items || [];
            } else {
                state.studentsList = mockStudents;
            }

            if (subjectsRes.status === 'fulfilled' && subjectsRes.value.ok) {
                state.subjectsList = (await subjectsRes.value.json()).items || [];
            } else {
                state.subjectsList = mockSubjects;
            }

            if (assessmentsRes.status === 'fulfilled' && assessmentsRes.value.ok) {
                state.assessmentsList = (await assessmentsRes.value.json()).items || [];
            } else {
                state.assessmentsList = mockAssessments;
            }

            if (timetablesRes.status === 'fulfilled' && timetablesRes.value.ok) {
                const timetables = (await timetablesRes.value.json()).items || [];
                state.activeTimetable = timetables.find(t => t.is_active) || timetables[0] || null;
            }

            if (slotsRes.status === 'fulfilled' && slotsRes.value.ok) {
                state.timeSlotsList = (await slotsRes.value.json()).items || [];
            }

            console.log("Prefetch completed successfully.");
        } catch (err) {
            console.warn("Error during prefetchMetadataDependencies:", err);
            state.classroomsList = state.classroomsList.length ? state.classroomsList : mockClassrooms;
            state.teachersList = state.teachersList.length ? state.teachersList : mockTeachers;
            state.studentsList = state.studentsList.length ? state.studentsList : mockStudents;
            state.subjectsList = state.subjectsList.length ? state.subjectsList : mockSubjects;
            state.assessmentsList = state.assessmentsList.length ? state.assessmentsList : mockAssessments;
        } finally {
            populateDefaultDropdowns();
        }
    }

    function populateDefaultDropdowns() {
        console.log("Populating default dropdowns...");
        try {
            populateTeacherDropdown(state.teachersList);
        } catch(e) { console.warn(e); }
        
        try {
            populateClassDropdowns(state.classroomsList);
        } catch(e) { console.warn(e); }
        
        try {
            populateGradingDropdowns(state.subjectsList, state.assessmentsList, state.studentsList);
        } catch(e) { console.warn(e); }
        
        try {
            populateAttendanceClassDropdown(state.classroomsList);
        } catch(e) { console.warn(e); }
        
        try {
            loadBatchDropdowns();
        } catch(e) { console.warn(e); }
        
        try {
            populateScheduleTargetDropdown();
        } catch(e) { console.warn(e); }
    }
    window.populateDefaultDropdowns = populateDefaultDropdowns;

    function populateProfile(name, role) {
        console.log("Populating profile for:", name, "Role:", role);
        if (teacherNameGreet) {
            teacherNameGreet.textContent = `${getGreeting()}, Cikgu ${name}`;
        }
        if (teacherRoleBadge) {
            teacherRoleBadge.textContent = role;
            if (role === 'ADMIN') {
                teacherRoleBadge.className = 'text-[10px] text-amber-400 font-bold uppercase tracking-wider';
            } else {
                teacherRoleBadge.className = 'text-[10px] text-brand-teal font-medium uppercase tracking-wider';
            }
        }

        const sidebarUserName = document.getElementById('sidebar-user-name');
        const sidebarUserRole = document.getElementById('sidebar-user-role');
        if (sidebarUserName) sidebarUserName.textContent = `Cikgu ${name.split(' ')[0]}`;
        if (sidebarUserRole) sidebarUserRole.textContent = role;

        if (role === 'ADMIN') {
            const teachersLink = document.getElementById('sidebar-teachers-link');
            if (teachersLink) {
                console.log("Revealing Teachers sidebar link...");
                teachersLink.classList.remove('hidden');
            }
            document.querySelectorAll('.admin-action-header').forEach(el => el.classList.remove('hidden'));
        }
    }

    function loadSimulatedProfile() {
        let email = 'teacher@edupulse.local';
        if (token.includes('-for-')) email = token.split('-for-')[1];
        const name = email.split('@')[0].replace(/^\w/, c => c.toUpperCase());
        const role = email.toLowerCase().includes('admin') ? 'ADMIN' : 'TEACHER';
        state.currentUser = { id: 999, email: email, full_name: name, role: role, is_active: true };
        populateProfile(name + ' (Demo)', role);
        
        state.classroomsList = mockClassrooms;
        state.teachersList = mockTeachers;
        state.studentsList = mockStudents;
        state.subjectsList = mockSubjects;
        state.assessmentsList = mockAssessments;
        state.timeSlotsList = [
            { id: 1, day_of_week: 0, period_number: 1, start_time: '07:30', end_time: '08:10' },
            { id: 2, day_of_week: 0, period_number: 2, start_time: '08:10', end_time: '08:50' },
            { id: 3, day_of_week: 0, period_number: 3, start_time: '08:50', end_time: '09:30' },
            { id: 4, day_of_week: 0, period_number: 4, start_time: '09:30', end_time: '10:10' },
            { id: 5, day_of_week: 0, period_number: 5, start_time: '10:30', end_time: '11:10' }
        ];
        state.activeTimetable = { id: 999, name: "Demo Timetable", school_id: 1, term: "Term 1", is_active: true };
        populateDefaultDropdowns();

        setTimeout(hideAuthOverlay, 400);
        renderDemoSchedule();
        renderDemoAlerts();
        loadFeedbackSubmissions();
        loadActiveViewData();
    }

    // =========================================================================
    // SIDEBAR & DRAWER MANAGEMENT
    // =========================================================================
    function initSidebar() {
        const sidebar = document.getElementById('sidebar-nav');
        const backdrop = document.getElementById('sidebar-backdrop');
        const mobileToggle = document.getElementById('sidebar-mobile-toggle');
        const collapseBtn = document.getElementById('sidebar-collapse-btn');
        const collapseIcon = document.getElementById('sidebar-collapse-icon');

        if (!sidebar) return;

        if (mobileToggle) {
            mobileToggle.addEventListener('click', () => {
                sidebar.classList.remove('-translate-x-full');
                if (backdrop) {
                    backdrop.classList.remove('hidden');
                    setTimeout(() => {
                        backdrop.classList.remove('opacity-0');
                        backdrop.classList.add('opacity-100');
                    }, 50);
                }
            });
        }

        if (backdrop) {
            backdrop.addEventListener('click', closeMobileSidebar);
        }

        function closeMobileSidebar() {
            sidebar.classList.add('-translate-x-full');
            if (backdrop) {
                backdrop.classList.remove('opacity-100');
                backdrop.classList.add('opacity-0');
                setTimeout(() => {
                    backdrop.classList.add('hidden');
                }, 300);
            }
        }

        if (collapseBtn) {
            const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
            if (isCollapsed) {
                setSidebarCollapsedState(true);
            }

            collapseBtn.addEventListener('click', () => {
                const nowCollapsed = !sidebar.classList.contains('w-20');
                setSidebarCollapsedState(nowCollapsed);
                localStorage.setItem('sidebarCollapsed', nowCollapsed ? 'true' : 'false');
            });
        }

        function setSidebarCollapsedState(collapse) {
            const meritBadge = document.getElementById('sidebar-merit-badge');
            const hasUnread = meritBadge && !meritBadge.classList.contains('hidden');
            
            if (collapse) {
                sidebar.classList.remove('w-64');
                sidebar.classList.add('w-20');
                document.querySelectorAll('.sidebar-label').forEach(el => el.classList.add('hidden'));
                if (collapseIcon) {
                    collapseIcon.classList.remove('fa-chevron-left');
                    collapseIcon.classList.add('fa-chevron-right');
                }
                if (hasUnread) {
                    const dot = document.getElementById('sidebar-merit-dot');
                    const dotSolid = document.getElementById('sidebar-merit-dot-solid');
                    if (dot) dot.classList.remove('hidden');
                    if (dotSolid) dotSolid.classList.remove('hidden');
                }
            } else {
                sidebar.classList.remove('w-20');
                sidebar.classList.add('w-64');
                document.querySelectorAll('.sidebar-label').forEach(el => el.classList.remove('hidden'));
                if (collapseIcon) {
                    collapseIcon.classList.remove('fa-chevron-right');
                    collapseIcon.classList.add('fa-chevron-left');
                }
                const dot = document.getElementById('sidebar-merit-dot');
                const dotSolid = document.getElementById('sidebar-merit-dot-solid');
                if (dot) dot.classList.add('hidden');
                if (dotSolid) dotSolid.classList.add('hidden');
            }
        }

        document.querySelectorAll('.sidebar-link').forEach(link => {
            link.addEventListener('click', () => {
                closeMobileSidebar();
            });
        });

        handleHashRoute();
        window.addEventListener('hashchange', handleHashRoute);
    }

    function handleHashRoute() {
        const hash = window.location.hash.substring(1);
        const validViews = ['dashboard', 'classrooms', 'students', 'teachers', 'attendance', 'schedules', 'grading', 'merit', 'automation', 'notifications'];
        let viewName = hash;

        if (!validViews.includes(viewName)) {
            viewName = 'dashboard';
            if (window.location.hash !== '#dashboard') {
                window.location.hash = '#dashboard';
                return;
            }
        }

        if (viewName === 'teachers' && state.currentUser && state.currentUser.role !== 'ADMIN') {
            window.location.hash = '#dashboard';
            return;
        }

        document.querySelectorAll('.sidebar-link').forEach(link => {
            const linkView = link.getAttribute('data-view');
            if (linkView === viewName) {
                link.classList.add('active', 'bg-brand-teal', 'text-white', 'shadow-md', 'shadow-brand-teal/20');
                link.classList.remove('text-slate-400', 'hover:bg-slate-800/60', 'hover:text-white');
            } else {
                link.classList.remove('active', 'bg-brand-teal', 'text-white', 'shadow-md', 'shadow-brand-teal/20');
                link.classList.add('text-slate-400', 'hover:bg-slate-800/60', 'hover:text-white');
            }
        });

        switchView(viewName);
    }

    function switchView(viewName) {
        const views = ['dashboard', 'classrooms', 'students', 'teachers', 'attendance', 'schedules', 'grading', 'merit', 'automation', 'notifications'];
        views.forEach(v => {
            const viewEl = document.getElementById(`view-${v}`);
            if (viewEl) {
                if (v === viewName) {
                    viewEl.classList.remove('hidden');
                    viewEl.classList.add('fade-in-slide');
                } else {
                    viewEl.classList.add('hidden');
                    viewEl.classList.remove('fade-in-slide');
                }
            }
        });

        if (viewName === 'classrooms') {
            loadClassroomsData();
        } else if (viewName === 'students') {
            loadStudentsData();
        } else if (viewName === 'teachers') {
            loadTeachersData();
        } else if (viewName === 'grading') {
            loadGradingData();
        } else if (viewName === 'schedules') {
            loadSchedulesViewData();
        } else if (viewName === 'attendance') {
            loadAttendanceViewData();
        } else if (viewName === 'merit') {
            loadMeritViewData();
        } else if (viewName === 'automation') {
            initAutomationView();
        } else if (viewName === 'notifications') {
            loadNotificationsViewData();
        } else if (viewName === 'dashboard') {
            fetchDashboardData();
        }

        const mobileSaveBar = document.getElementById('attendance-mobile-save-bar');
        if (mobileSaveBar) {
            const rosterCard = document.getElementById('attendance-roster-card');
            if (viewName === 'attendance' && rosterCard && !rosterCard.classList.contains('hidden')) {
                mobileSaveBar.classList.remove('hidden');
            } else {
                mobileSaveBar.classList.add('hidden');
            }
        }
    }

    async function fetchDashboardData() {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const dbDayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

        try {
            const [slotsRes, studentsRes, schoolsRes] = await Promise.allSettled([
                authFetch(`${API_BASE}/schedules/time-slots?school_id=${state.currentSchoolId}`),
                authFetch(`${API_BASE}/students/?skip=0&limit=200`),
                authFetch(`${API_BASE}/schools/`)
            ]);

            if (slotsRes.status === 'fulfilled' && slotsRes.value.ok) {
                const slotsData = await slotsRes.value.json();
                const todaySlots = (slotsData.items || [])
                    .filter(slot => slot.day_of_week === dbDayOfWeek)
                    .sort((a, b) => a.period_number - b.period_number);

                if (todaySlots.length > 0) {
                    renderScheduleTimeline(todaySlots);
                    updateKpiPeriods(todaySlots);
                } else {
                    renderEmptySchedule();
                }
            } else {
                renderDemoSchedule();
            }

            if (studentsRes.status === 'fulfilled' && studentsRes.value.ok) {
                const studentData = await studentsRes.value.json();
                const totalStudents = studentData.total || 0;
                const activeStudents = (studentData.items || []).filter(s => s.is_active).length;
                const attendanceRate = totalStudents > 0
                    ? Math.min(99.5, 85 + (activeStudents / totalStudents) * 15).toFixed(1)
                    : '---';
                if (kpiAttendance) kpiAttendance.textContent = `${attendanceRate}%`;
                
                renderMeritLeaderboard(studentData.items || []);
            } else {
                renderMeritLeaderboard(mockStudents);
            }

            renderDemoAlerts();

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            renderDemoSchedule();
            renderDemoAlerts();
            renderMeritLeaderboard(mockStudents);
        }
    }

    function renderScheduleTimeline(slots) {
        if (!scheduleContainer) return;
        const currentTime = getCurrentTime24h();

        let html = '';
        slots.forEach((slot, index) => {
            const isActive = currentTime >= slot.start_time && currentTime < slot.end_time;
            const isPast = currentTime >= slot.end_time;
            const isNext = !isPast && !isActive && index === slots.findIndex(s => getCurrentTime24h() < s.start_time);

            const nodeColor = isActive ? 'bg-brand-teal ring-4 ring-brand-teal/10' : isPast ? 'bg-slate-300' : 'bg-slate-300';
            const cardBg = isActive
                ? 'bg-brand-accent/40 border-brand-teal/20'
                : 'bg-slate-50 border-slate-200/60 hover:bg-slate-100/50 transition-colors duration-150';

            const periodLabel = isActive
                ? `Period ${slot.period_number} &bull; Active Now`
                : isNext
                    ? `Period ${slot.period_number} &bull; Up Next`
                    : isPast
                        ? `Period ${slot.period_number} &bull; Completed`
                        : `Period ${slot.period_number}`;

            const badge = isActive
                ? '<span class="px-1.5 py-0.5 bg-brand-teal text-white text-[9px] font-bold rounded">IN PROGRESS</span>'
                : isNext
                    ? '<span class="px-1.5 py-0.5 bg-slate-700 text-white text-[9px] font-bold rounded">NEXT</span>'
                    : isPast
                        ? '<span class="px-1.5 py-0.5 bg-slate-300 text-slate-600 text-[9px] font-bold rounded">DONE</span>'
                        : '';

            const labelColor = isActive ? 'text-brand-teal' : 'text-slate-400';
            const timeColor = isActive ? 'text-slate-800' : 'text-slate-700';
            const opacity = isPast ? 'opacity-60' : '';

            html += `
            <div class="relative ${opacity}">
                <span class="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-4 border-white ${nodeColor} shadow-sm"></span>
                <div class="flex flex-col md:flex-row md:items-center justify-between p-4 ${cardBg} border rounded-2xl gap-3">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-semibold ${labelColor} uppercase tracking-wider">${periodLabel}</span>
                            ${badge}
                        </div>
                        <h4 class="text-lg font-bold text-slate-900 mt-0.5">School Period ${slot.period_number}</h4>
                        <p class="text-xs text-slate-500 mt-0.5">
                            Time Slot: <span class="font-medium text-slate-700">${formatTime12h(slot.start_time)} - ${formatTime12h(slot.end_time)}</span>
                            &bull; Day: <span class="font-medium text-slate-700">${DAY_NAMES[slot.day_of_week + 1] || 'Today'}</span>
                        </p>
                    </div>
                    <div class="text-left md:text-right shrink-0">
                        <span class="text-sm font-bold ${timeColor} block">${formatTime12h(slot.start_time)} - ${formatTime12h(slot.end_time)}</span>
                        <span class="text-xs text-slate-400 block mt-0.5">${calculateDuration(slot.start_time, slot.end_time)} mins</span>
                    </div>
                </div>
            </div>`;
        });

        scheduleContainer.innerHTML = html;
    }

    function calculateDuration(start, end) {
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        return (eh * 60 + em) - (sh * 60 + sm);
    }

    function updateKpiPeriods(slots) {
        const count = slots.length;
        if (kpiPeriods) kpiPeriods.textContent = `${count} Period${count !== 1 ? 's' : ''}`;

        const currentTime = getCurrentTime24h();
        const nextSlot = slots.find(s => currentTime < s.start_time);
        if (kpiNextClass && nextSlot) {
            const [nh, nm] = nextSlot.start_time.split(':').map(Number);
            const now = new Date();
            const nextMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), nh, nm).getTime();
            const diffMins = Math.round((nextMs - now.getTime()) / 60000);
            kpiNextClass.textContent = diffMins > 0 ? `Next class in ${diffMins} min${diffMins !== 1 ? 's' : ''}` : 'Starting soon';
        } else if (kpiNextClass) {
            kpiNextClass.textContent = 'No more classes today';
        }
    }

    function renderEmptySchedule() {
        if (!scheduleContainer) return;
        scheduleContainer.innerHTML = `
        <div class="text-center py-12">
            <div class="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-2xl mb-4">
                <i class="fas fa-calendar-check text-2xl text-slate-400"></i>
            </div>
            <h4 class="text-base font-semibold text-slate-700">No classes scheduled today</h4>
            <p class="text-sm text-slate-400 mt-1">Enjoy your free day, or check tomorrow's schedule.</p>
        </div>`;
        if (kpiPeriods) kpiPeriods.textContent = '0 Periods';
        if (kpiNextClass) kpiNextClass.textContent = 'Free day!';
    }

    function renderDemoSchedule() {
        const demoSlots = [
            { period: 2, className: '3 Cempaka', subject: 'Mathematics', start: '08:10', end: '08:50', active: true },
            { period: 3, className: '5 Dahlia', subject: 'Add Mathematics', start: '08:50', end: '09:30', next: true },
            { period: 5, className: '3 Cempaka', subject: 'Mathematics', start: '10:10', end: '10:50' },
            { period: 7, className: '4 Anggerik', subject: 'Mathematics', start: '11:30', end: '12:10' },
        ];

        if (!scheduleContainer) return;
        let html = '';
        demoSlots.forEach(slot => {
            const nodeColor = slot.active ? 'bg-brand-teal ring-4 ring-brand-teal/10' : slot.next ? 'bg-slate-700 ring-4 ring-slate-700/10' : 'bg-slate-350';
            const cardBg = slot.active ? 'bg-brand-accent border-brand-teal/20' : slot.next ? 'bg-slate-50 border-slate-700/20' : 'bg-slate-50 border-slate-200/60';
            const labelColor = slot.active ? 'text-brand-teal' : 'text-slate-400';
            const label = slot.active ? `Period ${slot.period} &bull; Active Now` : slot.next ? `Period ${slot.period} &bull; Up Next` : `Period ${slot.period}`;
            const badge = slot.active
                ? '<span class="px-1.5 py-0.5 bg-brand-teal text-white text-[9px] font-bold rounded">IN PROGRESS</span>'
                : slot.next
                    ? '<span class="px-1.5 py-0.5 bg-slate-700 text-white text-[9px] font-bold rounded">NEXT</span>'
                    : '';

            html += `
            <div class="relative">
                <span class="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-4 border-white ${nodeColor} shadow-sm"></span>
                <div class="flex flex-col md:flex-row md:items-center justify-between p-4 ${cardBg} border rounded-2xl gap-3">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-semibold ${labelColor} uppercase tracking-wider">${label}</span>
                            ${badge}
                        </div>
                        <h4 class="text-lg font-bold text-slate-900 mt-0.5">${slot.className}</h4>
                        <p class="text-xs text-slate-500 mt-0.5">
                            Subject: <span class="font-medium text-slate-700">${slot.subject}</span>
                        </p>
                    </div>
                    <div class="text-left md:text-right shrink-0">
                        <span class="text-sm font-bold text-slate-800 block">${formatTime12h(slot.start)} - ${formatTime12h(slot.end)}</span>
                        <span class="text-xs text-slate-400 block mt-0.5">${calculateDuration(slot.start, slot.end)} mins</span>
                    </div>
                </div>
            </div>`;
        });

        scheduleContainer.innerHTML = html;
        if (kpiPeriods) kpiPeriods.textContent = '4 Periods';
        if (kpiNextClass) kpiNextClass.textContent = 'Next class in 15 mins';
    }

    function renderDemoAlerts() {
        if (!alertsContainer) return;
        const alerts = [
            { severity: 'critical', name: 'Muhammad Ali Bin Hassan', cls: '3 Cempaka', msg: 'Absent for 3 consecutive days. Attendance dropped to 68% this month.' },
            { severity: 'warning', name: 'Siti Aminah Binti Yusof', cls: '5 Dahlia', msg: '15% grade drop in Add Mathematics test. Correlates with recent sick leave.' },
            { severity: 'warning', name: 'Lim Wei Seng', cls: '4 Anggerik', msg: 'Arrived late 4 times in the past 2 weeks. Check-in logs show average 20m delay.' },
        ];

        let html = '';
        alerts.forEach(alert => {
            const isCritical = alert.severity === 'critical';
            const bg = isCritical ? 'bg-rose-50 border-rose-100' : 'bg-amber-50 border-amber-100';
            const iconColor = isCritical ? 'text-rose-500' : 'text-amber-500';
            const icon = isCritical ? 'fa-circle-exclamation' : 'fa-triangle-exclamation';
            const nameColor = isCritical ? 'text-rose-950' : 'text-amber-950';
            const clsColor = isCritical ? 'text-rose-800' : 'text-amber-800';
            const msgColor = isCritical ? 'text-rose-600/90' : 'text-amber-600/90';

            html += `
            <div class="p-3 ${bg} border rounded-xl flex gap-3">
                <span class="${iconColor} mt-0.5 shrink-0"><i class="fas ${icon} text-sm"></i></span>
                <div class="min-w-0">
                    <h4 class="text-xs font-bold ${nameColor}">${alert.name}</h4>
                    <p class="text-[11px] ${clsColor} font-medium">Class: ${alert.cls}</p>
                    <p class="text-[10px] ${msgColor} mt-1">${alert.msg}</p>
                </div>
            </div>`;
        });

        alertsContainer.innerHTML = html;

        if (kpiAlerts) kpiAlerts.textContent = `${alerts.length} Warning${alerts.length !== 1 ? 's' : ''}`;
        if (kpiAlertAction) {
            const critCount = alerts.filter(a => a.severity === 'critical').length;
            kpiAlertAction.textContent = critCount > 0 ? `${critCount} urgent action${critCount !== 1 ? 's' : ''} needed` : 'All under control';
        }
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logoutBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> <span>Signing out...</span>';
            logoutBtn.disabled = true;
            setTimeout(clearSessionAndRedirect, 600);
        });
    }

    // =========================================================================
    // INIT ALL CONTROLLERS & MODULES
    // =========================================================================
    initSidebar();
    initGrading();
    initSchedules();
    initAttendance();
    initMerit();
    initAutomationView();
    loadUserProfile();
});
