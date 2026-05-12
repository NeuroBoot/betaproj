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

    const searchInput = document.querySelector('.search-input');
    const searchBtn = document.querySelector('.btn-search');
    const typeSelect = document.querySelectorAll('select')[0];
    const resultsContainer = document.querySelector('.results-section-card');

    searchBtn.addEventListener('click', async () => {
        const query = searchInput.value.trim();
        const type = typeSelect.value.toLowerCase(); // students, instructors, courses
        
        let endpoint = '';
        if (type === 'students') endpoint = `${API_BASE_URL}/users?role=student`;
        else if (type === 'instructors') endpoint = `${API_BASE_URL}/users?role=staff`;
        else if (type === 'courses') endpoint = `${API_BASE_URL}/courses`;

        try {
            const res = await fetch(endpoint, {
                headers: { 'Authorization': getAuthToken() }
            });
            const result = await res.json();
            const items = result.data || result;
            
            // Filter locally based on query
            const filtered = items.filter(item => {
                const name = (item.fullName || item.username || item.name || "").toLowerCase();
                const id = String(item.userAccountId || item.id || item.courseId || "").toLowerCase();
                const code = (item.code || "").toLowerCase();
                return name.includes(query.toLowerCase()) || id.includes(query.toLowerCase()) || code.includes(query.toLowerCase());
            });

            renderResults(filtered, type);
        } catch (err) { console.error(err); }
    });

    function renderResults(items, type) {
        let html = `<h3 class="section-subtitle">Search Results (${items.length})</h3>`;
        if (items.length === 0) {
            html += `<div class="empty-results"><p>No results found for your query.</p></div>`;
        } else {
            html += `<div class="results-list" style="margin-top: 20px;">`;
            items.forEach(item => {
                const title = item.fullName || item.username || item.name;
                const subtitle = item.email || item.code || `ID: ${item.userAccountId || item.courseId}`;
                html += `
                    <div class="result-item" style="padding: 15px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h4 style="margin: 0; color: #fff;">${title}</h4>
                            <p style="margin: 5px 0 0; font-size: 0.85rem; color: #8e8e93;">${subtitle}</p>
                        </div>
                        <span class="badge" style="background: rgba(48,96,255,0.1); color: #3060ff; padding: 5px 10px; border-radius: 12px; font-size: 0.75rem;">${type.slice(0, -1)}</span>
                    </div>
                `;
            });
            html += `</div>`;
        }
        resultsContainer.innerHTML = html;
    }
});

function logout() {
    localStorage.clear();
    window.location.href = "../../index.html";
}