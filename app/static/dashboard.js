/**
 * EduPulse Ops — Teacher Dashboard Controller
 * Manages authentication guard, profile loading, live data fetching,
 * dynamic schedule rendering, session lifecycle, sidebar navigation,
 * and forms for classroom and student operations.
 */
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

    // =========================================================================
    // STATE VARIABLES
    // =========================================================================
    let currentUser = null;
    let currentTeacher = null;
    let currentSchoolId = 1; // Default fallback school
    let classroomsList = []; // Cached classrooms
    let teachersList = []; // Cached teachers
    let studentsList = []; // Cached students
    let assessmentsList = []; // Cached assessments
    let subjectsList = []; // Cached subjects
    let attendanceMode = 'daily'; // 'daily' or 'period'
    let currentAttendanceSession = null;
    let attendanceRoster = [];
    let timeSlotsList = [];
    let activeTimetable = null;
    let scheduleEntriesList = [];
    let pendingClassroomFilterId = null;


    // =========================================================================
    // CONSTANTS
    // =========================================================================
    const API_BASE = '/api/v1';
    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // =========================================================================
    // MOCK DATA FOR SIMULATED/DEMO MODE
    // =========================================================================
    const mockClassrooms = [
        { id: 1, name: '3 Cempaka', grade_level: 3, form_teacher_id: 1, capacity: 35, students: [1, 2, 3] },
        { id: 2, name: '5 Dahlia', grade_level: 5, form_teacher_id: 2, capacity: 40, students: [4, 5] },
        { id: 3, name: '4 Anggerik', grade_level: 4, form_teacher_id: 3, capacity: 38, students: [6] }
    ];

    const mockTeachers = [
        { id: 1, full_name: 'Noraini Binti Abdullah', employee_id: 'T8002', email: 'noraini@school.edu.my', contact_number: '+6012-3456789', emergency_contact: 'Husband: +6012-9876543', is_active: true },
        { id: 2, full_name: 'Zulkifli Bin Salleh', employee_id: 'T8005', email: 'zulkifli@school.edu.my', contact_number: '+6019-8765432', emergency_contact: 'Wife: +6019-1234567', is_active: true },
        { id: 3, full_name: 'Lim Kok Wing', employee_id: 'T8006', email: 'limkw@school.edu.my', contact_number: '+6017-1122334', emergency_contact: 'Son: +6017-4433221', is_active: true }
    ];

    const mockStudents = [
        { id: 1, student_id_number: 'S2001', full_name: 'Muhammad Ali Bin Hassan', class_id: 1, school_id: 1, is_active: true, father_contact: '+6012-3456789', mother_contact: '+6019-8765432', guardian_contact: '', residential_address: 'No. 5, Jalan Melawati 1, Kuala Lumpur', gender: 'MALE', identity_card_number: '120101-14-1111', birth_date: '2012-01-01', enroll_date: '2024-01-15' },
        { id: 2, student_id_number: 'S2002', full_name: 'Lim Wei Seng', class_id: 1, school_id: 1, is_active: true, father_contact: '+6011-2223334', mother_contact: '+6011-4445556', guardian_contact: '', residential_address: 'Flat PKNS, Ampang, Selangor', gender: 'MALE', identity_card_number: '120202-10-2222', birth_date: '2012-02-02', enroll_date: '2024-01-15' },
        { id: 3, student_id_number: 'S2003', full_name: 'Fatimah Binti Mahmud', class_id: 1, school_id: 1, is_active: true, father_contact: '+6013-4455667', mother_contact: '+6014-9988776', guardian_contact: '', residential_address: 'No. 22, Lorong Melati, Gombak', gender: 'FEMALE', identity_card_number: '120303-14-3333', birth_date: '2012-03-03', enroll_date: '2024-01-15' },
        { id: 4, student_id_number: 'S2004', full_name: 'Siti Aminah Binti Yusof', class_id: 2, school_id: 1, is_active: true, father_contact: '', mother_contact: '', guardian_contact: '+6016-5544332', residential_address: 'Kondominium Gaya, Melawati', gender: 'FEMALE', identity_card_number: '100404-14-4444', birth_date: '2010-04-04', enroll_date: '2022-01-10' },
        { id: 5, student_id_number: 'S2005', full_name: 'Ramu A/L Ganesan', class_id: 2, school_id: 1, is_active: true, father_contact: '+6012-7778889', mother_contact: '', guardian_contact: '', residential_address: 'Taman Permata, Ulu Kelang', gender: 'MALE', identity_card_number: '100505-08-5555', birth_date: '2010-05-05', enroll_date: '2022-01-10' },
        { id: 6, student_id_number: 'S2006', full_name: 'Tan Mei Ling', class_id: 3, school_id: 1, is_active: true, father_contact: '+6018-9990001', mother_contact: '+6018-1112223', guardian_contact: '', residential_address: 'No. 88, Jalan Permata 3, Melawati', gender: 'FEMALE', identity_card_number: '110606-14-6666', birth_date: '2011-06-06', enroll_date: '2023-01-12' }
    ];

    const mockSubjects = [
        { id: 1, name: 'Mathematics', code: 'MAT101', school_id: 1 },
        { id: 2, name: 'Science', code: 'SCI101', school_id: 1 },
        { id: 3, name: 'English', code: 'ENG101', school_id: 1 }
    ];

    const mockAssessments = [
        {
            id: 1,
            title: 'OMR Science Chapter 1 Test',
            subject_id: 2,
            teacher_id: 1,
            grading_type: 'OMR',
            config: '{"1": "A", "2": "B", "3": "C", "4": "D", "5": "A"}',
            max_points: 50,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        },
        {
            id: 2,
            title: 'Math Algebra Equation Quiz',
            subject_id: 1,
            teacher_id: 1,
            grading_type: 'MATH',
            config: 'x = 5',
            max_points: 100,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }
    ];

    const mockGrades = [
        {
            id: 1,
            student_id: 1,
            assessment_id: 1,
            student_response: '{"1": "A", "2": "B", "3": "C", "4": "D", "5": "A"}',
            score: 50.0,
            status: 'COMPLETED',
            feedback: '{"message": "Graded successfully. Score: 5/5 (100.0%)", "breakdown": {"1": {"expected": "A", "student": "A", "correct": true}, "2": {"expected": "B", "student": "B", "correct": true}, "3": {"expected": "C", "student": "C", "correct": true}, "4": {"expected": "D", "student": "D", "correct": true}, "5": {"expected": "A", "student": "A", "correct": true}}, "correct_count": 5, "incorrect_count": 0, "total_questions": 5}',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }
    ];

    const mockAttendanceSessions = [
        {
            id: 1,
            class_id: 1,
            date: new Date().toISOString().split('T')[0],
            time_slot_id: null,
            recorded_by_id: 1,
            method: 'MANUAL',
            created_at: new Date().toISOString(),
            records: [
                { id: 1, session_id: 1, student_id: 1, status: 'PRESENT', notes: '' },
                { id: 2, session_id: 1, student_id: 2, status: 'LATE', notes: 'Bus breakdown' },
                { id: 3, session_id: 1, student_id: 3, status: 'ABSENT', notes: 'No parent notice' }
            ]
        }
    ];

    // =========================================================================
    // UTILITIES
    // =========================================================================

    /** Get a time-aware greeting string */
    function getGreeting() {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        return 'Good evening';
    }

    /** Format today's date for the badge */
    function formatTodayDate() {
        const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
        return new Date().toLocaleDateString('en-MY', options);
    }

    /** Create an authorized fetch wrapper */
    function authFetch(url, options = {}) {
        const token = localStorage.getItem('token');
        const headers = {
            'Authorization': `Bearer ${token}`,
            ...(options.headers || {})
        };
        // Do not set Content-Type if options.body is FormData, allowing browser to set boundary
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }
        return fetch(url, {
            ...options,
            headers: headers
        });
    }

    /** Decode JWT payload without a library (base64url) */
    function decodeJwtPayload(token) {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return null;
            const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            return JSON.parse(atob(payload));
        } catch { return null; }
    }

    /** Check if a JWT token is expired (with 60s buffer) */
    function isTokenExpired(token) {
        const payload = decodeJwtPayload(token);
        if (!payload || !payload.exp) return false; // No exp claim = assume valid
        return (payload.exp * 1000) < (Date.now() - 60000);
    }

    /** Convert "HH:MM" 24h string to 12h AM/PM display */
    function formatTime12h(timeStr) {
        if (!timeStr) return '';
        const [h, m] = timeStr.split(':').map(Number);
        const period = h >= 12 ? 'PM' : 'AM';
        const hour12 = h % 12 || 12;
        return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
    }

    /** Get current time as "HH:MM" in 24h format */
    function getCurrentTime24h() {
        const now = new Date();
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }

    /** Display elegant toast notifications */
    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast-slide-in flex items-center gap-3 px-4 py-3 bg-white text-slate-800 rounded-xl shadow-lg border border-slate-100 max-w-sm pointer-events-auto transition-all duration-300`;
        
        const iconBg = type === 'success' ? 'bg-teal-50 text-brand-teal' : 'bg-rose-50 text-rose-500';
        const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
        
        toast.innerHTML = `
            <div class="p-2 rounded-lg ${iconBg} shrink-0">
                <i class="fas ${icon} text-sm"></i>
            </div>
            <div class="flex-1 text-xs font-semibold pr-2">${message}</div>
            <button class="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer text-xs" onclick="this.parentElement.remove()">
                <i class="fas fa-xmark"></i>
            </button>
        `;

        container.appendChild(toast);

        // Auto-remove after 4 seconds
        setTimeout(() => {
            toast.classList.remove('toast-slide-in');
            toast.classList.add('toast-slide-out');
            setTimeout(() => {
                toast.remove();
            }, 250);
        }, 4000);
    }

    // =========================================================================
    // AUTH GUARD
    // =========================================================================
    const token = localStorage.getItem('token');

    if (!token) {
        window.location.href = '/';
        return;
    }

    // Check for simulated token
    let isSimulated = token.startsWith('simulated-jwt-token');

    // Check JWT expiration (skip for simulated tokens)
    if (!isSimulated && isTokenExpired(token)) {
        console.warn('JWT token has expired. Redirecting to login.');
        localStorage.removeItem('token');
        window.location.href = '/';
        return;
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

    /** Render skeleton placeholders inside a container */
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

        // Role-based route guard for non-admin users trying to access teachers view
        if (viewName === 'teachers' && currentUser && currentUser.role !== 'ADMIN') {
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
        if (isSimulated) {
            loadSimulatedProfile();
            return;
        }

        try {
            const response = await authFetch(`${API_BASE}/auth/me`);

            if (response.ok) {
                const user = await response.json();
                currentUser = user;
                populateProfile(user.full_name, user.role);

                // Fetch details of teachers to find associated school
                try {
                    const teachersRes = await authFetch(`${API_BASE}/teachers/?limit=500`);
                    if (teachersRes.ok) {
                        const teachersData = await teachersRes.json();
                        currentTeacher = (teachersData.items || []).find(t => t.user_id === user.id);
                        if (currentTeacher) {
                            currentSchoolId = currentTeacher.school_id;
                            console.log("Teacher profile matched. School ID:", currentSchoolId);
                        }
                    }
                } catch (err) {
                    console.warn("Could not retrieve teacher record, using school_id=1:", err);
                }

                // Prefetch all metadata dependencies concurrently before hiding overlay
                await prefetchMetadataDependencies();

                hideAuthOverlay();
                // Fetch dynamic data for active view
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
        if (isSimulated) {
            classroomsList = mockClassrooms;
            teachersList = mockTeachers;
            studentsList = mockStudents;
            subjectsList = mockSubjects;
            assessmentsList = mockAssessments;
            timeSlotsList = [
                { id: 1, day_of_week: 0, period_number: 1, start_time: '07:30', end_time: '08:10' },
                { id: 2, day_of_week: 0, period_number: 2, start_time: '08:10', end_time: '08:50' },
                { id: 3, day_of_week: 0, period_number: 3, start_time: '08:50', end_time: '09:30' },
                { id: 4, day_of_week: 0, period_number: 4, start_time: '09:30', end_time: '10:10' },
                { id: 5, day_of_week: 0, period_number: 5, start_time: '10:30', end_time: '11:10' }
            ];
            activeTimetable = { id: 999, name: "Demo Timetable", school_id: 1, term: "Term 1", is_active: true };
            populateDefaultDropdowns();
            return;
        }

        try {
            console.log("Starting prefetch of metadata dependencies...");
            const [classesRes, teachersRes, studentsRes, subjectsRes, assessmentsRes, timetablesRes, slotsRes] = await Promise.allSettled([
                authFetch(`${API_BASE}/classes/?school_id=${currentSchoolId}`),
                authFetch(`${API_BASE}/teachers/?limit=500`),
                authFetch(`${API_BASE}/students/?skip=0&limit=500`),
                authFetch(`${API_BASE}/grading/subjects?limit=500`),
                authFetch(`${API_BASE}/grading/assessments`),
                authFetch(`${API_BASE}/schedules/timetables?school_id=${currentSchoolId}`),
                authFetch(`${API_BASE}/schedules/time-slots?school_id=${currentSchoolId}`)
            ]);

            if (classesRes.status === 'fulfilled' && classesRes.value.ok) {
                classroomsList = (await classesRes.value.json()).items || [];
            } else {
                console.warn("Prefetch classes failed, using mock fallback.");
                classroomsList = mockClassrooms;
            }

            if (teachersRes.status === 'fulfilled' && teachersRes.value.ok) {
                teachersList = (await teachersRes.value.json()).items || [];
            } else {
                teachersList = mockTeachers;
            }

            if (studentsRes.status === 'fulfilled' && studentsRes.value.ok) {
                studentsList = (await studentsRes.value.json()).items || [];
            } else {
                studentsList = mockStudents;
            }

            if (subjectsRes.status === 'fulfilled' && subjectsRes.value.ok) {
                subjectsList = (await subjectsRes.value.json()).items || [];
            } else {
                subjectsList = mockSubjects;
            }

            if (assessmentsRes.status === 'fulfilled' && assessmentsRes.value.ok) {
                assessmentsList = (await assessmentsRes.value.json()).items || [];
            } else {
                assessmentsList = mockAssessments;
            }

            if (timetablesRes.status === 'fulfilled' && timetablesRes.value.ok) {
                const timetables = (await timetablesRes.value.json()).items || [];
                activeTimetable = timetables.find(t => t.is_active) || timetables[0] || null;
            }

            if (slotsRes.status === 'fulfilled' && slotsRes.value.ok) {
                timeSlotsList = (await slotsRes.value.json()).items || [];
            }

            console.log("Prefetch completed successfully.");
        } catch (err) {
            console.warn("Error during prefetchMetadataDependencies:", err);
            classroomsList = classroomsList.length ? classroomsList : mockClassrooms;
            teachersList = teachersList.length ? teachersList : mockTeachers;
            studentsList = studentsList.length ? studentsList : mockStudents;
            subjectsList = subjectsList.length ? subjectsList : mockSubjects;
            assessmentsList = assessmentsList.length ? assessmentsList : mockAssessments;
        } finally {
            populateDefaultDropdowns();
        }
    }

    function populateDefaultDropdowns() {
        console.log("Populating default dropdowns...");
        try {
            populateTeacherDropdown(teachersList);
        } catch(e) { console.warn(e); }
        
        try {
            populateClassDropdowns(classroomsList);
        } catch(e) { console.warn(e); }
        
        try {
            populateGradingDropdowns(subjectsList, assessmentsList, studentsList);
        } catch(e) { console.warn(e); }
        
        try {
            populateAttendanceClassDropdown(classroomsList);
        } catch(e) { console.warn(e); }
        
        try {
            loadBatchDropdowns();
        } catch(e) { console.warn(e); }
        
        try {
            populateScheduleTargetDropdown();
        } catch(e) { console.warn(e); }
    }

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

        // Populate mini sidebar profile
        const sidebarUserName = document.getElementById('sidebar-user-name');
        const sidebarUserRole = document.getElementById('sidebar-user-role');
        if (sidebarUserName) sidebarUserName.textContent = `Cikgu ${name.split(' ')[0]}`;
        if (sidebarUserRole) sidebarUserRole.textContent = role;

        if (role === 'ADMIN') {
            const teachersLink = document.getElementById('sidebar-teachers-link');
            if (teachersLink) {
                console.log("Revealing Teachers sidebar link...");
                teachersLink.classList.remove('hidden');
            } else {
                console.warn("sidebar-teachers-link element not found in DOM");
            }
            
            // Show classrooms actions header
            document.querySelectorAll('.admin-action-header').forEach(el => el.classList.remove('hidden'));
        }
    }

    function loadSimulatedProfile() {
        let email = 'teacher@edupulse.local';
        if (token.includes('-for-')) email = token.split('-for-')[1];
        const name = email.split('@')[0].replace(/^\w/, c => c.toUpperCase());
        const role = email.toLowerCase().includes('admin') ? 'ADMIN' : 'TEACHER';
        currentUser = { id: 999, email: email, full_name: name, role: role, is_active: true };
        populateProfile(name + ' (Demo)', role);
        
        // Populate cache and dropdowns immediately in simulated mode
        classroomsList = mockClassrooms;
        teachersList = mockTeachers;
        studentsList = mockStudents;
        subjectsList = mockSubjects;
        assessmentsList = mockAssessments;
        timeSlotsList = [
            { id: 1, day_of_week: 0, period_number: 1, start_time: '07:30', end_time: '08:10' },
            { id: 2, day_of_week: 0, period_number: 2, start_time: '08:10', end_time: '08:50' },
            { id: 3, day_of_week: 0, period_number: 3, start_time: '08:50', end_time: '09:30' },
            { id: 4, day_of_week: 0, period_number: 4, start_time: '09:30', end_time: '10:10' },
            { id: 5, day_of_week: 0, period_number: 5, start_time: '10:30', end_time: '11:10' }
        ];
        activeTimetable = { id: 999, name: "Demo Timetable", school_id: 1, term: "Term 1", is_active: true };
        populateDefaultDropdowns();

        setTimeout(hideAuthOverlay, 400);
        // Load demo schedule and alert data
        renderDemoSchedule();
        renderDemoAlerts();
        // Fetch dynamic data for active view
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

        // 1. Mobile toggle drawer open
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

        // 2. Mobile backdrop click drawer close
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

        // 3. Desktop sidebar expand/collapse
        if (collapseBtn) {
            // Restore saved state
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
            if (collapse) {
                sidebar.classList.remove('w-64');
                sidebar.classList.add('w-20');
                document.querySelectorAll('.sidebar-label').forEach(el => el.classList.add('hidden'));
                if (collapseIcon) {
                    collapseIcon.classList.remove('fa-chevron-left');
                    collapseIcon.classList.add('fa-chevron-right');
                }
            } else {
                sidebar.classList.remove('w-20');
                sidebar.classList.add('w-64');
                document.querySelectorAll('.sidebar-label').forEach(el => el.classList.remove('hidden'));
                if (collapseIcon) {
                    collapseIcon.classList.remove('fa-chevron-right');
                    collapseIcon.classList.add('fa-chevron-left');
                }
            }
        }

        // 4. View Switching via Hash Routing
        document.querySelectorAll('.sidebar-link').forEach(link => {
            link.addEventListener('click', () => {
                closeMobileSidebar();
            });
        });

        // Initialize and listen to hash routing
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

        // Role-based route guard for non-admin users trying to access teachers view
        if (viewName === 'teachers' && currentUser && currentUser.role !== 'ADMIN') {
            window.location.hash = '#dashboard';
            return;
        }

        // Update active sidebar link styling
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

        // Trigger loading data depending on view
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

        // Toggle mobile save bar depending on view and roster visibility
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

    // =========================================================================
    // CLASSROOM MODULE LOGIC
    // =========================================================================

    async function loadClassroomsData() {
        const tableBody = document.getElementById('classrooms-table-body');
        
        // Render immediately from cache if available to prevent UI lag
        if (classroomsList.length > 0) {
            renderClassroomsTable(classroomsList, teachersList);
            populateTeacherDropdown(teachersList);
        } else {
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="5" class="py-8 text-center text-slate-400">
                            <i class="fas fa-circle-notch fa-spin text-lg text-brand-teal mr-2"></i> Loading classrooms...
                        </td>
                    </tr>`;
            }
        }

        if (isSimulated) {
            classroomsList = mockClassrooms;
            teachersList = mockTeachers;
            renderClassroomsTable(classroomsList, teachersList);
            populateTeacherDropdown(teachersList);
            return;
        }

        try {
            // Load teachers and classrooms in background
            const [teachersRes, classesRes] = await Promise.allSettled([
                authFetch(`${API_BASE}/teachers/?limit=500`),
                authFetch(`${API_BASE}/classes/?school_id=${currentSchoolId}`)
            ]);

            if (teachersRes.status === 'fulfilled' && teachersRes.value.ok) {
                const data = await teachersRes.value.json();
                teachersList = data.items || [];
            }

            if (classesRes.status === 'fulfilled' && classesRes.value.ok) {
                const data = await classesRes.value.json();
                classroomsList = data.items || [];
                renderClassroomsTable(classroomsList, teachersList);
            } else if (classroomsList.length === 0) {
                console.warn("Classes API failed, rendering simulation.");
                loadSimulatedClassrooms();
            }
            populateDefaultDropdowns();
        } catch (error) {
            console.error("Error loading classrooms:", error);
            if (classroomsList.length === 0) {
                loadSimulatedClassrooms();
            }
        }
    }

    function populateTeacherDropdown(teachers) {
        const select = document.getElementById('class-teacher');
        if (!select) return;

        // Keep first option
        const firstOpt = select.options[0];
        select.innerHTML = '';
        select.appendChild(firstOpt);

        teachers.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = `${t.full_name} (${t.employee_id})`;
            select.appendChild(opt);
        });
    }

    function renderClassroomsTable(classes, teachers) {
        const tableBody = document.getElementById('classrooms-table-body');
        if (!tableBody) return;

        const isAdmin = currentUser && currentUser.role === 'ADMIN';

        if (classes.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="${isAdmin ? 6 : 5}" class="py-8 text-center text-slate-400">
                        <i class="fas fa-folder-open text-2xl block mb-2 opacity-50"></i>
                        No classrooms created yet. Set up one using the form.
                    </td>
                </tr>`;
            return;
        }

        let html = '';
        classes.forEach(cls => {
            const teacher = teachers.find(t => t.id === cls.form_teacher_id);
            const teacherName = teacher ? `Cikgu ${teacher.full_name}` : '<span class="text-slate-400 italic">Not Assigned</span>';
            const enrolledCount = cls.students ? cls.students.length : 0;

            const actionsCell = isAdmin 
                ? `<td class="py-3.5 px-4 text-center">
                    <button onclick="openEditModal('classroom', ${cls.id})" class="text-xs text-slate-400 hover:text-brand-teal p-1 transition-colors cursor-pointer" title="Edit classroom">
                        <i class="fas fa-edit"></i>
                    </button>
                   </td>`
                : '';

            html += `
                <tr class="hover:bg-slate-50/50 transition-colors">
                    <td class="py-3.5 px-4 font-bold text-slate-800">
                        <span class="hover:text-brand-teal hover:underline cursor-pointer transition-colors" onclick="viewClassroomStudents(${cls.id})" title="View classroom students">
                            ${cls.name}
                        </span>
                    </td>
                    <td class="py-3.5 px-4">Grade ${cls.grade_level}</td>
                    <td class="py-3.5 px-4 text-slate-600">${teacherName}</td>
                    <td class="py-3.5 px-4 text-center font-medium">${cls.capacity}</td>
                    <td class="py-3.5 px-4 text-center">
                        <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold ${enrolledCount >= cls.capacity ? 'bg-red-50 text-red-700' : 'bg-teal-50 text-brand-teal'}">
                            ${enrolledCount} / ${cls.capacity}
                        </span>
                    </td>
                    ${actionsCell}
                </tr>`;
        });
        tableBody.innerHTML = html;

        // Sync header visibility
        if (isAdmin) {
            document.querySelectorAll('.admin-action-header').forEach(el => el.classList.remove('hidden'));
        } else {
            document.querySelectorAll('.admin-action-header').forEach(el => el.classList.add('hidden'));
        }
    }

    function loadSimulatedClassrooms() {
        classroomsList = mockClassrooms;
        teachersList = mockTeachers;
        populateTeacherDropdown(mockTeachers);
        renderClassroomsTable(mockClassrooms, mockTeachers);
    }

    // =========================================================================
    // STUDENT MODULE LOGIC
    // =========================================================================

    async function loadStudentsData() {
        const tableBody = document.getElementById('students-table-body');
        
        const searchInput = document.getElementById('search-students-input');
        if (searchInput) {
            searchInput.value = '';
        }

        let initialFilterId = '';
        if (pendingClassroomFilterId) {
            initialFilterId = pendingClassroomFilterId;
            pendingClassroomFilterId = null; // Clear so subsequent direct navigations are not filtered
        }
        
        // Render immediately from cache if available to prevent UI lag
        if (studentsList.length > 0) {
            renderStudentsTable(studentsList, classroomsList, initialFilterId);
            populateClassDropdowns(classroomsList);
            if (initialFilterId) {
                const filterClassSelect = document.getElementById('filter-classroom');
                if (filterClassSelect) {
                    filterClassSelect.value = initialFilterId;
                }
            }
        } else {
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="5" class="py-8 text-center text-slate-400">
                            <i class="fas fa-circle-notch fa-spin text-lg text-brand-teal mr-2"></i> Loading student directory...
                        </td>
                    </tr>`;
            }
        }

        if (isSimulated) {
            studentsList = mockStudents;
            classroomsList = mockClassrooms;
            renderStudentsTable(studentsList, classroomsList, initialFilterId);
            populateClassDropdowns(classroomsList);
            if (initialFilterId) {
                const filterClassSelect = document.getElementById('filter-classroom');
                if (filterClassSelect) {
                    filterClassSelect.value = initialFilterId;
                }
            }
            return;
        }

        try {
            // Load classrooms and students in background
            const [classesRes, studentsRes] = await Promise.allSettled([
                authFetch(`${API_BASE}/classes/?school_id=${currentSchoolId}`),
                authFetch(`${API_BASE}/students/?skip=0&limit=500`)
            ]);

            if (classesRes.status === 'fulfilled' && classesRes.value.ok) {
                const data = await classesRes.value.json();
                classroomsList = data.items || [];
            }

            if (studentsRes.status === 'fulfilled' && studentsRes.value.ok) {
                const data = await studentsRes.value.json();
                studentsList = data.items || [];
                renderStudentsTable(studentsList, classroomsList, initialFilterId);
            } else if (studentsList.length === 0) {
                console.warn("Students API failed, rendering simulation.");
                loadSimulatedStudents(initialFilterId);
            }
            populateDefaultDropdowns();
            if (initialFilterId) {
                const filterClassSelect = document.getElementById('filter-classroom');
                if (filterClassSelect) {
                    filterClassSelect.value = initialFilterId;
                }
            }
        } catch (error) {
            console.error("Error loading students:", error);
            if (studentsList.length === 0) {
                loadSimulatedStudents(initialFilterId);
            }
        }
    }

    function populateClassDropdowns(classes) {
        const studentClassSelect = document.getElementById('student-class');
        const filterClassSelect = document.getElementById('filter-classroom');

        if (studentClassSelect) {
            const firstOpt = studentClassSelect.options[0];
            studentClassSelect.innerHTML = '';
            studentClassSelect.appendChild(firstOpt);
            classes.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = `${c.name} (Grade ${c.grade_level})`;
                studentClassSelect.appendChild(opt);
            });
        }

        if (filterClassSelect) {
            filterClassSelect.innerHTML = '<option value="">All Classrooms</option>';
            classes.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.name;
                filterClassSelect.appendChild(opt);
            });
        }
    }

    function renderStudentsTable(students, classes, filterClassId = '', searchQuery = '') {
        const tableBody = document.getElementById('students-table-body');
        if (!tableBody) return;

        let filtered = students;
        if (filterClassId) {
            filtered = students.filter(s => String(s.class_id) === String(filterClassId));
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(s => {
                const sId = (s.student_id_number || '').toLowerCase();
                const name = (s.full_name || '').toLowerCase();
                const c = classes.find(cls => cls.id === s.class_id);
                const className = c ? (c.name || '').toLowerCase() : 'unassigned';
                return sId.includes(query) || name.includes(query) || className.includes(query);
            });
        }

        const isAdmin = currentUser && currentUser.role === 'ADMIN';

        if (filtered.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="py-8 text-center text-slate-400">
                        <i class="fas fa-user-slash text-2xl block mb-2 opacity-50"></i>
                        No students enrolled in this view.
                    </td>
                </tr>`;
            return;
        }

        let html = '';
        filtered.forEach(student => {
            const statusBadge = student.is_active 
                ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">ACTIVE</span>'
                : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-400">INACTIVE</span>';

            // Classroom options select dropdown
            let classOptions = `<option value="">Unassigned</option>`;
            classes.forEach(c => {
                const selected = c.id === student.class_id ? 'selected' : '';
                classOptions += `<option value="${c.id}" ${selected}>${c.name}</option>`;
            });

            const viewButton = `<button onclick="openEditModal('view_student', ${student.id})" class="text-xs text-slate-400 hover:text-brand-teal p-1 transition-colors cursor-pointer mr-1" title="View details">
                                    <i class="fas fa-eye text-sm"></i>
                                </button>`;

            const editButton = isAdmin
                ? `<button onclick="openEditModal('student', ${student.id})" class="text-xs text-slate-400 hover:text-brand-teal p-1 transition-colors cursor-pointer mr-1" title="Edit student">
                        <i class="fas fa-edit"></i>
                   </button>`
                : '';

            const deleteButton = isAdmin || (currentUser && currentUser.role === 'TEACHER')
                ? `<button onclick="deactivateStudent(${student.id})" class="text-xs text-slate-400 hover:text-red-500 p-1 transition-colors cursor-pointer" title="Deactivate student">
                        <i class="fas fa-trash-can"></i>
                   </button>`
                : '';

            html += `
                <tr class="hover:bg-slate-50/50 transition-colors">
                    <td class="py-3 px-4 font-mono text-xs text-slate-500">${student.student_id_number}</td>
                    <td class="py-3 px-4 font-bold text-slate-800">${student.full_name}</td>
                    <td class="py-3 px-4">
                        <select onchange="updateStudentClass(${student.id}, this.value)" 
                            class="bg-slate-50 border border-slate-200 text-xs font-semibold rounded-lg px-2 py-1 focus:ring-1 focus:ring-brand-teal outline-none cursor-pointer">
                            ${classOptions}
                        </select>
                    </td>
                    <td class="py-3 px-4 text-center">${statusBadge}</td>
                    <td class="py-3 px-4 text-center">
                        ${viewButton}
                        ${editButton}
                        ${deleteButton}
                    </td>
                </tr>`;
        });
        tableBody.innerHTML = html;
    }

    function loadSimulatedStudents(filterClassId = '') {
        classroomsList = mockClassrooms;
        studentsList = mockStudents;
        populateClassDropdowns(mockClassrooms);
        const filterVal = filterClassId || document.getElementById('filter-classroom').value;
        renderStudentsTable(mockStudents, mockClassrooms, filterVal);
        if (filterClassId) {
            const filterClassSelect = document.getElementById('filter-classroom');
            if (filterClassSelect) {
                filterClassSelect.value = filterClassId;
            }
        }
    }


    // =========================================================================
    // INLINE ACTIONS (BOUND TO WINDOW)
    // =========================================================================

    function viewClassroomStudents(classId) {
        pendingClassroomFilterId = classId;
        window.location.hash = '#students';
    }
    window.viewClassroomStudents = viewClassroomStudents;


    async function updateStudentClass(studentId, classId) {
        console.log(`Reassigning student ID ${studentId} to classroom ${classId}`);
        const parsedClassId = classId ? parseInt(classId) : null;
        
        if (isSimulated) {
            const student = mockStudents.find(s => s.id === studentId);
            if (student) {
                student.class_id = parsedClassId;
                const clsName = parsedClassId ? mockClassrooms.find(c => c.id === parsedClassId).name : 'Unassigned';
                showToast(`Assigned ${student.full_name} to ${clsName}`);
                
                // Update student count locally
                mockClassrooms.forEach(c => {
                    c.students = mockStudents.filter(s => s.class_id === c.id).map(s => s.id);
                });
                
                renderStudentsTable(mockStudents, mockClassrooms, document.getElementById('filter-classroom').value);
            }
            return;
        }

        try {
            const response = await authFetch(`${API_BASE}/students/${studentId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    class_id: parsedClassId
                })
            });

            if (response.ok) {
                showToast("Student classroom assignment updated successfully");
                loadStudentsData();
            } else {
                const err = await response.json();
                showToast(`Failed to update assignment: ${err.detail || 'Server error'}`, 'error');
            }
        } catch (error) {
            console.error("Error updating student class:", error);
            showToast("Network error. Failed to update classroom assignment.", "error");
        }
    }
    window.updateStudentClass = updateStudentClass;

    async function deactivateStudent(studentId) {
        if (!confirm("Are you sure you want to deactivate this student?")) return;

        if (isSimulated) {
            const index = mockStudents.findIndex(s => s.id === studentId);
            if (index !== -1) {
                mockStudents[index].is_active = false;
                showToast(`Deactivated student: ${mockStudents[index].full_name}`);
                renderStudentsTable(mockStudents, mockClassrooms, document.getElementById('filter-classroom').value);
            }
            return;
        }

        try {
            const response = await authFetch(`${API_BASE}/students/${studentId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                showToast("Student deactivated successfully");
                loadStudentsData();
            } else {
                const err = await response.json();
                showToast(`Failed to deactivate student: ${err.detail || 'Server error'}`, 'error');
            }
        } catch (error) {
            console.error("Error deactivating student:", error);
            showToast("Network error. Failed to deactivate student.", "error");
        }
    }
    window.deactivateStudent = deactivateStudent;

    // =========================================================================
    // LIVE DATA FETCHING (DASHBOARD DEFAULT VIEW)
    // =========================================================================

    async function fetchDashboardData() {
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0=Sun, we need 0=Mon format for DB
        const dbDayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert: Sun=6, Mon=0, Tue=1...

        try {
            const [slotsRes, studentsRes, schoolsRes] = await Promise.allSettled([
                authFetch(`${API_BASE}/schedules/time-slots?school_id=${currentSchoolId}`),
                authFetch(`${API_BASE}/students/?skip=0&limit=200`),
                authFetch(`${API_BASE}/schools/`)
            ]);

            // --- Render Schedule ---
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

            // --- Render Student Count for KPI & Leaderboard ---
            if (studentsRes.status === 'fulfilled' && studentsRes.value.ok) {
                const studentData = await studentsRes.value.json();
                const totalStudents = studentData.total || 0;
                const activeStudents = (studentData.items || []).filter(s => s.is_active).length;
                // Simulate attendance rate based on active ratio
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

    // =========================================================================
    // SCHEDULE RENDERING
    // =========================================================================

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

    // =========================================================================
    // DEMO DATA RENDERING
    // =========================================================================

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

    // =========================================================================
    // SUBMISSION EVENT LISTENERS
    // =========================================================================

    // Classroom Form Submit
    const createClassForm = document.getElementById('create-class-form');
    if (createClassForm) {
        createClassForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('create-class-submit-btn');
            const originalBtnHtml = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Creating...';

            const name = document.getElementById('class-name').value;
            const grade_level = parseInt(document.getElementById('class-grade').value);
            const capacity = parseInt(document.getElementById('class-capacity').value);
            const form_teacher_id = document.getElementById('class-teacher').value;

            const payload = {
                name,
                grade_level,
                capacity,
                school_id: currentSchoolId,
                form_teacher_id: form_teacher_id ? parseInt(form_teacher_id) : null
            };

            if (isSimulated) {
                setTimeout(() => {
                    const newId = mockClassrooms.length + 1;
                    mockClassrooms.push({
                        id: newId,
                        name,
                        grade_level,
                        form_teacher_id: payload.form_teacher_id,
                        capacity,
                        students: []
                    });
                    showToast(`Classroom "${name}" created successfully`);
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnHtml;
                    createClassForm.reset();
                    loadClassroomsData();
                }, 800);
                return;
            }

            try {
                const response = await authFetch(`${API_BASE}/classes/`, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    showToast(`Classroom "${name}" created successfully`);
                    createClassForm.reset();
                    loadClassroomsData();
                } else {
                    const err = await response.json();
                    showToast(`Failed to create classroom: ${err.detail || 'Server error'}`, 'error');
                }
            } catch (error) {
                console.error("Error creating classroom:", error);
                showToast("Network error. Failed to create classroom.", "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHtml;
            }
        });
    }

    // Student Form Submit
    const enrollStudentForm = document.getElementById('enroll-student-form');
    if (enrollStudentForm) {
        enrollStudentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('enroll-student-submit-btn');
            const originalBtnHtml = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Enrolling...';

            const student_id_number = document.getElementById('student-id').value;
            const full_name = document.getElementById('student-name').value;
            const class_id = parseInt(document.getElementById('student-class').value);

            const identity_card_number = document.getElementById('student-id-card').value;
            const gender = document.getElementById('student-gender').value || null;
            const birth_date = document.getElementById('student-birth-date').value || null;
            const enroll_date = document.getElementById('student-enroll-date').value || null;
            const father_contact = document.getElementById('student-father-contact').value;
            const mother_contact = document.getElementById('student-mother-contact').value;
            const guardian_contact = document.getElementById('student-guardian-contact').value;
            const residential_address = document.getElementById('student-address').value;

            const payload = {
                student_id_number,
                full_name,
                class_id,
                school_id: currentSchoolId,
                is_active: true,
                identity_card_number,
                gender,
                birth_date,
                enroll_date,
                father_contact,
                mother_contact,
                guardian_contact,
                residential_address
            };

            if (isSimulated) {
                setTimeout(() => {
                    const newId = mockStudents.length + 1;
                    const newStudent = {
                        id: newId,
                        student_id_number,
                        full_name,
                        class_id,
                        school_id: 1,
                        is_active: true,
                        identity_card_number,
                        gender,
                        birth_date,
                        enroll_date,
                        father_contact,
                        mother_contact,
                        guardian_contact,
                        residential_address
                    };
                    mockStudents.push(newStudent);

                    // Update local students list inside classrooms
                    const cls = mockClassrooms.find(c => c.id === class_id);
                    if (cls) cls.students.push(newId);

                    showToast(`Student "${full_name}" enrolled successfully`);
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnHtml;
                    enrollStudentForm.reset();
                    loadStudentsData();
                }, 800);
                return;
            }

            try {
                const response = await authFetch(`${API_BASE}/students/`, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    showToast(`Student "${full_name}" enrolled successfully`);
                    enrollStudentForm.reset();
                    loadStudentsData();
                } else {
                    const err = await response.json();
                    showToast(`Failed to enroll student: ${err.detail || 'Server error'}`, 'error');
                }
            } catch (error) {
                console.error("Error enrolling student:", error);
                showToast("Network error. Failed to enroll student.", "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHtml;
            }
        });
    }

    // Classroom Directory Filter change listener
    const filterClassroom = document.getElementById('filter-classroom');
    if (filterClassroom) {
        filterClassroom.addEventListener('change', (e) => {
            const searchInput = document.getElementById('search-students-input');
            const q = searchInput ? searchInput.value : '';
            if (isSimulated) {
                renderStudentsTable(mockStudents, mockClassrooms, e.target.value, q);
            } else {
                renderStudentsTable(studentsList, classroomsList, e.target.value, q);
            }
        });
    }

    // Students Search query input listener
    const searchStudentsInput = document.getElementById('search-students-input');
    if (searchStudentsInput) {
        searchStudentsInput.addEventListener('input', (e) => {
            const filterClassVal = document.getElementById('filter-classroom').value;
            if (isSimulated) {
                renderStudentsTable(mockStudents, mockClassrooms, filterClassVal, e.target.value);
            } else {
                renderStudentsTable(studentsList, classroomsList, filterClassVal, e.target.value);
            }
        });
    }

    // =========================================================================
    // TEACHERS MODULE LOGIC
    // =========================================================================

    async function loadTeachersData() {
        const tableBody = document.getElementById('teachers-table-body');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="py-8 text-center text-slate-400">
                        <i class="fas fa-circle-notch fa-spin text-lg text-brand-teal mr-2"></i> Loading teacher registry...
                    </td>
                </tr>`;
        }

        const searchInput = document.getElementById('search-teachers-input');
        if (searchInput) {
            searchInput.value = '';
        }

        if (isSimulated) {
            setTimeout(loadSimulatedTeachers, 300);
            return;
        }

        try {
            const response = await authFetch(`${API_BASE}/teachers/?limit=500`);
            if (response.ok) {
                const data = await response.json();
                teachersList = data.items || [];
                renderTeachersTable(teachersList);
                populateDefaultDropdowns();
            } else {
                console.warn("Teachers API failed, rendering simulation.");
                loadSimulatedTeachers();
            }
        } catch (error) {
            console.error("Error loading teachers:", error);
            loadSimulatedTeachers();
        }
    }

    // Teachers Search query input listener
    const searchTeachersInput = document.getElementById('search-teachers-input');
    if (searchTeachersInput) {
        searchTeachersInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            if (!query) {
                renderTeachersTable(teachersList);
                return;
            }
            const filtered = teachersList.filter(t => {
                const empId = (t.employee_id || '').toLowerCase();
                const name = (t.full_name || '').toLowerCase();
                const email = (t.email || '').toLowerCase();
                const phone = (t.contact_number || '').toLowerCase();
                const emerg = (t.emergency_contact || '').toLowerCase();
                return empId.includes(query) || name.includes(query) || email.includes(query) || phone.includes(query) || emerg.includes(query);
            });
            renderTeachersTable(filtered);
        });
    }

    function renderTeachersTable(teachers) {
        const tableBody = document.getElementById('teachers-table-body');
        if (!tableBody) return;

        if (teachers.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="py-8 text-center text-slate-400">
                        <i class="fas fa-user-slash text-2xl block mb-2 opacity-50"></i>
                        No teachers registered yet.
                    </td>
                </tr>`;
            return;
        }

        let html = '';
        teachers.forEach(t => {
            const statusBadge = t.is_active 
                ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">ACTIVE</span>'
                : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-400">INACTIVE</span>';

            html += `
                <tr class="hover:bg-slate-50/50 transition-colors">
                    <td class="py-3 px-4 font-mono text-xs text-slate-500">${t.employee_id}</td>
                    <td class="py-3 px-4 font-bold text-slate-800">${t.full_name}</td>
                    <td class="py-3 px-4 text-slate-600">${t.email || '<span class="text-slate-400 italic">None</span>'}</td>
                    <td class="py-3 px-4 text-center">${statusBadge}</td>
                    <td class="py-3 px-4 text-center flex items-center justify-center gap-2">
                        <button onclick="openEditModal('view_teacher', ${t.id})" class="text-xs text-slate-400 hover:text-brand-teal p-1 transition-colors cursor-pointer" title="View details">
                            <i class="fas fa-eye text-sm"></i>
                        </button>
                        <button onclick="openEditModal('teacher', ${t.id})" class="text-xs text-slate-400 hover:text-brand-teal p-1 transition-colors cursor-pointer" title="Edit teacher">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deactivateTeacher(${t.id})" class="text-xs text-slate-400 hover:text-red-500 p-1 transition-colors cursor-pointer" title="Deactivate teacher">
                            <i class="fas fa-trash-can"></i>
                        </button>
                    </td>
                </tr>`;
        });
        tableBody.innerHTML = html;
    }

    function loadSimulatedTeachers() {
        teachersList = mockTeachers;
        renderTeachersTable(mockTeachers);
    }

    async function deactivateTeacher(teacherId) {
        if (!confirm("Are you sure you want to deactivate this teacher?")) return;

        if (isSimulated) {
            const index = mockTeachers.findIndex(t => t.id === teacherId);
            if (index !== -1) {
                mockTeachers[index].is_active = false;
                showToast(`Deactivated teacher: ${mockTeachers[index].full_name}`);
                renderTeachersTable(mockTeachers);
            }
            return;
        }

        try {
            const response = await authFetch(`${API_BASE}/teachers/${teacherId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                showToast("Teacher deactivated successfully");
                loadTeachersData();
            } else {
                const err = await response.json();
                showToast(`Failed to deactivate teacher: ${err.detail || 'Server error'}`, 'error');
            }
        } catch (error) {
            console.error("Error deactivating teacher:", error);
            showToast("Network error. Failed to deactivate teacher.", "error");
        }
    }
    window.deactivateTeacher = deactivateTeacher;

    const createTeacherForm = document.getElementById('create-teacher-form');
    if (createTeacherForm) {
        createTeacherForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('create-teacher-submit-btn');
            const originalBtnHtml = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Registering...';

            const employee_id = document.getElementById('teacher-employee-id').value;
            const full_name = document.getElementById('teacher-name').value;
            const email = document.getElementById('teacher-email').value;
            const contact_number = document.getElementById('teacher-contact-number').value;
            const emergency_contact = document.getElementById('teacher-emergency-contact').value;

            const payload = {
                employee_id,
                full_name,
                email,
                contact_number,
                emergency_contact,
                school_id: currentSchoolId
            };

            if (isSimulated) {
                setTimeout(() => {
                    const newId = mockTeachers.length + 1;
                    mockTeachers.push({
                        id: newId,
                        employee_id,
                        full_name,
                        email,
                        contact_number,
                        emergency_contact,
                        is_active: true
                    });
                    showToast(`Teacher "${full_name}" registered successfully`);
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnHtml;
                    createTeacherForm.reset();
                    loadTeachersData();
                }, 800);
                return;
            }

            try {
                const response = await authFetch(`${API_BASE}/teachers/`, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    showToast(`Teacher "${full_name}" registered successfully`);
                    createTeacherForm.reset();
                    loadTeachersData();
                } else {
                    const err = await response.json();
                    showToast(`Failed to register teacher: ${err.detail || 'Server error'}`, 'error');
                }
            } catch (error) {
                console.error("Error registering teacher:", error);
                showToast("Network error. Failed to register teacher.", "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHtml;
            }
        });
    }

    // =========================================================================
    // EDIT MODAL & DYNAMIC UPDATE FORMS
    // =========================================================================

    function openEditModal(type, id) {
        const modal = document.getElementById('edit-modal');
        const content = document.getElementById('edit-modal-content');
        if (!modal || !content) return;

        let modalHtml = '';

        if (type === 'subject') {
            const sub = subjectsList.find(s => s.id === id);
            if (!sub) return;

            modalHtml = `
                <div class="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <i class="fas fa-edit text-brand-teal"></i>
                        Edit Subject: ${sub.name}
                    </h3>
                    <button onclick="closeEditModal()" class="text-slate-400 hover:text-slate-600 transition-colors">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form onsubmit="submitEditSubject(event, ${sub.id})" class="p-6 space-y-4">
                    <div>
                        <label for="edit-subject-name" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Subject Name</label>
                        <input type="text" id="edit-subject-name" value="${sub.name}" required
                            class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 outline-none transition-all">
                    </div>
                    <div>
                        <label for="edit-subject-code" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Subject Code</label>
                        <input type="text" id="edit-subject-code" value="${sub.code}" required
                            class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 outline-none transition-all">
                    </div>
                    <div class="flex gap-3 pt-2">
                        <button type="button" onclick="closeEditModal()"
                            class="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm transition-all text-center cursor-pointer">
                            Cancel
                        </button>
                        <button type="submit" id="edit-subject-submit-btn"
                            class="flex-1 py-3 bg-brand-teal hover:bg-teal-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-brand-teal/10 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer">
                            Save Changes
                        </button>
                    </div>
                </form>
            `;
        } else if (type === 'classroom') {
            const cls = classroomsList.find(c => c.id === id);
            if (!cls) return;

            // Generate teacher options
            let teacherOptions = '<option value="">Select form teacher (optional)...</option>';
            teachersList.forEach(t => {
                const selected = t.id === cls.form_teacher_id ? 'selected' : '';
                teacherOptions += `<option value="${t.id}" ${selected}>${t.full_name} (${t.employee_id})</option>`;
            });

            modalHtml = `
                <div class="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <i class="fas fa-edit text-brand-teal"></i>
                        Edit Classroom: ${cls.name}
                    </h3>
                    <button onclick="closeEditModal()" class="text-slate-400 hover:text-slate-600 transition-colors">
                        <i class="fas fa-xmark text-lg"></i>
                    </button>
                </div>
                <form id="edit-classroom-form" class="p-6 space-y-4" onsubmit="submitEditClassroom(event, ${id})">
                    <div>
                        <label for="edit-class-name" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Classroom Name</label>
                        <input type="text" id="edit-class-name" value="${cls.name}" required
                            class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 placeholder-slate-400 outline-none transition-all">
                    </div>

                    <div>
                        <label for="edit-class-grade" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Grade Level</label>
                        <select id="edit-class-grade" required
                            class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 outline-none transition-all">
                            <option value="1" ${cls.grade_level === 1 ? 'selected' : ''}>Grade 1 / Darjah 1</option>
                            <option value="2" ${cls.grade_level === 2 ? 'selected' : ''}>Grade 2 / Darjah 2</option>
                            <option value="3" ${cls.grade_level === 3 ? 'selected' : ''}>Grade 3 / Darjah 3</option>
                            <option value="4" ${cls.grade_level === 4 ? 'selected' : ''}>Grade 4 / Darjah 4</option>
                            <option value="5" ${cls.grade_level === 5 ? 'selected' : ''}>Grade 5 / Darjah 5</option>
                            <option value="6" ${cls.grade_level === 6 ? 'selected' : ''}>Grade 6 / Darjah 6</option>
                        </select>
                    </div>

                    <div>
                        <label for="edit-class-capacity" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Capacity (Max Students)</label>
                        <input type="number" id="edit-class-capacity" value="${cls.capacity}" min="5" max="60" required
                            class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 outline-none transition-all">
                    </div>

                    <div>
                        <label for="edit-class-teacher" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Form Teacher</label>
                        <select id="edit-class-teacher"
                            class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 outline-none transition-all">
                            ${teacherOptions}
                        </select>
                    </div>

                    <div class="flex gap-3 pt-2">
                        <button type="button" onclick="closeEditModal()"
                            class="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm transition-all text-center cursor-pointer">
                            Cancel
                        </button>
                        <button type="submit" id="edit-classroom-submit-btn"
                            class="flex-1 py-3 bg-brand-teal hover:bg-teal-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-brand-teal/10 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer">
                            Save Changes
                        </button>
                    </div>
                </form>
            `;
        } else if (type === 'view_student') {
            const student = studentsList.find(s => s.id === id);
            if (!student) return;

            const initials = (student.full_name || '')
                .split(' ')
                .map(n => n[0])
                .join('')
                .substring(0, 2)
                .toUpperCase();

            const classroom = classroomsList.find(c => c.id === student.class_id);
            const className = classroom ? classroom.name : 'Unassigned';

            modalHtml = `
                <div class="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <i class="fas fa-id-card text-brand-teal"></i>
                        Student Details
                    </h3>
                    <button onclick="closeEditModal()" class="text-slate-400 hover:text-slate-600 transition-colors">
                        <i class="fas fa-xmark text-lg"></i>
                    </button>
                </div>
                <div class="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                    <!-- Profile Header / Avatar -->
                    <div class="flex items-center gap-4 border-b border-slate-100 pb-5">
                        <div class="w-16 h-16 rounded-2xl bg-teal-50 text-brand-teal border border-teal-100 flex items-center justify-center font-bold text-xl tracking-wide shadow-inner">
                            ${initials}
                        </div>
                        <div>
                            <h4 class="text-lg font-bold text-slate-900">${student.full_name}</h4>
                            <div class="flex items-center gap-2 mt-1">
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 font-mono">${student.student_id_number}</span>
                                ${student.is_active 
                                    ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 font-semibold">ACTIVE</span>'
                                    : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-400 font-semibold">INACTIVE</span>'}
                            </div>
                        </div>
                    </div>

                    <!-- Personal Details -->
                    <div class="space-y-4">
                        <h4 class="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-1">Personal Details</h4>
                        <div class="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span class="block text-xs font-semibold text-slate-400 uppercase mb-0.5">Identity Card / Passport</span>
                                <span class="font-medium text-slate-800">${student.identity_card_number || '<span class="text-slate-400 italic">None</span>'}</span>
                            </div>
                            <div>
                                <span class="block text-xs font-semibold text-slate-400 uppercase mb-0.5">Gender</span>
                                <span class="font-medium text-slate-800">${student.gender || '<span class="text-slate-400 italic">Not specified</span>'}</span>
                            </div>
                            <div>
                                <span class="block text-xs font-semibold text-slate-400 uppercase mb-0.5">Birth Date</span>
                                <span class="font-medium text-slate-800">${student.birth_date || '<span class="text-slate-400 italic">Not set</span>'}</span>
                            </div>
                            <div>
                                <span class="block text-xs font-semibold text-slate-400 uppercase mb-0.5">Assigned Classroom</span>
                                <span class="font-medium text-slate-800">${className}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Enrollment & Location -->
                    <div class="space-y-4">
                        <h4 class="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-1">Enrollment & Address</h4>
                        <div class="grid grid-cols-1 gap-3 text-sm">
                            <div>
                                <span class="block text-xs font-semibold text-slate-400 uppercase mb-0.5">Enroll Date</span>
                                <span class="font-medium text-slate-800">${student.enroll_date || '<span class="text-slate-400 italic">Not set</span>'}</span>
                            </div>
                            <div>
                                <span class="block text-xs font-semibold text-slate-400 uppercase mb-0.5">Residential Address</span>
                                <span class="font-medium text-slate-800 leading-relaxed block bg-slate-50 p-2.5 rounded-xl border border-slate-100">${student.residential_address || '<span class="text-slate-400 italic">No address provided</span>'}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Parent / Guardian Contacts -->
                    <div class="space-y-4">
                        <h4 class="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-1">Parent / Guardian Contacts</h4>
                        <div class="grid grid-cols-1 gap-3 text-sm">
                            <div class="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                <span class="text-xs font-semibold text-slate-500">Father's Contact</span>
                                <span class="font-bold text-slate-800 font-mono">${student.father_contact || '<span class="text-slate-400 italic font-normal">None</span>'}</span>
                            </div>
                            <div class="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                <span class="text-xs font-semibold text-slate-500">Mother's Contact</span>
                                <span class="font-bold text-slate-800 font-mono">${student.mother_contact || '<span class="text-slate-400 italic font-normal">None</span>'}</span>
                            </div>
                            <div class="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                <span class="text-xs font-semibold text-slate-500">Guardian's Contact</span>
                                <span class="font-bold text-slate-800 font-mono">${student.guardian_contact || '<span class="text-slate-400 italic font-normal">None</span>'}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Footer Actions -->
                    <div class="flex gap-3 pt-2 border-t border-slate-100">
                        <button type="button" onclick="closeEditModal()"
                            class="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm transition-all text-center cursor-pointer">
                            Close
                        </button>
                        ${(currentUser && currentUser.role === 'ADMIN') ? `
                        <button type="button" onclick="openEditModal('student', ${student.id})"
                            class="flex-1 py-3 bg-brand-teal hover:bg-teal-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-brand-teal/10 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer">
                            <i class="fas fa-edit"></i>
                            Edit Profile
                        </button>
                        ` : ''}
                    </div>
                </div>
            `;
        } else if (type === 'student') {
            const student = studentsList.find(s => s.id === id);
            if (!student) return;

            let classOptions = '<option value="">Unassigned</option>';
            classroomsList.forEach(c => {
                const selected = c.id === student.class_id ? 'selected' : '';
                classOptions += `<option value="${c.id}" ${selected}>${c.name} (Grade ${c.grade_level})</option>`;
            });            modalHtml = `
                <div class="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <i class="fas fa-edit text-brand-teal"></i>
                        Edit Student: ${student.full_name}
                    </h3>
                    <button onclick="closeEditModal()" class="text-slate-400 hover:text-slate-600 transition-colors">
                        <i class="fas fa-xmark text-lg"></i>
                    </button>
                </div>
                <form id="edit-student-form" class="p-6 space-y-4 max-h-[75vh] overflow-y-auto" onsubmit="submitEditStudent(event, ${id})">
                    <div>
                        <label for="edit-student-id-number" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Student ID Number</label>
                        <input type="text" id="edit-student-id-number" value="${student.student_id_number}" required
                            class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 outline-none transition-all">
                    </div>

                    <div>
                        <label for="edit-student-name" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Full Name</label>
                        <input type="text" id="edit-student-name" value="${student.full_name}" required
                            class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 outline-none transition-all">
                    </div>

                    <div>
                        <label for="edit-student-id-card" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Identity Card Number (IC / Passport)</label>
                        <input type="text" id="edit-student-id-card" value="${student.identity_card_number || ''}"
                            class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 outline-none transition-all">
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label for="edit-student-gender" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Gender</label>
                            <select id="edit-student-gender"
                                class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 outline-none transition-all">
                                <option value="" ${!student.gender ? 'selected' : ''}>Select...</option>
                                <option value="MALE" ${student.gender === 'MALE' ? 'selected' : ''}>Male</option>
                                <option value="FEMALE" ${student.gender === 'FEMALE' ? 'selected' : ''}>Female</option>
                            </select>
                        </div>
                        <div>
                            <label for="edit-student-birth-date" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Birth Date</label>
                            <input type="date" id="edit-student-birth-date" value="${student.birth_date || ''}"
                                class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-xs font-medium text-slate-800 outline-none transition-all">
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label for="edit-student-enroll-date" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Enroll Date</label>
                            <input type="date" id="edit-student-enroll-date" value="${student.enroll_date || ''}"
                                class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-xs font-medium text-slate-800 outline-none transition-all">
                        </div>
                        <div>
                            <label for="edit-student-class" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Classroom</label>
                            <select id="edit-student-class"
                                class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-xs font-medium text-slate-800 outline-none transition-all">
                                ${classOptions}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label for="edit-student-father-contact" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Father Contact No.</label>
                        <input type="text" id="edit-student-father-contact" value="${student.father_contact || ''}"
                            class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 outline-none transition-all">
                    </div>

                    <div>
                        <label for="edit-student-mother-contact" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Mother Contact No.</label>
                        <input type="text" id="edit-student-mother-contact" value="${student.mother_contact || ''}"
                            class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 outline-none transition-all">
                    </div>

                    <div>
                        <label for="edit-student-guardian-contact" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Guardian Contact No.</label>
                        <input type="text" id="edit-student-guardian-contact" value="${student.guardian_contact || ''}"
                            class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 outline-none transition-all">
                    </div>

                    <div>
                        <label for="edit-student-address" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Residential Address</label>
                        <textarea id="edit-student-address" rows="2"
                            class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 outline-none transition-all">${student.residential_address || ''}</textarea>
                    </div>

                    <div>
                        <label for="edit-student-status" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Status</label>
                        <select id="edit-student-status" required
                            class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 outline-none transition-all">
                            <option value="true" ${student.is_active ? 'selected' : ''}>Active</option>
                            <option value="false" ${!student.is_active ? 'selected' : ''}>Inactive</option>
                        </select>
                    </div>

                    <div class="flex gap-3 pt-2">
                        <button type="button" onclick="closeEditModal()"
                            class="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm transition-all text-center cursor-pointer">
                            Cancel
                        </button>
                        <button type="submit" id="edit-student-submit-btn"
                            class="flex-1 py-3 bg-brand-teal hover:bg-teal-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-brand-teal/10 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer">
                            Save Changes
                        </button>
                    </div>
                </form>
            `;
        } else if (type === 'view_teacher') {
            const teacher = teachersList.find(t => t.id === id);
            if (!teacher) return;

            const initials = (teacher.full_name || '')
                .split(' ')
                .map(n => n[0])
                .join('')
                .substring(0, 2)
                .toUpperCase();

            modalHtml = `
                <div class="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <i class="fas fa-id-card text-brand-teal"></i>
                        Teacher Details
                    </h3>
                    <button onclick="closeEditModal()" class="text-slate-400 hover:text-slate-600 transition-colors">
                        <i class="fas fa-xmark text-lg"></i>
                    </button>
                </div>
                <div class="p-6 space-y-6">
                    <!-- Profile Header / Avatar -->
                    <div class="flex items-center gap-4 border-b border-slate-100 pb-5">
                        <div class="w-16 h-16 rounded-2xl bg-teal-50 text-brand-teal border border-teal-100 flex items-center justify-center font-bold text-xl tracking-wide shadow-inner">
                            ${initials}
                        </div>
                        <div>
                            <h4 class="text-lg font-bold text-slate-900">${teacher.full_name}</h4>
                            <div class="flex items-center gap-2 mt-1">
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 font-mono">${teacher.employee_id}</span>
                                ${teacher.is_active 
                                    ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 font-semibold">ACTIVE</span>'
                                    : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-400 font-semibold">INACTIVE</span>'}
                            </div>
                        </div>
                    </div>

                    <!-- Details Fields -->
                    <div class="grid grid-cols-1 gap-4 text-sm">
                        <div>
                            <span class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Email Address</span>
                            <span class="font-medium text-slate-800 flex items-center gap-2">
                                <i class="far fa-envelope text-slate-400"></i>
                                ${teacher.email || '<span class="text-slate-400 italic">None</span>'}
                            </span>
                        </div>

                        <div>
                            <span class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Contact Number</span>
                            <span class="font-medium text-slate-800 flex items-center gap-2">
                                <i class="fas fa-phone text-slate-400"></i>
                                ${teacher.contact_number || '<span class="text-slate-400 italic">Not set</span>'}
                            </span>
                        </div>

                        <div>
                            <span class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Emergency Contact</span>
                            <span class="font-medium text-slate-800 flex items-center gap-2">
                                <i class="fas fa-truck-medical text-slate-400"></i>
                                ${teacher.emergency_contact || '<span class="text-slate-400 italic">Not set</span>'}
                            </span>
                        </div>
                    </div>

                    <!-- Footer Actions -->
                    <div class="flex gap-3 pt-2 border-t border-slate-100">
                        <button type="button" onclick="closeEditModal()"
                            class="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm transition-all text-center cursor-pointer">
                            Close
                        </button>
                        <button type="button" onclick="openEditModal('teacher', ${teacher.id})"
                            class="flex-1 py-3 bg-brand-teal hover:bg-teal-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-brand-teal/10 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer">
                            <i class="fas fa-edit"></i>
                            Edit Profile
                        </button>
                    </div>
                </div>
            `;
        } else if (type === 'teacher') {
            const teacher = teachersList.find(t => t.id === id);
            if (!teacher) return;

            modalHtml = `
                <div class="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <i class="fas fa-edit text-brand-teal"></i>
                        Edit Teacher: ${teacher.full_name}
                    </h3>
                    <button onclick="closeEditModal()" class="text-slate-400 hover:text-slate-600 transition-colors">
                        <i class="fas fa-xmark text-lg"></i>
                    </button>
                </div>
                <form id="edit-teacher-form" class="p-6 space-y-4" onsubmit="submitEditTeacher(event, ${id})">
                    <div>
                        <label for="edit-teacher-employee-id" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Employee ID</label>
                        <input type="text" id="edit-teacher-employee-id" value="${teacher.employee_id}" required
                            class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 outline-none transition-all">
                    </div>

                    <div>
                        <label for="edit-teacher-name" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Full Name</label>
                        <input type="text" id="edit-teacher-name" value="${teacher.full_name}" required
                            class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 outline-none transition-all">
                    </div>

                    <div>
                        <label for="edit-teacher-email" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Email Address</label>
                        <input type="email" id="edit-teacher-email" value="${teacher.email || ''}" required
                            class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 outline-none transition-all">
                    </div>

                    <div>
                        <label for="edit-teacher-contact-number" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Contact Number</label>
                        <input type="text" id="edit-teacher-contact-number" value="${teacher.contact_number || ''}"
                            class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 outline-none transition-all">
                    </div>

                    <div>
                        <label for="edit-teacher-emergency-contact" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Emergency Contact Details</label>
                        <input type="text" id="edit-teacher-emergency-contact" value="${teacher.emergency_contact || ''}"
                            class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 outline-none transition-all">
                    </div>

                    <div>
                        <label for="edit-teacher-status" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Status</label>
                        <select id="edit-teacher-status" required
                            class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 outline-none transition-all">
                            <option value="true" ${teacher.is_active ? 'selected' : ''}>Active</option>
                            <option value="false" ${!teacher.is_active ? 'selected' : ''}>Inactive</option>
                        </select>
                    </div>

                    <div class="flex gap-3 pt-2">
                        <button type="button" onclick="closeEditModal()"
                            class="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm transition-all text-center cursor-pointer">
                            Cancel
                        </button>
                        <button type="submit" id="edit-teacher-submit-btn"
                            class="flex-1 py-3 bg-brand-teal hover:bg-teal-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-brand-teal/10 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer">
                            Save Changes
                        </button>
                    </div>
                </form>
            `;
        } else if (type === 'assessment') {
            const assessment = assessmentsList.find(a => a.id === id);
            if (!assessment) return;

            let subjectOptions = '';
            subjectsList.forEach(s => {
                const selected = s.id === assessment.subject_id ? 'selected' : '';
                subjectOptions += `<option value="${s.id}" ${selected}>${s.name} (${s.code})</option>`;
            });

            let count = 10;
            let optionRange = 'A-D';
            let activeKey = {};

            if (assessment.grading_type === 'OMR') {
                try {
                    activeKey = JSON.parse(assessment.config);
                    const keys = Object.keys(activeKey).map(Number);
                    count = keys.length > 0 ? Math.max(...keys) : 10;
                    
                    const values = Object.values(activeKey);
                    if (values.includes('E')) {
                        optionRange = 'A-E';
                    }
                } catch (err) {
                    console.warn("Could not parse assessment config JSON:", err);
                }
            }

            modalHtml = `
                <div class="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <i class="fas fa-edit text-brand-teal"></i>
                        Modify Assessment: ${assessment.title}
                    </h3>
                    <button onclick="closeEditModal()" class="text-slate-400 hover:text-slate-600 transition-colors">
                        <i class="fas fa-xmark text-lg"></i>
                    </button>
                </div>
                <form id="edit-assessment-form" class="p-6 space-y-4 max-h-[80vh] overflow-y-auto" onsubmit="submitEditAssessment(event, ${id})">
                    <div>
                        <label for="edit-assessment-title" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Assessment Title</label>
                        <input type="text" id="edit-assessment-title" value="${assessment.title}" required
                            class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 placeholder-slate-400 outline-none transition-all">
                    </div>

                    <div>
                        <label for="edit-assessment-subject" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Subject</label>
                        <select id="edit-assessment-subject" required
                            class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 outline-none transition-all">
                            ${subjectOptions}
                        </select>
                    </div>

                    <div>
                        <label for="edit-assessment-max-points" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Max Score Points</label>
                        <input type="number" id="edit-assessment-max-points" value="${assessment.max_points}" min="1" required
                            class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 outline-none transition-all">
                    </div>

                    <div>
                        <label for="edit-assessment-grading-type" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Grading Engine</label>
                        <select id="edit-assessment-grading-type" required
                            class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 outline-none transition-all">
                            <option value="OMR" ${assessment.grading_type === 'OMR' ? 'selected' : ''}>OMR (Multiple Choice Sheet)</option>
                            <option value="MATH" ${assessment.grading_type === 'MATH' ? 'selected' : ''}>Math (Expression Evaluator Stub)</option>
                        </select>
                    </div>

                    <!-- Configuration Panel for OMR (Clickable grid) -->
                    <div id="edit-panel-omr-config" class="${assessment.grading_type === 'OMR' ? '' : 'hidden'} space-y-4">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label for="edit-omr-question-count" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">No. of Questions</label>
                                <input type="number" id="edit-omr-question-count" value="${count}" min="1" max="100" required
                                    class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 outline-none transition-all">
                            </div>
                            <div>
                                <label for="edit-omr-option-range" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Option Range</label>
                                <select id="edit-omr-option-range" required
                                    class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 outline-none transition-all">
                                    <option value="A-D" ${optionRange === 'A-D' ? 'selected' : ''}>A, B, C, D</option>
                                    <option value="A-E" ${optionRange === 'A-E' ? 'selected' : ''}>A, B, C, D, E</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Answer Key Builder (Select correct answers)</label>
                            <div id="edit-omr-builder-container" class="space-y-2.5 max-h-60 overflow-y-auto p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                                <!-- Dynamically populated rows of options -->
                            </div>
                        </div>
                    </div>

                    <!-- Configuration Panel for MATH (Text Input) -->
                    <div id="edit-panel-math-config" class="${assessment.grading_type === 'MATH' ? '' : 'hidden'}">
                        <label for="edit-assessment-math-answer" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Expected Answer Expression</label>
                        <input type="text" id="edit-assessment-math-answer" value="${assessment.grading_type === 'MATH' ? assessment.config : ''}" placeholder="e.g. x = 5"
                            class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 outline-none transition-all">
                        <p class="text-[10px] text-slate-400 mt-1">Provide the exact string pattern to match against student answers.</p>
                    </div>

                    <div class="flex gap-3 pt-2">
                        <button type="button" onclick="closeEditModal()"
                            class="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm transition-all text-center cursor-pointer">
                            Cancel
                        </button>
                        <button type="submit" id="edit-assessment-submit-btn"
                            class="flex-1 py-3 bg-brand-teal hover:bg-teal-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-brand-teal/10 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer">
                            Save Changes
                        </button>
                    </div>
                </form>
            `;
            window.activeEditOmrAnswerKey = activeKey;
        }

        content.innerHTML = modalHtml;
        modal.classList.remove('hidden');
        setTimeout(() => {
            content.classList.remove('scale-95', 'opacity-0');
            content.classList.add('scale-100', 'opacity-100');
        }, 50);

        if (type === 'assessment') {
            const editGradingTypeSelect = document.getElementById('edit-assessment-grading-type');
            const editPanelOmrConfig = document.getElementById('edit-panel-omr-config');
            const editPanelMathConfig = document.getElementById('edit-panel-math-config');
            const editOmrQuestionCount = document.getElementById('edit-omr-question-count');
            const editOmrOptionRange = document.getElementById('edit-omr-option-range');

            function triggerEditOMRBuilderGeneration() {
                if (editGradingTypeSelect && editGradingTypeSelect.value === 'OMR') {
                    const count = parseInt(editOmrQuestionCount.value) || 10;
                    const range = editOmrOptionRange.value;

                    Object.keys(window.activeEditOmrAnswerKey).forEach(k => {
                        if (parseInt(k) > count) {
                            delete window.activeEditOmrAnswerKey[k];
                        }
                    });

                    generateOMRGrid('edit-omr-builder-container', count, range, window.activeEditOmrAnswerKey);
                }
            }

            if (editGradingTypeSelect && editPanelOmrConfig && editPanelMathConfig) {
                editGradingTypeSelect.addEventListener('change', () => {
                    const val = editGradingTypeSelect.value;
                    if (val === 'OMR') {
                        editPanelOmrConfig.classList.remove('hidden');
                        editPanelMathConfig.classList.add('hidden');
                        triggerEditOMRBuilderGeneration();
                    } else {
                        editPanelMathConfig.classList.remove('hidden');
                        editPanelOmrConfig.classList.add('hidden');
                    }
                });
            }

            if (editOmrQuestionCount && editOmrOptionRange) {
                editOmrQuestionCount.addEventListener('input', triggerEditOMRBuilderGeneration);
                editOmrOptionRange.addEventListener('change', triggerEditOMRBuilderGeneration);
            }

            // Initial render of OMR grid
            triggerEditOMRBuilderGeneration();
        }
    }
    window.openEditModal = openEditModal;

    function closeEditModal() {
        const modal = document.getElementById('edit-modal');
        const content = document.getElementById('edit-modal-content');
        if (!modal || !content) return;
        content.classList.remove('scale-100', 'opacity-100');
        content.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    }
    window.closeEditModal = closeEditModal;

    async function submitEditClassroom(event, classId) {
        event.preventDefault();
        const submitBtn = document.getElementById('edit-classroom-submit-btn');
        const originalHtml = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Saving...';

        const name = document.getElementById('edit-class-name').value;
        const grade_level = parseInt(document.getElementById('edit-class-grade').value);
        const capacity = parseInt(document.getElementById('edit-class-capacity').value);
        const form_teacher_id_val = document.getElementById('edit-class-teacher').value;
        const form_teacher_id = form_teacher_id_val ? parseInt(form_teacher_id_val) : null;

        const payload = { name, grade_level, capacity, form_teacher_id };

        if (isSimulated) {
            setTimeout(() => {
                const cls = mockClassrooms.find(c => c.id === classId);
                if (cls) {
                    cls.name = name;
                    cls.grade_level = grade_level;
                    cls.capacity = capacity;
                    cls.form_teacher_id = form_teacher_id;
                    showToast(`Classroom "${name}" updated successfully`);
                }
                closeEditModal();
                loadClassroomsData();
            }, 500);
            return;
        }

        try {
            const response = await authFetch(`${API_BASE}/classes/${classId}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                showToast(`Classroom "${name}" updated successfully`);
                closeEditModal();
                loadClassroomsData();
            } else {
                const err = await response.json();
                showToast(`Failed to update classroom: ${err.detail || 'Server error'}`, 'error');
            }
        } catch (error) {
            console.error("Error updating classroom:", error);
            showToast("Network error. Failed to update classroom.", "error");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalHtml;
        }
    }
    window.submitEditClassroom = submitEditClassroom;

    async function submitEditStudent(event, studentId) {
        event.preventDefault();
        const submitBtn = document.getElementById('edit-student-submit-btn');
        const originalHtml = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Saving...';

        const student_id_number = document.getElementById('edit-student-id-number').value;
        const full_name = document.getElementById('edit-student-name').value;
        const class_id_val = document.getElementById('edit-student-class').value;
        const class_id = class_id_val ? parseInt(class_id_val) : null;
        const is_active = document.getElementById('edit-student-status').value === 'true';

        const identity_card_number = document.getElementById('edit-student-id-card').value;
        const gender = document.getElementById('edit-student-gender').value || null;
        const birth_date = document.getElementById('edit-student-birth-date').value || null;
        const enroll_date = document.getElementById('edit-student-enroll-date').value || null;
        const father_contact = document.getElementById('edit-student-father-contact').value;
        const mother_contact = document.getElementById('edit-student-mother-contact').value;
        const guardian_contact = document.getElementById('edit-student-guardian-contact').value;
        const residential_address = document.getElementById('edit-student-address').value;

        const payload = { 
            student_id_number, 
            full_name, 
            class_id, 
            is_active,
            identity_card_number,
            gender,
            birth_date,
            enroll_date,
            father_contact,
            mother_contact,
            guardian_contact,
            residential_address
        };

        if (isSimulated) {
            setTimeout(() => {
                const student = mockStudents.find(s => s.id === studentId);
                if (student) {
                    student.student_id_number = student_id_number;
                    student.full_name = full_name;
                    student.class_id = class_id;
                    student.is_active = is_active;
                    student.identity_card_number = identity_card_number;
                    student.gender = gender;
                    student.birth_date = birth_date;
                    student.enroll_date = enroll_date;
                    student.father_contact = father_contact;
                    student.mother_contact = mother_contact;
                    student.guardian_contact = guardian_contact;
                    student.residential_address = residential_address;
                    showToast(`Student "${full_name}" updated successfully`);
                }
                closeEditModal();
                loadStudentsData();
            }, 500);
            return;
        }

        try {
            const response = await authFetch(`${API_BASE}/students/${studentId}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                showToast(`Student "${full_name}" updated successfully`);
                closeEditModal();
                loadStudentsData();
            } else {
                const err = await response.json();
                showToast(`Failed to update student: ${err.detail || 'Server error'}`, 'error');
            }
        } catch (error) {
            console.error("Error updating student:", error);
            showToast("Network error. Failed to update student.", "error");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalHtml;
        }
    }
    window.submitEditStudent = submitEditStudent;

    async function submitEditTeacher(event, teacherId) {
        event.preventDefault();
        const submitBtn = document.getElementById('edit-teacher-submit-btn');
        const originalHtml = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Saving...';

        const employee_id = document.getElementById('edit-teacher-employee-id').value;
        const full_name = document.getElementById('edit-teacher-name').value;
        const email = document.getElementById('edit-teacher-email').value;
        const contact_number = document.getElementById('edit-teacher-contact-number').value;
        const emergency_contact = document.getElementById('edit-teacher-emergency-contact').value;
        const is_active = document.getElementById('edit-teacher-status').value === 'true';

        const payload = { employee_id, full_name, email, contact_number, emergency_contact, is_active };

        if (isSimulated) {
            setTimeout(() => {
                const teacher = mockTeachers.find(t => t.id === teacherId);
                if (teacher) {
                    teacher.employee_id = employee_id;
                    teacher.full_name = full_name;
                    teacher.email = email;
                    teacher.contact_number = contact_number;
                    teacher.emergency_contact = emergency_contact;
                    teacher.is_active = is_active;
                    showToast(`Teacher "${full_name}" updated successfully`);
                }
                closeEditModal();
                loadTeachersData();
            }, 500);
            return;
        }

        try {
            const response = await authFetch(`${API_BASE}/teachers/${teacherId}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                showToast(`Teacher "${full_name}" updated successfully`);
                closeEditModal();
                loadTeachersData();
            } else {
                const err = await response.json();
                showToast(`Failed to update teacher: ${err.detail || 'Server error'}`, 'error');
            }
        } catch (error) {
            console.error("Error updating teacher:", error);
            showToast("Network error. Failed to update teacher.", "error");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalHtml;
        }
    }
    window.submitEditTeacher = submitEditTeacher;

    async function submitEditAssessment(event, assessmentId) {
        event.preventDefault();
        const submitBtn = document.getElementById('edit-assessment-submit-btn');
        const originalHtml = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Saving...';

        const title = document.getElementById('edit-assessment-title').value;
        const subject_id = parseInt(document.getElementById('edit-assessment-subject').value);
        const grading_type = document.getElementById('edit-assessment-grading-type').value;
        const max_points = parseInt(document.getElementById('edit-assessment-max-points').value) || 100;

        let config = '';
        if (grading_type === 'OMR') {
            const count = parseInt(document.getElementById('edit-omr-question-count').value) || 10;
            // Validate that all questions have an answer selected
            if (Object.keys(window.activeEditOmrAnswerKey).length < count) {
                showToast(`Please specify correct answers for all ${count} questions before saving.`, "error");
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalHtml;
                return;
            }
            config = JSON.stringify(window.activeEditOmrAnswerKey);
        } else {
            config = document.getElementById('edit-assessment-math-answer').value.trim();
            if (!config) {
                showToast("Please provide expected math expression answer.", "error");
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalHtml;
                return;
            }
        }

        const payload = { title, subject_id, grading_type, max_points, config };

        if (isSimulated) {
            setTimeout(() => {
                const assessment = mockAssessments.find(a => a.id === assessmentId);
                if (assessment) {
                    assessment.title = title;
                    assessment.subject_id = subject_id;
                    assessment.grading_type = grading_type;
                    assessment.max_points = max_points;
                    assessment.config = config;
                    assessment.updated_at = new Date().toISOString();
                    showToast(`Assessment "${title}" updated successfully`);
                }
                closeEditModal();
                loadGradingData();
            }, 500);
            return;
        }

        try {
            const response = await authFetch(`${API_BASE}/grading/assessments/${assessmentId}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                showToast(`Assessment "${title}" updated successfully`);
                closeEditModal();
                loadGradingData();
            } else {
                const err = await response.json();
                showToast(`Failed to update assessment: ${err.detail || 'Server error'}`, 'error');
            }
        } catch (error) {
            console.error("Error updating assessment:", error);
            showToast("Network error. Failed to update assessment.", "error");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalHtml;
        }
    }
    window.submitEditAssessment = submitEditAssessment;

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

    // =========================================================================
    // GRADING MODULE LOGIC
    // =========================================================================

    function initGrading() {
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
                
                if (isSimulated) {
                    setTimeout(() => {
                        const classStudents = studentsList.filter(s => s.class_id === class_id);
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
            
            const classroom = classroomsList.find(c => c.id === batchSelectedClassId);
            const assessment = assessmentsList.find(a => a.id === batchSelectedAssessmentId);
            
            document.getElementById('batch-review-class-title').textContent = classroom ? classroom.name : '-';
            document.getElementById('batch-review-assessment-title').textContent = `Assessment: ${assessment ? assessment.title : '-'}`;
            
            const verifyStudentSelect = document.getElementById('batch-student-select-verify');
            if (verifyStudentSelect) {
                verifyStudentSelect.innerHTML = '';
                const placeholderOpt = document.createElement('option');
                placeholderOpt.value = '';
                placeholderOpt.textContent = '-- Select Student --';
                verifyStudentSelect.appendChild(placeholderOpt);
                
                const classStudents = studentsList.filter(s => s.class_id === batchSelectedClassId);
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
            
            const assessment = assessmentsList.find(a => a.id === batchSelectedAssessmentId);
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
            
            const assessment = assessmentsList.find(a => a.id === batchSelectedAssessmentId);
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
                    const s = studentsList.find(std => std.id === studentId);
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
                
                if (isSimulated) {
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
                        
                        const assessment = assessmentsList.find(a => a.id === batchSelectedAssessmentId);
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

                if (isSimulated) {
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
                const school_id = currentSchoolId || 1;

                const payload = { name, code, school_id };

                if (isSimulated) {
                    setTimeout(() => {
                        const newId = mockSubjects.length > 0 ? Math.max(...mockSubjects.map(s => s.id)) + 1 : 1;
                        const newSub = { id: newId, name, code, school_id };
                        mockSubjects.push(newSub);
                        subjectsList.push(newSub);
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

    function loadBatchDropdowns() {
        const batchClassroomSelect = document.getElementById('batch-classroom-select');
        const batchAssessmentSelect = document.getElementById('batch-assessment-select');
        
        if (batchClassroomSelect) {
            const firstOpt = batchClassroomSelect.options[0];
            batchClassroomSelect.innerHTML = '';
            batchClassroomSelect.appendChild(firstOpt);
            classroomsList.forEach(c => {
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
            const omrAssessments = assessmentsList.filter(a => a.grading_type.toUpperCase() === 'OMR');
            omrAssessments.forEach(a => {
                const opt = document.createElement('option');
                opt.value = a.id;
                opt.textContent = a.title;
                batchAssessmentSelect.appendChild(opt);
            });
        }
    }

    async function loadGradingData() {
        // Render immediately from cache if available to prevent UI lag
        if (subjectsList.length > 0 || assessmentsList.length > 0) {
            populateGradingDropdowns(subjectsList, assessmentsList, studentsList);
            renderAssessmentsTable(assessmentsList, subjectsList);
            renderSubjectsTable(subjectsList);
        }

        if (isSimulated) {
            assessmentsList = mockAssessments;
            subjectsList = mockSubjects;
            studentsList = mockStudents;

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
                subjectsList = data.items || [];
            }

            if (studentsRes.status === 'fulfilled' && studentsRes.value.ok) {
                const data = await studentsRes.value.json();
                studentsList = data.items || [];
            }

            if (assessmentsRes.status === 'fulfilled' && assessmentsRes.value.ok) {
                const data = await assessmentsRes.value.json();
                assessmentsList = data.items || [];
            }

            populateGradingDropdowns(subjectsList, assessmentsList, studentsList);
            renderAssessmentsTable(assessmentsList, subjectsList);
            renderSubjectsTable(subjectsList);
            populateDefaultDropdowns();
        } catch (error) {
            console.error("Error loading grading data:", error);
            showToast("Failed to fetch live grading data, running in offline backup mode.", "warning");
            // Fallback to simulation
            isSimulated = true;
            loadGradingData();
        }
    }

    function populateGradingDropdowns(subjects, assessments, students) {
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

    async function deleteSubject(subjectId) {
        if (!confirm('Are you sure you want to delete this subject?')) return;

        if (isSimulated) {
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
    window.deleteSubject = deleteSubject;

    async function submitEditSubject(event, subjectId) {
        event.preventDefault();
        const submitBtn = document.getElementById('edit-subject-submit-btn');
        const originalHtml = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Saving...';

        const name = document.getElementById('edit-subject-name').value;
        const code = document.getElementById('edit-subject-code').value.toUpperCase();

        const payload = { name, code };

        if (isSimulated) {
            setTimeout(() => {
                const sub = mockSubjects.find(s => s.id === subjectId);
                if (sub) {
                    sub.name = name;
                    sub.code = code;
                    showToast(`Subject "${name}" updated successfully`);
                }
                closeEditModal();
                loadGradingData();
            }, 500);
            return;
        }

        try {
            const response = await authFetch(`${API_BASE}/grading/subjects/${subjectId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to update subject');
            }

            showToast(`Subject "${name}" updated successfully`);
            closeEditModal();
            loadGradingData();
        } catch (error) {
            console.error('Error updating subject:', error);
            showToast(error.message, 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalHtml;
        }
    }
    window.submitEditSubject = submitEditSubject;

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



    async function deleteAssessment(id) {
        if (!confirm("Are you sure you want to delete this assessment? All associated student grades will be deleted as well.")) return;

        if (isSimulated) {
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
    window.deleteAssessment = deleteAssessment;


    // =========================================================================
    // SCHEDULES MODULE
    // =========================================================================

    async function loadSchedulesViewData() {
        const gridBody = document.getElementById('timetable-grid-body');
        
        // Render immediately from cache if available to prevent UI lag
        if (classroomsList.length > 0 && activeTimetable) {
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

        if (isSimulated) {
            populateScheduleTargetDropdown();
            await fetchAndRenderScheduleGrid();
            return;
        }

        try {
            // Load classrooms, teachers, students, subjects, timetables, and timeslots in background
            const [classesRes, teachersRes, studentsRes, subjectsRes, timetablesRes, slotsRes] = await Promise.allSettled([
                authFetch(`${API_BASE}/classes/?school_id=${currentSchoolId}`),
                authFetch(`${API_BASE}/teachers/?limit=500`),
                authFetch(`${API_BASE}/students/?skip=0&limit=500`),
                authFetch(`${API_BASE}/grading/subjects?limit=500`),
                authFetch(`${API_BASE}/schedules/timetables?school_id=${currentSchoolId}`),
                authFetch(`${API_BASE}/schedules/time-slots?school_id=${currentSchoolId}`)
            ]);

            if (classesRes.status === 'fulfilled' && classesRes.value.ok) {
                classroomsList = (await classesRes.value.json()).items || [];
            }
            if (teachersRes.status === 'fulfilled' && teachersRes.value.ok) {
                teachersList = (await teachersRes.value.json()).items || [];
            }
            if (studentsRes.status === 'fulfilled' && studentsRes.value.ok) {
                studentsList = (await studentsRes.value.json()).items || [];
            }
            if (subjectsRes.status === 'fulfilled' && subjectsRes.value.ok) {
                subjectsList = (await subjectsRes.value.json()).items || [];
            }
            if (slotsRes.status === 'fulfilled' && slotsRes.value.ok) {
                timeSlotsList = (await slotsRes.value.json()).items || [];
            }

            // Handle Timetable
            if (timetablesRes.status === 'fulfilled' && timetablesRes.value.ok) {
                const timetablesData = await timetablesRes.value.json();
                const timetables = timetablesData.items || [];
                activeTimetable = timetables.find(t => t.is_active) || timetables[0] || null;

                const badge = document.getElementById('active-timetable-badge');
                if (badge) {
                    if (activeTimetable) {
                        badge.textContent = `Active Timetable: ${activeTimetable.name} (${activeTimetable.term})`;
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
            populateDefaultDropdowns();
        } catch (error) {
            console.error("Error loading schedule data:", error);
            if (!classroomsList.length) {
                showToast("Failed to load schedule data dependencies", "error");
            }
        }
    }

    async function createDefaultTimetable() {
        try {
            const res = await authFetch(`${API_BASE}/schedules/timetables`, {
                method: 'POST',
                body: JSON.stringify({
                    name: "Main School Term 1",
                    school_id: currentSchoolId,
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
    window.createDefaultTimetable = createDefaultTimetable;

    function populateScheduleTargetDropdown() {
        const viewType = document.getElementById('schedule-view-type').value;
        const targetSelect = document.getElementById('schedule-target-select');
        const targetLabel = document.getElementById('schedule-target-label');
        if (!targetSelect) return;

        let optionsHtml = '';
        if (viewType === 'classroom') {
            targetLabel.textContent = "Select Classroom";
            classroomsList.forEach(c => {
                optionsHtml += `<option value="${c.id}">${c.name} (Grade ${c.grade_level})</option>`;
            });
        } else if (viewType === 'teacher') {
            targetLabel.textContent = "Select Teacher";
            teachersList.forEach(t => {
                optionsHtml += `<option value="${t.id}">${t.full_name} (${t.employee_id})</option>`;
            });
        } else if (viewType === 'student') {
            targetLabel.textContent = "Select Student";
            studentsList.forEach(s => {
                optionsHtml += `<option value="${s.id}">${s.full_name} (${s.student_id_number})</option>`;
            });
        }

        targetSelect.innerHTML = optionsHtml;
    }

    async function fetchAndRenderScheduleGrid() {
        const gridBody = document.getElementById('timetable-grid-body');
        if (!gridBody) return;

        if (!activeTimetable) {
            gridBody.innerHTML = `
                <tr>
                    <td colspan="6" class="py-12 text-center text-slate-400">
                        <i class="fas fa-calendar-xmark text-2xl text-slate-300 mb-2 block text-center"></i>
                        No active timetable found. Please create one first.
                    </td>
                </tr>`;
            return;
        }

        const viewType = document.getElementById('schedule-view-type').value;
        const targetSelect = document.getElementById('schedule-target-select');
        if (!targetSelect || !targetSelect.value) {
            gridBody.innerHTML = `
                <tr>
                    <td colspan="6" class="py-12 text-center text-slate-400">
                        No targets available for selection.
                    </td>
                </tr>`;
            return;
        }

        const targetId = parseInt(targetSelect.value);

        gridBody.innerHTML = `
            <tr>
                <td colspan="6" class="py-8 text-center text-slate-400">
                    <i class="fas fa-circle-notch fa-spin text-lg text-brand-teal mr-2"></i> Fetching schedule entries...
                </td>
            </tr>`;

        try {
            let url = `${API_BASE}/schedules/timetables/${activeTimetable.id}/entries`;
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
                scheduleEntriesList = data.items || [];
                renderTimetableGrid();
            } else {
                showToast("Failed to fetch schedule entries", "error");
            }
        } catch (error) {
            console.error("Error fetching entries:", error);
            showToast("Network error. Failed to load schedule.", "error");
        }
    }

    function renderTimetableGrid() {
        const gridBody = document.getElementById('timetable-grid-body');
        if (!gridBody) return;

        const viewType = document.getElementById('schedule-view-type').value;

        // Group time slots by period number to make rows
        const uniquePeriods = [];
        const periodMap = {}; 
        timeSlotsList.forEach(slot => {
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
                const slot = timeSlotsList.find(s => s.period_number === pNum && s.day_of_week === day);
                if (!slot) {
                    html += `<td class="p-1 border border-slate-150 bg-slate-50/10"></td>`;
                    continue;
                }

                const entry = scheduleEntriesList.find(e => e.time_slot_id === slot.id);

                html += `<td class="p-1.5 border border-slate-150 h-full align-top">`;

                if (entry) {
                    const subject = subjectsList.find(s => s.id === entry.subject_id);
                    const subjectName = subject ? subject.name : 'Unknown Subject';

                    let subText = '';
                    if (viewType === 'classroom' || viewType === 'student') {
                        const teacher = teachersList.find(t => t.id === entry.teacher_id);
                        subText = teacher ? teacher.full_name : 'No Teacher';
                    } else if (viewType === 'teacher') {
                        const classroom = classroomsList.find(c => c.id === entry.class_id);
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

    function openScheduleModal(day, period, timeSlotId, entryId = null) {
        const modal = document.getElementById('edit-modal');
        const content = document.getElementById('edit-modal-content');
        if (!modal || !content) return;

        const viewType = document.getElementById('schedule-view-type').value;
        const targetSelect = document.getElementById('schedule-target-select');
        const targetId = parseInt(targetSelect.value);

        const dayName = DAY_NAMES[day + 1] || 'Today'; 
        const slot = timeSlotsList.find(s => s.id === timeSlotId);
        const timeRange = slot ? `${formatTime12h(slot.start_time)} - ${formatTime12h(slot.end_time)}` : '';

        let entry = null;
        if (entryId) {
            entry = scheduleEntriesList.find(e => e.id === entryId);
        }

        let subjectOptions = '<option value="">Select subject...</option>';
        subjectsList.forEach(s => {
            const selected = (entry && s.id === entry.subject_id) ? 'selected' : '';
            subjectOptions += `<option value="${s.id}" ${selected}>${s.name} (${s.code})</option>`;
        });

        let teacherOptions = '<option value="">Select teacher...</option>';
        teachersList.forEach(t => {
            const selected = (entry && t.id === entry.teacher_id) ? 'selected' : '';
            teacherOptions += `<option value="${t.id}" ${selected}>${t.full_name} (${t.employee_id})</option>`;
        });

        let classOptions = '<option value="">Select classroom...</option>';
        classroomsList.forEach(c => {
            const selected = (entry && c.id === entry.class_id) ? 'selected' : '';
            classOptions += `<option value="${c.id}" ${selected}>${c.name}</option>`;
        });

        let title = entry 
            ? `<i class="fas fa-edit text-brand-teal"></i> Edit Schedule Entry`
            : `<i class="fas fa-calendar-plus text-brand-teal"></i> Add Schedule Entry`;

        let contextHtml = '';
        if (viewType === 'classroom') {
            const cls = classroomsList.find(c => c.id === targetId);
            contextHtml = `
                <div class="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 border border-slate-100 flex flex-col gap-1">
                    <div><strong>Classroom:</strong> ${cls ? cls.name : 'Unknown'}</div>
                    <div><strong>Time Slot:</strong> ${dayName}, Period ${period} (${timeRange})</div>
                </div>
            `;
        } else if (viewType === 'teacher') {
            const teacher = teachersList.find(t => t.id === targetId);
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
    window.openScheduleModal = openScheduleModal;

    async function submitScheduleEntryForm(event, timeSlotId, entryId) {
        event.preventDefault();
        const submitBtn = document.getElementById('schedule-entry-submit-btn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Saving...';
        }

        const viewType = document.getElementById('schedule-view-type').value;
        const targetSelect = document.getElementById('schedule-target-select');
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
                    timetable_id: activeTimetable.id,
                    class_id: classId,
                    subject_id: subjectId,
                    teacher_id: teacherId,
                    time_slot_id: timeSlotId
                };
                response = await authFetch(`${API_BASE}/schedules/timetables/${activeTimetable.id}/entries`, {
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
    window.submitScheduleEntryForm = submitScheduleEntryForm;

    async function deleteScheduleEntryConfirm(entryId) {
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
    window.deleteScheduleEntryConfirm = deleteScheduleEntryConfirm;

    function openTimeSlotsModal() {
        const modal = document.getElementById('edit-modal');
        const content = document.getElementById('edit-modal-content');
        if (!modal || !content) return;

        // Group time slots by period number to find unique periods and their times
        const uniquePeriods = [];
        const periodMap = {}; 
        timeSlotsList.forEach(slot => {
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
    window.openTimeSlotsModal = openTimeSlotsModal;

    function adjustModalPeriodCount(change) {
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
    window.adjustModalPeriodCount = adjustModalPeriodCount;

    async function submitTimeSlotsConfig(event) {
        event.preventDefault();
        const submitBtn = document.getElementById('timeslots-config-submit-btn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Saving...';
        }

        const newCount = parseInt(document.getElementById('modal-period-count').value);

        const oldPeriods = [];
        timeSlotsList.forEach(slot => {
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

        timeSlotsList.forEach(slot => {
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
                        school_id: currentSchoolId
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
            timeSlotsList.forEach(slot => {
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
    window.submitTimeSlotsConfig = submitTimeSlotsConfig;

    async function openTimetablesModal() {
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
            const res = await authFetch(`${API_BASE}/schedules/timetables?school_id=${currentSchoolId}`);
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
    window.openTimetablesModal = openTimetablesModal;

    function renderTimetablesModalContent(timetables) {
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

    function showCreateTimetableForm() {
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
    window.showCreateTimetableForm = showCreateTimetableForm;

    function showEditTimetableForm(timetableId) {
        const t = window.timetablesCache.find(x => x.id === timetableId);
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
    window.showEditTimetableForm = showEditTimetableForm;

    async function saveNewTimetable(event) {
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
                    school_id: currentSchoolId,
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
    window.saveNewTimetable = saveNewTimetable;

    async function saveTimetableEdit(event, timetableId) {
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
    window.saveTimetableEdit = saveTimetableEdit;

    async function activateTimetable(timetableId) {
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
    window.activateTimetable = activateTimetable;

    function deleteTimetableConfirm(timetableId) {
        const t = window.timetablesCache.find(x => x.id === timetableId);
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
    window.deleteTimetableConfirm = deleteTimetableConfirm;

    async function executeDeleteTimetable(timetableId) {
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
    window.executeDeleteTimetable = executeDeleteTimetable;

    function initSchedules() {
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
    window.initSchedules = initSchedules;
    window.loadSchedulesViewData = loadSchedulesViewData;

    // =========================================================================
    // ATTENDANCE MODULE CONTROLLER
    // =========================================================================
    function initAttendance() {
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
                attendanceMode = 'daily';
                btnDaily.classList.add('bg-white', 'text-slate-800', 'shadow-sm');
                btnDaily.classList.remove('text-slate-500', 'hover:text-slate-800');
                btnPeriod.classList.remove('bg-white', 'text-slate-800', 'shadow-sm');
                btnPeriod.classList.add('text-slate-500', 'hover:text-slate-800');
                
                if (periodContainer) periodContainer.classList.add('hidden');
                hideRoster();
            });

            btnPeriod.addEventListener('click', () => {
                attendanceMode = 'period';
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
                if (attendanceMode === 'period') {
                    loadAttendancePeriods();
                }
                hideRoster();
            });
        }

        if (dateInput) {
            dateInput.addEventListener('change', () => {
                if (attendanceMode === 'period') {
                    loadAttendancePeriods();
                }
                hideRoster();
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
                attendanceRoster.forEach(student => {
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

    async function loadAttendanceViewData() {
        const classSelect = document.getElementById('attendance-class-select');
        const dateInput = document.getElementById('attendance-date-select');
        
        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        // Render immediately from cache if available to prevent UI lag
        if (classroomsList.length > 0) {
            populateAttendanceClassDropdown(classroomsList);
        } else {
            if (classSelect) {
                classSelect.innerHTML = '<option value="">Loading classrooms...</option>';
            }
        }

        if (isSimulated) {
            classroomsList = mockClassrooms;
            populateAttendanceClassDropdown(mockClassrooms);
            return;
        }

        try {
            const classesRes = await authFetch(`${API_BASE}/classes/?school_id=${currentSchoolId}`);
            if (classesRes.ok) {
                const data = await classesRes.json();
                classroomsList = data.items || [];
                populateAttendanceClassDropdown(classroomsList);
            } else if (classroomsList.length === 0) {
                populateAttendanceClassDropdown(mockClassrooms);
            }
            populateDefaultDropdowns();
        } catch (error) {
            console.error("Error loading classes for attendance:", error);
            if (classroomsList.length === 0) {
                populateAttendanceClassDropdown(mockClassrooms);
            }
        }
    }

    function populateAttendanceClassDropdown(classes) {
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

    async function loadAttendancePeriods() {
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

        if (isSimulated) {
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
            let active = activeTimetable;
            let slots = timeSlotsList;
            let subjects = subjectsList;

            if (!active) {
                const timetablesRes = await authFetch(`${API_BASE}/schedules/timetables?school_id=${currentSchoolId}`);
                if (timetablesRes.ok) {
                    const timetables = (await timetablesRes.json()).items || [];
                    active = timetables.find(t => t.is_active) || timetables[0] || null;
                    activeTimetable = active;
                }
            }

            if (active) {
                const entriesRes = await authFetch(`${API_BASE}/schedules/timetables/${active.id}/entries?class_id=${classId}`);
                
                if (!slots || slots.length === 0) {
                    const slotsRes = await authFetch(`${API_BASE}/schedules/time-slots?school_id=${currentSchoolId}`);
                    if (slotsRes.ok) {
                        slots = (await slotsRes.json()).items || [];
                        timeSlotsList = slots;
                    }
                }

                if (!subjects || subjects.length === 0) {
                    const subjectsRes = await authFetch(`${API_BASE}/grading/subjects?limit=200`);
                    if (subjectsRes.ok) {
                        subjects = (await subjectsRes.json()).items || [];
                        subjectsList = subjects;
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

    async function fetchAndRenderAttendanceRoster() {
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

        if (attendanceMode === 'period' && !periodId) {
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

        const targetTimeSlotId = attendanceMode === 'period' ? parseInt(periodId) : null;

        if (isSimulated) {
            setTimeout(() => {
                let session = mockAttendanceSessions.find(s => 
                    String(s.class_id) === String(classId) && 
                    s.date === dateVal && 
                    ((s.time_slot_id === targetTimeSlotId) || (s.time_slot_id === null && targetTimeSlotId === null))
                );

                const classStudents = mockStudents.filter(s => String(s.class_id) === String(classId));
                
                if (session) {
                    currentAttendanceSession = session;
                    attendanceRoster = classStudents.map(student => {
                        const record = session.records.find(r => r.student_id === student.id);
                        return {
                            student_id: student.id,
                            student_id_number: student.student_id_number,
                            full_name: student.full_name,
                            status: record ? record.status : 'PRESENT',
                            notes: record ? record.notes || '' : ''
                        };
                    });
                    renderRosterRows(attendanceRoster, true);
                } else {
                    currentAttendanceSession = null;
                    attendanceRoster = classStudents.map(student => ({
                        student_id: student.id,
                        student_id_number: student.student_id_number,
                        full_name: student.full_name,
                        status: 'PRESENT',
                        notes: ''
                    }));
                    renderRosterRows(attendanceRoster, false);
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
                        currentAttendanceSession = detail;
                        attendanceRoster = classStudents.map(student => {
                            const record = detail.records.find(r => r.student_id === student.id);
                            return {
                                student_id: student.id,
                                student_id_number: student.student_id_number,
                                full_name: student.full_name,
                                status: record ? record.status : 'PRESENT',
                                notes: record ? record.notes || '' : ''
                            };
                        });
                        renderRosterRows(attendanceRoster, true);
                    } else {
                        throw new Error("Failed to load session details");
                    }
                } else {
                    currentAttendanceSession = null;
                    attendanceRoster = classStudents.map(student => ({
                        student_id: student.id,
                        student_id_number: student.student_id_number,
                        full_name: student.full_name,
                        status: 'PRESENT',
                        notes: ''
                    }));
                    renderRosterRows(attendanceRoster, false);
                }
            } else {
                throw new Error("Failed to load attendance roster dependencies");
            }
        } catch (error) {
            console.error("Error loading roster:", error);
            showToast("Failed to fetch roster. Falling back to simulation.", "error");
            isSimulated = true;
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
            if (isExisting && currentAttendanceSession) {
                statusDot.className = "w-2.5 h-2.5 rounded-full bg-emerald-500";
                statusText.textContent = `Recorded Session #${currentAttendanceSession.id}`;
                methodText.textContent = `Method: ${currentAttendanceSession.method}`;
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

    function setStudentStatus(studentId, status) {
        const student = attendanceRoster.find(s => s.student_id === studentId);
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

    function updateStudentNotes(studentId, value) {
        const student = attendanceRoster.find(s => s.student_id === studentId);
        if (student) {
            student.notes = value;
            
            // Sync values between table input and card input
            const inputTable = document.getElementById(`note-input-table-${studentId}`);
            const inputCard = document.getElementById(`note-input-card-${studentId}`);
            
            if (inputTable && inputTable.value !== value) inputTable.value = value;
            if (inputCard && inputCard.value !== value) inputCard.value = value;
        }
    }

    function updateRosterStats() {
        const statTotal = document.getElementById('stat-total-students');
        const statPresent = document.getElementById('stat-present-students');
        const statAbsent = document.getElementById('stat-absent-students');
        const statLate = document.getElementById('stat-late-students');
        const statExcused = document.getElementById('stat-excused-students');

        if (!statTotal) return;

        const total = attendanceRoster.length;
        const present = attendanceRoster.filter(s => s.status === 'PRESENT').length;
        const absent = attendanceRoster.filter(s => s.status === 'ABSENT').length;
        const late = attendanceRoster.filter(s => s.status === 'LATE').length;
        const excused = attendanceRoster.filter(s => s.status === 'EXCUSED').length;

        statTotal.textContent = `Students: ${total}`;
        statPresent.textContent = `Present: ${present}`;
        statAbsent.textContent = `Absent: ${absent}`;
        statLate.textContent = `Late: ${late}`;
        statExcused.textContent = `Excused: ${excused}`;
    }

    async function submitAttendance() {
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

        const targetTimeSlotId = attendanceMode === 'period' ? parseInt(periodId) : null;

        const records = attendanceRoster.map(student => ({
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

        if (isSimulated) {
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

    // =========================================================================
    // MERIT & DISCIPLINE MODULE
    // =========================================================================
    let meritOptionsList = [];
    let meritLogsList = [];

    const mockMeritOptions = [
        { id: 1, name: "Outstanding Classroom Helpfulness", points: 10, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 2, name: "Active Participation in Discussions", points: 5, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 3, name: "Perfect Weekly Attendance", points: 15, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 4, name: "Excellent Team Project Leadership", points: 20, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 5, name: "Classroom Disruption or Noise", points: -10, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 6, name: "Failure to Submit Homework on Time", points: -5, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    ];

    const mockMeritLogs = [
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

    function initMerit() {
        // No explicit setup needed as functions are exposed globally
    }

    async function loadMeritViewData() {
        const isAdmin = currentUser && currentUser.role === 'ADMIN';
        const rulesTabBtn = document.getElementById('btn-tab-merit-rules');
        if (rulesTabBtn) {
            if (isAdmin) {
                rulesTabBtn.classList.remove('hidden');
            } else {
                rulesTabBtn.classList.add('hidden');
            }
        }

        // Reset subtab to roster first
        switchMeritSubTab('roster');

        // Fetch classrooms if empty
        if (classroomsList.length === 0) {
            await fetchClassroomsForFilter();
        }
        populateMeritClassFilter();

        // Load data depending on isSimulated
        if (isSimulated) {
            // Ensure all mock students have merit_points initialized
            mockStudents.forEach(s => {
                if (s.merit_points === undefined) s.merit_points = 50;
            });
            studentsList = mockStudents;
            meritOptionsList = mockMeritOptions;
            if (meritLogsList.length === 0) {
                meritLogsList = mockMeritLogs;
            }
            updateAndRenderMeritAll();
        } else {
            try {
                // Fetch fresh student list to get up-to-date points
                const stuRes = await authFetch(`${API_BASE}/students/?skip=0&limit=500`);
                if (stuRes.ok) {
                    const data = await stuRes.json();
                    studentsList = data.items || [];
                }

                // Fetch options
                const optRes = await authFetch(`${API_BASE}/merit/options`);
                if (optRes.ok) {
                    meritOptionsList = await optRes.json();
                }

                // Fetch logs
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
        if (isSimulated) {
            classroomsList = mockClassrooms;
            return;
        }
        try {
            const res = await authFetch(`${API_BASE}/classes/?school_id=${currentSchoolId}`);
            if (res.ok) {
                const data = await res.json();
                classroomsList = data.items || [];
            }
        } catch (error) {
            console.error("Error fetching classrooms for filter:", error);
        }
    }

    function populateMeritClassFilter() {
        const select = document.getElementById('merit-class-filter');
        if (!select) return;
        select.innerHTML = '<option value="">All Classrooms</option>';
        classroomsList.forEach(c => {
            select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        });
    }

    function switchMeritSubTab(tabName) {
        const tabs = ['roster', 'logs', 'rules'];
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
    }

    function updateAndRenderMeritAll() {
        updateMeritKPIs();
        renderMeritRoster();
        renderMeritLogs();
        renderMeritRules();
    }

    function updateMeritKPIs() {
        const kpiAvg = document.getElementById('kpi-merit-avg');
        const kpiActions = document.getElementById('kpi-merit-actions');
        const kpiPos = document.getElementById('kpi-merit-positive');
        const kpiNeg = document.getElementById('kpi-merit-negative');

        if (studentsList.length > 0) {
            const sum = studentsList.reduce((acc, s) => acc + (s.merit_points !== undefined ? s.merit_points : 50), 0);
            const avg = (sum / studentsList.length).toFixed(1);
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

    function renderMeritRoster() {
        const tableBody = document.getElementById('merit-roster-table-body');
        if (!tableBody) return;

        const searchText = (document.getElementById('merit-student-search')?.value || '').toLowerCase();
        const classFilterVal = document.getElementById('merit-class-filter')?.value || '';

        const filtered = studentsList.filter(s => {
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
            const cls = classroomsList.find(c => c.id === s.class_id);
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

    function filterMeritRoster() {
        renderMeritRoster();
    }

    function renderMeritLogs() {
        const tableBody = document.getElementById('merit-logs-table-body');
        if (!tableBody) return;

        const isAdmin = currentUser && currentUser.role === 'ADMIN';

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

    function renderMeritLeaderboard(students) {
        const container = document.getElementById('merit-leaderboard-container');
        if (!container) return;

        // Ensure all students have merit points, defaulting to 50
        students.forEach(s => {
            if (s.merit_points === undefined) s.merit_points = 50;
        });

        // Filter active students and sort by points descending
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
            
            // Rank badge styling
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

    function renderMeritRules() {
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

    function openAwardPointsModal(studentId) {
        const student = studentsList.find(s => s.id === studentId);
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

    async function submitAwardPoints(event, studentId) {
        event.preventDefault();
        const optionId = parseInt(document.getElementById('award-option-id').value);
        const justification = document.getElementById('award-justification').value.trim();

        if (!justification) {
            showToast("Justification is required", "error");
            return;
        }

        if (isSimulated) {
            const student = mockStudents.find(s => s.id === studentId);
            const opt = mockMeritOptions.find(o => o.id === optionId);
            if (!student || !opt) return;

            student.merit_points = (student.merit_points || 50) + opt.points;

            const newLog = {
                id: meritLogsList.length + 1,
                student_id: studentId,
                user_id: currentUser ? currentUser.id : 999,
                merit_option_id: optionId,
                points_changed: opt.points,
                justification: justification,
                created_at: new Date().toISOString(),
                student: student,
                user: currentUser || { id: 999, full_name: "Noraini Binti Abdullah", role: "TEACHER" },
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

    function openCreateMeritOptionModal() {
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

    async function submitCreateMeritOption(event) {
        event.preventDefault();
        const name = document.getElementById('rule-name').value.trim();
        const points = parseInt(document.getElementById('rule-points').value);

        if (isSimulated) {
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

    function openEditMeritOptionModal(optionId) {
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

    async function submitEditMeritOption(event, optionId) {
        event.preventDefault();
        const name = document.getElementById('edit-rule-name').value.trim();
        const points = parseInt(document.getElementById('edit-rule-points').value);
        const is_active = document.getElementById('edit-rule-status').value === 'true';

        if (isSimulated) {
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

    async function deleteMeritOption(optionId) {
        if (!confirm("Are you sure you want to delete this merit rule? This will not affect existing student point scores.")) return;

        if (isSimulated) {
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

    async function deleteMeritLog(logId) {
        if (!confirm("Are you sure you want to delete this activity log? This is a permanent action and cannot be undone.")) return;

        if (isSimulated) {
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

    // Expose functions globally for HTML inline event handlers
    window.setStudentStatus = setStudentStatus;
    window.updateStudentNotes = updateStudentNotes;
    window.loadAttendanceViewData = loadAttendanceViewData;

    // Merit globals
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

    // =========================================================================
    // AUTOMATION MODULE
    // =========================================================================
    let selectedAutomationFile = null;

    function initAutomationView() {
        console.log("Initializing Automation View...");
        
        // Hide teachers selection for non-admin users
        const optTeachers = document.getElementById('opt-automation-teachers');
        const taskSelect = document.getElementById('automation-task-select');
        
        if (currentUser && currentUser.role !== 'ADMIN') {
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

    function onAutomationTaskChanged() {
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

    function handleSelectedAutomationFile(file) {
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

    function clearSelectedAutomationFile() {
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

    async function handleAutomationSubmit(e) {
        e.preventDefault();
        if (!selectedAutomationFile) return;
        
        const select = document.getElementById('automation-task-select');
        if (!select) return;
        const task = select.value;
        
        const submitBtn = document.getElementById('automation-submit-btn');
        const prevContent = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Processing Dataset...';
        
        if (isSimulated) {
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

    function renderAutomationResults(data) {
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

    // Expose helpers globally
    window.onAutomationTaskChanged = onAutomationTaskChanged;
    window.handleAutomationSubmit = handleAutomationSubmit;
    window.clearSelectedAutomationFile = clearSelectedAutomationFile;

    // =========================================================================
    // NOTIFICATION MODULE CONTROLLER
    // =========================================================================
    let notificationsActiveSubTab = 'connectors';

    async function loadNotificationsViewData() {
        showLoadingState();
        try {
            await Promise.all([
                loadNotificationConnectors(),
                loadNotificationRules(),
                loadNotificationLogs()
            ]);
        } catch (err) {
            console.error(err);
            showToast('Failed to load notifications hub data', 'error');
        } finally {
            hideLoadingState();
        }
    }

    function showLoadingState() {}
    function hideLoadingState() {}

    async function loadNotificationConnectors() {
        try {
            const res = await authFetch(`${API_BASE}/notifications/connectors`);
            const data = await res.json();
            const connectors = data.items || [];
            
            // Populates Email Form
            const emailConn = connectors.find(c => c.name === 'email');
            if (emailConn) {
                document.getElementById('email-connector-toggle').checked = emailConn.is_enabled;
                const config = JSON.parse(emailConn.config || '{}');
                document.getElementById('email-smtp-server').value = config.smtp_server || '';
                document.getElementById('email-smtp-port').value = config.smtp_port || '';
                document.getElementById('email-sender-email').value = config.sender_email || '';
                document.getElementById('email-sender-name').value = config.sender_name || '';
                document.getElementById('email-smtp-username').value = config.smtp_username || '';
                document.getElementById('email-smtp-password').value = config.smtp_password || '';
                document.getElementById('email-use-tls').checked = !!config.use_tls;
            }
            
            // Populates WhatsApp Form
            const waConn = connectors.find(c => c.name === 'whatsapp');
            if (waConn) {
                document.getElementById('whatsapp-connector-toggle').checked = waConn.is_enabled;
                const config = JSON.parse(waConn.config || '{}');
                document.getElementById('whatsapp-api-url').value = config.api_url || '';
                document.getElementById('whatsapp-account-sid').value = config.account_sid || '';
                document.getElementById('whatsapp-auth-token').value = config.auth_token || '';
                document.getElementById('whatsapp-sender-number').value = config.sender_number || '';
            }
        } catch (err) {
            console.error('Error fetching connectors:', err);
        }
    }

    async function loadNotificationRules() {
        try {
            const res = await authFetch(`${API_BASE}/notifications/rules`);
            const data = await res.json();
            const rules = data.items || [];
            
            const container = document.getElementById('notif-rules-list');
            if (!container) return;
            
            if (rules.length === 0) {
                container.innerHTML = `<div class="py-8 text-center text-slate-400">No rules configured.</div>`;
                return;
            }
            
            container.innerHTML = rules.map(rule => {
                const isFailedType = rule.event_type === 'assignment_failed';
                const thresholdHtml = isFailedType ? `
                    <div class="w-full sm:w-1/3">
                        <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Passing Grade Threshold (%)</label>
                        <input type="number" id="rule-threshold-${rule.event_type}-${rule.connector_type}" value="${rule.passing_threshold || 50}" min="1" max="100"
                            class="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20 text-xs font-semibold text-slate-800 outline-none transition-all">
                    </div>
                ` : '';
                
                const eventLabel = rule.event_type === 'student_absent' ? 'Student Absent Alert' : 'Failed Assignment Alert';
                const channelIcon = rule.connector_type === 'email' ? '<i class="fas fa-envelope text-brand-teal mr-1"></i> Email' : '<i class="fab fa-whatsapp text-green-500 mr-1"></i> WhatsApp';
                
                const placeholdersHelp = rule.event_type === 'student_absent' ? 
                    'Available: {student_name}, {date}' : 
                    'Available: {student_name}, {assignment_title}, {score}, {max_points}, {passing_threshold}';

                return `
                    <div class="py-6 flex flex-col md:flex-row md:items-start justify-between gap-6">
                        <div class="flex-1 space-y-4">
                            <div class="flex items-center justify-between">
                                <div>
                                    <h3 class="text-sm font-bold text-slate-900">${eventLabel}</h3>
                                    <span class="inline-flex items-center text-[10px] font-semibold text-slate-500 mt-0.5">${channelIcon}</span>
                                </div>
                                <label class="relative inline-flex items-center cursor-pointer select-none">
                                    <input type="checkbox" id="rule-toggle-${rule.event_type}-${rule.connector_type}" ${rule.is_enabled ? 'checked' : ''} 
                                        onchange="toggleRule('${rule.event_type}', '${rule.connector_type}')" class="sr-only peer">
                                    <div class="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-teal"></div>
                                </label>
                            </div>
                            
                            <div class="flex flex-col sm:flex-row gap-4 items-end">
                                <div class="flex-1">
                                    <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Message Template</label>
                                    <textarea id="rule-template-${rule.event_type}-${rule.connector_type}" rows="2"
                                        class="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20 text-xs font-medium text-slate-800 outline-none transition-all resize-none">${rule.template}</textarea>
                                    <span class="text-[10px] text-slate-400 font-medium">${placeholdersHelp}</span>
                                </div>
                                ${thresholdHtml}
                            </div>
                        </div>
                        <div class="md:self-end">
                            <button type="button" onclick="saveRuleSettings('${rule.event_type}', '${rule.connector_type}')"
                                class="w-full md:w-auto px-4 py-2 bg-brand-teal hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm">
                                <i class="fas fa-save"></i> Save Rule
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (err) {
            console.error('Error fetching rules:', err);
        }
    }

    async function loadNotificationLogs() {
        const tbody = document.getElementById('notif-logs-tbody');
        const footer = document.getElementById('notif-logs-footer');
        if (!tbody) return;
        
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="py-8 text-center text-slate-400">
                    <i class="fas fa-circle-notch fa-spin text-brand-teal mr-2"></i> Loading delivery logs...
                </td>
            </tr>`;
            
        try {
            const res = await authFetch(`${API_BASE}/notifications/logs?limit=50`);
            const data = await res.json();
            const logs = data.items || [];
            
            if (logs.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" class="py-8 text-center text-slate-400 font-medium">
                            <i class="fas fa-inbox text-lg block mb-1"></i> No notifications have been sent yet.
                        </td>
                    </tr>`;
                footer.innerText = 'Showing 0 logs';
                return;
            }
            
            tbody.innerHTML = logs.map(log => {
                const formattedTime = new Date(log.created_at).toLocaleString();
                
                const eventBadge = log.event_type === 'student_absent' ? 
                    '<span class="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-[10px] font-bold">Absent Alert</span>' :
                    '<span class="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-[10px] font-bold">Academic Alert</span>';
                    
                const channelBadge = log.channel === 'EMAIL' ?
                    '<span class="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-bold"><i class="fas fa-envelope mr-1"></i>Email</span>' :
                    '<span class="px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-[10px] font-bold"><i class="fab fa-whatsapp mr-1"></i>WhatsApp</span>';
                    
                const statusBadge = log.status === 'SENT' ?
                    '<span class="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold">Sent</span>' :
                    `<span class="px-2 py-0.5 bg-rose-50 text-rose-700 rounded-full text-[10px] font-bold" title="${escapeHtml(log.error_message || '')}">Failed</span>`;
                    
                const retryBtn = log.status === 'FAILED' ?
                    `<button type="button" onclick="retryNotificationLog(${log.id})" class="px-2.5 py-1 bg-brand-teal hover:bg-teal-700 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm"><i class="fas fa-rotate"></i> Retry</button>` :
                    '<span class="text-slate-400 font-semibold text-[10px]">&mdash;</span>';

                return `
                    <tr class="hover:bg-slate-50/50 transition-colors">
                        <td class="py-3.5 px-4 font-semibold text-slate-500 whitespace-nowrap">${formattedTime}</td>
                        <td class="py-3.5 px-4">${eventBadge}</td>
                        <td class="py-3.5 px-4">${channelBadge}</td>
                        <td class="py-3.5 px-4 font-bold text-slate-800">${log.student_name}</td>
                        <td class="py-3.5 px-4 font-semibold text-slate-600">${log.parent_contact}</td>
                        <td class="py-3.5 px-4 text-slate-600 max-w-xs truncate" title="${escapeHtml(log.message_body)}">${log.message_body}</td>
                        <td class="py-3.5 px-4 text-center">${statusBadge}</td>
                        <td class="py-3.5 px-4">${retryBtn}</td>
                    </tr>
                `;
            }).join('');
            
            footer.innerText = `Showing ${logs.length} log entries`;
        } catch (err) {
            console.error('Error fetching logs:', err);
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="py-8 text-center text-rose-500 font-medium">
                        <i class="fas fa-circle-exclamation text-lg block mb-1"></i> Failed to retrieve delivery history logs.
                    </td>
                </tr>`;
        }
    }

    function switchNotificationSubTab(subTab) {
        notificationsActiveSubTab = subTab;
        const tabs = ['connectors', 'rules', 'logs'];
        
        tabs.forEach(t => {
            const btn = document.getElementById(`notif-tab-${t}`);
            const panel = document.getElementById(`notif-panel-${t}`);
            
            if (btn && panel) {
                if (t === subTab) {
                    panel.classList.remove('hidden');
                    btn.classList.add('border-brand-teal', 'text-brand-teal');
                    btn.classList.remove('border-transparent', 'text-slate-500', 'hover:text-slate-700', 'hover:border-slate-300');
                } else {
                    panel.classList.add('hidden');
                    btn.classList.remove('border-brand-teal', 'text-brand-teal');
                    btn.classList.add('border-transparent', 'text-slate-500', 'hover:text-slate-700', 'hover:border-slate-300');
                }
            }
        });
    }

    async function toggleConnector(name) {
        const toggle = document.getElementById(`${name}-connector-toggle`);
        if (!toggle) return;
        
        try {
            const res = await authFetch(`${API_BASE}/notifications/connectors/${name}`, {
                method: 'PUT',
                body: JSON.stringify({ is_enabled: toggle.checked })
            });
            if (!res.ok) throw new Error('Update failed');
            showToast(`${name.toUpperCase()} connector ${toggle.checked ? 'enabled' : 'disabled'}`, 'success');
        } catch (err) {
            console.error(err);
            toggle.checked = !toggle.checked;
            showToast(`Failed to toggle connector`, 'error');
        }
    }

    async function saveConnectorSettings(name) {
        let config = {};
        if (name === 'email') {
            config = {
                smtp_server: document.getElementById('email-smtp-server').value,
                smtp_port: parseInt(document.getElementById('email-smtp-port').value || '587'),
                sender_email: document.getElementById('email-sender-email').value,
                sender_name: document.getElementById('email-sender-name').value,
                smtp_username: document.getElementById('email-smtp-username').value,
                smtp_password: document.getElementById('email-smtp-password').value,
                use_tls: document.getElementById('email-use-tls').checked
            };
        } else if (name === 'whatsapp') {
            config = {
                api_url: document.getElementById('whatsapp-api-url').value,
                account_sid: document.getElementById('whatsapp-account-sid').value,
                auth_token: document.getElementById('whatsapp-auth-token').value,
                sender_number: document.getElementById('whatsapp-sender-number').value
            };
        }
        
        try {
            const res = await authFetch(`${API_BASE}/notifications/connectors/${name}`, {
                method: 'PUT',
                body: JSON.stringify({ config: JSON.stringify(config) })
            });
            if (!res.ok) throw new Error('Save failed');
            showToast(`${name.toUpperCase()} configurations saved successfully`, 'success');
        } catch (err) {
            console.error(err);
            showToast(`Failed to save settings`, 'error');
        }
    }

    async function toggleRule(eventType, connectorType) {
        const toggle = document.getElementById(`rule-toggle-${eventType}-${connectorType}`);
        if (!toggle) return;
        
        try {
            const res = await authFetch(`${API_BASE}/notifications/rules/${eventType}/${connectorType}`, {
                method: 'PUT',
                body: JSON.stringify({ is_enabled: toggle.checked })
            });
            if (!res.ok) throw new Error('Toggle failed');
            showToast(`Rule updated successfully`, 'success');
        } catch (err) {
            console.error(err);
            toggle.checked = !toggle.checked;
            showToast(`Failed to toggle rule`, 'error');
        }
    }

    async function saveRuleSettings(eventType, connectorType) {
        const template = document.getElementById(`rule-template-${eventType}-${connectorType}`).value;
        const thresholdInput = document.getElementById(`rule-threshold-${eventType}-${connectorType}`);
        const passingThreshold = thresholdInput ? parseFloat(thresholdInput.value || '50') : null;
        
        try {
            const res = await authFetch(`${API_BASE}/notifications/rules/${eventType}/${connectorType}`, {
                method: 'PUT',
                body: JSON.stringify({ template, passing_threshold: passingThreshold })
            });
            if (!res.ok) throw new Error('Save failed');
            showToast(`Rule template and settings saved`, 'success');
        } catch (err) {
            console.error(err);
            showToast(`Failed to save rule settings`, 'error');
        }
    }

    function openTestConnectorModal(name) {
        const modal = document.getElementById('edit-modal');
        const content = document.getElementById('edit-modal-content');
        if (!modal || !content) return;
        
        const defaultRecipient = name === 'email' ? 'parent@example.com' : '+60123456789';
        const modalHtml = `
            <div class="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <i class="fas fa-paper-plane text-brand-teal"></i>
                    Test ${name.toUpperCase()} Connection
                </h3>
                <button onclick="closeEditModal()" class="text-slate-400 hover:text-slate-600 transition-colors">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <form onsubmit="submitTestConnector(event, '${name}')" class="p-6 space-y-4">
                <div>
                    <label for="test-notif-recipient" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Recipient Address / Phone</label>
                    <input type="text" id="test-notif-recipient" value="${defaultRecipient}" required
                        class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 outline-none transition-all">
                </div>
                <div>
                    <label for="test-notif-message" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Test Message</label>
                    <textarea id="test-notif-message" rows="3" required
                        class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 outline-none transition-all resize-none">Hello, this is a test notification message from EduPulse.</textarea>
                </div>
                <div class="flex gap-3 pt-2">
                    <button type="button" onclick="closeEditModal()"
                        class="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm transition-all text-center cursor-pointer">
                        Cancel
                    </button>
                    <button type="submit" id="test-notif-submit-btn"
                        class="flex-1 py-3 bg-brand-teal hover:bg-teal-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-brand-teal/10 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer">
                        Send Test Message
                    </button>
                </div>
            </form>
        `;
        
        content.innerHTML = modalHtml;
        modal.classList.remove('hidden');
        setTimeout(() => {
            content.classList.remove('scale-95', 'opacity-0');
            content.classList.add('scale-100', 'opacity-100');
        }, 10);
    }

    async function submitTestConnector(e, name) {
        e.preventDefault();
        const submitBtn = document.getElementById('test-notif-submit-btn');
        const recipient = document.getElementById('test-notif-recipient').value;
        const message = document.getElementById('test-notif-message').value;
        
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i> Sending...';
        }
        
        try {
            const res = await authFetch(`${API_BASE}/notifications/connectors/${name}/test`, {
                method: 'POST',
                body: JSON.stringify({ recipient, message })
            });
            const data = await res.json();
            
            if (res.ok) {
                showToast(`Test message successfully routed.`, 'success');
                closeEditModal();
            } else {
                throw new Error(data.detail || 'Test failed');
            }
        } catch (err) {
            console.error(err);
            showToast(`Test connection failed: ${err.message}`, 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Send Test Message';
            }
        }
    }

    async function retryNotificationLog(logId) {
        showToast('Retrying notification...', 'info');
        try {
            const res = await authFetch(`${API_BASE}/notifications/logs/${logId}/retry`, {
                method: 'POST'
            });
            const data = await res.json();
            if (res.ok) {
                showToast('Notification successfully re-sent!', 'success');
                loadNotificationLogs();
            } else {
                throw new Error(data.detail || 'Retry failed');
            }
        } catch (err) {
            console.error(err);
            showToast(`Retry failed: ${err.message}`, 'error');
            loadNotificationLogs();
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Expose helpers globally
    window.switchNotificationSubTab = switchNotificationSubTab;
    window.toggleConnector = toggleConnector;
    window.saveConnectorSettings = saveConnectorSettings;
    window.toggleRule = toggleRule;
    window.saveRuleSettings = saveRuleSettings;
    window.openTestConnectorModal = openTestConnectorModal;
    window.submitTestConnector = submitTestConnector;
    window.retryNotificationLog = retryNotificationLog;
    window.loadNotificationLogs = loadNotificationLogs;
    window.loadNotificationsViewData = loadNotificationsViewData;

    // =========================================================================
    // LOGOUT
    // =========================================================================
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logoutBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> <span>Signing out...</span>';
            logoutBtn.disabled = true;
            setTimeout(clearSessionAndRedirect, 600);
        });
    }

    // =========================================================================
    // INIT
    // =========================================================================
    initSidebar();
    initGrading();
    initSchedules();
    initAttendance();
    initMerit();
    initAutomationView();
    loadUserProfile();
});
