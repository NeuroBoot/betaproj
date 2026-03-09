document.addEventListener('DOMContentLoaded', function() {
    
    // === 0. تحديث اسم المستخدم (Dynamic Name Update) ===
    const nameDisplay = document.getElementById('adminName'); 
    const savedName = localStorage.getItem('loggedUser');

    if (nameDisplay) {
        // لو في اسم متخزن هيعرضه، لو مفيش هيعرض Admin كاحتياطي
        nameDisplay.textContent = savedName ? savedName : "Admin";
    }

    // === 1. وظيفة التحكم في حجم السايد بار (Sidebar Resize) ===
    const sidebar = document.querySelector('.sidebar');
    const resizer = document.querySelector('.resizer');
    let enrollmentChart, roleDistributionChart;

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
                // تحديث الرسوم البيانية عشان متضربش مع تغيير الحجم
                if(enrollmentChart) enrollmentChart.resize();
                if(roleDistributionChart) roleDistributionChart.resize();
            }
        }

        function stopResize() {
            document.removeEventListener('mousemove', resize);
            document.removeEventListener('mouseup', stopResize);
            document.body.style.cursor = 'default';
        }
    }

    // === 2. إعدادات الرسوم البيانية (Charts) ===
    const ctxLine = document.getElementById('enrollmentChart')?.getContext('2d');
    if (ctxLine) {
        enrollmentChart = new Chart(ctxLine, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'Students',
                    data: [2100, 2250, 2350, 2410, 2450, 2520],
                    borderColor: '#3060ff',
                    backgroundColor: 'rgba(48, 96, 255, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    const ctxPie = document.getElementById('roleDistributionChart')?.getContext('2d');
    if (ctxPie) {
        roleDistributionChart = new Chart(ctxPie, {
            type: 'pie',
            data: {
                labels: ['Students', 'Staff', 'Admin'],
                datasets: [{
                    data: [94.9, 4.8, 0.3],
                    backgroundColor: ['#3060ff', '#2ecc71', '#9b59b6']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // === 3. منطق إدارة الحسابات (إضافة، تعديل، حذف) ===
    const modal = document.getElementById('accountModal');
    const editModal = document.getElementById('editModal');
    const tableBody = document.getElementById('accountsTableBody');
    let currentRow = null;

    // أزرار الفتح والإغلاق
    if(document.getElementById('openModalBtn')) {
        document.getElementById('openModalBtn').onclick = () => modal.style.display = 'flex';
    }
    if(document.getElementById('closeModalBtn')) {
        document.getElementById('closeModalBtn').onclick = () => modal.style.display = 'none';
    }
    if(document.getElementById('closeEditModalBtn')) {
        document.getElementById('closeEditModalBtn').onclick = () => editModal.style.display = 'none';
    }

    // إضافة حساب جديد
    const accountForm = document.getElementById('accountForm');
    if (accountForm) {
        accountForm.onsubmit = function(e) {
            e.preventDefault();
            const id = document.getElementById('idNumber').value;
            const name = document.getElementById('fullName').value;
            const email = document.getElementById('email').value;
            const role = document.getElementById('role').value;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${id}</td>
                <td>${name}</td>
                <td>${email}</td>
                <td><span class="badge ${role.toLowerCase()}">${role}</span></td>
                <td><span class="status-active">Active</span></td>
                <td class="actions">
                    <button class="btn-edit"><i class="fas fa-edit"></i> Edit</button>
                    <button class="btn-delete"><i class="fas fa-trash"></i></button>
                </td>`;
            tableBody.appendChild(tr);
            modal.style.display = 'none';
            this.reset();
        };
    }

    // الحذف والتعديل داخل الجدول
    if (tableBody) {
        tableBody.addEventListener('click', function(e) {
            // حذف الصف
            if (e.target.closest('.btn-delete')) {
                if(confirm('Are you sure you want to delete this account?')) {
                    e.target.closest('tr').remove();
                }
            }
            // فتح التعديل
            if (e.target.closest('.btn-edit')) {
                currentRow = e.target.closest('tr');
                document.getElementById('editIdNumber').value = currentRow.cells[0].innerText;
                document.getElementById('editFullName').value = currentRow.cells[1].innerText;
                document.getElementById('editEmail').value = currentRow.cells[2].innerText;
                document.getElementById('editRole').value = currentRow.cells[3].innerText.trim();
                editModal.style.display = 'flex';
            }
        });
    }

    // حفظ التعديلات
    const editForm = document.getElementById('editForm');
    if (editForm) {
        editForm.onsubmit = function(e) {
            e.preventDefault();
            if (currentRow) {
                currentRow.cells[0].innerText = document.getElementById('editIdNumber').value;
                currentRow.cells[1].innerText = document.getElementById('editFullName').value;
                currentRow.cells[2].innerText = document.getElementById('editEmail').value;
                const role = document.getElementById('editRole').value;
                currentRow.cells[3].innerHTML = `<span class="badge ${role.toLowerCase()}">${role}</span>`;
                editModal.style.display = 'none';
            }
        };
    }

    // إغلاق المودال عند الضغط في الخارج
    window.onclick = (e) => {
        if (e.target == modal) modal.style.display = 'none';
        if (e.target == editModal) editModal.style.display = 'none';
    };
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