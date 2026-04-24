const API_BASE_URL = 'http://localhost:3000/api/v1'; 

document.addEventListener('DOMContentLoaded', async function () {
    
    // 1. --- عرض اسم المسؤول من localStorage ---
    const userNameElement = document.getElementById('adminName');
    const savedName = localStorage.getItem('username'); 
    if (savedName && userNameElement) {
        userNameElement.textContent = savedName;
    }

    // 2. --- وظائف السايد بار (تحجيم وموبايل) ---
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

    // 3. --- جلب التنبيهات الحقيقية من السيرفر عند البدء ---
    await loadAlertsFromServer();

    // 4. --- تفعيل زرار الإرسال ---
    const sendBtn = document.getElementById('sendAlertBtn');
    if (sendBtn) {
        sendBtn.addEventListener('click', sendBroadcastAlert);
    }

    // 5. --- تفعيل زرار مسح الكل ---
    const clearAllBtn = document.getElementById('clearAllBtn');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', clearAllAlertsFromServer);
    }
});

// --- وظيفة جلب التنبيهات ---
async function loadAlertsFromServer() {
    const container = document.getElementById('alertsContainer');
    const noAlertsMsg = document.getElementById('noAlertsMsg');
    const token = localStorage.getItem('token');

    try {
        // GET /api/v1/alerts
        const response = await fetch(`${API_BASE_URL}/alerts`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Failed to fetch alerts');

        const data = await response.json();
        // التعامل مع هيكل الـ Response (data.data أو data)
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
        noAlertsMsg.style.display = 'block';
    }
}

// --- وظيفة رسم التنبيه (Mapping) ---
function renderAlertItem(alert) {
    const container = document.getElementById('alertsContainer');
    // تحويل النوع لحروف صغيرة ليتناسب مع الـ CSS classes
    const typeClass = (alert.type || 'information').toLowerCase(); 
    // السيرفر غالباً يستخدم _id (MongoDB) أو id
    const alertId = alert._id || alert.id;

    const html = `
        <div class="alert-item ${typeClass}" id="alert-${alertId}">
            <div class="alert-content">
                <i class="fas fa-bell"></i>
                <div>
                    <h4>${alert.title || 'System Notification'}</h4>
                    <p>${alert.message}</p>
                    <span class="time-tag">${new Date(alert.createdAt).toLocaleString('en-GB')}</span>
                </div>
            </div>
            <button class="close-alert" onclick="deleteSingleAlert('${alertId}')">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
}

// --- وظيفة الإرسال الفعلي (Broadcast) ---
async function sendBroadcastAlert() {
    const messageField = document.getElementById('broadcastMsg');
    const typeField = document.getElementById('alertType');
    const recipientField = document.getElementById('recipients');
    const sendBtn = document.getElementById('sendAlertBtn');
    const token = localStorage.getItem('token');

    if (!messageField.value.trim()) {
        alert("Please enter a message.");
        return;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = "Sending...";

    try {
        const response = await fetch(`${API_BASE_URL}/alerts`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                title: `Admin: ${typeField.value}`,
                message: messageField.value.trim(),
                type: typeField.value.toLowerCase(), // تأكدي من إرسال النوع lowercase للسيرفر
                target: recipientField.value
            })
        });

        if (response.ok) {
            alert("Alert broadcasted successfully! ✅");
            messageField.value = ''; 
            await loadAlertsFromServer(); // تحديث القائمة فوراً
        } else {
            const err = await response.json();
            alert(`Error: ${err.message || 'Failed to send'}`);
        }
    } catch (error) {
        alert("Connection error. Is the server running?");
    } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = "Send Alert";
    }
}

// --- وظيفة حذف تنبيه واحد ---
async function deleteSingleAlert(id) {
    if (!confirm("Are you sure you want to remove this alert?")) return;
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_BASE_URL}/alerts/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            await loadAlertsFromServer();
        }
    } catch (e) { console.error("Delete failed:", e); }
}

// --- وظيفة مسح كل التنبيهات من السيرفر ---
async function clearAllAlertsFromServer() {
    if (!confirm("This will delete ALL notifications from the database. Proceed?")) return;
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_BASE_URL}/alerts`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            await loadAlertsFromServer();
        }
    } catch (e) { console.error("Clear all failed:", e); }
}

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.classList.toggle('active');
}

function logout() { 
    localStorage.clear(); 
    window.location.href = "../../index.html"; 
}