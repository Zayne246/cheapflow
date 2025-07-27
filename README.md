# Calendar Agent

A simple app that scans Gmail and Outlook for calendar invites and automatically adds them to Google Calendar.

## How it works

1. **Sign in** with Google (Firebase) or Microsoft
2. **Tap "Scan Emails"** to scan both Gmail and Outlook for calendar invites
3. **Automatically adds** found invites to your Google Calendar

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up Firebase:
- Go to [Firebase Console](https://console.firebase.google.com/)
- Create a new project
- Enable Authentication (Google provider)
- Enable Gmail API and Google Calendar API in Google Cloud Console
- Download service account key and get web app config

3. Set up Microsoft OAuth (for Outlook access):
- Go to [Azure Portal](https://portal.azure.com/)
- Register a new application
- Add `http://localhost:3000/auth/microsoft/callback` to redirect URIs
- Get client ID and secret

4. Create `.env` file:
```
# Firebase Configuration
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_WEB_API_KEY=your_web_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_STORAGE_BUCKET=your_project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id

# Microsoft OAuth (for Outlook)
MICROSOFT_CLIENT_ID=your_microsoft_client_id
MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret

# Server Configuration
PORT=3000
```

5. Start the app:
```bash
npm start
```

6. Open http://localhost:3000 and sign in!

## Features

- ✅ Firebase Authentication for Google services
- ✅ Microsoft OAuth for Outlook access
- ✅ Scan Gmail for calendar invites
- ✅ Scan Outlook for calendar invites  
- ✅ Parse .ics attachments
- ✅ Add events to Google Calendar
- ✅ Modern, responsive UI
- ✅ Real-time scanning results

## Architecture

- **Google Services**: Firebase Authentication + Google API keys
- **Microsoft Services**: OAuth 2.0 for Graph API access
- **Email Scanning**: Gmail API + Microsoft Graph API
- **Calendar**: Google Calendar API