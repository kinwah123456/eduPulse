// EduPulse Ops — Students Module
// Manages student directory list, search filters, classroom assignments, and enrollment form submissions

import { state, authFetch, API_BASE, mockClassrooms, mockStudents } from './api.js';
import { showToast } from './ui.js';

export async function loadStudentsData() {
    const tableBody = document.getElementById('students-table-body');
    
    const searchInput = document.getElementById('search-students-input');
    if (searchInput) {
        searchInput.value = '';
    }

    let initialFilterId = '';
    if (state.pendingClassroomFilterId) {
        initialFilterId = state.pendingClassroomFilterId;
        state.pendingClassroomFilterId = null; // Clear so subsequent direct navigations are not filtered
    }
    
    if (state.studentsList.length > 0) {
        renderStudentsTable(state.studentsList, state.classroomsList, initialFilterId);
        populateClassDropdowns(state.classroomsList);
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

    if (state.isSimulated) {
        state.studentsList = mockStudents;
        state.classroomsList = mockClassrooms;
        renderStudentsTable(state.studentsList, state.classroomsList, initialFilterId);
        populateClassDropdowns(state.classroomsList);
        if (initialFilterId) {
            const filterClassSelect = document.getElementById('filter-classroom');
            if (filterClassSelect) {
                filterClassSelect.value = initialFilterId;
            }
        }
        return;
    }

    try {
        const [classesRes, studentsRes] = await Promise.allSettled([
            authFetch(`${API_BASE}/classes/?school_id=${state.currentSchoolId}`),
            authFetch(`${API_BASE}/students/?skip=0&limit=500`)
        ]);

        if (classesRes.status === 'fulfilled' && classesRes.value.ok) {
            const data = await classesRes.value.json();
            state.classroomsList = data.items || [];
        }

        if (studentsRes.status === 'fulfilled' && studentsRes.value.ok) {
            const data = await studentsRes.value.json();
            state.studentsList = data.items || [];
            renderStudentsTable(state.studentsList, state.classroomsList, initialFilterId);
        } else if (state.studentsList.length === 0) {
            console.warn("Students API failed, rendering simulation.");
            loadSimulatedStudents(initialFilterId);
        }
        
        if (window.populateDefaultDropdowns) {
            window.populateDefaultDropdowns();
        }
        
        if (initialFilterId) {
            const filterClassSelect = document.getElementById('filter-classroom');
            if (filterClassSelect) {
                filterClassSelect.value = initialFilterId;
            }
        }
    } catch (error) {
        console.error("Error loading students:", error);
        if (state.studentsList.length === 0) {
            loadSimulatedStudents(initialFilterId);
        }
    }
}

export function populateClassDropdowns(classes) {
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

export function renderStudentsTable(students, classes, filterClassId = '', searchQuery = '') {
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

    const isAdmin = state.currentUser && state.currentUser.role === 'ADMIN';

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

        const deleteButton = isAdmin || (state.currentUser && state.currentUser.role === 'TEACHER')
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

export function loadSimulatedStudents(filterClassId = '') {
    state.classroomsList = mockClassrooms;
    state.studentsList = mockStudents;
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

export function viewClassroomStudents(classId) {
    state.pendingClassroomFilterId = classId;
    window.location.hash = '#students';
}

export async function updateStudentClass(studentId, classId) {
    console.log(`Reassigning student ID ${studentId} to classroom ${classId}`);
    const parsedClassId = classId ? parseInt(classId) : null;
    
    if (state.isSimulated) {
        const student = mockStudents.find(s => s.id === studentId);
        if (student) {
            student.class_id = parsedClassId;
            const clsName = parsedClassId ? mockClassrooms.find(c => c.id === parsedClassId).name : 'Unassigned';
            showToast(`Assigned ${student.full_name} to ${clsName}`);
            
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

export async function deactivateStudent(studentId) {
    if (!confirm("Are you sure you want to deactivate this student?")) return;

    if (state.isSimulated) {
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

// Bind Enrollment Form Submit
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
        const parent_email = document.getElementById('student-parent-email').value || null;
        const residential_address = document.getElementById('student-address').value;

        const payload = {
            student_id_number,
            full_name,
            class_id,
            school_id: state.currentSchoolId,
            is_active: true,
            identity_card_number,
            gender,
            birth_date,
            enroll_date,
            father_contact,
            mother_contact,
            guardian_contact,
            parent_email,
            residential_address
        };

        if (state.isSimulated) {
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
                    parent_email,
                    residential_address
                };
                mockStudents.push(newStudent);

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

// Bind Classroom Directory Filter
const filterClassroom = document.getElementById('filter-classroom');
if (filterClassroom) {
    filterClassroom.addEventListener('change', (e) => {
        const searchInput = document.getElementById('search-students-input');
        const q = searchInput ? searchInput.value : '';
        if (state.isSimulated) {
            renderStudentsTable(mockStudents, mockClassrooms, e.target.value, q);
        } else {
            renderStudentsTable(state.studentsList, state.classroomsList, e.target.value, q);
        }
    });
}

// Bind Students Search query
const searchStudentsInput = document.getElementById('search-students-input');
if (searchStudentsInput) {
    searchStudentsInput.addEventListener('input', (e) => {
        const filterClassVal = document.getElementById('filter-classroom').value;
        if (state.isSimulated) {
            renderStudentsTable(mockStudents, mockClassrooms, filterClassVal, e.target.value);
        } else {
            renderStudentsTable(state.studentsList, state.classroomsList, filterClassVal, e.target.value);
        }
    });
}

// Expose functions globally for legacy HTML event handlers
window.loadStudentsData = loadStudentsData;
window.viewClassroomStudents = viewClassroomStudents;
window.updateStudentClass = updateStudentClass;
window.deactivateStudent = deactivateStudent;
