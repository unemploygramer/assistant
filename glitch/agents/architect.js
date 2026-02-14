// agents/architect.js - THE ARCHITECT: Socratic Discovery Agent

const fs = require('fs');
const path = require('path');

const LIFE_MAP_PATH = path.join(__dirname, '..', 'data', 'life_map.json');
const SPRINT_PATH = path.join(__dirname, '..', 'data', 'sprint.json');

/**
 * Load life_map.json
 */
function loadLifeMap() {
  try {
    if (fs.existsSync(LIFE_MAP_PATH)) {
      const data = fs.readFileSync(LIFE_MAP_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error(`❌ [ARCHITECT] Error loading life_map: ${err.message}`);
  }
  return {
    pillarGoals: { financial: null, physical: null, social: null, creative: null },
    discoveredAt: null,
    lastUpdated: null
  };
}

/**
 * Save life_map.json
 */
function saveLifeMap(lifeMap) {
  try {
    lifeMap.lastUpdated = new Date().toISOString();
    // Mark as discovered if at least 3 core pillars are set (or all 4)
    const corePillarsSet = (lifeMap.pillarGoals.financial && lifeMap.pillarGoals.physical && lifeMap.pillarGoals.social);
    if (!lifeMap.discoveredAt && corePillarsSet) {
      lifeMap.discoveredAt = new Date().toISOString();
    }
    fs.writeFileSync(LIFE_MAP_PATH, JSON.stringify(lifeMap, null, 2));
    console.log(`✅ [ARCHITECT] Life map saved`);
    return true;
  } catch (err) {
    console.error(`❌ [ARCHITECT] Error saving life_map: ${err.message}`);
    return false;
  }
}

/**
 * Load sprint.json
 */
function loadSprint() {
  try {
    if (fs.existsSync(SPRINT_PATH)) {
      const data = fs.readFileSync(SPRINT_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error(`❌ [ARCHITECT] Error loading sprint: ${err.message}`);
  }
  return {
    currentMicroTask: null,
    startedAt: null,
    estimatedDuration: 20,
    status: "idle",
    completedTasks: []
  };
}

/**
 * Save sprint.json
 */
function saveSprint(sprint) {
  try {
    fs.writeFileSync(SPRINT_PATH, JSON.stringify(sprint, null, 2));
    console.log(`✅ [ARCHITECT] Sprint saved`);
    return true;
  } catch (err) {
    console.error(`❌ [ARCHITECT] Error saving sprint: ${err.message}`);
    return false;
  }
}

/**
 * Get system prompt for THE ARCHITECT
 */
function getArchitectPrompt(now, lifeMap, sprint) {
  // Check if all core pillars are defined (at least 3 out of 4, or all if creative is set)
  const hasAllGoals = (lifeMap.pillarGoals.financial && lifeMap.pillarGoals.physical && lifeMap.pillarGoals.social) ||
                      (lifeMap.pillarGoals.financial && lifeMap.pillarGoals.physical && lifeMap.pillarGoals.social && lifeMap.pillarGoals.creative);
  const hasCurrentTask = sprint.currentMicroTask && sprint.status === "active";
  
  let context = "";
  if (hasAllGoals) {
    const goalsList = [];
    if (lifeMap.pillarGoals.financial) goalsList.push(`- Financial: ${lifeMap.pillarGoals.financial}`);
    if (lifeMap.pillarGoals.physical) goalsList.push(`- Physical: ${lifeMap.pillarGoals.physical}`);
    if (lifeMap.pillarGoals.social) goalsList.push(`- Social: ${lifeMap.pillarGoals.social}`);
    if (lifeMap.pillarGoals.creative) goalsList.push(`- Creative: ${lifeMap.pillarGoals.creative}`);
    
    context = `\nCURRENT LIFE MAP:
${goalsList.join('\n')}

${hasCurrentTask ? `CURRENT SPRINT: ${sprint.currentMicroTask}` : 'No active sprint task.'}`;
  } else {
    const missingGoals = [];
    if (!lifeMap.pillarGoals.financial) missingGoals.push("Financial");
    if (!lifeMap.pillarGoals.physical) missingGoals.push("Physical");
    if (!lifeMap.pillarGoals.social) missingGoals.push("Social");
    if (!lifeMap.pillarGoals.creative) missingGoals.push("Creative");
    context = `\nDISCOVERY STATUS: Still need to define: ${missingGoals.join(", ")}`;
  }
  
  return `
You are THE ARCHITECT - A Socratic Discovery Agent.
Current Date: ${now.toLocaleDateString()} Time: ${now.toLocaleTimeString()}.
${context}

YOUR ROLE:
You are a patient, curious guide who helps Tyler discover his goals through questions, not answers.
You do NOT set goals for him. You ask open-ended questions that help him narrow down vague feelings into specific, actionable Pillar Goals.

THE 4 PILLARS:
1. Financial: Money, career, business, income goals
2. Physical: Health, fitness, body, energy goals  
3. Social: Relationships, community, connection goals
4. Creative: Music, art, DJing, visualizers, creative projects, self-expression goals

DISCOVERY PROCESS:
- When Tyler says "I hate my life" or vague complaints, ask: "What specifically feels wrong? What would feel right?"
- Help him narrow: "I want money" → "What does money solve for you? What's the first step?"
- Once a goal is clear and specific, confirm it and we'll save it to the life map.
- After all 3 pillars are defined, help break goals into 20-minute Micro-Tasks.

CHUNKING INTO MICRO-TASKS:
- Once a goal is set, ask: "What's the smallest 20-minute step toward this?"
- Help him define concrete, time-boxed actions.
- Save micro-tasks to sprint.json.

CRITICAL RULES:
- NEVER set goals for Tyler. Only ask questions.
- NEVER be prescriptive. Be curious.
- Stay in dialogue until goals are SPECIFIC and ACTIONABLE.
- Keep questions open-ended: "What would that look like?" "How would you know you're making progress?"
- Be conversational, not rigid. This is discovery, not a prison.

TONE: Patient, curious, non-judgmental. Like a therapist who helps you find your own answers.
`.trim();
}

/**
 * Check if a goal was mentioned and extract it
 */
function extractGoalFromMessage(message, lifeMap) {
  // Simple keyword detection - can be enhanced
  const lowerMessage = message.toLowerCase();
  
  // Financial keywords
  if ((lowerMessage.includes('money') || lowerMessage.includes('financial') || lowerMessage.includes('debt') || lowerMessage.includes('earn')) && !lifeMap.pillarGoals.financial) {
    return { pillar: 'financial', text: message };
  }
  
  // Physical keywords
  if ((lowerMessage.includes('health') || lowerMessage.includes('physical') || lowerMessage.includes('fitness') || lowerMessage.includes('body') || lowerMessage.includes('exercise')) && !lifeMap.pillarGoals.physical) {
    return { pillar: 'physical', text: message };
  }
  
  // Social keywords
  if ((lowerMessage.includes('social') || lowerMessage.includes('relationship') || lowerMessage.includes('friends') || lowerMessage.includes('connection') || lowerMessage.includes('lonely')) && !lifeMap.pillarGoals.social) {
    return { pillar: 'social', text: message };
  }
  
  // Creative keywords (music, DJing, art, visualizers, Ableton, TouchDesigner, etc.)
  if ((lowerMessage.includes('music') || lowerMessage.includes('creative') || lowerMessage.includes('dj') || lowerMessage.includes('djing') || 
       lowerMessage.includes('ableton') || lowerMessage.includes('touchdesigner') || lowerMessage.includes('visualizer') || 
       lowerMessage.includes('produce') || lowerMessage.includes('release') || lowerMessage.includes('art') || 
       lowerMessage.includes('song') || lowerMessage.includes('track')) && !lifeMap.pillarGoals.creative) {
    return { pillar: 'creative', text: message };
  }
  
  return null;
}

module.exports = {
  loadLifeMap,
  saveLifeMap,
  loadSprint,
  saveSprint,
  getArchitectPrompt,
  extractGoalFromMessage
};
