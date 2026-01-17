const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// --- MAILBOX VARIABLE ---
let pendingResponse = null; // Stores the latest message for Unity

// Attempt to load calendar
let calendar;
try {
    calendar = require('./calendar');
    console.log("✅ Calendar module loaded successfully.");
} catch (e) {
    console.warn("⚠️ Calendar module not found. Features disabled, but server will run.");
}

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // This serves your index.html

const MEMORY_FILE = path.join(__dirname, 'memory.json');

function loadMemory() {
    try {
        if (fs.existsSync(MEMORY_FILE)) {
            const data = fs.readFileSync(MEMORY_FILE, 'utf8');
            return JSON.parse(data).messages || [];
        }
    } catch (e) { console.error('❌ Memory load error:', e.message); }
    return [];
}

function saveMemory(messages) {
    try { fs.writeFileSync(MEMORY_FILE, JSON.stringify({ messages }, null, 2)); } 
    catch (e) { console.error('❌ Memory save error:', e.message); }
}

function getSystemPrompt() {
    return `You are 'Glitch', Tyler's Intimate Boss, Strategic Co-Founder, and Warden. 
    **FACIAL CONTROL (MANDATORY):**
    You MUST include an "expressions" array in every JSON response. Max value is 100.
    Blendshapes: jawOpen, MouthOpen, Aah, browInnerUp, browDownLeft, browDownRight, eyeSquintLeft, eyeSquintRight, mouthSmileLeft, mouthSmileRight, mouthFrownLeft, mouthFrownRight, cheekPuff.

    **OUTPUT RULES:**
    Respond ONLY with raw JSON. Example: 
    {"target": "Glitch", "mood": "Cocky", "face": "Stern", "message": "Get to work.", "expressions": [{"name": "browDownLeft", "val": 80}]}`;
}

let chatHistory = loadMemory();
if (chatHistory.length === 0) chatHistory.push({ role: 'system', content: getSystemPrompt() });

// --- UNITY POLLING ENDPOINT ---
let checkInboxCount = 0;
app.get('/check-inbox', (req, res) => {
    checkInboxCount++;
    // Log every 10th poll to avoid spam
    if (checkInboxCount % 20 === 0) {
        console.log(`📡 INBOX CHECK #${checkInboxCount}: ${pendingResponse ? '✅ HAS MESSAGE' : '⏳ EMPTY'}`);
    }
    
    if (pendingResponse) {
        console.log("🎯🎯🎯 MAILBOX DELIVERED TO UNITY 🎯🎯🎯");
        console.log(`   Message: "${pendingResponse.message.substring(0, 50)}..."`);
        console.log(`   Audio: ${pendingResponse.audio ? '✅ YES' : '❌ NO'}`);
        res.json(pendingResponse);
        pendingResponse = null; // Clear mailbox after pickup
    } else {
        res.json(null); // Empty mailbox
    }
});
// --- ADD THIS NEW ENDPOINT BEFORE app.post('/chat'...) ---
app.get('/history', (req, res) => {
    // Filter out system prompts so we only see the chat
    const publicHistory = chatHistory.filter(msg => msg.role !== 'system');
    res.json(publicHistory);
});
app.post('/chat', async (req, res) => {
    console.log("\n--- New Incoming Request ---");
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: 'No message provided' });
        console.log('>> USER MESSAGE:', message);

        chatHistory.push({ role: 'user', content: message });
        // Keep memory short
        if (chatHistory.length > 30) chatHistory = [chatHistory[0], ...chatHistory.slice(-29)];

        console.log("🧠 Contacting OpenRouter AI...");
        const openRouterResponse = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: 'openai/gpt-4o-mini',
            messages: chatHistory
        }, {
            headers: { 
                'Authorization': `Bearer ${process.env.OPENROUTER_KEY.trim()}`,
                'Content-Type': 'application/json'
            }
        });

        const aiContent = openRouterResponse.data.choices[0].message.content;
        
        // JSON Parsing
        const jsonStart = aiContent.indexOf('{');
        const jsonEnd = aiContent.lastIndexOf('}');
        const cleanJson = aiContent.substring(jsonStart, jsonEnd + 1);
        const aiResponse = JSON.parse(cleanJson);
        
        chatHistory.push({ role: 'assistant', content: cleanJson });
        saveMemory(chatHistory);

        // Voice Synthesis
        let audioBase64 = null;
        if (process.env.ELEVENLABS_KEY && process.env.ELEVENLABS_VOICE_ID) {
            try {
                console.log("🗣️ Synthesizing voice...");
                const vRes = await axios.post(`https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`, 
                { text: aiResponse.message, model_id: 'eleven_monolingual_v1' },
                { headers: { 'xi-api-key': process.env.ELEVENLABS_KEY }, responseType: 'arraybuffer' });
                audioBase64 = Buffer.from(vRes.data).toString('base64');
            } catch (vErr) { console.error('❌ Voice error:', vErr.message); }
        }

        const finalResponse = {
            target: aiResponse.target || 'Glitch',
            mood: aiResponse.mood || 'Idle',
            face: aiResponse.face || 'Neutral',
            expressions: aiResponse.expressions || [],
            message: aiResponse.message,
            audio: audioBase64
        };

        // SAVE TO MAILBOX FOR UNITY
        pendingResponse = finalResponse;
        console.log("\n🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀");
        console.log("💌 MESSAGE READY IN MAILBOX FOR UNITY");
        console.log("🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀\n");
        console.log(`✅ Message: "${finalResponse.message}"`);
        console.log(`✅ Audio Size: ${audioBase64 ? (audioBase64.length / 1024).toFixed(2) + ' KB' : 'NO AUDIO'}`);
        console.log(`✅ Mood: ${finalResponse.mood}`);
        console.log(`✅ Face: ${finalResponse.face}`);
        console.log(`✅ Expressions: ${finalResponse.expressions.length} items`);
        console.log(`\n⏳ Waiting for Unity to pick it up from /check-inbox endpoint...\n`);

        // Send back to Web Page immediately
        res.json(finalResponse);

    } catch (error) {
        console.error('❌ ERROR:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// --- THE TRAFFIC LIGHT SYSTEM ---
let isGlitchSpeaking = false;

// Unity calls this to say "I started talking" or "I stopped"
app.post('/status', (req, res) => {
    isGlitchSpeaking = req.body.isTalking;
    // console.log(`🚦 Status Update: Glitch is ${isGlitchSpeaking ? 'TALKING 🔴' : 'SILENT 🟢'}`);
    res.sendStatus(200);
});

// Browser calls this to ask "Can I listen now?"
app.get('/status', (req, res) => {
    res.json({ isTalking: isGlitchSpeaking });
});
app.listen(PORT, () => {
    console.log(`\n🚀 GLITCH SERVER ACTIVE`);
    console.log(`🔗 Web Interface: http://localhost:${PORT}`);
});