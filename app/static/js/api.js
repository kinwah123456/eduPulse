// EduPulse Ops — API Module
// Handles API calls, token verification, global state, and mock fallbacks

export const API_BASE = '/api/v1';

// Global state container shared across modules
export const state = {
    currentUser: null,
    currentTeacher: null,
    currentSchoolId: 1,
    isSimulated: false,
    classroomsList: [],
    teachersList: [],
    studentsList: [],
    assessmentsList: [],
    subjectsList: [],
    attendanceMode: 'daily',
    currentAttendanceSession: null,
    attendanceRoster: [],
    timeSlotsList: [],
    activeTimetable: null,
    scheduleEntriesList: [],
    pendingClassroomFilterId: null,
};

// =========================================================================
// MOCK DATA FOR SIMULATED/DEMO MODE
// =========================================================================
export const mockClassrooms = [
    { id: 1, name: '3 Cempaka', grade_level: 3, form_teacher_id: 1, capacity: 35, students: [1, 2, 3] },
    { id: 2, name: '5 Dahlia', grade_level: 5, form_teacher_id: 2, capacity: 40, students: [4, 5] },
    { id: 3, name: '4 Anggerik', grade_level: 4, form_teacher_id: 3, capacity: 38, students: [6] }
];

export const mockTeachers = [
    { id: 1, full_name: 'Noraini Binti Abdullah', employee_id: 'T8002', email: 'noraini@school.edu.my', contact_number: '+6012-3456789', emergency_contact: 'Husband: +6012-9876543', is_active: true },
    { id: 2, full_name: 'Zulkifli Bin Salleh', employee_id: 'T8005', email: 'zulkifli@school.edu.my', contact_number: '+6019-8765432', emergency_contact: 'Wife: +6019-1234567', is_active: true },
    { id: 3, full_name: 'Lim Kok Wing', employee_id: 'T8006', email: 'limkw@school.edu.my', contact_number: '+6017-1122334', emergency_contact: 'Son: +6017-4433221', is_active: true }
];

export const mockStudents = [
    { id: 1, student_id_number: 'S2001', full_name: 'Muhammad Ali Bin Hassan', class_id: 1, school_id: 1, is_active: true, father_contact: '+6012-3456789', mother_contact: '+6019-8765432', guardian_contact: '', residential_address: 'No. 5, Jalan Melawati 1, Kuala Lumpur', gender: 'MALE', identity_card_number: '120101-14-1111', birth_date: '2012-01-01', enroll_date: '2024-01-15' },
    { id: 2, student_id_number: 'S2002', full_name: 'Lim Wei Seng', class_id: 1, school_id: 1, is_active: true, father_contact: '+6011-2223334', mother_contact: '+6011-4445556', guardian_contact: '', residential_address: 'Flat PKNS, Ampang, Selangor', gender: 'MALE', identity_card_number: '120202-10-2222', birth_date: '2012-02-02', enroll_date: '2024-01-15' },
    { id: 3, student_id_number: 'S2003', full_name: 'Fatimah Binti Mahmud', class_id: 1, school_id: 1, is_active: true, father_contact: '+6013-4455667', mother_contact: '+6014-9988776', guardian_contact: '', residential_address: 'No. 22, Lorong Melati, Gombak', gender: 'FEMALE', identity_card_number: '120303-14-3333', birth_date: '2012-03-03', enroll_date: '2024-01-15' },
    { id: 4, student_id_number: 'S2004', full_name: 'Siti Aminah Binti Yusof', class_id: 2, school_id: 1, is_active: true, father_contact: '', mother_contact: '', guardian_contact: '+6016-5544332', residential_address: 'Kondominium Gaya, Melawati', gender: 'FEMALE', identity_card_number: '100404-14-4444', birth_date: '2010-04-04', enroll_date: '2022-01-10' },
    { id: 5, student_id_number: 'S2005', full_name: 'Ramu A/L Ganesan', class_id: 2, school_id: 1, is_active: true, father_contact: '+6012-7778889', mother_contact: '', guardian_contact: '', residential_address: 'Taman Permata, Ulu Kelang', gender: 'MALE', identity_card_number: '100505-08-5555', birth_date: '2010-05-05', enroll_date: '2022-01-10' },
    { id: 6, student_id_number: 'S2006', full_name: 'Tan Mei Ling', class_id: 3, school_id: 1, is_active: true, father_contact: '+6018-9990001', mother_contact: '+6018-1112223', guardian_contact: '', residential_address: 'No. 88, Jalan Permata 3, Melawati', gender: 'FEMALE', identity_card_number: '110606-14-6666', birth_date: '2011-06-06', enroll_date: '2023-01-12' }
];

export const mockSubjects = [
    { id: 1, name: 'Mathematics', code: 'MAT101', school_id: 1 },
    { id: 2, name: 'Science', code: 'SCI101', school_id: 1 },
    { id: 3, name: 'English', code: 'ENG101', school_id: 1 }
];

export const mockAssessments = [
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

export const mockGrades = [
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

export const mockAttendanceSessions = [
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

/** Create an authorized fetch wrapper */
export function authFetch(url, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Authorization': `Bearer ${token}`,
        ...(options.headers || {})
    };
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }
    return fetch(url, {
        ...options,
        headers: headers
    });
}

export function decodeJwtPayload(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = payload + '='.repeat((4 - payload.length % 4) % 4);
        return JSON.parse(atob(padded));
    } catch { return null; }
}

/** Check if a JWT token is expired (with 60s buffer) */
export function isTokenExpired(token) {
    const payload = decodeJwtPayload(token);
    if (!payload || !payload.exp) return false;
    return (payload.exp * 1000) < (Date.now() - 60000);
}
