const { google } = require('googleapis');
const path = require('path');
require('dotenv').config();

// Path to your credentials file
const KEYFILEPATH = path.join(__dirname, 'credentials.json');
const CALENDAR_ID = process.env.CALENDAR_ID || 'jacksto123@gmail.com'; // Use your actual gmail
console.log(CALENDAR_ID, 'CALENDAR_ID'  );
const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILEPATH,
  scopes: ['https://www.googleapis.com/auth/calendar'],
});

async function testConnection() {
  const calendar = google.calendar({ version: 'v3', auth });

  try {
    console.log(">> GLITCH IS ATTEMPTING TO ACCESS YOUR CALENDAR...");
    
    // Test 1: List the next 3 events
    const res = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: new Date().toISOString(),
      maxResults: 3,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = res.data.items;
    if (events.length) {
      console.log('✅ SUCCESS: Glitch can see your upcoming events:');
      events.map((event) => console.log(` - ${event.start.dateTime || event.start.date}: ${event.summary}`));
    } else {
      console.log('✅ SUCCESS: Glitch accessed the calendar, but it’s empty.');
    }

    // Test 2: Create a tiny test event
    console.log("\n>> GLITCH IS ATTEMPTING TO BOOK A TEST EVENT...");
    const event = {
      summary: '🤖 Glitch Connection Test',
      description: 'If you see this, Glitch has full control.',
      start: { dateTime: new Date().toISOString() },
      end: { dateTime: new Date(Date.now() + 30 * 60000).toISOString() }, // 30 mins from now
    };

    const insertRes = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      resource: event,
    });

    console.log(`✅ TOTAL SUCCESS: Event created! Check your Google Calendar app.`);
    console.log(`Event Link: ${insertRes.data.htmlLink}`);

  } catch (err) {
    console.error('❌ ERROR: Glitch failed to connect.');
    console.error('Check if you shared your calendar with the client_email in credentials.json!');
    console.error('Detailed Error:', err.message);
  }
}

testConnection();