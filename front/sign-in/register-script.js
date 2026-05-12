document.getElementById('registerForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const roleRadio = document.querySelector('input[name="role"]:checked');
    const role = roleRadio ? roleRadio.value : 'student';

    try {
        const response = await fetch('http://localhost:3000/api/v1/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role })
        });

        const result = await response.json();

        if (response.ok) {
            showStatus("Registration successful! Redirecting to login...", "success");
            setTimeout(() => {
                window.location.href = "index.html";
            }, 2000);
        } else {
            showStatus(result.message || "Registration failed.", "error");
        }
    } catch (err) {
        showStatus("Server is offline. Please check your backend.", "error");
    }
});

function showStatus(msg, type) {
    let div = document.getElementById('status-msg');
    if (!div) {
        div = document.createElement('div');
        div.id = 'status-msg';
        document.body.appendChild(div);
    }
    
    div.textContent = msg;
    div.style.cssText = `
        position: fixed; top: 20px; right: 20px; padding: 15px 25px; 
        border-radius: 8px; color: white; z-index: 10000; font-weight: bold; 
        box-shadow: 0 4px 15px rgba(0,0,0,0.2); transition: all 0.5s;
        background-color: ${type === 'success' ? '#28a745' : '#dc3545'};
    `;
    
    setTimeout(() => div.remove(), 4000);
}