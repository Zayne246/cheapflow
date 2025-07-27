require('dotenv').config();
const express = require('express');
const EmailScanner = require('./email-scanner');
const CalendarWriter = require('./calendar-writer');
const AuthManager = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize components
const emailScanner = new EmailScanner();
const calendarWriter = new CalendarWriter();
const authManager = new AuthManager();

// Store current user (in production, this would be per-session)
let currentUserId = null;
let currentUserAccessToken = null;

app.use(express.json());

// Main scanning function
async function scanAndAddInvites() {
  console.log('🔍 Starting calendar invite scan...');
  
  if (!currentUserId) {
    console.log('❌ No user authenticated. Please sign in first.');
    return { error: 'No user authenticated' };
  }

  try {
    // Get user data
    const userData = await authManager.getUserData(currentUserId);
    if (!userData) {
      console.log('❌ No user data found. Please sign in first.');
      return { error: 'No user data found' };
    }

    console.log(`📧 Scanning for user: ${userData.email}`);
    
    // Scan both Gmail and Outlook
    const invites = await emailScanner.scanAllEmails(currentUserId, authManager, currentUserAccessToken);
    
    if (invites.length === 0) {
      console.log('📭 No new calendar invites found');
      return { message: 'No new calendar invites found', invites: [] };
    }

    console.log(`📅 Found ${invites.length} calendar invites`);

    // Add each invite to Google Calendar
    const results = [];
    for (const invite of invites) {
      try {
        if (currentUserAccessToken) {
          const result = await calendarWriter.addEventToCalendar(invite, currentUserAccessToken);
          if (result) {
            results.push({ invite, success: true });
            console.log(`✅ Added to calendar: "${invite.title}"`);
          } else {
            results.push({ invite, success: false, error: 'Failed to add to calendar' });
          }
        } else {
          results.push({ invite, success: false, error: 'No Google Calendar access' });
        }
      } catch (error) {
        console.error(`❌ Error adding invite "${invite.title}":`, error.message);
        results.push({ invite, success: false, error: error.message });
      }
    }

    return { 
      message: `Processed ${invites.length} invites`, 
      invites: results 
    };
    
  } catch (error) {
    console.error('❌ Error during scan:', error);
    return { error: error.message };
  }
}

// Routes
app.get('/', (req, res) => {
  const isAuthenticated = !!currentUserId;
  const firebaseEnabled = authManager.isFirebaseEnabled();
  const microsoftEnabled = !!process.env.MICROSOFT_CLIENT_ID;
  
  res.send(`
    <html>
      <head>
        <title>Calendar Agent</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white; 
            padding: 40px; 
            border-radius: 20px; 
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          }
          h1 { 
            text-align: center; 
            color: #333; 
            margin-bottom: 30px;
            font-size: 2.5em;
          }
          .status { 
            padding: 20px; 
            margin: 20px 0; 
            border-radius: 10px; 
            text-align: center;
            font-weight: 500;
          }
          .success { background: #d4edda; color: #155724; border: 2px solid #c3e6cb; }
          .warning { background: #fff3cd; color: #856404; border: 2px solid #ffeaa7; }
          .error { background: #f8d7da; color: #721c24; border: 2px solid #f5c6cb; }
          .btn { 
            background: linear-gradient(45deg, #667eea, #764ba2);
            color: white; 
            padding: 15px 30px; 
            border: none; 
            border-radius: 25px; 
            cursor: pointer; 
            margin: 10px; 
            font-size: 16px;
            font-weight: 500;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
          }
          .btn:hover { 
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0,0,0,0.3);
          }
          .btn:disabled { 
            background: #ccc; 
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
          }
          .scan-btn { 
            background: linear-gradient(45deg, #28a745, #20c997);
            font-size: 18px;
            padding: 20px 40px;
            margin: 20px 0;
          }
          .login-buttons {
            display: flex;
            gap: 15px;
            justify-content: center;
            margin: 20px 0;
          }
          .google-btn { background: linear-gradient(45deg, #4285f4, #34a853); }
          .microsoft-btn { background: linear-gradient(45deg, #0078d4, #106ebe); }
          .demo-btn { background: linear-gradient(45deg, #6c757d, #495057); }
          #log { 
            background: #f8f9fa; 
            padding: 20px; 
            border-radius: 10px; 
            max-height: 300px; 
            overflow-y: auto; 
            font-family: 'Monaco', 'Menlo', monospace; 
            font-size: 12px; 
            white-space: pre-wrap;
            border: 1px solid #e9ecef;
            margin-top: 20px;
          }
          .loading {
            display: none;
            text-align: center;
            margin: 20px 0;
          }
          .spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #667eea;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .setup-info {
            background: #e7f3ff;
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
            border-left: 4px solid #0078d4;
          }
          .api-status {
            display: flex;
            gap: 10px;
            justify-content: center;
            margin: 15px 0;
            flex-wrap: wrap;
          }
          .api-badge {
            padding: 5px 10px;
            border-radius: 15px;
            font-size: 12px;
            font-weight: 500;
          }
          .api-enabled { background: #d4edda; color: #155724; }
          .api-disabled { background: #f8d7da; color: #721c24; }
        </style>
        ${firebaseEnabled ? `
        <script src="https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js"></script>
        <script src="https://www.gstatic.com/firebasejs/9.0.0/firebase-auth-compat.js"></script>
        ` : ''}
      </head>
      <body>
        <div class="container">
          <h1>🤖 Calendar Agent</h1>
          <p style="text-align: center; color: #666; margin-bottom: 30px;">
            Scan Gmail and Outlook for calendar invites and add them to Google Calendar
          </p>
          
          <div class="status ${isAuthenticated ? 'success' : 'warning'}">
            <strong>Status:</strong> ${isAuthenticated ? '✅ Ready to scan' : '⚠️ Please sign in to start'}
          </div>
          
          <div class="api-status">
            <span class="api-badge ${firebaseEnabled ? 'api-enabled' : 'api-disabled'}">
              🔐 Firebase: ${firebaseEnabled ? 'Ready' : 'Not configured'}
            </span>
            <span class="api-badge ${firebaseEnabled ? 'api-enabled' : 'api-disabled'}">
              📧 Gmail: ${firebaseEnabled ? 'Ready' : 'Not configured'}
            </span>
            <span class="api-badge ${microsoftEnabled ? 'api-enabled' : 'api-disabled'}">
              📧 Outlook: ${microsoftEnabled ? 'Ready' : 'Not configured'}
            </span>
          </div>
          
          ${!firebaseEnabled ? `
            <div class="setup-info">
              <strong>Setup Required:</strong> Firebase API key not configured. 
              <a href="https://console.firebase.google.com/" target="_blank">Get Firebase API key</a> for Google authentication.
            </div>
          ` : ''}
          
          ${!microsoftEnabled ? `
            <div class="setup-info">
              <strong>Setup Required:</strong> Microsoft OAuth not configured. 
              <a href="https://portal.azure.com/" target="_blank">Set up Azure app</a> for Outlook access.
            </div>
          ` : ''}
          
          ${!isAuthenticated ? `
            <div class="login-buttons">
              ${firebaseEnabled ? `
                <button onclick="signInWithGoogle()" class="btn google-btn">🔐 Sign in with Google</button>
              ` : `
                <button onclick="signInDemo()" class="btn demo-btn">🔐 Demo Mode</button>
              `}
              ${microsoftEnabled ? `
                <button onclick="signInMicrosoft()" class="btn microsoft-btn">🔐 Sign in with Microsoft</button>
              ` : ''}
            </div>
          ` : `
            <div style="text-align: center;">
              <button onclick="scanEmails()" class="btn scan-btn">🔍 Scan Emails</button>
              <button onclick="signOut()" class="btn">🔓 Sign Out</button>
            </div>
          `}
          
          <div class="loading" id="loading">
            <div class="spinner"></div>
            <p>Scanning emails...</p>
          </div>
          
          <div id="log"></div>
        </div>
        
        <script>
          ${firebaseEnabled ? `
          // Initialize Firebase
          const firebaseConfig = {
            apiKey: "${process.env.FIREBASE_API_KEY}",
            authDomain: "${process.env.FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_PROJECT_ID + '.firebaseapp.com'}",
            projectId: "${process.env.FIREBASE_PROJECT_ID || 'demo-project'}"
          };
          
          firebase.initializeApp(firebaseConfig);
          
          async function signInWithGoogle() {
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
            provider.addScope('https://www.googleapis.com/auth/calendar.events');
            
            try {
              const result = await firebase.auth().signInWithPopup(provider);
              const idToken = await result.user.getIdToken();
              const accessToken = result.credential.accessToken;
              
              // Send tokens to server
              const response = await fetch('/auth/firebase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  idToken,
                  accessToken 
                })
              });
              
              if (response.ok) {
                location.reload();
              }
            } catch (error) {
              console.error('Google sign-in error:', error);
              alert('Sign-in failed: ' + error.message);
            }
          }
          ` : `
          async function signInDemo() {
            try {
              const response = await fetch('/auth/demo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
              });
              
              if (response.ok) {
                location.reload();
              }
            } catch (error) {
              alert('Demo sign-in failed: ' + error.message);
            }
          }
          `}
          
          async function signInMicrosoft() {
            window.location.href = '/auth/microsoft';
          }
          
          async function scanEmails() {
            const button = document.querySelector('.scan-btn');
            const loading = document.getElementById('loading');
            const log = document.getElementById('log');
            
            button.disabled = true;
            button.textContent = '🔄 Scanning...';
            loading.style.display = 'block';
            log.textContent = '';
            
            try {
              const response = await fetch('/scan');
              const result = await response.json();
              
              let logText = '';
              if (result.error) {
                logText = '❌ Error: ' + result.error;
              } else if (result.message) {
                logText = '✅ ' + result.message + '\\n\\n';
                if (result.invites && result.invites.length > 0) {
                  result.invites.forEach(item => {
                    if (item.success) {
                      logText += '✅ Added: ' + item.invite.title + '\\n';
                    } else {
                      logText += '❌ Failed: ' + item.invite.title + ' (' + item.error + ')\\n';
                    }
                  });
                }
              }
              
              log.textContent = logText;
            } catch (error) {
              log.textContent = '❌ Error: ' + error.message;
            } finally {
              button.disabled = false;
              button.textContent = '🔍 Scan Emails';
              loading.style.display = 'none';
            }
          }
          
          async function signOut() {
            if (confirm('Sign out?')) {
              ${firebaseEnabled ? 'await firebase.auth().signOut();' : ''}
              await fetch('/auth/signout', { method: 'POST' });
              location.reload();
            }
          }
        </script>
      </body>
    </html>
  `);
});

// Firebase authentication route
app.post('/auth/firebase', async (req, res) => {
  try {
    const { idToken, accessToken } = req.body;
    const userId = await authManager.verifyFirebaseToken(idToken);
    currentUserId = userId;
    currentUserAccessToken = accessToken; // Store the access token for API calls
    res.json({ success: true, message: 'Signed in successfully' });
  } catch (error) {
    console.error('Firebase auth error:', error);
    res.status(400).json({ error: 'Authentication failed' });
  }
});

// Demo authentication route
app.post('/auth/demo', async (req, res) => {
  try {
    const userId = await authManager.verifyFirebaseToken('demo-token');
    currentUserId = userId;
    res.json({ success: true, message: 'Demo mode activated' });
  } catch (error) {
    console.error('Demo auth error:', error);
    res.status(400).json({ error: 'Demo authentication failed' });
  }
});

// Microsoft OAuth routes
app.get('/auth/microsoft', (req, res) => {
  try {
    const authUrl = authManager.getMicrosoftAuthUrl();
    res.redirect(authUrl);
  } catch (error) {
    res.redirect('/?error=microsoft_not_configured');
  }
});

app.get('/auth/microsoft/callback', async (req, res) => {
  try {
    const { code } = req.query;
    const userId = await authManager.handleMicrosoftCallback(code);
    currentUserId = userId;
    res.redirect('/');
  } catch (error) {
    console.error('Microsoft OAuth error:', error);
    res.redirect('/?error=microsoft_auth_failed');
  }
});

app.post('/auth/signout', (req, res) => {
  currentUserId = null;
  currentUserAccessToken = null;
  res.json({ success: true, message: 'Signed out' });
});

app.get('/scan', async (req, res) => {
  const result = await scanAndAddInvites();
  res.json(result);
});

app.listen(PORT, () => {
  console.log(`🚀 Calendar Agent running on http://localhost:${PORT}`);
  console.log('🔐 Sign in with Firebase (Google) or Microsoft to start scanning');
  console.log(`🌐 Open your browser and go to: http://localhost:${PORT}`);
});
