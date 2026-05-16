document.addEventListener('DOMContentLoaded', async () => {
    const API_BASE_URL = 'http://localhost:3000/api/v1'; 
    let token = localStorage.getItem('token')?.replace(/['"]+/g, '').trim(); 

    // دالة تحديث الداش بورد بالكامل
    async function updateDashboard() {
        if (!token) {
            window.location.href = "../../index.html";
            return;
        }

        const headers = { 
            'Authorization': `Bearer ${token}`, 
            'Accept': 'application/json' 
        };

        try {
            // 0. عرض اسم الأدمن المسجل
            const nameDisplay = document.getElementById('adminName');
            const savedName = localStorage.getItem('username'); // التأكد من المفتاح المستخدم في الـ Login
            if (nameDisplay && savedName) {
                const formattedName = savedName.charAt(0).toUpperCase() + savedName.slice(1);
                nameDisplay.textContent = formattedName;
            }

            // 1. تحديث حالة اتصال السيرفر (Online/Offline)
            checkStatus(headers);

            // 2. جلب البيانات في وقت واحد لسرعة الأداء
            const [uRes, cRes, sRes, aRes] = await Promise.all([
                fetch(`${API_BASE_URL}/users`, { headers }),
                fetch(`${API_BASE_URL}/courses`, { headers }),
                fetch(`${API_BASE_URL}/attendance/statistics`, { headers }),
                fetch(`${API_BASE_URL}/alerts`, { headers }) 
            ]);

            const users = await uRes.json();
            const courses = await cRes.json();
            const stats = await sRes.json();
            const alerts = await aRes.json();

            // --- تحديث عدادات الـ Stats Cards ---
            if (users.success && Array.isArray(users.data)) {
                const students = users.data.filter(u => (u.role || u.userType || "").toLowerCase() === 'student').length;
                const staff = users.data.filter(u => (u.role || u.userType || "").toLowerCase() === 'staff').length;
                
                document.getElementById('totalStudentsCount').textContent = students;
                document.getElementById('totalStaffCount').textContent = staff;
            }

            if (courses.success) {
                const courseCount = Array.isArray(courses.data) ? courses.data.length : 0;
                const courseHeading = document.querySelector('.stat-card.purple h2');
                if (courseHeading) courseHeading.textContent = courseCount;
            }

            // --- تحديث الـ Recent Activity (حضور + نظام) ---
            const activityContainer = document.querySelector('.activity-list');
            if (activityContainer) {
                activityContainer.innerHTML = ''; 
                let allActivities = [];

                // أ. سجلات الحضور
                const recentLogs = stats.data?.recent || stats.data?.recentAttendance || [];
                recentLogs.forEach(log => {
                    allActivities.push({
                        title: `${log.student?.username || log.username || 'Student'} marked ${log.status || 'Present'}`,
                        subtitle: log.course?.name || log.courseName || 'Attendance',
                        time: new Date(log.attendanceDate || log.createdAt),
                        dot: 'blue'
                    });
                });

                // ب. تنبيهات النظام
                if (alerts.success && Array.isArray(alerts.data)) {
                    alerts.data.forEach(alert => {
                        allActivities.push({
                            title: alert.message, 
                            subtitle: 'System Update',
                            time: new Date(alert.createdAt),
                            dot: 'purple'
                        });
                    });
                }

                allActivities.sort((a, b) => b.time - a.time);

                if (allActivities.length > 0) {
                    allActivities.slice(0, 5).forEach(act => {
                        const item = document.createElement('div');
                        item.className = 'activity-item';
                        item.innerHTML = `
                            <span class="dot-small ${act.dot}"></span>
                            <div class="info">
                                <p><strong>${act.title}</strong></p>
                                <small>${act.subtitle} • ${act.time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</small>
                            </div>
                        `;
                        activityContainer.appendChild(item);
                    });
                } else {
                    activityContainer.innerHTML = `<p style="text-align:center; padding:20px; color:#8e8e93;">No recent activity recorded yet.</p>`;
                }
            }

            // --- رسم الدياجرام ---
            const chartData = stats.data?.chartData || stats.data?.departmentStats || [];
            if (chartData.length > 0) {
                drawChart(chartData);
            } else {
                const chartCanvas = document.getElementById('attendanceChart');
                if (chartCanvas) {
                    chartCanvas.style.display = 'none';
                    const container = chartCanvas.parentElement;
                    container.innerHTML = `<p style="text-align:center; padding:50px; color:#8e8e93;">Waiting for attendance data to generate chart...</p>`;
                }
            }

            // تحديث نسبة الدقة
            const accuracyHeading = document.querySelector('.stat-card.orange h2');
            if (accuracyHeading) {
                accuracyHeading.textContent = (stats.data?.accuracyRate || "98") + "%";
            }

        } catch (e) {
            console.error("Dashboard Sync Failed:", e);
            setUIOffline();
        }
    }

    // فحص حالة السيرفر
    async function checkStatus(headers) {
        try {
            const res = await fetch(`${API_BASE_URL}/auth/profile`, { headers });
            const isOk = res.ok;
            document.querySelectorAll('.badge').forEach(b => {
                b.textContent = isOk ? "Online" : "Offline";
                b.style.background = isOk ? "#10b981" : "#ef4444";
            });
        } catch { setUIOffline(); }
    }

    function setUIOffline() {
        document.querySelectorAll('.badge').forEach(b => {
            b.textContent = "Offline";
            b.style.background = "#ef4444";
        });
    }

    // وظيفة رسم الـ Chart
    function drawChart(data) {
        const canvas = document.getElementById('attendanceChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const old = Chart.getChart("attendanceChart");
        if (old) old.destroy();

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(d => d.label || d.department || d.day),
                datasets: [{ 
                    label: 'Attendance Rate %', 
                    data: data.map(d => d.value || d.rate || d.count), 
                    backgroundColor: 'rgba(52, 152, 219, 0.7)', 
                    borderColor: '#3498db', 
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, max: 100, ticks: { color: '#8e8e93' } },
                    x: { ticks: { color: '#8e8e93' } }
                }
            }
        });
    }

    updateDashboard();
});

// وظيفة تسجيل الخروج
function logout() {
    localStorage.clear();
    window.location.href = "../../index.html";
}