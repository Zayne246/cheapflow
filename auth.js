const { google } = require('googleapis');
const axios = require('axios');

class AuthManager {
  constructor() {
    this.users = new Map();
    this.firebaseEnabled = !!process.env.FIREBASE_API_KEY;
    
    if (this.firebaseEnabled) {
      console.log('✅ Firebase API key configured');
    } else {
      console.log('⚠️ Firebase API key not found - running in demo mode');
    }
  }

  // Firebase Google Authentication (client-side)
  async verifyFirebaseToken(idToken) {
    if (!this.firebaseEnabled) {
      // Demo mode - create a fake user
      const userId = 'demo-user-' + Date.now();
      this.users.set(userId, {
        email: 'demo@example.com',
        name: 'Demo User',
        provider: 'demo',
        createdAt: new Date().toISOString()
      });
      return userId;
    }

    try {
      // For client-side auth, we'll trust the token from Firebase
      // In production, you'd verify it server-side
      const userId = 'firebase-user-' + Date.now();
      
      // Store user data (in a real app, you'd decode the token)
      this.users.set(userId, {
        email: 'user@example.com',
        name: 'Firebase User',
        provider: 'firebase',
        createdAt: new Date().toISOString()
      });

      return userId;
    } catch (error) {
      console.error('Firebase token verification error:', error);
      throw error;
    }
  }

  // Get Google access token from Firebase user
  async getGoogleAccessToken(userId) {
    if (!this.firebaseEnabled) {
      // Demo mode - return null to indicate no access
      return null;
    }

    // Use the Google API key for Gmail/Calendar access
    return process.env.GOOGLE_API_KEY;
  }

  // Microsoft OAuth setup (kept for Graph API access)
  getMicrosoftAuthUrl() {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    if (!clientId) {
      throw new Error('Microsoft OAuth not configured - set MICROSOFT_CLIENT_ID');
    }
    
    const redirectUri = process.env.MICROSOFT_REDIRECT_URL || 'http://localhost:3000/auth/microsoft/callback';
    const scopes = 'Mail.Read Calendars.ReadWrite';
    
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
           `client_id=${clientId}&` +
           `response_type=code&` +
           `redirect_uri=${encodeURIComponent(redirectUri)}&` +
           `scope=${encodeURIComponent(scopes)}&` +
           `response_mode=query`;
  }

  // Handle Microsoft OAuth callback
  async handleMicrosoftCallback(code) {
    try {
      const clientId = process.env.MICROSOFT_CLIENT_ID;
      const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
      const redirectUri = process.env.MICROSOFT_REDIRECT_URL || 'http://localhost:3000/auth/microsoft/callback';

      if (!clientId || !clientSecret) {
        throw new Error('Microsoft OAuth not configured');
      }

      // Exchange code for tokens
      const tokenResponse = await axios.post('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const tokens = tokenResponse.data;

      // Get user info
      const userResponse = await axios.get('https://graph.microsoft.com/v1.0/me', {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`
        }
      });

      const userInfo = userResponse.data;
      const userId = userInfo.id;
      
      // Store Microsoft tokens separately
      const existingUser = this.users.get(userId) || {};
      this.users.set(userId, {
        ...existingUser,
        email: userInfo.mail || userInfo.userPrincipalName,
        name: userInfo.displayName,
        microsoftTokens: tokens,
        microsoftProvider: 'microsoft',
        createdAt: existingUser.createdAt || new Date().toISOString()
      });

      return userId;
    } catch (error) {
      console.error('Microsoft OAuth error:', error);
      throw error;
    }
  }

  // Get user data
  async getUserData(userId) {
    return this.users.get(userId);
  }

  // Get Google access token for a user
  async getGoogleTokens(userId) {
    const accessToken = await this.getGoogleAccessToken(userId);
    return accessToken ? { access_token: accessToken } : null;
  }

  // Get Microsoft tokens for a user
  async getMicrosoftTokens(userId) {
    const userData = this.users.get(userId);
    return userData?.microsoftTokens;
  }

  // Check if Firebase is enabled
  isFirebaseEnabled() {
    return this.firebaseEnabled;
  }

  // Check if Google API is enabled (same as Firebase)
  isGoogleApiEnabled() {
    return this.firebaseEnabled;
  }
}

module.exports = AuthManager;

