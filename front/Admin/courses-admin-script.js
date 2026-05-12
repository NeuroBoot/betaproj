const API_BASE_URL = 'http://localhost:3000/api/v1';

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
    const sidebar = document.getElementById('resizableSidebar');
    const resizer = document.getElementById('sidebarResizer');
    const mainContent = document.getElementById('mainContent');

    // 1. Sidebar Resizer
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

    // 2. Initial Data Loading
    await loadInstructors();
    await loadCourses();

    // 3. Form Submission
    document.getElementById('addCourseForm').onsubmit = async function(e) {
        e.preventDefault();
        
        const courseId = document.getElementById('courseId').value;
        const courseData = {
            name: document.getElementById('courseName').value.trim(),
            code: document.getElementById('courseCode').value.trim(),
            instructorId: parseInt(document.getElementById('instructorSelect').value),
            sections: parseInt(document.getElementById('sections').value),
            credits: parseInt(document.getElementById('credits').value),
            schedule: document.getElementById('schedule').value.trim()
        };

        try {
            const method = courseId ? 'PUT' : 'POST';
            const url = courseId ? `${API_BASE_URL}/courses/${courseId}` : `${API_BASE_URL}/courses`;
            
            const res = await fetch(url, {
                method: method,
                headers: { 
                    'Authorization': getAuthToken(),
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify(courseData)
            });

            if (res.ok) {
                Swal.fire({
                    icon: 'success',
                    title: courseId ? 'Course Updated' : 'Course Added',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
                closeModal();
                await loadCourses();
            } else {
                const err = await res.json();
                Swal.fire('Error', err.message || 'Operation failed', 'error');
            }
        } catch (err) {
            console.error(err);
            Swal.fire('Error', 'Connection failed', 'error');
        }
    };
});

async function loadInstructors() {
    const select = document.getElementById('instructorSelect');
    try {
        const res = await fetch(`${API_BASE_URL}/users`, {
            headers: { 'Authorization': getAuthToken() }
        });
        const result = await res.json();
        const users = result.data || result;
        
        select.innerHTML = '<option value="" hidden>Select Instructor</option>';
        if (Array.isArray(users)) {
            const staff = users.filter(u => (u.role || u.userType) === 'staff');
            staff.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.userAccountId || s.id;
                opt.textContent = s.fullName || s.username;
                select.appendChild(opt);
            });
        }
    } catch (e) {
        console.error(e);
        select.innerHTML = '<option value="">Error loading staff</option>';
    }
}

async function loadCourses() {
    const tbody = document.getElementById('coursesTableBody');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Loading courses...</td></tr>';

    try {
        const res = await fetch(`${API_BASE_URL}/courses`, {
            headers: { 'Authorization': getAuthToken() }
        });
        const result = await res.json();
        const courses = result.data || result;

        tbody.innerHTML = '';
        if (Array.isArray(courses)) {
            courses.forEach(c => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${c.code}</td>
                    <td>${c.name}</td>
                    <td>${c.instructor?.fullName || c.instructor?.username || 'N/A'}</td>
                    <td>${c.credits || 0}</td>
                    <td>${c.sections || 1}</td>
                    <td class="action-btns">
                        <button class="btn-edit" onclick='openEditModal(${JSON.stringify(c)})'><i class="fas fa-edit"></i></button>
                        <button class="btn-delete" onclick="deleteCourse(${c.courseId})"><i class="fas fa-trash"></i></button>
                    </td>`;
                tbody.appendChild(tr);
            });
            if (courses.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No courses found.</td></tr>';
            }
        }
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: red;">Error loading courses.</td></tr>';
    }
}

window.openModal = function() {
    document.getElementById('addCourseForm').reset();
    document.getElementById('courseId').value = '';
    document.getElementById('modalTitle').innerText = "Add New Course";
    document.getElementById('submitBtn').innerText = "Add Course";
    document.getElementById('courseModal').style.display = 'flex';
};

window.closeModal = function() {
    document.getElementById('courseModal').style.display = 'none';
};

window.openEditModal = function(course) {
    document.getElementById('courseId').value = course.courseId;
    document.getElementById('courseName').value = course.name;
    document.getElementById('courseCode').value = course.code;
    document.getElementById('instructorSelect').value = course.instructor?.userAccountId || course.instructor?.id || '';
    document.getElementById('sections').value = course.sections;
    document.getElementById('credits').value = course.credits;
    document.getElementById('schedule').value = course.schedule || '';

    document.getElementById('modalTitle').innerText = "Edit Course";
    document.getElementById('submitBtn').innerText = "Update Course";
    document.getElementById('courseModal').style.display = 'flex';
};

window.deleteCourse = async function(id) {
    const result = await Swal.fire({
        title: 'Delete Course?',
        text: "You won't be able to revert this!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
        try {
            const res = await fetch(`${API_BASE_URL}/courses/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': getAuthToken() }
            });
            if (res.ok) {
                Swal.fire('Deleted!', 'Course has been removed.', 'success');
                await loadCourses();
            } else {
                Swal.fire('Error', 'Failed to delete course', 'error');
            }
        } catch (e) {
            Swal.fire('Error', 'Connection failed', 'error');
        }
    }
};
