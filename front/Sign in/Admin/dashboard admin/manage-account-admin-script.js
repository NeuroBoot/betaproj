document.addEventListener('DOMContentLoaded', async function() {
    const API_BASE_URL = 'http://localhost:3000/api/v1'; 
    let token = localStorage.getItem('token'); 
    if (token) token = token.replace(/['"]+/g, '').trim(); 

    // === 1. عناصر الواجهة (UI Elements) ===
    const modal = document.getElementById('accountModal');
    const editModal = document.getElementById('editModal');
    const tableBody = document.getElementById('accountsTableBody');
    let roleDistributionChart;
    let currentRow = null;
    let currentEditingId = null; 

    // === 2. منطق فتح وإغلاق الـ Modals ===
    const addAccountBtn = document.getElementById('openModalBtn');
    if (addAccountBtn && modal) {
        addAccountBtn.onclick = (e) => { e.preventDefault(); modal.style.display = 'flex'; };
    }

    document.querySelectorAll('.close, .btn-cancel, #closeModalBtn, #closeEditModalBtn').forEach(btn => {
        btn.onclick = () => {
            if (modal) modal.style.display = 'none';
            if (editModal) editModal.style.display = 'none';
        };
    });

    window.onclick = (e) => {
        if (e.target == modal) modal.style.display = 'none';
        if (e.target == editModal) editModal.style.display = 'none';
    };

   // === تحديث اسم المستخدم مع جعل أول حرف كابيتال ===
const nameDisplay = document.getElementById('adminName'); 
const savedName = localStorage.getItem('username'); // نجلب الاسم المخزن

if (nameDisplay && savedName) {
    // السطر التالي يقوم بتحويل أول حرف لكبير ودمجه مع باقي الاسم
    const formattedName = savedName.charAt(0).toUpperCase() + savedName.slice(1);
    nameDisplay.textContent = formattedName;
} else if (nameDisplay) {
    nameDisplay.textContent = "Aya_allah"; // القيمة الافتراضية
}

    // === 3. وظائف جلب البيانات (GET) ===
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
        
        // السر هنا: لازم نتأكد إننا بنسحب الـ ID اللي الباك إند بيفهمه (id أو _id)
        const dbId = user.id || user._id || user.userAccountId;
        tr.setAttribute('data-dbid', dbId); 

        tr.innerHTML = `
            <td>${user.userAccountId || 'N/A'}</td>
            <td>${user.fullName || user.username || 'Unknown'}</td>
            <td>${user.email || 'N/A'}</td>
            <td><span class="badge ${(user.userType || 'student').toLowerCase()}">${user.userType || 'Student'}</span></td>
            <td><span class="status-active">Active</span></td>
            <td class="actions">
                <button class="btn-edit"><i class="fas fa-edit"></i> Edit</button>
                <button class="btn-delete"><i class="fas fa-trash"></i></button>
            </td>`;
        tableBody.appendChild(tr);
    }

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

    // === 4. إضافة حساب جديد (POST) ===
    const accountForm = document.getElementById('accountForm');
    if (accountForm) {
        accountForm.onsubmit = async function(e) {
            e.preventDefault();
            const userData = {
                username: document.getElementById('fullName').value.trim(),
                email: document.getElementById('email').value.trim(),
                password: document.getElementById('password').value || "User@123", 
                userType: document.getElementById('role').value.toLowerCase(),
                userAccountId: parseInt(document.getElementById('idNumber').value.trim())
            };
            try {
                const response = await fetch(`${API_BASE_URL}/users`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(userData)
                });
                if (response.ok) {
                    const photoInput = document.getElementById('userPhoto');
                    if (photoInput && photoInput.files.length > 0) {
                        const fd = new FormData();
                        fd.append('file', photoInput.files[0]);
                        fd.append('userId', userData.userAccountId);
                        await fetch(`${API_BASE_URL}/vision/upload`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
                    }
                    modal.style.display = 'none';
                    this.reset();
                    loadAccounts();
                    Swal.fire('Success', 'User created', 'success');
                }
            } catch (error) { console.error("Add error:", error); }
        };
    }

    // === 5. الحذف والتعديل (Event Delegation) ===
    tableBody.addEventListener('click', async function(e) {
        const row = e.target.closest('tr');
        if (!row) return;
        const dbId = row.getAttribute('data-dbid');

        // حذف
        if (e.target.closest('.btn-delete')) {
            if (!dbId || dbId === 'undefined') return Swal.fire('Error', 'Invalid ID', 'error');
            const result = await Swal.fire({ title: 'Are you sure?', icon: 'warning', showCancelButton: true });
            if (result.isConfirmed) {
                try {
                    const res = await fetch(`${API_BASE_URL}/users/${dbId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.ok) { loadAccounts(); Swal.fire('Deleted!', '', 'success'); }
                    else { Swal.fire('Error', 'Could not delete user', 'error'); }
                } catch (err) { console.error(err); }
            }
        }

        // فتح مودال التعديل
        if (e.target.closest('.btn-edit')) {
            currentEditingId = dbId;
            document.getElementById('editIdNumber').value = row.cells[0].innerText;
            document.getElementById('editFullName').value = row.cells[1].innerText;
            document.getElementById('editEmail').value = row.cells[2].innerText;
            document.getElementById('editRole').value = row.cells[3].innerText.trim().toLowerCase();
            editModal.style.display = 'flex';
        }
    });

    // === 6. حفظ التعديلات (PUT) ===
    const editForm = document.getElementById('editForm');
    if (editForm) {
        editForm.onsubmit = async function(e) {
            e.preventDefault();
            if (!currentEditingId || currentEditingId === 'undefined') return;

            const updatedData = {
                // نبعت الـ id الأساسي جوه الـ body عشان TypeORM يعرف إنه تحديث
                id: isNaN(currentEditingId) ? currentEditingId : parseInt(currentEditingId),
                username: document.getElementById('editFullName').value.trim(),
                email: document.getElementById('editEmail').value.trim(),
                userType: document.getElementById('editRole').value.toLowerCase(),
                userAccountId: parseInt(document.getElementById('editIdNumber').value.trim())
            };

            if (document.getElementById('editPassword').value.trim()) {
                updatedData.password = document.getElementById('editPassword').value.trim();
            }

            try {
                const response = await fetch(`${API_BASE_URL}/users/${currentEditingId}`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedData)
                });

                if (response.ok) {
                    loadAccounts();
                    editModal.style.display = 'none';
                    Swal.fire('Updated!', 'Success', 'success');
                } else {
                    const err = await response.json();
                    Swal.fire('Update Failed', err.message || 'Error', 'error');
                }
            } catch (error) { console.error(error); }
        };
    }

    // === 7. التهيئة والسايد بار ومعاينة الصور ===
    initChartsAndSidebar();
    setupImagePreviews();
    loadAccounts(); 

    function initChartsAndSidebar() {
        const ctxPie = document.getElementById('roleDistributionChart')?.getContext('2d');
        if (ctxPie) {
            roleDistributionChart = new Chart(ctxPie, {
                type: 'pie',
                data: {
                    labels: ['Students', 'Staff', 'Admin'],
                    datasets: [{ data: [0, 0, 0], backgroundColor: ['#4e73df', '#1cc88a', '#8e44ad'] }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
        const sidebar = document.querySelector('.sidebar');
        const resizer = document.querySelector('.resizer');
        if (resizer && sidebar) {
            resizer.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const resize = (ev) => { if (ev.clientX >= 150 && ev.clientX <= 400) sidebar.style.width = ev.clientX + 'px'; };
                document.addEventListener('mousemove', resize);
                document.addEventListener('mouseup', () => document.removeEventListener('mousemove', resize));
            });
        }
    }

    function setupImagePreviews() {
        const setup = (inId, preId) => {
            const input = document.getElementById(inId);
            const preview = document.getElementById(preId);
            if(input && preview) {
                input.onchange = function() {
                    const [file] = this.files;
                    if (file) { preview.src = URL.createObjectURL(file); preview.style.display = 'block'; }
                };
            }
        };
        setup('userPhoto', 'imagePreview');
        setup('editUserPhoto', 'editImagePreview');
    }
});

function logout() { localStorage.clear(); window.location.href = "../../index.html"; }