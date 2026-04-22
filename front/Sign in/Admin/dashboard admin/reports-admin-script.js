document.addEventListener('DOMContentLoaded', function () {
    
    // === 0. تحديث اسم المستخدم من الـ LocalStorage ===
    const nameDisplay = document.getElementById('adminName'); 
    const savedName = localStorage.getItem('loggedUser');

    if (nameDisplay) {
        // لو في اسم متخزن هيعرضه، لو مفيش هيعرض Admin كاحتياطي
        nameDisplay.textContent = savedName ? savedName : "Admin";
    }

    // === 1. وظيفة التحكم في حجم السايد بار (Sidebar Resize) ===
    const sidebar = document.querySelector('.sidebar');
    const resizer = document.querySelector('.resizer');

    if (resizer && sidebar) {
        resizer.addEventListener('mousedown', function (e) {
            e.preventDefault();
            // تفعيل السحب عند ضغط الماوس
            document.addEventListener('mousemove', resize);
            document.addEventListener('mouseup', stopResize);
            document.body.style.cursor = 'col-resize';
        });

        function resize(e) {
            // clientX هي مكان الماوس الحالي
            let newWidth = e.clientX;
            // قيود الحجم (بين 200 و 500 بكسل)
            if (newWidth > 200 && newWidth < 500) {
                sidebar.style.width = newWidth + 'px';
            }
        }

        function stopResize() {
            // إيقاف السحب عند ترك الماوس
            document.removeEventListener('mousemove', resize);
            document.removeEventListener('mouseup', stopResize);
            document.body.style.cursor = 'default';
        }
    }
});
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('active');
}

// إغلاق السايد بار لو ضغطنا في أي مكان في المحتوى الرئيسي (اختياري)
document.querySelector('.main-content').addEventListener('click', () => {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
    }
});