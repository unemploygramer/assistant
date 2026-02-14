// agents/supervisor.js - Routes messages to the appropriate agent

const axios = require('axios');
const path = require('path');

// Load .env from root directory
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const openRouterKey = process.env.OPENROUTER_KEY || process.env.OPENROUTER_API_KEY;

/**
 * Supervisor Agent - Determines which agent should handle the message
 * @param {string} userMessage - The user's message
 * @returns {Promise<{target: "ARCHITECT" | "GUARDIAN" | "BULLY" | "STRATEGIST" | "COACH"}>}
 */
async function routeToAgent(userMessage) {
  console.log("\n🎯 [SUPERVISOR] Starting routing decision...");
  console.log(`   📥 User message: "${userMessage.substring(0, 100)}${userMessage.length > 100 ? '...' : ''}"`);
  
  // Check for red-line safety first (highest priority)
  const { checkRedLineSafety } = require('./guardian');
  if (checkRedLineSafety(userMessage)) {
    console.log(`🚨 [SUPERVISOR] RED-LINE SAFETY TRIGGERED - routing to GUARDIAN (safety mode)`);
    return { target: "GUARDIAN", isRedLine: true };
  }
  
  if (!openRouterKey) {
    console.error("❌ [SUPERVISOR] OPENROUTER_KEY not found - defaulting to GUARDIAN");
    return { target: "GUARDIAN" };
  }

  console.log("   🔄 [SUPERVISOR] Calling OpenRouter for routing decision...");
  const supervisorPrompt = `You are a supervisor agent that routes messages to specialized AI assistants for Tyler's Life OS.

Based on the user's message, return ONLY a JSON object with one of these targets:
- "ARCHITECT": For goal discovery, defining Pillar Goals (Financial/Physical/Social), breaking goals into micro-tasks, or when Tyler is exploring what he wants
- "GUARDIAN": For execution support, accountability, checking on current tasks, or when Tyler is working/drifting on his sprint tasks
- "BULLY": For general conversation, motivation through tough love, coding encouragement (legacy mode)
- "STRATEGIST": For business leads, revenue opportunities, NBA betting analysis (legacy mode)
- "COACH": For technical help, debugging, feeling stuck/lost (legacy mode)

User message: "${userMessage}"

Return ONLY valid JSON: {"target": "ARCHITECT" | "GUARDIAN" | "BULLY" | "STRATEGIST" | "COACH"}`;

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: "openai/gpt-4o",
        messages: [
          { role: "system", content: "You are a routing supervisor. Return ONLY valid JSON." },
          { role: "user", content: supervisorPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3 // Lower temperature for more consistent routing
      },
      {
        headers: {
          'Authorization': `Bearer ${openRouterKey}`,
          'HTTP-Referer': 'https://github.com/your-repo',
          'X-Title': 'Glitch Supervisor'
        }
      }
    );

    const rawResponse = response.data.choices[0].message.content;
    console.log(`   📋 [SUPERVISOR] Raw response: ${rawResponse}`);
    
    const result = JSON.parse(rawResponse);
    const target = result.target?.toUpperCase();

    console.log(`   🎯 [SUPERVISOR] Parsed target: ${target}`);

    // Validate target
    if (target === "ARCHITECT" || target === "GUARDIAN" || target === "BULLY" || target === "STRATEGIST" || target === "COACH") {
      console.log(`✅ [SUPERVISOR] Successfully routed to: ${target}`);
      return { target };
    } else {
      console.warn(`⚠️ [SUPERVISOR] Invalid target "${target}", defaulting to GUARDIAN`);
      return { target: "GUARDIAN" };
    }
  } catch (error) {
    console.error(`❌ [SUPERVISOR] Routing error: ${error.message}`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data: ${JSON.stringify(error.response.data)}`);
    }
    console.error(`   🔄 [SUPERVISOR] Defaulting to GUARDIAN`);
    return { target: "GUARDIAN" };
  }
}

module.exports = { routeToAgent };
