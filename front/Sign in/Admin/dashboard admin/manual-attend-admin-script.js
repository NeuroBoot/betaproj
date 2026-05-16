const API_BASE_URL = 'http://localhost:3000/api/v1';

// التأكد من وجود مكتبة SweetAlert لضمان عدم حدوث Error
if (typeof Swal === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/sweetalert2@11';
    document.head.appendChild(script);
}

document.addEventListener('DOMContentLoaded', async () => {
    // 1. عرض اسم المستخدم
    const adminName = document.getElementById('adminName');
    if (adminName) adminName.textContent = localStorage.getItem('username') || "Aya_allah";

    // 2. تحميل الكورسات فور فتح الصفحة
    await loadCourses();

    // 3. تحديث السكاشن تلقائياً عند تغيير الكورس
    const courseSelect = document.getElementById('courseSelect');
    if (courseSelect) {
        courseSelect.addEventListener('change', function() {
            const selectedOpt = this.options[this.selectedIndex];
            const sectionsCount = selectedOpt.getAttribute('data-sections') || 4;
            updateSections(sectionsCount);
        });
    }
});

// ======================== HELPER FUNCTIONS ========================

function getAuthToken() {
    let token = localStorage.getItem('token') || "";
    token = token.replace(/['"]+/g, '').trim();
    return token.toLowerCase().startsWith('bearer ') ? token : `Bearer ${token}`;
}

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': getAuthToken()
    };
}

// ======================== API CALLS ========================

// تحميل الكورسات من الباك-إند
async function loadCourses() {
    const courseSelect = document.getElementById('courseSelect');
    try {
        const res = await fetch(`${API_BASE_URL}/courses`, { headers: authHeaders() });
        const result = await res.json();
        const courses = result.data || result;

        courseSelect.innerHTML = '<option hidden>Select Course</option>';
        if (Array.isArray(courses)) {
            courses.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id || c.courseId;
                opt.textContent = c.name;
                opt.setAttribute('data-sections', c.sectionsCount || 4);
                courseSelect.appendChild(opt);
            });
        }
    } catch (e) { console.error("Courses Error:", e); }
}

// تحديث قائمة السكاشن برقم السكاشن الخاص بكل مادة
function updateSections(count) {
    const sectionSelect = document.getElementById('sectionSelect');
    if (!sectionSelect) return;
    sectionSelect.innerHTML = '<option hidden>Select Section</option>';
    for (let i = 1; i <= count; i++) {
        const opt = document.createElement('option');
                opt.value = i;
        opt.textContent = `Section ${i}`;
        sectionSelect.appendChild(opt);
    }
}

// فتح المودال وجلب بيانات الطلاب
async function openDetails() {
    const courseId = document.getElementById('courseSelect').value;
    const section = document.getElementById('sectionSelect').value;
    const date = document.getElementById('dateInput').value;

    if (!courseId || courseId === "Select Course" || !section || !date) {
        return Swal.fire({ icon: 'warning', text: 'Please fill all fields!', background: "#1a1a3a", color: "#fff" });
    }

    // تحديث بيانات العرض في الـ Modal Header
    document.getElementById('disp-course').textContent = document.getElementById('courseSelect').options[document.getElementById('courseSelect').selectedIndex].text;
    document.getElementById('disp-section').textContent = section;
    document.getElementById('disp-date').textContent = date;

    document.getElementById('detailsModal').style.display = 'flex';
    const tbody = document.getElementById('attendanceTableBody');
    tbody.innerHTML = '<tr><td colspan="3">Searching for records...</td></tr>';

    try {
        // جلب الداتا بناءً على الـ Endpoint الخاص بالتحضير
        const url = `${API_BASE_URL}/attendance?courseId=${courseId}&section=${section}&date=${date}&limit=100`;
        const res = await fetch(url, { headers: authHeaders() });
        const result = await res.json();
        const records = result.data?.data || result.data || result;

        tbody.innerHTML = '';
        if (Array.isArray(records) && records.length > 0) {
            records.forEach(rec => {
                const tr = document.createElement('tr');
                // حفظ الـ studentId عشان نبعته في الـ POST
                tr.setAttribute('data-student-id', rec.studentId || rec.student?.id); 
                
                tr.innerHTML = `
                    <td>${rec.student?.userAccountId || rec.studentId || 'N/A'}</td>
                    <td>${rec.student?.username || rec.studentName || 'Unknown'}</td>
                    <td>
                        <select class="status-select">
                            <option value="Present" ${rec.attendanceStatusId == 1 ? 'selected' : ''}>Present</option>
                            <option value="Late" ${rec.attendanceStatusId == 2 ? 'selected' : ''}>Late</option>
                            <option value="Absent" ${rec.attendanceStatusId == 3 ? 'selected' : ''}>Absent</option>
                        </select>
                    </td>`;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="3">No attendance records found for this selection.</td></tr>';
        }
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="3">Error loading data.</td></tr>';
    }
}

// دالة حفظ الحضور (Bulk Save) باستخدام POST
async function saveAttendance() {
    const rows = document.querySelectorAll('#attendanceTableBody tr');
    const saveBtn = document.getElementById("saveBtn"); // تأكدي إن الزرار في HTML واخد id="saveBtn"
    
    const courseId = document.getElementById('courseSelect').value;
    const date = document.getElementById('dateInput').value;

    // منع الخطأ في حالة عدم وجود داتا في الجدول
    if (rows.length === 0 || rows[0].innerText.includes("No attendance records")) return;

    if (saveBtn) saveBtn.disabled = true;

    const attendanceRecords = [];
    rows.forEach(row => {
        const studentId = row.getAttribute("data-student-id");
        const statusSelect = row.querySelector(".status-select");

        // تجميع الداتا بالمسميات اللي الباك طلبها بالظبط (Present, Absent, Late)
        if (studentId && statusSelect) {
            attendanceRecords.push({
                studentId: studentId,
                status: statusSelect.value 
            });
        }
    });

    try {
        // إرسال طلب POST واحد لكل السجلات
        const res = await fetch(`${API_BASE_URL}/attendance`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({
                courseId: courseId,
                date: date,
                attendance: attendanceRecords // تغيير الاسم لـ attendance بدل records
            })
        });

        if (res.ok) {
            Swal.fire({
                title: 'Success!',
                text: 'Attendance saved successfully.',
                icon: 'success',
                background: "#1a1a3a",
                color: "#fff"
            });
            closeDetails();
        } else {
            const errorData = await res.json();
            Swal.fire({ icon: 'error', title: 'Failed', text: errorData.message || 'Error saving data' });
        }
    } catch (err) {
        console.error("Save Error:", err);
        Swal.fire({ icon: 'error', title: 'Network Error' });
    } finally {
        if (saveBtn) saveBtn.disabled = false;
    }
}

function closeDetails() {
    document.getElementById('detailsModal').style.display = 'none';
}