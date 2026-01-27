document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();

    // جلب البيانات
    const usernameInput = document.getElementById('username').value.trim();
    const passwordInput = document.getElementById('password').value.trim();
    const selectedRole = document.querySelector('input[name="role"]:checked').value;

    // البيانات المثبتة
    const validUser ="guest1";
    const validPass = "123";

    if (usernameInput === validUser && passwordInput === validPass) {
        
        if (selectedRole === "Admin") {
            // حفظ الاسم في الذاكرة المحلية
            localStorage.setItem('loggedUser', usernameInput);
            
            // التوجه لصفحة الداشبورد
            window.location.href = "Admin/dashboard admin/dashboard-index.html";
        }
        else if (selectedRole =="Student"){
            window.location.href="../student/studentdashboard.html";
        }
        else if (selectedRole =="Staff"){
            window.location.href="../staff/staffdashboard.html";
        }
        else {
            alert("هذا الحساب مسجل كأدمن، يرجى اختيار دور Admin.");
        }
        

    } else {
        alert("اسم المستخدم أو كلمة المرور غير صحيحة!");
    }
});