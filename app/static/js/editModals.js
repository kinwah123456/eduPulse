// EduPulse Ops — Edit Modals Module
// Handles dynamic edit forms and submissions for classrooms, students, teachers, subjects, and assessments

import { state, authFetch, API_BASE, mockClassrooms, mockTeachers, mockStudents, mockSubjects, mockAssessments } from './api.js';
import { showToast } from './ui.js';
import { loadClassroomsData } from './classrooms.js';
import { loadStudentsData } from './students.js';
import { loadTeachersData } from './teachers.js';
import { loadGradingData } from './grading.js';

export function openEditModal(type, id) {
    const modal = document.getElementById('edit-modal');
    const content = document.getElementById('edit-modal-content');
    if (!modal || !content) return;

    let modalHtml = '';

    if (type === 'subject') {
        const sub = state.subjectsList.find(s => s.id === id);
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
        const cls = state.classroomsList.find(c => c.id === id);
        if (!cls) return;

        // Generate teacher options
        let teacherOptions = '<option value="">Select form teacher (optional)...</option>';
        state.teachersList.forEach(t => {
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
        const student = state.studentsList.find(s => s.id === id);
        if (!student) return;

        const initials = (student.full_name || '')
            .split(' ')
            .map(n => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();

        const classroom = state.classroomsList.find(c => c.id === student.class_id);
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

                <div class="flex gap-3 pt-2 border-t border-slate-100">
                    <button type="button" onclick="closeEditModal()"
                        class="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm transition-all text-center cursor-pointer">
                        Close
                    </button>
                    ${(state.currentUser && state.currentUser.role === 'ADMIN') ? `
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
        const student = state.studentsList.find(s => s.id === id);
        if (!student) return;

        let classOptions = '<option value="">Unassigned</option>';
        state.classroomsList.forEach(c => {
            const selected = c.id === student.class_id ? 'selected' : '';
            classOptions += `<option value="${c.id}" ${selected}>${c.name} (Grade ${c.grade_level})</option>`;
        });

        modalHtml = `
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
        const teacher = state.teachersList.find(t => t.id === id);
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
        const teacher = state.teachersList.find(t => t.id === id);
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
        const assessment = state.assessmentsList.find(a => a.id === id);
        if (!assessment) return;

        let subjectOptions = '';
        state.subjectsList.forEach(s => {
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

        triggerEditOMRBuilderGeneration();
    }
}

export function closeEditModal() {
    const modal = document.getElementById('edit-modal');
    const content = document.getElementById('edit-modal-content');
    if (!modal || !content) return;
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

export async function submitEditClassroom(event, classId) {
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

    if (state.isSimulated) {
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

export async function submitEditStudent(event, studentId) {
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

    if (state.isSimulated) {
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

export async function submitEditTeacher(event, teacherId) {
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

    if (state.isSimulated) {
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

export async function submitEditAssessment(event, assessmentId) {
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

    if (state.isSimulated) {
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

export async function submitEditSubject(event, subjectId) {
    event.preventDefault();
    const submitBtn = document.getElementById('edit-subject-submit-btn');
    const originalHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Saving...';

    const name = document.getElementById('edit-subject-name').value;
    const code = document.getElementById('edit-subject-code').value;

    const payload = { name, code };

    if (state.isSimulated) {
        setTimeout(() => {
            const sub = mockSubjects.find(s => s.id === subjectId);
            if (sub) {
                sub.name = name;
                sub.code = code;
                showToast(`Subject "${name}" updated successfully`);
            }
            closeEditModal();
            loadGradingData(); // Reloads grading metadata/subjects list
        }, 500);
        return;
    }

    try {
        const response = await authFetch(`${API_BASE}/grading/subjects/${subjectId}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            showToast(`Subject "${name}" updated successfully`);
            closeEditModal();
            loadGradingData();
        } else {
            const err = await response.json();
            showToast(`Failed to update subject: ${err.detail || 'Server error'}`, 'error');
        }
    } catch (error) {
        console.error("Error updating subject:", error);
        showToast("Network error. Failed to update subject.", "error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHtml;
    }
}

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

            if (targetObject[i] === opt) {
                btn.className = 'w-7 h-7 rounded-full border border-brand-teal text-xs font-bold bg-brand-teal text-white shadow-sm flex items-center justify-center cursor-pointer';
            }

            btn.addEventListener('click', () => {
                if (targetObject[i] === opt) {
                    delete targetObject[i];
                    btn.className = 'w-7 h-7 rounded-full border border-slate-200 text-xs font-bold text-slate-500 hover:border-brand-teal hover:text-brand-teal transition-all flex items-center justify-center cursor-pointer';
                } else {
                    targetObject[i] = opt;
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

// Expose functions globally for legacy HTML event handlers
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.submitEditClassroom = submitEditClassroom;
window.submitEditStudent = submitEditStudent;
window.submitEditTeacher = submitEditTeacher;
window.submitEditAssessment = submitEditAssessment;
window.submitEditSubject = submitEditSubject;
