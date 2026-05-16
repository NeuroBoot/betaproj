const API_BASE_URL = 'http://localhost:3000/api/v1';
let allData = []; // المخزن الرئيسي للبيانات

function getAuthToken() {
    let token = localStorage.getItem('token');
    if (!token) return "";
    token = token.replace(/['"]+/g, '').trim();
    if (token.toLowerCase().startsWith('bearer ')) {
        token = token.substring(7).trim();
    }
    return `Bearer ${token}`;
}

document.addEventListener('DOMContentLoaded', async () => {
    // تحديث اسم الأدمن
    const nameDisplay = document.getElementById('adminName');
    if (nameDisplay) nameDisplay.textContent = localStorage.getItem('username') || "Admin";

    // تحميل الكورسات في القائمة المنسدلة
    await loadCoursesForFilter();

    const searchInput = document.getElementById('searchInput');
    const searchType = document.getElementById('searchType');
    const filterCourse = document.getElementById('filterCourse');
    const sortBy = document.getElementById('sortBy');

    // المستمعات (Listeners)
    if (searchInput) searchInput.addEventListener('input', performSearch);
    if (searchType) searchType.addEventListener('change', performSearch);
    if (filterCourse) filterCourse.addEventListener('change', performSearch);
    if (sortBy) sortBy.addEventListener('change', () => sortAndRender(allData));

    performSearch();
});

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
            select.innerHTML = '<option value="all">All Courses</option>';
            courses.forEach(course => {
                const opt = document.createElement('option');
                opt.value = (course.id || course.courseId).toString(); 
                opt.textContent = course.name;
                select.appendChild(opt);
            });
        }
    } catch (e) { console.error("Error loading courses", e); }
}

async function performSearch() {
    const query = document.getElementById('searchInput').value.trim().toLowerCase();
    const type = document.getElementById('searchType').value; 
    const courseId = document.getElementById('filterCourse').value;
    const container = document.getElementById('searchResultsContainer');

    container.innerHTML = '<div style="text-align:center; padding:50px;"><i class="fas fa-spinner fa-spin"></i> Loading Results...</div>';

    try {
        let items = [];

        // سيناريو 1: فلترة الستاف بكورس محدد (بناءً على كود صفحة الكورسات بتاعك)
        if (type === 'staff' && courseId !== 'all') {
            const response = await fetch(`${API_BASE_URL}/courses`, { headers: { 'Authorization': getAuthToken() } });
            const data = await response.json();
            const courses = data.data || data;
            
            // البحث عن الكورس المختار واستخراج المدرس (Instructor)
            const targetCourse = courses.find(c => (c.id || c.courseId).toString() === courseId.toString());
            if (targetCourse && targetCourse.instructor) {
                items = [targetCourse.instructor];
            } else {
                items = [];
            }
        } 
        // سيناريو 2: فلترة الطلاب بكورس محدد
        else if (type === 'student' && courseId !== 'all') {
            const response = await fetch(`${API_BASE_URL}/courses/${courseId}/students`, { headers: { 'Authorization': getAuthToken() } });
            const data = await response.json();
            items = data.data || data;
        } 
        // سيناريو 3: البحث العام (بدون فلتر كورس أو "All Courses")
        else {
            const response = await fetch(`${API_BASE_URL}/users`, { headers: { 'Authorization': getAuthToken() } });
            const data = await response.json();
            items = data.data || data;
        }

        if (!Array.isArray(items)) items = [];

        // الفلترة النهائية (النوع والبحث النصي)
        allData = items.filter(item => {
            const user = item.student || item.user || item;
            if (!user) return false;

            const role = (user.role || user.userType || "student").toLowerCase();
            
            // فلترة النوع
            let matchesType = (role === type);
            if (type === 'staff' && (role === 'staff' || role === 'instructor')) matchesType = true;

            // فلترة البحث النصي
            const name = (user.fullName || user.username || "").toLowerCase();
            const email = (user.email || "").toLowerCase();
            const idStr = (user.userAccountId || user.id || "").toString().toLowerCase();
            const matchesQuery = query === "" || name.includes(query) || email.includes(query) || idStr.includes(query);

            return matchesType && matchesQuery;
        });

        sortAndRender(allData);

    } catch (error) {
        console.error("Search Error:", error);
        container.innerHTML = `<p style="color:red; text-align:center;">Error fetching data</p>`;
    }
}

function sortAndRender(data) {
    const sortBy = document.getElementById('sortBy').value;
    const resultsCount = document.getElementById('resultsCount');

    let sortedData = [...data];

    sortedData.sort((a, b) => {
        const uA = a.student || a.user || a;
        const uB = b.student || b.user || b;
        const nameA = (uA.fullName || uA.username || "").toLowerCase();
        const nameB = (uB.fullName || uB.username || "").toLowerCase();

        if (sortBy === 'name_asc') return nameA.localeCompare(nameB);
        if (sortBy === 'name_desc') return nameB.localeCompare(nameA);
        if (sortBy === 'recent') return (uB.id || 0) - (uA.id || 0);
        return 0;
    });

    if (resultsCount) resultsCount.textContent = `(${sortedData.length} results found)`;
    renderTable(sortedData);
}

function renderTable(data) {
    const container = document.getElementById('searchResultsContainer');
    if (data.length === 0) {
        container.innerHTML = `
            <div class="empty-results" style="text-align:center; padding:40px;">
                <i class="fas fa-search-minus" style="font-size: 3rem; opacity: 0.2; margin-bottom:15px;"></i>
                <p>No matches found in the system</p>
            </div>`;
        return;
    }

    let html = `<table class="search-results-table">
        <thead>
            <tr>
                <th>USER INFO</th>
                <th>IDENTIFIER</th>
                <th>ROLE</th>
            </tr>
        </thead>
        <tbody>`;

    data.forEach(item => {
        const u = item.student || item.user || item;
        const role = (u.role || u.userType || "student").toLowerCase();
        html += `
            <tr>
                <td>
                    <div class="user-cell">
                        <div class="user-icon"><i class="fas fa-user-circle"></i></div>
                        <div class="user-details">
                            <span class="user-name">${u.fullName || u.username || "N/A"}</span>
                            <span class="user-email">${u.email || ""}</span>
                        </div>
                    </div>
                </td>
                <td><span class="id-tag">ID: ${u.userAccountId || u.id}</span></td>
                <td><span class="role-badge ${role}">${role.toUpperCase()}</span></td>
            </tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}

function logout() { localStorage.clear(); window.location.href = "../../index.html"; }