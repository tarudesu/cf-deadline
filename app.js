import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, signInWithPopup, GithubAuthProvider, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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

// DOM Elements
const addConferenceBtn = document.getElementById('addConferenceBtn');
const modalOverlay = document.getElementById('conferenceModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelBtn = document.getElementById('cancelBtn');
const conferenceForm = document.getElementById('conferenceForm');
const conferencesList = document.getElementById('conferencesList');
const emptyState = document.getElementById('emptyState');
const totalCount = document.getElementById('totalCount');
const searchInput = document.getElementById('searchInput');
const rankFilter = document.getElementById('rankFilter');
const mainTabs = document.querySelectorAll('.main-tab');

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
const logoutBtn = document.getElementById('logoutBtn');
const adminLoginModal = document.getElementById('adminLoginModal');
const closeAuthModalBtn = document.getElementById('closeAuthModalBtn');
const authLoginBtn = document.getElementById('authLoginBtn');
const authStatusMessage = document.getElementById('authStatusMessage');

// State
let conferences = [];
let editingId = null;
let isAdmin = false;
let countdownInterval = null;
let currentTab = 'upcoming-deadlines'; // upcoming-deadlines, upcoming-events, past, all

// The repo owner's github username allowed to edit
const ADMIN_GITHUB_USERNAME = 'tarudesu';

// Event Listeners - Auth
logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Sign out error", error);
    }
});

// Close Auth Modal
closeAuthModalBtn.addEventListener('click', () => {
    adminLoginModal.classList.add('hidden');
    authStatusMessage.classList.add('hidden');
    authStatusMessage.textContent = '';
    document.body.style.overflow = '';
});

// Auth Login trigger via direct user click (avoids browser popup blocker)
authLoginBtn.addEventListener('click', async () => {
    try {
        authStatusMessage.classList.add('hidden');
        authStatusMessage.textContent = '';
        
        const originalText = authLoginBtn.innerHTML;
        authLoginBtn.textContent = "Authenticating...";
        authLoginBtn.disabled = true;
        await setPersistence(auth, browserLocalPersistence);
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Login error", error);
        authStatusMessage.textContent = "Failed to login: " + error.message;
        authStatusMessage.className = "auth-status-message error";
        authStatusMessage.classList.remove('hidden');
    } finally {
        authLoginBtn.disabled = false;
        authLoginBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
            </svg>
            Authorize with GitHub
        `;
    }
});

// Check for login query parameter
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('login') && urlParams.get('login') === 'true') {
    // Clean the URL query params without reloading
    const newUrl = window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);
    
    // Show the auth modal overlay to prompt the user to click the button
    adminLoginModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const githubUsername = user.reloadUserInfo?.screenName || user.displayName || "";
        const email = user.email || "";
        const uid = user.uid || "";

        console.log("Logged in user details:", {
            screenName: user.reloadUserInfo?.screenName,
            displayName: user.displayName,
            email: email,
            uid: uid
        });
        
        // Enforce admin username matching (checking both screenName and displayName case-insensitively)
        const usernameClean = githubUsername.trim().toLowerCase();
        const displayNameClean = user.displayName ? user.displayName.replace(/\s+/g, '').toLowerCase() : '';
        const adminClean = ADMIN_GITHUB_USERNAME.toLowerCase();

        const isAuthorized = usernameClean === adminClean || displayNameClean === adminClean;

        if (!isAuthorized) {
            const errorMsg = `Access Denied: Logged in as "${githubUsername || user.displayName}". Expected admin "${ADMIN_GITHUB_USERNAME}".`;
            alert(errorMsg); // Add alert so it's impossible to miss
            
            authStatusMessage.textContent = errorMsg;
            authStatusMessage.className = "auth-status-message error";
            authStatusMessage.classList.remove('hidden');
            
            adminLoginModal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
            
            await signOut(auth);
            return;
        }

        // Close admin login modal and clear status
        adminLoginModal.classList.add('hidden');
        authStatusMessage.classList.add('hidden');
        authStatusMessage.textContent = '';
        document.body.style.overflow = '';

        isAdmin = true;
        adminControls.classList.remove('hidden');
        renderConferences(); // re-render to show delete buttons
    } else {
        isAdmin = false;
        adminControls.classList.add('hidden');
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
    editingId = null;
    document.getElementById('saveConferenceBtn').textContent = 'Save';
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
        else if (extract(trimmed, 'Mode') !== null) data.mode = extract(trimmed, 'Mode');
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
    if (data.mode) {
        const m = data.mode.toLowerCase();
        if (m.includes('in-person') || m.includes('in person')) document.getElementById('confMode').value = 'In-person';
        else if (m.includes('hybrid')) document.getElementById('confMode').value = 'Hybrid';
        else if (m.includes('virtual') || m.includes('online')) document.getElementById('confMode').value = 'Virtual';
        else document.getElementById('confMode').value = 'TBD';
    } else {
        document.getElementById('confMode').value = 'In-person';
    }
    if (data.eventDate) document.getElementById('confEventDate').value = data.eventDate;
    if (data.url) document.getElementById('confUrl').value = data.url;
    
    if (data.ranking) {
        const r = data.ranking.trim().toUpperCase();
        const select = document.getElementById('confRanking');
        let matched = false;
        for (let i = 0; i < select.options.length; i++) {
            if (r.includes(select.options[i].value.toUpperCase())) {
                select.selectedIndex = i;
                matched = true;
                break;
            }
        }
        if (!matched && r.includes('SCOPUS')) select.value = 'Scopus';
        else if (!matched) select.value = 'Unranked';
    } else {
        document.getElementById('confRanking').value = 'Unranked';
    }
    
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
    const mode = document.getElementById('confMode').value;
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
        mode,
        eventDate,
        url,
        abstractDeadline,
        deadline,
        timezone,
        createdAt: new Date().toISOString()
    };

    try {
        if (editingId) {
            await updateDoc(doc(db, "conferences", editingId), newConf);
        } else {
            await addDoc(collection(db, "conferences"), newConf);
        }
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
    updateRankingFilterOptions();
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
window.deleteConference = deleteConference;

async function editConference(id) {
    if (!isAdmin) return;
    const conf = conferences.find(c => c.id === id);
    if (!conf) return;

    editingId = id;
    
    document.getElementById('confName').value = conf.name || '';
    document.getElementById('confRanking').value = conf.ranking || '';
    document.getElementById('confAbbr').value = conf.abbr || '';
    document.getElementById('confLocation').value = conf.location || '';
    document.getElementById('confMode').value = conf.mode || 'In-person';
    document.getElementById('confEventDate').value = conf.eventDate || '';
    document.getElementById('confUrl').value = conf.url || '';
    document.getElementById('confAbstractDate').value = conf.abstractDeadline || '';
    document.getElementById('confDate').value = conf.deadline || '';
    document.getElementById('confTimezone').value = conf.timezone || 'AoE';

    document.getElementById('saveConferenceBtn').textContent = 'Update Deadline';

    modalOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    tabManual.click();
}
window.editConference = editConference;

function updateRankingFilterOptions() {
    const currentVal = rankFilter.value;
    const uniqueRanks = [...new Set(conferences.map(c => c.ranking).filter(r => r))].sort();
    
    let optionsHtml = '<option value="All">All Rankings</option>';
    uniqueRanks.forEach(rank => {
        optionsHtml += `<option value="${rank}">${rank}</option>`;
    });
    
    rankFilter.innerHTML = optionsHtml;
    if (uniqueRanks.includes(currentVal)) {
        rankFilter.value = currentVal;
    }
}

searchInput.addEventListener('input', renderConferences);
rankFilter.addEventListener('change', renderConferences);
const showOldCheck = document.getElementById('showOldCheck');
if (showOldCheck) showOldCheck.addEventListener('change', renderConferences);

mainTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        mainTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentTab = tab.dataset.tab;
        renderConferences();
    });
});

function parseEventDate(dateString) {
    if (!dateString) return NaN;
    
    let cleanStr = dateString.replace(/-(\d{1,2})\b/g, ''); // strip ranges like "18-22" -> "18"
    cleanStr = cleanStr.replace(/\b(\d+)(st|nd|rd|th)\b/gi, '$1');
    let ts = Date.parse(cleanStr);
    if (!isNaN(ts)) return ts;
    
    const yearMatch = dateString.match(/\b(20\d{2})\b/);
    const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear(); // default to current year
    
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let monthIdx = -1;
    for (let i = 0; i < 12; i++) {
        if (dateString.toLowerCase().includes(months[i].toLowerCase())) {
            monthIdx = i;
            break;
        }
    }
    
    if (monthIdx === -1) {
        const isoMatch = dateString.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
        if (isoMatch) {
            return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2])-1, parseInt(isoMatch[3])).getTime();
        }
        return NaN;
    }
    
    const dayMatch = dateString.match(/\b(\d{1,2})\b/);
    const day = dayMatch ? parseInt(dayMatch[1]) : 1;
    return new Date(year, monthIdx, day).getTime();
}

let isMobileLayout = window.innerWidth <= 900;
window.addEventListener('resize', () => {
    if ((window.innerWidth <= 900) !== isMobileLayout) {
        isMobileLayout = window.innerWidth <= 900;
        renderConferences();
    }
});

function renderConferences() {
    const searchTerm = (searchInput.value || '').toLowerCase();
    const selectedRank = rankFilter.value;
    const showOldCheck = document.getElementById('showOldCheck');
    const showOld = showOldCheck ? showOldCheck.checked : false;
    const showOldToggle = document.getElementById('showOldToggle');
    
    if (showOldToggle) {
        showOldToggle.style.display = (currentTab === 'past' || currentTab === 'all') ? 'flex' : 'none';
    }

    const now = new Date().getTime();
    const sixMonthsAgo = now - (180 * 24 * 60 * 60 * 1000);

    let filtered = conferences.filter(conf => {
        const matchSearch = (conf.name && conf.name.toLowerCase().includes(searchTerm)) || 
                            (conf.abbr && conf.abbr.toLowerCase().includes(searchTerm));
        const matchRank = selectedRank === 'All' || conf.ranking === selectedRank;
        
        if (!matchSearch || !matchRank) return false;

        const deadlineUtc = getUtcTimestamp(conf.deadline, conf.timezone || 'AoE') || 0;
        let eventUtc = parseEventDate(conf.eventDate);
        if (isNaN(eventUtc)) eventUtc = deadlineUtc;

        if (currentTab === 'upcoming-deadlines') {
            return deadlineUtc >= now;
        } else if (currentTab === 'upcoming-events') {
            return eventUtc >= now;
        } else if (currentTab === 'past') {
            if (deadlineUtc >= now) return false;
            if (!showOld && deadlineUtc < sixMonthsAgo && eventUtc < sixMonthsAgo) return false;
            return true;
        } else if (currentTab === 'all') {
            if (!showOld && deadlineUtc < sixMonthsAgo && eventUtc < sixMonthsAgo) return false;
            return true;
        }
        return true;
    });

    if (currentTab === 'upcoming-deadlines') {
        filtered.sort((a, b) => (getUtcTimestamp(a.deadline, a.timezone || 'AoE') || 0) - (getUtcTimestamp(b.deadline, b.timezone || 'AoE') || 0));
    } else if (currentTab === 'upcoming-events') {
        filtered.sort((a, b) => {
            let ea = parseEventDate(a.eventDate); if(isNaN(ea)) ea = getUtcTimestamp(a.deadline, a.timezone || 'AoE') || 0;
            let eb = parseEventDate(b.eventDate); if(isNaN(eb)) eb = getUtcTimestamp(b.deadline, b.timezone || 'AoE') || 0;
            return ea - eb;
        });
    } else {
        filtered.sort((a, b) => (getUtcTimestamp(b.deadline, b.timezone || 'AoE') || 0) - (getUtcTimestamp(a.deadline, a.timezone || 'AoE') || 0));
    }
    
    let listToRender = filtered;

    totalCount.textContent = listToRender.length;

    if (listToRender.length === 0) {
        conferencesList.innerHTML = '';
        if (conferences.length > 0) {
            emptyState.querySelector('p').textContent = 'No matching deadlines';
            emptyState.querySelector('span').textContent = 'Try adjusting your search or tabs.';
        } else {
            emptyState.querySelector('p').textContent = 'No deadlines tracked';
            emptyState.querySelector('span').textContent = 'Click "New Deadline" to add your first conference.';
        }
        conferencesList.appendChild(emptyState);
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    conferencesList.innerHTML = '';

    const createConferenceElement = (conf, isCompact, index) => {
        const item = document.createElement('div');
        item.className = isCompact ? 'list-item compact' : 'list-item';
        item.dataset.id = conf.id;
        
        let targetUtc = getUtcTimestamp(conf.deadline, conf.timezone || 'AoE');
        let displayDateStr = formatNominalDate(conf.deadline);
        
        if (currentTab === 'upcoming-events') {
            let eUtc = parseEventDate(conf.eventDate);
            if (!isNaN(eUtc)) {
                targetUtc = eUtc;
                displayDateStr = conf.eventDate;
            }
        }
        
        item.dataset.deadlineUtc = targetUtc;
        
        if (conf.abstractDeadline) {
            const abstractUtc = getUtcTimestamp(conf.abstractDeadline, conf.timezone || 'AoE');
            item.dataset.abstractUtc = abstractUtc;
        }
        
        item.style.animationDelay = `${index * 0.05}s`;

        const tzLabel = conf.timezone === 'AoE' ? 'AoE' : (conf.timezone === 'UTC' ? 'UTC' : (conf.timezone === 'Local' ? 'Local' : conf.timezone));

        const isSpecialRank = conf.ranking && (conf.ranking.toUpperCase().includes('A*') || conf.ranking.toUpperCase().includes('CCF A') || conf.ranking.toUpperCase() === 'A');
        const rankingClass = isSpecialRank ? 'ranking-badge special' : 'ranking-badge';
        const rankingHTML = conf.ranking ? `
            <span class="${rankingClass}">
                ${conf.ranking} 
            </span>
        ` : '';

        const abstractHTML = `
            <div class="meta-row">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <span>Abs: <strong>${conf.abstractDeadline ? formatNominalDate(conf.abstractDeadline) : 'None'}</strong>${conf.abstractDeadline ? ' <span class="sub-timer-val abstract-timer"></span>' : ''}</span>
            </div>
        `;

        const displayMode = conf.mode || 'In-person';
        const modeText = conf.location ? ` &bull; Mode: <strong>${displayMode}</strong>` : `Mode: <strong>${displayMode}</strong>`;
        const hasLocOrMode = conf.location || displayMode;
        
        const locationHTML = hasLocOrMode ? `
            <div class="meta-row">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <span>${conf.location ? `Loc: <strong>${conf.location}</strong>` : ''}${modeText}</span>
            </div>
        ` : '';

        let eventDateHTML = conf.eventDate ? `
            <div class="meta-row">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <span>Date: <strong>${conf.eventDate}</strong></span>
            </div>
        ` : '';

        let mainTimerLabel = 'Submission Deadline';

        if (currentTab === 'upcoming-events') {
            mainTimerLabel = 'Conference Date';
            eventDateHTML = `
            <div class="meta-row">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <span>Submission: <strong>${formatNominalDate(conf.deadline)}</strong> <span class="sub-timer-val sub-deadline-timer"></span></span>
            </div>
            `;
            
            item.dataset.trueDeadlineUtc = getUtcTimestamp(conf.deadline, conf.timezone || 'AoE');
        }

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
        const editBtnClass = isAdmin ? "icon-btn edit" : "icon-btn edit hidden";

        const editHTML = `
            <button class="${editBtnClass}" onclick="editConference('${conf.id}')" title="Edit">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
            </button>
        `;

        item.innerHTML = `
            <div class="item-left">
                <div class="item-title-row">
                    <span class="item-abbr">${conf.abbr}</span>
                    ${rankingHTML}
                </div>
                <div class="item-name">${conf.name}</div>
                <div class="item-meta-stacked">
                    ${locationHTML}
                    ${eventDateHTML}
                    ${abstractHTML}
                </div>
            </div>
            <div class="item-right">
                <div class="deadline-label">
                    ${mainTimerLabel} <span class="tz-label">(${tzLabel})</span>
                </div>
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
                <div class="deadline-date">
                    ${displayDateStr}
                    <span class="passed-flag hidden" style="color: var(--accent-danger); font-weight: 700; margin-left: 0.25rem;">(Passed)</span>
                </div>
                <div class="item-actions">
                    ${urlHTML}
                    ${editHTML}
                    <button class="${deleteBtnClass}" onclick="deleteConference('${conf.id}')" title="Remove">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        return item;
    };

    let hasHero = false;

    // Output top item as hero if not strictly on "Past" tab
    if (currentTab !== 'past' && listToRender.length > 0) {
        // Find the first upcoming conference to be the hero
        const topItem = listToRender[0];
        const deadlineUtc = getUtcTimestamp(topItem.deadline, topItem.timezone || 'AoE') || 0;
        let eventUtc = parseEventDate(topItem.eventDate);
        if (isNaN(eventUtc)) eventUtc = deadlineUtc;

        const isFuture = currentTab === 'upcoming-events' ? eventUtc >= now : deadlineUtc >= now;
        
        if (isFuture || currentTab === 'all') {
            const heroEl = createConferenceElement(topItem, isMobileLayout, 0);
            conferencesList.appendChild(heroEl);
            listToRender = listToRender.slice(1);
            hasHero = true;
        }
    }

    if (listToRender.length > 0) {
        const grid = document.createElement('div');
        grid.className = 'conferences-grid';
        if (hasHero) {
            grid.style.marginTop = '1.25rem';
        }
        
        listToRender.forEach((conf, i) => {
            const compactEl = createConferenceElement(conf, true, i + (hasHero ? 1 : 0));
            grid.appendChild(compactEl);
        });
        
        conferencesList.appendChild(grid);
    }

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

        const passedFlag = item.querySelector('.passed-flag');

        if (distance < 0) {
            daysEl.textContent = '00';
            hoursEl.textContent = '00';
            minsEl.textContent = '00';
            secsEl.textContent = '00';
            item.classList.remove('danger', 'warning', 'success');
            item.classList.add('expired');
            if (passedFlag) passedFlag.classList.remove('hidden');
        } else {
            if (passedFlag) passedFlag.classList.add('hidden');
            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            daysEl.textContent = days.toString().padStart(2, '0');
            hoursEl.textContent = hours.toString().padStart(2, '0');
            minsEl.textContent = minutes.toString().padStart(2, '0');
            secsEl.textContent = seconds.toString().padStart(2, '0');

            item.classList.remove('expired', 'danger', 'warning', 'success');
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
        
        if (!isNaN(abstractUtc) && abstractTimerEl) {
            const absDistance = abstractUtc - now;
            if (absDistance < 0) {
                abstractTimerEl.textContent = '(Passed)';
                abstractTimerEl.style.color = 'var(--accent-danger)';
            } else {
                const absDays = Math.floor(absDistance / (1000 * 60 * 60 * 24));
                const absHours = Math.floor((absDistance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const absMinutes = Math.floor((absDistance % (1000 * 60 * 60)) / (1000 * 60));
                const absSeconds = Math.floor((absDistance % (1000 * 60)) / 1000);
                
                abstractTimerEl.textContent = `(in ${absDays}d ${absHours.toString().padStart(2, '0')}h ${absMinutes.toString().padStart(2, '0')}m ${absSeconds.toString().padStart(2, '0')}s)`;
                abstractTimerEl.style.color = 'var(--text-tertiary)';
            }
        }
        // Handle Sub Deadline Countdown for Events tab
        const trueDeadlineUtc = parseInt(item.dataset.trueDeadlineUtc);
        const subDeadlineTimerEl = item.querySelector('.sub-deadline-timer');
        
        if (!isNaN(trueDeadlineUtc) && subDeadlineTimerEl) {
            const subDistance = trueDeadlineUtc - now;
            if (subDistance < 0) {
                subDeadlineTimerEl.textContent = '(Passed)';
                subDeadlineTimerEl.style.color = 'var(--accent-danger)';
            } else {
                const subDays = Math.floor(subDistance / (1000 * 60 * 60 * 24));
                const subHours = Math.floor((subDistance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const subMinutes = Math.floor((subDistance % (1000 * 60 * 60)) / (1000 * 60));
                const subSeconds = Math.floor((subDistance % (1000 * 60)) / 1000);
                
                subDeadlineTimerEl.textContent = `(in ${subDays}d ${subHours.toString().padStart(2, '0')}h ${subMinutes.toString().padStart(2, '0')}m ${subSeconds.toString().padStart(2, '0')}s)`;
                subDeadlineTimerEl.style.color = 'var(--text-tertiary)';
            }
        }
    });
}
