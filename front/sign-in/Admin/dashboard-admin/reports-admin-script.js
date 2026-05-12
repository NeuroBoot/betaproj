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
        const response = await fetch(`${API_BASE_URL}/attendance/statistics`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await response.json();

        // backend returns { total, breakdown: [{statusId, statusName, count, percentage}] }
        if (data && data.total !== undefined) {
            container.innerHTML = ''; 
            
            // Create a summary display
            let html = `
                <div class="stats-summary" style="padding: 15px; background: rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="color: #fff; margin-bottom: 10px;"><i class="fas fa-chart-pie"></i> Overall Statistics</h4>
                    <p style="font-size: 0.9rem; color: #8e8e93;">Total Records Processed: <strong>${data.total}</strong></p>
                </div>
            `;

            if (Array.isArray(data.breakdown)) {
                data.breakdown.forEach(stat => {
                    html += `
                        <div class="report-item">
                            <div class="report-main-info">
                                <i class="fas fa-file-alt"></i>
                                <div>
                                    <h4>${stat.statusName} Attendance</h4>
                                    <span>Count: ${stat.count} • <strong>${stat.percentage}%</strong> of total</span>
                                </div>
                            </div>
                        </div>
                    `;
                });
            }
            container.innerHTML = html;
        } else {
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