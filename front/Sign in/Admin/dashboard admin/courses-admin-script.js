const API_BASE_URL = 'http://localhost:3000/api/v1';

// دالة جلب التوكن مع تنظيفه من أي زيادات
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
        
        // استخراج الـ IDs المختارة من الـ Checkboxes
        const selectedStudentIds = Array.from(document.querySelectorAll('.enroll-check:checked'))
                                        .map(cb => Number(cb.value));

        const courseData = {
            name: document.getElementById('courseName').value.trim(),
            code: document.getElementById('courseCode').value.trim(),
            description: "Academic Course Content", 
            sections: parseInt(document.getElementById('sections').value) || 1,
            instructorId: Number(document.getElementById('instructor').value),
            adminId: 1
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
                const result = await response.json();
                const actualId = editId || result.id || result.data?.id;

                // التعديل الجوهري: ننتظر (await) تسجيل الطلاب قبل إغلاق النافذة
                if (actualId) {
                    await enrollStudentsToCourse(actualId, selectedStudentIds);
                }

                closeModal();
                await loadCourses(); // تحديث الجدول فوراً بالبيانات الجديدة
                
                Swal.fire({
                    icon: 'success', title: 'Saved Successfully', toast: true,
                    position: 'top-end', showConfirmButton: false, timer: 3000
                });
            } else {
                const errorData = await response.json();
                Swal.fire({ icon: 'error', title: 'Error', text: errorData.message });
            }
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Connection Error', text: 'Server is unreachable.' });
        }
    };
});

// دالة تسجيل الطلاب المطورة
async function enrollStudentsToCourse(courseId, studentIds) {
    // نجلب الطلاب المسجلين حالياً عشان مانبعتش طلب متكرر (يتجنب 409 Conflict)
    let alreadyEnrolled = [];
    try {
        const res = await fetch(`${API_BASE_URL}/courses/${courseId}/students`, {
            headers: { 'Authorization': getAuthToken() }
        });
        const data = await res.json();
        alreadyEnrolled = (data.data || data).map(s => Number(s.id || s.userAccountId || s.studentId));
    } catch (e) { console.log("New course or error fetching existing."); }

    for (const studentId of studentIds) {
        if (!alreadyEnrolled.includes(studentId)) {
            try {
                await fetch(`${API_BASE_URL}/courses/${courseId}/students`, {
                    method: 'POST',
                    headers: { 'Authorization': getAuthToken(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({ studentId: studentId })
                });
            } catch (err) { console.error(`Enrollment failed for ${studentId}`); }
        }
    }
}

// تحميل الكورسات وعرض العدد الحقيقي للطلاب
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
            for (const course of courses) {
                const courseId = course.id || course.courseId;
                
                // جلب عدد الطلاب الدقيق من الـ Endpoint الخاص بهم
                let studentsCount = 0;
                try {
                    const sRes = await fetch(`${API_BASE_URL}/courses/${courseId}/students`, {
                        headers: { 'Authorization': getAuthToken() }
                    });
                    const sData = await sRes.json();
                    studentsCount = (sData.data || sData).length || 0;
                } catch (e) { studentsCount = 0; }

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${course.code}</td>
                    <td>${course.name}</td>
                    <td>${course.instructor ? (course.instructor.fullName || course.instructor.username) : 'N/A'}</td>
                    <td>${studentsCount}</td>
                    <td>${course.sections || 1}</td> 
                    <td class="action-btns">
                        <button class="btn-edit" onclick='prepareEdit(${JSON.stringify(course)})'>Edit</button>
                        <button class="btn-delete" onclick="deleteCourse('${courseId}')">Delete</button>
                    </td>`;
                tbody.appendChild(tr);
            }
        }
    } catch (error) { console.error("Load courses error:", error); }
}

// تحضير التعديل وعرض علامات الصح
async function prepareEdit(course) {
    const form = document.getElementById('addCourseForm');
    const courseId = course.id || course.courseId;
    form.setAttribute('data-edit-id', courseId);
    
    document.getElementById('modalTitle').innerText = "Edit Course";
    document.getElementById('courseName').value = course.name;
    document.getElementById('courseCode').value = course.code;
    document.getElementById('instructor').value = course.instructorId || "";
    document.getElementById('sections').value = course.sections || 1;
    
    try {
        // جلب قائمة الطلاب المسجلين فعلياً لتفعيل الـ Checkboxes
        const response = await fetch(`${API_BASE_URL}/courses/${courseId}/students`, {
            headers: { 'Authorization': getAuthToken() }
        });
        const result = await response.json();
        const enrolledStudents = result.data || result;
        await loadStudentsIntoModal(Array.isArray(enrolledStudents) ? enrolledStudents : []);
    } catch (error) {
        await loadStudentsIntoModal([]); 
    }
    document.getElementById('courseModal').style.display = 'flex';
}

// فتح المودال لإضافة جديدة (بدون علامات صح)
async function openModal() {
    const form = document.getElementById('addCourseForm');
    form.reset();
    form.removeAttribute('data-edit-id');
    document.getElementById('modalTitle').innerText = "Add New Course";
    await loadStudentsIntoModal([]); // مصفوفة فارغة لضمان عدم وجود علامات صح قديمة
    document.getElementById('courseModal').style.display = 'flex';
}

// بناء قائمة الطلاب داخل المودال
async function loadStudentsIntoModal(enrolledStudents) {
    const listContainer = document.getElementById('studentListInside');
    listContainer.innerHTML = 'Loading students...';

    try {
        const response = await fetch(`${API_BASE_URL}/users`, {
            headers: { 'Authorization': getAuthToken() }
        });
        const result = await response.json();
        const allUsers = result.data || result;
        
        const students = allUsers.filter(u => u.role?.toLowerCase() === 'student' || u.userType?.toLowerCase() === 'student');
        
        // استخراج الـ IDs بشكل آمن للمقارنة
        const enrolledIds = enrolledStudents.map(s => Number(s.id || s.userAccountId || s.studentId));

        listContainer.innerHTML = '';
        students.forEach(student => {
            const studentId = Number(student.id || student.userAccountId);
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
        listContainer.innerHTML = 'Error loading students.';
    }
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
                if(u.role?.toLowerCase() === 'staff' || u.userType?.toLowerCase() === 'staff') {
                    const opt = document.createElement('option');
                    opt.value = u.id || u.userAccountId;
                    opt.textContent = u.fullName || u.username;
                    select.appendChild(opt);
                }
            });
        }
    } catch (error) { console.error(error); }
}

async function deleteCourse(id) {
    const result = await Swal.fire({
        title: 'Are you sure?', icon: 'warning', showCancelButton: true,
        confirmButtonColor: '#d33', confirmButtonText: 'Yes, delete it!'
    });
    if (result.isConfirmed) {
        try {
            const res = await fetch(`${API_BASE_URL}/courses/${id}`, {
                method: 'DELETE', headers: { 'Authorization': getAuthToken() }
            });
            if (res.ok) await loadCourses();
        } catch (error) { console.error(error); }
    }
}

function closeModal() { document.getElementById('courseModal').style.display = 'none'; }
function updateSelectedCount() {
    const count = document.querySelectorAll('.enroll-check:checked').length;
    if (document.getElementById('selectedCount')) {
        document.getElementById('selectedCount').textContent = `${count} selected`;
    }
}
function setupStudentFilter() {
    const searchInput = document.getElementById('studentSearchInside');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const term = e.target.value.toLowerCase();
            document.querySelectorAll('.student-item').forEach(item => {
                const idText = item.querySelector('small').textContent.toLowerCase();
                item.style.display = idText.includes(term) ? 'flex' : 'none';
            });
        });
    }
}
function logout() { localStorage.clear(); window.location.href = "../../index.html"; }