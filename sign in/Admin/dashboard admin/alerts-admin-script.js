document.addEventListener('DOMContentLoaded', function () {
    
    // 1. --- عرض اسم المستخدم ---
    const userNameElement = document.getElementById('adminName'); 
    const loggedUser = localStorage.getItem('loggedUser');
    if (loggedUser && userNameElement) {
        userNameElement.textContent = loggedUser;
    }

    // 2. --- تحجيم السايد بار (Desktop) ---
    const sidebar = document.querySelector('.sidebar');
    const resizer = document.querySelector('.resizer');

    if (resizer && sidebar) {
        resizer.addEventListener('mousedown', (e) => {
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

    // 3. --- المودال (إضافة كورس) ---
    const modal = document.getElementById('courseModal');
    const addBtn = document.querySelector('.add-course-btn');
    const closeBtn = document.querySelector('.close-btn'); // تأكدي من الكلاس في HTML

    if (addBtn && modal) {
        addBtn.addEventListener('click', () => modal.style.display = 'flex');
    }

    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => modal.style.display = 'none');
    }

    // 4. --- التنبيهات (Alerts) ---
    const clearAllBtn = document.getElementById('clearAllBtn');
    const alertsContainer = document.getElementById('alertsContainer');
    const noAlertsMsg = document.getElementById('noAlertsMsg');

    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => {
            if (alertsContainer) alertsContainer.innerHTML = '';
            if (noAlertsMsg) noAlertsMsg.style.display = 'block';
        });
    }

    // إغلاق المنيو عند الضغط على المحتوى (للموبايل)
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.addEventListener('click', () => {
            if (sidebar && sidebar.classList.contains('active')) {
                sidebar.classList.remove('active');
            }
        });
    }
});

// وظيفة الزرار الخارجي (Global Function)
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.classList.toggle('active');
}