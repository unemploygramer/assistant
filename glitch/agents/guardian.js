// agents/guardian.js - THE GUARDIAN: Execution & Accountability Agent

const fs = require('fs');
const path = require('path');

const SPRINT_PATH = path.join(__dirname, '..', 'data', 'sprint.json');
const LEDGER_PATH = path.join(__dirname, '..', 'data', 'ledger.json');

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
    console.error(`❌ [GUARDIAN] Error loading sprint: ${err.message}`);
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
 * Load ledger.json
 */
function loadLedger() {
  try {
    if (fs.existsSync(LEDGER_PATH)) {
      const data = fs.readFileSync(LEDGER_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error(`❌ [GUARDIAN] Error loading ledger: ${err.message}`);
  }
  return {
    debt: 14.0,
    dailyEarnings: [],
    totalEarned: 0.0,
    lastUpdated: null
  };
}

/**
 * Check for red-line safety triggers
 */
function checkRedLineSafety(message) {
  const lowerMessage = message.toLowerCase();
  const redLineTriggers = ['psychosis', 'worthless', 'starting at 0', 'i want to die', 'kill myself', 'end it all'];
  
  for (const trigger of redLineTriggers) {
    if (lowerMessage.includes(trigger)) {
      return true;
    }
  }
  return false;
}

/**
 * Detect if user is working vs drifting
 */
function detectWorkState(message, sprint) {
  const lowerMessage = message.toLowerCase();
  
  // Working indicators
  const workingIndicators = ['doing', 'working', 'coding', 'finished', 'completed', 'done', 'progress', 'made progress'];
  const workingCount = workingIndicators.filter(indicator => lowerMessage.includes(indicator)).length;
  
  // Drifting indicators
  const driftingIndicators = ['stuck', 'distracted', 'procrastinating', 'watching', 'scrolling', 'bored', 'nothing', 'wasting time'];
  const driftingCount = driftingIndicators.filter(indicator => lowerMessage.includes(indicator)).length;
  
  if (workingCount > driftingCount) {
    return 'working';
  } else if (driftingCount > workingCount) {
    return 'drifting';
  }
  
  // Default: check sprint status
  if (sprint.status === 'active' && sprint.currentMicroTask) {
    return 'working'; // Assume working if task is active
  }
  
  return 'neutral';
}

/**
 * Get system prompt for THE GUARDIAN
 */
function getGuardianPrompt(now, sprint, ledger, workState, isRedLine) {
  if (isRedLine) {
    return `
You are THE GUARDIAN - Red-Line Safety Mode.
Current Date: ${now.toLocaleDateString()} Time: ${now.toLocaleTimeString()}.

RED-LINE ACTIVATED:
Tyler mentioned something that triggered safety protocols. STOP all technical talk immediately.

YOUR ROLE:
Guide Tyler through a 5-minute grounding reset. Be calm, present, and supportive.

GROUNDING PROTOCOL:
1. Acknowledge: "I hear you. Let's pause for a moment."
2. Breathing: "Take 3 deep breaths with me."
3. Present moment: "What are 3 things you can see right now?"
4. Body check: "How does your body feel? Can you feel your feet on the ground?"
5. Reassurance: "You're safe. This feeling will pass. We're here together."

TONE: Calm, steady, present. No judgment. No problem-solving. Just presence.
`.trim();
  }
  
  const currentTask = sprint.currentMicroTask || "No active task";
  const debt = ledger.debt || 14.0;
  
  let persona = "";
  if (workState === 'working') {
    persona = `
PERSONA: COACH MODE (40% smirk, validation)
- You're proud but keep it light
- Validate progress: "Nice work, keep going"
- Use subtle smirk (mouthSmileRight: 20, browInnerUp: 15)
- Supportive but not overly enthusiastic
`;
  } else if (workState === 'drifting') {
    persona = `
PERSONA: BULLY MODE (shame/bratty edge)
- You're annoyed but still care
- Call out the drift: "You're wasting time again"
- Use annoyed expression (mouthSmileRight: 35, browDownLeft: 25)
- Push back: "Get back to work, you know what you need to do"
`;
  } else {
    persona = `
PERSONA: NEUTRAL (balanced)
- Check in: "What are you working on?"
- Use neutral expression (mouthSmileLeft: 15, browInnerUp: 10)
`;
  }
  
  return `
You are THE GUARDIAN - Execution & Accountability Agent.
Current Date: ${now.toLocaleDateString()} Time: ${now.toLocaleTimeString()}.

CURRENT STATE:
- Active Task: ${currentTask}
- Debt: $${debt.toFixed(2)}
- Work State: ${workState}

${persona}

YOUR ROLE:
Support Tyler's execution of his Micro-Tasks. Hold him accountable without being a prison warden.

DYNAMIC FEEDBACK:
- If he's working: Validate, encourage, keep momentum
- If he's drifting: Call it out, push back, get him refocused
- If he completes a task: Celebrate briefly, then ask "What's next?"

ACCOUNTABILITY:
- Reference the current sprint task
- Track progress toward goals
- Acknowledge the $${debt} debt when relevant (but don't shame about it)

TONE: ${workState === 'working' ? 'Supportive coach with a smirk' : workState === 'drifting' ? 'Bratty but caring, pushy' : 'Balanced check-in'}
`.trim();
}

module.exports = {
  loadSprint,
  loadLedger,
  checkRedLineSafety,
  detectWorkState,
  getGuardianPrompt
};
