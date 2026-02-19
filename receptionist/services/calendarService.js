/**
 * Calendar service for the receptionist bot: check availability and book appointments.
 * Uses the shared calendar module (credentials.json / creds.json).
 */

const calendar = require('../calendar');

/**
 * Check if a time slot is available (no conflicting events).
 * @param {string} calendarId - Google Calendar ID (e.g. email or calendar ID)
 * @param {string} startTime - ISO date/time
 * @param {string} endTime - ISO date/time
 * @returns {Promise<{ available: boolean, conflictingEvents?: Array }>}
 */
async function check_availability(calendarId, startTime, endTime) {
  if (!calendarId || !startTime || !endTime) {
    throw new Error('check_availability requires calendarId, startTime, and endTime');
  }
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('startTime and endTime must be valid ISO date/time strings');
  }
  if (end <= start) {
    throw new Error('endTime must be after startTime');
  }

  const events = await calendar.listEvents({
    calendarId,
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    maxResults: 50,
  });

  if (events.length > 0) {
    return {
      available: false,
      conflictingEvents: events.map((e) => ({
        summary: e.summary,
        start: e.start,
        end: e.end,
      })),
    };
  }
  return { available: true };
}

/**
 * Book an appointment (create an event) on the given calendar.
 * @param {string} calendarId - Google Calendar ID
 * @param {string} summary - Event title (e.g. "Service call - John Smith")
 * @param {string} startTime - ISO date/time
 * @param {string} endTime - ISO date/time
 * @returns {Promise<{ success: boolean, event?: Object, error?: string }>}
 */
async function book_appointment(calendarId, summary, startTime, endTime) {
  if (!calendarId || !summary || !startTime || !endTime) {
    throw new Error('book_appointment requires calendarId, summary, startTime, and endTime');
  }
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('startTime and endTime must be valid ISO date/time strings');
  }
  if (end <= start) {
    throw new Error('endTime must be after startTime');
  }

  const durationMinutes = Math.round((end - start) / (60 * 1000));
  if (durationMinutes <= 0) {
    throw new Error('Duration must be at least 1 minute');
  }

  try {
    const result = await calendar.checkAndBook(calendarId, summary, startTime, durationMinutes);
    if (result.success && result.event) {
      return { success: true, event: result.event };
    }
    if (result.conflict && result.conflictingEvents) {
      return {
        success: false,
        error: 'Slot no longer available',
        conflictingEvents: result.conflictingEvents,
      };
    }
    return { success: false, error: result.message || 'Failed to book' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  check_availability,
  book_appointment,
};
