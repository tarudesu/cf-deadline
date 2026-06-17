document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const addConferenceBtn = document.getElementById('addConferenceBtn');
    const modalOverlay = document.getElementById('conferenceModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const conferenceForm = document.getElementById('conferenceForm');
    const conferencesGrid = document.getElementById('conferencesGrid');
    const emptyState = document.getElementById('emptyState');

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

    conferenceForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveConference();
    });

    // Functions
    function openModal() {
        modalOverlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
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
        if (confirm('Are you sure you want to delete this conference?')) {
            conferences = conferences.filter(c => c.id !== id);
            saveToLocalStorage();
            renderConferences();
        }
    }

    function saveToLocalStorage() {
        localStorage.setItem('cf-deadline-data', JSON.stringify(conferences));
    }

    function renderConferences() {
        if (conferences.length === 0) {
            conferencesGrid.innerHTML = '';
            conferencesGrid.appendChild(emptyState);
            emptyState.style.display = 'block';
            return;
        }

        // Sort by deadline
        const sortedConferences = [...conferences].sort((a, b) => {
            return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        });

        emptyState.style.display = 'none';
        conferencesGrid.innerHTML = '';

        sortedConferences.forEach(conf => {
            const card = document.createElement('div');
            card.className = 'card';
            card.dataset.id = conf.id;
            card.dataset.deadline = conf.deadline;

            card.innerHTML = `
                <div class="card-header">
                    <div class="card-title-group">
                        <h3 class="card-abbr">${conf.abbr}</h3>
                        <p class="card-name" title="${conf.name}">${conf.name}</p>
                    </div>
                    <div class="card-actions">
                        ${conf.url ? `
                        <a href="${conf.url}" target="_blank" rel="noopener noreferrer" class="icon-btn" title="Visit Website">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                        </a>
                        ` : ''}
                        <button class="icon-btn delete-btn" title="Delete">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="card-meta">
                    <div class="meta-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        ${formatDate(conf.deadline)}
                    </div>
                    ${conf.location ? `
                    <div class="meta-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        ${conf.location}
                    </div>
                    ` : ''}
                </div>
                <div class="countdown-container">
                    <div class="countdown-box">
                        <span class="countdown-value days">--</span>
                        <span class="countdown-label">Days</span>
                    </div>
                    <div class="countdown-box">
                        <span class="countdown-value hours">--</span>
                        <span class="countdown-label">Hrs</span>
                    </div>
                    <div class="countdown-box">
                        <span class="countdown-value minutes">--</span>
                        <span class="countdown-label">Min</span>
                    </div>
                    <div class="countdown-box">
                        <span class="countdown-value seconds">--</span>
                        <span class="countdown-label">Sec</span>
                    </div>
                </div>
            `;

            const deleteBtn = card.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', () => deleteConference(conf.id));

            conferencesGrid.appendChild(card);
        });

        updateAllCountdowns();
    }

    function formatDate(dateStr) {
        const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return new Date(dateStr).toLocaleDateString('en-US', options);
    }

    function startCountdownTimer() {
        setInterval(updateAllCountdowns, 1000);
    }

    function updateAllCountdowns() {
        const cards = document.querySelectorAll('.card');
        const now = new Date().getTime();

        cards.forEach(card => {
            const deadline = new Date(card.dataset.deadline).getTime();
            const distance = deadline - now;

            const daysEl = card.querySelector('.days');
            const hoursEl = card.querySelector('.hours');
            const minsEl = card.querySelector('.minutes');
            const secsEl = card.querySelector('.seconds');

            if (distance < 0) {
                // Expired
                daysEl.textContent = '00';
                hoursEl.textContent = '00';
                minsEl.textContent = '00';
                secsEl.textContent = '00';
                
                card.classList.remove('status-success', 'status-warning', 'status-danger');
                card.classList.add('status-expired');
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
            card.classList.remove('status-success', 'status-warning', 'status-danger', 'status-expired');
            if (days < 3) {
                card.classList.add('status-danger');
            } else if (days < 14) {
                card.classList.add('status-warning');
            } else {
                card.classList.add('status-success');
            }
        });
    }
});
