document.addEventListener('DOMContentLoaded', () => {
    
    // === 0. تحديث اسم المستخدم (Dynamic Name Update) ===
    const nameDisplay = document.getElementById('adminName'); 
    const savedName = localStorage.getItem('loggedUser');

    if (nameDisplay) {
        // لو في اسم متخزن هيعرضه، لو مفيش هيعرض Admin كاحتياطي
        nameDisplay.textContent = savedName ? savedName : "Admin";
    }

    // === 1. وظيفة تحريك السايد بار (Sidebar Resize) ===
    const sidebar = document.querySelector('.sidebar');
    const resizer = document.getElementById('sidebarResizer');

    if (resizer && sidebar) {
        resizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            document.addEventListener('mousemove', resize);
            document.addEventListener('mouseup', stopResize);
            document.body.style.cursor = 'col-resize';
        });

        function resize(e) {
            const newWidth = e.clientX;
            if (newWidth > 200 && newWidth < 500) {
                sidebar.style.width = newWidth + 'px';
            }
        }

        function stopResize() {
            document.removeEventListener('mousemove', resize);
            document.removeEventListener('mouseup', stopResize);
            document.body.style.cursor = 'default';
        }
    }
});

// === 2. وظيفة فتح النافذة (Modal) وعرض التفاصيل ===
function openDetails() {
    // الحصول على القيم المختارة من الفلاتر (Course, Section, Date)
    const courseSelect = document.getElementById('courseSelect');
    const sectionSelect = document.getElementById('sectionSelect');
    const dateInput = document.getElementById('dateInput');

    if (courseSelect && sectionSelect && dateInput) {
        const course = courseSelect.value;
        const section = sectionSelect.value;
        const date = dateInput.value;

        // تحديث النصوص داخل النافذة المنبثقة بناءً على الاختيارات
        document.getElementById('disp-course').innerText = course;
        document.getElementById('disp-section').innerText = section;
        document.getElementById('disp-date').innerText = date ? date : "Not Selected";

        // إظهار النافذة المنبثقة
        const modal = document.getElementById('detailsModal');
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden'; // منع التمرير خلف النافذة
        }
    }
}

// === 3. وظيفة إغلاق النافذة ===
function closeDetails() {
    const modal = document.getElementById('detailsModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto'; // إعادة السماح بالتمرير
    }
}

// إغلاق النافذة عند الضغط خارجها
window.onclick = function(event) {
    const modal = document.getElementById('detailsModal');
    if (event.target == modal) {
        closeDetails();
    }
}
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