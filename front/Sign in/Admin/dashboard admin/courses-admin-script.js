document.addEventListener('DOMContentLoaded', function() {
    
    // 1. تحديث اسم المستخدم من الـ LocalStorage
    const nameDisplay = document.getElementById('adminName'); 
    const savedName = localStorage.getItem('loggedUser');
    if (nameDisplay) {
        nameDisplay.textContent = savedName ? savedName : "Admin";
    }

    // 2. التحكم في حجم السايد بار (فقط في الكمبيوتر)
    const sidebar = document.getElementById('resizableSidebar');
    const resizer = document.getElementById('sidebarResizer');
    const mainContent = document.getElementById('mainContent');

    if (resizer && sidebar) {
        resizer.addEventListener('mousedown', (e) => {
            if (window.innerWidth <= 768) return; // تعطيل في الموبايل
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', stop);
        });

        function move(e) {
            let width = e.clientX;
            if (width > 200 && width < 450) {
                sidebar.style.width = width + 'px';
                if (mainContent) mainContent.style.marginLeft = width + 'px';
            }
        }

        function stop() { 
            document.removeEventListener('mousemove', move); 
        }
    }

    // 3. معالجة إرسال الفورم (Add/Update)
    const form = document.getElementById('addCourseForm');
    if (form) {
        form.onsubmit = function(e) {
            e.preventDefault();
            const editIndex = this.getAttribute('data-edit-row');
            const data = {
                code: document.getElementById('courseCode').value,
                name: document.getElementById('courseName').value,
                inst: document.getElementById('instructor').value,
                sect: document.getElementById('sections').value
            };

            const table = document.getElementById('coursesTable').getElementsByTagName('tbody')[0];
            
            if (editIndex) {
                const row = document.getElementById('coursesTable').rows[editIndex];
                updateRow(row, data);
            } else {
                addNewRow(table, data);
            }
            closeModal();
        };
    }

    // إغلاق السايد بار عند الضغط على المحتوى في الموبايل
    if (mainContent) {
        mainContent.addEventListener('click', () => {
            if (sidebar.classList.contains('active')) {
                sidebar.classList.remove('active');
            }
        });
    }
});

// --- وظائف عامة (Global Functions) ---

function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('active');
}

function openModal() {
    const form = document.getElementById('addCourseForm');
    form.reset();
    form.removeAttribute('data-edit-row');
    document.getElementById('modalTitle').innerText = "Add New Course";
    document.getElementById('courseModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('courseModal').style.display = 'none';
}

function addNewRow(tbody, data) {
    const newRow = tbody.insertRow();
    newRow.innerHTML = `
        <td>${data.code}</td>
        <td>${data.name}</td>
        <td>${data.inst}</td>
        <td>0</td>
        <td>${data.sect}</td>
        <td class="action-btns">
            <button class="btn-edit" onclick="editCourse(this)">Edit</button>
            <button class="btn-delete" onclick="deleteCourse(this)"><i class="fas fa-trash"></i></button>
        </td>`;
}

function updateRow(row, data) {
    row.cells[0].innerText = data.code;
    row.cells[1].innerText = data.name;
    row.cells[2].innerText = data.inst;
    row.cells[4].innerText = data.sect;
}

function editCourse(btn) {
    const row = btn.closest('tr');
    document.getElementById('courseCode').value = row.cells[0].innerText;
    document.getElementById('courseName').value = row.cells[1].innerText;
    document.getElementById('instructor').value = row.cells[2].innerText;
    document.getElementById('sections').value = row.cells[4].innerText;

    document.getElementById('modalTitle').innerText = "Edit Course";
    document.getElementById('addCourseForm').setAttribute('data-edit-row', row.rowIndex);
    document.getElementById('courseModal').style.display = 'flex';
}

function deleteCourse(btn) {
    if (confirm('Are you sure?')) btn.closest('tr').remove();
}