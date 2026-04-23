document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 Dashboard Initializing...");

    const API_BASE_URL = 'http://localhost:3000/api/v1'; 
    let token = localStorage.getItem('token'); 

    // 1. تنظيف التوكن
    if (token) {
        token = token.replace(/['"]+/g, '').trim(); 
    }

    // 2. عرض اسم المستخدم بجانب الترحيب
    const userNameDisplay = document.getElementById('userNameDisplay');
    const savedName = localStorage.getItem('username'); 
    if (savedName && userNameDisplay) {
        userNameDisplay.textContent = savedName;
    }

    async function fetchDashboardData() {
        if (!token) {
            console.error("❌ No token found. Please login again.");
            return;
        }

        console.log("📡 Attempting to fetch data from server...");

        try {
            const headers = { 
                'Authorization': `Bearer ${token}`, 
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            };

            // --- جلب بيانات المستخدمين لتحديث عداد الطلاب والموظفين ---
            const usersRes = await fetch(`${API_BASE_URL}/users`, { method: 'GET', headers });
            const usersResult = await usersRes.json();

            if (usersResult.success && Array.isArray(usersResult.data)) {
                const allUsers = usersResult.data;
                const students = allUsers.filter(u => String(u.userType).toLowerCase() === 'student');
                const staff = allUsers.filter(u => String(u.userType).toLowerCase() === 'staff');

                if (document.getElementById('totalStudentsCount')) 
                    document.getElementById('totalStudentsCount').textContent = students.length;
                
                if (document.getElementById('totalStaffCount')) 
                    document.getElementById('totalStaffCount').textContent = staff.length;
            }

            // --- جلب بيانات الكورسات لتحديث العداد ---
            const coursesRes = await fetch(`${API_BASE_URL}/courses`, { method: 'GET', headers });
            const coursesResult = await coursesRes.json();
            if (coursesResult.success && Array.isArray(coursesResult.data)) {
                if (document.getElementById('activeCoursesCount'))
                    document.getElementById('activeCoursesCount').textContent = coursesResult.data.length;
            }

            // --- جلب إحصائيات الحضور لتحديث الشارت ---
            const statsRes = await fetch(`${API_BASE_URL}/attendance/statistics`, { method: 'GET', headers });
            const statsResult = await statsRes.json();
            
            // تحديث الشارت لو فيه داتا (لو فاضية مصفوفة [] زي ما طلع في بوست مان هيفضل أصفار)
            if (statsResult.success && Array.isArray(statsResult.data) && statsResult.data.length > 0) {
                updateAttendanceChart(statsResult.data);
            }

            console.log("✅ All Dashboard data updated successfully");

        } catch (error) {
            console.error("🚨 Connection Error:", error);
        }
    }

    fetchDashboardData();
    initLayoutFunctions();
});

// وظيفة تحديث الشارت ببيانات حقيقية من السيرفر
function updateAttendanceChart(apiData) {
    const chartCanvas = document.getElementById('attendanceChart');
    if (!chartCanvas) return;

    // افتراضاً إن الـ API بيرجع مصفوفة فيها قسم (label) ونسبة (value)
    const labels = apiData.map(item => item.label || item.departmentName);
    const values = apiData.map(item => item.value || item.attendancePercentage);

    // تدمير الشارت القديم لو موجود وبناء واحد جديد بالبيانات الحقيقية
    const existingChart = Chart.getChart(chartCanvas);
    if (existingChart) existingChart.destroy();

    new Chart(chartCanvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Attendance Rate %',
                data: values,
                backgroundColor: '#10b981',
                borderRadius: 5
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function initLayoutFunctions() {
    const sidebar = document.getElementById("resizableSidebar");
    const resizer = document.getElementById("sidebarResizer");
    if (resizer && sidebar) {
        resizer.addEventListener("mousedown", (e) => {
            e.preventDefault();
            document.addEventListener("mousemove", resize);
            document.addEventListener("mouseup", stopResize);
        });
        function resize(e) {
            let newWidth = e.clientX;
            if (newWidth > 200 && newWidth < 450) sidebar.style.width = newWidth + "px";
        }
        function stopResize() {
            document.removeEventListener("mousemove", resize);
            document.removeEventListener("mouseup", stopResize);
        }
    }

    // شارت افتراضي (سيعمل حتى يتم استبداله ببيانات الـ API)
    const chartCanvas = document.getElementById('attendanceChart');
    if (chartCanvas && !Chart.getChart(chartCanvas)) {
        new Chart(chartCanvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Eng', 'Sci', 'Arts', 'Bus', 'Med'],
                datasets: [{
                    label: 'Attendance Rate %',
                    data: [0, 0, 0, 0, 0], // يبدأ بأصفار
                    backgroundColor: '#10b981', 
                    borderRadius: 5
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}

function logout() { 
    localStorage.clear();
    window.location.href = "../../index.html"; 
}