# Glitch AI Assistant - Technical Readiness Summary

## 1. Core Value Prop

**Glitch** is a multi-agent AI assistant that helps users discover goals, execute tasks, and manage their calendar through natural conversation. The system routes user messages to specialized AI agents (Architect for goal discovery, Guardian for accountability, Bully/Strategist/Coach for different interaction styles) and integrates with a Unity 3D avatar interface for visual interaction, voice synthesis via ElevenLabs, and Google Calendar for scheduling. It can handle text chat, voice calls via Twilio, and image-based calendar syncing.

## 2. Tech Stack

### APIs & Services
- **OpenRouter** (GPT-4o) - Primary LLM for chat and routing
- **ElevenLabs** - Text-to-speech audio generation
- **Twilio** - Voice call handling (WebSocket media streams)
- **Google Calendar API** - Calendar event management (requires service account credentials)
- **N8N Webhook** - NBA betting analysis (optional, requires webhook URL)
- **OpenAI Realtime API** - Voice calls (requires OpenAI key, not OpenRouter)

### Backend Framework
- **Node.js** + **Express.js** - REST API server
- **WebSocket (ws)** - Real-time communication
- **File-based storage** - JSON files for memory, goals, sprint data

### Frontend
- **Unity 3D** - 3D avatar with facial expressions and lip sync
- **HTML/JavaScript** - Web interface for chat and voice input

### Dependencies
- axios, cors, dotenv, express, googleapis, twilio, ws

## 3. Readiness Audit (100% Functional Features)

✅ **Fully Working:**
- Text chat endpoint (`/chat`) with multi-agent routing
- Agent supervisor system (routes to ARCHITECT/GUARDIAN/BULLY/STRATEGIST/COACH)
- Google Calendar integration (list, create, createMultiple, sync from images)
- ElevenLabs TTS audio generation
- Facial expression generation (face_data) based on agent type and work state
- Memory persistence (saves to `memory.json`)
- Life OS system (goal tracking via `life_map.json`, sprint tracking via `sprint.json`)
- Image upload and calendar sync from photos
- Web interface with voice input (browser SpeechRecognition API)
- Unity mailbox polling system (`/check-inbox`)
- Red-line safety detection (basic keyword matching)
- Work state detection (working/drifting/neutral)

⚠️ **Partially Working:**
- Twilio voice calls (requires OpenAI API key, not OpenRouter - see line 257-261)
- NBA betting tool (requires N8N webhook URL in .env)
- Goal extraction from messages (detects keywords but doesn't auto-save - see lines 816-839)

## 4. The Blockers (Broken/Incomplete/Hardcoded)

### Critical Blockers:
1. **Hardcoded User Name**: "Tyler" is hardcoded throughout the codebase:
   - `server.js` line 278: "tylers slutty assistant"
   - `server.js` line 333: "Get Tyler's current pillar goals"
   - `server.js` line 760: `requestor: "Tyler"`
   - `agents/prompts.js`: Multiple references to "Tyler"
   - `agents/supervisor.js` line 33: "Tyler's Life OS"
   - `agents/architect.js` line 119: "helps Tyler discover"
   - `agents/guardian.js` line 103: "Tyler mentioned"

2. **Environment Dependencies**: Missing .env variables will break features:
   - `OPENROUTER_KEY` or `OPENROUTER_API_KEY` (required)
   - `ELEVENLABS_KEY` + `ELEVENLABS_VOICE_ID` (required for audio)
   - `OPENAI_API_KEY` (required for Twilio voice calls)
   - `CALENDAR_ID` (required for calendar operations)
   - `GOOGLE_APPLICATION_CREDENTIALS` or `credentials.json` (required for calendar)
   - `N8N_BETTING_WEBHOOK_URL` (optional, disables betting tool if missing)

3. **File System Dependencies**: Requires specific JSON files:
   - `credentials.json` in project root (Google Calendar service account)
   - `glitch/data/life_map.json` (defaults created if missing)
   - `glitch/data/sprint.json` (defaults created if missing)
   - `glitch/data/ledger.json` (defaults created if missing)

4. **Localhost Hardcoding**: 
   - `server.js` line 951: `http://localhost:${PORT}` (Unity must connect to localhost)
   - `server.js` line 241: Twilio webhook uses `req.headers.host` (needs public URL for production)

5. **Incomplete Features**:
   - Goal auto-save logic (lines 816-839): Detects goals but doesn't actually save them automatically
   - Red-line safety: Basic keyword matching only, no sophisticated detection
   - Work state detection: Simple keyword matching, could be more accurate

6. **Legacy/Placeholder Code**:
   - BULLY, STRATEGIST, COACH agents marked as "legacy mode" in supervisor.js
   - NBA betting tool is optional and requires external N8N service

7. **Scalability Issues**:
   - Memory stored in single JSON file (not multi-user)
   - No database (all data in JSON files)
   - No user authentication or session management
   - Single-user system (all data tied to one user)

## 5. The "Quick Win" (MVP Blocker)

**The single most important technical task to make this MVP-ready:**

**Remove hardcoded "Tyler" references and implement user context system.**

**Why this is critical:**
- Currently impossible to sell to any customer (everything says "Tyler")
- Blocks multi-user deployment
- Prevents white-labeling or customization
- Relatively quick fix (find/replace + add user context parameter)

**Implementation approach:**
1. Add user identification to all API requests (user ID or name parameter)
2. Replace hardcoded "Tyler" strings with user context variable
3. Update all agent prompts to use dynamic user name
4. Update tool descriptions to use dynamic user name
5. Add user context to memory/history (or separate by user)

**Estimated effort:** 2-4 hours of refactoring across ~10 files

**Secondary quick wins (if time permits):**
- Add proper error handling for missing .env variables (graceful degradation)
- Implement goal auto-save (currently detects but doesn't save)
- Add user configuration endpoint (set name, preferences)

---

**Note:** The core functionality is solid, but the system is currently a single-user prototype. The hardcoded user name is the primary blocker preventing it from being a sellable product.
