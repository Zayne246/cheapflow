// FILE: email-scanner.js
const { google } = require('googleapis');
const axios = require('axios');

class EmailScanner {
  constructor() {
    this.processedEmails = new Set(); // In-memory tracking
  }

  // Scan both Gmail and Outlook for calendar invites
  async scanAllEmails(userId, authManager, googleAccessToken) {
    const invites = [];
    
    try {
      // Scan Gmail using the passed access token
      if (googleAccessToken) {
        console.log('📧 Scanning Gmail...');
        const gmailInvites = await this.scanGmail(googleAccessToken);
        invites.push(...gmailInvites);
      } else {
        console.log('⚠️ Skipping Gmail scan - no Google access token');
      }

      // Scan Outlook
      const microsoftTokens = await authManager.getMicrosoftTokens(userId);
      if (microsoftTokens) {
        console.log('📧 Scanning Outlook...');
        const outlookInvites = await this.scanOutlook(microsoftTokens.access_token);
        invites.push(...outlookInvites);
      } else {
        console.log('⚠️ Skipping Outlook scan - no Microsoft tokens');
      }

      return invites;
    } catch (error) {
      console.error('Error scanning emails:', error);
      return [];
    }
  }

  async scanGmail(accessToken) {
    try {
      // Use Firebase access token for Gmail access
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });
      
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      // Search for emails with calendar attachments or meeting keywords
      const query = 'has:attachment filename:ics OR subject:meeting OR subject:invite OR subject:calendar OR "when:" OR "where:"';
      
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 10
      });

      const invites = [];
      
      if (response.data.messages) {
        for (const message of response.data.messages) {
          // Skip if already processed
          if (this.processedEmails.has(`gmail-${message.id}`)) {
            continue;
          }

          const invite = await this.parseEmailForInvite(gmail, message.id);
          if (invite) {
            invites.push(invite);
            this.processedEmails.add(`gmail-${message.id}`);
          }
        }
      }

      return invites;
    } catch (error) {
      console.error('Error scanning Gmail:', error);
      return [];
    }
  }

  async scanOutlook(accessToken) {
    try {
      // Search for emails with calendar invites
      const response = await axios.get('https://graph.microsoft.com/v1.0/me/messages', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        params: {
          $filter: "hasAttachments eq true or contains(subject,'meeting') or contains(subject,'invite') or contains(subject,'calendar')",
          $top: 10,
          $select: 'id,subject,body,receivedDateTime,hasAttachments'
        }
      });

      const invites = [];
      
      for (const message of response.data.value) {
        // Skip if already processed
        if (this.processedEmails.has(`outlook-${message.id}`)) {
          continue;
        }

        const invite = await this.parseOutlookEmail(message, accessToken);
        if (invite) {
          invites.push(invite);
          this.processedEmails.add(`outlook-${message.id}`);
        }
      }

      return invites;
    } catch (error) {
      console.error('Error scanning Outlook:', error);
      return [];
    }
  }

  async parseOutlookEmail(message, accessToken) {
    try {
      // Check for .ics attachments
      if (message.hasAttachments) {
        const attachmentsResponse = await axios.get(`https://graph.microsoft.com/v1.0/me/messages/${message.id}/attachments`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });

        for (const attachment of attachmentsResponse.data.value) {
          if (attachment.name && attachment.name.endsWith('.ics')) {
            const icsData = Buffer.from(attachment.contentBytes, 'base64').toString();
            return this.parseIcsContent(icsData, message.subject);
          }
        }
      }

      // Parse email body for meeting info
      return this.parseEmailBody(message.body.content, message.subject);
    } catch (error) {
      console.error('Error parsing Outlook email:', error);
      return null;
    }
  }

  async parseEmailForInvite(gmail, messageId) {
    try {
      const message = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      });

      const headers = message.data.payload.headers;
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      
      // Look for .ics attachments
      if (message.data.payload.parts) {
        for (const part of message.data.payload.parts) {
          if (part.filename && part.filename.endsWith('.ics')) {
            return await this.parseIcsAttachment(gmail, messageId, part, subject);
          }
        }
      }

      // Parse email body for meeting info
      return this.parseEmailBody(this.extractEmailBody(message.data), subject);
    } catch (error) {
      console.error('Error parsing email:', error);
      return null;
    }
  }

  async parseIcsAttachment(gmail, messageId, part, subject) {
    try {
      const attachment = await gmail.users.messages.attachments.get({
        userId: 'me',
        messageId: messageId,
        id: part.body.attachmentId
      });

      const icsData = Buffer.from(attachment.data.data, 'base64').toString();
      return this.parseIcsContent(icsData, subject);
    } catch (error) {
      console.error('Error parsing ICS attachment:', error);
      return null;
    }
  }

  parseIcsContent(icsData, fallbackTitle) {
    const lines = icsData.split('\n').map(line => line.trim());
    const event = { source: 'email' };

    for (const line of lines) {
      if (line.startsWith('SUMMARY:')) {
        event.title = line.substring(8);
      } else if (line.startsWith('DTSTART:')) {
        event.startTime = this.parseIcsDate(line.substring(8));
      } else if (line.startsWith('DTEND:')) {
        event.endTime = this.parseIcsDate(line.substring(6));
      } else if (line.startsWith('LOCATION:')) {
        event.location = line.substring(9);
      } else if (line.startsWith('DESCRIPTION:')) {
        event.description = line.substring(12);
      }
    }

    // Fallback to email subject if no summary found
    if (!event.title) {
      event.title = fallbackTitle || 'Calendar Invite';
    }

    // Must have at least title and start time
    return (event.title && event.startTime) ? event : null;
  }

  parseEmailBody(bodyText, subject) {
    if (!bodyText) return null;

    // Look for common meeting patterns
    const timePattern = /(?:when|time|date):\s*([^\n]+)/i;
    const locationPattern = /(?:where|location):\s*([^\n]+)/i;
    
    const timeMatch = bodyText.match(timePattern);
    const locationMatch = bodyText.match(locationPattern);

    if (timeMatch) {
      return {
        title: subject || 'Meeting Invitation',
        startTime: new Date(), // Would need better date parsing
        location: locationMatch ? locationMatch[1].trim() : '',
        description: 'Parsed from email body',
        source: 'email'
      };
    }

    return null;
  }

  extractEmailBody(messageData) {
    // Extract text from email body
    try {
      if (messageData.payload.body.data) {
        return Buffer.from(messageData.payload.body.data, 'base64').toString();
      }
      
      if (messageData.payload.parts) {
        for (const part of messageData.payload.parts) {
          if (part.mimeType === 'text/plain' && part.body.data) {
            return Buffer.from(part.body.data, 'base64').toString();
          }
        }
      }
    } catch (error) {
      console.error('Error extracting email body:', error);
    }
    return '';
  }

  parseIcsDate(dateString) {
    // Parse ICS date format (YYYYMMDDTHHMMSSZ or YYYYMMDD)
    if (!dateString) return new Date();
    
    dateString = dateString.replace(/[TZ]/g, '');
    
    if (dateString.length >= 8) {
      const year = dateString.substring(0, 4);
      const month = dateString.substring(4, 6);
      const day = dateString.substring(6, 8);
      const hour = dateString.substring(8, 10) || '00';
      const minute = dateString.substring(10, 12) || '00';
      
      return new Date(year, month - 1, day, hour, minute);
    }
    
    return new Date();
  }
}

module.exports = EmailScanner;