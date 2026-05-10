const API_BASE_URL = 'http://localhost:3000/api/v1';

// دالة لجلب التوكن والتأكد من صيغته
function getAuthToken() {
    let token = localStorage.getItem('token');
    if (!token) return "";
    token = token.replace(/['"]+/g, '').trim();
    return token.toLowerCase().startsWith('bearer ') ? token : `Bearer ${token}`;
}

document.addEventListener('DOMContentLoaded', async () => {
    // 1. تحديث اسم المستخدم
    const nameDisplay = document.getElementById('adminName'); 
    const savedName = localStorage.getItem('username');
    if (nameDisplay) {
        nameDisplay.textContent = savedName || "Aya_allah";
    }

    // 2. وظيفة التحكم في حجم السايد بار (Sidebar Resizer)
    const sidebar = document.querySelector('.sidebar');
    const resizer = document.getElementById('sidebarResizer');
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

    // 3. تحميل الكورسات للفلتر فور فتح الصفحة
    await loadCoursesForFilter();
});

// دالة لجلب الكورسات من السيرفر لوضعها في القائمة المنسدلة
async function loadCoursesForFilter() {
    const select = document.getElementById('filterCourse');
    if (!select) return;

    try {
        const response = await fetch(`${API_BASE_URL}/courses`, {
            headers: { 'Authorization': getAuthToken() }
        });
        const data = await response.json();
        const courses = data.data || data;

        if (Array.isArray(courses)) {
            courses.forEach(course => {
                const opt = document.createElement('option');
                opt.value = course.id || course._id;
                opt.textContent = course.name;
                select.appendChild(opt);
            });
        }
    } catch (e) {
        console.error("Error loading courses:", e);
    }
}

// === وظيفة البحث الأساسية ===
async function performSearch() {
    const query = document.getElementById('searchInput').value.trim();
    const type = document.getElementById('searchType').value; // student, staff, admin
    const courseId = document.getElementById('filterCourse').value;
    const container = document.getElementById('searchResultsContainer');
    const resultsCount = document.getElementById('resultsCount');

    // إظهار حالة التحميل
    container.innerHTML = `
        <div style="text-align: center; padding: 50px;">
            <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: #4e73df;"></i>
            <p style="margin-top: 15px; color: #888;">Searching system records...</p>
        </div>
    `;

    try {
        // جلب جميع المستخدمين لعمل الفلترة برمجياً (لضمان الدقة في الأدوار والـ IDs)
        const response = await fetch(`${API_BASE_URL}/users`, {
            headers: { 'Authorization': getAuthToken() }
        });

        if (response.status === 401) logout();

        const data = await response.json();
        const allUsers = data.data || data;

        if (Array.isArray(allUsers)) {
            // فلترة النتائج بناءً على الاختيارات (النوع، نص البحث)
            let results = allUsers.filter(user => {
                const userRole = (user.role || user.userType || "").toLowerCase();
                const matchesType = userRole === type.toLowerCase();
                
                const searchStr = `${user.fullName} ${user.username} ${user.email} ${user.id} ${user.userAccountId}`.toLowerCase();
                const matchesQuery = query === "" || searchStr.includes(query.toLowerCase());

                return matchesType && matchesQuery;
            });

            if (resultsCount) resultsCount.textContent = `(${results.length} results found)`;

            if (results.length > 0) {
                renderTable(results);
            } else {
                container.innerHTML = `
                    <div class="empty-results" style="text-align: center; padding: 50px; opacity: 0.5;">
                        <i class="fas fa-folder-open" style="font-size: 3rem;"></i>
                        <p style="margin-top: 15px;">No results found for your search.</p>
                    </div>`;
            }
        }
    } catch (error) {
        console.error("Search Error:", error);
        container.innerHTML = `<div style="text-align: center; color: #ff4757; padding: 50px;"><p>Server connection error.</p></div>`;
    }
}

// === رسم جدول النتائج (تم حذف عمود Actions وتعديل الـ Role والـ ID) ===
function renderTable(data) {
    const container = document.getElementById('searchResultsContainer');
    
    let html = `
        <div class="table-responsive">
            <table class="search-results-table">
                <thead>
                    <tr>
                        <th>User Info</th>
                        <th>Identifier</th>
                        <th>Role</th>
                    </tr>
                </thead>
                <tbody>
    `;

    data.forEach(item => {
        // فحص الـ ID الصحيح
        const userId = item.id || item.userAccountId || "N/A";
        const name = item.fullName || item.username || "Unknown";
        const email = item.email || "No email available";
        const role = (item.role || item.userType || "User").toLowerCase();

        html += `
            <tr>
                <td>
                    <div class="user-cell">
                        <div class="user-icon"><i class="fas fa-user-circle"></i></div>
                        <div class="user-details">
                            <span class="user-name">${name}</span>
                            <span class="user-email">${email}</span>
                        </div>
                    </div>
                </td>
                <td><span class="id-tag">ID: ${userId}</span></td>
                <td><span class="role-badge ${role}">${role.toUpperCase()}</span></td>
            </tr>
        `;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

// وظائف التنقل والخروج
function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('active');
}

function logout() {
    localStorage.clear();
    window.location.href = "../../index.html";
}