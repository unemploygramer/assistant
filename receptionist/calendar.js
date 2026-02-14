const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

function requireEnv(name) {
  const v = process.env[name];
  if (!v || String(v).trim() === '') {
    throw new Error(`${name} is missing. Set it in your .env`);
  }
  return String(v).trim();
}

function loadServiceAccountCredentials() {
  // You can override the path via GOOGLE_APPLICATION_CREDENTIALS.
  const explicit = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  let credPath;
  
  if (explicit) {
    // If explicit path is set, resolve it (can be relative or absolute)
    credPath = path.isAbsolute(explicit) 
      ? explicit 
      : path.resolve(__dirname, '..', explicit);
  } else {
    // Default: look in root directory (where package.json is)
    credPath = path.join(__dirname, '..', 'credentials.json');
  }

  if (!fs.existsSync(credPath)) {
    throw new Error(
      `Service Account credentials not found at ${credPath}. Place credentials.json in the project root, or set GOOGLE_APPLICATION_CREDENTIALS to its path.`
    );
  }

  const raw = fs.readFileSync(credPath, 'utf8');
  const creds = JSON.parse(raw);
  if (!creds.client_email || !creds.private_key) {
    throw new Error('credentials.json is missing client_email or private_key (Service Account JSON expected).');
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

async function listEvents(options = {}) {
  const calendarId = options.calendarId || requireEnv('CALENDAR_ID');
  const timeMin = options.timeMin || new Date().toISOString();
  const maxResults = options.maxResults ?? 10;

  const calendar = getCalendarClient();
  const resp = await calendar.events.list({
    calendarId,
    timeMin,
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  });

  const items = resp.data.items || [];
  return items.map((e) => ({
    id: e.id,
    summary: e.summary || '(no title)',
    start: e.start?.dateTime || e.start?.date || null,
    end: e.end?.dateTime || e.end?.date || null,
    htmlLink: e.htmlLink || null,
  }));
}

async function createEvent(summary, startTime, durationMinutes, options = {}) {
  if (!summary || typeof summary !== 'string') throw new Error('createEvent(summary, ...) requires summary string');
  if (!startTime) throw new Error('createEvent(..., startTime, ...) requires startTime');

  const calendarId = options.calendarId || requireEnv('CALENDAR_ID');
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

async function createMultipleEvents(events, options = {}) {
  if (!Array.isArray(events) || events.length === 0) {
    throw new Error('createMultipleEvents requires a non-empty array of events');
  }

  const calendarId = options.calendarId || requireEnv('CALENDAR_ID');
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

      const duration = Number(event.durationMinutes || 60); // Default to 60 minutes
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
  
  const calendarId = options.calendarId || requireEnv('CALENDAR_ID');
  const calendar = getCalendarClient();

  // First, get the existing event
  const existing = await calendar.events.get({
    calendarId,
    eventId,
  });

  if (!existing.data) {
    throw new Error(`Event ${eventId} not found`);
  }

  // Merge updates into existing event
  const updated = { ...existing.data };
  if (updates.summary !== undefined) updated.summary = updates.summary;
  if (updates.startTime !== undefined) {
    updated.start = { dateTime: new Date(updates.startTime).toISOString() };
  }
  if (updates.durationMinutes !== undefined) {
    const start = updated.start?.dateTime ? new Date(updated.start.dateTime) : new Date();
    updated.end = { dateTime: new Date(start.getTime() + updates.durationMinutes * 60 * 1000).toISOString() };
  }

  // Update the event
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
  
  const calendarId = options.calendarId || requireEnv('CALENDAR_ID');
  const calendar = getCalendarClient();

  await calendar.events.delete({
    calendarId,
    eventId,
  });

  return { success: true, deletedId: eventId };
}

module.exports = {
  listEvents,
  createEvent,
  createMultipleEvents,
  updateEvent,
  deleteEvent,
};

