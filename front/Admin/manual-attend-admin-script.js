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

let verifyStream = null;
let currentVerifyStudentId = null;

document.addEventListener('DOMContentLoaded', async () => {
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

    await loadCourses();
    setupAiModal();
});

async function loadCourses() {
    try {
        const res = await fetch(`${API_BASE_URL}/courses`, {
            headers: { 'Authorization': getAuthToken() }
        });
        const result = await res.json();
        const courses = result.data || result;
        const select = document.getElementById('courseSelect');
        select.innerHTML = '<option hidden value="">Select Course</option>';
        if (Array.isArray(courses)) {
            courses.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.courseId || c.id;
                opt.textContent = c.name;
                select.appendChild(opt);
            });
        }
    } catch (e) { console.error(e); }
}

async function openDetails() {
    const courseId = document.getElementById('courseSelect').value;
    const section = document.getElementById('sectionSelect').value;
    const date = document.getElementById('dateInput').value;

    if (!courseId) {
        Swal.fire('Error', 'Please select a course', 'error');
        return;
    }

    document.getElementById('disp-course').innerText = document.getElementById('courseSelect').options[document.getElementById('courseSelect').selectedIndex].text;
    document.getElementById('disp-section').innerText = section || "All";
    document.getElementById('disp-date').innerText = date || "Today";

    const tbody = document.getElementById('attendanceTableBody');
    tbody.innerHTML = '<tr><td colspan="4">Loading attendance...</td></tr>';

    try {
        const res = await fetch(`${API_BASE_URL}/courses/${courseId}/students`, {
            headers: { 'Authorization': getAuthToken() }
        });
        const result = await res.json();
        const enrollments = result.data || result;

        tbody.innerHTML = '';
        if (Array.isArray(enrollments)) {
            enrollments.forEach(e => {
                const s = e.student || {};
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${s.userAccountId || s.id}</td>
                    <td>${s.fullName || s.username}</td>
                    <td><span class="status-badge present">Enrolled</span></td>
                    <td>
                        <button class="btn-view-details" style="padding: 5px 10px; font-size: 0.8rem; background: #3060ff;" 
                                onclick="openAiVerify('${s.userAccountId || s.id}')">
                            <i class="fas fa-camera"></i> AI Verify
                        </button>
                    </td>`;
                tbody.appendChild(tr);
            });
            if (enrollments.length === 0) tbody.innerHTML = '<tr><td colspan="4">No students enrolled.</td></tr>';
        }
    } catch (e) { tbody.innerHTML = '<tr><td colspan="4">Error loading data.</td></tr>'; }

    document.getElementById('detailsModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeDetails() {
    document.getElementById('detailsModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

function openAiVerify(studentId) {
    currentVerifyStudentId = studentId;
    document.getElementById('verifyStudentId').textContent = studentId;
    document.getElementById('aiVerifyModal').style.display = 'flex';
}

function setupAiModal() {
    const closeBtn = document.getElementById('closeAiModal');
    const startBtn = document.getElementById('startVerifyCameraBtn');
    const captureBtn = document.getElementById('captureVerifyBtn');
    const video = document.getElementById('verifyVideo');
    const placeholder = document.getElementById('verifyPlaceholder');

    closeBtn.onclick = () => {
        if (verifyStream) verifyStream.getTracks().forEach(t => t.stop());
        document.getElementById('aiVerifyModal').style.display = 'none';
    };

    startBtn.onclick = async () => {
        try {
            verifyStream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = verifyStream;
            video.style.display = 'block';
            placeholder.style.display = 'none';
            startBtn.style.display = 'none';
            captureBtn.style.display = 'inline-block';
        } catch (e) { Swal.fire('Error', 'Camera access denied', 'error'); }
    };

    captureBtn.onclick = async () => {
        const canvas = document.getElementById('verifyCanvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg');

        if (verifyStream) verifyStream.getTracks().forEach(t => t.stop());
        video.style.display = 'none';
        placeholder.style.display = 'block';
        captureBtn.disabled = true;
        captureBtn.textContent = 'Verifying...';

            try {
                const res = await fetch(`${API_BASE_URL}/vision/recognize`, {
                    method: 'POST',
                    headers: { 'Authorization': getAuthToken(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        imageBase64: base64, 
                        confidenceThreshold: 0.6,
                        // Fix: These fields are required by ProcessFrameDto
                        courseId: Number(document.getElementById('courseSelect').value) || 1,
                        sectionId: document.getElementById('sectionSelect').value || '1',
                        sessionId: `VERIFY_${Date.now()}`,
                        sessionType: 'SECTION',
                        sessionNumber: '1'
                    })
                });
                const data = await res.json();
                
                const isMatched = data.matched === true || data.status === 'RECORDED' || data.status === 'ALREADY_RECORDED';
                const confidence = data.confidence ?? data.student?.confidence ?? data.confidenceScore ?? 0;
                const confidencePercent = (confidence * 100).toFixed(1);

                if (isMatched && String(data.studentId || data.student?.id) === String(currentVerifyStudentId)) {
                    Swal.fire('Success', `Face matched! (${confidencePercent}%)`, 'success');
                    document.getElementById('aiVerifyModal').style.display = 'none';
                } else {
                    Swal.fire('No Match', data.message || `Identity could not be verified. (${confidencePercent}%)`, 'error');
                }
            } catch (e) { Swal.fire('Error', 'Verification failed', 'error'); }
        finally {
            captureBtn.disabled = false;
            captureBtn.textContent = 'Verify Face';
            captureBtn.style.display = 'none';
            startBtn.style.display = 'inline-block';
        }
    };
}

window.onclick = (e) => {
    if (e.target == document.getElementById('detailsModal')) closeDetails();
    if (e.target == document.getElementById('aiVerifyModal')) document.getElementById('closeAiModal').click();
};

function logout() {
    localStorage.clear();
    window.location.href = "../../index.html";
}