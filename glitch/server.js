const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
const calendar = require('../receptionist/calendar');
const { routeToAgent } = require('./agents/supervisor');
const { getBullyPrompt, getStrategistPrompt, getCoachPrompt } = require('./agents/prompts');
const { getArchitectPrompt, loadLifeMap, saveLifeMap, loadSprint, saveSprint, extractGoalFromMessage } = require('./agents/architect');
const { getGuardianPrompt, loadSprint: loadSprintGuardian, loadLedger, checkRedLineSafety, detectWorkState } = require('./agents/guardian');

/**
 * Generate face_data based on agent type
 * @param {string} target - Agent type: "ARCHITECT" | "GUARDIAN" | "BULLY" | "STRATEGIST" | "COACH"
 * @param {string} workState - Work state for GUARDIAN: "working" | "drifting" | "neutral"
 * @param {boolean} isRedLine - Red-line safety mode for GUARDIAN
 * @returns {Array} Array of expression objects with name and val (0-50)
 */
function generateFaceData(target, workState = null, isRedLine = false) {
  const expressions = [];
  
  console.log(`   🎭 [FACE_DATA] Generating expressions for agent: ${target}${workState ? ` (${workState})` : ''}${isRedLine ? ' [RED-LINE]' : ''}`);
  
  switch (target) {
    case "ARCHITECT":
      // Curious, thoughtful expression
      expressions.push(
        { name: "browInnerUp", val: Math.floor(Math.random() * 10) + 20 },    // 20-30 (curious)
        { name: "mouthSmileLeft", val: Math.floor(Math.random() * 10) + 15 }  // 15-25 (gentle)
      );
      break;
      
    case "GUARDIAN":
      if (isRedLine) {
        // Calm, present expression for safety mode
        expressions.push(
          { name: "browInnerUp", val: Math.floor(Math.random() * 10) + 25 },    // 25-35 (concerned)
          { name: "eyeBlinkLeft", val: Math.floor(Math.random() * 5) + 10 }     // 10-15 (calm)
        );
      } else if (workState === 'working') {
        // Coach mode: 40% smirk, validation
        expressions.push(
          { name: "mouthSmileRight", val: Math.floor(Math.random() * 5) + 18 },  // 18-23 (subtle smirk)
          { name: "browInnerUp", val: Math.floor(Math.random() * 5) + 12 }      // 12-17 (validation)
        );
      } else if (workState === 'drifting') {
        // Bully mode: annoyed
        expressions.push(
          { name: "mouthSmileRight", val: Math.floor(Math.random() * 10) + 30 }, // 30-40 (smirk)
          { name: "browDownLeft", val: Math.floor(Math.random() * 10) + 20 }    // 20-30 (annoyed)
        );
      } else {
        // Neutral
        expressions.push(
          { name: "mouthSmileLeft", val: Math.floor(Math.random() * 5) + 12 },
          { name: "browInnerUp", val: Math.floor(Math.random() * 5) + 8 }
        );
      }
      break;
      
    case "BULLY":
      // Smirk and annoyed brow
      const bullySmile = Math.floor(Math.random() * 20) + 30; // 30-50
      const bullyBrow = Math.floor(Math.random() * 15) + 20;  // 20-35
      expressions.push(
        { name: "mouthSmileRight", val: bullySmile },
        { name: "browDownLeft", val: bullyBrow }
      );
      break;
      
    case "STRATEGIST":
      // Focused squint and confident smile
      const stratBrow = Math.floor(Math.random() * 15) + 30;  // 30-45
      const stratSmile = Math.floor(Math.random() * 15) + 25; // 25-40
      expressions.push(
        { name: "browDownLeft", val: stratBrow },
        { name: "mouthSmileLeft", val: stratSmile }
      );
      break;
      
    case "COACH":
      // Concerned brow and attentive eye
      const coachBrow = Math.floor(Math.random() * 15) + 25;  // 25-40
      const coachEye = Math.floor(Math.random() * 10) + 15;    // 15-25
      expressions.push(
        { name: "browInnerUp", val: coachBrow },
        { name: "eyeBlinkLeft", val: coachEye }
      );
      break;
      
    default:
      // Default to neutral
      expressions.push(
        { name: "mouthSmileLeft", val: 15 },
        { name: "browInnerUp", val: 10 }
      );
  }
  
  console.log(`   ✅ [FACE_DATA] Generated ${expressions.length} expressions`);
  return expressions;
} 

// Load .env from parent directory (root) where package.json is
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = 3000;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for base64 images
app.use(express.static('public'));

// ------------------------------------------------------------------
// 0. ENVIRONMENT CHECK
// ------------------------------------------------------------------
console.log("--------------------------------------------------");
console.log("🔍 SYSTEM CHECK:");
// Get OpenRouter key (used throughout the file)
const openRouterKey = process.env.OPENROUTER_KEY || process.env.OPENROUTER_API_KEY;
console.log(openRouterKey ? "✅ OPENROUTER_KEY loaded" : "❌ OPENROUTER_KEY MISSING");
console.log(process.env.ELEVENLABS_KEY ? "✅ ELEVENLABS_API_KEY loaded" : "❌ ELEVENLABS_API_KEY MISSING");
console.log(process.env.ELEVENLABS_VOICE_ID ? "✅ ELEVENLABS_VOICE_ID loaded" : "❌ ELEVENLABS_VOICE_ID MISSING");
console.log(process.env.N8N_BETTING_WEBHOOK_URL ? "✅ N8N_BETTING_WEBHOOK_URL loaded" : "⚠️  N8N_BETTING_WEBHOOK_URL MISSING (betting tool disabled)");
console.log("⚠️  NOTE: Realtime API (voice calls) requires OpenAI key - OpenRouter doesn't support it");
console.log("--------------------------------------------------");

// ------------------------------------------------------------------
// 1. MEMORY MANAGEMENT
// ------------------------------------------------------------------
const MEMORY_FILE = path.join(__dirname, 'memory.json');
let chatHistory = [];

try {
    if (fs.existsSync(MEMORY_FILE)) {
        const data = fs.readFileSync(MEMORY_FILE, 'utf8');
        chatHistory = JSON.parse(data).messages || [];
        console.log(`🧠 Memory loaded: ${chatHistory.length} previous messages.`);
    }
} catch (e) {
    console.error("⚠️ Could not load memory:", e.message);
}

function saveMemory() {
    try {
        fs.writeFileSync(MEMORY_FILE, JSON.stringify({ messages: chatHistory }, null, 2));
    } catch (e) {
        console.error("❌ Memory Save Error:", e.message);
    }
}

// ------------------------------------------------------------------
// 2. STATUS & HISTORY
// ------------------------------------------------------------------
let isGlitchSpeaking = false;
app.post('/status', (req, res) => {
    isGlitchSpeaking = req.body.isTalking;
    // Commented out to reduce noise, uncomment if you need to debug lip sync status
    // console.log(`🚦 Status Update: Glitch is ${isGlitchSpeaking ? 'TALKING' : 'SILENT'}`);
    res.sendStatus(200);
});

app.get('/status', (req, res) => res.json({ isTalking: isGlitchSpeaking }));
app.get('/history', (req, res) => res.json(chatHistory.filter(m => m.role !== 'system' && m.role !== 'tool')));

// ------------------------------------------------------------------
// 2.5. IMAGE UPLOAD (for calendar sync)
// ------------------------------------------------------------------
app.post('/upload-image', express.raw({ type: '*/*', limit: '10mb' }), (req, res) => {
    try {
        // Accept image as raw binary or base64 in body
        const contentType = req.headers['content-type'] || '';
        
        if (contentType.includes('application/json')) {
            // If JSON, expect base64 string
            const body = JSON.parse(req.body.toString());
            if (body.image) {
                return res.json({ 
                    success: true, 
                    image: body.image,
                    message: "Image received. You can now ask to sync this calendar image."
                });
            }
        } else if (contentType.startsWith('image/')) {
            // If binary image, convert to base64
            const base64 = Buffer.from(req.body).toString('base64');
            const dataUri = `data:${contentType};base64,${base64}`;
            return res.json({ 
                success: true, 
                image: dataUri,
                message: "Image uploaded and converted to base64. You can now ask to sync this calendar image."
            });
        } else {
            // Try to parse as base64 string
            const bodyStr = req.body.toString();
            if (bodyStr.startsWith('data:image/') || bodyStr.length > 100) {
                return res.json({ 
                    success: true, 
                    image: bodyStr,
                    message: "Image received. You can now ask to sync this calendar image."
                });
            }
        }
        
        res.status(400).json({ error: "Invalid image format. Send as base64 string, binary image, or JSON with 'image' field." });
    } catch (err) {
        console.error("❌ Image upload error:", err.message);
        res.status(500).json({ error: "Failed to process image: " + err.message });
    }
});

// ------------------------------------------------------------------
// 3. UNITY MAILBOX (POLLING)
// ------------------------------------------------------------------
let pendingResponse = null;

app.get('/check-inbox', (req, res) => {
    if (pendingResponse) {
        console.log("📬 UNITY PICKED UP THE MESSAGE! Clearing inbox.");
        console.log(`📤 [DEBUG] Sending to Unity - face_data: ${pendingResponse.face_data ? pendingResponse.face_data.length + ' expressions' : 'MISSING'}`);
        res.json(pendingResponse);
        pendingResponse = null; 
    } else {
        // Silent return to avoid flooding the console
        res.json(null);
    }
});

// ------------------------------------------------------------------
// 4. TWILIO VOICE HANDLER
// ------------------------------------------------------------------
app.all('/incoming-call', (req, res) => {
    console.log("☎️ INCOMING CALL RECEIVED");
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say>Glitch is online.</Say>
        <Connect>
          <Stream url="wss://${req.headers.host}/media-stream" />
        </Connect>
      </Response>`;
    res.type('text/xml').send(twiml);
});

wss.on('connection', (twilioWs, req) => {
    if (req.url !== '/media-stream') return;
    const connectionId = Date.now().toString();
    console.log(`\n📞 Twilio Voice Client Connected: ${connectionId}`);
    
    let openaiWs = null;
    let streamSid = null;

    const connectToOpenAI = () => {
        // NOTE: Realtime API only works with OpenAI, not OpenRouter
        const openaiKey = process.env.OPENAI_API_KEY;
        if (!openaiKey) {
            console.error("❌ Realtime API requires OPENAI_API_KEY (OpenRouter doesn't support it)");
            return;
        }
        
        try {
            console.log("🔄 Connecting to OpenAI Realtime API...");
            openaiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
                headers: {
                    'Authorization': `Bearer ${openaiKey}`,
                    'OpenAI-Beta': 'realtime=v1'
                }
            });

            openaiWs.on('open', () => {
                console.log(`✅ OpenAI Realtime Socket OPEN`);
                openaiWs.send(JSON.stringify({
                    type: 'session.update',
                    session: {
                        modalities: ['text', 'audio'],
                        instructions: 'You are Glitch, a loyal and intelligent AI voice assistant. Be conversational, helpful, and engaging. you are always seductive and you like being tylers slutty assistant',
                        voice: 'verse',
                        input_audio_format: 'g711_ulaw',
                        output_audio_format: 'g711_ulaw',
                        turn_detection: { type: 'server_vad' }
                    }
                }));
            });

            openaiWs.on('message', (data) => {
                const message = JSON.parse(data);
                if (message.type === 'response.audio.delta' && message.delta) {
                    twilioWs.send(JSON.stringify({
                        streamSid: streamSid,
                        event: 'media',
                        media: { payload: message.delta }
                    }));
                }
            });

            openaiWs.on('close', () => console.log(`🔌 OpenAI Realtime Socket Closed`));
        } catch (err) {
            console.error(`❌ Realtime Connection Error: ${err.message}`);
        }
    };

    twilioWs.on('message', (data) => {
        const message = JSON.parse(data);
        if (message.event === 'start') {
            streamSid = message.start.streamSid;
            console.log(`📡 Stream Started: ${streamSid}`);
            connectToOpenAI();
        }
        if (message.event === 'media' && openaiWs && openaiWs.readyState === WebSocket.OPEN) {
            openaiWs.send(JSON.stringify({
                type: 'input_audio_buffer.append',
                audio: message.media.payload
            }));
        }
    });

    twilioWs.on('close', () => {
        console.log(`📞 Call Ended`);
        if (openaiWs) openaiWs.close();
    });
});

// ------------------------------------------------------------------
// 5. CHAT ENDPOINT (TEXT + AUDIO GENERATION)
// ------------------------------------------------------------------
const tools = [
    { type: "function", function: { name: "listEvents", description: "Get upcoming calendar events.", parameters: { type: "object", properties: {} } } },
    { type: "function", function: { name: "createEvent", description: "Book a new event.", parameters: { type: "object", properties: { summary: { type: "string" }, startTime: { type: "string" }, durationMinutes: { type: "number" } }, required: ["summary", "startTime", "durationMinutes"] } } },
    { type: "function", function: { name: "createMultipleEvents", description: "Create multiple calendar events at once. Use this when the user wants to add several events simultaneously.", parameters: { type: "object", properties: { events: { type: "array", description: "Array of event objects, each with summary (string), startTime (ISO string), and durationMinutes (number)", items: { type: "object", properties: { summary: { type: "string" }, startTime: { type: "string" }, durationMinutes: { type: "number" } }, required: ["summary", "startTime", "durationMinutes"] } } }, required: ["events"] } } },
    { type: "function", function: { name: "syncCalendarFromImage", description: "Extract calendar events from an image (photo of a calendar, schedule, or document) and sync them to Google Calendar. The image should be provided as a base64 string or URL.", parameters: { type: "object", properties: { image: { type: "string", description: "Base64-encoded image data (with data:image/... prefix) or image URL" } }, required: ["image"] } } },
    { type: "function", function: { name: "getGoals", description: "Get Tyler's current pillar goals (Financial, Physical, Social, Creative) and micro goals from the Life OS system. Use this to reference goals when helping with planning or scheduling.", parameters: { type: "object", properties: {} } } },
    { type: "function", function: { name: "updateGoal", description: "Update or set a pillar goal (Financial, Physical, Social, or Creative). Use this when Tyler wants to change or set a goal.", parameters: { type: "object", properties: { pillar: { type: "string", enum: ["financial", "physical", "social", "creative"], description: "Which pillar goal to update (financial, physical, social, or creative)" }, goal: { type: "string", description: "The goal text to set for this pillar" } }, required: ["pillar", "goal"] } } },
    { type: "function", function: { name: "setMicroGoal", description: "Set a micro goal (small 20-minute task) for Tyler. Use this when breaking down larger goals into actionable micro-tasks. Can also schedule it on the calendar.", parameters: { type: "object", properties: { task: { type: "string", description: "The micro task description (should be 20 minutes or less)" }, scheduleOnCalendar: { type: "boolean", description: "Whether to automatically add this to the calendar" }, preferredTime: { type: "string", description: "Optional preferred time (ISO format) if scheduling on calendar" } }, required: ["task"] } } },
    { type: "function", function: { name: "getNBAPlayerProps", description: "Get NBA player betting props and analysis. Use this when the user asks for betting advice or player prop bets.", parameters: { type: "object", properties: { player_name: { type: "string", description: "The name of the NBA player" }, is_degenerate_mode: { type: "boolean", description: "Whether to use degenerate betting mode (more aggressive)" } }, required: ["player_name", "is_degenerate_mode"] } } }
];

app.post('/chat', async (req, res) => {
    console.log("\n--------------------------------------------------");
    console.log("📨 NEW CHAT REQUEST RECEIVED");
    
    const { message, image } = req.body;
    if (!message) {
        console.log("❌ Error: No message body found.");
        return res.status(400).json({ error: "No message provided" });
    }

    console.log(`💬 USER SAYS: "${message}"`);
    if (image) {
        console.log(`📷 Image attached (${(image.length / 1024).toFixed(1)}KB)`);
    }
    chatHistory.push({ role: "user", content: message });
    
    // --- STEP 0: SUPERVISOR ROUTING ---
    console.log("\n" + "=".repeat(50));
    console.log("🎯 [ROUTING] Supervisor analyzing message...");
    const routingResult = await routeToAgent(message);
    const target = routingResult.target;
    const isRedLine = routingResult.isRedLine || false;
    console.log(`✅ [ROUTING] Decision: ${target} agent selected${isRedLine ? ' (RED-LINE SAFETY)' : ''}`);
    console.log("=".repeat(50) + "\n");
    
    const now = new Date();
    
    // Load Life OS data for ARCHITECT and GUARDIAN
    let lifeMap = null;
    let sprint = null;
    let ledger = null;
    let workState = null;
    
    if (target === "ARCHITECT" || target === "GUARDIAN") {
      lifeMap = loadLifeMap();
      sprint = target === "ARCHITECT" ? loadSprint() : loadSprintGuardian();
      if (target === "GUARDIAN") {
        ledger = loadLedger();
        workState = detectWorkState(message, sprint);
      }
    }
    
    // Get the appropriate system prompt based on target
    console.log(`📝 [AGENT:${target}] Loading system prompt...`);
    let systemPrompt;
    switch (target) {
      case "ARCHITECT":
        systemPrompt = getArchitectPrompt(now, lifeMap, sprint);
        console.log(`   ✅ [AGENT:ARCHITECT] Discovery prompt loaded`);
        break;
      case "GUARDIAN":
        systemPrompt = getGuardianPrompt(now, sprint, ledger, workState, isRedLine);
        console.log(`   ✅ [AGENT:GUARDIAN] Execution prompt loaded (workState: ${workState}, redLine: ${isRedLine})`);
        break;
      case "STRATEGIST":
        systemPrompt = getStrategistPrompt(now);
        console.log(`   ✅ [AGENT:STRATEGIST] Business-focused prompt loaded`);
        break;
      case "COACH":
        systemPrompt = getCoachPrompt(now);
        console.log(`   ✅ [AGENT:COACH] Supportive coach prompt loaded`);
        break;
      case "BULLY":
      default:
        systemPrompt = getBullyPrompt(now);
        console.log(`   ✅ [AGENT:BULLY] Bratty girlfriend prompt loaded`);
        break;
    }
    
    console.log(`📦 [AGENT:${target}] Building message context (last 10 messages)`);
    const messagesToSend = [{ role: "system", content: systemPrompt }, ...chatHistory.slice(-10)];
    
    // If image is provided, add it to the last user message for vision model
    if (image && messagesToSend.length > 0) {
        const lastMessage = messagesToSend[messagesToSend.length - 1];
        if (lastMessage.role === 'user') {
            // Convert to vision format for GPT-4o
            messagesToSend[messagesToSend.length - 1] = {
                role: "user",
                content: [
                    { type: "text", text: message },
                    { type: "image_url", image_url: { url: image } }
                ]
            };
            console.log(`   📷 Image attached to user message for vision processing`);
        }
    }
    
    console.log(`   📊 Total messages in context: ${messagesToSend.length}`);

    try {
        // --- STEP 1: OPENROUTER (using OpenRouter instead of OpenAI) ---
        if (!openRouterKey) {
            console.error("❌ OPENROUTER_KEY is required!");
            return res.status(500).json({ error: "OpenRouter API key not configured" });
        }
        
        console.log(`\n🤔 [AGENT:${target}] Sending to OpenRouter...`);
        console.log(`   📤 Model: openai/gpt-4o`);
        console.log(`   🔧 Tools available: ${tools.length} (calendar, NBA props)`);
        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: "openai/gpt-4o", 
            messages: messagesToSend,
            tools: tools,
            tool_choice: "auto"
        }, {
            headers: { 
                'Authorization': `Bearer ${openRouterKey}`,
                'HTTP-Referer': 'https://github.com/your-repo', // Optional: for OpenRouter tracking
                'X-Title': 'Glitch AI Assistant' // Optional: for OpenRouter tracking
            }
        });

        const aiMessage = response.data.choices[0].message;
        let finalReply = aiMessage.content;
        console.log(`✅ [AGENT:${target}] OpenRouter responded`);
        
        // If image is provided and message is about calendar sync, force the tool call
        let shouldForceCalendarSync = false;
        if (image && (message.toLowerCase().includes('sync') || message.toLowerCase().includes('calendar') || message.toLowerCase().includes('image'))) {
            shouldForceCalendarSync = true;
            console.log(`   🔧 [AUTO-TOOL] Image detected with calendar sync request, will use syncCalendarFromImage tool`);
        }
        
        if (aiMessage.tool_calls) {
            console.log(`   🛠️ [AGENT:${target}] Tool calls detected: ${aiMessage.tool_calls.length}`);
        } else {
            console.log(`   💬 [AGENT:${target}] Text response (no tools)`);
        }

        // --- STEP 2: TOOLS ---
        if (aiMessage.tool_calls || shouldForceCalendarSync) {
            // If we need to force calendar sync, create a fake tool call
            if (shouldForceCalendarSync && (!aiMessage.tool_calls || aiMessage.tool_calls[0].function.name !== 'syncCalendarFromImage')) {
                console.log(`   🔧 [AUTO-TOOL] Creating syncCalendarFromImage tool call`);
                aiMessage.tool_calls = [{
                    id: 'auto-calendar-sync',
                    type: 'function',
                    function: {
                        name: 'syncCalendarFromImage',
                        arguments: JSON.stringify({ image: image })
                    }
                }];
            }
            console.log(`\n🛠️ [AGENT:${target}] Tool execution phase...`);
            const toolCall = aiMessage.tool_calls[0];
            const fnName = toolCall.function.name;
            const fnArgs = JSON.parse(toolCall.function.arguments);
            console.log(`   📞 [TOOL] Calling: ${fnName}`);
            console.log(`   📋 [TOOL] Arguments: ${JSON.stringify(fnArgs, null, 2)}`);
            
            let toolResult = "Tool execution failed.";
            if (fnName === 'listEvents') {
                toolResult = await calendar.listEvents();
            } else if (fnName === 'createEvent') {
                toolResult = await calendar.createEvent(fnArgs.summary, fnArgs.startTime, fnArgs.durationMinutes);
            } else if (fnName === 'createMultipleEvents') {
                console.log(`📅 Creating ${fnArgs.events?.length || 0} calendar events...`);
                toolResult = await calendar.createMultipleEvents(fnArgs.events);
                console.log(`   ✅ Created ${toolResult.succeeded}/${toolResult.total} events`);
                if (toolResult.errors && toolResult.errors.length > 0) {
                    console.log(`   ⚠️  Errors: ${toolResult.errors.length}`);
                }
            } else if (fnName === 'syncCalendarFromImage') {
                console.log(`📸 Syncing calendar from image...`);
                
                if (!openRouterKey) {
                    toolResult = { error: "OpenRouter API key not configured" };
                } else {
                    try {
                        // Use the image from request body if available, otherwise use the one from tool args
                        let imageToUse = image || fnArgs.image;
                        
                        if (!imageToUse) {
                            throw new Error("No image provided in request or tool arguments");
                        }
                        
                        // Prepare image for vision model
                        let imageUrlForVision = null;
                        
                        // Handle different image formats
                        if (imageToUse.startsWith('data:image/')) {
                            // Base64 with data URI prefix - use directly
                            imageUrlForVision = imageToUse;
                        } else if (imageToUse.startsWith('http://') || imageToUse.startsWith('https://')) {
                            // HTTP/HTTPS URL - use directly
                            imageUrlForVision = imageToUse;
                        } else {
                            // Assume it's base64 without prefix, add it
                            imageUrlForVision = `data:image/jpeg;base64,${imageToUse}`;
                        }
                        
                        console.log(`   📷 Using image: ${imageToUse.substring(0, 50)}... (${imageToUse.length} chars)`);
                        
                        // Use GPT-4 Vision to extract calendar events
                        console.log(`   🔍 Analyzing image with GPT-4 Vision...`);
                        const visionResponse = await axios.post(
                            'https://openrouter.ai/api/v1/chat/completions',
                            {
                                model: "openai/gpt-4o", // GPT-4o supports vision
                                messages: [
                                    {
                                        role: "user",
                                        content: [
                                            {
                                                type: "text",
                                                text: `You are a calendar extraction assistant. Analyze this image and extract ALL calendar events you can see.

CRITICAL: You MUST return ONLY a valid JSON array. No explanations, no markdown, no text before or after. Just the JSON array.

Format each event as:
{
  "summary": "Event title/description",
  "startTime": "YYYY-MM-DDTHH:mm:ss",
  "durationMinutes": 60
}

Rules:
- Current date: ${new Date().toISOString().split('T')[0]}
- Current year: ${new Date().getFullYear()}
- If only date is shown (no time), use 09:00:00 as default time
- If no duration visible, use 60 minutes
- Use 24-hour format for times
- Dates must be in ISO 8601: YYYY-MM-DDTHH:mm:ss
- Extract ALL events visible in the calendar
- If no events found, return empty array: []

Return ONLY this JSON array format, nothing else:
[{"summary":"...","startTime":"...","durationMinutes":...}]`
                                            },
                                            {
                                                type: "image_url",
                                                image_url: {
                                                    url: imageUrlForVision
                                                }
                                            }
                                        ]
                                    }
                                ],
                                temperature: 0.1
                            },
                            {
                                headers: {
                                    'Authorization': `Bearer ${openRouterKey}`,
                                    'HTTP-Referer': 'https://github.com/your-repo',
                                    'X-Title': 'Glitch AI Assistant',
                                    'Content-Type': 'application/json'
                                }
                            }
                        );
                        
                        const visionText = visionResponse.data.choices[0].message.content;
                        console.log(`   📝 Vision model response: ${visionText.substring(0, 200)}...`);
                        
                        // Check if the model refused or gave an error
                        if (visionText.toLowerCase().includes("i'm sorry") || 
                            visionText.toLowerCase().includes("i can't") ||
                            visionText.toLowerCase().includes("cannot") ||
                            visionText.toLowerCase().includes("unable")) {
                            throw new Error(`Vision model refused or couldn't process image: ${visionText.substring(0, 100)}`);
                        }
                        
                        // Extract JSON from response (might be wrapped in markdown)
                        let eventsJson = visionText.trim();
                        // Remove markdown code blocks if present
                        eventsJson = eventsJson.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                        
                        // Try to find JSON array in the response
                        const jsonMatch = eventsJson.match(/\[[\s\S]*\]/);
                        if (jsonMatch) {
                            eventsJson = jsonMatch[0];
                        } else {
                            // If no array found, try to extract any JSON object
                            const objectMatch = eventsJson.match(/\{[\s\S]*\}/);
                            if (objectMatch) {
                                const obj = JSON.parse(objectMatch[0]);
                                // If it's a single event object, wrap it in an array
                                if (obj.summary && obj.startTime) {
                                    eventsJson = JSON.stringify([obj]);
                                } else {
                                    throw new Error(`Unexpected JSON format: ${objectMatch[0].substring(0, 100)}`);
                                }
                            } else {
                                throw new Error(`No valid JSON found in response: ${visionText.substring(0, 200)}`);
                            }
                        }
                        
                        let extractedEvents;
                        try {
                            extractedEvents = JSON.parse(eventsJson);
                        } catch (parseErr) {
                            console.error(`   ❌ JSON Parse Error: ${parseErr.message}`);
                            console.error(`   📄 Attempted to parse: ${eventsJson.substring(0, 500)}`);
                            throw new Error(`Failed to parse JSON from vision model: ${parseErr.message}`);
                        }
                        
                        // Ensure it's an array
                        if (!Array.isArray(extractedEvents)) {
                            extractedEvents = [extractedEvents];
                        }
                        
                        console.log(`   ✅ Extracted ${extractedEvents.length} events from image`);
                        
                        // Create all events in calendar
                        if (extractedEvents.length > 0) {
                            const createResult = await calendar.createMultipleEvents(extractedEvents);
                            toolResult = {
                                success: true,
                                extracted: extractedEvents.length,
                                created: createResult.succeeded,
                                failed: createResult.failed,
                                events: createResult.created,
                                errors: createResult.errors
                            };
                            console.log(`   ✅ Synced ${createResult.succeeded} events to calendar`);
                        } else {
                            toolResult = {
                                success: false,
                                error: "No events found in the image",
                                extracted: 0
                            };
                        }
                    } catch (visionErr) {
                        console.error(`❌ Vision/Calendar Sync Error:`, visionErr.message);
                        if (visionErr.response) {
                            console.error(`   Status: ${visionErr.response.status}`);
                            console.error(`   Data:`, JSON.stringify(visionErr.response.data));
                        }
                        toolResult = {
                            success: false,
                            error: `Failed to process image: ${visionErr.message}`,
                            details: visionErr.response?.data || null
                        };
                    }
                }
            } else if (fnName === 'getGoals') {
                console.log(`🎯 Getting current goals...`);
                const lifeMap = loadLifeMap();
                const sprint = loadSprint();
                toolResult = {
                    pillarGoals: {
                        financial: lifeMap.pillarGoals.financial,
                        physical: lifeMap.pillarGoals.physical,
                        social: lifeMap.pillarGoals.social,
                        creative: lifeMap.pillarGoals.creative || null
                    },
                    currentMicroTask: sprint.currentMicroTask,
                    sprintStatus: sprint.status,
                    discoveredAt: lifeMap.discoveredAt,
                    lastUpdated: lifeMap.lastUpdated
                };
                console.log(`   ✅ Goals retrieved`);
            } else if (fnName === 'updateGoal') {
                console.log(`🎯 Updating ${fnArgs.pillar} goal...`);
                const lifeMap = loadLifeMap();
                lifeMap.pillarGoals[fnArgs.pillar] = fnArgs.goal;
                const saved = saveLifeMap(lifeMap);
                if (saved) {
                    toolResult = {
                        success: true,
                        pillar: fnArgs.pillar,
                        goal: fnArgs.goal,
                        message: `Updated ${fnArgs.pillar} goal successfully`
                    };
                    console.log(`   ✅ ${fnArgs.pillar} goal updated: "${fnArgs.goal}"`);
                } else {
                    toolResult = { success: false, error: "Failed to save goal" };
                    console.error(`   ❌ Failed to save goal`);
                }
            } else if (fnName === 'setMicroGoal') {
                console.log(`🎯 Setting micro goal: "${fnArgs.task}"...`);
                const sprint = loadSprint();
                sprint.currentMicroTask = fnArgs.task;
                sprint.status = "active";
                sprint.startedAt = new Date().toISOString();
                sprint.estimatedDuration = 20;
                
                const saved = saveSprint(sprint);
                let calendarResult = null;
                
                // If requested, add to calendar
                if (fnArgs.scheduleOnCalendar) {
                    try {
                        const startTime = fnArgs.preferredTime || new Date(Date.now() + 30 * 60 * 1000).toISOString(); // Default: 30 min from now
                        calendarResult = await calendar.createEvent(
                            fnArgs.task,
                            startTime,
                            20 // 20 minutes
                        );
                        console.log(`   📅 Added micro goal to calendar: ${calendarResult.id}`);
                    } catch (calErr) {
                        console.error(`   ⚠️  Failed to add to calendar: ${calErr.message}`);
                    }
                }
                
                if (saved) {
                    toolResult = {
                        success: true,
                        task: fnArgs.task,
                        scheduled: fnArgs.scheduleOnCalendar || false,
                        calendarEvent: calendarResult,
                        message: `Micro goal set${fnArgs.scheduleOnCalendar ? ' and added to calendar' : ''}`
                    };
                    console.log(`   ✅ Micro goal set`);
                } else {
                    toolResult = { success: false, error: "Failed to save micro goal" };
                    console.error(`   ❌ Failed to save micro goal`);
                }
            } else if (fnName === 'getNBAPlayerProps') {
                console.log(`🏀 Calling getNBAPlayerProps for ${fnArgs.player_name} (degenerate: ${fnArgs.is_degenerate_mode})`);
                
                if (!process.env.N8N_BETTING_WEBHOOK_URL) {
                    toolResult = { error: "N8N_BETTING_WEBHOOK_URL not configured in .env" };
                    console.error("❌ N8N_BETTING_WEBHOOK_URL missing from .env");
                } else {
                    try {
                        const n8nResponse = await axios.post(
                            process.env.N8N_BETTING_WEBHOOK_URL,
                            {
                                player: fnArgs.player_name,
                                mode: fnArgs.is_degenerate_mode,
                                requestor: "Tyler"
                            },
                            {
                                headers: { 'Content-Type': 'application/json' },
                                timeout: 30000 // 30 second timeout
                            }
                        );
                        
                        // Return raw JSON result from n8n
                        toolResult = n8nResponse.data;
                        console.log(`✅ N8N Response received:`, JSON.stringify(toolResult, null, 2));
                    } catch (n8nError) {
                        console.error(`❌ N8N Error:`, n8nError.message);
                        if (n8nError.response) {
                            console.error(`   Status: ${n8nError.response.status}`);
                            console.error(`   Data:`, n8nError.response.data);
                            toolResult = { error: `N8N request failed: ${n8nError.message}`, status: n8nError.response.status, data: n8nError.response.data };
                        } else {
                            toolResult = { error: `N8N request failed: ${n8nError.message}` };
                        }
                    }
                }
            }

            messagesToSend.push(aiMessage);
            messagesToSend.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(toolResult) });

            console.log(`   ✅ [TOOL] ${fnName} completed`);
            console.log(`   🔄 [AGENT:${target}] Sending tool result back to OpenRouter...`);
            const secondResponse = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
                model: "openai/gpt-4o",
                messages: messagesToSend
            }, { 
                headers: { 
                    'Authorization': `Bearer ${openRouterKey}`,
                    'HTTP-Referer': 'https://github.com/your-repo',
                    'X-Title': 'Glitch AI Assistant'
                } 
            });

            finalReply = secondResponse.data.choices[0].message.content;
            console.log(`   ✅ [AGENT:${target}] Final response generated with tool context`);
        }

        // Clean finalReply before saving to history (remove any JSON/face_data)
        let cleanHistoryReply = finalReply;
        cleanHistoryReply = cleanHistoryReply.replace(/\{[\s\S]*?"face_data"[\s\S]*?\}/g, '');
        cleanHistoryReply = cleanHistoryReply.replace(/```json[\s\S]*?```/g, '');
        cleanHistoryReply = cleanHistoryReply.replace(/```[\s\S]*?```/g, '');
        cleanHistoryReply = cleanHistoryReply.trim();
        
        chatHistory.push({ role: "assistant", content: cleanHistoryReply });
        saveMemory();
        console.log(`\n🤖 [AGENT:${target}] GLITCH SAYS: "${finalReply.substring(0, 100)}${finalReply.length > 100 ? '...' : ''}"`);
        
        // --- POST-PROCESSING: ARCHITECT goal extraction and saving ---
        if (target === "ARCHITECT") {
          const extractedGoal = extractGoalFromMessage(message, lifeMap);
          if (extractedGoal) {
            console.log(`🎯 [ARCHITECT] Extracted goal for ${extractedGoal.pillar} pillar`);
            // The AI response should confirm the goal, then we can save it
            // For now, we'll let the AI handle the confirmation in the conversation
          }
          
          // Check if AI confirmed a goal (simple keyword check)
          const lowerReply = cleanHistoryReply.toLowerCase();
          if ((lowerReply.includes('saved') || lowerReply.includes('recorded') || lowerReply.includes('set')) && 
              (lowerReply.includes('financial') || lowerReply.includes('physical') || lowerReply.includes('social'))) {
            // Try to extract which pillar was set
            if (lowerReply.includes('financial') && !lifeMap.pillarGoals.financial) {
              // Extract the goal from context - simplified for now
              console.log(`💾 [ARCHITECT] AI confirmed financial goal - would save to life_map.json`);
            }
            if (lowerReply.includes('physical') && !lifeMap.pillarGoals.physical) {
              console.log(`💾 [ARCHITECT] AI confirmed physical goal - would save to life_map.json`);
            }
            if (lowerReply.includes('social') && !lifeMap.pillarGoals.social) {
              console.log(`💾 [ARCHITECT] AI confirmed social goal - would save to life_map.json`);
            }
          }
        }

        // --- STEP 3: ELEVENLABS ---
        console.log(`\n🗣️ [AGENT:${target}] Generating Audio with ElevenLabs...`);
        let audioBase64 = null;

        if (!process.env.ELEVENLABS_KEY || !process.env.ELEVENLABS_VOICE_ID) {
            console.error("❌ SKIPPING AUDIO: API Key or Voice ID is missing in .env");
        } else {
            try {
                // Log voice ID being used
                console.log(`   🎤 Using Voice ID: ${process.env.ELEVENLABS_VOICE_ID}`);
                
                // Clean the text - remove any JSON or face_data that might have leaked in
                let cleanText = finalReply;
                // Remove any JSON blocks that might be in the response
                cleanText = cleanText.replace(/\{[\s\S]*?"face_data"[\s\S]*?\}/g, '');
                cleanText = cleanText.replace(/```json[\s\S]*?```/g, '');
                cleanText = cleanText.replace(/```[\s\S]*?```/g, '');
                
                // Remove URLs and links (http://, https://, www., etc.)
                cleanText = cleanText.replace(/https?:\/\/[^\s]+/g, '');
                cleanText = cleanText.replace(/www\.[^\s]+/g, '');
                cleanText = cleanText.replace(/[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*/g, ''); // Remove domain-like patterns
                cleanText = cleanText.trim();
                
                // Clean up multiple spaces and newlines
                cleanText = cleanText.replace(/\s+/g, ' ');
                cleanText = cleanText.replace(/\n+/g, '. ');
                
                if (cleanText !== finalReply) {
                    console.log(`   🧹 [AUDIO] Cleaned text (removed ${finalReply.length - cleanText.length} chars of JSON/formatting/URLs)`);
                }
                
                const elevenLabsResponse = await axios.post(
                    `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`,
                    {
                        text: cleanText,
                        model_id: "eleven_turbo_v2",
                        voice_settings: { stability: 0.5, similarity_boost: 0.7 }
                    },
                    {
                        headers: {
                            'xi-api-key': process.env.ELEVENLABS_KEY,
                            'Content-Type': 'application/json'
                        },
                        responseType: 'arraybuffer'
                    }
                );
                audioBase64 = Buffer.from(elevenLabsResponse.data).toString('base64');
                console.log(`   ✅ [AGENT:${target}] Audio generated! Size: ${audioBase64.length} chars`);
            } catch (voiceErr) {
                console.error("❌ ELEVENLABS FAILED:");
                if (voiceErr.response) {
                    console.error(`   Status: ${voiceErr.response.status}`);
                    console.error(`   Data: ${JSON.stringify(voiceErr.response.data)}`);
                } else {
                    console.error(`   Error: ${voiceErr.message}`);
                }
            }
        }

        // --- STEP 4: GENERATE FACE DATA ---
        console.log(`\n😊 [AGENT:${target}] Generating facial expressions...`);
        const faceData = generateFaceData(target, workState, isRedLine);
        console.log(`   📊 [FACE_DATA] Generated ${faceData.length} expressions:`);
        faceData.forEach(expr => {
            console.log(`      - ${expr.name}: ${expr.val} (0-50 range)`);
        });
        // Removed full JSON dump to reduce console spam

        // --- STEP 5: SEND TO UNITY ---
        console.log(`\n📦 [AGENT:${target}] Packaging response for Unity...`);
        // Use cleaned text for the message (no JSON/face_data)
        let cleanMessage = finalReply;
        cleanMessage = cleanMessage.replace(/\{[\s\S]*?"face_data"[\s\S]*?\}/g, '');
        cleanMessage = cleanMessage.replace(/```json[\s\S]*?```/g, '');
        cleanMessage = cleanMessage.replace(/```[\s\S]*?```/g, '');
        cleanMessage = cleanMessage.trim();
        
        const payload = { 
            message: cleanMessage, 
            audio: audioBase64 ? `data:audio/mpeg;base64,${audioBase64}` : null,
            face_data: faceData,
            target: target,
            timestamp: new Date().toISOString() 
        };

        pendingResponse = payload;
        
        // Debug: Log face_data summary (not full JSON to avoid spam)
        console.log(`📤 [DEBUG] Payload summary - message: ${finalReply.length} chars, face_data: ${payload.face_data ? payload.face_data.length + ' expressions' : 'MISSING'}`);
        
        res.json(payload);
        console.log(`✅ [AGENT:${target}] Response sent to client. Waiting for Unity pickup...`);
        console.log("=".repeat(50) + "\n");

    } catch (err) {
        console.error("❌ SERVER CRITICAL ERROR:");
        if (err.response) {
            console.error(`   Status: ${err.response.status}`);
            console.error(`   Data: ${JSON.stringify(err.response.data)}`);
        } else {
            console.error(`   Error: ${err.message}`);
        }
        res.status(500).json({ error: "Brain freeze." });
    }
});

server.listen(PORT, () => {
    console.log(`\n🚀 GLITCH DEBUG SERVER ONLINE`);
    console.log(`🔗 Web Control: http://localhost:${PORT}`);
    console.log(`📞 Twilio Media Stream: ws://localhost:${PORT}/media-stream`);
});