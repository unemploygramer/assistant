# AI Receptionist - Bot Configuration Dashboard

A Next.js 14+ dashboard for configuring your AI phone receptionist bot.

## Features

- ✅ Modular configuration form (Business Name, Bot Tone, Custom Knowledge, Required Lead Info)
- ✅ Live system prompt preview (updates in real-time)
- ✅ Supabase integration (save/load from `business_profiles` table)
- ✅ High-end SaaS UI with Tailwind CSS
- ✅ Toast notifications (Sonner)
- ✅ Loading states and error handling

## Setup

### 1. Install Dependencies

```bash
cd receptionist/dashboard
npm install
```

### 2. Set Up Supabase

Run the SQL schema in your Supabase SQL Editor:

```bash
# Copy the SQL from receptionist/dashboard-schema.sql
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000/dashboard/config`

## Using the Prompt Builder in Your Phone Server

The `lib/prompt-builder.ts` utility can be used in your Express.js phone server:

```typescript
// In your phone_server.js or API route
const { buildSystemPrompt } = require('./lib/prompt-builder')

// Fetch config from Supabase
const { data } = await supabase
  .from('business_profiles')
  .select('business_name, bot_config')
  .eq('is_active', true)
  .single()

// Build the prompt
const systemPrompt = buildSystemPrompt({
  config: {
    businessName: data.business_name,
    tone: data.bot_config.tone,
    customKnowledge: data.bot_config.customKnowledge,
    requiredLeadInfo: data.bot_config.requiredLeadInfo
  },
  includeExamples: false // Set to false for actual API calls
})

// Use in your OpenRouter/OpenAI call
const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
  messages: [
    { role: 'system', content: systemPrompt },
    ...conversationHistory
  ],
  model: 'openai/gpt-4o'
})
```

## Project Structure

```
dashboard/
├── app/
│   ├── dashboard/
│   │   └── config/
│   │       └── page.tsx      # Main config page
│   ├── globals.css           # Tailwind styles
│   └── layout.tsx             # Root layout with Toaster
├── lib/
│   ├── supabase/
│   │   └── client.ts          # Supabase client setup
│   └── prompt-builder.ts     # Prompt assembly utility
└── package.json
```

## Tech Stack

- **Next.js 14+** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Lucide React** (Icons)
- **Sonner** (Toast notifications)
- **@supabase/ssr** (Supabase client)
