// lib/db.js - Supabase Database Client
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env');
  console.error(`   SUPABASE_URL: ${supabaseUrl ? 'SET' : 'MISSING'}`);
  console.error(`   SUPABASE_ANON_KEY: ${supabaseKey ? 'SET' : 'MISSING'}`);
  console.error(`   .env file path: ${path.join(__dirname, '..', '..', '.env')}`);
  console.error(`   Current working directory: ${process.cwd()}`);
  throw new Error('Supabase credentials missing');
}

// Custom fetch: longer timeout (25s) to avoid ConnectTimeoutError when Supabase is slow
const SUPABASE_FETCH_TIMEOUT_MS = 25000;
const originalFetch = globalThis.fetch;
function fetchWithTimeout(input, init = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SUPABASE_FETCH_TIMEOUT_MS);
  return originalFetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timeoutId));
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { fetch: fetchWithTimeout }
});

/**
 * Upsert session transcript (saves every utterance during call)
 * Retries on transient errors so a Supabase hiccup doesn't lose conversation state.
 */
async function upsertSession(callSid, messages, metadata = {}) {
  const maxAttempts = 3;
  const retryDelayMs = 400;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { data, error } = await supabase
      .from('sessions')
      .upsert(
        {
          call_sid: callSid,
          transcript_buffer: messages,
          metadata: {
            ...metadata,
            lastUpdated: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        },
        {
          onConflict: 'call_sid'
        }
      )
      .select()
      .single();

      if (error) {
        console.error('❌ Supabase upsert error:', error);
        throw error;
      }

      return data;
    } catch (error) {
      const isRetryable = /fetch failed|timeout|UND_ERR_CONNECT_TIMEOUT|ECONNRESET|ETIMEDOUT/i.test(error?.message || '');
      if (isRetryable && attempt < maxAttempts) {
        console.warn(`⚠️ upsertSession attempt ${attempt}/${maxAttempts} failed (${error.message}), retrying...`);
        await new Promise(r => setTimeout(r, retryDelayMs));
        continue;
      }
      console.error('❌ Failed to upsert session:', error.message);
      throw error;
    }
  }
}

/**
 * Get session by Call SID (for recovery on restart).
 * Retries on connect/timeout errors (transient network issues).
 * @param {string} callSid - Twilio Call SID
 */
async function getSession(callSid) {
  const maxAttempts = 3;
  const retryDelayMs = 800;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('call_sid', callSid)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        console.error('❌ Supabase get session error:', error);
        throw error;
      }

      return data;
    } catch (error) {
      const isRetryable = /fetch failed|timeout|UND_ERR_CONNECT_TIMEOUT|ECONNRESET|ETIMEDOUT/i.test(error?.message || '');
      if (isRetryable && attempt < maxAttempts) {
        console.warn(`⚠️ getSession attempt ${attempt}/${maxAttempts} failed (${error.message}), retrying in ${retryDelayMs}ms...`);
        await new Promise(r => setTimeout(r, retryDelayMs));
        continue;
      }
      console.error('❌ Failed to get session:', error.message);
      return null;
    }
  }
  return null;
}

/**
 * Delete session after call completion
 * @param {string} callSid - Twilio Call SID
 */
async function deleteSession(callSid) {
  try {
    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('call_sid', callSid);

    if (error) {
      console.error('❌ Supabase delete error:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('❌ Failed to delete session:', error.message);
    return false;
  }
}

/**
 * Save lead to database.
 * - phone: caller/callback number (who called in or number they gave).
 * - from_number: business line (Twilio number that RECEIVED the call). Used to join to business_profiles.twilio_phone_number so the right dashboard user sees the lead.
 * @param {Object} leadData - Lead data object
 * @returns {Promise<Object>} Created lead record
 */
async function saveLead(leadData) {
  try {
    const row = {
      phone: leadData.phone,
      transcript: leadData.transcript,
      summary: leadData.summary,
      status: leadData.status || 'new',
      industry: leadData.industry || 'Residential Services',
      call_sid: leadData.callSid,
      from_number: leadData.fromNumber, // business line = links lead to owner
      ...(typeof leadData.isDemo === 'boolean' && { is_demo: leadData.isDemo })
    };
    console.log('[DB] saveLead insert: phone(caller)=%s, from_number(business line)=%s, call_sid=%s, is_demo=%s', row.phone, row.from_number, row.call_sid, row.is_demo ?? false);
    const { data, error } = await supabase
      .from('leads')
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error('❌ [DB] Supabase save lead error:', error.message, error.code, error.details);
      throw error;
    }
    console.log('[DB] saveLead success: id=%s', data?.id);
    return data;
  } catch (error) {
    console.error('❌ [DB] Failed to save lead:', error.message);
    throw error;
  }
}

/**
 * Log notification (SMS/email) to database
 * @param {Object} notificationData - Notification data
 * @returns {Promise<Object>} Created notification record
 */
async function logNotification(notificationData) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        lead_id: notificationData.leadId,
        message_body: notificationData.messageBody,
        sent_status: notificationData.sentStatus || 'pending',
        notification_type: notificationData.notificationType || 'sms',
        error_message: notificationData.errorMessage || null,
        twilio_message_sid: notificationData.twilioMessageSid || null
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase log notification error:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('❌ Failed to log notification:', error.message);
    throw error;
  }
}

/**
 * Update notification status (after SMS send attempt)
 * @param {string} notificationId - Notification UUID
 * @param {Object} updates - Status updates (can be camelCase, will convert to snake_case)
 */
async function updateNotification(notificationId, updates) {
  try {
    // Convert camelCase to snake_case for database columns
    const dbUpdates = {};
    if (updates.sentStatus !== undefined) dbUpdates.sent_status = updates.sentStatus;
    if (updates.sent_status !== undefined) dbUpdates.sent_status = updates.sent_status;
    if (updates.notificationType !== undefined) dbUpdates.notification_type = updates.notificationType;
    if (updates.notification_type !== undefined) dbUpdates.notification_type = updates.notification_type;
    if (updates.errorMessage !== undefined) dbUpdates.error_message = updates.errorMessage;
    if (updates.error_message !== undefined) dbUpdates.error_message = updates.error_message;
    if (updates.twilioMessageSid !== undefined) dbUpdates.twilio_message_sid = updates.twilioMessageSid;
    if (updates.twilio_message_sid !== undefined) dbUpdates.twilio_message_sid = updates.twilio_message_sid;

    const { data, error } = await supabase
      .from('notifications')
      .update(dbUpdates)
      .eq('id', notificationId)
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase update notification error:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('❌ Failed to update notification:', error.message);
    throw error;
  }
}

/**
 * Get bot config from business_profiles (used for AI prompt injection)
 * Retries on transient errors so a Supabase hiccup doesn't kill the call.
 * @param {string} [twilioPhoneNumber] - The number that was called (for multi-tenant)
 * @returns {Promise<Object|null>} - { businessName, tone, customKnowledge, requiredLeadInfo } or null
 */
async function getBotConfig(twilioPhoneNumber = null) {
  const maxAttempts = 3;
  const retryDelayMs = 500;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // If we have a phone number, try to match it (for multi-tenant)
      if (twilioPhoneNumber) {
        const { data: match, error: matchError } = await supabase
        .from('business_profiles')
        .select('id, business_name, bot_config, calendar_id, twilio_phone_number, owner_phone')
        .eq('is_active', true)
        .eq('twilio_phone_number', twilioPhoneNumber)
        .limit(1)
        .maybeSingle();

      if (!matchError && match) {
        return {
          business_profile_id: match.id,
          businessName: match.business_name || 'Your Business',
          tone: match.bot_config?.tone || 'professional',
          customKnowledge: match.bot_config?.customKnowledge || '',
          requiredLeadInfo: match.bot_config?.requiredLeadInfo || [],
          businessType: match.bot_config?.businessType || 'general',
          appointmentDetails: match.bot_config?.appointmentDetails || { serviceTypes: [], defaultDurationMinutes: 30, bookingRules: '' },
          google_calendar_id: (match.bot_config?.use_google_calendar !== false && (match.bot_config?.google_calendar_id || match.calendar_id)) || null,
          twilio_phone_number: match.twilio_phone_number || null,
          owner_phone: match.owner_phone || null
        };
      }
    }

      // Fallback: first active profile
      const { data, error } = await supabase
      .from('business_profiles')
      .select('id, business_name, bot_config, calendar_id, twilio_phone_number, owner_phone')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('❌ Supabase getBotConfig error:', error);
        throw error;
      }

        if (!data) return null;

      return {
        business_profile_id: data.id,
        businessName: data.business_name || 'Your Business',
      tone: data.bot_config?.tone || 'professional',
      customKnowledge: data.bot_config?.customKnowledge || '',
      requiredLeadInfo: data.bot_config?.requiredLeadInfo || [],
      businessType: data.bot_config?.businessType || 'general',
      appointmentDetails: data.bot_config?.appointmentDetails || { serviceTypes: [], defaultDurationMinutes: 30, bookingRules: '' },
      google_calendar_id: (data.bot_config?.use_google_calendar !== false && (data.bot_config?.google_calendar_id || data.calendar_id)) || null,
        twilio_phone_number: data.twilio_phone_number || null,
        owner_phone: data.owner_phone || null
      };
    } catch (error) {
      const isRetryable = /fetch failed|timeout|UND_ERR_CONNECT_TIMEOUT|ECONNRESET|ETIMEDOUT|PGRST/i.test(error?.message || '');
      if (isRetryable && attempt < maxAttempts) {
        console.warn(`⚠️ getBotConfig attempt ${attempt}/${maxAttempts} failed (${error.message}), retrying in ${retryDelayMs}ms...`);
        await new Promise(r => setTimeout(r, retryDelayMs));
        continue;
      }
      console.error('❌ Failed to get bot config:', error.message);
      return null;
    }
  }
  return null;
}

/**
 * Get all leads (for admin dashboard)
 * @param {Object} options - Query options (limit, status, etc.)
 */
async function getLeads(options = {}) {
  try {
    let query = supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.status) {
      query = query.eq('status', options.status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Supabase get leads error:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('❌ Failed to get leads:', error.message);
    throw error;
  }
}

/**
 * Log call-ended event (when Twilio status callback fires)
 * @param {string} callSid - Twilio Call SID
 * @param {string} callStatus - Call status from Twilio ('completed', 'canceled', etc.)
 * @param {string} twilioToNumber - Business line (number that received call)
 * @param {string} twilioFromNumber - Caller number
 */
async function logCallEnded(callSid, callStatus, twilioToNumber, twilioFromNumber) {
  try {
    const { data, error } = await supabase
      .from('call_ended_logs')
      .insert({
        call_sid: callSid,
        call_status: callStatus,
        twilio_to_number: twilioToNumber,
        twilio_from_number: twilioFromNumber,
        status: 'pending',
        processing_started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Failed to log call-ended event:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('❌ logCallEnded error:', error.message);
    return null;
  }
}

/**
 * Update call-ended log with processing results
 * @param {string} callSid - Twilio Call SID
 * @param {Object} updates - { status, error_message, error_stack, lead_id, email_sent, sms_sent }
 */
async function updateCallEndedLog(callSid, updates) {
  try {
    const updateData = {
      ...updates,
      processing_completed_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('call_ended_logs')
      .update(updateData)
      .eq('call_sid', callSid)
      .select()
      .single();

    if (error) {
      console.error('❌ Failed to update call-ended log:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('❌ updateCallEndedLog error:', error.message);
    return null;
  }
}

/**
 * Get last call info for a business line
 * @param {string} twilioToNumber - Business line (number that received call)
 */
async function getLastCallInfo(twilioToNumber) {
  try {
    const { data, error } = await supabase
      .from('call_ended_logs')
      .select('*')
      .eq('twilio_to_number', twilioToNumber)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      console.error('❌ Failed to get last call info:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('❌ getLastCallInfo error:', error.message);
    return null;
  }
}

/**
 * Assign an available Twilio number from the pool to a business profile.
 * Uses retries for resilience (same pattern as getBotConfig).
 * @param {string} businessProfileId - UUID of business_profiles row
 * @returns {Promise<{phoneNumber: string, sid: string}|null>} Assigned number or null if pool empty
 */
async function assignNumberToBusiness(businessProfileId) {
  const maxAttempts = 3;
  const retryDelayMs = 500;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Find first available number
      const { data: available, error: findErr } = await supabase
        .from('twilio_numbers')
        .select('id, phone_number, sid')
        .eq('status', 'available')
        .limit(1)
        .maybeSingle();

      if (findErr) throw findErr;
      if (!available) return null;

      // Update pool: mark as assigned, link to business
      const { error: updatePoolErr } = await supabase
        .from('twilio_numbers')
        .update({
          status: 'assigned',
          business_profile_id: businessProfileId,
          updated_at: new Date().toISOString()
        })
        .eq('id', available.id);

      if (updatePoolErr) throw updatePoolErr;

      // Update business_profiles.twilio_phone_number
      const { error: updateProfileErr } = await supabase
        .from('business_profiles')
        .update({
          twilio_phone_number: available.phone_number,
          updated_at: new Date().toISOString()
        })
        .eq('id', businessProfileId);

      if (updateProfileErr) throw updateProfileErr;

      console.log(`✅ [DB] Assigned ${available.phone_number} to business ${businessProfileId}`);
      return { phoneNumber: available.phone_number, sid: available.sid || null };
    } catch (error) {
      const isRetryable = /fetch failed|timeout|UND_ERR_CONNECT_TIMEOUT|ECONNRESET|ETIMEDOUT/i.test(error?.message || '');
      if (isRetryable && attempt < maxAttempts) {
        console.warn(`⚠️ assignNumberToBusiness attempt ${attempt}/${maxAttempts} failed (${error.message}), retrying...`);
        await new Promise(r => setTimeout(r, retryDelayMs));
        continue;
      }
      console.error('❌ assignNumberToBusiness failed:', error.message);
      throw error;
    }
  }
  return null;
}

/**
 * Check if any numbers are available in the pool
 * @returns {Promise<boolean>}
 */
async function hasAvailableNumbers() {
  try {
    const { count, error } = await supabase
      .from('twilio_numbers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'available');
    if (error) return false;
    return (count || 0) > 0;
  } catch (err) {
    return false;
  }
}

/**
 * In-app calendar: check if a time slot has any existing booking (for conflict detection).
 * @param {string} businessProfileId - UUID from business_profiles.id
 * @param {string} startTime - ISO date/time
 * @param {string} endTime - ISO date/time
 * @returns {Promise<{ available: boolean, conflictingEvents?: Array }>}
 */
async function checkInAppAvailability(businessProfileId, startTime, endTime) {
  if (!businessProfileId || !startTime || !endTime) {
    return { available: true };
  }
  try {
    const { data: rows, error } = await supabase
      .from('bookings')
      .select('id, customer_name, start_time, end_time')
      .eq('business_id', businessProfileId)
      .eq('status', 'scheduled')
      .lt('start_time', endTime);

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return { available: true };
      }
      console.warn('[DB] checkInAppAvailability error:', error.message);
      return { available: true };
    }
    const start = new Date(startTime).getTime();
    const overlapping = (rows || []).filter((r) => {
      const end = r.end_time ? new Date(r.end_time).getTime() : new Date(r.start_time).getTime();
      return end > start;
    });
    if (overlapping.length > 0) {
      return {
        available: false,
        conflictingEvents: overlapping.map((r) => ({ summary: r.customer_name || 'Appointment', start: r.start_time, end: r.end_time || r.start_time }))
      };
    }
    return { available: true };
  } catch (err) {
    console.warn('[DB] checkInAppAvailability:', err.message);
    return { available: true };
  }
}

/**
 * In-app calendar: save an appointment when Google Calendar is not used or fails.
 * @param {Object} opts - { businessProfileId, customerName, customerPhone, startTime, endTime, serviceType, leadId }
 * @returns {Promise<{ success: boolean, id?: string, error?: string }>}
 */
async function saveInAppBooking(opts) {
  const { businessProfileId, customerName, customerPhone, startTime, endTime, serviceType, leadId } = opts || {};
  if (!businessProfileId || !startTime) {
    return { success: false, error: 'businessProfileId and startTime required' };
  }
  try {
    const row = {
      business_id: businessProfileId,
      customer_name: customerName || null,
      customer_phone: customerPhone || null,
      start_time: startTime,
      end_time: endTime || startTime,
      service_type: serviceType || null,
      status: 'scheduled',
      lead_id: leadId || null
    };
    const { data, error } = await supabase
      .from('bookings')
      .insert(row)
      .select('id')
      .single();

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('[DB] bookings table missing — run migrations/bookings_table.sql in Supabase');
        return { success: false, error: 'Bookings table not set up' };
      }
      console.error('[DB] saveInAppBooking error:', error.message);
      return { success: false, error: error.message };
    }
    console.log('[DB] saveInAppBooking success: id=%s', data?.id);
    return { success: true, id: data?.id };
  } catch (err) {
    console.error('[DB] saveInAppBooking:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  supabase,
  upsertSession,
  getSession,
  deleteSession,
  saveLead,
  logNotification,
  updateNotification,
  getLeads,
  getBotConfig,
  logCallEnded,
  updateCallEndedLog,
  getLastCallInfo,
  assignNumberToBusiness,
  hasAvailableNumbers,
  checkInAppAvailability,
  saveInAppBooking
};
