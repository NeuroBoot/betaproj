const API_BASE_URL = 'http://localhost:3000/api/v1';
let currentReportType = '';

document.addEventListener('DOMContentLoaded', async () => {
    
    // === 0. تحديث اسم المستخدم ===
    const nameDisplay = document.getElementById('adminName') || 
                        document.getElementById('admin-name') || 
                        document.getElementById('userNameDisplay');
    
    const savedName = localStorage.getItem('username');
    if (nameDisplay) {
        nameDisplay.textContent = savedName ? savedName : "Aya_allah";
    }

    // === 1. وظيفة التحكم في حجم السايد بار ===
    const sidebar = document.querySelector('.sidebar');
    const resizer = document.querySelector('.resizer') || document.getElementById('sidebarResizer');

    if (resizer && sidebar) {
        resizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            document.addEventListener('mousemove', resize);
            document.addEventListener('mouseup', stopResize);
            document.body.style.cursor = 'col-resize';
        });

        function resize(e) {
            let newWidth = e.clientX;
            if (newWidth > 200 && newWidth < 500) {
                sidebar.style.width = newWidth + 'px';
            }
        }

        function stopResize() {
            document.removeEventListener('mousemove', resize);
            document.removeEventListener('mouseup', stopResize);
            document.body.style.cursor = 'default';
        }
    }

    // === 2. تشغيل الـ APIs عند التحميل ===
    await loadCoursesForReports();
    await loadRecentReports(); // استدعاء دالة التقارير الأخيرة
});

// دالة لجلب الكورسات من السيرفر
async function loadCoursesForReports() {
    const select = document.getElementById('reportCourseSelect');
    if (!select) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/courses`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.status === 401) logout();
        
        const courses = await response.json();
        select.innerHTML = '<option value="all">All Courses</option>';
        
        const coursesList = Array.isArray(courses.data) ? courses.data : courses;
        if (Array.isArray(coursesList)) {
            coursesList.forEach(course => {
                const opt = document.createElement('option');
                opt.value = course.id;
                opt.textContent = course.name;
                select.appendChild(opt);
            });
        }
    } catch (e) { console.error("Error loading courses:", e); }
}

// دالة لجلب التقارير الأخيرة من الباك إند
async function loadRecentReports() {
    const container = document.getElementById('recentReportsContainer');
    if (!container) return;

    try {
        // تنبيه: هنا يتم استخدام الـ API الخاص بملفات التقارير
        const response = await fetch(`${API_BASE_URL}/attendance/statistics`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await response.json();

        // فحص إذا كان هناك تقارير حقيقية راجعة من الباك
        if (data && data.reports && data.reports.length > 0) {
            container.innerHTML = ''; 
            data.reports.forEach(report => {
                container.innerHTML += `
                    <div class="report-item">
                        <div class="report-main-info">
                            <i class="fas fa-file-alt"></i>
                            <div>
                                <h4>${report.name}</h4>
                                <span>${new Date(report.date).toLocaleDateString()} • ${report.size || '0'} MB</span>
                            </div>
                        </div>
                        <button class="btn-download" onclick="window.open('${report.url}')">Download</button>
                    </div>
                `;
            });
        } else {
            // لو مفيش داتا من الباك إند يظهر الرسالة دي
            container.innerHTML = '<p style="text-align:center; color:var(--text-dim); margin: 20px 0;">No history found yet. Generated reports will appear here.</p>';
        }
    } catch (e) {
        console.error("Error loading recent reports:", e);
        container.innerHTML = '<p style="text-align:center; color:var(--text-dim);">Unable to load recent reports.</p>';
    }
}

function openReportModal(type) {
    currentReportType = type;
    document.getElementById('reportConfigModal').style.display = 'flex';
}

function closeReportModal() {
    document.getElementById('reportConfigModal').style.display = 'none';
}

async function downloadReport() {
    const courseId = document.getElementById('reportCourseSelect').value;
    const fromDate = document.getElementById('reportFromDate').value;
    const toDate = document.getElementById('reportToDate').value;
    const downloadBtn = document.getElementById('downloadBtn');

    if (!fromDate || !toDate) {
        alert("Please select both start and end dates!");
        return;
    }

    // تأثير الـ Loading
    const originalContent = downloadBtn.innerHTML;
    downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
    downloadBtn.disabled = true;

    try {
        // محاكاة الطلب (سيتم استبداله برابط الـ API الفعلي للتحميل)
        console.log(`Generating ${currentReportType} for ${courseId}`);
        await new Promise(r => setTimeout(r, 2000));
        
        alert("Report ready! Your download will start now.");
        closeReportModal();
        await loadRecentReports(); // تحديث القائمة بعد الجينيريت
    } catch (e) {
        alert("Download failed.");
    } finally {
        downloadBtn.innerHTML = originalContent;
        downloadBtn.disabled = false;
    }
}

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.classList.toggle('active');
}

function logout() {
    localStorage.clear();
    window.location.href = "../../index.html";
}