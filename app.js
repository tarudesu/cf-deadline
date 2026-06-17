document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const addConferenceBtn = document.getElementById('addConferenceBtn');
    const modalOverlay = document.getElementById('conferenceModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const conferenceForm = document.getElementById('conferenceForm');
    const conferencesList = document.getElementById('conferencesList');
    const emptyState = document.getElementById('emptyState');
    const totalCount = document.getElementById('totalCount');
    
    // Auth Elements
    const adminControls = document.getElementById('adminControls');
    const loginBtn = document.getElementById('loginBtn');
    const loginText = document.getElementById('loginText');
    const loginModal = document.getElementById('loginModal');
    const closeLoginBtn = document.getElementById('closeLoginBtn');
    const loginForm = document.getElementById('loginForm');
    const githubTokenInput = document.getElementById('githubToken');

    // State
    let conferences = [];
    let githubToken = localStorage.getItem('cf-deadline-auth') || null;
    let isAdmin = false;
    let fileSha = null;

    // Constants
    const REPO_OWNER = 'tarudesu';
    const REPO_NAME = 'cf-deadline';
    const FILE_PATH = 'data.json';

    // Initialize
    initAuth();
    fetchConferences();
    startCountdownTimer();

    // Event Listeners - Auth
    loginBtn.addEventListener('click', () => {
        if (isAdmin) {
            // Logout
            localStorage.removeItem('cf-deadline-auth');
            githubToken = null;
            isAdmin = false;
            updateAuthUI();
        } else {
            loginModal.classList.remove('hidden');
        }
    });

    closeLoginBtn.addEventListener('click', () => {
        loginModal.classList.add('hidden');
        loginForm.reset();
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const token = githubTokenInput.value.trim();
        const btn = document.getElementById('loginSubmitBtn');
        btn.textContent = 'Verifying...';
        btn.disabled = true;

        try {
            const res = await fetch('https://api.github.com/user', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (res.ok && data.login === REPO_OWNER) {
                githubToken = token;
                localStorage.setItem('cf-deadline-auth', token);
                isAdmin = true;
                loginModal.classList.add('hidden');
                loginForm.reset();
                updateAuthUI();
                alert('Successfully logged in as admin!');
            } else {
                alert('Verification failed. Are you sure this is the right token for ' + REPO_OWNER + '?');
            }
        } catch (err) {
            alert('Error connecting to GitHub API.');
        } finally {
            btn.textContent = 'Login';
            btn.disabled = false;
        }
    });

    // Event Listeners - Conferences
    addConferenceBtn.addEventListener('click', () => openModal());
    closeModalBtn.addEventListener('click', () => closeModal());
    cancelBtn.addEventListener('click', () => closeModal());
    
    // Close modal on outside click
    [modalOverlay, loginModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    });

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            modalOverlay.classList.add('hidden');
            loginModal.classList.add('hidden');
        }
    });

    conferenceForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveConference();
    });

    // Functions - Auth
    async function initAuth() {
        if (!githubToken) return;
        try {
            const res = await fetch('https://api.github.com/user', {
                headers: { 'Authorization': `Bearer ${githubToken}` }
            });
            const data = await res.json();
            if (res.ok && data.login === REPO_OWNER) {
                isAdmin = true;
                updateAuthUI();
            } else {
                localStorage.removeItem('cf-deadline-auth');
                githubToken = null;
            }
        } catch (err) {
            console.error('Auth init failed:', err);
        }
    }

    function updateAuthUI() {
        if (isAdmin) {
            adminControls.classList.remove('hidden');
            loginText.textContent = `Logged in as ${REPO_OWNER} (Logout)`;
            // Reveal delete buttons
            const actions = document.querySelectorAll('.item-actions .delete');
            actions.forEach(el => el.classList.remove('hidden'));
        } else {
            adminControls.classList.add('hidden');
            loginText.textContent = 'Admin Login';
            // Hide delete buttons
            const actions = document.querySelectorAll('.item-actions .delete');
            actions.forEach(el => el.classList.add('hidden'));
        }
    }

    // Functions - Data
    async function fetchConferences() {
        try {
            // Fetch directly from Github API to get SHA for future updates and avoid cache issues
            let url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
            let headers = { 'Accept': 'application/vnd.github.v3+json' };
            
            // Use token if available to avoid rate limits
            if (githubToken) {
                headers['Authorization'] = `Bearer ${githubToken}`;
            }

            const res = await fetch(url + '?t=' + Date.now(), { headers });
            
            if (res.ok) {
                const data = await res.json();
                fileSha = data.sha;
                
                // Decode base64 content
                const contentStr = decodeURIComponent(escape(atob(data.content)));
                conferences = JSON.parse(contentStr);
            } else {
                // If it's a 404, it might mean data.json is empty/new.
                conferences = [];
            }
        } catch (err) {
            console.error('Failed to load conferences:', err);
            // Fallback for local testing if needed
            conferences = [];
        }
        renderConferences();
    }

    async function commitToGithub() {
        if (!isAdmin || !githubToken) return false;
        
        try {
            const contentStr = JSON.stringify(conferences, null, 2);
            // Base64 encode preserving utf-8
            const contentBase64 = btoa(unescape(encodeURIComponent(contentStr)));

            const body = {
                message: "Update deadlines via Dashboard",
                content: contentBase64,
            };

            // Include SHA if updating existing file
            if (fileSha) {
                body.sha = fileSha;
            }

            const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (!res.ok) throw new Error('Commit failed');
            
            const data = await res.json();
            fileSha = data.content.sha; // Update SHA for next commit
            return true;
        } catch (err) {
            console.error('Error committing:', err);
            alert('Failed to save to GitHub. Check console for details.');
            return false;
        }
    }

    // Functions - UI
    function openModal() {
        modalOverlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        document.getElementById('confName').focus();
    }

    function closeModal() {
        modalOverlay.classList.add('hidden');
        document.body.style.overflow = '';
        conferenceForm.reset();
    }

    async function saveConference() {
        const name = document.getElementById('confName').value.trim();
        const abbr = document.getElementById('confAbbr').value.trim();
        const location = document.getElementById('confLocation').value.trim();
        const dateStr = document.getElementById('confDate').value;
        const url = document.getElementById('confUrl').value.trim();

        const newConf = {
            id: Date.now().toString(),
            name,
            abbr,
            location,
            deadline: dateStr,
            url
        };

        conferences.push(newConf);
        renderConferences();
        closeModal();

        const success = await commitToGithub();
        if (!success) {
            // Revert on failure
            conferences.pop();
            renderConferences();
        }
    }

    async function deleteConference(id) {
        if (confirm('Are you sure you want to remove this deadline?')) {
            const confIndex = conferences.findIndex(c => c.id === id);
            const backupConf = conferences[confIndex];
            
            // Optimistic update
            conferences.splice(confIndex, 1);
            renderConferences();

            const success = await commitToGithub();
            if (!success) {
                // Revert
                conferences.splice(confIndex, 0, backupConf);
                renderConferences();
            }
        }
    }

    window.deleteConference = deleteConference;

    function renderConferences() {
        totalCount.textContent = conferences.length;

        if (conferences.length === 0) {
            conferencesList.innerHTML = '';
            conferencesList.appendChild(emptyState);
            emptyState.style.display = 'block';
            return;
        }

        const sortedConferences = [...conferences].sort((a, b) => {
            return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        });

        emptyState.style.display = 'none';
        conferencesList.innerHTML = '';

        sortedConferences.forEach((conf, index) => {
            const item = document.createElement('div');
            item.className = 'list-item';
            item.dataset.id = conf.id;
            item.dataset.deadline = conf.deadline;
            item.style.animationDelay = `${index * 0.05}s`;

            const locationHTML = conf.location ? `
                <div class="meta-group">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    ${conf.location}
                </div>
            ` : '';

            const urlHTML = conf.url ? `
                <a href="${conf.url}" target="_blank" rel="noopener noreferrer" class="icon-btn" title="Visit Website">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                </a>
            ` : '';

            // Hide delete button if not admin
            const deleteBtnClass = isAdmin ? "icon-btn delete" : "icon-btn delete hidden";

            item.innerHTML = `
                <div class="item-left">
                    <div class="item-title-row">
                        <div class="status-dot"></div>
                        <span class="item-abbr">${conf.abbr}</span>
                        <span class="item-name">${conf.name}</span>
                    </div>
                    <div class="item-meta">
                        <div class="meta-group">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="16" y1="2" x2="16" y2="6"></line>
                                <line x1="8" y1="2" x2="8" y2="6"></line>
                                <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                            ${formatDate(conf.deadline)}
                        </div>
                        ${locationHTML}
                    </div>
                </div>
                <div class="item-right">
                    <div class="timer">
                        <div class="time-block">
                            <span class="time-val days">--</span>
                            <span class="time-label">d</span>
                        </div>
                        <div class="time-block">
                            <span class="time-val hours">--</span>
                            <span class="time-label">h</span>
                        </div>
                        <div class="time-block">
                            <span class="time-val minutes">--</span>
                            <span class="time-label">m</span>
                        </div>
                        <div class="time-block">
                            <span class="time-val seconds">--</span>
                            <span class="time-label">s</span>
                        </div>
                    </div>
                    <div class="item-actions">
                        ${urlHTML}
                        <button class="${deleteBtnClass}" onclick="deleteConference('${conf.id}')" title="Remove">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                </div>
            `;

            conferencesList.appendChild(item);
        });

        updateAllCountdowns();
    }

    function formatDate(dateStr) {
        const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return new Date(dateStr).toLocaleDateString('en-US', options);
    }

    function startCountdownTimer() {
        setInterval(updateAllCountdowns, 1000);
    }

    function updateAllCountdowns() {
        const items = document.querySelectorAll('.list-item');
        const now = new Date().getTime();

        items.forEach(item => {
            const deadline = new Date(item.dataset.deadline).getTime();
            const distance = deadline - now;

            const daysEl = item.querySelector('.days');
            const hoursEl = item.querySelector('.hours');
            const minsEl = item.querySelector('.minutes');
            const secsEl = item.querySelector('.seconds');

            if (distance < 0) {
                // Expired
                daysEl.textContent = '00';
                hoursEl.textContent = '00';
                minsEl.textContent = '00';
                secsEl.textContent = '00';
                
                item.className = 'list-item expired';
                return;
            }

            // Calculations
            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            // Output
            daysEl.textContent = days.toString().padStart(2, '0');
            hoursEl.textContent = hours.toString().padStart(2, '0');
            minsEl.textContent = minutes.toString().padStart(2, '0');
            secsEl.textContent = seconds.toString().padStart(2, '0');

            // Status colors
            item.className = 'list-item';
            if (days < 3) {
                item.classList.add('danger');
            } else if (days < 14) {
                item.classList.add('warning');
            } else {
                item.classList.add('success');
            }
        });
    }
});
