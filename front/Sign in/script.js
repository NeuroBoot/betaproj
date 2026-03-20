document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const usernameInput = document.getElementById('username').value.trim();
    const passwordInput = document.getElementById('password').value.trim();
    
    // Roles are handled by the backend, but we can still check the UI selection 
    // to ensure the user is intended to log in as that role if needed.
    // However, the backend is the source of truth for the role.

    try {
        const response = await fetch('http://localhost:3000/api/v1/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: usernameInput,
                password: passwordInput
            })
        });

        const responseData = await response.json();

        if (response.ok) {
            // The response is wrapped in a 'data' object by the backend TransformInterceptor
            const token = responseData.data.access_token;
            const userData = responseData.data.user;

            // Save token and user info
            localStorage.setItem('access_token', token);
            localStorage.setItem('loggedUser', userData.username);
            localStorage.setItem('userRole', userData.role);

            // Redirect based on backend role
            const role = userData.role;
            if (role === "admin") {
                window.location.href = "../Admin/dashboard-index.html";
            } else if (role === "student") {
                window.location.href = "../Student/studentdashboard.html";
            } else if (role === "staff") {
                window.location.href = "../Staff/staffdashboard.html";
            } else {
                alert("Role not recognized: " + role);
            }
        } else {
            alert(responseData.message || "اسم المستخدم أو كلمة المرور غير صحيحة!");
        }
    } catch (error) {
        console.error('Login error:', error);
        alert("تعذر الاتصال بالخادم. يرجى المحاولة لاحقاً.");
    }
});