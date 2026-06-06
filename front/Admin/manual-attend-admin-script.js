const API_BASE_URL = 'http://localhost:3000/api/v1';



function getAuthToken() {

    let token = localStorage.getItem('token');

    if (!token) return "";

    token = token.replace(/['"]+/g, '').trim();

    return token.toLowerCase().startsWith('bearer ')
        ? token
        : `Bearer ${token}`;
}


function getStatusId(status) {

   
    const map = {    
    'Present': 1,
    'Absent' : 2,    
    'Late': 3,  
    'Excused': 4
    };

    return map[status] || 1;
}



document.addEventListener('DOMContentLoaded', async () => {

    const nameDisplay =
        document.getElementById('adminName') ||
        document.getElementById('userNameDisplay');

    const savedName = localStorage.getItem('username');

    if (nameDisplay) {
        nameDisplay.textContent = savedName || "admin"; //
    }

    await loadCoursesToSelect();
    await loadRecentRecords();

    const courseSelect =
        document.getElementById('courseSelect');

    if (courseSelect) {

        courseSelect.addEventListener('change', function () {

            const selectedOption =
                this.options[this.selectedIndex];

            const sectionCount =
                selectedOption.getAttribute('data-sections') || 1;

            updateSections(sectionCount);
        });
    }
});



async function loadCoursesToSelect() {

    const courseSelect =
        document.getElementById('courseSelect');

    if (!courseSelect) return;

    try {

        const response = await fetch(
            `${API_BASE_URL}/courses`,
            {
                method: 'GET',
                headers: {
                    'Authorization': getAuthToken(),
                    'Content-Type': 'application/json'
                }
            }
        );

        const result = await response.json();

        const courses = result.data || result;

        courseSelect.innerHTML =
            '<option value="">Select Course</option>';

        if (Array.isArray(courses)) {

            courses.forEach(course => {

                const option = document.createElement('option');

                option.value =
                    course.courseId || course.id;

                option.textContent =
                    course.name || 'Unnamed Course';

                option.setAttribute(
                    'data-sections',
                    course.sectionsCount || 4
                );

                courseSelect.appendChild(option);
            });
        }

    } catch (error) {

        console.error('Error loading courses:', error);
    }
}

async function loadRecentRecords() {
    const recordsContainer = document.querySelector('.recent-records-list');
    if (!recordsContainer) return;

    try {
        const response = await fetch(`${API_BASE_URL}/attendance`, {
            method: 'GET',
            headers: {
                'Authorization': getAuthToken(),
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        
        const records = result.data?.data || result.data || [];

        recordsContainer.innerHTML = '';

        if (Array.isArray(records) && records.length > 0) {
            const statusLabel = {
                1: 'Present',
                2: 'Absent',
                3: 'Late',
                4: 'Excused'
            };

            records.slice(0, 5).forEach(record => {
                const div = document.createElement('div');
                div.className = 'record-item';

                div.innerHTML = `
                    <div class="record-info">
                        <h3>${record.course?.name || 'Course'} — ${record.student?.username || 'Student'}</h3>
                        <p>${new Date(record.recordDate).toLocaleDateString()} | Section ${record.sessionNumber || '-'}</p>
                    </div>
                    <div class="record-stats">
                        <span class="percentage status-${statusLabel[record.attendanceStatusId]?.toLowerCase() || 'unknown'}">
                            ${statusLabel[record.attendanceStatusId] || 'Unknown'}
                        </span>
                    </div>
                `;
                
                recordsContainer.appendChild(div);
            });

        } else {
            recordsContainer.innerHTML =
                '<div style="text-align:center;padding:20px;">No records found</div>';
        }

    } catch (error) {
        console.error('Error loading attendance:', error);
    }
}


async function openDetails() {
    
    const courseSelectElement = document.getElementById('courseSelect');
    const typeSelectElement = document.getElementById('typeSelect');
    const sectionSelectElement = document.getElementById('sectionSelect');
    const dateInputElement = document.getElementById('dateInput');

  
    const courseId = courseSelectElement.value;
    const typeValue = typeSelectElement.value;
    const sectionName = sectionSelectElement.value;
    const date = dateInputElement.value;

    if (!courseId || !typeValue || !sectionName || !date) {
        alert('Please select course, type, section and date');
        return;
    }

   
    document.getElementById('disp-course').innerText =
        courseSelectElement.options[courseSelectElement.selectedIndex].text;

    document.getElementById('disp-section').innerText = 
        `${typeValue.charAt(0).toUpperCase() + typeValue.slice(1)} ${sectionName}`;
    document.getElementById('disp-date').innerText = date;

    const tableBody = document.getElementById('attendanceTableBody');

    tableBody.innerHTML =
        '<tr><td colspan="3" style="text-align:center;">Loading...</td></tr>';

    try {
       
        const [studentsResponse, attendanceResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/courses/${courseId}/students`, {
                method: 'GET',
                headers: {
                    'Authorization': getAuthToken(),
                    'Content-Type': 'application/json'
                }
            }),

            fetch(`${API_BASE_URL}/attendance?courseId=${courseId}&date=${date}`, {
                method: 'GET',
                headers: {
                    'Authorization': getAuthToken(),
                    'Content-Type': 'application/json'
                }
            })
        ]);

        if (!studentsResponse.ok || !attendanceResponse.ok) {
            throw new Error("Failed to load data from server");
        }

        const studentsResult = await studentsResponse.json();
        const attendanceResult = await attendanceResponse.json();

      
        const students = studentsResult.data || [];
        const allRecords =
            attendanceResult.data?.data ||
            attendanceResult.data ||
            [];

        
        // Filters data 
        const filteredRecords = allRecords.filter(
       record => String(record.sessionNumber) === String(sectionName) && 
              String(record.sessionType).toUpperCase() === String(typeValue).toUpperCase() 
                );

      
        const attendanceMap = new Map();

        filteredRecords.forEach(record => {
            const studentId =
                record.student?.userAccountId ||
                record.studentId;

            if (studentId) {
                attendanceMap.set(studentId, record);
            }
        });

        tableBody.innerHTML = '';

        if (!Array.isArray(students) || students.length === 0) {
            tableBody.innerHTML =
                '<tr><td colspan="3" style="text-align:center;">No students found</td></tr>';
            return;
        }

        // Build table 
        students.forEach(student => {
            const existingRecord =
                attendanceMap.get(student.userAccountId);

            const recordId =
                existingRecord?.recordId ||
                '';

            const currentStatus =
                existingRecord?.attendanceStatusId || 1;
               
            const statusLabelMap = { 1: "Present", 2: "Late", 3: "Absent", 4: "Excused" };
            const initialStatusValueString = statusLabelMap[currentStatus] || "Absent";

            const tr = document.createElement('tr');
             
            tr.innerHTML = `
                <td>${student.userAccountId || 'N/A'}</td>
                <td>${student.fullName || student.username || 'Unknown'}</td>

                <td>
                    <select
                        class="status-select"
                        data-student-id="${student.userAccountId}"
                        data-record-id="${recordId}"
                        data-initial-status="${initialStatusValueString}"
                    >
                        <option value="Present" ${currentStatus == 1 ? 'selected' : ''}>
                            Present
                        </option>
                         <option value="Absent"  ${currentStatus == 2 ? 'selected' : ''}>
                         Absent
                         </option> 
                        <option value="Late"    ${currentStatus == 3 ? 'selected' : ''}>
                        Late
                        </option> 
                        <option value="Excused" ${currentStatus == 4 ? 'selected' : ''}>
                            Excused
                        </option>
                    </select>
                </td>
            `;

            tableBody.appendChild(tr);
        });

    } catch (error) {
        console.error('Open Details Error:', error);

        tableBody.innerHTML =
            `<tr>
                <td colspan="3" style="text-align:center; color:red;">
                    ${error.message || 'Server Error'}
                </td>
            </tr>`;
    }

    document.getElementById('detailsModal').style.display = 'flex';
}


async function saveAttendance() {
    const selects = document.querySelectorAll('.status-select');
    const typeSelect = document.getElementById('typeSelect').value;
    const date = document.getElementById('dateInput').value;
    const sectionName = document.getElementById('sectionSelect').value;

    try {
        let skipped = 0;
        let skippedUnchanged = 0; //
        for (const select of selects) {
            const recordId = select.dataset.recordId;
            const initialStatus = select.dataset.initialStatus;
             const currentStatus = select.value;
            if (!recordId) {
                skipped++;
                continue;
            }
            
              if (currentStatus === initialStatus) {
               skippedUnchanged++;
                 continue;
               }
            const payload = {
                attendanceStatusId: getStatusId(select.value),
                recordDate: date,
                sessionType: String(typeSelect).toUpperCase(),
                sessionNumber: String(sectionName)
            };

            const response = await fetch(
                `${API_BASE_URL}/attendance/${recordId}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': getAuthToken(),
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                }
            );

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || 'Update failed');
            }
        }

        alert(
            `Attendance updated successfully!` +
            (skipped ? `\n${skipped} skipped (no record)` : '')
        );

        closeDetails();
        await loadRecentRecords();

    } catch (error) {
        console.error(error);
        alert(error.message);
    }
}
function updateSections(count) {

    const sectionSelect =
        document.getElementById('sectionSelect');

    if (!sectionSelect) return;

    sectionSelect.innerHTML =
        '<option value="">Select Section</option>';

   
    for (let i = 1; i <= count; i++) {

        const option = document.createElement('option');

        option.value = i;

        option.textContent = `Section ${i}`;

        sectionSelect.appendChild(option);
    }
}



function closeDetails() {

    document.getElementById('detailsModal').style.display = 'none';
}




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