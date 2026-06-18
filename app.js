import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot, query, orderBy, writeBatch, getDocs, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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
const tabJson = document.getElementById('tabJson');
const manualFormSection = document.getElementById('manualFormSection');
const markdownImportSection = document.getElementById('markdownImportSection');
const jsonImportSection = document.getElementById('jsonImportSection');
const copyPromptBtn = document.getElementById('copyPromptBtn');
const promptTemplate = document.getElementById('promptTemplate');
const markdownInput = document.getElementById('markdownInput');
const cancelMarkdownBtn = document.getElementById('cancelMarkdownBtn');
const parseMarkdownBtn = document.getElementById('parseMarkdownBtn');

// JSON elements
const jsonFileInput = document.getElementById('jsonFileInput');
const jsonInput = document.getElementById('jsonInput');
const cancelJsonBtn = document.getElementById('cancelJsonBtn');
const importJsonBtn = document.getElementById('importJsonBtn');

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

        // Log the auth token so we can debug Firestore rules
        try {
            const idTokenResult = await user.getIdTokenResult();
            console.log('Firebase Auth Token Claims:', JSON.stringify(idTokenResult.claims, null, 2));
            console.log('Auth UID:', user.uid);
        } catch (tokenErr) {
            console.warn('Could not fetch ID token for debugging:', tokenErr);
        }

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
    if (tabMarkdown) tabMarkdown.click();
};

closeModalBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);
// Markdown Cancel Button
cancelMarkdownBtn.addEventListener('click', closeModal);

// JSON Cancel Button
if (cancelJsonBtn) {
    cancelJsonBtn.addEventListener('click', closeModal);
}

// JSON File Input Handler
const jsonDropZone = document.getElementById('jsonDropZone');
const jsonDropText = document.getElementById('jsonDropText');

function handleJsonFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        jsonInput.value = event.target.result;
        if (jsonDropText) jsonDropText.textContent = `Loaded: ${file.name}`;
    };
    reader.readAsText(file);
}

if (jsonFileInput) {
    jsonFileInput.addEventListener('change', (e) => handleJsonFile(e.target.files[0]));
}

if (jsonDropZone) {
    jsonDropZone.addEventListener('click', () => jsonFileInput.click());
    
    jsonDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        jsonDropZone.classList.add('dragover');
    });
    
    jsonDropZone.addEventListener('dragleave', () => {
        jsonDropZone.classList.remove('dragover');
    });
    
    jsonDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        jsonDropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            handleJsonFile(e.dataTransfer.files[0]);
        }
    });
}

// JSON Import Logic
if (importJsonBtn) {
    importJsonBtn.addEventListener('click', async () => {
        const rawJson = jsonInput.value.trim();
        if (!rawJson) {
            alert('Please paste some JSON or select a file.');
            return;
        }

        try {
            const data = JSON.parse(rawJson);
            const items = Array.isArray(data) ? data : [data];
            
            let importCount = 0;
            
            for (const item of items) {
                // Ensure minimal fields exist, mainly just an ID and Name/Abbr
                if (!item.name && !item.abbr) continue;
                
                const confData = {
                    id: item.id || crypto.randomUUID(),
                    name: item.name || '',
                    abbr: item.abbr || '',
                    location: item.location || '',
                    mode: item.mode || 'In-person',
                    ranking: item.ranking || 'Unranked',
                    date: item.date || item.eventDate || '',
                    date_end: item.date_end || item.eventEnd || item.date || item.eventDate || '',
                    url: item.url || '',
                    abstract_deadline: item.abstract_deadline || item.abstractDeadline || '',
                    deadline: item.deadline || '',
                    timezone: item.timezone || 'AoE'
                };
                
                // Duplicate check by Abbr
                const isDuplicate = conferences.some(c => 
                    c.abbr && confData.abbr && c.abbr.toLowerCase() === confData.abbr.toLowerCase()
                );
                
                if (isDuplicate) {
                    console.warn(`Skipping duplicate abbreviation: ${confData.abbr}`);
                    continue;
                }
                
                await addDoc(collection(db, "conferences"), confData);
                conferences.push(confData);
                importCount++;
            }
            
            if (importCount > 0) {
                renderConferences();
                closeModal();
                alert(`Successfully imported ${importCount} conference(s)!`);
            } else {
                alert('No valid or unique conferences found to import.');
            }
        } catch (e) {
            console.error(e);
            alert('Invalid JSON format. Please check your data.');
        }
    });
}

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
    if (tabJson) tabJson.classList.remove('active');
    
    manualFormSection.classList.remove('hidden');
    markdownImportSection.classList.add('hidden');
    if (jsonImportSection) jsonImportSection.classList.add('hidden');
});

tabMarkdown.addEventListener('click', () => {
    tabMarkdown.classList.add('active');
    tabManual.classList.remove('active');
    if (tabJson) tabJson.classList.remove('active');
    
    markdownImportSection.classList.remove('hidden');
    manualFormSection.classList.add('hidden');
    if (jsonImportSection) jsonImportSection.classList.add('hidden');
});

if (tabJson) {
    tabJson.addEventListener('click', () => {
        tabJson.classList.add('active');
        tabManual.classList.remove('active');
        tabMarkdown.classList.remove('active');
        
        jsonImportSection.classList.remove('hidden');
        manualFormSection.classList.add('hidden');
        markdownImportSection.classList.add('hidden');
    });
}

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
    if (data.eventDate) {
        let start = '', end = '';
        if (data.eventDate.includes('to')) {
            const parts = data.eventDate.split('to');
            start = parts[0].trim();
            end = parts[1].trim();
        } else {
            start = data.eventDate.trim();
        }
        if (start && start.length === 10) start += 'T00:00';
        if (end && end.length === 10) end += 'T00:00';
        const startEl = document.getElementById('confEventStart');
        const endEl = document.getElementById('confEventEnd');
        if (startEl && start) startEl.value = start;
        if (endEl && end) endEl.value = end;
    }
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
    const eventStart = document.getElementById('confEventStart').value;
    const eventEnd = document.getElementById('confEventEnd').value;
    const url = document.getElementById('confUrl').value.trim();
    const abstractDeadline = document.getElementById('confAbstractDate').value;
    const deadline = document.getElementById('confDate').value;
    const timezone = document.getElementById('confTimezone').value;

    if (!abbr) {
        alert("Abbreviation is required!");
        return;
    }

    const isDuplicate = conferences.some(c => 
        c.abbr && c.abbr.toLowerCase() === abbr.toLowerCase() && 
        c.id !== editingId
    );

    if (isDuplicate) {
        alert(`A conference with the abbreviation "${abbr}" already exists!`);
        return;
    }

    const newConf = {
        name,
        ranking,
        abbr,
        location,
        mode,
        eventStart,
        eventEnd,
        eventDate: '',
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
    
    // Auto-sync calendar if it is the active tab
    if (currentTab === 'calendar' && typeof renderCalendar === 'function') {
        renderCalendar();
    }
    
    if (!countdownInterval) {
        startCountdownTimer();
    }
});

// Functions - UI
function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function deleteConference(id) {
    if (!isAdmin) return;
    if (confirm('Are you sure you want to remove this deadline?')) {
        try {
            console.log(`Deleting conference with id: ${id}`);
            await deleteDoc(doc(db, "conferences", id));
            
            // CRITICAL: Verify the delete actually persisted on the server.
            // Firestore SDK applies deletes optimistically to local cache and
            // does NOT throw even if security rules deny the write. The doc
            // just silently reappears via onSnapshot when the server rejects it.
            // So we must read it back to confirm.
            const verifySnap = await getDoc(doc(db, "conferences", id));
            if (verifySnap.exists()) {
                console.error('DELETE FAILED: Document still exists on server after deleteDoc!', id);
                alert('Delete failed — the document still exists on the server.\n\nThis usually means your Firestore Security Rules do not allow deletes. Please check the rules in the Firebase Console.');
            } else {
                console.log(`Delete verified: document ${id} no longer exists on server.`);
            }
        } catch (error) {
            console.error("Error deleting document (full object): ", error);
            const errCode = error.code || "Unknown";
            const errMsg = error.message || "No error message provided";
            alert(`Failed to delete conference:\n${errCode} — ${errMsg}`);
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
    document.getElementById('confEventStart').value = conf.eventStart || '';
    document.getElementById('confEventEnd').value = conf.eventEnd || '';
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

const conferencesListEl = document.getElementById('conferencesList');
const calendarViewEl = document.getElementById('calendarView');
const filtersBarEl = document.querySelector('.filters-bar');

mainTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        mainTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentTab = tab.dataset.tab;
        
        if (currentTab === 'calendar') {
            conferencesListEl.classList.add('hidden');
            filtersBarEl.classList.add('hidden');
            calendarViewEl.classList.remove('hidden');
            
            // Re-render calendar to ensure it's up to date
            if (typeof renderCalendar === 'function') {
                renderCalendar();
            }
        } else {
            calendarViewEl.classList.add('hidden');
            conferencesListEl.classList.remove('hidden');
            filtersBarEl.classList.remove('hidden');
            renderConferences();
        }
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
    const exportDataBtn = document.getElementById('exportDataBtn');
    const addCalendarBtn = document.getElementById('addCalendarBtn');
    if (exportDataBtn) {
        if (currentTab === 'all') {
            exportDataBtn.classList.remove('hidden');
            if (addCalendarBtn) addCalendarBtn.classList.remove('hidden');
        } else {
            exportDataBtn.classList.add('hidden');
            if (addCalendarBtn) addCalendarBtn.classList.add('hidden');
        }
    }

    const now = new Date().getTime();
    const sixMonthsAgo = now - (180 * 24 * 60 * 60 * 1000);

    let filtered = conferences.filter(conf => {
        const matchSearch = (conf.name && conf.name.toLowerCase().includes(searchTerm)) || 
                            (conf.abbr && conf.abbr.toLowerCase().includes(searchTerm));
        const matchRank = selectedRank === 'All' || conf.ranking === selectedRank;
        
        if (!matchSearch || !matchRank) return false;

        const deadlineUtc = getUtcTimestamp(conf.deadline, conf.timezone || 'AoE') || 0;
        let eventUtc;
        if (conf.eventStart) {
            eventUtc = new Date(conf.eventStart).getTime();
        } else {
            eventUtc = parseEventDate(conf.eventDate);
        }
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
        
        let displayEventDate = conf.eventDate || '';
        if (conf.eventStart) {
            let startDt = new Date(conf.eventStart);
            // If it's a simple YYYY-MM-DD string, adding T12:00:00 fixes timezone shifting
            if (!conf.eventStart.includes('T')) {
                startDt = new Date(conf.eventStart + 'T12:00:00');
            }
            
            if (!isNaN(startDt)) {
                const startStr = startDt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                if (conf.eventEnd && conf.eventEnd !== conf.eventStart) {
                    let endDt = new Date(conf.eventEnd);
                    if (!conf.eventEnd.includes('T')) {
                        endDt = new Date(conf.eventEnd + 'T12:00:00');
                    }
                    if (!isNaN(endDt)) {
                        const endStr = endDt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                        if (startDt.getFullYear() === endDt.getFullYear() && startDt.getMonth() === endDt.getMonth()) {
                            displayEventDate = `${startDt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}-${endDt.getDate()}, ${endDt.getFullYear()}`;
                        } else {
                            displayEventDate = `${startStr} - ${endStr}`;
                        }
                    } else {
                        displayEventDate = startStr;
                    }
                } else {
                    displayEventDate = startStr;
                }
            }
        }
        
        if (currentTab === 'upcoming-events') {
            if (conf.eventStart) {
                targetUtc = new Date(conf.eventStart).getTime();
                displayDateStr = displayEventDate;
            } else {
                let eUtc = parseEventDate(conf.eventDate);
                if (!isNaN(eUtc)) {
                    targetUtc = eUtc;
                    displayDateStr = displayEventDate;
                }
            }
        }
        
        item.dataset.deadlineUtc = targetUtc;
        
        if (conf.abstractDeadline) {
            const abstractUtc = getUtcTimestamp(conf.abstractDeadline, conf.timezone || 'AoE');
            item.dataset.abstractUtc = abstractUtc;
        }
        
        item.style.animationDelay = `${index * 0.05}s`;

        const tzLabel = conf.timezone === 'AoE' ? 'AoE' : (conf.timezone === 'UTC' ? 'UTC' : (conf.timezone === 'Local' ? 'Local' : conf.timezone));

        const safeRanking = escapeHTML(conf.ranking);
        const isSpecialRank = safeRanking && (safeRanking.toUpperCase().includes('A*') || safeRanking.toUpperCase().includes('CCF A') || safeRanking.toUpperCase() === 'A');
        const rankingClass = isSpecialRank ? 'ranking-badge special' : 'ranking-badge';
        const rankingHTML = safeRanking ? `
            <span class="${rankingClass}">
                ${safeRanking} 
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

        const safeLocation = escapeHTML(conf.location);
        const safeMode = escapeHTML(conf.mode || 'In-person');
        const modeText = safeLocation ? ` &bull; Mode: <strong>${safeMode}</strong>` : `Mode: <strong>${safeMode}</strong>`;
        const hasLocOrMode = safeLocation || safeMode;
        
        const locationHTML = hasLocOrMode ? `
            <div class="meta-row">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <span>${safeLocation ? `Loc: <strong>${safeLocation}</strong>` : ''}${modeText}</span>
            </div>
        ` : '';

        let eventDateHTML = displayEventDate ? `
            <div class="meta-row">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <span>Date: <strong>${displayEventDate}</strong></span>
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

        const safeUrl = escapeHTML(conf.url);
        const urlHTML = safeUrl ? `
            <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="icon-btn" title="Visit Website">
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

        const safeAbbr = escapeHTML(conf.abbr);
        const safeName = escapeHTML(conf.name);
        
        item.innerHTML = `
            <div class="item-left">
                <div class="item-title-row">
                    <span class="item-abbr">${safeAbbr}</span>
                    ${rankingHTML}
                </div>
                <div class="item-name">${safeName}</div>
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
                    <span class="passed-flag hidden" style="color: var(--accent-danger);">(Passed)</span>
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
        let eventUtc;
        if (topItem.eventStart) {
            eventUtc = new Date(topItem.eventStart).getTime();
        } else {
            eventUtc = parseEventDate(topItem.eventDate);
        }
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

// --- Calendar View Logic ---
const filterDeadlines = document.getElementById('calFilterDeadlines');
const filterEvents = document.getElementById('calFilterEvents');

if (filterDeadlines) {
    filterDeadlines.addEventListener('change', renderCalendar);
}
if (filterEvents) {
    filterEvents.addEventListener('change', renderCalendar);
}

let fullCalendarInstance = null;

function renderCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;
    
    const showDeadlines = document.getElementById('calFilterDeadlines')?.checked ?? true;
    const showEvents = document.getElementById('calFilterEvents')?.checked ?? true;
    
    const eventsArray = [];
    
    conferences.forEach(conf => {
        if (showDeadlines) {
            if (conf.deadline) {
                eventsArray.push({
                    id: conf.id + '_dl',
                    title: `Submission Deadline: ${conf.abbr || conf.name}`,
                    start: conf.deadline.split('T')[0],
                    classNames: ['fc-custom-deadline'],
                    extendedProps: { type: 'deadline', confId: conf.id }
                });
            }
            if (conf.abstractDeadline) {
                eventsArray.push({
                    id: conf.id + '_abs',
                    title: `Abstract Deadline: ${conf.abbr || conf.name}`,
                    start: conf.abstractDeadline.split('T')[0],
                    classNames: ['fc-custom-deadline'],
                    extendedProps: { type: 'deadline', confId: conf.id }
                });
            }
        }
        
        if (showEvents) {
            if (conf.eventStart) {
                eventsArray.push({
                    id: conf.id + '_ev',
                    title: `Conference Date: ${conf.abbr || conf.name}`,
                    start: conf.eventStart.split('T')[0],
                    end: conf.eventEnd ? new Date(new Date(conf.eventEnd).getTime() + 86400000).toISOString().split('T')[0] : null,
                    classNames: ['fc-custom-event'],
                    extendedProps: { type: 'event', confId: conf.id }
                });
            } else if (conf.eventDate) {
                const ts = parseEventDate(conf.eventDate);
                if (!isNaN(ts)) {
                    const dt = new Date(ts);
                    const yyyy = dt.getFullYear();
                    const mm = String(dt.getMonth() + 1).padStart(2, '0');
                    const dd = String(dt.getDate()).padStart(2, '0');
                    
                    eventsArray.push({
                        id: conf.id + '_ev',
                        title: `Conference Date: ${conf.abbr || conf.name}`,
                        start: `${yyyy}-${mm}-${dd}`,
                        classNames: ['fc-custom-event'],
                        extendedProps: { type: 'event', confId: conf.id }
                    });
                }
            }
        }
    });
    
    if (!fullCalendarInstance) {
        fullCalendarInstance = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            height: 'auto',
            displayEventTime: false,
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,listMonth'
            },
            events: eventsArray,
            eventClick: function(info) {
                const evType = info.event.extendedProps.type;
                const confId = info.event.extendedProps.confId;
                
                let targetTabSelector = '.main-tab[data-tab="all"]';
                if (evType === 'event') {
                    targetTabSelector = '.main-tab[data-tab="upcoming-events"]';
                } else if (evType === 'deadline') {
                    targetTabSelector = '.main-tab[data-tab="upcoming-deadlines"]';
                }
                
                const tabBtn = document.querySelector(targetTabSelector);
                if (tabBtn) tabBtn.click();
                
                setTimeout(() => {
                    const card = document.querySelector(`.list-item[data-id="${confId}"]`);
                    if (card) {
                        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        card.style.transition = 'box-shadow 0.3s';
                        card.style.boxShadow = '0 0 0 4px var(--accent-primary)';
                        setTimeout(() => card.style.boxShadow = '', 1500);
                    }
                }, 100);
            }
        });
        fullCalendarInstance.render();
    } else {
        fullCalendarInstance.removeAllEvents();
        fullCalendarInstance.addEventSource(eventsArray);
    }
}

// --- Export Logic ---
const exportDataBtn = document.getElementById('exportDataBtn');
if (exportDataBtn) {
    exportDataBtn.addEventListener('click', () => {
        const jsonData = JSON.stringify(conferences, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cf_deadline_export.json`;
        a.click();
        URL.revokeObjectURL(url);
    });
}

// --- AoE Clock Logic ---
const aoeClockDisplay = document.getElementById('aoeClockDisplay');
if (aoeClockDisplay) {
    setInterval(() => {
        const now = new Date();
        const aoeTime = new Date(now.getTime() - (12 * 60 * 60 * 1000));
        const yyyy = aoeTime.getUTCFullYear();
        const mo = String(aoeTime.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(aoeTime.getUTCDate()).padStart(2, '0');
        const hh = String(aoeTime.getUTCHours()).padStart(2, '0');
        const mm = String(aoeTime.getUTCMinutes()).padStart(2, '0');
        const ss = String(aoeTime.getUTCSeconds()).padStart(2, '0');
        
        aoeClockDisplay.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 0.2rem;">
                <span style="font-size: 0.75rem; color: var(--text-tertiary); font-weight: 500; line-height: 1;">AoE Date: ${yyyy}-${mo}-${dd}</span>
                <span style="font-size: 1.15rem; color: var(--accent-primary); font-weight: 700; line-height: 1;">${hh}:${mm}:${ss}</span>
            </div>
        `;
    }, 1000);
}

// --- Sync to Google Calendar (ICS Download) ---
const addCalendarBtn = document.getElementById('addCalendarBtn');
if (addCalendarBtn) {
    addCalendarBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (!conferences || conferences.length === 0) {
            alert("No conferences to sync!");
            return;
        }

        let icsContent = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//cf-deadline//EN\r\n";
        
        conferences.forEach(conf => {
            // Event Date
            if (conf.date) {
                // simple parse if YYYY-MM-DD
                let startStr = conf.date.replace(/-/g, '');
                if (startStr.length === 8) {
                    icsContent += "BEGIN:VEVENT\r\n";
                    icsContent += `DTSTART;VALUE=DATE:${startStr}\r\n`;
                    if (conf.date_end) {
                        const endD = new Date(conf.date_end);
                        if (!isNaN(endD.getTime())) {
                            endD.setDate(endD.getDate() + 1); // exclusive end date
                            const endStr = endD.toISOString().split('T')[0].replace(/-/g, '');
                            icsContent += `DTEND;VALUE=DATE:${endStr}\r\n`;
                        }
                    } else {
                        icsContent += `DTEND;VALUE=DATE:${startStr}\r\n`;
                    }
                    icsContent += `SUMMARY:[Event] ${conf.abbr || conf.name}\r\n`;
                    icsContent += `DESCRIPTION:${conf.name}\\nURL: ${conf.url || ''}\r\n`;
                    icsContent += "END:VEVENT\r\n";
                }
            }
            
            // Abstract Deadline
            if (conf.abstract_deadline) {
                const absDate = new Date(conf.abstract_deadline);
                if (!isNaN(absDate.getTime())) {
                    const startStr = absDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                    icsContent += "BEGIN:VEVENT\r\n";
                    icsContent += `DTSTART:${startStr}\r\n`;
                    icsContent += `DTEND:${startStr}\r\n`;
                    icsContent += `SUMMARY:[Abstract Deadline] ${conf.abbr || conf.name}\r\n`;
                    icsContent += `DESCRIPTION:${conf.name}\\nURL: ${conf.url || ''}\r\n`;
                    icsContent += "END:VEVENT\r\n";
                }
            }
            
            // Submission Deadline
            if (conf.deadline) {
                const deadDate = new Date(conf.deadline);
                if (!isNaN(deadDate.getTime())) {
                    const startStr = deadDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                    icsContent += "BEGIN:VEVENT\r\n";
                    icsContent += `DTSTART:${startStr}\r\n`;
                    icsContent += `DTEND:${startStr}\r\n`;
                    icsContent += `SUMMARY:[Deadline] ${conf.abbr || conf.name}\r\n`;
                    icsContent += `DESCRIPTION:${conf.name}\\nURL: ${conf.url || ''}\r\n`;
                    icsContent += "END:VEVENT\r\n";
                }
            }
        });
        
        icsContent += "END:VCALENDAR\r\n";
        
        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'cf-deadlines.ics';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    });
}


