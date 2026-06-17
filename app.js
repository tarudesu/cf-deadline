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
        
        // Optionally enforce admin username matching:
        // if (githubUsername && githubUsername.toLowerCase() !== ADMIN_GITHUB_USERNAME.toLowerCase()) {
        //     alert("You are not authorized as admin.");
        //     await signOut(auth);
        //     return;
        // }

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
};

closeModalBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);

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

conferenceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    const name = document.getElementById('confName').value.trim();
    const abbr = document.getElementById('confAbbr').value.trim();
    const location = document.getElementById('confLocation').value.trim();
    const dateStr = document.getElementById('confDate').value;
    const url = document.getElementById('confUrl').value.trim();

    const newConf = {
        name,
        abbr,
        location,
        deadline: dateStr,
        url,
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
    countdownInterval = setInterval(updateAllCountdowns, 1000);
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
            daysEl.textContent = '00';
            hoursEl.textContent = '00';
            minsEl.textContent = '00';
            secsEl.textContent = '00';
            item.className = 'list-item expired';
            return;
        }

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
    });
}
