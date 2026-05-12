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

document.addEventListener('DOMContentLoaded', function () {
    const sidebar = document.querySelector('.sidebar');
    const resizer = document.querySelector('.resizer');

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
            }
        }

        function stopResize() {
            document.removeEventListener('mousemove', resize);
            document.removeEventListener('mouseup', stopResize);
            document.body.style.cursor = 'default';
        }
    }

    loadAlerts();

    document.getElementById('clearAllBtn').addEventListener('click', async () => {
        // Since there's no "clear all" endpoint, we'll just hide them for the session or implement logic if backend supports it.
        // For now, let's just clear the UI.
        document.getElementById('alertsContainer').innerHTML = '';
        document.getElementById('noAlertsMsg').style.display = 'block';
    });

    document.getElementById('sendAlertBtn').addEventListener('click', async () => {
        const message = document.getElementById('broadcastMsg').value.trim();
        if (!message) return;

        try {
            const res = await fetch(`${API_BASE_URL}/alerts/batch`, {
                method: 'POST',
                headers: { 
                    'Authorization': getAuthToken(),
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ 
                    studentIds: [], // Empty means broadcast in some implementations, or we need to fetch all student IDs
                    message: message,
                    type: 'Info'
                })
            });

            if (res.ok) {
                Swal.fire('Sent!', 'Broadcast alert sent successfully.', 'success');
                document.getElementById('broadcastMsg').value = '';
                await loadAlerts();
            }
        } catch (err) { console.error(err); }
    });
});

async function loadAlerts() {
    const container = document.getElementById('alertsContainer');
    const noMsg = document.getElementById('noAlertsMsg');

    try {
        const res = await fetch(`${API_BASE_URL}/alerts`, {
            headers: { 'Authorization': getAuthToken() }
        });
        const result = await res.json();
        const alerts = result.data || result;

        container.innerHTML = '';
        if (Array.isArray(alerts) && alerts.length > 0) {
            noMsg.style.display = 'none';
            alerts.forEach(alert => {
                const div = document.createElement('div');
                div.className = `alert-item ${getAlertColor(alert.type)}`;
                div.innerHTML = `
                    <div class="alert-content">
                        <i class="fas fa-bell"></i>
                        <div>
                            <h4>${alert.type || 'System Alert'}</h4>
                            <p>${alert.message}</p>
                            <span class="time-tag">${new Date(alert.createdAt).toLocaleString()}</span>
                        </div>
                    </div>
                    <button class="close-alert" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
                `;
                container.appendChild(div);
            });
        } else {
            noMsg.style.display = 'block';
        }
    } catch (err) { console.error(err); }
}

function getAlertColor(type) {
    switch (String(type).toLowerCase()) {
        case 'danger': return 'red';
        case 'warning': return 'yellow';
        case 'success': return 'green';
        default: return 'blue';
    }
}

function logout() {
    localStorage.clear();
    window.location.href = "../../index.html";
}