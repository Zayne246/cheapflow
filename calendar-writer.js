const { google } = require('googleapis');

class CalendarWriter {
  async addEventToCalendar(invite, accessToken) {
    try {
      // Use Firebase access token for Calendar access
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });
      
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      // Prepare event object
      const event = {
        summary: invite.title,
        description: invite.description || `Added by Calendar Agent from ${invite.source}`,
        location: invite.location || '',
        start: {
          dateTime: invite.startTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        end: {
          dateTime: (invite.endTime || new Date(invite.startTime.getTime() + 60*60*1000)).toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      };

      const result = await calendar.events.insert({
        calendarId: 'primary',
        resource: event
      });

      console.log(`✅ Added to calendar: "${invite.title}"`);
      return result.data;
    } catch (error) {
      console.error('❌ Error adding to calendar:', error.message);
      return null;
    }
  }
}

module.exports = CalendarWriter;