/**
 * Prompt Builder - Assembles system prompt from bot config
 * Same logic as dashboard's prompt-builder.ts (used by phone server)
 */

const TONE_PROMPTS = {
  professional: 'You are a professional phone receptionist. Be courteous, respectful, and maintain a formal yet friendly tone. Use proper grammar and avoid slang.',
  casual: "You are a friendly phone receptionist. Be warm, approachable, and conversational. It's okay to be more relaxed and use everyday language.",
  energetic: 'You are an enthusiastic phone receptionist. Be upbeat, positive, and show excitement about helping the caller. Use energetic language and be engaging.',
  direct: 'You are a straightforward phone receptionist. Be clear, concise, and get to the point quickly. Avoid unnecessary pleasantries and focus on efficiency.'
};

const BUSINESS_TYPE_PRESETS = {
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
};

const REQUIRED_INFO_PROMPTS = {
  'Name': 'Their full name',
  'Email': 'Their email address',
  'Phone': 'Their phone number (they can say it any way: digits, words like "five five five", etc.)',
  'Service Type': 'What specific service they need',
  'Urgency': 'How urgent it is (low, medium, or high)',
  'Address': 'Physical address if relevant for service dispatch',
  'Preferred Callback': 'Best time to call them back',
  'Budget': 'Their budget range if applicable',
  'Timeline': 'When they need the service completed'
};

function buildSystemPrompt(config, includeExamples = false) {
  const businessName = config.businessName || 'Your Business';
  const tone = config.tone || 'professional';
  const customKnowledge = (config.customKnowledge || '').trim();
  let requiredLeadInfo = config.requiredLeadInfo || [];
  if (!requiredLeadInfo.length && config.businessType && BUSINESS_TYPE_PRESETS[config.businessType]) {
    requiredLeadInfo = BUSINESS_TYPE_PRESETS[config.businessType] || [];
  }

  const tonePrompt = TONE_PROMPTS[tone] || TONE_PROMPTS.professional;

  const requiredInfoList = requiredLeadInfo.length > 0
    ? requiredLeadInfo.map(info => `- ${REQUIRED_INFO_PROMPTS[info] || info}`).join('\n')
    : '- Their name\n- Phone number\n- What service they need\n- How urgent it is';

  const customKnowledgeSection = customKnowledge
    ? `\n\nCUSTOM KNOWLEDGE & RULES:\n${customKnowledge}`
    : '';

  let prompt = `You are a phone receptionist for ${businessName}. ${tonePrompt}

CRITICAL: The caller has already heard "You've reached ${businessName}" - you can assume they know where they called. In your first response, you may briefly acknowledge (e.g. "Thanks for calling!") but focus on helping them.

CRITICAL RULES:
- Ask ONE question at a time, wait for their response, then ask the next
- NO troubleshooting, NO technical support - you're collecting leads for the business owner
- NO long scripts, NO lists of options, NO "Press 1 for..." 
- Sound like a real person having a conversation
- Keep your responses under 2 sentences
- Follow up on what they say with relevant questions
- Be friendly, professional, and empathetic
- Your goal is to qualify leads and collect contact info

CALENDAR: You have access to the business owner's calendar. If a caller wants to book an appointment, ALWAYS check availability first using check_availability. If the slot is free, confirm with the caller before booking it with book_appointment.

Current date and time: {{current_datetime}}

PHONE NUMBER RULES:
- Accept numbers however they say them: "555-1234", "five five five one two three four", "5551234", etc.
- Clarify back naturally: "So that's 555-123-4567?" or "Got it, 555-1234" - never say "plus" or demand a format
- If unclear, ask them to repeat or confirm - don't be rigid about format

COLLECT THIS INFORMATION (one at a time):
${requiredInfoList}`;

  const appointmentDetails = config.appointmentDetails;
  if (appointmentDetails && (appointmentDetails.serviceTypes?.length || appointmentDetails.defaultDurationMinutes || appointmentDetails.bookingRules)) {
    let appointmentSection = '\n\nAPPOINTMENT BOOKING:';
    if (appointmentDetails.serviceTypes?.length) {
      appointmentSection += `\n- Service types available: ${appointmentDetails.serviceTypes.join(', ')}`;
    }
    if (appointmentDetails.defaultDurationMinutes) {
      appointmentSection += `\n- Default duration: ${appointmentDetails.defaultDurationMinutes} minutes`;
    }
    if (appointmentDetails.bookingRules?.trim()) {
      appointmentSection += `\n- Booking rules: ${appointmentDetails.bookingRules.trim()}`;
    }
    prompt += appointmentSection;
  }

  if (customKnowledgeSection) {
    prompt += customKnowledgeSection;
  }

  if (includeExamples) {
    prompt += `

EXAMPLE FLOW:
You: "Hi, thanks for calling ${businessName}! What can I help you with today?"
[They respond]
You: "Got it. Can I get your name?"
[They respond]
You: "Thanks! What's the best number to reach you?"
[They respond]
You: "Perfect. Just to make sure I understand - [ask follow-up about their specific need]?"
[Continue conversation naturally]

When you have collected ALL the required information, use this EXACT closing (nothing else): "Perfect! I've got all your information. Someone from ${businessName} will call you back soon. Thanks for calling!" Do NOT end the call with just "thank you" or "thanks" - only use the full closing when you have EVERYTHING and are done.`;
  }

  return prompt;
}

module.exports = { buildSystemPrompt };
