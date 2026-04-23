const API_BASE_URL = 'http://localhost:3000/api/v1';

// --- 1. الدوال المساعدة (Helpers) ---

// دالة جلب التوكن الموحدة لضمان الصلاحية
function getAuthToken() {
    let token = localStorage.getItem('token');
    if (!token) return "";
    token = token.replace(/['"]+/g, '').trim();
    return token.toLowerCase().startsWith('bearer ') ? token : `Bearer ${token}`;
}

document.addEventListener('DOMContentLoaded', async () => {
    // تحديث اسم المستخدم (آية الله) في السايد بار
    const nameDisplay = document.getElementById('adminName') || 
                        document.getElementById('admin-name') || 
                        document.getElementById('userNameDisplay');
    const savedName = localStorage.getItem('username');
    if (nameDisplay) nameDisplay.textContent = savedName ? savedName : "آية الله";

    // تحميل البيانات الأساسية أول ما الصفحة تفتح
    await loadCoursesToSelect();
    await loadRecentRecords();

    // تحديث السكاشن تلقائياً عند اختيار كورس
    const courseSelect = document.getElementById('courseSelect');
    if (courseSelect) {
        courseSelect.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            const sectionCount = selectedOption.getAttribute('data-sections') || 0;
            updateSections(sectionCount);
        });
    }

    setupSidebar();
});

// --- 2. إدارة البيانات (API Calls) ---

// جلب الكورسات من الـ API
async function loadCoursesToSelect() {
    const courseSelect = document.getElementById('courseSelect');
    if (!courseSelect) return;

    try {
        const response = await fetch(`${API_BASE_URL}/courses`, {
            headers: { 'Authorization': getAuthToken() }
        });
        const result = await response.json();
        const courses = result.data || result;

        if (Array.isArray(courses)) {
            courseSelect.innerHTML = '<option value="">Select Course</option>';
            courses.forEach(course => {
                const opt = document.createElement('option');
                opt.value = course.id;
                opt.textContent = course.name;
                opt.setAttribute('data-sections', course.sections || 1); //
                courseSelect.appendChild(opt);
            });
        }
    } catch (error) { console.error("Error loading courses:", error); }
}

// جلب السجلات الحديثة (Recent Records)
async function loadRecentRecords() {
    const recordsContainer = document.querySelector('.recent-records-list');
    if (!recordsContainer) return;

    try {
        const response = await fetch(`${API_BASE_URL}/attendance`, {
            headers: { 'Authorization': getAuthToken() }
        });
        const result = await response.json();
        const records = result.data || result;

        recordsContainer.innerHTML = ''; // مسح البيانات الثابتة القديمة

        if (Array.isArray(records) && records.length > 0) {
            records.slice(0, 5).forEach(record => {
                const attendanceRate = record.totalStudents > 0 
                    ? Math.round((record.presentCount / record.totalStudents) * 100) 
                    : 0;

                const div = document.createElement('div');
                div.className = 'record-item'; 
                div.innerHTML = `
                    <div class="record-info">
                        <h3>${record.courseName} - Section ${record.sectionName}</h3>
                        <p>${new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                    <div class="record-stats">
                        <span>${record.presentCount}/${record.totalStudents} students</span>
                        <span class="percentage" style="color: ${attendanceRate > 80 ? '#2ecc71' : '#f1c40f'}">
                            ${attendanceRate}% attendance
                        </span>
                    </div>`;
                recordsContainer.appendChild(div);
            });
        } else {
            recordsContainer.innerHTML = '<p style="text-align:center; padding:20px;">No recent records found.</p>';
        }
    } catch (error) { console.error("Error loading records:", error); }
}

// جلب الطلاب الحقيقيين عند فتح الـ Modal
async function openDetails() {
    const courseSelect = document.getElementById('courseSelect');
    const sectionSelect = document.getElementById('sectionSelect');
    const dateInput = document.getElementById('dateInput');

    const courseId = courseSelect.value;
    const sectionName = sectionSelect.options[sectionSelect.selectedIndex]?.text;
    const date = dateInput.value;

    if (!courseId || !sectionName || !date) {
        alert("Please select Course, Section, and Date!");
        return;
    }

    // تحديث بيانات المودال
    document.getElementById('disp-course').innerText = courseSelect.options[courseSelect.selectedIndex].text;
    document.getElementById('disp-section').innerText = sectionName;
    document.getElementById('disp-date').innerText = date;

    const tableBody = document.querySelector('#detailsModal table tbody');
    tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Loading Students...</td></tr>';

    try {
        const response = await fetch(`${API_BASE_URL}/courses/${courseId}/students`, {
            headers: { 'Authorization': getAuthToken() }
        });
        const students = await response.json();

        tableBody.innerHTML = ''; // مسح البيانات الثابتة

        if (Array.isArray(students) && students.length > 0) {
            students.forEach(student => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${student.studentID || student.id}</td>
                    <td>${student.fullName || student.username}</td>
                    <td>
                        <select class="status-select" data-student-id="${student.id}">
                            <option value="present">Present</option>
                            <option value="absent">Absent</option>
                            <option value="late">Late</option>
                        </select>
                    </td>`;
                tableBody.appendChild(tr);
            });
        } else {
            tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No students enrolled.</td></tr>';
        }
    } catch (error) { tableBody.innerHTML = '<tr><td colspan="3" style="color:red;">Error loading students.</td></tr>'; }

    document.getElementById('detailsModal').style.display = 'flex';
}

// حفظ الحضور اليدوي (Bulk Save)
async function saveAttendance() {
    const rows = document.querySelectorAll('.status-select');
    const courseId = document.getElementById('courseSelect').value;
    const date = document.getElementById('dateInput').value;
    
    const attendanceData = Array.from(rows).map(select => ({
        studentId: select.getAttribute('data-student-id'),
        status: select.value,
        courseId: parseInt(courseId),
        date: date
    }));

    try {
        const response = await fetch(`${API_BASE_URL}/attendance`, {
            method: 'POST',
            headers: { 'Authorization': getAuthToken(), 'Content-Type': 'application/json' },
            body: JSON.stringify(attendanceData)
        });

        if (response.ok) {
            alert("Attendance saved successfully!");
            closeDetails();
            await loadRecentRecords(); // تحديث السجلات الحديثة فوراً
        }
    } catch (e) { console.error(e); }
}

// --- 3. وظائف الواجهة (UI Functions) ---

function updateSections(count) {
    const sectionSelect = document.getElementById('sectionSelect');
    if (!sectionSelect) return;
    sectionSelect.innerHTML = '<option value="">Select Section</option>';
    for (let i = 1; i <= count; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `Section ${String.fromCharCode(64 + i)}`;
        sectionSelect.appendChild(opt);
    }
}

function closeDetails() {
    document.getElementById('detailsModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

function setupSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const resizer = document.getElementById('sidebarResizer');
    if (resizer && sidebar) {
        resizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const resizeMove = (e) => {
                const newWidth = e.clientX;
                if (newWidth > 200 && newWidth < 500) sidebar.style.width = newWidth + 'px';
            };
            document.addEventListener('mousemove', resizeMove);
            document.addEventListener('mouseup', () => document.removeEventListener('mousemove', resizeMove));
        });
    }
}

function logout() {
    localStorage.clear();
    window.location.href = "../../index.html";
}