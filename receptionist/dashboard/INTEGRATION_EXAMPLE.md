# Integrating Prompt Builder with Phone Server

This guide shows how to use the `prompt-builder.ts` utility in your Express.js phone server.

## Option 1: Use as TypeScript Module (Recommended)

If you convert `phone_server.js` to TypeScript:

```typescript
import { buildSystemPrompt } from '../dashboard/lib/prompt-builder'
import { createServerSupabase } from '../dashboard/lib/supabase/client'

async function getAIResponse(callSid: string, messages: any[]) {
  // Fetch bot config from Supabase
  const supabase = createServerSupabase()
  const { data: profile } = await supabase
    .from('business_profiles')
    .select('business_name, bot_config')
    .eq('is_active', true)
    .single()

  if (!profile) {
    // Fallback to default prompt
    return getDefaultPrompt()
  }

  // Build dynamic prompt
  const systemPrompt = buildSystemPrompt({
    config: {
      businessName: profile.business_name,
      tone: profile.bot_config.tone || 'professional',
      customKnowledge: profile.bot_config.customKnowledge || '',
      requiredLeadInfo: profile.bot_config.requiredLeadInfo || []
    },
    includeExamples: false // Don't include examples in actual API calls
  })

  // Use in OpenRouter call
  const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
    model: 'openai/gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages
    ]
  })

  return response.data.choices[0].message.content
}
```

## Option 2: Use as JavaScript (Current Setup)

Since your `phone_server.js` is currently JavaScript, you can:

### Step 1: Copy the prompt builder logic

Copy the `buildSystemPrompt` function from `dashboard/lib/prompt-builder.ts` and adapt it to JavaScript:

```javascript
// In phone_server.js or a new lib/prompt-builder.js

const TONE_PROMPTS = {
  professional: `You are a professional phone receptionist. Be courteous, respectful, and maintain a formal yet friendly tone.`,
  casual: `You are a friendly phone receptionist. Be warm, approachable, and conversational.`,
  energetic: `You are an enthusiastic phone receptionist. Be upbeat, positive, and show excitement.`,
  direct: `You are a straightforward phone receptionist. Be clear, concise, and get to the point quickly.`
}

function buildSystemPrompt(config) {
  const { businessName, tone, customKnowledge, requiredLeadInfo } = config
  
  const tonePrompt = TONE_PROMPTS[tone] || TONE_PROMPTS.professional
  
  const requiredInfoList = requiredLeadInfo
    .map(info => `- ${info}`)
    .join('\n') || '- Their name\n- Phone number\n- What service they need'

  const customKnowledgeSection = customKnowledge?.trim()
    ? `\n\nCUSTOM KNOWLEDGE & RULES:\n${customKnowledge.trim()}`
    : ''

  let prompt = `You are a phone receptionist for ${businessName}. ${tonePrompt}

CRITICAL RULES:
- Ask ONE question at a time, wait for their response, then ask the next
- NO troubleshooting, NO technical support - you're collecting leads
- NO long scripts, NO lists of options
- Sound like a real person having a conversation
- Keep your responses under 2 sentences
- Follow up on what they say with relevant questions
- Be friendly, professional, and empathetic
- Your goal is to qualify leads and collect contact info

COLLECT THIS INFORMATION (one at a time):
${requiredInfoList}`

  if (customKnowledgeSection) {
    prompt += customKnowledgeSection
  }

  return prompt
}
```

### Step 2: Use in your phone server

```javascript
// In phone_server.js, replace the hardcoded PROFESSIONAL_SYSTEM_PROMPT

async function getAIResponse(callSid, messages) {
  try {
    // Fetch bot config from Supabase
    const { data: profile, error } = await supabase
      .from('business_profiles')
      .select('business_name, bot_config')
      .eq('is_active', true)
      .single()

    let systemPrompt
    
    if (profile && !error) {
      // Use dynamic prompt from dashboard
      systemPrompt = buildSystemPrompt({
        businessName: profile.business_name,
        tone: profile.bot_config?.tone || 'professional',
        customKnowledge: profile.bot_config?.customKnowledge || '',
        requiredLeadInfo: profile.bot_config?.requiredLeadInfo || []
      })
    } else {
      // Fallback to default
      systemPrompt = PROFESSIONAL_SYSTEM_PROMPT
    }

    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: 'openai/gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ]
    })

    return response.data.choices[0].message.content
  } catch (error) {
    console.error('AI response error:', error)
    return "I've caught your details, but my system is lagging. A human will call you back shortly."
  }
}
```

## Benefits

✅ **Dynamic Configuration**: Change bot personality without code changes  
✅ **Multi-Tenant Ready**: Each business can have its own config  
✅ **Live Preview**: See exactly what prompt will be used  
✅ **Consistent Logic**: Same prompt builder used in dashboard and server
