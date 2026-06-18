# Conference Deadline Tracker

A sleek, modern, and responsive web application designed to help researchers track academic conference deadlines, abstract due dates, and event schedules. Built with Vanilla JavaScript and Firebase, it features real-time countdowns, timezone handling (AoE, UTC, Local), and a clean administrative interface for managing entries.

## Features

- **Real-Time Countdowns**: Accurately track time remaining until conference deadlines and abstract submissions.
- **Timezone Intelligence**: Natively handles Anywhere on Earth (AoE), UTC, and Local timezones to prevent last-minute submission panic.
- **Smart Categorization**: Automatically categorizes conferences into Upcoming Deadlines, Upcoming Events, and Past deadlines.
- **Search & Filter**: Quickly find specific venues or filter by academic ranking (e.g., CORE A*, CCF A).
- **Calendar View**: A visual, dense calendar grid to get a bird's-eye view of your month.
- **Admin Dashboard**: Secure authentication via GitHub (Firebase Auth) allows authorized users to add, edit, and delete conferences.
- **Smart Import**: Easily add new conferences by importing JSON or using an LLM-friendly Markdown extraction prompt.

## Tech Stack

- **Frontend**: HTML5, CSS3 (Vanilla), JavaScript (ES6+)
- **Backend & Database**: Firebase Firestore (Realtime NoSQL)
- **Authentication**: Firebase Auth (GitHub Provider)
- **Hosting**: GitHub Pages / Firebase Hosting (configurable)

## Setup & Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/tarudesu/cf-deadline.git
   cd cf-deadline
   ```

2. **Configure Firebase:**
   - Create a project in the [Firebase Console](https://console.firebase.google.com/).
   - Enable **Firestore** and set up the security rules using the provided `firestore.rules`.
   - Enable **Authentication** (specifically the GitHub provider).
   - Update the `firebaseConfig` object at the top of `app.js` with your Firebase project credentials.

3. **Run Locally:**
   You can serve the directory using any local web server. For example, using Python:
   ```bash
   python -m http.server 8000
   ```
   Then navigate to `http://localhost:8000` in your browser.

## Admin Configuration

To restrict editing capabilities, the app checks the authenticated user's GitHub username against an authorized list. 

In `app.js`, locate and update the following constant to your own GitHub username:
```javascript
const ADMIN_GITHUB_USERNAME = 'your-github-username';
```

## Security

The application sanitizes all user-provided data before injecting it into the DOM to mitigate Cross-Site Scripting (XSS) vulnerabilities. Firestore rules strictly validate that only authenticated administrators can mutate the database, while read access is open to the public.

## License

This project is licensed under the MIT License.
