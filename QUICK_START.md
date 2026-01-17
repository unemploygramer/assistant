# Quick Start Guide

## Step 1: Set up Node.js Server

1. Open terminal in the project root directory
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file (copy from `env.template`):
   ```bash
   # On Windows PowerShell:
   Copy-Item env.template .env
   
   # On Mac/Linux:
   cp env.template .env
   ```

4. Edit `.env` and add your API keys:
   ```
   OPENROUTER_KEY=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
   ELEVENLABS_KEY=sk_303472cf4d33cb56909a26fb3e90fac1fc4c20d239838354
   ELEVENLABS_VOICE_ID=gllMMawbYGTja23oQ3Vu
   ```

5. Start the server:
   ```bash
   npm start
   ```

   You should see:
   ```
   🚀 AI Server running on http://localhost:3000
   📝 Memory loaded: X messages
   ```

## Step 2: Configure Unity

1. Open your Unity project
2. Select the GameObject with `AIController` component
3. In the Inspector, find the `Server Url` field
4. Set it to: `http://localhost:3000`
5. Make sure all other fields are assigned (UI, character mesh, etc.)

## Step 3: Test It!

1. Make sure Node.js server is running
2. Press Play in Unity
3. Type a message in the input field
4. Press Enter
5. Watch Glitch respond! 🎉

## Troubleshooting

**"Could not connect to server"**
- Is the Node.js server running? Check terminal for `🚀 AI Server running...`
- Is the Server Url correct in Unity? Should be `http://localhost:3000`

**No audio playing**
- Check your ElevenLabs Voice ID in `.env`
- Check Unity console for errors

**Server crashes**
- Check that all API keys in `.env` are correct
- Check terminal for error messages
