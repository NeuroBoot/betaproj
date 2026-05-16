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

document.addEventListener('DOMContentLoaded', async function () {
    const nameDisplay = document.getElementById('adminName'); 
    const savedName = localStorage.getItem('username');

    if (nameDisplay && savedName) {
        const formattedName = savedName.charAt(0).toUpperCase() + savedName.slice(1);
        nameDisplay.textContent = formattedName;
    }

    await loadAlertsFromServer();
    await fillRecipients();

    document.getElementById('sendAlertBtn').onclick = handleAlertDispatch;
    document.getElementById('clearAllBtn').onclick = clearAllAlertsFromServer;
});

// 1. جلب وعرض التنبيهات من السيرفر
async function loadAlertsFromServer() {
    const container = document.getElementById('alertsContainer');
    const noAlertsMsg = document.getElementById('noAlertsMsg');

    try {
        const response = await fetch(`${API_BASE_URL}/alerts`, {
            headers: { 'Authorization': getAuthToken() }
        });
        const data = await response.json();
        const alerts = data.data || data;

        container.innerHTML = '';
        if (Array.isArray(alerts) && alerts.length > 0) {
            noAlertsMsg.style.display = 'none';
            alerts.forEach(alert => {
                const typeClass = (alert.type || 'information').toLowerCase();
                const alertId = alert._id || alert.id;
                const html = `
                    <div class="alert-item ${typeClass}" id="alert-${alertId}">
                        <div class="alert-content">
                            <div class="alert-details">
                                <h4>System Alert</h4>
                                <p>${alert.message}</p>
                                <span class="time-tag">
                                    <i class="far fa-clock"></i> ${new Date(alert.createdAt).toLocaleString('en-GB')}
                                </span>
                            </div>
                        </div>
                        <button class="close-alert" onclick="deleteSingleAlert('${alertId}')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>`;
                container.insertAdjacentHTML('beforeend', html);
            });
        } else {
            noAlertsMsg.style.display = 'block';
        }
    } catch (error) { noAlertsMsg.style.display = 'block'; }
}

// 2. إرسال التنبيهات (جماعي وفردي)
async function handleAlertDispatch() {
    const messageField = document.getElementById('broadcastMsg');
    const message = messageField.value.trim();
    const type = document.getElementById('alertType').value;
    const recipientValue = document.getElementById('recipients').value; 
    const sendBtn = document.getElementById('sendAlertBtn');

    if (!message) {
        Swal.fire({ icon: 'info', title: 'Empty Message', text: 'Please type a message.' });
        return;
    }

    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    try {
        const groupOptions = ['all', 'students', 'staff'];
        
        if (groupOptions.includes(recipientValue)) {
            // جلب المستخدمين لفلترتهم وتحويلهم لمصفوفة IDs كما طلب السيرفر
            const userRes = await fetch(`${API_BASE_URL}/users`, { headers: { 'Authorization': getAuthToken() } });
            const userResult = await userRes.json();
            let allUsers = userResult.data || userResult;
            if (allUsers.data) allUsers = allUsers.data;

            let targetIds = [];
            if (recipientValue === 'all') {
                targetIds = allUsers.map(u => parseInt(u.id || u.userAccountId));
            } else if (recipientValue === 'students') {
                targetIds = allUsers
                    .filter(u => (u.role || u.userType || '').toLowerCase() === 'student')
                    .map(u => parseInt(u.id || u.userAccountId));
            } else if (recipientValue === 'staff') {
                targetIds = allUsers
                    .filter(u => (u.role || u.userType || '').toLowerCase() === 'staff' || (u.role || '').toLowerCase() === 'instructor')
                    .map(u => parseInt(u.id || u.userAccountId));
            }

            const response = await fetch(`${API_BASE_URL}/alerts/batch`, {
                method: 'POST',
                headers: { 'Authorization': getAuthToken(), 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userIds: targetIds, // إرسال مصفوفة الأرقام المطلوبة
                    message: message,
                    type: type.toLowerCase()
                })
            });

            if (response.ok) showSuccess();
            else {
                const err = await response.json();
                Swal.fire('Error', err.message.toString(), 'error');
            }

        } else {
            // الإرسال الفردي المستمر في العمل
            const response = await fetch(`${API_BASE_URL}/alerts/send/${recipientValue}`, {
                method: 'POST',
                headers: { 'Authorization': getAuthToken(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: message, type: type.toLowerCase() })
            });
            if (response.ok) showSuccess();
        }
    } catch (e) {
        Swal.fire('Error', 'Connection failed.', 'error');
    } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send Alert';
    }

    function showSuccess() {
        Swal.fire({ icon: 'success', title: 'Sent Successfully', timer: 2000, showConfirmButton: false });
        messageField.value = '';
        loadAlertsFromServer();
    }
}

// 3. جلب المستخدمين وعرض الأدوار (Roles) بدقة
async function fillRecipients() {
    const select = document.getElementById('recipients');
    try {
        const response = await fetch(`${API_BASE_URL}/users`, { headers: { 'Authorization': getAuthToken() } });
        const result = await response.json();
        let users = result.data || result;
        if (users.data) users = users.data;

        if (Array.isArray(users)) {
            const group = document.createElement('optgroup');
            group.label = "Individual Users";
            users.forEach(u => {
                const opt = document.createElement('option');
                opt.value = u.id || u.userAccountId;
                
                // محاولة جلب الرول من أكثر من مفتاح لضمان ظهوره
                const rawRole = u.role || u.userType || u.user_type || 'User';
                const formattedRole = rawRole.charAt(0).toUpperCase() + rawRole.slice(1);
                
                opt.textContent = `${u.fullName || u.username} (${formattedRole})`;
                group.appendChild(opt);
            });
            select.appendChild(group);
        }
    } catch (e) { console.error(e); }
}

async function deleteSingleAlert(id) {
    const res = await Swal.fire({ title: 'Delete?', icon: 'warning', showCancelButton: true });
    if (res.isConfirmed) {
        const response = await fetch(`${API_BASE_URL}/alerts/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': getAuthToken() }
        });
        if (response.ok) loadAlertsFromServer();
    }
}

async function clearAllAlertsFromServer() {
    const res = await Swal.fire({ title: 'Clear All?', icon: 'error', showCancelButton: true });
    if (res.isConfirmed) {
        await fetch(`${API_BASE_URL}/alerts`, {
            method: 'DELETE',
            headers: { 'Authorization': getAuthToken() }
        });
        loadAlertsFromServer();
    }
}


function logout() { localStorage.clear(); window.location.href = "../../index.html"; }
function toggleSidebar() { document.querySelector('.sidebar').classList.toggle('active'); }