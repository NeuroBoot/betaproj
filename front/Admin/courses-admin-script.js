const API_BASE_URL = 'http://localhost:3000/api/v1';

function getAuthToken() {
    let token = localStorage.getItem('token');
    if (!token) return "";
    token = token.replace(/['"]+/g, '').trim();
    if (token.toLowerCase().startsWith('bearer ')) {
        token = token.substring(7).trim();
    }
    return `Bearer ${token}`;
}

document.addEventListener('DOMContentLoaded', async function() {
    const adminName = localStorage.getItem('username');
    if (document.getElementById('adminName')) {
        document.getElementById('adminName').textContent = adminName || "Admin";
    }

    await fillInstructors();
    await fillStudents();
    await loadCourses();

    const form = document.getElementById('addCourseForm');
    form.onsubmit = async function(e) {
        e.preventDefault();
        const editId = form.getAttribute('data-edit-id');

    
        const courseData = {
            name:         document.getElementById('courseName').value.trim(),
            code:         document.getElementById('courseCode').value.trim(),
            sections:     parseInt(document.getElementById('sections').value) || 1,
            credits:      3,
            schedule:     document.getElementById('schedule')?.value.trim() || "TBD",
            room:         document.getElementById('room')?.value.trim() || "TBD",
            instructorId: Number(document.getElementById('instructor').value)
        
        };

        console.log(' Course payload:', courseData);

        try {
            const url    = editId ? `${API_BASE_URL}/courses/${editId}` : `${API_BASE_URL}/courses`;
            const method = editId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Authorization': getAuthToken(),
                    'Content-Type':  'application/json'
                },
                body: JSON.stringify(courseData)
            });

            const responseData = await response.json();
            console.log(' Course response:', response.status, responseData);

            if (response.ok) {
                closeModal();
                await loadCourses();
                Swal.fire({
                    icon:               'success',
                    title:              'Saved Successfully',
                    toast:              true,
                    position:           'top-end',
                    showConfirmButton:  false,
                    timer:              3000
                });
            } else {
                Swal.fire({
                    icon:               'error',
                    title:              'Action Failed',
                    text:               responseData.message || "Please check course code uniqueness.",
                    confirmButtonColor: '#3085d6'
                });
            }
        } catch (error) {
            console.error('Course save error:', error);
            Swal.fire({ icon: 'error', title: 'Connection Error', text: 'Unable to reach the server.' });
        }
    };

    const enrollForm = document.getElementById('enrollStudentForm');
    if (enrollForm) {
        enrollForm.onsubmit = async function(e) {
            e.preventDefault();
            const courseId  = document.getElementById('enrollCourseId').value;
            const studentId = document.getElementById('studentSelect').value;
            const alreadyEnrolled = Array.from(
           document.querySelectorAll('#enrolledStudentsBody tr td:first-child')
           ).map(td => td.textContent.trim());
            if (alreadyEnrolled.includes(String(studentId))) {
              Swal.fire({
             icon: 'warning',
             title: 'Already Enrolled',
           text: 'This student is already in this course.',
               confirmButtonColor: '#3085d6'
                });
               return;
           }
            
              const submitBtn = enrollForm.querySelector('button[type="submit"]');
              submitBtn.disabled = true;
              const section = document.getElementById('enrollSection').value.trim();
              const lecture = document.getElementById('enrollLecture').value.trim();

             const enrollData = { studentId: Number(studentId) };
               if (section) enrollData.section = section;
               if (lecture) enrollData.lecture = lecture;

            console.log(' Enroll payload:', enrollData);

            try {
                const response = await fetch(`${API_BASE_URL}/courses/${courseId}/students`, {
                    method:  'POST',
                    headers: {
                        'Authorization': getAuthToken(),
                        'Content-Type':  'application/json'
                    },
                    body: JSON.stringify(enrollData)
                });

                const responseData = await response.json();
                console.log(' Enroll response:', response.status, responseData);

                if (response.ok) {
                    Swal.fire({
                        icon:              'success',
                        title:             'Enrolled Successfully',
                        toast:             true,
                        position:          'top-end',
                        showConfirmButton: false,
                        timer:             3000
                    });
                    enrollForm.reset();
                    await loadEnrolledStudents(courseId);
                    await loadCourses();
                } else {
                    Swal.fire({
                        icon:  'error',
                        title: 'Enrollment Failed',
                        text:  responseData.message || "Student may already be enrolled."
                    });
                }
            } catch (error) {
                console.error('Enroll error:', error);
                Swal.fire({ icon: 'error', title: 'Error', text: 'Server connection failed.' });
            }finally {
             submitBtn.disabled = false; 
            }
        };
    }
});


// DELETE COURSE

async function deleteCourse(id) {
    if (!id || id === 'undefined') return;

    const result = await Swal.fire({
        title:              'Are you sure?',
        text:               "You won't be able to revert this!",
        icon:               'warning',
        showCancelButton:   true,
        confirmButtonColor: '#d33',
        cancelButtonColor:  '#3085d6',
        confirmButtonText:  'Yes, delete it!'
    });

    if (result.isConfirmed) {
        try {
            const response = await fetch(`${API_BASE_URL}/courses/${id}`, {
                method:  'DELETE',
                headers: { 'Authorization': getAuthToken() }
            });

            if (response.ok) {
                Swal.fire('Deleted!', 'The course has been deleted.', 'success');
                await loadCourses();
            } else {
                Swal.fire('Error!', 'Failed to delete the course.', 'error');
            }
        } catch (error) {
            Swal.fire('Error!', 'Server connection lost.', 'error');
        }
    }
}


async function loadCourses() {
    try {
        const response = await fetch(`${API_BASE_URL}/courses`, {
            headers: { 'Authorization': getAuthToken() }
        });
        const result  = await response.json();
        const courses = Array.isArray(result.data) ? result.data : Array.isArray(result) ? result : [];

        console.log('✅ Courses loaded:', courses.length);

        const tbody = document.getElementById('coursesTableBody');
        tbody.innerHTML = '';

        if (!courses.length) {
            tbody.innerHTML = '<tr><td colspan="6">No courses found.</td></tr>';
            return;
        }

      
        for (const course of courses) {
            const courseId = course.courseId || course.id;

            let studentCount = 0;

            try {
                const studRes  = await fetch(`${API_BASE_URL}/courses/${courseId}/students`, {
                    headers: { 'Authorization': getAuthToken() }
                });
                const studData = await studRes.json();
                const students = Array.isArray(studData.data)
                    ? studData.data
                    : Array.isArray(studData)
                    ? studData
                    : [];

                studentCount = students.length;

            } catch (err) {
                console.warn('Could not load students for course:', courseId, err);
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${course.code || 'N/A'}</td>
                <td>${course.name || 'N/A'}</td>
                <td>${course.instructor
                    ? (course.instructor.fullName || course.instructor.username)
                    : 'N/A'}
                </td>
                <td>
                    <span class="badge" style="background:rgba(48,96,255,0.1);color:#3060ff;">
                        ${studentCount} Student${studentCount !== 1 ? 's' : ''}
                    </span>
                </td>
                <td>${course.sections || 1}</td>
                <td class="action-btns">
                    <button class="btn-edit"
                        onclick='prepareEdit(${JSON.stringify(course)})'>
                        Edit
                    </button>
                    <button class="btn-edit"
                        style="background:rgba(46,204,113,0.1);color:#2ecc71;border-color:#2ecc71;"
                        onclick="openEnrollModal('${courseId}', '${(course.name || '').replace(/'/g, "\\'")}')">
                        Enroll
                    </button>
                    <button class="btn-delete"
                        onclick="deleteCourse('${courseId}')">
                        Delete
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        }

    } catch (error) {
        console.error('loadCourses error:', error);
    }
}


// FILL INSTRUCTORS DROPDOWN

async function fillInstructors() {
    try {
        const response = await fetch(`${API_BASE_URL}/users?role=staff`, {
            headers: { 'Authorization': getAuthToken() }
        });
        const result = await response.json();
        const users  = Array.isArray(result.data) ? result.data : Array.isArray(result) ? result : [];

        const select = document.getElementById('instructor');
        select.innerHTML = '<option value="">Select Instructor</option>';
        users.forEach(u => {
            const opt     = document.createElement('option');
            opt.value     = u.userAccountId || u.id;
            opt.textContent = u.fullName || u.username;
            select.appendChild(opt);
        });
    } catch (error) {
        console.error('fillInstructors error:', error);
    }
}


// FILL STUDENTS DROPDOWN

async function fillStudents() {
    try {
        const response = await fetch(`${API_BASE_URL}/users?role=student`, {
            headers: { 'Authorization': getAuthToken() }
        });
        const result = await response.json();
        const users  = Array.isArray(result.data) ? result.data : Array.isArray(result) ? result : [];

        const select = document.getElementById('studentSelect');
        select.innerHTML = '<option value="">Select Student</option>';
        users.forEach(u => {
            const opt       = document.createElement('option');
            opt.value       = u.userAccountId || u.id;
            opt.textContent = `${u.fullName || u.username} (ID: ${u.userAccountId || u.id})`;
            select.appendChild(opt);
        });
    } catch (error) {
        console.error('fillStudents error:', error);
    }
}


// ENROLL MODAL

async function openEnrollModal(courseId, courseName) {
    document.getElementById('enrollCourseId').value       = courseId;
    document.getElementById('enrollCourseName').textContent = courseName;
    document.getElementById('enrollModal').style.display  = 'flex';
    await loadEnrolledStudents(courseId);
}

async function loadEnrolledStudents(courseId) {
    const tbody = document.getElementById('enrolledStudentsBody');
    tbody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';

    try {
        const response = await fetch(`${API_BASE_URL}/courses/${courseId}/students`, {
            headers: { 'Authorization': getAuthToken() }
        });
        const result      = await response.json();
        const enrollments = Array.isArray(result.data) ? result.data : Array.isArray(result) ? result : [];

        tbody.innerHTML = '';

        if (!enrollments.length) {
            tbody.innerHTML = '<tr><td colspan="4">No students enrolled yet.</td></tr>';
            return;
        }

    

    
     enrollments.forEach(item => {
    
    const studentId   = item.userAccountId || item.id || 'N/A';
    const studentName = item.fullName || item.username || `Student #${studentId}`;
    const section     = item.section || 'Enrolled';
    const lecture     = item.lecture || '—';
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${studentId}</td>
        <td>${studentName}</td>
        <td>
            <span class="badge" style="background:rgba(48,96,255,0.1);color:#3060ff;">
                ${section}
            </span>
        </td>
        <td>${lecture}</td>
    `;
    tbody.appendChild(tr);
});
          


    } catch (error) {
        console.error('loadEnrolledStudents error:', error);
        tbody.innerHTML = '<tr><td colspan="4">Error loading list.</td></tr>';
    }
}

function closeEnrollModal() {
    document.getElementById('enrollModal').style.display = 'none';
}


// COURSE MODAL

function prepareEdit(course) {
    const form     = document.getElementById('addCourseForm');
    const courseId = course.courseId || course.id;

    form.setAttribute('data-edit-id', courseId);
    document.getElementById('modalTitle').innerText    = "Edit Course";
    document.getElementById('courseName').value        = course.name  || '';
    document.getElementById('courseCode').value        = course.code  || '';
    document.getElementById('sections').value          = course.sections || 1;


    if (document.getElementById('schedule')) {
        document.getElementById('schedule').value = course.schedule || '';
    }
    if (document.getElementById('room')) {
        document.getElementById('room').value = course.room || '';
    }

    document.getElementById('instructor').value =
        course.instructorId ||
        (course.instructor
            ? (course.instructor.userAccountId || course.instructor.id)
            : "");

    document.getElementById('courseModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('courseModal').style.display = 'none';
}

function openModal() {
    const form = document.getElementById('addCourseForm');
    form.reset();
    form.removeAttribute('data-edit-id');
    document.getElementById('modalTitle').innerText      = "Add New Course";
    document.getElementById('courseModal').style.display = 'flex';
}


// LOGOUT

function logout() {
    localStorage.clear();
    Swal.fire({
        text: "Logged out successfully",
        icon: "success",
        background: "#1a1a3a",
        color: "#fff",
        confirmButtonColor: "#3060ff",
        confirmButtonText: "OK"
    }).then(() => {
        window.location.href = "../sign in/index.html";
    });
}
