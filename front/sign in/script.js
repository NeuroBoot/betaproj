function goToLogin() {
  window.location.href = "../sign in/index.html";
}
document.getElementById('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();

  
    const usernameInput = document.getElementById('username').value.trim();
    const passwordInput = document.getElementById('password').value.trim();
    const roleRadio = document.querySelector('input[name="role"]:checked');
    const selectedRole = roleRadio ? roleRadio.value.toLowerCase().trim() : null;

    if (!usernameInput || !passwordInput || !selectedRole) {
        showStatus("Please enter your credentials and select a role.", "error");
        return;
    }

    try {

        const res = await fetch('http://localhost:3000/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: usernameInput, password: passwordInput })
        });

        const loginResponse = await res.json();
        
        if (!res.ok) {
            throw new Error(loginResponse.message || 'Incorrect username or password.');
        }

       
        const token = loginResponse.data?.access_token || loginResponse.access_token || loginResponse.data?.token || loginResponse.token;
     
        let actualRoleFromDB = selectedRole; 

        try {
            const profileRes = await fetch('http://localhost:3000/api/v1/auth/profile', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (profileRes.ok) {
                const profileData = await profileRes.json();
                const userData = profileData.data || profileData;
        
                actualRoleFromDB = (userData.role || userData.userType || selectedRole).toString().toLowerCase().trim();
            } else {
                console.warn("Profile check skipped, using selected role for redirection.");
            }
        } catch (profileErr) {
            console.error("Profile endpoint error:", profileErr);
          
        }

  
        if (actualRoleFromDB !== selectedRole) {
            showStatus(`Access Denied! Your account is registered as ${actualRoleFromDB}.`, "error");
            return; 
        }

  
        
        localStorage.setItem('token', token);
        localStorage.setItem('username', usernameInput); 
        localStorage.setItem('userRole', actualRoleFromDB);
        showStatus(`Welcome back, ${usernameInput}! Redirecting...`, "success");

        setTimeout(() => {
            const paths = {
                'admin': "../Admin/dashboard-index.html",
                  'staff': "../Staff/staffdashboard.html",
                'student': "../Student/studentdashboard.html"
             
            };
            
          
            window.location.href = paths[selectedRole] || "index.html";
        }, 1500);

    } catch (err) {
        
        const friendlyMsg = err.message.includes('Failed to fetch') 
            ? "Server is offline. Please check your backend terminal." 
            : err.message;
            
        showStatus(friendlyMsg, "error");
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