const API_BASE_URL = 'http://localhost:3000/api/v1';
let originalEnrolledIds = [];

function getAuthToken() {
    let token = localStorage.getItem('token');
    if (!token) return "";
    token = token.replace(/['"]+/g, '').trim();
    if (token.toLowerCase().startsWith('bearer ')) {
        token = token.substring(7).trim();
    }
    return `Bearer ${token}`;
}

document.addEventListener('DOMContentLoaded', async function() {
    // 1. Sidebar Resizer Logic
    const sidebar = document.getElementById('resizableSidebar');
    const resizer = document.getElementById('sidebarResizer');
    const mainContent = document.getElementById('mainContent');

    if (resizer) {
        resizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', stop);
        });

        function move(e) {
            let width = e.clientX;
            if (width > 180 && width < 450) {
                sidebar.style.width = width + 'px';
                mainContent.style.marginLeft = width + 'px';
                mainContent.style.width = `calc(100% - ${width}px)`;
            }
        }
        function stop() { document.removeEventListener('mousemove', move); }
    }

    // 2. Initial Setup
    const adminName = localStorage.getItem('username');
    if (document.getElementById('adminName')) {
        document.getElementById('adminName').textContent = adminName || "Admin";
    }

    await fillInstructors();
    await loadCourses();
    setupStudentFilter();

    // 3. Form Submission (Dynamic Admin & Instructor)
    const form = document.getElementById('addCourseForm');
    form.onsubmit = async function(e) {
        e.preventDefault();
        const editId = form.getAttribute('data-edit-id');
        const currentSelectedIds = Array.from(document.querySelectorAll('.enroll-check:checked'))
                                        .map(cb => Number(cb.value));

        const courseData = {
            name: document.getElementById('courseName').value.trim(),
            code: document.getElementById('courseCode').value.trim(),
            description: "Academic Course Content", 
            sections: parseInt(document.getElementById('sections').value) || 1,
            credits: 3, 
            instructorId: Number(document.getElementById('instructor').value),
            // تعديل ديناميكي: سحب ID الأدمن الحالي من التخزين
            adminId: Number(localStorage.getItem('userId')) || 1 
        };

        try {
            const url = editId ? `${API_BASE_URL}/courses/${editId}` : `${API_BASE_URL}/courses`;
            const method = editId ? 'PUT' : 'POST'; 
            const response = await fetch(url, {
                method: method,
                headers: { 'Authorization': getAuthToken(), 'Content-Type': 'application/json' },
                body: JSON.stringify(courseData)
            });

            if (response.ok) {
                if (editId) {
                    const studentsToAdd = currentSelectedIds.filter(id => !originalEnrolledIds.includes(id));
                    for (const studentId of studentsToAdd) {
                        await fetch(`${API_BASE_URL}/courses/${editId}/students`, {
                            method: 'POST',
                            headers: { 'Authorization': getAuthToken(), 'Content-Type': 'application/json' },
                            body: JSON.stringify({ studentId: studentId, section: "1", lecture: "A" })
                        });
                    }

                    const studentsToRemove = originalEnrolledIds.filter(id => !currentSelectedIds.includes(id));
                    for (const studentId of studentsToRemove) {
                        await fetch(`${API_BASE_URL}/courses/${editId}/students/${studentId}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': getAuthToken() }
                        });
                    }
                }

                closeModal();
                await loadCourses(); 
                Swal.fire({ icon: 'success', title: 'Saved Successfully', timer: 1500 });
            }
        } catch (error) { 
            console.error("Form submission error:", error);
            Swal.fire('Error', 'An error occurred while saving changes.', 'error');
        }
    };
});

// 4. Load Table Data
async function loadCourses() {
    try {
        const response = await fetch(`${API_BASE_URL}/courses`, { headers: { 'Authorization': getAuthToken() } });
        const result = await response.json();
        const courses = result.data || result;
        const tbody = document.getElementById('coursesTableBody');
        tbody.innerHTML = '';

        if (Array.isArray(courses)) {
            for (const course of courses) {
                const courseId = course.id || course.courseId;
                let count = 0;
                try {
                    const sRes = await fetch(`${API_BASE_URL}/courses/${courseId}/students`, { headers: { 'Authorization': getAuthToken() } });
                    const sData = await sRes.json();
                    count = (sData.data || sData).length || 0;
                } catch (e) { count = 0; }

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${course.code}</td>
                    <td>${course.name}</td>
                    <td>${course.instructor?.username || 'N/A'}</td>
                    <td><span class="student-count-badge">${count}</span></td>
                    <td>${course.sections || 1}</td> 
                    <td class="action-btns">
                        <button class="btn-edit" onclick='prepareEdit(${JSON.stringify(course)})'>Edit</button>
                        <button class="btn-delete" onclick="deleteCourse('${courseId}')">Delete</button>
                    </td>`;
                tbody.appendChild(tr);
            }
        }
    } catch (error) { console.error("Loading courses error:", error); }
}

// 5. Prepare Modal for Editing
async function prepareEdit(course) {
    const courseId = course.id || course.courseId;
    const form = document.getElementById('addCourseForm');
    form.setAttribute('data-edit-id', courseId);
    
    document.getElementById('modalTitle').innerText = "Edit Course & Enrollees";
    document.getElementById('courseName').value = course.name;
    document.getElementById('courseCode').value = course.code;
    
    // تعديل: التأكد من اختيار المدرس الصحيح أيا كان مسمى الـ ID
    document.getElementById('instructor').value = course.instructorId || course.instructor?.id || "";
    document.getElementById('sections').value = course.sections || 1;
    
    const enrollSec = document.getElementById('enrollmentSection');
    if (enrollSec) enrollSec.style.display = 'block';

    try {
        const response = await fetch(`${API_BASE_URL}/courses/${courseId}/students`, { headers: { 'Authorization': getAuthToken() } });
        const resJson = await response.json();
        const enrolled = resJson.data || resJson;
        
        originalEnrolledIds = Array.isArray(enrolled) ? enrolled.map(s => Number(s.studentId || s.id || s.userAccountId)) : [];
        await loadStudentsIntoModal(originalEnrolledIds);
    } catch (e) { 
        originalEnrolledIds = []; 
        await loadStudentsIntoModal([]); 
    }

    document.getElementById('courseModal').style.display = 'flex';
}

// 6. Load Students List into Modal
async function loadStudentsIntoModal(enrolledIds) {
    const listContainer = document.getElementById('studentListInside');
    listContainer.innerHTML = 'Loading...';
    try {
        const response = await fetch(`${API_BASE_URL}/users`, { headers: { 'Authorization': getAuthToken() } });
        const result = await response.json();
        const users = result.data || result;
        const students = Array.isArray(users) ? users.filter(u => u.userType?.toLowerCase() === 'student') : [];

        listContainer.innerHTML = '';
        students.forEach(student => {
            const sId = Number(student.id || student.userAccountId); 
            const isChecked = enrolledIds.includes(sId) ? 'checked' : '';
            
            const div = document.createElement('div');
            div.className = 'student-item';
            div.innerHTML = `
                <input type="checkbox" class="enroll-check" value="${sId}" ${isChecked} onchange="updateSelectedCount()">
                <div class="student-info">
                    <label>${student.username}</label>
                    <small>ID: ${sId}</small>
                </div>`;
            listContainer.appendChild(div);
        });
        updateSelectedCount();
    } catch (e) { listContainer.innerHTML = 'Error loading directory.'; }
}

// 7. Modal Control Functions
function openModal() {
    const form = document.getElementById('addCourseForm');
    form.reset();
    form.removeAttribute('data-edit-id');
    originalEnrolledIds = [];
    document.getElementById('modalTitle').innerText = "Add New Course";
    
    const enrollSec = document.getElementById('enrollmentSection');
    if (enrollSec) enrollSec.style.display = 'none';
    
    document.getElementById('courseModal').style.display = 'flex';
}

function closeModal() { document.getElementById('courseModal').style.display = 'none'; }

// 8. Utility Functions
function setupStudentFilter() {
    const searchInput = document.getElementById('studentSearchInside');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const term = e.target.value.toLowerCase();
            document.querySelectorAll('.student-item').forEach(item => {
                const text = item.innerText.toLowerCase();
                item.style.display = text.includes(term) ? 'flex' : 'none';
            });
        });
    }
}

async function fillInstructors() {
    try {
        const response = await fetch(`${API_BASE_URL}/users`, { headers: { 'Authorization': getAuthToken() } });
        const result = await response.json();
        const users = result.data || result;
        const select = document.getElementById('instructor');
        select.innerHTML = '<option value="">Select Instructor</option>';
        if (Array.isArray(users)) {
            users.filter(u => u.userType?.toLowerCase() === 'staff').forEach(u => {
                const opt = document.createElement('option');
                // تعديل ديناميكي لضمان عمل الـ ID الصحيح
                opt.value = u.id || u.userAccountId;
                opt.textContent = u.username;
                select.appendChild(opt);
            });
        }
    } catch (e) { console.error("Error filling instructors:", e); }
}

function updateSelectedCount() {
    const count = document.querySelectorAll('.enroll-check:checked').length;
    if (document.getElementById('selectedCount')) {
        document.getElementById('selectedCount').textContent = `${count} selected`;
    }
}

async function deleteCourse(id) {
    const confirm = await Swal.fire({ 
        title: 'Are you sure?', 
        text: "This will remove the course and all its enrollees!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33'
    });
    if (confirm.isConfirmed) {
        await fetch(`${API_BASE_URL}/courses/${id}`, { method: 'DELETE', headers: { 'Authorization': getAuthToken() } });
        await loadCourses();
    }
}

function logout() { 
    localStorage.clear(); 
    window.location.href = "../../index.html"; 
}