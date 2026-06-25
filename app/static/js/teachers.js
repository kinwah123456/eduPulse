// EduPulse Ops — Teachers Module
// Manages teacher registry listing, search filters, deactivation, and registration form submissions

import { state, authFetch, API_BASE, mockTeachers } from './api.js';
import { showToast } from './ui.js';

export async function loadTeachersData() {
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

    if (state.isSimulated) {
        setTimeout(loadSimulatedTeachers, 300);
        return;
    }

    try {
        const response = await authFetch(`${API_BASE}/teachers/?limit=500`);
        if (response.ok) {
            const data = await response.json();
            state.teachersList = data.items || [];
            renderTeachersTable(state.teachersList);
        } else {
            console.warn("Teachers API failed, rendering simulation.");
            loadSimulatedTeachers();
        }
    } catch (error) {
        console.error("Error loading teachers:", error);
        loadSimulatedTeachers();
    }
}

export function renderTeachersTable(teachers) {
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

export function loadSimulatedTeachers() {
    state.teachersList = mockTeachers;
    renderTeachersTable(mockTeachers);
}

export async function deactivateTeacher(teacherId) {
    if (!confirm("Are you sure you want to deactivate this teacher?")) return;

    if (state.isSimulated) {
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

// Bind Teachers Search query input
const searchTeachersInput = document.getElementById('search-teachers-input');
if (searchTeachersInput) {
    searchTeachersInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
            renderTeachersTable(state.teachersList);
            return;
        }
        const filtered = state.teachersList.filter(t => {
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

// Bind Create Teacher Form Submit
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
            school_id: state.currentSchoolId
        };

        if (state.isSimulated) {
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

// Expose functions globally for legacy HTML event handlers
window.loadTeachersData = loadTeachersData;
window.deactivateTeacher = deactivateTeacher;
