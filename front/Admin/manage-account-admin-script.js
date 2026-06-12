

document.addEventListener('DOMContentLoaded', async function () {

   
    
    const API_BASE_URL = 'http://localhost:3000/api/v1';

    let token = localStorage.getItem('token');
    if (token) token = token.replace(/['"]+/g, '').trim();

    

    const modal           = document.getElementById('accountModal');
    const editModal       = document.getElementById('editModal');
    const tableBody       = document.getElementById('accountsTableBody');

    const totalStudentsEl = document.getElementById('totalStudentsCount');
    const totalStaffEl    = document.getElementById('totalStaffCount');
    const totalAdminEl    = document.getElementById('totalAdminCount');

    let enrollmentChart       = null;
    let roleDistributionChart = null;

    let currentEditingId   = null;
    let currentEditingUser = null;
   

    function authHeaders() {
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type':  'application/json'
        };
    }

    async function apiFetch(path, options = {}) {
        try {
            const res  = await fetch(`${API_BASE_URL}${path}`, {
                headers: authHeaders(),
                ...options
            });
            const data = await res.json().catch(() => ({}));
            return { ok: res.ok, status: res.status, data };
        } catch (err) {
            console.error(`[API] ${path}`, err);
            return { ok: false, status: 0, data: {} };
        }
    }

    function unwrapArray(data) {
        if (Array.isArray(data))        return data;
        if (Array.isArray(data?.data))  return data.data;
        if (Array.isArray(data?.items)) return data.items;
        return [];
    }

    function filesToBase64(files) {
        return Promise.all(
            Array.from(files).map(file => new Promise((resolve, reject) => {
                const reader   = new FileReader();
                reader.onload  = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            }))
        );
    }

    // admin name

    const nameDisplay = document.getElementById('adminName');
    const savedName   = localStorage.getItem('username');
    if (nameDisplay) {
        nameDisplay.textContent = savedName
            ? savedName.charAt(0).toUpperCase() + savedName.slice(1)
            : 'Admin';
    }

 
 
   
    document.getElementById('openModalBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        modal.style.display = 'flex';
    });

    document.querySelectorAll('.btn-cancel, #closeModalBtn, #closeEditModalBtn')
        .forEach(btn => btn.addEventListener('click', () => {
            modal.style.display     = 'none';
            editModal.style.display = 'none';
            
           
            const faceStatusEl = document.getElementById('editFaceStatus');
            if (faceStatusEl) faceStatusEl.innerHTML = '';
              

        }));

    window.addEventListener('click', (e) => {
        if (e.target === modal)     modal.style.display     = 'none';
        if (e.target === editModal) editModal.style.display = 'none';
    });

   
    // CHARTS
   
    function initCharts() {
        const sharedOptions = {
            responsive:          true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#b0b0b0' } }
            }
        };

        const enrollCtx = document.getElementById('enrollmentChart')?.getContext('2d');
        if (enrollCtx && !enrollmentChart) {
            enrollmentChart = new Chart(enrollCtx, {
                type: 'line',
                data: {
                    labels: ['Jan','Feb','Mar','Apr','May','Jun',
                             'Jul','Aug','Sep','Oct','Nov','Dec'],
                    datasets: [{
                        label:                'Students',
                        data:                 new Array(12).fill(0),
                        borderColor:          '#3060ff',
                        backgroundColor:      'rgba(48,96,255,0.1)',
                        tension:              0.4,
                        fill:                 true,
                        pointBackgroundColor: '#3060ff'
                    }]
                },
                options: {
                    ...sharedOptions,
                    scales: {
                        x: { ticks: { color: '#b0b0b0' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                        y: { ticks: { color: '#b0b0b0' }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true }
                    }
                }
            });
        }

        const roleCtx = document.getElementById('roleDistributionChart')?.getContext('2d');
        if (roleCtx && !roleDistributionChart) {
            roleDistributionChart = new Chart(roleCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Students', 'Staff', 'Admins'],
                    datasets: [{
                        data:            [0, 0, 0],
                        backgroundColor: ['#3060ff', '#2ecc71', '#9b59b6'],
                        borderColor:     'rgba(255,255,255,0.05)',
                        borderWidth:     2
                    }]
                },
                options: sharedOptions
            });
        }
    }

    // LOAD ACCOUNTS
  
    async function loadAccounts() {
        if (!token) {
            console.warn(' No token — redirecting to login');
            window.location.href = '../../signin/index.html';
            return;
        }

        const { ok, data, status } = await apiFetch('/users');

        if (!ok) {
            console.error(' Failed to load users. Status:', status, data);
            if (status === 401) {
                Swal.fire('Session Expired', 'Please log in again.', 'warning')
                    .then(() => {
                        localStorage.clear();
                        window.location.href = '../../signin/index.html';
                    });
            }
            return;
        }

        const users = unwrapArray(data);
        console.log(' Users loaded:', users.length, users);

        if (!users.length) {
            tableBody.innerHTML = '<tr><td colspan="6">No accounts found.</td></tr>';
            return;
        }

        tableBody.innerHTML = '';
        users.forEach(renderUserRow);
        updateStatsAndCharts(users);
    }

    
   
    function renderUserRow(user) {
        const tr = document.createElement('tr');

        const dbId = user.userAccountId ?? user.id ?? user._id;
        const role = (user.userType ?? 'student').toLowerCase();

        console.log(' Row — dbId:', dbId, 'userType:', role);

        tr.setAttribute('data-dbid', dbId);
        tr.setAttribute('data-user', JSON.stringify(user));

        tr.innerHTML = `
            <td>${user.userAccountId ?? 'N/A'}</td>
            <td>${user.fullName ?? user.username ?? 'Unknown'}</td>
            <td>${user.email ?? 'N/A'}</td>
            <td>${user.phone ?? 'N/A'}</td>
            <td><span class="badge ${role}">${role}</span></td>
            <td><span class="status-active">Active</span></td>
            <td>
                <button class="btn-edit">Edit</button>
                <button class="btn-delete">Delete</button>
            </td>
        `;

        tableBody.appendChild(tr);
    }

   
    // update  CHARTS
  
    function updateStatsAndCharts(users) {
        const studentCount = users.filter(u => String(u.userType).toLowerCase() === 'student').length;
        const staffCount   = users.filter(u => String(u.userType).toLowerCase() === 'staff').length;
        const adminCount   = users.filter(u => String(u.userType).toLowerCase() === 'admin').length;

        if (totalStudentsEl) totalStudentsEl.textContent = studentCount;
        if (totalStaffEl)    totalStaffEl.textContent    = staffCount;
        if (totalAdminEl)    totalAdminEl.textContent    = adminCount;

        if (roleDistributionChart) {
            roleDistributionChart.data.datasets[0].data = [studentCount, staffCount, adminCount];
            roleDistributionChart.update();
        }

        if (enrollmentChart) {
            const monthly = new Array(12).fill(0);
            const currentYear = new Date().getFullYear();
        users
            .filter(u => String(u.userType).toLowerCase() === 'student')
            .forEach(u => {
                const dateStr = u.createdAt ?? u.registeredAt ?? u.created_at;
                if (!dateStr) return;

                const date = new Date(dateStr);
                if (date.getFullYear() === currentYear) {
                    monthly[date.getMonth()]++;
                }
            });

        enrollmentChart.data.datasets[0].data = monthly;
        enrollmentChart.update();
     }
    }

   
    
    async function uploadFaceImages(studentId, fullName, files) {
        if (!files || files.length === 0) return;

        const base64Images = await filesToBase64(files);

        const payload = {
            students: [{
                studentId:    String(studentId),
                name:         fullName,
                imagesBase64: base64Images
            }],
            confidenceThreshold: 0.6
        };

        try {
            const res    = await fetch(`${API_BASE_URL}/vision/upload`, {
                method:  'POST',
                headers: authHeaders(),
                body:    JSON.stringify(payload)
            });
            const result = await res.json();
            const normalized = Array.isArray(result) ? result[0] : result;

            if (res.ok && normalized?.success) {
                console.log(`[Vision] Registered: ${normalized.detail?.message ?? 'OK'}`);
            } else {
                console.warn('[Vision] Warning:', normalized?.error ?? result);
                Swal.fire('Warning', 'Account saved but face registration failed. You can update the photo later.', 'warning');
            }
        } catch (err) {
            console.error('[Vision] Upload error:', err);
            Swal.fire('Warning', 'Account saved but face registration failed. You can update the photo later.', 'warning');
        }
    }

   
    // CREATE ACCOUNT
  
    document.getElementById('accountForm')?.addEventListener('submit', async function (e) {
        e.preventDefault();

        const fullNameValue = document.getElementById('fullName').value.trim();
        const userData = {
            username:      fullNameValue,
            fullName:      fullNameValue,
            email:         document.getElementById('email').value.trim(),
            password:      document.getElementById('password').value || 'User@123',
            userType:      document.getElementById('role').value.toLowerCase(),
            phone:         document.getElementById('phone').value.trim()

        };

        console.log(' Creating user:', userData);

        const { ok, data } = await apiFetch('/users', {
            method: 'POST',
            body:   JSON.stringify(userData)
        });

        if (!ok) {
            console.error(' Create failed:', data);
            Swal.fire('Error', data?.message ?? 'Failed to create account.', 'error');
            return;
        }
       
        const userId = data?.userAccountId ?? data?.data?.userAccountId;
        const photoInput = document.getElementById('userPhoto');
        if (photoInput?.files.length > 0 && userId) {
            await uploadFaceImages(userId, userData.fullName, photoInput.files);
        }

        modal.style.display = 'none';
        this.reset();
        const preview = document.getElementById('imagePreview');
        if (preview) preview.style.display = 'none';

        await loadAccounts();
        Swal.fire('Success', 'Account created successfully.', 'success');
    });


    // EDIT&DELETE

    tableBody.addEventListener('click', async function (e) {
        const row = e.target.closest('tr');
        if (!row) return;

        const dbId = row.getAttribute('data-dbid');
        console.log(' Row clicked — dbId:', dbId);

        // -
        if (e.target.closest('.btn-delete')) {
            const result = await Swal.fire({
                title:              'Delete Account?',
                text:               'This action cannot be undone.',
                icon:               'warning',
                showCancelButton:   true,
                confirmButtonColor: '#e74c3c',
                confirmButtonText:  'Delete'
            });
            if (!result.isConfirmed) return;

            await apiFetch(`/alerts?userId=${dbId}`, { method: 'DELETE' });
            const { ok, status, data } = await apiFetch(`/users/${dbId}?hard=true`, { method: 'DELETE' });
            console.log('Delete response — ok:', ok, 'status:', status, data);

            if (ok) {
                await loadAccounts();
                Swal.fire('Deleted', 'Account removed.', 'success');
            } else {
                Swal.fire('Error', data?.message ?? `Failed to delete (${status})`, 'error');
            }
            return;
        }

   // ------- EDIT modal-------
if (e.target.closest('.btn-edit')) {
    currentEditingId = parseInt(dbId, 10);   
    console.log(' Edit clicked — currentEditingId:', currentEditingId);

    let user = null;
    try {
        user = JSON.parse(row.getAttribute('data-user'));
    } catch { /* ignore */ }

    if (!user) {
        const { ok, data } = await apiFetch(`/users/${dbId}`);
        user = ok ? (data?.data ?? data) : null;
    }

    console.log(' User to edit:', user);

    if (user) {
        currentEditingUser = user;

        document.getElementById('editFullName').value = user.fullName  ?? user.username ?? '';
        document.getElementById('editEmail').value     = user.email     ?? '';
        document.getElementById('editPassword').value = '';
        document.getElementById('editPhone').value = user.phone ?? '';

        const roleSelect = document.getElementById('editRole');
        const roleVal    = (user.userType ?? 'student').toLowerCase();
        Array.from(roleSelect.options).forEach(opt => {
            opt.selected = opt.value.toLowerCase() === roleVal;
        });

        //  EMBEDDING STATUS
        const faceStatusEl = document.getElementById('editFaceStatus');
        if (faceStatusEl) {

          if (user.embeddingImagesCount > 0) {
          faceStatusEl.style.color = '#2ecc71';
         faceStatusEl.innerHTML = `<i class="fas fa-check-circle"></i> Face Registered (${user.embeddingImagesCount} image${user.embeddingImagesCount > 1 ? 's' : ''})`;
          } else {
       faceStatusEl.style.color = '#e74c3c';
       faceStatusEl.innerHTML = '<i class="fas fa-times-circle"></i> No Face Data Stored';
        }
        }

        const editPreview = document.getElementById('editImagePreview');
        if (editPreview) editPreview.style.display = 'none';
        
        
        const oldCount = document.getElementById('editImagePreviewCount');
        if (oldCount) oldCount.remove();

        document.getElementById('editUserPhoto').value = '';

    } else {
        Swal.fire('Error', 'Could not load user data.', 'error');
        return;
    }

    editModal.style.display = 'flex';
}
    });

    // EDIT FORM SUBMIT 
  
    document.getElementById('editForm')?.addEventListener('submit', async function (e) {
        e.preventDefault();

        if (!currentEditingId) {
            console.error(' No currentEditingId — cannot update');
            Swal.fire('Error', 'No user selected for editing.', 'error');
            return;
        }

        const fullNameValue = document.getElementById('editFullName').value.trim();
        const newPassword   = document.getElementById('editPassword').value;
        

        const updateData = {
            fullName:      fullNameValue,
            username:      fullNameValue,
            email:         document.getElementById('editEmail').value.trim(),
            userType:      document.getElementById('editRole').value.toLowerCase(),
            phone:         document.getElementById('editPhone').value.trim()
           
        };

        if (newPassword.trim()) {
            updateData.password = newPassword;
        }

        console.log(' PUT /users/' + currentEditingId, updateData);

   
        const { ok, data, status } = await apiFetch(`/users/${currentEditingId}`, {
            method: 'PUT',
            body:   JSON.stringify(updateData)
        });

        console.log(' PUT response — ok:', ok, 'status:', status, data);

        if (!ok) {
            Swal.fire('Error', data?.message ?? `Failed to update account (${status}).`, 'error');
            return;
        }
     
       
        const editPhotoInput = document.getElementById('editUserPhoto');
        if (editPhotoInput?.files.length > 0) {
            await uploadFaceImages(currentEditingId, updateData.fullName, editPhotoInput.files);
        }

      

    editModal.style.display = 'none';
    this.reset();
    
    const editPreview = document.getElementById('editImagePreview');
    if (editPreview) editPreview.style.display = 'none';
    const faceStatusEl = document.getElementById('editFaceStatus');
    if (faceStatusEl) faceStatusEl.innerHTML = ''; 

    currentEditingId   = null;
    currentEditingUser = null;

    await loadAccounts();
    Swal.fire('Updated', 'Account updated successfully.', 'success');
    });

  
    initCharts();
    await loadAccounts();
});


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
