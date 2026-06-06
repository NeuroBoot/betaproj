const API_BASE_URL = 'http://localhost:3000/api/v1';

let currentReportType = '';

function getToken() {
    let token = localStorage.getItem('token') || '';

    token = token.replace(/['"]+/g, '').trim();

    return token.startsWith('Bearer ')
        ? token
        : `Bearer ${token}`;
}

document.addEventListener('DOMContentLoaded', async () => {

    const nameDisplay = document.getElementById('adminName');
    const savedName = localStorage.getItem('username');

    if (nameDisplay && savedName) {
        nameDisplay.textContent =
            savedName.charAt(0).toUpperCase() +
            savedName.slice(1);
    }
    initSidebar();
    await loadCoursesForReports();
    renderEmptyReports();
});



// LOAD COURSES


async function loadCoursesForReports() {

    const select =
        document.getElementById('reportCourseSelect');

    if (!select) return;

    try {

        const response = await fetch(
            `${API_BASE_URL}/courses`,
            {
                headers: {
                    Authorization: getToken()
                }
            }
        );

        const result = await response.json();

        const courses =
            result.data || [];

        select.innerHTML =
            `<option value="all">All Courses</option>`;

        courses.forEach(course => {

            const option =
                document.createElement('option');

            option.value = course.courseId;

            option.textContent =
                `${course.name} (${course.code})`;

            select.appendChild(option);
        });

    } catch (error) {

        console.error(
            'Courses Error:',
            error
        );
    }
}



// OPEN &CLOSE MODAL


function openReportModal(type) {

    currentReportType = type;

    document.getElementById(
        'reportConfigModal'
    ).style.display = 'flex';
}

function closeReportModal() {

    document.getElementById(
        'reportConfigModal'
    ).style.display = 'none';
}



// DOWNLOAD rEPORT


async function downloadReport() {

    const courseId =
        document.getElementById(
            'reportCourseSelect'
        ).value;

    const fromDate =
        document.getElementById(
            'reportFromDate'
        ).value;

    const toDate =
        document.getElementById(
            'reportToDate'
        ).value;

    const downloadBtn =
        document.getElementById(
            'downloadBtn'
        );

    if (!fromDate || !toDate) {

        return Swal.fire(
            'Missing Data',
            'Please select dates',
            'warning'
        );
    }

    const originalHTML =
        downloadBtn.innerHTML;

    downloadBtn.innerHTML =
        `<i class="fas fa-spinner fa-spin"></i> Generating...`;

    downloadBtn.disabled = true;

    try {
        const response = await fetch(
            `${API_BASE_URL}/attendance`,
            {
                headers: {
                    Authorization: getToken()
                }
            }
        );

        const result =
            await response.json();

        let records =
            result.data?.data || [];

        // FILTER BY COURSE
   
        if (courseId !== 'all') {

            records = records.filter(
                r =>
                    String(r.courseId) ===
                    String(courseId)
            );
        }

        // =========================================
        // FILTER BY DATE
        // =========================================

        records = records.filter(r => {

            const recordDate =
                new Date(r.recordDate);

            return (
                recordDate >= new Date(fromDate) &&
                recordDate <= new Date(toDate)
            );
        });

        let html = `
            <html>
            <head>
                <title>Attendance Report</title>

                <style>

                    body{
                        font-family: Arial;
                        padding:20px;
                    }

                    table{
                        width:100%;
                        border-collapse:collapse;
                    }

                    th,td{
                        border:1px solid #ccc;
                        padding:10px;
                        text-align:left;
                    }

                    th{
                        background:#f4f4f4;
                    }

                </style>
            </head>

            <body>

                <h2>
                    Attendance Report
                </h2>

                <p>
                    From:
                    ${fromDate}
                </p>

                <p>
                    To:
                    ${toDate}
                </p>

                <table>

                    <thead>
                        <tr>
                            <th>Student</th>
                            <th>Email</th>
                            <th>Course</th>
                            <th>Room</th>
                            <th>Date</th>
                            <th>Check In</th>
                            <th>Status</th>
                        </tr>
                    </thead>

                    <tbody>
        `;

        const statusLabel = { 1:'Present', 2:'Absent', 3:'Late', 4:'Excused' };
        records.forEach(record => {

            html += `
                <tr>

                    <td>
                        ${record.student?.username || 'N/A'}
                    </td>

                    <td>
                        ${record.student?.email || 'N/A'}
                    </td>

                    <td>
                        ${record.courseId}
                    </td>

                    <td>
                        ${record.room || 'N/A'}
                    </td>

                    <td>
                        ${record.recordDate}
                    </td>

                    <td>
                        ${record.checkInTime || '-'}
                    </td>

                    <td>
                        ${statusLabel[record.attendanceStatusId] || '-'}
                    </td>

                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>

            </body>
            </html>
        `;

        // DOWNLOAD FILE
  
        const blob = new Blob(
            [html],
            { type: 'text/html' }
        );

        const url =
            URL.createObjectURL(blob);

        const a =
            document.createElement('a');

        a.href = url;

        a.download =
            `attendance-report-${Date.now()}.html`;

        document.body.appendChild(a);

        a.click();

        a.remove();

        URL.revokeObjectURL(url);

        // UPDATE RECENT


        addRecentReport({
            name:
                `${currentReportType} Report`,
            date:
                new Date().toISOString(),
            size:
                `${(blob.size / 1024).toFixed(2)} KB`
        });

        Swal.fire(
            'Success',
            'Report generated successfully',
            'success'
        );

        closeReportModal();

    } catch (error) {

        console.error(error);

        Swal.fire(
            'Error',
            'Failed to generate report',
            'error'
        );

    } finally {

        downloadBtn.innerHTML =
            originalHTML;

        downloadBtn.disabled = false;
    }
}

//Performance
async function generatePerformanceReport() {

    try {

        const response = await fetch(
            `${API_BASE_URL}/attendance/statistics`,
            {
                headers: {
                    Authorization: getToken()
                }
            }
        );

        const result = await response.json();

        const data = result.data;

        if (!data || !data.breakdown) {
            Swal.fire("No Data", "No statistics found", "info");
            return;
        }

        const total = data.total;
        const breakdown = data.breakdown;

        const present =
            breakdown.find(b => b.statusName === "Present")?.count || 0;

        const absent =
            breakdown.find(b => b.statusName === "Absent")?.count || 0;

        const late =
            breakdown.find(b => b.statusName === "Late")?.count || 0;

        const presentPercent =
            breakdown.find(b => b.statusName === "Present")?.percentage || 0;

        const absentPercent =
            breakdown.find(b => b.statusName === "Absent")?.percentage || 0;

        const latePercent =
            breakdown.find(b => b.statusName === "Late")?.percentage || 0;


        let html = `
        <html>
        <head>
            <title>Performance Report</title>
            <style>
                body { font-family: Arial; padding: 20px; }
                .card {
                    padding: 15px;
                    margin-bottom: 10px;
                    border: 1px solid #ddd;
                    border-radius: 10px;
                }
                h2 { margin-bottom: 20px; }
            </style>
        </head>
        <body>

        <h2>Attendance Performance Summary</h2>

        <div class="card">
            <h3>Total Records</h3>
            <p>${total}</p>
        </div>

        <div class="card">
            <h3>Present</h3>
            <p>${present} (${presentPercent}%)</p>
        </div>

        <div class="card">
            <h3>Absent</h3>
            <p>${absent} (${absentPercent}%)</p>
        </div>

        <div class="card">
            <h3>Late</h3>
            <p>${late} (${latePercent}%)</p>
        </div>

        </body>
        </html>
        `;

  
        // DOWNLOAD FILE

        const blob = new Blob([html], {
            type: "text/html"
        });

        const url = URL.createObjectURL(blob);

       const a = document.createElement("a");
      a.href = url;
      a.download = `performance-summary-${Date.now()}.html`;
       document.body.appendChild(a); 
       a.click();                   
       a.remove();                  
      URL.revokeObjectURL(url);
      addRecentReport({
            name: 'Performance Report',
            date: new Date().toISOString(),
            size: `${(blob.size / 1024).toFixed(2)} KB`
        });

        Swal.fire(
            "Success",
            "Performance report generated",
            "success"
        );

    } catch (error) {

        console.error(error);

        Swal.fire(
            "Error",
            "Failed to generate report",
            "error"
        );
    }
}

//sys report 
async function generateSysReport() {
    try {
        const [statsRes, attendanceRes] = await Promise.all([
            fetch(`${API_BASE_URL}/attendance/statistics`, {
                headers: { Authorization: getToken() }
            }),
            fetch(`${API_BASE_URL}/attendance`, {
                headers: { Authorization: getToken() }
            })
        ]);

        const statsResult = await statsRes.json();
        const attendanceResult = await attendanceRes.json();

        const stats = statsResult.data || {};
        const records = attendanceResult.data?.data || [];

        const total = stats.total || 0;
        const present = stats.breakdown?.find(b => b.statusName === 'Present')?.count || 0;
        const absent  = stats.breakdown?.find(b => b.statusName === 'Absent')?.count || 0;
        const presentPct = stats.breakdown?.find(b => b.statusName === 'Present')?.percentage || '0';
        const visionMarked = records.filter(
           r => r.matchStatus === 'MATCH'
          ).length;

        const manualMarked = records.length - visionMarked;

        const accuracyRate = records.length > 0
            ? ((visionMarked / records.length) * 100).toFixed(1)
            : 0;
        const lectures = records.filter(
            r => r.sessionType === 'LECTURE'
        ).length;

        const sections = records.filter(
            r => r.sessionType === 'SECTION'
        ).length;

        const html = `
            <html>
            <head>
                <title>System Report</title>
                <style>
                    body { font-family: Arial; padding: 20px; background: #f9f9f9; }
                    h2 { color: #333; }
                    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px; }
                    .card {
                        background: white; padding: 20px;
                        border-radius: 10px; border: 1px solid #ddd;
                    }
                    .card h3 { margin: 0 0 8px; color: #555; font-size: 14px; }
                    .card p { margin: 0; font-size: 28px; font-weight: bold; color: #333; }
                    .card small { color: #888; font-size: 12px; }
                    .generated { color: #888; font-size: 13px; margin-top: 30px; }
                </style>
            </head>
            <body>
                <h2>System Usage & Accuracy Report</h2>

                <div class="grid">
                    <div class="card">
                        <h3>Total Attendance Records</h3>
                    <!-- <p>${records.length}</p>  -->
                    <p>${total}</p>
                    </div>
                    <div class="card">
                        <h3>Vision AI Accuracy Rate</h3>
                        <p>${accuracyRate}%</p>
                        <small>${visionMarked} auto-marked / ${manualMarked} manual</small>
                    </div>
                    <div class="card">
                        <h3>Overall Attendance Rate</h3>
                     <!--   <p>${stats.attendanceRate ?? 'N/A'}%</p>    -->
                       <!-- <small>${stats.presentCount ?? 0} present / ${stats.absentCount ?? 0} absent</small> -->

                       <p>${presentPct}%</p>
                       <small>${present} present / ${absent} absent</small>
                    </div>
                    <div class="card">
                        <h3>Sessions Tracked</h3>
                        <p>${lectures + sections}</p>
                        <small>${lectures} lectures · ${sections} sections</small>
                    </div>
                </div>

                <p class="generated">Generated: ${new Date().toLocaleString()}</p>
            </body>
            </html>
        `;

        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `system-report-${Date.now()}.html`;
        a.click();
        URL.revokeObjectURL(url);

        addRecentReport({
            name: 'System Report',
            date: new Date().toISOString(),
            size: `${(blob.size / 1024).toFixed(2)} KB`
        });

        Swal.fire('Success', 'System report generated', 'success');

    } catch (error) {
        console.error(error);
        Swal.fire('Error', 'Failed to generate system report', 'error');
    }
}


//Render UI


function renderEmptyReports() {

    const container =
        document.getElementById(
            'recentReportsContainer'
        );

    if (!container) return;

    container.innerHTML = `
        <p style="
            text-align:center;
            color:var(--text-dim);
            margin:20px 0;
        ">
            No reports generated yet
        </p>
    `;
}

function addRecentReport(report) {

    const container =
        document.getElementById(
            'recentReportsContainer'
        );

    if (!container) return;

    const empty =
        container.querySelector('p');

    if (empty) {
        container.innerHTML = '';
    }

    container.innerHTML =
        `
        <div class="report-item">

            <div class="report-main-info">

                <i class="fas fa-file-alt"></i>

                <div>

                    <h4>
                        ${report.name}
                    </h4>

                    <span>
                        ${new Date(
                            report.date
                        ).toLocaleString()}
                        •
                        ${report.size}
                    </span>

                </div>

            </div>

        </div>
        `
        + container.innerHTML;
}


// SIDEBAR


function initSidebar() {

    const sidebar =
        document.querySelector('.sidebar');

    const resizer =
        document.querySelector('.resizer') ||
        document.getElementById(
            'sidebarResizer'
        );

    if (!sidebar || !resizer) return;

    resizer.addEventListener(
        'mousedown',
        e => {

            e.preventDefault();

            function resize(ev) {

                const width =
                    ev.clientX;

                if (
                    width > 200 &&
                    width < 500
                ) {
                    sidebar.style.width =
                        width + 'px';
                }
            }

            function stopResize() {

                document.removeEventListener(
                    'mousemove',
                    resize
                );

                document.removeEventListener(
                    'mouseup',
                    stopResize
                );
            }

            document.addEventListener(
                'mousemove',
                resize
            );

            document.addEventListener(
                'mouseup',
                stopResize
            );
        }
    );
}


function toggleSidebar() {

    document
        .querySelector('.sidebar')
        ?.classList.toggle('active');
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