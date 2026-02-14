// phone_server.js - Production-Ready AI Phone Receptionist with Supabase
// Load .env from parent directory (root) where package.json is
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const VoiceResponse = require('twilio').twiml.VoiceResponse;
const twilio = require('twilio');
const nodemailer = require('nodemailer');
const { upsertSession, getSession, deleteSession, saveLead, logNotification, updateNotification } = require('./lib/db');

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

Once you have all the information, briefly confirm it back and let them know someone will contact them soon. Keep it conversational, not scripted.`;

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

// Helper: Get AI response with resilience (call stays live on failure)
async function getAIResponse(messages, callSid) {
  console.log(`🤖 [AI] Getting response for call ${callSid}`);
  console.log(`   Messages in context: ${messages.length}`);
  
  try {
    console.log(`📡 [AI] Calling OpenRouter API (model: openai/gpt-4o)...`);
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: PROFESSIONAL_SYSTEM_PROMPT },
        ...messages
      ],
      model: "openai/gpt-4o",
      temperature: 0.7,
      timeout: 15000 // 15 second timeout
    });

    const response = completion.choices[0].message.content;
    console.log(`✅ [AI] Got response (${response.length} chars)`);
    return response;
  } catch (error) {
    console.error(`❌ [AI] OpenRouter API error for ${callSid}:`, error.message);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, JSON.stringify(error.response.data));
    }
    console.error(`   Stack:`, error.stack);
    // Return fallback message - call stays live
    return "I've caught your details, but my system is lagging. A human will call you back shortly.";
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
  // Check if email is configured
  if (!process.env.BUSINESS_OWNER_EMAIL || !process.env.EMAIL_APP_PASSWORD) {
    console.log(`⚠️ Email not configured - BUSINESS_OWNER_EMAIL or EMAIL_APP_PASSWORD missing`);
    return false;
  }

  try {
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
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email notification sent successfully!`);
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   To: ${mailOptions.to}`);
    console.log(`   Priority: ${mailOptions.priority}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Email notification failed:`, error.message);
    console.error(`   Stack:`, error.stack);
    return false;
  }
}

// Helper: Log notification (with USE_TWILIO_SMS flag) - handles both SMS and Email
async function logNotificationWithSMS(leadId, messageBody, callSid, callDetails) {
  const useTwilioSMS = process.env.USE_TWILIO_SMS === 'true';
  
  // Always send email notification (if configured)
  let emailSent = false;
  if (process.env.BUSINESS_OWNER_EMAIL && process.env.EMAIL_APP_PASSWORD) {
    try {
      emailSent = await sendEmailNotification(callDetails, callSid);
      if (emailSent) {
        // Log email notification to database
        await logNotification({
          leadId: leadId,
          messageBody: messageBody,
          sentStatus: 'sent',
          notificationType: 'email'
        });
      }
    } catch (error) {
      console.error(`⚠️ Email send failed:`, error.message);
      // Continue - email is non-critical
    }
  }
  
  // Always log SMS notification to database first
  let notification = null;
  try {
    notification = await logNotification({
      leadId: leadId,
      messageBody: messageBody,
      sentStatus: 'pending',
      notificationType: 'sms'
    });
    console.log(`✅ SMS notification logged to database: ${notification.id}`);
  } catch (error) {
    console.error('❌ Failed to log SMS notification:', error.message);
    // Continue anyway - non-critical
  }

  if (!useTwilioSMS) {
    console.log(`📝 USE_TWILIO_SMS=false - SMS notification saved to database only`);
    if (notification) {
      try {
        await updateNotification(notification.id, { sentStatus: 'logged' });
      } catch (error) {
        console.error(`⚠️ Failed to update notification status (non-critical):`, error.message);
        // Continue - this is non-critical
      }
    }
    return { logged: true, sent: false, emailSent };
  }

  // Try to send SMS via Twilio
  if (!process.env.MY_CELL_NUMBER || !process.env.TWILIO_PHONE_NUMBER) {
    console.log(`⚠️ SMS not configured - notification logged to database`);
    if (notification) {
      try {
        await updateNotification(notification.id, { 
          sentStatus: 'failed',
          errorMessage: 'SMS not configured'
        });
      } catch (error) {
        console.error(`⚠️ Failed to update notification status (non-critical):`, error.message);
        // Continue - this is non-critical
      }
    }
    return { logged: true, sent: false, emailSent };
  }

  try {
    const message = await twilioClient.messages.create({
      body: messageBody,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.MY_CELL_NUMBER,
      statusCallback: `${process.env.PUBLIC_URL || 'http://localhost:3001'}/sms-status`
    });

    console.log(`✅ SMS sent: ${message.sid}`);
    
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
    console.error(`❌ SMS send failed:`, error.message);
    
    if (notification) {
      try {
        await updateNotification(notification.id, {
          sentStatus: 'failed',
          errorMessage: error.message
        });
      } catch (updateError) {
        console.error(`⚠️ Failed to update notification status (non-critical):`, updateError.message);
        // Continue - notification was already logged
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
  const fromNumber = req.body.From;
  
  if (!callSid) {
    console.error(`❌ [VOICE] NO CALL SID IN REQUEST!`);
    res.type('text/xml');
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response><Say>Error processing call.</Say></Response>');
    return;
  }
  
  console.log(`📞 [VOICE] Call SID: ${callSid}`);
  console.log(`📞 [VOICE] From: ${fromNumber}`);

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

  // Initialize or restore session
  const messages = session ? session.transcript_buffer : [];
  const metadata = session ? session.metadata : { fromNumber, startTime: new Date().toISOString() };
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

  console.log(`🎙️ [VOICE] Generating greeting...`);
  const twiml = new VoiceResponse();
  const greeting = "Thank you for calling. How can I assist you today?";
  
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
    method: 'POST'
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

    // Get AI response (with resilience)
    let aiResponse = null;
    try {
      console.log(`🤖 [GATHER] Calling OpenRouter API...`);
      aiResponse = await getAIResponse(messages, callSid);
      console.log(`✅ [GATHER] AI RESPONSE: "${aiResponse}"`);
    } catch (error) {
      console.error(`❌ [GATHER] AI error:`, error.message);
      console.error(`   Stack:`, error.stack);
      aiResponse = "I've caught your details, but my system is lagging. A human will call you back shortly.";
      console.log(`🔄 [GATHER] Using fallback message`);
    }

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

    // Check if conversation is complete
    const isComplete = aiResponse.toLowerCase().includes('thank you') || 
                       aiResponse.toLowerCase().includes('goodbye') ||
                       aiResponse.toLowerCase().includes('have a great day');
    
    if (isComplete) {
      console.log(`✅ [GATHER] Conversation complete - ending call`);
      twiml.hangup();
      
      // Process lead asynchronously (don't block call end)
      console.log(`⏰ [GATHER] Scheduling call completion processing...`);
      setTimeout(async () => {
        await processCallCompletion(callSid);
      }, 1000);
    } else {
      // Continue conversation
      console.log(`👂 [GATHER] Setting up next speech gather...`);
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
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📞 [CALL-ENDED] CALL COMPLETION REQUEST`);
  console.log(`   Timestamp: ${new Date().toISOString()}`);
  console.log(`   Request Body:`, JSON.stringify(req.body, null, 2));
  
  const callSid = req.body.CallSid;
  console.log(`📞 [CALL-ENDED] Call SID: ${callSid}`);
  
  if (!callSid) {
    console.error(`❌ [CALL-ENDED] NO CALL SID IN REQUEST!`);
    res.sendStatus(400);
    return;
  }
  
  // Process asynchronously (don't block response)
  console.log(`⏰ [CALL-ENDED] Processing call completion asynchronously...`);
  processCallCompletion(callSid).catch(err => {
    console.error(`❌ [CALL-ENDED] Error processing call completion:`, err.message);
    console.error(`   Stack:`, err.stack);
  });

  console.log(`✅ [CALL-ENDED] Response sent (processing continues in background)`);
  console.log(`${'='.repeat(60)}\n`);
  res.sendStatus(200);
});

// Process call completion: Fetch transcript, generate summary, save lead, send notification
async function processCallCompletion(callSid) {
  try {
    console.log(`\n📋 Processing call completion for ${callSid}...`);

    // Fetch final transcript from sessions
    const session = await getSession(callSid);
    if (!session || !session.transcript_buffer || session.transcript_buffer.length === 0) {
      console.error(`❌ No transcript found for ${callSid}`);
      return;
    }

    const messages = session.transcript_buffer;
    const metadata = session.metadata || {};
    const fromNumber = metadata.fromNumber || null;

    console.log(`📝 Transcript has ${messages.length} messages`);

    // Generate summary using GPT-4o
    const summary = await generateSummary(messages);
    console.log(`✅ Summary generated:`, JSON.stringify(summary, null, 2));

    // Build transcript text
    const transcriptText = messages.map(m => `${m.role}: ${m.content}`).join('\n');

    // Save to leads table
    const lead = await saveLead({
      phone: summary.phoneNumber || fromNumber,
      transcript: transcriptText,
      summary: summary,
      status: 'new',
      industry: process.env.BUSINESS_TYPE || process.env.BUSINESS_NAME || 'Residential Services',
      callSid: callSid,
      fromNumber: fromNumber
    });

    console.log(`✅ Lead saved: ${lead.id}`);

    // Build notification message
    const businessName = process.env.BUSINESS_NAME || 'Test Business';
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

    // Send email and log SMS notification (with USE_TWILIO_SMS flag)
    await logNotificationWithSMS(lead.id, messageBody, callSid, summary);

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
    twilio: !!process.env.TWILIO_ACCOUNT_SID
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
    
    // Show webhook URL (use PUBLIC_URL or infer from host)
    const publicUrl = process.env.PUBLIC_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null) || 'http://your-domain.com';
    console.log(`\n🔗 Configure Twilio webhook: ${publicUrl}/voice`);
    console.log(`🌐 Frontend: http://localhost:${PORT}/admin.html`);
    console.log(`\n💡 Production Mode: Sessions persist to Supabase, calls survive restarts\n`);
  });
}

module.exports = { app, sendEmailNotification };
