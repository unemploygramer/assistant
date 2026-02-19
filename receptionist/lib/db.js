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
 * @param {string} callSid - Twilio Call SID (primary key)
 * @param {Array} messages - Array of {role, content} message objects
 * @param {Object} metadata - Additional metadata (fromNumber, startTime, etc.)
 */
async function upsertSession(callSid, messages, metadata = {}) {
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
    console.error('❌ Failed to upsert session:', error.message);
    throw error;
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
      from_number: leadData.fromNumber // business line = links lead to owner
    };
    console.log('[DB] saveLead insert: phone(caller)=%s, from_number(business line)=%s, call_sid=%s', row.phone, row.from_number, row.call_sid);
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
 * Optionally filter by Twilio phone number for multi-tenant
 * @param {string} [twilioPhoneNumber] - The number that was called (for multi-tenant)
 * @returns {Promise<Object|null>} - { businessName, tone, customKnowledge, requiredLeadInfo } or null
 */
async function getBotConfig(twilioPhoneNumber = null) {
  try {
    // If we have a phone number, try to match it (for multi-tenant)
    if (twilioPhoneNumber) {
      const { data: match, error: matchError } = await supabase
        .from('business_profiles')
        .select('business_name, bot_config, calendar_id, twilio_phone_number, owner_phone')
        .eq('is_active', true)
        .eq('twilio_phone_number', twilioPhoneNumber)
        .limit(1)
        .maybeSingle();

      if (!matchError && match) {
        return {
          businessName: match.business_name || 'Your Business',
          tone: match.bot_config?.tone || 'professional',
          customKnowledge: match.bot_config?.customKnowledge || '',
          requiredLeadInfo: match.bot_config?.requiredLeadInfo || [],
          google_calendar_id: match.bot_config?.google_calendar_id || match.calendar_id || null,
          twilio_phone_number: match.twilio_phone_number || null,
          owner_phone: match.owner_phone || null
        };
      }
    }

    // Fallback: first active profile
    const { data, error } = await supabase
      .from('business_profiles')
      .select('business_name, bot_config, calendar_id, twilio_phone_number, owner_phone')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('❌ Supabase getBotConfig error:', error);
      return null;
    }

    if (!data) return null;

    return {
      businessName: data.business_name || 'Your Business',
      tone: data.bot_config?.tone || 'professional',
      customKnowledge: data.bot_config?.customKnowledge || '',
      requiredLeadInfo: data.bot_config?.requiredLeadInfo || [],
      google_calendar_id: data.bot_config?.google_calendar_id || data.calendar_id || null,
      twilio_phone_number: data.twilio_phone_number || null,
      owner_phone: data.owner_phone || null
    };
  } catch (error) {
    console.error('❌ Failed to get bot config:', error.message);
    return null;
  }
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

module.exports = {
  supabase,
  upsertSession,
  getSession,
  deleteSession,
  saveLead,
  logNotification,
  updateNotification,
  getLeads,
  getBotConfig
};
