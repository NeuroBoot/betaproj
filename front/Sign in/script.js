document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    // 1. جلب القيم
    const usernameInput = String(document.getElementById('username').value).trim();
    const passwordInput = String(document.getElementById('password').value).trim();
    const roleRadio = document.querySelector('input[name="role"]:checked');
    const selectedRole = roleRadio ? String(roleRadio.value) : null;

    // 2. التحقق من ملء الحقول فقط
    if (!usernameInput || !passwordInput || !selectedRole) {
        showStatus("Please fill in all fields and select a role.", "error");
        return;
    }

    try {
        // رسالة ترحيبية بالاسم اللي كتبه المستخدم أياً كان
        showStatus(`Welcome, ${usernameInput}! Redirecting as ${selectedRole}...`, "success");

        // 3. تخزين البيانات في المتصفح (عشان تظهر في الداشبورد)
        localStorage.setItem('loggedUser', usernameInput);
        localStorage.setItem('userRole', selectedRole);

        // 4. التوجيه بناءً على الاختيار (Role-Based Redirect)
        setTimeout(() => {
            if (selectedRole === "Admin") {
                window.location.href = "Admin/dashboard admin/dashboard-index.html";
            } else if (selectedRole === "Student") {
                window.location.href = "../student/studentdashboard.html";
            } else if (selectedRole === "Staff") {
                window.location.href = "../staff/staffdashboard.html";
            }
        }, 500);

    } catch (error) {
        showStatus("An error occurred. Please try again.", "error");
    }
});

// دالة إظهار الرسائل (النسخة الشيك)
function showStatus(message, type) {
    let oldMsg = document.querySelector('.status-msg');
    if (oldMsg) oldMsg.remove();

    const msgDiv = document.createElement('div');
    msgDiv.className = `status-msg ${type}`;
    msgDiv.innerHTML = `<span>${message}</span>`;
    
    Object.assign(msgDiv.style, {
        position: 'fixed', top: '20px', right: '20px', padding: '12px 25px',
        borderRadius: '12px', backdropFilter: 'blur(15px)',
        backgroundColor: type === 'success' ? 'rgba(36, 184, 147, 0.2)' : 'rgba(255, 76, 76, 0.2)',
        color: type === 'success' ? '#24b893' : '#ff4c4c',
        border: `1px solid ${type === 'success' ? '#24b893' : '#ff4c4c'}`,
        zIndex: '9999', transition: 'all 0.4s'
    });

    document.body.appendChild(msgDiv);
    setTimeout(() => msgDiv.remove(), 3500);
}
