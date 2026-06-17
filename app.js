import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, signInWithPopup, GithubAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAGaUrGzk_eEA7LXubbkkp4b3t8C7J8yrI",
  authDomain: "cf-deadline.firebaseapp.com",
  projectId: "cf-deadline",
  storageBucket: "cf-deadline.firebasestorage.app",
  messagingSenderId: "253912311769",
  appId: "1:253912311769:web:f68056f531740564e6dbc8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GithubAuthProvider();

// Theme Toggle Logic
const themeToggleBtn = document.getElementById('themeToggleBtn');
const currentTheme = localStorage.getItem('theme') || 'light';
if (currentTheme === 'dark') {
    document.documentElement.classList.add('dark-theme');
} else {
    document.documentElement.classList.remove('dark-theme');
}
themeToggleBtn.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark-theme');
    const isDark = document.documentElement.classList.contains('dark-theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

// DOM Elements
const addConferenceBtn = document.getElementById('addConferenceBtn');
const modalOverlay = document.getElementById('conferenceModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelBtn = document.getElementById('cancelBtn');
const conferenceForm = document.getElementById('conferenceForm');
const conferencesList = document.getElementById('conferencesList');
const emptyState = document.getElementById('emptyState');
const totalCount = document.getElementById('totalCount');

// Tab Selection & Markdown Elements
const tabManual = document.getElementById('tabManual');
const tabMarkdown = document.getElementById('tabMarkdown');
const manualFormSection = document.getElementById('manualFormSection');
const markdownImportSection = document.getElementById('markdownImportSection');
const copyPromptBtn = document.getElementById('copyPromptBtn');
const promptTemplate = document.getElementById('promptTemplate');
const markdownInput = document.getElementById('markdownInput');
const cancelMarkdownBtn = document.getElementById('cancelMarkdownBtn');
const parseMarkdownBtn = document.getElementById('parseMarkdownBtn');

// Auth Elements
const adminControls = document.getElementById('adminControls');
const loginBtn = document.getElementById('loginBtn');
const loginText = document.getElementById('loginText');

// State
let conferences = [];
let isAdmin = false;
let countdownInterval = null;

// The repo owner's github username allowed to edit
const ADMIN_GITHUB_USERNAME = 'tarudesu';

// Event Listeners - Auth
loginBtn.addEventListener('click', async () => {
    if (isAdmin) {
        // Logout
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Sign out error", error);
        }
    } else {
        // Login
        try {
            loginText.textContent = "Logging in...";
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Login error", error);
            loginText.textContent = "Admin Login";
            alert("Failed to login with GitHub: " + error.message);
        }
    }
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // We can get the GitHub username from user.reloadUserInfo.screenName
        const githubUsername = user.reloadUserInfo?.screenName || user.displayName;
        
        // Enforce admin username matching:
        if (githubUsername && githubUsername.toLowerCase() !== ADMIN_GITHUB_USERNAME.toLowerCase()) {
            alert("You are not authorized as admin.");
            await signOut(auth);
            return;
        }

        isAdmin = true;
        adminControls.classList.remove('hidden');
        loginText.textContent = `Logged in as ${githubUsername} (Logout)`;
        renderConferences(); // re-render to show delete buttons
    } else {
        isAdmin = false;
        adminControls.classList.add('hidden');
        loginText.textContent = 'Admin Login';
        renderConferences(); // re-render to hide delete buttons
    }
});

// Event Listeners - Conferences
addConferenceBtn.addEventListener('click', () => {
    modalOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    document.getElementById('confName').focus();
});

const closeModal = () => {
    modalOverlay.classList.add('hidden');
    document.body.style.overflow = '';
    conferenceForm.reset();
    if (markdownInput) markdownInput.value = '';
    if (tabManual) tabManual.click();
};

closeModalBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);
cancelMarkdownBtn.addEventListener('click', closeModal);

modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
        closeModal();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalOverlay.classList.contains('hidden')) {
        closeModal();
    }
});

// Tab Switching
tabManual.addEventListener('click', () => {
    tabManual.classList.add('active');
    tabMarkdown.classList.remove('active');
    manualFormSection.classList.remove('hidden');
    markdownImportSection.classList.add('hidden');
});

tabMarkdown.addEventListener('click', () => {
    tabMarkdown.classList.add('active');
    tabManual.classList.remove('active');
    markdownImportSection.classList.remove('hidden');
    manualFormSection.classList.add('hidden');
});

// Copy Prompt to Clipboard
copyPromptBtn.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(promptTemplate.textContent);
        const originalText = copyPromptBtn.innerHTML;
        copyPromptBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Copied!
        `;
        setTimeout(() => {
            copyPromptBtn.innerHTML = originalText;
        }, 2000);
    } catch (err) {
        console.error('Failed to copy prompt: ', err);
    }
});

// Helper: Format YYYY-MM-DD HH:MM from Markdown for <input type="datetime-local">
function formatDateTimeForInput(dateStr) {
    if (!dateStr) return '';
    let formatted = dateStr.trim().replace(/\s+/, 'T');
    const match = formatted.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    return match ? match[0] : '';
}

// Helper: Map Timezone strings to selector values
function mapTimezoneValue(tzStr) {
    if (!tzStr) return 'AoE';
    const clean = tzStr.trim().toUpperCase();
    if (clean.includes('AOE')) return 'AoE';
    if (clean.includes('UTC') || clean === 'Z') {
        const offsetMatch = clean.match(/([+-]\d{2}:?\d{2})/);
        if (offsetMatch) return offsetMatch[1];
        return 'UTC';
    }
    if (clean.includes('LOCAL')) return 'Local';
    const directOffset = clean.match(/^[+-]\d{2}:?\d{2}$/);
    if (directOffset) return directOffset[0];
    return 'AoE';
}

// Helper: Parse Markdown text into structured object
function parseMarkdown(text) {
    const lines = text.split('\n');
    const data = {};
    
    const extract = (line, prefix) => {
        const regex = new RegExp(`^-\\s*${prefix}:\\s*(.*)$`, 'i');
        const match = line.match(regex);
        return match ? match[1].trim() : null;
    };

    lines.forEach(line => {
        const trimmed = line.trim();
        if (extract(trimmed, 'Title') !== null) data.name = extract(trimmed, 'Title');
        else if (extract(trimmed, 'Abbreviation') !== null) data.abbr = extract(trimmed, 'Abbreviation');
        else if (extract(trimmed, 'Location') !== null) data.location = extract(trimmed, 'Location');
        else if (extract(trimmed, 'Conference Date') !== null) data.eventDate = extract(trimmed, 'Conference Date');
        else if (extract(trimmed, 'Abstract Deadline') !== null) data.abstractDeadline = extract(trimmed, 'Abstract Deadline');
        else if (extract(trimmed, 'Submission Deadline') !== null) data.deadline = extract(trimmed, 'Submission Deadline');
        else if (extract(trimmed, 'Timezone') !== null) data.timezone = extract(trimmed, 'Timezone');
        else if (extract(trimmed, 'Website') !== null) data.url = extract(trimmed, 'Website');
        else if (extract(trimmed, 'Ranking') !== null) data.ranking = extract(trimmed, 'Ranking');
    });

    return data;
}

// Parse Markdown Action
parseMarkdownBtn.addEventListener('click', () => {
    const text = markdownInput.value;
    if (!text.trim()) {
        alert('Please paste some markdown content first.');
        return;
    }
    
    const data = parseMarkdown(text);
    
    if (data.name) document.getElementById('confName').value = data.name;
    if (data.abbr) document.getElementById('confAbbr').value = data.abbr;
    if (data.location) document.getElementById('confLocation').value = data.location;
    if (data.eventDate) document.getElementById('confEventDate').value = data.eventDate;
    if (data.url) document.getElementById('confUrl').value = data.url;
    if (data.ranking) document.getElementById('confRanking').value = data.ranking;
    
    if (data.abstractDeadline) {
        document.getElementById('confAbstractDate').value = formatDateTimeForInput(data.abstractDeadline);
    } else {
        document.getElementById('confAbstractDate').value = '';
    }
    
    if (data.deadline) {
        document.getElementById('confDate').value = formatDateTimeForInput(data.deadline);
    } else {
        document.getElementById('confDate').value = '';
    }
    
    if (data.timezone) {
        document.getElementById('confTimezone').value = mapTimezoneValue(data.timezone);
    } else {
        document.getElementById('confTimezone').value = 'AoE';
    }
    
    tabManual.click();
    markdownInput.value = '';
});

// Helper: Get UTC millisecond timestamp for a datetime-local in a specific timezone
function getUtcTimestamp(localDateTimeStr, timezoneVal) {
    if (!localDateTimeStr) return null;
    
    let baseStr = localDateTimeStr;
    if (baseStr.length === 16) {
        baseStr += ':00'; // add seconds if missing
    }
    
    if (timezoneVal === 'Local') {
        return new Date(baseStr).getTime();
    }
    
    let isoStr = baseStr;
    if (timezoneVal === 'AoE') {
        isoStr += '-12:00';
    } else if (timezoneVal === 'UTC') {
        isoStr += 'Z';
    } else {
        isoStr += timezoneVal; // standard offset like +07:00
    }
    
    const ts = Date.parse(isoStr);
    return isNaN(ts) ? null : ts;
}

// Helper: Formats local time string exactly as entered for display
function formatNominalDate(localDateTimeStr) {
    if (!localDateTimeStr) return '';
    const [datePart, timePart] = localDateTimeStr.split('T');
    if (!datePart || !timePart) return localDateTimeStr;
    const [year, month, day] = datePart.split('-');
    const [hours, minutes] = timePart.split(':');
    
    const date = new Date(year, month - 1, day, hours, minutes);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

conferenceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    const name = document.getElementById('confName').value.trim();
    const ranking = document.getElementById('confRanking').value.trim();
    const abbr = document.getElementById('confAbbr').value.trim();
    const location = document.getElementById('confLocation').value.trim();
    const eventDate = document.getElementById('confEventDate').value.trim();
    const url = document.getElementById('confUrl').value.trim();
    const abstractDeadline = document.getElementById('confAbstractDate').value;
    const deadline = document.getElementById('confDate').value;
    const timezone = document.getElementById('confTimezone').value;

    const newConf = {
        name,
        ranking,
        abbr,
        location,
        eventDate,
        url,
        abstractDeadline,
        deadline,
        timezone,
        createdAt: new Date().toISOString()
    };

    try {
        await addDoc(collection(db, "conferences"), newConf);
        closeModal();
    } catch (e) {
        console.error("Error adding document: ", e);
        alert("Failed to save conference. Are Firestore rules configured correctly?");
    }
});

// Real-time Database Listener
const q = query(collection(db, "conferences"));
onSnapshot(q, (querySnapshot) => {
    conferences = [];
    querySnapshot.forEach((doc) => {
        conferences.push({
            id: doc.id,
            ...doc.data()
        });
    });
    renderConferences();
    if (!countdownInterval) {
        startCountdownTimer();
    }
});

// Functions - UI
async function deleteConference(id) {
    if (!isAdmin) return;
    if (confirm('Are you sure you want to remove this deadline?')) {
        try {
            await deleteDoc(doc(db, "conferences", id));
        } catch (e) {
            console.error("Error deleting document: ", e);
            alert("Failed to delete conference.");
        }
    }
}
// Attach to window so inline onclick handlers can reach it
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
        const aUtc = getUtcTimestamp(a.deadline, a.timezone || 'AoE') || 0;
        const bUtc = getUtcTimestamp(b.deadline, b.timezone || 'AoE') || 0;
        return aUtc - bUtc;
    });

    emptyState.style.display = 'none';
    conferencesList.innerHTML = '';

    sortedConferences.forEach((conf, index) => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.dataset.id = conf.id;
        
        const deadlineUtc = getUtcTimestamp(conf.deadline, conf.timezone || 'AoE');
        item.dataset.deadlineUtc = deadlineUtc;
        
        if (conf.abstractDeadline) {
            const abstractUtc = getUtcTimestamp(conf.abstractDeadline, conf.timezone || 'AoE');
            item.dataset.abstractUtc = abstractUtc;
        }
        
        item.style.animationDelay = `${index * 0.05}s`;

        const tzLabel = conf.timezone === 'AoE' ? 'AoE' : (conf.timezone === 'UTC' ? 'UTC' : (conf.timezone === 'Local' ? 'Local' : conf.timezone));

        // Ranking Badge
        const isSpecialRank = conf.ranking && (conf.ranking.toUpperCase().includes('A*') || conf.ranking.toUpperCase().includes('CCF A') || conf.ranking.toUpperCase() === 'A');
        const rankingClass = isSpecialRank ? 'ranking-badge special' : 'ranking-badge';
        const rankingHTML = conf.ranking ? `<span class="${rankingClass}">${conf.ranking}</span>` : '';

        // Abstract Meta Info
        const abstractMetaHTML = conf.abstractDeadline ? `
            <div class="meta-group">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                Abstract: ${formatNominalDate(conf.abstractDeadline)}
            </div>
        ` : '';

        // Abstract Countdown Row
        const abstractHTML = conf.abstractDeadline ? `
            <div class="abstract-countdown-row">
                <span class="sub-label">Abstract:</span>
                <span class="sub-timer-val abstract-timer">Calculating...</span>
            </div>
        ` : '';

        // Location Meta
        const locationHTML = conf.location ? `
            <div class="meta-group">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                </svg>
                ${conf.location}
            </div>
        ` : '';

        // Event Date Meta
        const eventDateHTML = conf.eventDate ? `
            <div class="meta-group">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                Event: ${conf.eventDate}
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

        const deleteBtnClass = isAdmin ? "icon-btn delete" : "icon-btn delete hidden";

        item.innerHTML = `
            <div class="item-left">
                <div class="item-title-row">
                    <div class="status-dot"></div>
                    <span class="item-abbr">${conf.abbr}</span>
                    ${rankingHTML}
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
                        Deadline: ${formatNominalDate(conf.deadline)} (${tzLabel})
                    </div>
                    ${abstractMetaHTML}
                    ${locationHTML}
                    ${eventDateHTML}
                </div>
                ${abstractHTML}
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

function startCountdownTimer() {
    countdownInterval = setInterval(updateAllCountdowns, 1000);
}

function updateAllCountdowns() {
    const items = document.querySelectorAll('.list-item');
    const now = new Date().getTime();

    items.forEach(item => {
        const deadlineUtc = parseInt(item.dataset.deadlineUtc);
        const distance = deadlineUtc - now;

        const daysEl = item.querySelector('.days');
        const hoursEl = item.querySelector('.hours');
        const minsEl = item.querySelector('.minutes');
        const secsEl = item.querySelector('.seconds');

        if (isNaN(deadlineUtc)) {
            return;
        }

        if (distance < 0) {
            daysEl.textContent = '00';
            hoursEl.textContent = '00';
            minsEl.textContent = '00';
            secsEl.textContent = '00';
            item.className = 'list-item expired';
        } else {
            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            daysEl.textContent = days.toString().padStart(2, '0');
            hoursEl.textContent = hours.toString().padStart(2, '0');
            minsEl.textContent = minutes.toString().padStart(2, '0');
            secsEl.textContent = seconds.toString().padStart(2, '0');

            item.className = 'list-item';
            if (days < 3) {
                item.classList.add('danger');
            } else if (days < 14) {
                item.classList.add('warning');
            } else {
                item.classList.add('success');
            }
        }

        // Handle Abstract Countdown
        const abstractUtc = parseInt(item.dataset.abstractUtc);
        const abstractTimerEl = item.querySelector('.abstract-timer');
        const abstractRowEl = item.querySelector('.abstract-countdown-row');
        
        if (!isNaN(abstractUtc) && abstractTimerEl && abstractRowEl) {
            const absDistance = abstractUtc - now;
            if (absDistance < 0) {
                abstractTimerEl.textContent = 'Passed';
                abstractRowEl.classList.add('expired');
            } else {
                const absDays = Math.floor(absDistance / (1000 * 60 * 60 * 24));
                const absHours = Math.floor((absDistance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const absMinutes = Math.floor((absDistance % (1000 * 60 * 60)) / (1000 * 60));
                const absSeconds = Math.floor((absDistance % (1000 * 60)) / 1000);
                
                abstractTimerEl.textContent = `${absDays}d ${absHours.toString().padStart(2, '0')}h ${absMinutes.toString().padStart(2, '0')}m ${absSeconds.toString().padStart(2, '0')}s`;
                abstractRowEl.classList.remove('expired');
            }
        }
    });
}
