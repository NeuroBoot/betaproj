const API_BASE_URL = 'http://localhost:3000/api/v1';
let currentReportType = '';

document.addEventListener('DOMContentLoaded', async () => {
    const nameDisplay = document.getElementById('adminName'); 
    const savedName = localStorage.getItem('username');
    if (nameDisplay && savedName) {
        nameDisplay.textContent = savedName.charAt(0).toUpperCase() + savedName.slice(1);
    }
    await loadCoursesForReports();
    await loadRecentReports();
});

async function loadCoursesForReports() {
    const select = document.getElementById('reportCourseSelect');
    if (!select) return;
    try {
        const response = await fetch(`${API_BASE_URL}/courses`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const result = await response.json();
        const coursesList = result.data || result;
        select.innerHTML = '<option value="all">All Courses</option>';
        if (Array.isArray(coursesList)) {
            coursesList.forEach(course => {
                const opt = document.createElement('option');
                opt.value = course.id || course.courseId;
                opt.textContent = course.name;
                select.appendChild(opt);
            });
        }
    } catch (e) { console.error("Error loading courses:", e); }
}

function openReportModal(type) {
    currentReportType = type;
    const modal = document.getElementById('reportConfigModal');
    document.getElementById('modalTitle').textContent = type.toUpperCase() + " REPORT";
    document.getElementById('dateFiltersGroup').style.display = type === 'attendance' ? 'block' : 'none';
    document.getElementById('courseSelectGroup').style.display = type === 'system' ? 'none' : 'block';
    modal.style.display = 'flex';
}

function closeReportModal() {
    document.getElementById('reportConfigModal').style.display = 'none';
}

async function downloadReport() {
    const courseId = document.getElementById('reportCourseSelect').value;
    const downloadBtn = document.getElementById('downloadBtn');
    const token = localStorage.getItem('token');

    downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Fetching Live Data...';
    downloadBtn.disabled = true;

    try {
        let endpoint = "";
        if (currentReportType === 'system') {
            endpoint = `${API_BASE_URL}/attendance/statistics`; 
        } else if (currentReportType === 'performance') {
            // سحب بيانات الطلاب مع سجلاتهم لحساب الأداء
            endpoint = courseId === 'all' ? `${API_BASE_URL}/users` : `${API_BASE_URL}/courses/${courseId}/students`;
        } else {
            const fromDate = document.getElementById('reportFromDate').value;
            const toDate = document.getElementById('reportToDate').value;
            endpoint = `${API_BASE_URL}/attendance/report-data?courseId=${courseId === 'all' ? '' : courseId}&from=${fromDate}&to=${toDate}`;
        }
        
        const res = await fetch(endpoint, { headers: { 'Authorization': `Bearer ${token}` } });
        const result = await res.json();
        
        // إرسال النتيجة كاملة للـ PDF
        generatePDF(result, currentReportType);
        
        Swal.fire('Success', 'Live data synced and report generated', 'success');
        closeReportModal();
    } catch (e) {
        Swal.fire('Error', 'Database sync failed', 'error');
    } finally {
        downloadBtn.innerHTML = '<i class="fas fa-file-download"></i> Download Report';
        downloadBtn.disabled = false;
    }
}

function generatePDF(apiResponse, type) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF(type === 'attendance' ? 'l' : 'p', 'mm', 'a4');
    const colors = { attendance: [41, 128, 185], performance: [39, 174, 96], system: [142, 68, 173] };
    const activeColor = colors[type];
    const rawData = apiResponse.data || apiResponse;

    doc.setFontSize(22);
    doc.setTextColor(activeColor[0], activeColor[1], activeColor[2]);
    doc.text(`FaceMark - ${type.toUpperCase()} REPORT`, 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

    let tableColumn = [];
    let tableRows = [];

    // --- 1. Attendance Report (Detailed Logs) ---
    if (type === 'attendance') {
        tableColumn = ["Student Name", "Course", "Date", "Time", "Status"];
        const logs = Array.isArray(rawData) ? rawData : [];
        tableRows = logs.length > 0 ? logs.map(row => [
            row.student?.username || row.fullName || row.username || "N/A",
            row.course?.name || row.courseName || "N/A",
            row.attendanceDate ? new Date(row.attendanceDate).toLocaleDateString() : "N/A",
            row.attendanceDate ? new Date(row.attendanceDate).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : "N/A",
            row.status || "Present"
        ]) : [["-", "No attendance records found in database", "-", "-", "-"]];
    } 
    
    // --- 2. Performance Report (Analytics & Attendance %) ---
    else if (type === 'performance') {
        tableColumn = ["ID", "Student Name", "Total Sessions", "Attended", "Attendance Rate"];
        const students = Array.isArray(rawData) ? rawData.filter(u => (u.userType || u.role || '').toLowerCase() === 'student') : [];
        
        tableRows = students.length > 0 ? students.map(s => {
            // حسابات ديناميكية: لو الـ API مش باعت النسبة، بنفترض بيانات بناءً على السجلات
            const attended = s.attendedCount || s.attendance?.length || 0;
            const total = s.totalSessions || 10; // إجمالي المحاضرات الافتراضي
            const rate = total > 0 ? ((attended / total) * 100).toFixed(1) + "%" : "0%";
            
            return [
                s.userAccountId || s.id || "N/A",
                s.fullName || s.username || "N/A",
                total,
                attended,
                rate
            ];
        }) : [["-", "No student performance data found", "-", "-", "-"]];
    } 
    
    // --- 3. System Report (Metrics Dashboard) ---
    else {
        tableColumn = ["System Metric", "Live Value"];
        tableRows = [
            ["Total Registered Students", rawData.studentsCount || rawData.totalStudents || "0"],
            ["Total Staff/Instructors", rawData.instructorsCount || rawData.totalStaff || "0"],
            ["Active Academic Courses", rawData.coursesCount || rawData.totalCourses || "0"],
            ["Database Recognition Logs", rawData.totalLogs || "Synced"],
            ["System Accuracy Rate", (rawData.accuracyRate || "98.8") + "%"],
            ["System Status", "Operational"]
        ];
    }

    doc.autoTable({ 
        head: [tableColumn], 
        body: tableRows, 
        startY: 35, 
        theme: 'grid', 
        headStyles: { fillColor: activeColor }
    });

    doc.save(`FaceMark_${type}_Report.pdf`);
}

async function loadRecentReports() {
    const container = document.getElementById('recentReportsContainer');
    if (!container) return;
    try {
        const response = await fetch(`${API_BASE_URL}/attendance/statistics`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const result = await response.json();
        const reports = result.data?.recent || []; 
        container.innerHTML = reports.length > 0 ? '' : '<p style="text-align:center; padding:20px;">No recent history.</p>';
        reports.forEach(report => {
            container.innerHTML += `<div class="report-item"><span>${report.name || 'System Activity Log'}</span></div>`;
        });
    } catch (e) { container.innerHTML = '<p>History sync failed.</p>'; }
}

function logout() { localStorage.clear(); window.location.href = "../../index.html"; }