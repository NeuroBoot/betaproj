
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    
    e.preventDefault();

    const usernameInput = String(document.getElementById('username').value).trim();
    const passwordInput = String(document.getElementById('password').value).trim();
    const roleRadio = document.querySelector('input[name="role"]:checked');
    const selectedRole = roleRadio ? String(roleRadio.value) : null;

    
    if (!usernameInput || !passwordInput || !selectedRole) {
        alert("Please fill in all fields and select your role.");
        return;
    }

    const loginData = {
        username: usernameInput,
        password: passwordInput,
        role: selectedRole
    };

    try {
    
        
        console.log("Sending data to server...", loginData);

      
        const isSuccess = true; 

        if (isSuccess) {

            localStorage.setItem('loggedUser', usernameInput);
            localStorage.setItem('userRole', selectedRole);

            if (selectedRole === "Admin") {
                window.location.href = "Admin/dashboard admin/dashboard-index.html";
            } else {
                alert("Only Admin role is integrated for now.");
            }
        } else {
            throw new Error("Invalid username or password");
        }

    } catch (error) {
        console.error("Login Error:", error);
        alert(error.message || "An error occurred during login. Please try again.");
    }
});