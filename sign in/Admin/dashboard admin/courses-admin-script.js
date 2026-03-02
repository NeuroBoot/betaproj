document.addEventListener('DOMContentLoaded', function() {
    const sidebar = document.getElementById('resizableSidebar');
    const resizer = document.getElementById('sidebarResizer');
    const mainContent = document.getElementById('mainContent');
    const modal = document.getElementById('courseModal');
    const form = document.getElementById('addCourseForm');

    // 1. Sidebar Resize Logic
    if (resizer) {
        resizer.addEventListener('mousedown', (e) => {
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', stop);
        });
        function move(e) {
            let width = e.clientX;
            if (width > 200 && width < 450) {
                sidebar.style.width = width + 'px';
                mainContent.style.marginLeft = width + 'px';
            }
        }
        function stop() { document.removeEventListener('mousemove', move); }
    }

    // 2. Modal Functions
    window.openModal = function() {
        form.reset();
        document.getElementById('modalTitle').innerText = "Add New Course";
        document.getElementById('submitBtn').innerText = "Add Course";
        form.removeAttribute('data-edit-row');
        modal.style.display = 'flex';
    };

    window.closeModal = function() {
        modal.style.display = 'none';
    };

    // 3. Edit Function (تعبئة الحقول الأربعة)
    window.editCourse = function(btn) {
        const row = btn.closest('tr');
        const cells = row.cells;

        document.getElementById('courseCode').value = cells[0].innerText;
        document.getElementById('courseName').value = cells[1].innerText;
        document.getElementById('instructor').value = cells[2].innerText;
        document.getElementById('sections').value = cells[4].innerText;

        document.getElementById('modalTitle').innerText = "Edit Course";
        document.getElementById('submitBtn').innerText = "Update Course";
        form.setAttribute('data-edit-row', row.rowIndex);
        modal.style.display = 'flex';
    };

    // 4. Delete Function
    window.deleteCourse = function(btn) {
        if (confirm('Are you sure you want to delete this course?')) {
            btn.closest('tr').remove();
        }
    };

    // 5. Handle Form Submit
    form.onsubmit = function(e) {
        e.preventDefault();
        const editIndex = this.getAttribute('data-edit-row');
        const data = {
            code: document.getElementById('courseCode').value,
            name: document.getElementById('courseName').value,
            inst: document.getElementById('instructor').value,
            sect: document.getElementById('sections').value
        };

        if (editIndex) {
            const row = document.getElementById('coursesTable').rows[editIndex];
            row.cells[0].innerText = data.code;
            row.cells[1].innerText = data.name;
            row.cells[2].innerText = data.inst;
            row.cells[4].innerText = data.sect;
        } else {
            const tbody = document.querySelector('#coursesTable tbody');
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
        closeModal();
    };
});