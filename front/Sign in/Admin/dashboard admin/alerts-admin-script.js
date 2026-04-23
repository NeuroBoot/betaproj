const API_BASE_URL = 'http://localhost:3000/api/v1'; // تأكدي إن ده رابط السيرفر بتاعك

document.addEventListener('DOMContentLoaded', async function () {
    
    // 1. --- عرض اسم المسؤول ---
    const userNameElement = document.getElementById('adminName');
    const savedName = localStorage.getItem('username'); 
    if (savedName && userNameElement) {
        userNameElement.textContent = savedName;
    }

    // 2. --- وظائف السايد بار (التحجيم والموبايل) ---
    const sidebar = document.querySelector('.sidebar');
    const resizer = document.querySelector('.resizer');
    const mainContent = document.querySelector('.main-content');

    if (resizer && sidebar) {
        resizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            document.addEventListener('mousemove', resize);
            document.addEventListener('mouseup', stopResize);
            document.body.style.cursor = 'col-resize';
        });
        function resize(e) {
            let newWidth = e.clientX;
            if (newWidth >= 150 && newWidth <= 500) { sidebar.style.width = newWidth + 'px'; }
        }
        function stopResize() {
            document.removeEventListener('mousemove', resize);
            document.removeEventListener('mouseup', stopResize);
            document.body.style.cursor = 'default';
        }
    }

    if (mainContent && sidebar) {
        mainContent.addEventListener('click', () => {
            if (sidebar.classList.contains('active')) sidebar.classList.remove('active');
        });
    }

    // 3. --- تحميل التنبيهات من السيرفر عند فتح الصفحة ---
    await loadAlertsFromServer();

    // 4. --- زرار إرسال تنبيه جديد (Broadcast Alert) ---
    const sendBtn = document.getElementById('sendAlertBtn');
    if (sendBtn) {
        sendBtn.addEventListener('click', sendBroadcastAlert);
    }

    // 5. --- زرار مسح كل التنبيهات ---
    const clearAllBtn = document.getElementById('clearAllBtn');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', clearAllAlertsFromServer);
    }
});

// --- دالة جلب التنبيهات من الباك إند ---
async function loadAlertsFromServer() {
    const container = document.getElementById('alertsContainer');
    const noAlertsMsg = document.getElementById('noAlertsMsg');
    const token = localStorage.getItem('token');

    try {
        const response = await fetch(`${API_BASE_URL}/alerts`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        const alerts = data.data || data;

        if (Array.isArray(alerts) && alerts.length > 0) {
            container.innerHTML = '';
            noAlertsMsg.style.display = 'none';
            alerts.forEach(alert => renderAlertItem(alert));
        } else {
            container.innerHTML = '';
            noAlertsMsg.style.display = 'block';
        }
    } catch (error) {
        console.error("Error loading alerts:", error);
    }
}

// --- دالة رسم التنبيه بشكل ديناميكي ---
function renderAlertItem(alert) {
    const container = document.getElementById('alertsContainer');
    const typeClass = (alert.type || 'information').toLowerCase(); 
    const alertId = alert.id || alert._id;

    // تحديد اللون بناءً على النوع كما في التصميم
    const html = `
        <div class="alert-item ${typeClass}" id="alert-${alertId}">
            <div class="alert-content">
                <i class="fas fa-bell"></i>
                <div>
                    <h4>${alert.title || 'System Notification'}</h4>
                    <p>${alert.message}</p>
                    <span class="time-tag">${new Date(alert.createdAt).toLocaleString()}</span>
                </div>
            </div>
            <button class="close-alert" onclick="deleteSingleAlert('${alertId}')">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
}

// --- دالة إرسال تنبيه جديد (الربط مع الزرار) ---
async function sendBroadcastAlert() {
    const messageField = document.getElementById('broadcastMsg');
    const typeField = document.getElementById('alertType');
    const recipientField = document.getElementById('recipients');
    const sendBtn = document.getElementById('sendAlertBtn');

    if (!messageField.value.trim()) {
        alert("Please type a message first.");
        return;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = "Sending...";

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/alerts`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                title: `Broadcast: ${typeField.value}`,
                message: messageField.value,
                type: typeField.value,
                target: recipientField.value
            })
        });

        if (response.ok) {
            alert("Alert sent successfully! ✅");
            messageField.value = ''; // مسح النص
            loadAlertsFromServer(); // تحديث القائمة
        } else {
            alert("Failed to send alert.");
        }
    } catch (error) {
        alert("Server connection error.");
    } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = "Send Alert";
    }
}

// --- دالة حذف تنبيه واحد ---
async function deleteSingleAlert(id) {
    if (!confirm("Remove this notification?")) return;
    try {
        const token = localStorage.getItem('token');
        await fetch(`${API_BASE_URL}/alerts/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        loadAlertsFromServer();
    } catch (e) { console.error(e); }
}

// --- دالة مسح كل التنبيهات ---
async function clearAllAlertsFromServer() {
    if (!confirm("Clear all notifications?")) return;
    try {
        const token = localStorage.getItem('token');
        await fetch(`${API_BASE_URL}/alerts`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        loadAlertsFromServer();
    } catch (e) { console.error(e); }
}

// وظائف عامة
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.classList.toggle('active');
}

function logout() { 
    localStorage.clear(); 
    window.location.href = "../../index.html"; 
}