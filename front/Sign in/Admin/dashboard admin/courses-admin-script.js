const API_BASE_URL = 'http://localhost:3000/api/v1';

// دالة تجلب التوكن وتنظفه من أي علامات زائدة
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
    // عرض اسمك في السايدبار
    const adminName = localStorage.getItem('username');
    if (document.getElementById('adminName')) {
        document.getElementById('adminName').textContent = adminName || "آية الله";
    }

    await fillInstructors();
    await loadCourses();

    // --- إضافة وتعديل الكورس ---
    const form = document.getElementById('addCourseForm');
    form.onsubmit = async function(e) {
        e.preventDefault();
        const editId = form.getAttribute('data-edit-id');
        
        // بناء البيانات كما يطلبها السيرفر بالظبط
        const courseData = {
            name: document.getElementById('courseName').value,
            code: document.getElementById('courseCode').value,
            description: "Academic Course Content", 
            sections: parseInt(document.getElementById('sections').value) || 1, // تم التعديل من numberOfSections لـ sections
            credits: 3, 
            instructorId: parseInt(document.getElementById('instructor').value),
            adminId: 1 // الـ ID الخاص بكِ كأدمن
        };

        try {
            const url = editId ? `${API_BASE_URL}/courses/${editId}` : `${API_BASE_URL}/courses`;
            const method = editId ? 'PATCH' : 'POST'; 

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': getAuthToken(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(courseData)
            });

            if (response.ok) {
                alert(editId ? "تم التعديل بنجاح!" : "تمت الإضافة بنجاح!");
                closeModal();
                await loadCourses(); 
            } else {
                const errorData = await response.json();
                // تنبيه في حالة وجود كود مكرر
                alert("خطأ: " + (errorData.message || "فشل حفظ البيانات"));
            }
        } catch (error) {
            console.error("Save Error:", error);
        }
    };
});

// --- دالة تحميل الجدول مع ربط الـ ID الصحيح ---
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
                const tr = document.createElement('tr');
                // نمرر course.id لضمان عمل الحذف والتعديل
                tr.innerHTML = `
                    <td>${course.code}</td>
                    <td>${course.name}</td>
                    <td>${course.instructor ? (course.instructor.fullName || course.instructor.username) : 'لا يوجد'}</td>
                    <td>0</td>
                    <td>${course.sections || 1}</td> 
                    <td class="action-btns">
                        <button class="btn-edit" onclick='prepareEdit(${JSON.stringify(course)})'>
                             Edit
                        </button>
                        <button class="btn-delete" onclick="deleteCourse(${course.id})">
                             Delete
                        </button>
                    </td>`;
                tbody.appendChild(tr);
            });
        }
    } catch (error) {
        console.error("Load Error:", error);
    }
}

// --- دالة الحذف (Authorization أضيفت هنا) ---
async function deleteCourse(id) {
    if (!id || !confirm('هل أنتِ متأكدة من حذف هذا الكورس؟')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/courses/${id}`, {
            method: 'DELETE',
            headers: { 
                'Authorization': getAuthToken() 
            }
        });

        if (response.ok) {
            alert("تم الحذف بنجاح!");
            await loadCourses();
        } else {
            const errorData = await response.json();
            alert("فشل الحذف: " + (errorData.message || "Unauthorized"));
        }
    } catch (error) {
        console.error("Delete Error:", error);
    }
}

// --- دالة ملء قائمة المدرسين ---
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
            const staff = users.filter(u => u.userType?.toLowerCase() === 'staff' || u.role?.toLowerCase() === 'staff');
            staff.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.id;
                opt.textContent = s.fullName || s.username;
                select.appendChild(opt);
            });
        }
    } catch (error) { console.error(error); }
}

// --- التحكم في الـ Modal ---
function prepareEdit(course) {
    const form = document.getElementById('addCourseForm');
    form.setAttribute('data-edit-id', course.id);
    document.getElementById('modalTitle').innerText = "Edit Course";
    document.getElementById('courseName').value = course.name;
    document.getElementById('courseCode').value = course.code;
    document.getElementById('instructor').value = course.instructorId || "";
    document.getElementById('sections').value = course.sections || 1;
    document.getElementById('courseModal').style.display = 'flex';
}

function openModal() {
    const form = document.getElementById('addCourseForm');
    form.reset();
    form.removeAttribute('data-edit-id');
    document.getElementById('modalTitle').innerText = "Add New Course";
    document.getElementById('courseModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('courseModal').style.display = 'none';
}