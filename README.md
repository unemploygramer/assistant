# Baddie Assistant - Node.js + Unity Setup

This project separates the AI logic (Node.js) from the Unity rendering client, making it easier to develop and maintain.

## Architecture

```
┌─────────────┐         HTTP POST          ┌──────────────┐
│   Unity     │ ──────────────────────────► │  Node.js     │
│  (Client)   │                             │  (Server)    │
│             │ ◄────────────────────────── │              │
│  - UI       │      JSON Response          │  - OpenRouter│
│  - Animations│     (mood, face, message,  │  - ElevenLabs│
│  - Lip Sync │       audio base64)         │  - Memory    │
└─────────────┘                             └──────────────┘
```

## Setup Instructions

### 1. Node.js Server Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure API keys:**
   - Copy `env.template` to `.env`
   - Fill in your API keys:
     ```
     OPENROUTER_KEY=your_openrouter_key_here
     ELEVENLABS_KEY=your_elevenlabs_key_here
     ELEVENLABS_VOICE_ID=your_voice_id_here
     CALENDAR_ID=your_calendar_id_here
     GOOGLE_APPLICATION_CREDENTIALS=credentials.json
     ```

3. **Start the server:**
   ```bash
   npm start
   ```
   
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

   The server will run on `http://localhost:3000`

### 2. Unity Setup

1. **Open your Unity project**

2. **Update AIController:**
   - The `AIController.cs` has been simplified - it now just sends messages to your Node.js server
   - In the Unity Inspector, set the `Server Url` field to `http://localhost:3000` (or your server URL)

3. **Remove old dependencies:**
   - You no longer need the `AIKeys` ScriptableObject (API keys are now in Node.js)
   - The Unity project no longer needs direct access to OpenRouter or ElevenLabs APIs

4. **Test the connection:**
   - Make sure the Node.js server is running
   - Type a message in Unity and press Enter
   - You should see the AI response appear

## API Endpoints

### POST `/chat`
Sends a user message and receives AI response.

**Request:**
```json
{
  "message": "Hello, how are you?"
}
```

**Response:**
```json
{
  "target": "Glitch",
  "mood": "Thinking",
  "face": "Smile",
  "message": "I'm doing well, thanks for asking!",
  "audio": "data:audio/mpeg;base64,..."
}
```

### GET `/health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "memorySize": 15
}
```

## File Structure

```
.
├── server.js              # Node.js server (AI logic)
├── calendar.js            # Google Calendar helper (service account auth)
├── package.json           # Node.js dependencies
├── env.template           # API keys template
├── memory.json            # Chat history (auto-generated)
├── credentials.json       # (You provide) Google Service Account JSON (gitignored)
├── Assets/
│   └── AIController.cs    # Simplified Unity client
└── README.md              # This file
```

## Memory Management

- Chat history is automatically saved to `memory.json`
- Memory persists between server restarts
- System prompt is automatically initialized on first run
- History is trimmed to last 30 messages to manage API costs

## Troubleshooting

### Unity can't connect to server
- Make sure Node.js server is running (`npm start`)
- Check the `Server Url` in Unity Inspector matches your server URL
- Check firewall settings if using a different machine

### No audio playing
- Check ElevenLabs API key and Voice ID in `.env`
- Check Unity console for errors
- Verify audio format is supported (MP3)

### AI not responding correctly
- Check OpenRouter API key in `.env`
- Check server console for error messages
- Verify memory.json is being created/loaded

## Development Tips

- **Modify AI personality:** Edit the `getSystemPrompt()` function in `server.js`
- **Change AI model:** Update the `model` field in the OpenRouter request (line ~60 in server.js)
- **Adjust memory size:** Change `maxHistory` variable in `server.js`
- **Customize Unity animations:** Modify the `AnimateFace()` and animation logic in `AIController.cs`

## Security Notes

- Never commit `.env` file to Git (it contains API keys)
- `memory.json` may contain conversation history - consider adding to `.gitignore`
- Never commit `credentials.json` (Service Account private key) to Git
- For production, use environment variables or a secure secrets manager

## Google Calendar Setup (Service Account)

1. Create a Google Cloud **Service Account** and download its JSON key as `credentials.json`.
2. In Google Calendar, share the target calendar with the Service Account email (something like `xxxx@xxxx.iam.gserviceaccount.com`) with permission to **Make changes to events**.
3. Set `CALENDAR_ID` in `.env` (often your Gmail address, or the calendar's ID from Calendar settings).

