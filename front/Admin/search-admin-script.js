const API_BASE_URL = 'http://localhost:3000/api/v1';

document.addEventListener('DOMContentLoaded', async () => {
    

    const nameDisplay = document.getElementById('adminName'); 
    const savedName = localStorage.getItem('username');
    if (nameDisplay) {
        nameDisplay.textContent = savedName || "user";
    }

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

    await loadCoursesForFilter();
});


async function loadCoursesForFilter() {
    const select = document.getElementById('filterCourse');
    if (!select) return;

    try {
        let token = localStorage.getItem('token');

        if (!token) {
            throw new Error("No token found");
        }

        token = token.replace(/['"]+/g, '').trim();

        if (!token.toLowerCase().startsWith('bearer ')) {
            token = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE_URL}/courses`, {
            method: 'GET',
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error("Failed to load courses");
        }

        const result = await response.json();
        const courses =
            result.data?.data ||
            result.data ||
            result.courses ||
            [];

  
        select.innerHTML = `
            <option value="all">All Courses</option>
        `;

        if (Array.isArray(courses)) {
            courses.forEach(course => {
                const opt = document.createElement('option');

                opt.value =
                    course.courseId ||
                    course.id ||
                    course._id;

                opt.textContent =
                    course.name ||
                    course.courseName ||
                    `Course ${opt.value}`;

                select.appendChild(opt);
            });
        }

    } catch (e) {
        console.error("Error loading courses:", e);

        select.innerHTML = `
            <option value="all">All Courses</option>
        `;
    }
}


async function performSearch() {
    const query = document.getElementById('searchInput').value.trim().toLowerCase();
    const type = document.getElementById('searchType').value.toLowerCase();
    const courseId = document.getElementById('filterCourse').value;
    const sortBy = document.getElementById('sortBy').value;
    const container = document.getElementById('searchResultsContainer');
    const searchBtn = document.querySelector('.btn-search');

    container.innerHTML = `
        <div style="text-align:center; padding:50px;">
            <i class="fas fa-spinner fa-spin" style="font-size:2rem; color:#4e73df;"></i>
            <p style="margin-top:15px; color:#888;">Searching system records...</p>
        </div>
    `;

    searchBtn.disabled = true;

    try {
        let token = localStorage.getItem('token');

        if (!token) {
            throw new Error("No token found. Please login again.");
        }

        token = token.replace(/['"]+/g, '').trim();

        if (!token.toLowerCase().startsWith('bearer ')) {
            token = `Bearer ${token}`;
        }

        const usersResponse = await fetch(`${API_BASE_URL}/users`, {
            method: 'GET',
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json'
            }
        });

        if (usersResponse.status === 401) {
            logout();
            return;
        }

        if (!usersResponse.ok) {
            throw new Error(`Failed to fetch users (${usersResponse.status})`);
        }

        const usersResult = await usersResponse.json();

        let users =
            usersResult.data?.data ||
            usersResult.data ||
            usersResult.users ||
            [];

        if (!Array.isArray(users)) {
            users = [];
        }

        users = users.filter(user => !user.isDeleted);

        if (type) {
            users = users.filter(user => {
                const userRole = (user.userType || user.role || '').toLowerCase();
                if (type === 'staff') {
                    return userRole === 'instructor' || userRole === 'staff';
                }

                return userRole === type;
            });
        }

        //SEARCH FILTER
        if (query) {
            users = users.filter(user => {
                const searchableText = `
                    ${user.fullName || ''}
                    ${user.username || ''}
                    ${user.email || ''}
                    ${user.userAccountId || ''}
                `.toLowerCase();

                return searchableText.includes(query);
            });
        }

        // COURSE FILTER 
        if (courseId && courseId !== 'all') {

            const studentsResponse = await fetch(
                `${API_BASE_URL}/courses/${courseId}/students`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': token,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!studentsResponse.ok) {
                throw new Error("Failed to fetch course students");
            }

            const studentsResult = await studentsResponse.json();

            const courseStudents =
                studentsResult.data?.data ||
                studentsResult.data ||
                [];

            const allowedStudentIds = new Set(
                courseStudents.map(student =>
                    String(
                        student.userAccountId ||
                        student.id ||
                        student.studentId
                    )
                )
            );

            if (type === 'student') {
                users = users.filter(user =>
                    allowedStudentIds.has(
                        String(
                            user.userAccountId ||
                            user.id
                        )
                    )
                );
            }

   
            else if (type === 'staff') {
                users = users.filter(user => {

                    if (
                        String(
                            user.courseId ||
                            user.course?.courseId ||
                            user.course?.id ||
                            ''
                        ) === String(courseId)
                    ) {
                        return true;
                    }

                    const assignedCourses =
                        user.courses ||
                        user.assignedCourses ||
                        [];

                    if (Array.isArray(assignedCourses)) {
                        return assignedCourses.some(course =>
                            String(
                                course.courseId ||
                                course.id ||
                                course._id
                            ) === String(courseId)
                        );
                    }

                    return false;
                });
            }

            else if (type === 'admin') {
                users = [];
            }
        }


        if (sortBy === 'name_asc') {
            users.sort((a, b) =>
                (a.fullName || a.username || '')
                    .localeCompare(b.fullName || b.username || '')
            );
        }

        else if (sortBy === 'name_desc') {
            users.sort((a, b) =>
                (b.fullName || b.username || '')
                    .localeCompare(a.fullName || a.username || '')
            );
        }

        else if (sortBy === 'recent') {
            users.sort((a, b) =>
                (b.userAccountId || 0) - (a.userAccountId || 0)
            );
        }

        // RENDER
        if (users.length > 0) {
            renderTable(users);
        } else {
            container.innerHTML = `
                <div class="empty-results" style="text-align:center; padding:50px; opacity:0.5;">
                    <i class="fas fa-folder-open" style="font-size:3rem;"></i>
                    <p style="margin-top:15px;">No results found for your search.</p>
                </div>
            `;
        }

    } catch (error) {
        console.error("Search Error:", error);

        container.innerHTML = `
            <div style="text-align:center; color:#ff4757; padding:50px;">
                <i class="fas fa-exclamation-triangle" style="font-size:3rem;"></i>
                <p style="margin-top:15px;">${error.message || 'Server connection error.'}</p>
            </div>
        `;

    } finally {
        searchBtn.disabled = false;
    }
}

function renderTable(data) {
    const container = document.getElementById('searchResultsContainer');
    const resultsCount = document.getElementById('resultsCount');
    
    if (resultsCount) resultsCount.textContent = `(${data.length} results found)`;

    let html = `
        <div class="table-responsive">
            <table class="search-results-table">
                <thead>
                    <tr>
                        <th>User Info</th>
                        <th>Identifier</th>
                        <th>Role</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
    `;

    data.forEach(item => {
        const userId = item.userAccountId || item.id || item._id || item.userId || null;
        const name = item.fullName || item.username || item.name || "Unknown";
        const email = item.email || "No email available";
        const role = item.userType || item.role || "User";

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
                <td><span class="id-tag">ID: ${userId ? userId : 'N/A'}</span></td>
                <td><span class="role-label">${role}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action view" onclick="viewDetails('${userId}')" title="View"><i class="fas fa-eye"></i></button>
                        <button class="btn-action delete" onclick="deleteEntry('${userId}')" title="Delete"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;
}


async function deleteEntry(id) {
    if (!id || id === 'null' || id === 'undefined' || id === 'N/A') {
        return alert("Cannot delete: Missing user ID.");
    }

    if (confirm("Are you sure you want to delete this user permanently?")) {
        try {
            const token = localStorage.getItem('token');

            const response = await fetch(`${API_BASE_URL}/users/${id}`, {
                method: 'DELETE',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                alert("User deleted successfully!");
                performSearch();
            } else {
                const error = await response.json();
                alert("Failed to delete: " + (error.message || "Unknown error"));
            }
        } catch (e) {
            console.error("Delete request failed:", e);
            alert("Error connecting to server.");
        }
    }
}


function viewDetails(id) {
    if (!id || id === 'null') return alert("ID not available.");
    alert("Fetching full details for ID: " + id);
  
}

function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('active');
}

function logout() {
    localStorage.clear();
    Swal.fire({
        text: "Logged out successfully",
        icon: "success",
        background: "#1a1a3a",
        color: "#fff",
        confirmButtonColor: "#3060ff",
        confirmButtonText: "OK"
    }).then(() => {
        window.location.href = "../sign in/index.html";
    });
}