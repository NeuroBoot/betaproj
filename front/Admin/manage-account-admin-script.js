const API_BASE_URL = 'http://localhost:3000/api/v1';

function getAuthToken() {
    let token = localStorage.getItem('token');
    if (!token) return "";
    token = token.replace(/['"]+/g, '').trim();
    if (token.toLowerCase().startsWith('bearer ')) {
        token = token.substring(7).trim();
    }
    return `Bearer ${token}`;
}

document.addEventListener('DOMContentLoaded', async function() {
    const sidebar = document.querySelector('.sidebar');
    const resizer = document.querySelector('.resizer');
    
    let enrollmentChart, roleDistributionChart;

    if (resizer && sidebar) {
        resizer.addEventListener('mousedown', function (e) {
            e.preventDefault();
            document.addEventListener('mousemove', resize);
            document.addEventListener('mouseup', stopResize);
            document.body.style.cursor = 'col-resize';
        });

        function resize(e) {
            let newWidth = e.clientX;
            if (newWidth >= 150 && newWidth <= 500) {
                sidebar.style.width = newWidth + 'px';
                if(enrollmentChart) enrollmentChart.resize();
                if(roleDistributionChart) roleDistributionChart.resize();
            }
        }

        function stopResize() {
            document.removeEventListener('mousemove', resize);
            document.removeEventListener('mouseup', stopResize);
            document.body.style.cursor = 'default';
        }
    }

    await loadAccounts();
    await initCharts();

    const modal = document.getElementById('accountModal');
    const editModal = document.getElementById('editModal');
    
    document.getElementById('openModalBtn').onclick = () => {
        document.getElementById('accountForm').reset();
        modal.style.display = 'flex';
    };
    document.getElementById('closeModalBtn').onclick = () => modal.style.display = 'none';
    document.getElementById('closeEditModalBtn').onclick = () => editModal.style.display = 'none';

    // Add Account
    document.getElementById('accountForm').onsubmit = async function(e) {
        e.preventDefault();
        const userData = {
            username: document.getElementById('username').value.trim(),
            password: document.getElementById('password').value.trim(),
            fullName: document.getElementById('fullName').value.trim(),
            email: document.getElementById('email').value.trim(),
            role: document.getElementById('role').value
        };

        try {
            const res = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });

            if (res.ok) {
                modal.style.display = 'none';
                await loadAccounts();
                Swal.fire({ icon: 'success', title: 'Account Created', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
            } else {
                const err = await res.json();
                Swal.fire({ icon: 'error', title: 'Failed', text: err.message });
            }
        } catch (err) { console.error(err); }
    };

    // Edit Account
    document.getElementById('editForm').onsubmit = async function(e) {
        e.preventDefault();
        const id = document.getElementById('editId').value;
        const username = document.getElementById('editUsername').value;
        const updateData = {
            fullName: document.getElementById('editFullName').value.trim(),
            email: document.getElementById('editEmail').value.trim(),
            role: document.getElementById('editRole').value
        };

        try {
            const res = await fetch(`${API_BASE_URL}/users/${username}`, {
                method: 'PUT',
                headers: { 
                    'Authorization': getAuthToken(),
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify(updateData)
            });

            if (res.ok) {
                editModal.style.display = 'none';
                await loadAccounts();
                Swal.fire({ icon: 'success', title: 'Updated Successfully', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
            }
        } catch (err) { console.error(err); }
    };

    window.onclick = (e) => {
        if (e.target == modal) modal.style.display = 'none';
        if (e.target == editModal) editModal.style.display = 'none';
    };
});

async function loadAccounts() {
    const tableBody = document.getElementById('accountsTableBody');
    try {
        const res = await fetch(`${API_BASE_URL}/users`, {
            headers: { 'Authorization': getAuthToken() }
        });
        const result = await res.json();
        const users = result.data || result;
        tableBody.innerHTML = '';
        if (Array.isArray(users)) {
            users.forEach(user => {
                const tr = document.createElement('tr');
                const role = user.role || user.userType || 'student';
                tr.innerHTML = `
                    <td>${user.userAccountId || user.id}</td>
                    <td>${user.fullName || user.username}</td>
                    <td>${user.email || 'N/A'}</td>
                    <td><span class="badge ${role.toLowerCase()}">${role}</span></td>
                    <td><span class="status-active">${user.isDeleted ? 'Deleted' : 'Active'}</span></td>
                    <td class="actions">
                        <button class="btn-edit" onclick='openEditModal(${JSON.stringify(user)})'><i class="fas fa-edit"></i> Edit</button>
                        <button class="btn-delete" onclick="deleteAccount('${user.username}')"><i class="fas fa-trash"></i></button>
                    </td>`;
                tableBody.appendChild(tr);
            });
        }
    } catch (err) { console.error(err); }
}

function openEditModal(user) {
    document.getElementById('editId').value = user.userAccountId || user.id;
    document.getElementById('editUsername').value = user.username;
    document.getElementById('editFullName').value = user.fullName || "";
    document.getElementById('editEmail').value = user.email || "";
    document.getElementById('editRole').value = user.role || user.userType || "student";
    document.getElementById('editModal').style.display = 'flex';
}

async function deleteAccount(username) {
    const result = await Swal.fire({
        title: 'Delete Account?',
        text: "This will soft-delete the user.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33'
    });

    if (result.isConfirmed) {
        try {
            const res = await fetch(`${API_BASE_URL}/users/${username}`, {
                method: 'DELETE',
                headers: { 'Authorization': getAuthToken() }
            });
            if (res.ok) {
                await loadAccounts();
                Swal.fire('Deleted!', 'User has been removed.', 'success');
            }
        } catch (err) { console.error(err); }
    }
}

async function initCharts() {
    try {
        const res = await fetch(`${API_BASE_URL}/users`, {
            headers: { 'Authorization': getAuthToken() }
        });
        const result = await res.json();
        const users = result.data || result;
        
        const students = users.filter(u => (u.role || u.userType) === 'student').length;
        const staff = users.filter(u => (u.role || u.userType) === 'staff').length;
        const admins = users.filter(u => (u.role || u.userType) === 'admin').length;
        const total = users.length || 1;

        // Update Stat Cards
        if(document.getElementById('studentCount')) document.getElementById('studentCount').textContent = students;
        if(document.getElementById('staffCount')) document.getElementById('staffCount').textContent = staff;
        if(document.getElementById('adminCount')) document.getElementById('adminCount').textContent = admins;

        const ctxPie = document.getElementById('roleDistributionChart').getContext('2d');
        new Chart(ctxPie, {
            type: 'pie',
            data: {
                labels: [`Students (${((students/total)*100).toFixed(1)}%)`, `Staff (${((staff/total)*100).toFixed(1)}%)`, `Admin (${((admins/total)*100).toFixed(1)}%)`], 
                datasets: [{
                    data: [students, staff, admins],
                    backgroundColor: ['#3060ff', '#2ecc71', '#9b59b6'],
                    borderWidth: 0
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: '#b0b0b0' } } }
            }
        });

        // Line Chart Placeholder for Monthly Growth (would need a specific backend endpoint for history)
        const ctxLine = document.getElementById('enrollmentChart').getContext('2d');
        new Chart(ctxLine, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'Total Users',
                    data: [total-5, total-3, total-2, total-1, total, total],
                    borderColor: '#3060ff',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    } catch (e) { console.error(e); }
}

function logout() {
    localStorage.clear();
    window.location.href = "../../index.html";
}