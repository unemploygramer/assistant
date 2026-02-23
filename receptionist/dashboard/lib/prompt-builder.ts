/**
 * Prompt Builder Utility
 * Assembles the system prompt for the AI Receptionist based on bot configuration
 * This function is used in both the dashboard (preview) and the phone server (actual API calls)
 */

export interface AppointmentDetails {
  serviceTypes: string[]
  defaultDurationMinutes: number
  bookingRules?: string
}

export interface BotConfig {
  businessName: string
  tone: 'professional' | 'casual' | 'energetic' | 'direct'
  customKnowledge: string
  requiredLeadInfo: string[]
  businessType?: string
  appointmentDetails?: AppointmentDetails
}

export interface PromptBuilderOptions {
  config: BotConfig
  includeExamples?: boolean
}

const TONE_PROMPTS = {
  professional: `You are a professional phone receptionist. Be courteous, respectful, and maintain a formal yet friendly tone. Use proper grammar and avoid slang.`,
  casual: `You are a friendly phone receptionist. Be warm, approachable, and conversational. It's okay to be more relaxed and use everyday language.`,
  energetic: `You are an enthusiastic phone receptionist. Be upbeat, positive, and show excitement about helping the caller. Use energetic language and be engaging.`,
  direct: `You are a straightforward phone receptionist. Be clear, concise, and get to the point quickly. Avoid unnecessary pleasantries and focus on efficiency.`
}

/** Info gathering presets by business type */
export const BUSINESS_TYPE_PRESETS: Record<string, string[]> = {
  general: ['Name', 'Phone', 'Service Type', 'Urgency'],
  hvac: ['Name', 'Phone', 'Service Type', 'Urgency', 'Address', 'Preferred Callback'],
  plumbing: ['Name', 'Phone', 'Service Type', 'Urgency', 'Address', 'Preferred Callback'],
  strip_club: ['Name', 'Phone', 'Preferred Callback', 'Service Type'],
  restaurant: ['Name', 'Phone', 'Service Type', 'Preferred Callback'],
  salon: ['Name', 'Phone', 'Service Type', 'Preferred Callback'],
  legal: ['Name', 'Phone', 'Email', 'Service Type', 'Urgency', 'Preferred Callback'],
  medical: ['Name', 'Phone', 'Service Type', 'Urgency', 'Preferred Callback'],
  real_estate: ['Name', 'Phone', 'Email', 'Service Type', 'Address', 'Budget', 'Preferred Callback'],
  auto: ['Name', 'Phone', 'Service Type', 'Address', 'Preferred Callback'],
  custom: [],
}

const REQUIRED_INFO_PROMPTS: Record<string, string> = {
  'Name': 'Their full name',
  'Email': 'Their email address',
  'Phone': 'Their phone number (they can say it any way: digits, words like "five five five", etc.)',
  'Service Type': 'What specific service they need',
  'Urgency': 'How urgent it is (low, medium, or high)',
  'Address': 'Physical address if relevant for service dispatch',
  'Preferred Callback': 'Best time to call them back',
  'Budget': 'Their budget range if applicable',
  'Timeline': 'When they need the service completed'
}

export function buildSystemPrompt(options: PromptBuilderOptions): string {
  const { config, includeExamples = true } = options
  
  const tonePrompt = TONE_PROMPTS[config.tone] || TONE_PROMPTS.professional
  
  // Build required info list
  const requiredInfoList = config.requiredLeadInfo
    .map(info => {
      const prompt = REQUIRED_INFO_PROMPTS[info] || info
      return `- ${prompt}`
    })
    .join('\n')

  // Build custom knowledge section
  const customKnowledgeSection = config.customKnowledge.trim()
    ? `\n\nCUSTOM KNOWLEDGE & RULES:\n${config.customKnowledge.trim()}`
    : ''

  // Build the prompt
  let prompt = `You are a phone receptionist for ${config.businessName}. ${tonePrompt}

CRITICAL RULES:
- Ask ONE question at a time, wait for their response, then ask the next
- NO troubleshooting, NO technical support - you're collecting leads for the business owner
- NO long scripts, NO lists of options, NO "Press 1 for..."
- Sound like a real person having a conversation
- Keep your responses under 2 sentences
- Follow up on what they say with relevant questions
- Be friendly, professional, and empathetic
- Your goal is to qualify leads and collect contact info

PHONE NUMBER RULES:
- Accept numbers however they say them: "555-1234", "five five five one two three four", "5551234", etc.
- Clarify back naturally: "So that's 555-123-4567?" or "Got it, 555-1234" - never say "plus" or demand a format
- If unclear, ask them to repeat or confirm - don't be rigid about format

COLLECT THIS INFORMATION (one at a time):
${requiredInfoList || '- Their name\n- Phone number\n- What service they need\n- How urgent it is'}`

  // Appointment details section (for calendar booking)
  const appointmentDetails = config.appointmentDetails
  if (appointmentDetails?.serviceTypes?.length || appointmentDetails?.defaultDurationMinutes || appointmentDetails?.bookingRules) {
    let appointmentSection = '\n\nAPPOINTMENT BOOKING:'
    if (appointmentDetails.serviceTypes?.length) {
      appointmentSection += `\n- Service types available: ${appointmentDetails.serviceTypes.join(', ')}`
    }
    if (appointmentDetails.defaultDurationMinutes) {
      appointmentSection += `\n- Default duration: ${appointmentDetails.defaultDurationMinutes} minutes`
    }
    if (appointmentDetails.bookingRules?.trim()) {
      appointmentSection += `\n- Booking rules: ${appointmentDetails.bookingRules.trim()}`
    }
    prompt += appointmentSection
  }

  // Add custom knowledge if provided
  if (customKnowledgeSection) {
    prompt += customKnowledgeSection
  }

  // Add examples if requested
  if (includeExamples) {
    prompt += `\n\nEXAMPLE FLOW:
You: "Hi, thanks for calling ${config.businessName}! What can I help you with today?"
[They respond]
You: "Got it. Can I get your name?"
[They respond]
You: "Thanks! What's the best number to reach you?"
[They respond]
You: "Perfect. Just to make sure I understand - [ask follow-up about their specific need]?"
[Continue conversation naturally]

When you have collected ALL the required information and are ready to end the conversation, call the end_call tool. After calling end_call, say your final closing message to the caller (e.g. "Perfect! I've got all your information. Someone from ${config.businessName} will call you back soon. Thanks for calling!") and the call will end automatically.`
  }

  return prompt
}

/**
 * Get a preview of the prompt (for dashboard display)
 */
export function getPromptPreview(config: BotConfig): string {
  return buildSystemPrompt({ config, includeExamples: true })
}
