# 🎤 Voice Chat Flow - Complete Debug Guide

## The Flow (What Should Happen):

1. **Web App** (http://localhost:3000)
   - You speak into microphone OR type text
   - Click 🎤 button or press Enter
   - Message sent to `/chat` endpoint

2. **Server** (Node.js)
   - Receives message at `/chat`
   - Sends to OpenRouter AI (GPT-4)
   - Synthesizes voice with ElevenLabs
   - **Saves response to MAILBOX** (pendingResponse variable)
   - Returns response to web app immediately

3. **Unity** (Polling Loop)
   - Every 0.5 seconds calls `/check-inbox`
   - Server checks if pendingResponse has data
   - If YES → returns data & clears mailbox
   - If NO → returns null
   - Unity plays audio + animates face

---

## 🚀 Server Console Should Show:

```
--- New Incoming Request ---
>> USER MESSAGE: testing please respond to me for the test
🧠 Contacting OpenRouter AI...
🗣️ Synthesizing voice...

🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀
💌 MESSAGE READY IN MAILBOX FOR UNITY
🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀

✅ Message: "Your response text here"
✅ Audio Size: 234.56 KB
✅ Mood: Cocky
✅ Face: Smile
✅ Expressions: 3 items

⏳ Waiting for Unity to pick it up from /check-inbox endpoint...

📡 INBOX CHECK #20: ✅ HAS MESSAGE
🎯🎯🎯 MAILBOX DELIVERED TO UNITY 🎯🎯🎯
   Message: "Your response text here"
   Audio: ✅ YES
```

---

## 🎮 Unity Console Should Show:

```
════════════════════════════════════════════
🎬 AIController STARTING UP
════════════════════════════════════════════

✅ AudioSource already assigned
✅ AUTO-DETECTED MOUTH: Using blendshape 'jawOpen' (Index 5)
🚀 Starting server polling coroutine...
════════════════════════════════════════════

🚀 STARTING POLLING LOOP - Checking: http://localhost:3000/check-inbox
📡 POLL #20: Checking inbox... Response: EMPTY
📡 POLL #40: Checking inbox... Response: EMPTY
✅✅✅ UNITY RECEIVED NEW MESSAGE FROM WEB APP! ✅✅✅
Response: {"message":"Your response text here",...

🎯 HANDLING RESPONSE: {"message":"Your response text...
✅ JSON PARSED SUCCESSFULLY!
   Message: Your response text here
   Target: Glitch
   Mood: Cocky
   Face: Smile
   Audio Length: 234567 characters
   Expressions: 3 items
✅ Text field updated
✅ FaceController updated
🎵 STARTING VOICE PLAYBACK...
🔊 PLAYVOICE STARTED - Audio length: 234567 chars
✂️ Trimmed data URI prefix - New length: 234500
🧹 Cleaned base64 - Final length: 234500
✅ Base64 DECODED SUCCESSFULLY - 45678 bytes
💾 Writing to: /path/to/persistentDataPath/voice_temp.mp3
✅ File written (45678 bytes)
🎬 Loading audio clip from: file:///path/to/persistentDataPath/voice_temp.mp3
✅ AUDIO CLIP LOADED: voice_temp (2.34s)
🔊 ========== AUDIO PLAYING NOW ==========
```

---

## ✅ Checklist Before Testing:

- [ ] Server running: `npm start`
- [ ] Web app open: `http://localhost:3000`
- [ ] `.env` file has `OPENROUTER_KEY` and `ELEVENLABS_KEY`
- [ ] Unity has **AIController script** attached to a GameObject
- [ ] **voiceSource** assigned in Inspector (or let it auto-create)
- [ ] **faceMesh** assigned in Inspector (the goddess mesh)
- [ ] **faceController** assigned in Inspector
- [ ] **jawBone** assigned in Inspector

---

## 🔧 Troubleshooting:

### No audio playing in Unity?
1. Check if server shows "Audio Size: X KB" (not "NO AUDIO")
2. Check Unity console for "AUDIO PLAYING NOW"
3. Make sure `voiceSource.volume > 0`

### "UNITY RECEIVED NEW MESSAGE" never appears?
1. Check if server shows "MESSAGE READY IN MAILBOX"
2. Check if `/check-inbox` endpoint is being called (server polls log)
3. Make sure Unity's `/check-inbox` URL matches server URL

### "No audio in packet" warning?
1. Check if ElevenLabs key is valid in `.env`
2. Check if `ELEVENLABS_VOICE_ID` is set

### Text not updating on screen?
1. Check if `aiTextField` is assigned in Inspector
2. Check if it's the correct TextMeshPro component

### Face not animating?
1. Check if `faceController` is assigned
2. Check if `faceMesh` is assigned
3. Check if blendshape was detected (should say "AUTO-DETECTED MOUTH")

---

## 📊 Real-Time Debugging:

Watch **both consoles** at the same time:
1. **Server Console** (Node.js terminal)
2. **Unity Console** (F12 in Play mode)

They should sync up! When you speak:
- Server shows "MESSAGE READY IN MAILBOX"
- Unity shows "UNITY RECEIVED NEW MESSAGE"
- Audio starts playing

If they don't sync, check network logs:
- Open browser DevTools (F12)
- Go to Network tab
- Filter for `check-inbox` requests
- Verify status is 200 (success)
