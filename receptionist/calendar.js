const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const DEFAULT_CALENDAR_ID = 'codedbytyler@gmail.com';

function loadServiceAccountCredentials() {
  const explicit = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  let credPath;

  if (explicit) {
    credPath = path.isAbsolute(explicit)
      ? explicit
      : path.resolve(__dirname, explicit);
  } else {
    // Prefer creds.json: same dir (receptionist), then project root
    const candidates = [
      path.join(__dirname, 'creds.json'),
      path.join(__dirname, '..', 'creds.json'),
      path.join(__dirname, '..', 'credentials.json'),
    ];
    credPath = candidates.find((p) => fs.existsSync(p));
    if (!credPath) {
      throw new Error(
        `Service account credentials not found. Place creds.json in receptionist/ or project root, or set GOOGLE_APPLICATION_CREDENTIALS. Tried: ${candidates.join(', ')}`
      );
    }
  }

  const raw = fs.readFileSync(credPath, 'utf8');
  const creds = JSON.parse(raw);
  if (!creds.client_email || !creds.private_key) {
    throw new Error('creds.json must contain client_email and private_key (Service Account JSON).');
  }
  return { creds, credPath };
}

function getCalendarClient() {
  const { creds } = loadServiceAccountCredentials();
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
  return google.calendar({ version: 'v3', auth });
}

/** Resolve calendar ID: explicit option, env, or default primary. */
function resolveCalendarId(options = {}) {
  return options.calendarId || process.env.CALENDAR_ID || DEFAULT_CALENDAR_ID;
}

/**
 * List upcoming events for a calendar.
 * @param {Object} [options] - { calendarId, timeMin, maxResults }
 */
async function listEvents(options = {}) {
  const calendarId = resolveCalendarId(options);
  const timeMin = options.timeMin || new Date().toISOString();
  const maxResults = options.maxResults ?? 10;

  const calendar = getCalendarClient();
  const listParams = {
    calendarId,
    timeMin,
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  };
  if (options.timeMax) listParams.timeMax = options.timeMax;
  const resp = await calendar.events.list(listParams);

  const items = resp.data.items || [];
  return items.map((e) => ({
    id: e.id,
    summary: e.summary || '(no title)',
    start: e.start?.dateTime || e.start?.date || null,
    end: e.end?.dateTime || e.end?.date || null,
    htmlLink: e.htmlLink || null,
  }));
}

/**
 * Create a single event on the given calendar.
 * @param {string} summary - Event title
 * @param {string} startTime - ISO date/time
 * @param {number} durationMinutes - Duration in minutes
 * @param {Object} [options] - { calendarId }
 */
async function createEvent(summary, startTime, durationMinutes, options = {}) {
  if (!summary || typeof summary !== 'string') throw new Error('createEvent(summary, ...) requires summary string');
  if (!startTime) throw new Error('createEvent(..., startTime, ...) requires startTime');

  const calendarId = resolveCalendarId(options);
  const duration = Number(durationMinutes);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('duration must be a positive number (minutes)');

  const start = new Date(startTime);
  if (Number.isNaN(start.getTime())) throw new Error('startTime must be a valid date/time');

  const end = new Date(start.getTime() + duration * 60 * 1000);
  const calendar = getCalendarClient();
  const resp = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
    },
  });

  return {
    id: resp.data.id,
    summary: resp.data.summary,
    start: resp.data.start?.dateTime || resp.data.start?.date || null,
    end: resp.data.end?.dateTime || resp.data.end?.date || null,
    htmlLink: resp.data.htmlLink || null,
  };
}

/**
 * Check for conflicts on a calendar in the given time window; if clear, create the event.
 * @param {string} calendarId - Calendar to check and book (e.g. 'codedbytyler@gmail.com' or any shared calendar ID)
 * @param {string} summary - Event title
 * @param {string} startTime - ISO date/time
 * @param {number} durationMinutes - Duration in minutes
 * @returns {Promise<{ success: boolean, event?: Object, conflict?: boolean, conflictingEvents?: Array }>}
 */
async function checkAndBook(calendarId, summary, startTime, durationMinutes) {
  if (!calendarId || typeof calendarId !== 'string') throw new Error('checkAndBook requires calendarId');
  if (!summary || typeof summary !== 'string') throw new Error('checkAndBook requires summary');
  if (!startTime) throw new Error('checkAndBook requires startTime');
  const duration = Number(durationMinutes);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('durationMinutes must be a positive number');

  const start = new Date(startTime);
  if (Number.isNaN(start.getTime())) throw new Error('startTime must be a valid date/time');
  const end = new Date(start.getTime() + duration * 60 * 1000);

  const calendar = getCalendarClient();

  const conflictResp = await calendar.events.list({
    calendarId,
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  const conflicting = conflictResp.data.items || [];
  if (conflicting.length > 0) {
    const conflictingEvents = conflicting.map((e) => ({
      id: e.id,
      summary: e.summary || '(no title)',
      start: e.start?.dateTime || e.start?.date || null,
      end: e.end?.dateTime || e.end?.date || null,
    }));
    return {
      success: false,
      conflict: true,
      message: `${conflicting.length} existing event(s) in that time window`,
      conflictingEvents,
    };
  }

  const resp = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
    },
  });

  return {
    success: true,
    conflict: false,
    event: {
      id: resp.data.id,
      summary: resp.data.summary,
      start: resp.data.start?.dateTime || resp.data.start?.date || null,
      end: resp.data.end?.dateTime || resp.data.end?.date || null,
      htmlLink: resp.data.htmlLink || null,
    },
  };
}

async function createMultipleEvents(events, options = {}) {
  if (!Array.isArray(events) || events.length === 0) {
    throw new Error('createMultipleEvents requires a non-empty array of events');
  }

  const calendarId = resolveCalendarId(options);
  const calendar = getCalendarClient();
  const results = [];
  const errors = [];

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    try {
      if (!event.summary || typeof event.summary !== 'string') {
        throw new Error(`Event ${i + 1}: summary is required and must be a string`);
      }
      if (!event.startTime) {
        throw new Error(`Event ${i + 1}: startTime is required`);
      }

      const duration = Number(event.durationMinutes || 60);
      if (!Number.isFinite(duration) || duration <= 0) {
        throw new Error(`Event ${i + 1}: durationMinutes must be a positive number`);
      }

      const start = new Date(event.startTime);
      if (Number.isNaN(start.getTime())) {
        throw new Error(`Event ${i + 1}: startTime must be a valid date/time`);
      }

      const end = new Date(start.getTime() + duration * 60 * 1000);

      const resp = await calendar.events.insert({
        calendarId,
        requestBody: {
          summary: event.summary,
          start: { dateTime: start.toISOString() },
          end: { dateTime: end.toISOString() },
        },
      });

      results.push({
        id: resp.data.id,
        summary: resp.data.summary,
        start: resp.data.start?.dateTime || resp.data.start?.date || null,
        end: resp.data.end?.dateTime || resp.data.end?.date || null,
        htmlLink: resp.data.htmlLink || null,
      });
    } catch (err) {
      errors.push({
        index: i + 1,
        event: event.summary || `Event ${i + 1}`,
        error: err.message,
      });
    }
  }

  return {
    success: errors.length === 0,
    created: results,
    errors: errors.length > 0 ? errors : undefined,
    total: events.length,
    succeeded: results.length,
    failed: errors.length,
  };
}

async function updateEvent(eventId, updates, options = {}) {
  if (!eventId || typeof eventId !== 'string') throw new Error('updateEvent(eventId, ...) requires eventId string');

  const calendarId = resolveCalendarId(options);
  const calendar = getCalendarClient();

  const existing = await calendar.events.get({
    calendarId,
    eventId,
  });

  if (!existing.data) {
    throw new Error(`Event ${eventId} not found`);
  }

  const updated = { ...existing.data };
  if (updates.summary !== undefined) updated.summary = updates.summary;
  if (updates.startTime !== undefined) {
    updated.start = { dateTime: new Date(updates.startTime).toISOString() };
  }
  if (updates.durationMinutes !== undefined) {
    const start = updated.start?.dateTime ? new Date(updated.start.dateTime) : new Date();
    updated.end = { dateTime: new Date(start.getTime() + updates.durationMinutes * 60 * 1000).toISOString() };
  }

  const resp = await calendar.events.update({
    calendarId,
    eventId,
    requestBody: updated,
  });

  return {
    id: resp.data.id,
    summary: resp.data.summary,
    start: resp.data.start?.dateTime || resp.data.start?.date || null,
    end: resp.data.end?.dateTime || resp.data.end?.date || null,
    htmlLink: resp.data.htmlLink || null,
  };
}

async function deleteEvent(eventId, options = {}) {
  if (!eventId || typeof eventId !== 'string') throw new Error('deleteEvent(eventId) requires eventId string');

  const calendarId = resolveCalendarId(options);
  const calendar = getCalendarClient();

  await calendar.events.delete({
    calendarId,
    eventId,
  });

  return { success: true, deletedId: eventId };
}

// -----------------------------------------------------------------------------
// Test script: list next 5 events from codedbytyler@gmail.com (run: node calendar.js)
// -----------------------------------------------------------------------------
async function runTest() {
  const testCalendarId = 'codedbytyler@gmail.com';
  console.log('📅 Google Calendar test – listing next 5 events for', testCalendarId);
  console.log('');

  try {
    const events = await listEvents({
      calendarId: testCalendarId,
      maxResults: 5,
    });
    console.log('✅ Connection OK. Next 5 events:');
    if (events.length === 0) {
      console.log('   (no upcoming events)');
    } else {
      events.forEach((e, i) => {
        console.log(`   ${i + 1}. ${e.summary}`);
        console.log(`      ${e.start} – ${e.end}`);
      });
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runTest();
}

module.exports = {
  listEvents,
  createEvent,
  createMultipleEvents,
  checkAndBook,
  updateEvent,
  deleteEvent,
  getCalendarClient,
  resolveCalendarId,
  DEFAULT_CALENDAR_ID,
};
