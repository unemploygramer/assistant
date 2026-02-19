/**
 * test-bot.js – Proves the Receptionist bot can read/write both calendars.
 * Uses creds.json (receptionist/ or project root) or credentials.json. Run: node test-bot.js
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const CREDENTIALS_CANDIDATES = [
  path.join(__dirname, 'creds.json'),
  path.join(__dirname, '..', 'creds.json'),
  path.join(__dirname, '..', 'credentials.json'),
];
const CALENDAR_IDS = ['codedbytyler@gmail.com', 'unemploygramer@gmail.com'];

function loadCredentials() {
  const credPath = CREDENTIALS_CANDIDATES.find((p) => fs.existsSync(p));
  if (!credPath) {
    throw new Error(
      `No credentials file found. Place creds.json in receptionist/ or project root. Tried: ${CREDENTIALS_CANDIDATES.join(', ')}`
    );
  }
  const raw = fs.readFileSync(credPath, 'utf8');
  const creds = JSON.parse(raw);
  if (!creds.client_email || !creds.private_key) {
    throw new Error('creds.json must contain client_email and private_key (Service Account JSON).');
  }
  return creds;
}

function getCalendarClient() {
  const creds = loadCredentials();
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
  return google.calendar({ version: 'v3', auth });
}

async function testCalendar(calendar, calendarId) {
  const timeMin = new Date().toISOString();
  const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
  const endTime = new Date(oneHourFromNow.getTime() + 15 * 60 * 1000);

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📅 Calendar: ${calendarId}`);
  console.log('─'.repeat(60));

  // READ: List next 3 events
  const listResp = await calendar.events.list({
    calendarId,
    timeMin,
    maxResults: 3,
    singleEvents: true,
    orderBy: 'startTime',
  });
  const events = listResp.data.items || [];
  console.log('\n✅ READ access OK – next 3 upcoming events:');
  if (events.length === 0) {
    console.log('   (none)');
  } else {
    events.forEach((e, i) => {
      const start = e.start?.dateTime || e.start?.date || '(no time)';
      console.log(`   ${i + 1}. ${e.summary || '(no title)'} – ${start}`);
    });
  }

  // WRITE: Create test event
  const insertResp = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: 'Bot Connection Test',
      start: { dateTime: oneHourFromNow.toISOString() },
      end: { dateTime: endTime.toISOString() },
    },
  });
  const created = insertResp.data;
  console.log('\n✅ WRITE access OK – created event:');
  console.log(`   Title: ${created.summary}`);
  console.log(`   Start: ${created.start?.dateTime || created.start?.date}`);
  console.log(`   End:   ${created.end?.dateTime || created.end?.date}`);
  console.log(`   ID:    ${created.id}`);
}

async function main() {
  const creds = loadCredentials();
  console.log('\n🤖 Receptionist Bot – Calendar connection test');
  console.log('   Using:', creds.client_email, '\n');

  const calendar = getCalendarClient();

  for (const calendarId of CALENDAR_IDS) {
    try {
      await testCalendar(calendar, calendarId);
    } catch (err) {
      console.error(`\n❌ Failed for ${calendarId}:`, err.message);
      process.exit(1);
    }
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log('✅ SUCCESS – Bot can read and write both calendars.');
  console.log('─'.repeat(60) + '\n');
}

main();
