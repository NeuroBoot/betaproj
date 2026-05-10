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
    const adminName = localStorage.getItem('username');
    if (document.getElementById('adminName')) {
        document.getElementById('adminName').textContent = adminName || "Admin";
    }

    await fillInstructors();
    await loadCourses();
    setupStudentFilter();

    const form = document.getElementById('addCourseForm');
    form.onsubmit = async function(e) {
        e.preventDefault();
        const editId = form.getAttribute('data-edit-id');
        
        // 1. تجميع الـ IDs للطلاب الذين تم اختيارهم من القائمة
        const selectedStudentIds = Array.from(document.querySelectorAll('.enroll-check:checked'))
                                        .map(cb => Number(cb.value));

        // 2. البيانات الأساسية فقط (لتجنب خطأ BadRequestException)
        const courseData = {
            name: document.getElementById('courseName').value.trim(),
            code: document.getElementById('courseCode').value.trim(),
            description: "Academic Course Content", 
            sections: parseInt(document.getElementById('sections').value) || 1,
            credits: 3, 
            instructorId: Number(document.getElementById('instructor').value),
            adminId: 1
        };

        try {
            const url = editId ? `${API_BASE_URL}/courses/${editId}` : `${API_BASE_URL}/courses`;
            const method = editId ? 'PUT' : 'POST'; 

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': getAuthToken(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(courseData)
            });

            if (response.ok) {
                const result = await response.json();
                // الحصول على ID الكورس سواء من التعديل أو كورس جديد
                const actualId = editId || result.id || result.data?.id;

                // 3. إرسال الطلاب في طلب منفصل (Enrollment)
                if (selectedStudentIds.length > 0 && actualId) {
                    await enrollStudentsToCourse(actualId, selectedStudentIds);
                }

                closeModal();
                await loadCourses(); 
                
                Swal.fire({
                    icon: 'success',
                    title: 'Saved Successfully',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
            } else {
                const errorData = await response.json();
                Swal.fire({
                    icon: 'error',
                    title: 'Action Failed',
                    text: errorData.message || "Please check course code uniqueness.",
                    confirmButtonColor: '#3085d6'
                });
            }
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Connection Error', text: 'Unable to reach the server.' });
        }
    };
});

// دالة إرسال الطلاب للسيرفر (تحتاج التأكد من الـ Route الصحيح في الـ Backend لديكِ)
async function enrollStudentsToCourse(courseId, studentIds) {
    try {
        // الافتراض هنا أن هناك Endpoint مخصص لربط الطلاب بالكورس
        await fetch(`${API_BASE_URL}/courses/${courseId}/enroll`, {
            method: 'POST',
            headers: {
                'Authorization': getAuthToken(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ studentIds: studentIds })
        });
    } catch (err) {
        console.error("Enrollment failed:", err);
    }
}

async function deleteCourse(id) {
    if (!id || id === 'undefined') return;
    const result = await Swal.fire({
        title: 'Are you sure?',
        text: "You won't be able to revert this!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
        try {
            const response = await fetch(`${API_BASE_URL}/courses/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': getAuthToken() }
            });
            if (response.ok) {
                Swal.fire('Deleted!', 'The course has been deleted.', 'success');
                await loadCourses();
            } else {
                Swal.fire('Error!', 'Failed to delete the course.', 'error');
            }
        } catch (error) {
            Swal.fire('Error!', 'Server connection lost.', 'error');
        }
    }
}

async function loadCourses() {
    try {
        const response = await fetch(`${API_BASE_URL}/courses`, {
            headers: { 'Authorization': getAuthToken() }
        });
        const result = await response.json();
        const courses = result.data || result;
        const tbody = document.getElementById('coursesTableBody');

        tbody.innerHTML = '';
        if (Array.isArray(courses)) {
            courses.forEach(course => {
                const courseId = course.id || course.courseId || course.userAccountId;
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${course.code}</td>
                    <td>${course.name}</td>
                    <td>${course.instructor ? (course.instructor.fullName || course.instructor.username) : 'N/A'}</td>
                    <td>${course.students ? course.students.length : 0}</td>
                    <td>${course.sections || 1}</td> 
                    <td class="action-btns">
                        <button class="btn-edit" onclick='prepareEdit(${JSON.stringify(course)})'>Edit</button>
                        <button class="btn-delete" onclick="deleteCourse('${courseId}')">Delete</button>
                    </td>`;
                tbody.appendChild(tr);
            });
        }
    } catch (error) { console.error(error); }
}

async function fillInstructors() {
    try {
        const response = await fetch(`${API_BASE_URL}/users`, {
            headers: { 'Authorization': getAuthToken() }
        });
        const result = await response.json();
        const users = result.data || result;
        const select = document.getElementById('instructor');
        if (Array.isArray(users)) {
            select.innerHTML = '<option value="">Select Instructor</option>';
            users.forEach(u => {
                if(u.userType?.toLowerCase() === 'staff' || u.role?.toLowerCase() === 'staff') {
                    const opt = document.createElement('option');
                    opt.value = u.id || u.userAccountId;
                    opt.textContent = u.fullName || u.username;
                    select.appendChild(opt);
                }
            });
        }
    } catch (error) { console.error(error); }
}

async function prepareEdit(course) {
    const form = document.getElementById('addCourseForm');
    const courseId = course.id || course.courseId || course.userAccountId;
    form.setAttribute('data-edit-id', courseId);
    
    document.getElementById('modalTitle').innerText = "Edit Course";
    document.getElementById('courseName').value = course.name;
    document.getElementById('courseCode').value = course.code;
    document.getElementById('instructor').value = course.instructorId || "";
    document.getElementById('sections').value = course.sections || 1;
    
    // تحميل الطلاب المختارين في هذا الكورس
    await loadStudentsIntoModal(course.students || []);
    document.getElementById('courseModal').style.display = 'flex';
}

function closeModal() { document.getElementById('courseModal').style.display = 'none'; }

async function openModal() {
    const form = document.getElementById('addCourseForm');
    form.reset();
    form.removeAttribute('data-edit-id');
    document.getElementById('modalTitle').innerText = "Add New Course";
    await loadStudentsIntoModal([]); 
    document.getElementById('courseModal').style.display = 'flex';
}

async function loadStudentsIntoModal(enrolledStudents) {
    const listContainer = document.getElementById('studentListInside');
    listContainer.innerHTML = '<p style="text-align: center; color: #8e94a9; padding: 10px;">Loading students...</p>';

    try {
        const response = await fetch(`${API_BASE_URL}/users`, {
            headers: { 'Authorization': getAuthToken() }
        });
        const result = await response.json();
        const users = result.data || result;
        
        // تصفية الطلاب فقط
        const students = users.filter(u => u.role?.toLowerCase() === 'student' || u.userType?.toLowerCase() === 'student');
        const enrolledIds = enrolledStudents.map(s => s.id || s.userAccountId);

        listContainer.innerHTML = '';
        students.forEach(student => {
            const studentId = student.id || student.userAccountId;
            const isChecked = enrolledIds.includes(studentId) ? 'checked' : '';
            
            const div = document.createElement('div');
            div.className = 'student-item';
            div.innerHTML = `
                <input type="checkbox" class="enroll-check" value="${studentId}" ${isChecked} onchange="updateSelectedCount()">
                <div class="student-info">
                    <label>${student.fullName || student.username}</label>
                    <small>ID: ${studentId}</small>
                </div>`;
            listContainer.appendChild(div);
        });
        updateSelectedCount();
    } catch (error) {
        listContainer.innerHTML = '<p style="color: #ff4d4d; padding: 10px;">Error loading students.</p>';
    }
}

function updateSelectedCount() {
    const count = document.querySelectorAll('.enroll-check:checked').length;
    if (document.getElementById('selectedCount')) {
        document.getElementById('selectedCount').textContent = `${count} selected`;
    }
}

function setupStudentFilter() {
    const searchInput = document.getElementById('studentSearchInside');
    if (!searchInput) return;
    searchInput.addEventListener('input', function(e) {
        const term = e.target.value.toLowerCase();
        document.querySelectorAll('.student-item').forEach(item => {
            const idText = item.querySelector('small').textContent.toLowerCase();
            item.style.display = idText.includes(term) ? 'flex' : 'none';
        });
    });
}

function logout() {
    localStorage.clear();
    window.location.href = "../../index.html";
}