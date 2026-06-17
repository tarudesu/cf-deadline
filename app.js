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

    // State
    let conferences = JSON.parse(localStorage.getItem('cf-deadline-data')) || [];

    // Initialize
    renderConferences();
    startCountdownTimer();

    // Event Listeners
    addConferenceBtn.addEventListener('click', () => openModal());
    closeModalBtn.addEventListener('click', () => closeModal());
    cancelBtn.addEventListener('click', () => closeModal());
    
    // Close modal on outside click
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modalOverlay.classList.contains('hidden')) {
            closeModal();
        }
    });

    conferenceForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveConference();
    });

    // Functions
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

    function saveConference() {
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
        saveToLocalStorage();
        renderConferences();
        closeModal();
    }

    function deleteConference(id) {
        if (confirm('Are you sure you want to remove this deadline?')) {
            conferences = conferences.filter(c => c.id !== id);
            saveToLocalStorage();
            renderConferences();
        }
    }

    // Expose deleteConference to global scope for inline onclick handlers
    window.deleteConference = deleteConference;

    function saveToLocalStorage() {
        localStorage.setItem('cf-deadline-data', JSON.stringify(conferences));
    }

    function renderConferences() {
        totalCount.textContent = conferences.length;

        if (conferences.length === 0) {
            conferencesList.innerHTML = '';
            conferencesList.appendChild(emptyState);
            emptyState.style.display = 'block';
            return;
        }

        // Sort by deadline
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
                        <button class="icon-btn delete" onclick="deleteConference('${conf.id}')" title="Remove">
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
