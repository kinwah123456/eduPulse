// EduPulse Ops — Classroom Module
// Manages classroom listings, form submissions, and teacher drop-down population

import { state, authFetch, API_BASE, mockClassrooms, mockTeachers } from './api.js';
import { showToast, escapeHtml } from './ui.js';

export async function loadClassroomsData() {
    const tableBody = document.getElementById('classrooms-table-body');
    
    if (state.classroomsList.length > 0) {
        renderClassroomsTable(state.classroomsList, state.teachersList);
        populateTeacherDropdown(state.teachersList);
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

    if (state.isSimulated) {
        state.classroomsList = mockClassrooms;
        state.teachersList = mockTeachers;
        renderClassroomsTable(state.classroomsList, state.teachersList);
        populateTeacherDropdown(state.teachersList);
        return;
    }

    try {
        const [teachersRes, classesRes] = await Promise.allSettled([
            authFetch(`${API_BASE}/teachers/?limit=500`),
            authFetch(`${API_BASE}/classes/?school_id=${state.currentSchoolId}`)
        ]);

        if (teachersRes.status === 'fulfilled' && teachersRes.value.ok) {
            const data = await teachersRes.value.json();
            state.teachersList = data.items || [];
        }

        if (classesRes.status === 'fulfilled' && classesRes.value.ok) {
            const data = await classesRes.value.json();
            state.classroomsList = data.items || [];
            renderClassroomsTable(state.classroomsList, state.teachersList);
        } else if (state.classroomsList.length === 0) {
            console.warn("Classes API failed, rendering simulation.");
            loadSimulatedClassrooms();
        }
        
        // Populate default dropdowns is handled in main
        if (window.populateDefaultDropdowns) {
            window.populateDefaultDropdowns();
        }
    } catch (error) {
        console.error("Error loading classrooms:", error);
        if (state.classroomsList.length === 0) {
            loadSimulatedClassrooms();
        }
    }
}

export function populateTeacherDropdown(teachers) {
    const select = document.getElementById('class-teacher');
    if (!select) return;

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

export function renderClassroomsTable(classes, teachers) {
    const tableBody = document.getElementById('classrooms-table-body');
    if (!tableBody) return;

    const isAdmin = state.currentUser && state.currentUser.role === 'ADMIN';

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

    if (isAdmin) {
        document.querySelectorAll('.admin-action-header').forEach(el => el.classList.remove('hidden'));
    } else {
        document.querySelectorAll('.admin-action-header').forEach(el => el.classList.add('hidden'));
    }
}

export function loadSimulatedClassrooms() {
    state.classroomsList = mockClassrooms;
    state.teachersList = mockTeachers;
    populateTeacherDropdown(mockTeachers);
    renderClassroomsTable(mockClassrooms, mockTeachers);
}

// Bind Create Classroom Form Submission
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
            school_id: state.currentSchoolId,
            form_teacher_id: form_teacher_id ? parseInt(form_teacher_id) : null
        };

        if (state.isSimulated) {
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

// Expose functions globally for legacy HTML event handlers
window.loadClassroomsData = loadClassroomsData;
