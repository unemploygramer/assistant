// phone_server.js - Production-Ready AI Phone Receptionist with Supabase
// Load .env from parent directory (Baddie Assistant/.env) - NOT dashboard .env.local
const path = require('path');
const envPath = path.join(__dirname, '..', '.env');
require('dotenv').config({ path: envPath });
if (require.main === module) {
  console.log(`📁 [ENV] Loading from: ${envPath}`);
}
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const VoiceResponse = require('twilio').twiml.VoiceResponse;
const twilio = require('twilio');
const nodemailer = require('nodemailer');
const { upsertSession, getSession, deleteSession, saveLead, logNotification, updateNotification, getBotConfig } = require('./lib/db');
const { buildSystemPrompt } = require('./lib/prompt-builder');
const calendarService = require('./services/calendarService');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Request logging middleware (simplified for testing)
app.use((req, res, next) => {
  console.log(`\n🌐 [REQUEST] ${req.method} ${req.path}`);
  // Commented out to reduce noise - uncomment if needed
  // console.log(`   Headers:`, JSON.stringify(req.headers, null, 2));
  if (Object.keys(req.body).length > 0 && Object.keys(req.body).length < 10) {
    console.log(`   Body keys:`, Object.keys(req.body).join(', '));
  }
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(`\n💥 [ERROR] Unhandled error in ${req.method} ${req.path}:`);
  console.error(`   Error:`, err.message);
  console.error(`   Stack:`, err.stack);
  
  // If it's a TwiML endpoint, send error response
  if (req.path === '/voice' || req.path === '/gather') {
    try {
      const twiml = new VoiceResponse();
      twiml.say({ voice: 'Polly.Joanna-Neural' }, "I'm sorry, there was an error. Please call back.");
      res.type('text/xml');
      res.send(twiml.toString());
    } catch (twimlError) {
      console.error(`❌ [ERROR] Failed to send TwiML error response:`, twimlError.message);
      res.type('text/xml');
      res.send('<?xml version="1.0" encoding="UTF-8"?><Response><Say>Error.</Say></Response>');
    }
  } else {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// CORS for admin panel
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// OpenRouter/OpenAI setup
const OpenAI = require('openai');
const openRouterKey = process.env.OPENROUTER_KEY || process.env.OPENROUTER_API_KEY;

let openai = null;
if (openRouterKey) {
  openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: openRouterKey,
  });
  if (require.main === module) {
    console.log(`✅ OpenRouter configured`);
  }
} else if (require.main === module) {
  console.error('❌ ERROR: OPENROUTER_KEY is not set in .env file!');
  process.exit(1);
}

// Calendar tools for OpenAI/OpenRouter (check availability, book appointment)
const CALENDAR_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'check_availability',
      description: 'Check if a time slot is available on the business calendar. Always use this before booking when a caller wants an appointment.',
      parameters: {
        type: 'object',
        properties: {
          calendarId: { type: 'string', description: 'Google Calendar ID (e.g. business email)' },
          startTime: { type: 'string', description: 'Start of slot in ISO 8601 format (e.g. 2025-02-20T14:00:00)' },
          endTime: { type: 'string', description: 'End of slot in ISO 8601 format' }
        },
        required: ['calendarId', 'startTime', 'endTime']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'book_appointment',
      description: 'Book an appointment on the business calendar. Only call after checking availability and confirming with the caller.',
      parameters: {
        type: 'object',
        properties: {
          calendarId: { type: 'string', description: 'Google Calendar ID' },
          summary: { type: 'string', description: 'Event title (e.g. "Service call - John Smith")' },
          startTime: { type: 'string', description: 'Start in ISO 8601 format' },
          endTime: { type: 'string', description: 'End in ISO 8601 format' }
        },
        required: ['calendarId', 'summary', 'startTime', 'endTime']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'end_call',
      description: 'Call this when you have collected all required information and are ready to end the conversation. After calling this, say your final closing message to the caller, then the call will end.',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Why you are ending the call (e.g. "collected all required information", "appointment booked successfully")' }
        },
        required: ['reason']
      }
    }
  }
];

// HARDCODED PROFESSIONAL SYSTEM PROMPT (Residential Service Receptionist)
const PROFESSIONAL_SYSTEM_PROMPT = `You are a professional phone receptionist for a residential service business (plumbing, HVAC, electrical, etc.). Your job is to have a natural, conversational conversation with callers to collect lead information.

CRITICAL RULES:
- Ask ONE question at a time, wait for their response, then ask the next
- NO troubleshooting, NO technical support - you're collecting leads for the business owner
- NO long scripts, NO lists of options, NO "Press 1 for..." 
- Sound like a real person having a conversation
- Keep your responses under 2 sentences
- Follow up on what they say with relevant questions
- Be friendly, professional, and empathetic
- Your goal is to qualify leads and collect contact info

CALENDAR: You have access to the business owner's calendar. If a caller wants to book an appointment, ALWAYS check availability first using check_availability. If the slot is free, confirm with the caller before booking it with book_appointment.

Current date and time: {{current_datetime}}

PHONE NUMBER: Accept however they say it. Clarify back naturally (e.g. "So 555-123-4567?") - never say "plus" or demand format.

COLLECT THIS INFORMATION (one at a time):
1. Their name
2. Phone number
3. What service they need (specific details)
4. How urgent it is (low, medium, high)
5. Best time to call them back
6. Address (if relevant for service dispatch)

EXAMPLE FLOW:
You: "Hi, thanks for calling! What can I help you with today?"
[They respond]
You: "Got it. Can I get your name?"
[They respond]
You: "Thanks! What's the best number to reach you?"
[They respond]
You: "Perfect. Just to make sure I understand - [ask follow-up about their specific need]?"
[Continue conversation naturally]

When you have collected ALL the required information and are ready to end the conversation, call the end_call tool. After calling end_call, say your final closing message to the caller (e.g. "Perfect! I've got all your information. Someone will call you back soon. Thanks for calling!") and the call will end.`;

// Helper: Generate ElevenLabs audio and return URL (with resilience)
async function generateElevenLabsAudio(text) {
  console.log(`🎙️ [ELEVENLABS] Generating audio for: "${text.substring(0, 50)}..."`);
  
  if (!process.env.ELEVENLABS_KEY || !process.env.CUSTOMER_SERVICE_WOMEN) {
    console.error(`❌ [ELEVENLABS] Missing credentials`);
    console.error(`   ELEVENLABS_KEY: ${process.env.ELEVENLABS_KEY ? 'SET' : 'MISSING'}`);
    console.error(`   CUSTOMER_SERVICE_WOMEN: ${process.env.CUSTOMER_SERVICE_WOMEN ? 'SET' : 'MISSING'}`);
    throw new Error('ElevenLabs credentials missing');
  }

  try {
    console.log(`📡 [ELEVENLABS] Calling ElevenLabs API...`);
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${process.env.CUSTOMER_SERVICE_WOMEN}`,
      {
        text: text,
        model_id: "eleven_turbo_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.7 }
      },
      {
        headers: {
          'xi-api-key': process.env.ELEVENLABS_KEY,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer',
        timeout: 10000 // 10 second timeout
      }
    );

    console.log(`✅ [ELEVENLABS] Audio received (${response.data.length} bytes)`);

    const audioDir = path.join(__dirname, 'public', 'audio');
    if (!require('fs').existsSync(audioDir)) {
      console.log(`📁 [ELEVENLABS] Creating audio directory: ${audioDir}`);
      require('fs').mkdirSync(audioDir, { recursive: true });
    }

    const filename = `voice_${Date.now()}.mp3`;
    const filepath = path.join(audioDir, filename);
    require('fs').writeFileSync(filepath, response.data);
    console.log(`💾 [ELEVENLABS] Audio saved: ${filepath}`);

    const serverPort = process.env.PHONE_SERVER_PORT || 3001;
    const baseUrl = process.env.PUBLIC_URL || `http://localhost:${serverPort}`;
    const audioUrl = `${baseUrl}/audio/${filename}`;
    console.log(`🔗 [ELEVENLABS] Audio URL: ${audioUrl}`);
    
    return audioUrl;
  } catch (error) {
    console.error('❌ [ELEVENLABS] Error:', error.message);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, JSON.stringify(error.response.data));
    }
    console.error(`   Stack:`, error.stack);
    throw error;
  }
}

// Default calendar when none set in business profile or env
const DEFAULT_CALENDAR_ID = process.env.CALENDAR_ID || 'codedbytyler@gmail.com';

// Helper: Get AI response with resilience (call stays live on failure)
async function getAIResponse(messages, callSid, twilioToNumber = null) {
  console.log(`🤖 [AI] Getting response for call ${callSid}`);
  console.log(`   Messages in context: ${messages.length}`);

  // Fetch bot config and resolve calendar ID from business_profiles (twilio number -> google_calendar_id)
  let systemPrompt = PROFESSIONAL_SYSTEM_PROMPT;
  let calendarId = DEFAULT_CALENDAR_ID;
  let businessName = null;
  try {
    const botConfig = await getBotConfig(twilioToNumber);
    if (botConfig && botConfig.businessName) {
      businessName = botConfig.businessName;
      systemPrompt = buildSystemPrompt(botConfig, false);
      console.log(`📋 [AI] Using dashboard config for: ${businessName}`);
      if (botConfig.google_calendar_id) {
        calendarId = botConfig.google_calendar_id;
        console.log(`📅 [AI] Using calendar: ${calendarId}`);
      } else {
        console.log(`⚠️ [AI] No calendar ID in config, using default: ${calendarId}`);
      }
    } else {
      console.log(`📋 [AI] No dashboard config found for ${twilioToNumber}, using default prompt`);
    }
  } catch (err) {
    console.error(`⚠️ [AI] Failed to fetch bot config:`, err.message);
  }

  // Inject current date/time and calendar ID into system prompt
  const currentDatetime = new Date().toISOString();
  systemPrompt = systemPrompt.replace(/\{\{current_datetime\}\}/g, currentDatetime);
  systemPrompt += `\n\nUse this calendar ID for check_availability and book_appointment: ${calendarId}.`;

  const fullMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  let endCallRequested = false; // Track if AI called end_call tool

  try {
    let completion;
    let round = 0;
    const maxToolRounds = 5;

    do {
      round++;
      console.log(`📡 [AI] Calling OpenRouter API (model: openai/gpt-4o)${round > 1 ? ` round ${round}` : ''}...`);
      completion = await openai.chat.completions.create({
        messages: fullMessages,
        model: 'openai/gpt-4o',
        temperature: 0.7,
        timeout: 20000,
        tools: CALENDAR_TOOLS,
        tool_choice: 'auto'
      });

      const msg = completion.choices[0].message;
      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        const response = msg.content || '';
        console.log(`✅ [AI] Got response (${response.length} chars), endCallRequested: ${endCallRequested}`);
        // Return object with response and end flag
        return { response, shouldEndCall: endCallRequested };
      }

      // Append assistant message with tool calls
      fullMessages.push({
        role: 'assistant',
        content: msg.content || null,
        tool_calls: msg.tool_calls
      });

      // Execute each tool call and append results
      for (const tc of msg.tool_calls) {
        const fnName = tc.function.name;
        let args;
        try {
          args = typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments;
        } catch (e) {
          fullMessages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ error: 'Invalid arguments' }) });
          continue;
        }
        let result;
        try {
          // Ensure calendar ID is set (use resolved one if AI didn't provide it)
          const resolvedCalendarId = args.calendarId || calendarId || DEFAULT_CALENDAR_ID;
          if (!args.calendarId && calendarId) {
            console.log(`📅 [TOOL] Injecting calendar ID: ${calendarId} (AI didn't provide one)`);
          }
          
          if (fnName === 'check_availability') {
            result = await calendarService.check_availability(resolvedCalendarId, args.startTime, args.endTime);
            console.log(`📅 [TOOL] check_availability(${resolvedCalendarId}): ${result.available ? 'available' : 'busy'}`);
          } else if (fnName === 'book_appointment') {
            result = await calendarService.book_appointment(resolvedCalendarId, args.summary, args.startTime, args.endTime);
            console.log(`📅 [TOOL] book_appointment(${resolvedCalendarId}): ${result.success ? 'ok' : result.error || 'failed'}`);
            
            // Send immediate email notification after successful booking
            if (result.success) {
              console.log(`📧 [TOOL] Sending immediate email notification for appointment booking...`);
              try {
                const session = await getSession(callSid);
                console.log(`📧 [TOOL] getSession: ${session ? 'ok' : 'null'}, metadata: ${session?.metadata ? 'yes' : 'no'}`);
                if (session && session.metadata) {
                  const bookingDetails = {
                    customerName: null,
                    phoneNumber: session.metadata.fromNumber || null,
                    serviceNeeded: `Appointment booked: ${args.summary || 'Appointment'}`,
                    urgency: 'medium',
                    preferredCallback: args.startTime || null,
                    address: null,
                    appointmentSummary: args.summary,
                    appointmentTime: args.startTime,
                    appointmentEndTime: args.endTime
                  };
                  const userMessages = session.transcript_buffer?.filter(m => m.role === 'user') || [];
                  if (userMessages.length > 0) {
                    const nameMatch = session.transcript_buffer.find(m => 
                      m.role === 'user' && (m.content.toLowerCase().includes('my name is') || m.content.toLowerCase().includes("i'm"))
                    );
                    if (nameMatch) {
                      const namePart = nameMatch.content.split(/my name is|i'm|i am/i)[1]?.trim()?.split(/\s+/)[0];
                      if (namePart && namePart.length > 1) bookingDetails.customerName = namePart;
                    }
                  }
                  console.log(`📧 [TOOL] bookingDetails for email:`, JSON.stringify(bookingDetails, null, 2));
                  const emailOk = await sendEmailNotification(bookingDetails, callSid);
                  console.log(`📧 [TOOL] Immediate email result: ${emailOk ? 'sent' : 'failed'}`);

                  // Immediate SMS for appointment booked (same recipient as call-ended SMS)
                  const useSms = process.env.USE_TWILIO_SMS === 'true';
                  console.log(`📱 [TOOL] USE_TWILIO_SMS=${JSON.stringify(process.env.USE_TWILIO_SMS)} → immediate SMS ${useSms ? 'enabled' : 'disabled'}`);
                  if (useSms) {
                    const twilioToNumber = session.metadata.twilioToNumber || null;
                    let botConfig = null;
                    try { botConfig = await getBotConfig(twilioToNumber); } catch (_) {}
                    const toE164 = (num) => {
                      if (!num || typeof num !== 'string') return null;
                      const s = num.trim();
                      const digits = s.replace(/\D/g, '');
                      if (digits.length === 10) return `+1${digits}`;
                      if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
                      return s.startsWith('+') ? s : (s ? `+${s}` : null);
                    };
                    const smsTo = toE164(botConfig?.owner_phone || process.env.MY_CELL_NUMBER) || null;
                    const smsFrom = toE164(botConfig?.twilio_phone_number || twilioToNumber || process.env.TWILIO_PHONE_NUMBER) || null;
                    console.log(`📱 [TOOL] SMS to=${smsTo ?? 'NULL'}, from=${smsFrom ?? 'NULL'}`);
                    if (smsTo && smsFrom) {
                      try {
                        const smsBody = `📅 Appointment booked: ${args.summary || 'Appointment'} at ${args.startTime || 'TBD'}. Caller: ${session.metadata.fromNumber || 'N/A'}`;
                        await twilioClient.messages.create({ body: smsBody, from: smsFrom, to: smsTo });
                        console.log(`📱 [TOOL] Immediate SMS sent for appointment booking → ${smsTo}`);
                      } catch (smsErr) {
                        console.error(`⚠️ [TOOL] Immediate SMS failed:`, smsErr.message);
                      }
                    } else {
                      console.log(`📱 [TOOL] SMS skipped: need owner_phone (Config) or MY_CELL_NUMBER, and Twilio number for from`);
                    }
                  }
                } else {
                  console.log(`⚠️ [TOOL] No session or metadata - skipping immediate email`);
                }
              } catch (emailErr) {
                console.error(`⚠️ [TOOL] Failed to send immediate email after booking:`, emailErr.message);
                console.error(`   Stack:`, emailErr.stack);
              }
            }
          } else if (fnName === 'end_call') {
            // AI has decided to end the call - mark it so we hang up after the AI's final response
            console.log(`📞 [TOOL] end_call called: ${args.reason || 'conversation complete'}`);
            endCallRequested = true;
            result = { success: true, message: 'Call will end after your final message to the caller' };
          } else {
            result = { error: `Unknown tool: ${fnName}` };
          }
        } catch (toolErr) {
          console.error(`❌ [TOOL] ${fnName} error:`, toolErr.message);
          result = { error: toolErr.message };
        }
        fullMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result)
        });
      }
    } while (round < maxToolRounds);

    // Fallback if we hit max rounds without a final text response
    const lastContent = completion.choices[0].message.content;
    return { response: lastContent || "I've checked the calendar. How would you like to proceed?", shouldEndCall: endCallRequested };
  } catch (error) {
    console.error(`❌ [AI] OpenRouter API error for ${callSid}:`, error.message);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, JSON.stringify(error.response.data));
    }
    console.error(`   Stack:`, error.stack);
    return { response: "I've caught your details, but my system is lagging. A human will call you back shortly.", shouldEndCall: false };
  }
}

// Helper: Generate concise summary from transcript
async function generateSummary(transcript) {
  try {
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `Extract key information from this phone conversation and return ONLY valid JSON with these exact fields:
{
  "customerName": "Customer full name or null",
  "phoneNumber": "Phone number in format +1234567890 or null",
  "serviceNeeded": "What service/product they need",
  "urgency": "low, medium, or high",
  "preferredCallback": "Best time to call them back or null",
  "address": "Physical address if relevant or null"
}

CRITICAL RULES:
- Return ONLY valid JSON, no explanations, no markdown
- Use null for missing information (not empty strings)
- Phone numbers must be in format: +1234567890
- Urgency must be: "low", "medium", or "high" (lowercase)
- All string values must be properly quoted
- No trailing commas`
        },
        {
          role: "user",
          content: `Conversation transcript:\n${transcript.map(m => `${m.role}: ${m.content}`).join('\n')}`
        }
      ],
      model: "openai/gpt-4o",
      response_format: { type: "json_object" },
      temperature: 0.1
    });

    const rawResponse = completion.choices[0].message.content;
    let extracted = null;
    
    try {
      extracted = JSON.parse(rawResponse);
    } catch (parseError) {
      // Try to extract JSON from text
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    }

    return extracted;
  } catch (error) {
    console.error('❌ Summary generation error:', error.message);
    // Return minimal fallback
    return {
      customerName: null,
      phoneNumber: null,
      serviceNeeded: 'Service requested (details unavailable)',
      urgency: 'medium',
      preferredCallback: null,
      address: null
    };
  }
}

// Helper: Send email notification with HTML template
async function sendEmailNotification(callDetails, callSid) {
  console.log(`\n📧 [EMAIL] ========== sendEmailNotification ==========`);
  console.log(`   callSid: ${callSid}`);
  console.log(`   callDetails keys: ${Object.keys(callDetails || {}).join(', ')}`);
  console.log(`   BUSINESS_OWNER_EMAIL: ${process.env.BUSINESS_OWNER_EMAIL ? `set (${process.env.BUSINESS_OWNER_EMAIL})` : '❌ NOT SET'}`);
  console.log(`   EMAIL_APP_PASSWORD: ${process.env.EMAIL_APP_PASSWORD ? `set (${process.env.EMAIL_APP_PASSWORD.length} chars)` : '❌ NOT SET'}`);

  if (!process.env.BUSINESS_OWNER_EMAIL || !process.env.EMAIL_APP_PASSWORD) {
    console.log(`⚠️ [EMAIL] Skipping - BUSINESS_OWNER_EMAIL or EMAIL_APP_PASSWORD missing in .env (use Baddie Assistant root .env, not dashboard .env.local)`);
    return false;
  }

  try {
    console.log(`📧 [EMAIL] Building email for: ${process.env.BUSINESS_OWNER_EMAIL}`);
    const businessName = process.env.BUSINESS_NAME || 'Test Business';
    const phoneNumber = callDetails.phoneNumber || callDetails.phone || 'Not provided';
    const phoneLink = phoneNumber !== 'Not provided' ? phoneNumber.replace(/\D/g, '') : '';
    const isHighPriority = callDetails.urgency === 'high';

    // Build HTML email template
    const urgencyColor = callDetails.urgency === 'high' ? '#dc2626' : callDetails.urgency === 'medium' ? '#f59e0b' : '#10b981';
    const urgencyText = callDetails.urgency ? callDetails.urgency.toUpperCase() : 'NORMAL';
    
    const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Lead - ${businessName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 20px 0; text-align: center; background-color: #ffffff;">
        <table role="presentation" style="width: 600px; margin: 0 auto; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 30px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">🔥 New Lead - ${businessName}</h1>
              ${isHighPriority ? '<p style="margin: 10px 0 0 0; color: #ffffff; font-size: 14px; font-weight: 500;">⚠️ HIGH PRIORITY</p>' : ''}
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                ${callDetails.customerName ? `
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                    <strong style="color: #374151; font-size: 14px;">👤 Customer Name:</strong>
                    <p style="margin: 4px 0 0 0; color: #111827; font-size: 16px;">${callDetails.customerName}</p>
                  </td>
                </tr>
                ` : ''}
                
                ${phoneNumber !== 'Not provided' ? `
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                    <strong style="color: #374151; font-size: 14px;">📱 Phone Number:</strong>
                    <p style="margin: 4px 0 0 0; color: #111827; font-size: 16px;">${phoneNumber}</p>
                  </td>
                </tr>
                ` : ''}
                
                ${callDetails.serviceNeeded || callDetails.issue ? `
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                    <strong style="color: #374151; font-size: 14px;">🎯 Service Needed:</strong>
                    <p style="margin: 4px 0 0 0; color: #111827; font-size: 16px;">${callDetails.serviceNeeded || callDetails.issue}</p>
                  </td>
                </tr>
                ` : ''}
                
                ${callDetails.urgency ? `
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                    <strong style="color: #374151; font-size: 14px;">Urgency:</strong>
                    <p style="margin: 4px 0 0 0; color: ${urgencyColor}; font-size: 16px; font-weight: 600;">${urgencyText}</p>
                  </td>
                </tr>
                ` : ''}
                
                ${callDetails.preferredCallback ? `
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                    <strong style="color: #374151; font-size: 14px;">📅 Preferred Callback:</strong>
                    <p style="margin: 4px 0 0 0; color: #111827; font-size: 16px;">${callDetails.preferredCallback}</p>
                  </td>
                </tr>
                ` : ''}
                
                ${callDetails.address ? `
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                    <strong style="color: #374151; font-size: 14px;">📍 Address:</strong>
                    <p style="margin: 4px 0 0 0; color: #111827; font-size: 16px;">${callDetails.address}</p>
                  </td>
                </tr>
                ` : ''}
              </table>
              
              <!-- Call Back Button -->
              ${phoneLink ? `
              <table role="presentation" style="width: 100%; margin-top: 30px;">
                <tr>
                  <td style="text-align: center;">
                    <a href="tel:${phoneLink}" style="display: inline-block; padding: 14px 32px; background-color: #10b981; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">📞 Call Back</a>
                  </td>
                </tr>
              </table>
              ` : ''}
              
              <!-- Footer -->
              <table role="presentation" style="width: 100%; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <tr>
                  <td style="padding: 0;">
                    <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center;">
                      🕐 ${new Date().toLocaleString()}<br>
                      📞 Call SID: ${callSid}<br>
                      💼 Voicemail 3.0 Lead Capture
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    // Create transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.BUSINESS_OWNER_EMAIL,
        pass: process.env.EMAIL_APP_PASSWORD
      }
    });

    // Email options
    const mailOptions = {
      from: process.env.BUSINESS_OWNER_EMAIL,
      to: process.env.BUSINESS_OWNER_EMAIL,
      subject: isHighPriority 
        ? `🔴 URGENT: New Lead - ${businessName}` 
        : `🔥 New Lead - ${businessName}`,
      html: htmlTemplate,
      priority: isHighPriority ? 'high' : 'normal'
    };

    // Send email
    console.log(`📧 [EMAIL] Calling transporter.sendMail...`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ [EMAIL] Sent successfully! Message ID: ${info.messageId}`);
    
    return true;
  } catch (error) {
    console.error(`❌ [EMAIL] FAILED:`, error.message);
    if (error.response) console.error(`   SMTP response:`, error.response);
    if (error.code) console.error(`   Code: ${error.code}`);
    if (error.responseCode) console.error(`   Response code: ${error.responseCode}`);
    if (error.command) console.error(`   Command: ${error.command}`);
    console.error(`   Stack:`, error.stack);
    return false;
  }
}

// Helper: Log notification (with USE_TWILIO_SMS flag) - handles both SMS and Email
// options: { smsToNumber, smsFromNumber } from business_profiles (owner_phone, twilio_phone_number) - overrides env
async function logNotificationWithSMS(leadId, messageBody, callSid, callDetails, options = {}) {
  console.log(`\n📬 [NOTIFY] ========== logNotificationWithSMS ==========`);
  console.log(`   leadId: ${leadId}, callSid: ${callSid}`);
  console.log(`   options.smsToNumber (owner): ${options.smsToNumber ?? '(not passed)'}`);
  console.log(`   options.smsFromNumber (Twilio line): ${options.smsFromNumber ?? '(not passed)'}`);
  console.log(`   callDetails keys: ${Object.keys(callDetails || {}).join(', ')}`);
  console.log(`   BUSINESS_OWNER_EMAIL: ${process.env.BUSINESS_OWNER_EMAIL ? 'set' : 'NOT SET'}`);
  console.log(`   EMAIL_APP_PASSWORD: ${process.env.EMAIL_APP_PASSWORD ? 'set' : 'NOT SET'}`);
  console.log(`   USE_TWILIO_SMS: ${process.env.USE_TWILIO_SMS}`);
  console.log(`   MY_CELL_NUMBER (env fallback): ${process.env.MY_CELL_NUMBER ? 'set' : 'NOT SET'}`);
  console.log(`   TWILIO_PHONE_NUMBER (env fallback): ${process.env.TWILIO_PHONE_NUMBER ? 'set' : 'NOT SET'}`);
  const useTwilioSMS = process.env.USE_TWILIO_SMS === 'true';

  let emailSent = false;
  if (process.env.BUSINESS_OWNER_EMAIL && process.env.EMAIL_APP_PASSWORD) {
    try {
      console.log(`📬 [NOTIFY] Calling sendEmailNotification(callDetails, callSid)...`);
      emailSent = await sendEmailNotification(callDetails, callSid);
      console.log(`📬 [NOTIFY] Email result: ${emailSent ? 'SENT' : 'FAILED'}`);
      if (emailSent) {
        await logNotification({
          leadId: leadId,
          messageBody: messageBody,
          sentStatus: 'sent',
          notificationType: 'email'
        });
      }
    } catch (error) {
      console.error(`⚠️ [NOTIFY] Email send threw:`, error.message);
      console.error(`   Stack:`, error.stack);
    }
  } else {
    console.log(`📬 [NOTIFY] Email skipped - env not configured (need .env in Baddie Assistant root, not dashboard .env.local)`);
  }

  // Resolve SMS to/from: prefer DB (options), then env. Normalize to E.164 (e.g. 10 digits → +1xxxxxxxxxx).
  function toE164(num) {
    if (!num || typeof num !== 'string') return null;
    const s = num.trim();
    const digits = s.replace(/\D/g, '');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    return s.startsWith('+') ? s : (s ? `+${s}` : null);
  }
  const smsToNumber = toE164(options.smsToNumber || process.env.MY_CELL_NUMBER) || null;
  const smsFromNumber = toE164(options.smsFromNumber || process.env.TWILIO_PHONE_NUMBER) || null;
  console.log(`📬 [NOTIFY] SMS resolved (E.164): to=${smsToNumber ?? 'NULL'}, from=${smsFromNumber ?? 'NULL'}`);

  // Always log SMS notification to database first
  let notification = null;
  try {
    notification = await logNotification({
      leadId: leadId,
      messageBody: messageBody,
      sentStatus: 'pending',
      notificationType: 'sms'
    });
    console.log(`✅ [NOTIFY] SMS notification row created: id=${notification.id}`);
  } catch (error) {
    console.error('❌ [NOTIFY] Failed to log SMS notification:', error.message);
  }

  if (!useTwilioSMS) {
    console.log(`📝 [NOTIFY] USE_TWILIO_SMS is not 'true' - SMS only logged to DB, not sent via Twilio`);
    if (notification) {
      try {
        await updateNotification(notification.id, { sentStatus: 'logged' });
      } catch (e) {
        console.error(`⚠️ [NOTIFY] updateNotification (logged):`, e.message);
      }
    }
    return { logged: true, sent: false, emailSent };
  }

  if (!smsToNumber || !smsFromNumber) {
    console.log(`⚠️ [NOTIFY] SMS skip: need (owner_phone in Config or MY_CELL_NUMBER) and (Twilio number in profile or TWILIO_PHONE_NUMBER)`);
    if (notification) {
      try {
        await updateNotification(notification.id, {
          sentStatus: 'failed',
          errorMessage: !smsToNumber ? 'No SMS to number (set owner_phone in Config or MY_CELL_NUMBER)' : 'No SMS from number (set Twilio number in Config or TWILIO_PHONE_NUMBER)'
        });
      } catch (e) {
        console.error(`⚠️ [NOTIFY] updateNotification (failed):`, e.message);
      }
    }
    return { logged: true, sent: false, emailSent };
  }

  console.log(`📱 [NOTIFY] About to call Twilio messages.create: from=${smsFromNumber}, to=${smsToNumber}, body length=${messageBody?.length ?? 0}`);
  try {
    const message = await twilioClient.messages.create({
      body: messageBody,
      from: smsFromNumber,
      to: smsToNumber,
      statusCallback: `${process.env.PUBLIC_URL || 'http://localhost:3001'}/sms-status`
    });

    console.log(`✅ [NOTIFY] Twilio SMS sent successfully. message.sid=${message.sid}`);
    
    if (notification) {
      try {
        await updateNotification(notification.id, {
          sentStatus: 'sent',
          twilioMessageSid: message.sid
        });
      } catch (error) {
        console.error(`⚠️ Failed to update notification status (non-critical):`, error.message);
        // Continue - SMS was sent successfully
      }
    }

    return { logged: true, sent: true, messageSid: message.sid, emailSent };
  } catch (error) {
    console.error(`❌ [NOTIFY] Twilio SMS send failed:`, error.message);
    console.error(`   code: ${error.code ?? 'n/a'}, status: ${error.status ?? 'n/a'}`);
    console.error(`   more: ${error.moreInfo ?? ''}`);
    if (error.stack) console.error(`   stack:`, error.stack);

    if (notification) {
      try {
        await updateNotification(notification.id, {
          sentStatus: 'failed',
          errorMessage: error.message
        });
      } catch (updateError) {
        console.error(`⚠️ [NOTIFY] updateNotification (failed):`, updateError.message);
      }
    }

    return { logged: true, sent: false, error: error.message, emailSent };
  }
}

// 1. CALL COMES IN -> Greeting with ElevenLabs (resilient)
app.post('/voice', async (req, res) => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📞 [VOICE] INCOMING CALL REQUEST`);
  console.log(`   Timestamp: ${new Date().toISOString()}`);
  console.log(`   Request Body:`, JSON.stringify(req.body, null, 2));
  
  const callSid = req.body.CallSid;
  const fromNumber = req.body.From;   // Caller (stored in leads.phone)
  const twilioToNumber = req.body.To; // Number they dialed = your Twilio/business line (stored in leads.from_number → links to dashboard owner)
  
  if (!callSid) {
    console.error(`❌ [VOICE] NO CALL SID IN REQUEST!`);
    res.type('text/xml');
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response><Say>Error processing call.</Say></Response>');
    return;
  }
  
  console.log(`📞 [VOICE] Call SID: ${callSid}`);
  console.log(`📞 [VOICE] From: ${fromNumber}`);
  console.log(`📞 [VOICE] To (dialed number): ${twilioToNumber}`);
  
  // Identify which business this call is for
  let businessName = 'Unknown Business';
  let calendarId = null;
  try {
    const botConfig = await getBotConfig(twilioToNumber);
    if (botConfig && botConfig.businessName) {
      businessName = botConfig.businessName;
      calendarId = botConfig.google_calendar_id || null;
      console.log(`📞 Call for [${businessName}] incoming`);
      if (calendarId) {
        console.log(`📅 Calendar ID: ${calendarId}`);
      } else {
        console.log(`⚠️ No calendar ID configured for this business`);
      }
    } else {
      console.log(`⚠️ No business profile found for number ${twilioToNumber} - using defaults`);
    }
  } catch (err) {
    console.error(`⚠️ [VOICE] Failed to identify business:`, err.message);
  }

  // Try to recover session if server restarted
  let session = null;
  try {
    console.log(`🔍 [VOICE] Checking for existing session...`);
    session = await getSession(callSid);
    if (session) {
      console.log(`🔄 [VOICE] Recovered session for ${callSid} (${session.transcript_buffer.length} messages)`);
    } else {
      console.log(`✨ [VOICE] No existing session - creating new one`);
    }
  } catch (error) {
    console.error(`⚠️ [VOICE] Failed to recover session:`, error.message);
    console.error(`   Stack:`, error.stack);
  }

  // Initialize or restore session (always include twilioToNumber for config lookup)
  const messages = session ? session.transcript_buffer : [];
  const baseMetadata = session ? session.metadata : { fromNumber, startTime: new Date().toISOString() };
  const metadata = { ...baseMetadata, twilioToNumber, businessName, calendarId };
  console.log(`📝 [VOICE] Session state: ${messages.length} messages, metadata:`, JSON.stringify(metadata));

  // Save initial session
  try {
    console.log(`💾 [VOICE] Saving initial session to Supabase...`);
    await upsertSession(callSid, messages, metadata);
    console.log(`✅ [VOICE] Session saved successfully`);
  } catch (error) {
    console.error(`⚠️ [VOICE] Failed to save initial session:`, error.message);
    console.error(`   Stack:`, error.stack);
    // Continue anyway - non-critical
  }

  // Business name already identified above, use it for greeting

  console.log(`🎙️ [VOICE] Generating greeting...`);
  const twiml = new VoiceResponse();
  
  // Configure status callback so we get notified when call ends (for email notification)
  // Note: This should also be set in Twilio webhook settings, but adding here as backup
  const statusCallbackUrl = `${process.env.PUBLIC_URL || 'http://localhost:3001'}/call-ended`;
  console.log(`📞 [VOICE] Status callback URL: ${statusCallbackUrl}`);
  
  const greeting = `Thank you for calling ${businessName}. How can I assist you today?`;
  
  // Try ElevenLabs, fallback to Twilio TTS (resilient)
  if (process.env.PUBLIC_URL) {
    console.log(`🎵 [VOICE] PUBLIC_URL set (${process.env.PUBLIC_URL}) - trying ElevenLabs...`);
    try {
      const audioUrl = await generateElevenLabsAudio(greeting);
      console.log(`✅ [VOICE] ElevenLabs audio generated: ${audioUrl}`);
      twiml.play(audioUrl);
    } catch (error) {
      console.error('❌ [VOICE] ElevenLabs failed, using Twilio TTS:', error.message);
      console.error(`   Stack:`, error.stack);
      twiml.say({ voice: 'Polly.Joanna-Neural' }, greeting);
      console.log(`🔄 [VOICE] Using Twilio TTS fallback`);
    }
  } else {
    console.log(`⚠️ [VOICE] PUBLIC_URL not set - using Twilio TTS`);
    twiml.say({ voice: 'Polly.Joanna-Neural' }, greeting);
  }
  
  // Set up speech gathering
  console.log(`👂 [VOICE] Setting up speech gather...`);
  const gather = twiml.gather({
    input: 'speech',
    action: '/gather',
    speechTimeout: 'auto',
    language: 'en-US',
    method: 'POST',
    // Add status callback to gather (fires when gather completes or call ends)
    statusCallback: statusCallbackUrl,
    statusCallbackEvent: ['completed']
  });
  
  // If no speech detected, redirect back
  twiml.redirect('/voice');
  
  const twimlXml = twiml.toString();
  console.log(`📤 [VOICE] Sending TwiML response:`);
  console.log(twimlXml);
  console.log(`${'='.repeat(60)}\n`);
  
  res.type('text/xml');
  res.send(twimlXml);
});

// 2. CONVERSATION LOOP -> AI responds with resilience
app.post('/gather', async (req, res) => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📥 [GATHER] SPEECH INPUT REQUEST`);
  console.log(`   Timestamp: ${new Date().toISOString()}`);
  console.log(`   Request Body:`, JSON.stringify(req.body, null, 2));
  
  const twiml = new VoiceResponse();
  const callSid = req.body.CallSid;
  const userSpeech = req.body.SpeechResult;

  if (!callSid) {
    console.error(`❌ [GATHER] NO CALL SID IN REQUEST!`);
    twiml.say({ voice: 'Polly.Joanna-Neural' }, "I'm sorry, there was an error. Please call back.");
    res.type('text/xml');
    res.send(twiml.toString());
    return;
  }

  console.log(`📞 [GATHER] Call SID: ${callSid}`);
  console.log(`💬 [GATHER] User Speech: "${userSpeech || 'NO SPEECH DETECTED'}"`);

  // Recover session from database (resilient to restarts)
  let session = null;
  try {
    console.log(`🔍 [GATHER] Fetching session from Supabase...`);
    session = await getSession(callSid);
    if (!session) {
      console.error(`❌ [GATHER] No session found for CallSid: ${callSid}`);
      twiml.say({ voice: 'Polly.Joanna-Neural' }, "I'm sorry, there was an error. Please call back.");
      res.type('text/xml');
      res.send(twiml.toString());
      return;
    }
    console.log(`✅ [GATHER] Session found: ${session.transcript_buffer.length} messages`);
  } catch (error) {
    console.error(`❌ [GATHER] Failed to get session:`, error.message);
    console.error(`   Stack:`, error.stack);
    twiml.say({ voice: 'Polly.Joanna-Neural' }, "I'm having trouble connecting. Please hold.");
    const gather = twiml.gather({
      input: 'speech',
      action: '/gather',
      speechTimeout: 'auto'
    });
    res.type('text/xml');
    res.send(twiml.toString());
    return;
  }

  let messages = session.transcript_buffer || [];
  console.log(`📝 [GATHER] Current transcript: ${messages.length} messages`);
  
  // Log business identity from session metadata
  const sessionBusinessName = session?.metadata?.businessName || 'Unknown Business';
  const sessionCalendarId = session?.metadata?.calendarId || null;
  if (sessionBusinessName !== 'Unknown Business') {
    console.log(`📞 Handling call for [${sessionBusinessName}]`);
    if (sessionCalendarId) {
      console.log(`📅 Calendar ID: ${sessionCalendarId}`);
    }
  }

  if (userSpeech) {
    console.log(`\n💬 [GATHER] CALLER SAID: "${userSpeech}"`);
    
    // Add user message
    messages.push({ role: 'user', content: userSpeech });
    console.log(`📝 [GATHER] Added user message. Total: ${messages.length} messages`);

    // Save to database immediately (upsert)
    try {
      console.log(`💾 [GATHER] Saving session to Supabase...`);
      await upsertSession(callSid, messages, session.metadata);
      console.log(`✅ [GATHER] Session saved`);
    } catch (error) {
      console.error(`⚠️ [GATHER] Failed to save session:`, error.message);
      console.error(`   Stack:`, error.stack);
      // Continue anyway - non-critical
    }

    // Get AI response (with resilience) - now returns { response, shouldEndCall }
    let aiResult = null;
    try {
      console.log(`🤖 [GATHER] Calling OpenRouter API...`);
      aiResult = await getAIResponse(messages, callSid, req.body.To || session?.metadata?.twilioToNumber);
      console.log(`✅ [GATHER] AI RESPONSE: "${aiResult.response}"`);
      console.log(`📞 [GATHER] Should end call: ${aiResult.shouldEndCall}`);
    } catch (error) {
      console.error(`❌ [GATHER] AI error:`, error.message);
      console.error(`   Stack:`, error.stack);
      aiResult = { response: "I've caught your details, but my system is lagging. A human will call you back shortly.", shouldEndCall: false };
      console.log(`🔄 [GATHER] Using fallback message`);
    }

    const aiResponse = aiResult.response;
    const shouldEndCall = aiResult.shouldEndCall || false;

    // Add AI response
    messages.push({ role: 'assistant', content: aiResponse });
    console.log(`📝 [GATHER] Added AI response. Total: ${messages.length} messages`);

    // Save updated session
    try {
      console.log(`💾 [GATHER] Saving updated session...`);
      await upsertSession(callSid, messages, session.metadata);
      console.log(`✅ [GATHER] Updated session saved`);
    } catch (error) {
      console.error(`⚠️ [GATHER] Failed to save session:`, error.message);
      console.error(`   Stack:`, error.stack);
      // Continue anyway - non-critical
    }

    // Generate audio (resilient - fallback to TTS)
    console.log(`🎵 [GATHER] Generating audio response...`);
    if (process.env.PUBLIC_URL) {
      try {
        console.log(`   Trying ElevenLabs...`);
        const audioUrl = await generateElevenLabsAudio(aiResponse);
        console.log(`✅ [GATHER] ElevenLabs audio: ${audioUrl}`);
        twiml.play(audioUrl);
      } catch (audioError) {
        console.error(`❌ [GATHER] ElevenLabs failed:`, audioError.message);
        console.error(`   Stack:`, audioError.stack);
        console.log(`🔄 [GATHER] Using Twilio TTS fallback`);
        twiml.say({ voice: 'Polly.Joanna-Neural' }, aiResponse);
      }
    } else {
      console.log(`⚠️ [GATHER] PUBLIC_URL not set - using Twilio TTS`);
      twiml.say({ voice: 'Polly.Joanna-Neural' }, aiResponse);
    }

    // AI decides when to end via end_call tool - no phrase detection
    if (shouldEndCall) {
      console.log(`📴 END CALL INITIATED BY BOT (end_call tool) — CallSid: ${callSid}`);
      twiml.hangup();
      
      // Process lead asynchronously (don't block call end)
      console.log(`⏰ [GATHER] Scheduling call completion in 1s (lead save + email)... callSid=${callSid}`);
      setTimeout(async () => {
        try {
          console.log(`⏰ [GATHER] Running processCallCompletion now for ${callSid}`);
          await processCallCompletion(callSid);
        } catch (err) {
          console.error(`❌ [GATHER] Error in processCallCompletion:`, err.message);
          console.error(`   Stack:`, err.stack);
        }
      }, 1000);
    } else {
      // Continue conversation
      console.log(`👂 [GATHER] Setting up next speech gather`);
      const gather = twiml.gather({
        input: 'speech',
        action: '/gather',
        speechTimeout: 'auto',
        language: 'en-US',
        method: 'POST'
      });
    }
  } else {
    // No speech detected, redirect back
    console.log(`⚠️ [GATHER] No speech detected - redirecting to /voice`);
    twiml.redirect('/voice');
  }

  const twimlXml = twiml.toString();
  console.log(`📤 [GATHER] Sending TwiML response:`);
  console.log(twimlXml);
  console.log(`${'='.repeat(60)}\n`);

  res.type('text/xml');
  res.send(twimlXml);
});

// 3. CALL ENDED -> Process lead (fetch from sessions, generate summary, save to leads)
app.post('/call-ended', async (req, res) => {
  const callSid = req.body.CallSid;
  const callStatus = req.body.CallStatus || 'unknown';
  const statusCallbackTo = req.body.To || null;
  const statusCallbackFrom = req.body.From || null;

  // One clear line: dropped vs completed (Twilio: completed = call ended normally; canceled/failed/no-answer = dropped/failed)
  const isDropped = ['canceled', 'failed', 'no-answer', 'busy'].includes(callStatus);
  const endType = isDropped ? 'DROPPED/FAILED' : 'ENDED (completed)';
  console.log(`\n🛑 CALL ENDED — CallSid: ${callSid || 'MISSING'} | CallStatus: ${callStatus} (${endType}) | To: ${statusCallbackTo} | From: ${statusCallbackFrom}`);
  console.log(`   (If you never see this when caller hangs up, set Twilio phone number → Voice → Status callback URL → ${process.env.PUBLIC_URL || 'http://localhost:3001'}/call-ended)`);

  if (!callSid) {
    console.error(`❌ [CALL-ENDED] NO CALL SID — cannot process`);
    res.sendStatus(400);
    return;
  }

  console.log(`⏰ [CALL-ENDED] Running processCallCompletion (lead + email/SMS)...`);
  processCallCompletion(callSid, { statusCallbackTo, statusCallbackFrom }).catch(err => {
    console.error(`❌ [CALL-ENDED] processCallCompletion failed:`, err.message);
    console.error(`   Stack:`, err.stack);
  });

  res.sendStatus(200);
});

// Process call completion: Fetch transcript, generate summary, save lead, send notification
// statusCallback: optional { statusCallbackTo, statusCallbackFrom } from Twilio so we always have the business line for lead ownership
async function processCallCompletion(callSid, statusCallback = {}) {
  try {
    console.log(`📋 [CALL-COMPLETE] Starting: lead + email/SMS for callSid=${callSid}`);

    const session = await getSession(callSid);
    if (!session) {
      console.error(`❌ [CALL-COMPLETE] Skipped: no session for ${callSid} — cannot save lead or send email`);
      return;
    }
    if (!session.transcript_buffer || session.transcript_buffer.length === 0) {
      console.error(`❌ [CALL-COMPLETE] Skipped: empty transcript for ${callSid}`);
      return;
    }

    const messages = session.transcript_buffer;
    const metadata = session.metadata || {};
    // Business line = number that RECEIVED the call (your Twilio number). This is what links the lead to the dashboard user.
    const twilioToNumber = metadata.twilioToNumber || statusCallback.statusCallbackTo || null;
    // Caller = person who called in (or callback number they gave). Stored in leads.phone.
    const fromNumber = metadata.fromNumber || statusCallback.statusCallbackFrom || null;

    console.log(`📋 [CALL-COMPLETE] Session ok. messages=${messages.length}, caller=${fromNumber}, business line=${twilioToNumber}`);

    // Get business config from dashboard (name, owner_phone for SMS, twilio_phone_number for SMS from)
    let businessName = process.env.BUSINESS_NAME || 'Test Business';
    let botConfig = null;
    try {
      botConfig = await getBotConfig(twilioToNumber);
      console.log(`📋 [CALL-COMPLETE] getBotConfig result: businessName=${botConfig?.businessName ?? 'n/a'}, owner_phone=${botConfig?.owner_phone ?? 'n/a'}, twilio_phone_number=${botConfig?.twilio_phone_number ?? 'n/a'}`);
      if (botConfig && botConfig.businessName) {
        businessName = botConfig.businessName;
        console.log(`📋 Using business name from dashboard: ${businessName}`);
      }
    } catch (err) {
      console.error(`⚠️ [CALL-COMPLETE] getBotConfig failed:`, err.message);
    }

    // Generate summary using GPT-4o
    console.log(`📋 [CALL-COMPLETE] Generating summary...`);
    const summary = await generateSummary(messages);
    console.log(`📋 [CALL-COMPLETE] Summary:`, JSON.stringify(summary, null, 2));

    // Build transcript text
    const transcriptText = messages.map(m => `${m.role}: ${m.content}`).join('\n');

    // Save to leads table
    // CRITICAL: leads.from_number = business line (number that RECEIVED the call). Dashboard joins leads.from_number = business_profiles.twilio_phone_number so the right user sees the lead.
    // leads.phone = caller/callback number (who called in or number they gave to call back).
    if (!twilioToNumber) {
      console.error(`❌ [CALL-COMPLETE] No business line (twilioToNumber) - cannot link lead to owner. Skipping lead save. Set Status Callback URL in Twilio so we get To/From.`);
      return;
    }
    const businessLineForLead = twilioToNumber;
    console.log(`📋 [CALL-COMPLETE] Saving lead... (caller/callback: ${fromNumber}, business line for ownership: ${businessLineForLead})`);
    const leadPayload = {
      phone: summary.phoneNumber || fromNumber,
      transcript: transcriptText,
      summary: summary,
      status: 'new',
      industry: process.env.BUSINESS_TYPE || process.env.BUSINESS_NAME || 'Residential Services',
      callSid: callSid,
      fromNumber: businessLineForLead
    };
    console.log(`📋 [CALL-COMPLETE] saveLead payload:`, JSON.stringify({ ...leadPayload, transcript: '(omitted)' }, null, 2));
    const lead = await saveLead(leadPayload);

    console.log(`📋 [CALL-COMPLETE] Lead saved: id=${lead.id}, from_number=${businessLineForLead} (links to business_profiles.twilio_phone_number → dashboard owner)`);

    // Build notification message (businessName from dashboard config above)
    let messageBody = `🔥 NEW LEAD - ${businessName}\n\n`;
    
    if (summary.customerName) messageBody += `👤 ${summary.customerName}\n`;
    if (summary.phoneNumber) messageBody += `📱 ${summary.phoneNumber}\n`;
    if (summary.serviceNeeded) messageBody += `🎯 ${summary.serviceNeeded}\n`;
    if (summary.urgency) {
      const urgencyEmoji = summary.urgency === 'high' ? '🔴' : summary.urgency === 'medium' ? '🟡' : '🟢';
      messageBody += `${urgencyEmoji} ${summary.urgency.toUpperCase()}\n`;
    }
    if (summary.preferredCallback) messageBody += `📅 ${summary.preferredCallback}\n`;
    if (summary.address) messageBody += `📍 ${summary.address}\n`;
    
    messageBody += `\n━━━━━━━━━━━━━━━━\n`;
    messageBody += `🕐 ${new Date().toLocaleString()}\n`;
    messageBody += `📞 Call SID: ${callSid}\n`;

    // Send email and SMS (SMS uses owner_phone from Config; from = business Twilio number)
    const smsOptions = {
      smsToNumber: botConfig?.owner_phone || null,
      smsFromNumber: botConfig?.twilio_phone_number || twilioToNumber || null
    };
    console.log(`📋 [CALL-COMPLETE] Sending notifications. SMS options:`, smsOptions);
    await logNotificationWithSMS(lead.id, messageBody, callSid, summary, smsOptions);
    console.log(`📋 [CALL-COMPLETE] Done. Lead id=${lead.id}, from_number=${businessLineForLead}`);

    // Delete session (cleanup)
    await deleteSession(callSid);
    console.log(`✅ Session deleted: ${callSid}`);

  } catch (error) {
    console.error(`❌ Error processing call completion:`, error.message);
    console.error(`   Stack:`, error.stack);
    // Don't throw - this is async processing
  }
}

// SMS Status Callback
app.post('/sms-status', async (req, res) => {
  console.log(`\n📱 SMS STATUS UPDATE:`);
  console.log(`   Message SID: ${req.body.MessageSid}`);
  console.log(`   Status: ${req.body.MessageStatus}`);
  
  if (req.body.MessageStatus === 'failed' || req.body.MessageStatus === 'undelivered') {
    console.error(`❌ SMS DELIVERY FAILED!`);
    console.error(`   Reason: ${req.body.ErrorMessage || 'Unknown'}`);
  }
  
  res.sendStatus(200);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    supabase: !!process.env.SUPABASE_URL,
    openrouter: !!openRouterKey,
    twilio: !!process.env.TWILIO_ACCOUNT_SID,
    emailConfigured: !!(process.env.BUSINESS_OWNER_EMAIL && process.env.EMAIL_APP_PASSWORD),
    businessOwnerEmail: process.env.BUSINESS_OWNER_EMAIL ? 'set' : 'missing',
    emailAppPassword: process.env.EMAIL_APP_PASSWORD ? 'set' : 'missing'
  });
});

// TEST ENDPOINT - Hit this from browser to verify server is reachable
app.get('/test', (req, res) => {
  console.log(`\n🧪 [TEST] Test endpoint hit!`);
  console.log(`   Time: ${new Date().toISOString()}`);
  console.log(`   Headers:`, JSON.stringify(req.headers, null, 2));
  res.json({ 
    message: 'Server is reachable!',
    timestamp: new Date().toISOString(),
    publicUrl: process.env.PUBLIC_URL,
    serverPort: process.env.PHONE_SERVER_PORT || 3001
  });
});

// TEST EMAIL - Verify email config works without making a call
app.get('/test-email', async (req, res) => {
  console.log(`\n🧪 [TEST-EMAIL] Test email requested`);
  const result = await sendEmailNotification({
    customerName: 'Test User',
    phoneNumber: '+15551234567',
    serviceNeeded: 'Test from /test-email endpoint',
    urgency: 'low',
    preferredCallback: null,
    address: null
  }, 'test-call-sid');
  res.json({ 
    success: result,
    message: result ? 'Test email sent! Check your inbox.' : 'Email failed. Check server console for details.',
    emailConfigured: !!(process.env.BUSINESS_OWNER_EMAIL && process.env.EMAIL_APP_PASSWORD)
  });
});

// TEST VOICE ENDPOINT - Simple XML response
app.get('/test-voice', (req, res) => {
  console.log(`\n🧪 [TEST-VOICE] Test voice endpoint hit!`);
  const twiml = new VoiceResponse();
  twiml.say({ voice: 'Polly.Joanna-Neural' }, "Test endpoint is working!");
  res.type('text/xml');
  res.send(twiml.toString());
});

// Only start server if run directly
if (require.main === module) {
  // Railway/Render set PORT automatically, fallback to 3001
  // Note: Cloudflare tunnel can point to any port, but default is 3001
  const PORT = process.env.PORT || process.env.PHONE_SERVER_PORT || 3001;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n📞 Phone Server running on Port ${PORT}`);
    console.log(`✅ Supabase: ${process.env.SUPABASE_URL ? 'Configured' : '❌ MISSING'}`);
    console.log(`✅ OpenRouter: ${openRouterKey ? 'Configured' : '❌ MISSING'}`);
    console.log(`✅ Twilio: ${process.env.TWILIO_ACCOUNT_SID ? 'Configured' : '❌ MISSING'}`);
    console.log(`✅ ElevenLabs: ${process.env.ELEVENLABS_KEY ? 'Configured' : '⚠️  Optional'}`);
    console.log(`📱 USE_TWILIO_SMS: ${process.env.USE_TWILIO_SMS === 'true' ? 'Enabled' : 'Disabled (logging only)'}`);
    console.log(`📱 SMS to: owner_phone from Config (DB) or MY_CELL_NUMBER in .env — SMS from: profile Twilio number or TWILIO_PHONE_NUMBER`);
    console.log(`📧 Email: ${process.env.BUSINESS_OWNER_EMAIL && process.env.EMAIL_APP_PASSWORD ? `Configured (→ ${process.env.BUSINESS_OWNER_EMAIL})` : '❌ MISSING (need BUSINESS_OWNER_EMAIL + EMAIL_APP_PASSWORD in .env)'}`);
    
    // Show webhook URL (use PUBLIC_URL or infer from host)
    const publicUrl = process.env.PUBLIC_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null) || 'http://your-domain.com';
    console.log(`\n🔗 Configure Twilio webhook: ${publicUrl}/voice`);
    console.log(`🛑 Twilio Status Callback (for lead/email when call ends): ${publicUrl}/call-ended — set on phone number in Twilio Console`);
    console.log(`🌐 Frontend: http://localhost:${PORT}/admin.html`);
    console.log(`\n💡 Production Mode: Sessions persist to Supabase, calls survive restarts\n`);
  });
}

module.exports = { app, sendEmailNotification };
