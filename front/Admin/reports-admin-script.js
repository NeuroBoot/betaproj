const API_BASE_URL = 'http://localhost:3000/api/v1';

document.addEventListener('DOMContentLoaded', function () {
    const sidebar = document.querySelector('.sidebar');
    const resizer = document.querySelector('.resizer');

    if (resizer && sidebar) {
        resizer.addEventListener('mousedown', function (e) {
            e.preventDefault();
            document.addEventListener('mousemove', resize);
            document.addEventListener('mouseup', stopResize);
            document.body.style.cursor = 'col-resize';
        });

        function resize(e) {
            let newWidth = e.clientX;
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

    // Attach real CSV generation to the Generate buttons
    const genButtons = document.querySelectorAll('.btn-gen');
    if (genButtons.length >= 3) {
        genButtons[0].addEventListener('click', () => generateCSVReport('attendance'));
        genButtons[1].addEventListener('click', () => generateCSVReport('performance'));
        genButtons[2].addEventListener('click', () => generateCSVReport('system'));
    }

    // Hook up the recent reports buttons to download as well
    const downloadButtons = document.querySelectorAll('.btn-download');
    downloadButtons.forEach((btn, index) => {
        btn.addEventListener('click', () => {
            const types = ['attendance', 'performance', 'system'];
            generateCSVReport(types[index % 3]);
        });
    });
});

function getAuthToken() {
    let token = localStorage.getItem('token');
    if (!token) return "";
    token = token.replace(/['"]+/g, '').trim();
    if (token.toLowerCase().startsWith('bearer ')) {
        token = token.substring(7).trim();
    }
    return `Bearer ${token}`;
}

async function generateCSVReport(type) {
    try {
        let endpoint = '';
        let filename = '';
        
        if (type === 'attendance') {
            endpoint = `${API_BASE_URL}/attendance`;
            filename = `Attendance_Report_${new Date().toISOString().split('T')[0]}.csv`;
        } else if (type === 'performance') {
            endpoint = `${API_BASE_URL}/users?role=student`;
            filename = `Performance_Report_${new Date().toISOString().split('T')[0]}.csv`;
        } else if (type === 'system') {
            endpoint = `${API_BASE_URL}/courses`;
            filename = `System_Courses_Report_${new Date().toISOString().split('T')[0]}.csv`;
        }

        const response = await fetch(endpoint, {
            headers: { 'Authorization': getAuthToken() }
        });
        
        if (!response.ok) throw new Error("Failed to fetch data for report");
        
        const result = await response.json();
        const data = result.data || result;
        
        if (!data || !Array.isArray(data) || data.length === 0) {
            alert('No data available to generate this report.');
            return;
        }

        let csvContent = "";
        
        if (type === 'attendance') {
            csvContent = "Record ID,Date,Course Name,Student Name,Status\n";
            data.forEach(record => {
                const date = new Date(record.recordDate).toLocaleDateString();
                const courseName = record.course?.name || "N/A";
                const studentName = record.student?.username || "N/A";
                let status = "Unknown";
                if(record.attendanceStatusId === 1) status = "Present";
                else if(record.attendanceStatusId === 2) status = "Absent";
                else if(record.attendanceStatusId === 3) status = "Late";
                csvContent += `${record.attendanceId},${date},${courseName},${studentName},${status}\n`;
            });
        } else if (type === 'performance') {
            csvContent = "Student ID,Username,Email,Status\n";
            data.forEach(user => {
                const status = user.faceEmbedding ? "Face Registered" : "Pending Face";
                csvContent += `${user.userAccountId || user.id},${user.username},${user.email || 'N/A'},${status}\n`;
            });
        } else if (type === 'system') {
            csvContent = "Course Code,Course Name,Sections,Students Enrolled\n";
            data.forEach(course => {
                const students = course.enrollments ? course.enrollments.length : 0;
                csvContent += `${course.code},${course.name},${course.sections || 1},${students}\n`;
            });
        }

        // Trigger CSV Download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        console.error("Report Generation Error:", error);
        alert('Failed to generate report. Server might be offline.');
    }
}

function logout() {
    localStorage.clear();
    window.location.href = "../../index.html";
}