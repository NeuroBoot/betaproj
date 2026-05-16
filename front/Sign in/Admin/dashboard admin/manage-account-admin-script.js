document.addEventListener('DOMContentLoaded', async function()  {
    loadEnrollmentTrend(); // السطر ده هو اللي هيخلي الشارت يشتغل أول ما الصفحة تفتح

    const API_BASE_URL = 'http://localhost:3000/api/v1'; 
    let token = localStorage.getItem('token'); 
    if (token) token = token.replace(/['"]+/g, '').trim(); 

    // === 1. UI Elements ===
    const modal = document.getElementById('accountModal');
    const editModal = document.getElementById('editModal');
    const tableBody = document.getElementById('accountsTableBody');
    const accountForm = document.getElementById('accountForm');
    const editForm = document.getElementById('editForm');

    let roleDistributionChart;
    let currentEditingId = null; 
    let currentEditingAccountId = null;

    // =========================
    // 1. Admin Name Display (إظهار الاسم في السايد بار)
    // =========================
    const nameDisplay = document.getElementById('adminName'); 
    const savedName = localStorage.getItem('username'); // بيتأكد إنه بيقرأ الاسم اللي اتسيف وقت اللوجين

    if (nameDisplay && savedName) {
        // بيخلي أول حرف كبير (Capitalized) كشكل جمالي
        const formattedName = savedName.charAt(0).toUpperCase() + savedName.slice(1);
        nameDisplay.textContent = formattedName;
    }

    // =========================
    // Helper Function Base64
    // =========================
    function convertFileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    // =========================
    // Modals Logic
    // =========================
    const addAccountBtn = document.getElementById('openModalBtn');
    if (addAccountBtn && modal) {
        addAccountBtn.onclick = (e) => {
            e.preventDefault();
            
            // تعديل: إخفاء معاينة الصورة عند فتح مودال الإضافة
            const addPreview = document.getElementById('imagePreview');
            if (addPreview) {
                addPreview.src = '';
                addPreview.style.display = 'none';
            }
            
            modal.style.display = 'flex';
        };
    }

    document.querySelectorAll('.close, .btn-cancel, #closeModalBtn, #closeEditModalBtn').forEach(btn => {
        btn.onclick = () => {
            if (modal) modal.style.display = 'none';
            if (editModal) editModal.style.display = 'none';
        };
    });

    // =========================
    // Load & Render Accounts
    // =========================
    async function loadAccounts() {
        if (!token) return;
        try {
            const response = await fetch(`${API_BASE_URL}/users`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();
            const users = result.data || result;
            if (Array.isArray(users)) {
                tableBody.innerHTML = '';
                users.forEach(user => renderUserRow(user));
                updateStatsAndCharts(users);
            }
        } catch (error) { console.error("Error loading accounts:", error); }
    }

    function renderUserRow(user) {
        const tr = document.createElement('tr');
        const dbId = user.id || user._id || user.userAccountId;
        tr.setAttribute('data-dbid', dbId);
        tr.setAttribute('data-accountid', user.userAccountId);

        tr.innerHTML = `
            <td>${user.userAccountId || 'N/A'}</td>
            <td>${user.fullName || user.username || 'Unknown'}</td>
            <td>${user.email || 'N/A'}</td>
            <td><span class="badge ${(user.userType || 'student').toLowerCase()}">${user.userType || 'Student'}</span></td>
            <td><span class="status-active">Active</span></td>
            <td class="actions">
                <button class="btn-edit"><i class="fas fa-edit"></i> Edit</button>
                <button class="btn-delete"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tableBody.appendChild(tr);
    }

    // =========================
    // Stats & Charts
    // =========================
    function updateStatsAndCharts(users) {
        const studentCount = users.filter(u => String(u.userType).toLowerCase() === 'student').length;
        const staffCount = users.filter(u => String(u.userType).toLowerCase() === 'staff').length;
        const adminCount = users.filter(u => String(u.userType).toLowerCase() === 'admin').length;

        if (roleDistributionChart) {
            roleDistributionChart.data.datasets[0].data = [studentCount, staffCount, adminCount];
            roleDistributionChart.update();
        }
        if (document.getElementById('totalStudentsCount')) document.getElementById('totalStudentsCount').textContent = studentCount;
        if (document.getElementById('totalStaffCount')) document.getElementById('totalStaffCount').textContent = staffCount;
        if (document.getElementById('totalAdminCount')) document.getElementById('totalAdminCount').textContent = adminCount;
    }

    // =========================
    // Add Account Logic
    // =========================
    if (accountForm) {
        accountForm.onsubmit = async function(e) {
            // Validation logic

            e.preventDefault();
            const fullName = document.getElementById('fullName').value.trim();
            const idVal = document.getElementById('idNumber').value.trim();
            const photoInput = document.getElementById('userPhoto');

            const userData = {
                username: fullName, fullName: fullName,
                email: document.getElementById('email').value.trim(),
                password: document.getElementById('password').value || "User@123",
                userType: document.getElementById('role').value.toLowerCase(),
                userAccountId: parseInt(idVal)
            };
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(userData.email)) {
    Swal.fire('Error', 'Please enter a valid email address', 'error');
    return;
}

if (isNaN(userData.userAccountId)) {
    Swal.fire('Error', 'ID Number must be a numeric value', 'error');
    return;
}

if (userData.password.length < 6) {
    Swal.fire('Error', 'Password must be at least 6 characters', 'error');
    return;    
}

            try {
                Swal.fire({ title: 'Processing...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                const response = await fetch(`${API_BASE_URL}/users`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(userData)
                });
                if (!response.ok) throw new Error('Failed to create user');

                if (photoInput && photoInput.files[0]) {
                    const base64Data = await convertFileToBase64(photoInput.files[0]);
                    const visionData = {
                        students: [{ imagesBase64: [base64Data.split(',')[1]], studentId: String(idVal), name: fullName }],
                        confidenceThreshold: 0.6
                    };
                    await fetch(`${API_BASE_URL}/vision/upload`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify(visionData)
                    });
                }
                modal.style.display = 'none';
                accountForm.reset();
                await loadAccounts();
                Swal.fire('Success', 'Account created', 'success');
            } catch (error) { Swal.fire('Error', error.message, 'error'); }
        };
    }

    // =========================
    // Table Action Events (Delete & Edit)
    // =========================
    tableBody.addEventListener('click', async function(e) {
        const row = e.target.closest('tr');
        if (!row) return;
        const dbId = row.getAttribute('data-dbid');
        const accId = row.getAttribute('data-accountid');

        if (e.target.closest('.btn-delete')) {
            const result = await Swal.fire({ title: 'Are you sure?', icon: 'warning', showCancelButton: true });
            if (result.isConfirmed) {
                try {
                    await fetch(`${API_BASE_URL}/users/${dbId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    await loadAccounts();
                    Swal.fire('Deleted!', '', 'success');
                } catch (err) { Swal.fire('Error', 'Delete failed', 'error'); }
            }
        }

        if (e.target.closest('.btn-edit')) {
            currentEditingId = dbId;
            currentEditingAccountId = accId;
            document.getElementById('editIdNumber').value = row.cells[0].innerText;
            document.getElementById('editFullName').value = row.cells[1].innerText;
            document.getElementById('editEmail').value = row.cells[2].innerText;
            document.getElementById('editRole').value = row.cells[3].innerText.trim().toLowerCase();
            
            const editPreview = document.getElementById('editImagePreview');
            if (editPreview) { editPreview.src = ''; editPreview.style.display = 'none'; }
            
            editModal.style.display = 'flex';
        }
    });

    // =========================
    // Save Edit Logic
    // =========================
    if (editForm) {
        editForm.onsubmit = async function(e) {
            e.preventDefault();
            const fullName = document.getElementById('editFullName').value.trim();
            const accIdVal = document.getElementById('editIdNumber').value.trim();
            const photoInput = document.getElementById('editUserPhoto');

            const updatedData = {
                username: fullName, fullName: fullName,
                email: document.getElementById('editEmail').value.trim(),
                userType: document.getElementById('editRole').value.toLowerCase(),
                userAccountId: parseInt(accIdVal)
            };

            try {
                Swal.fire({ title: 'Updating...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                await fetch(`${API_BASE_URL}/users/${currentEditingId}`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedData)
                });

                if (photoInput && photoInput.files[0]) {
                    await fetch(`${API_BASE_URL}/vision/embeddings/${currentEditingAccountId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    }).catch(() => {});

                    const base64Data = await convertFileToBase64(photoInput.files[0]);
                    const visionData = {
                        students: [{ imagesBase64: [base64Data.split(',')[1]], studentId: String(accIdVal), name: fullName }],
                        confidenceThreshold: 0.6
                    };
                    await fetch(`${API_BASE_URL}/vision/upload`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify(visionData)
                    });
                }
                await loadAccounts();
                editModal.style.display = 'none';
                Swal.fire('Updated!', '', 'success');
            } catch (error) { Swal.fire('Error', error.message, 'error'); }
        };
    }

    // =========================
    // Extra UI Initializations
    // =========================
   function initCharts() {
    const ctxPie = document.getElementById('roleDistributionChart')?.getContext('2d');
    if (ctxPie) {
        roleDistributionChart = new Chart(ctxPie, {
            type: 'pie',
            data: {
                labels: ['Students', 'Staff', 'Admin'],
                datasets: [{ 
                    data: [0, 0, 0], 
                    backgroundColor: ['#4e73df', '#1cc88a', '#8e44ad'],
                    borderWidth: 0 
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    // --- إضافة العنوان هنا ---
                    title: {
                        display: true,
                        text: 'Account Distribution by Role',
                        color: '#858796',
                        font: { size: 16, weight: 'bold' },
                        padding: { top: 10, bottom: 20 },
                        align: 'start'
                    },
                    legend: {
                        position: 'bottom',
                        labels: { color: '#858796', padding: 20 }
                    }
                }
            }
        });
    }
}

    function setupImagePreviews() {
        const setup = (inId, preId) => {
            const input = document.getElementById(inId);
            const preview = document.getElementById(preId);
            if (input && preview) {
                input.onchange = function() {
                    const [file] = this.files;
                    if (file) { preview.src = URL.createObjectURL(file); preview.style.display = 'block'; }
                };
            }
        };
        setup('userPhoto', 'imagePreview');
        setup('editUserPhoto', 'editImagePreview');
    }

    initCharts();
    setupImagePreviews();
    loadAccounts();
});
async function loadEnrollmentTrend() {
    const API_BASE_URL = 'http://localhost:3000/api/v1'; 
    let token = localStorage.getItem('token'); 
    if (token) token = token.replace(/['"]+/g, '').trim(); 

    try {
        const response = await fetch(`${API_BASE_URL}/courses`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();
        const courses = result.data || result;

        if (Array.isArray(courses) && courses.length > 0) {
            const recentCourses = courses.slice(-5);
            const labels = [];
            const enrollmentData = [];

           for (const course of recentCourses) {
                // بنحاول نجيب الـ ID بكذا طريقة عشان نضمن إنه مش undefined
                const courseId = course.id || course._id || course.courseId;
                
                if (!courseId) {
                    console.warn("Skipping course due to missing ID:", course);
                    continue; 
                }

                // جربي تستخدمي المسميات دي بالترتيب حسب اللي راجع من الـ Backend عندك
                    labels.push(course.courseCode || course.code || course.name || course.title || "Unknown");
                
                try {
                    const studentRes = await fetch(`${API_BASE_URL}/courses/${courseId}/students`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    
                    if (studentRes.ok) {
                        const studentData = await studentRes.json();
                        const students = studentData.data || studentData;
                        enrollmentData.push(Array.isArray(students) ? students.length : 0);
                    } else {
                        enrollmentData.push(0);
                    }
                } catch (err) {
                    console.error(`Error fetching students for course ${courseId}:`, err);
                    enrollmentData.push(0);
                }
            }
            renderEnrollmentChart(labels, enrollmentData);
        }
    } catch (error) {
        console.error("Error loading enrollment trend:", error);
    }
}

function renderEnrollmentChart(labels, data) {
    const canvas = document.getElementById('enrollmentChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (window.myLineChart) { window.myLineChart.destroy(); }

    window.myLineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Students Enrolled',
                data: data,
                borderColor: '#4e73df',
                backgroundColor: 'rgba(78, 115, 223, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                // --- إضافة العنوان هنا ---
                title: {
                    display: true,
                    text: 'Student Enrollment Trend',
                    color: '#858796',
                    font: { size: 16, weight: 'bold' },
                    padding: { top: 10, bottom: 20 },
                    align: 'start'
                },
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, ticks: { color: '#858796' }, grid: { color: 'rgba(200, 200, 200, 0.1)' } },
                x: { ticks: { color: '#858796' }, grid: { display: false } }
            }
        }
    });
}
function filterTable() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const rows = document.querySelectorAll('#accountsTableBody tr');

    rows.forEach(row => {
        const id = row.cells[0].innerText.toLowerCase();
        const name = row.cells[1].innerText.toLowerCase();
        
        if (id.includes(searchTerm) || name.includes(searchTerm)) {
            row.style.display = "";
        } else {
            row.style.display = "none";
        }
    });
}
document.querySelectorAll('.accounts-table th').forEach((header, index) => {
    // هنخلي العناوين قابلة للضغط
    if (index < 4) { // هنرتب بأول 4 أعمدة بس
        header.style.cursor = 'pointer';
        header.addEventListener('click', () => sortTable(index));
    }
});

function sortTable(columnIndex) {
    const table = document.querySelector(".accounts-table");
    const tbody = table.querySelector("tbody");
    const rows = Array.from(tbody.querySelectorAll("tr"));
    
    const isAscending = table.dataset.sortAsc === "true";
    
    const sortedRows = rows.sort((a, b) => {
        const aText = a.cells[columnIndex].innerText.trim();
        const bText = b.cells[columnIndex].innerText.trim();
        
        return isAscending 
            ? aText.localeCompare(bText, undefined, {numeric: true}) 
            : bText.localeCompare(aText, undefined, {numeric: true});
    });

    table.dataset.sortAsc = !isAscending;
    tbody.append(...sortedRows);
}

function logout() { localStorage.clear(); window.location.href = "../../index.html"; }