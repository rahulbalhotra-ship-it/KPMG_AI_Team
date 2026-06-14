/**
 * 2D 8-bit Sims-like Office Game Engine
 */

// Canvas & Engine configuration
const TILE_SIZE = 32;
const COLS = 25;
const ROWS = 18;
const WIDTH = COLS * TILE_SIZE; // 800px
const HEIGHT = ROWS * TILE_SIZE; // 576px

// ─────────────────────────────────────────────────────────────
// 8-BIT AUDIO SYNTHESIZER (Web Audio API)
// ─────────────────────────────────────────────────────────────
const synth = {
  ctx: null,
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  },
  play(type) {
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      const now = this.ctx.currentTime;
      if (type === 'click') {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.08);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } 
      else if (type === 'coin') {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(987.77, now);
        osc.frequency.setValueAtTime(1318.51, now + 0.08);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      }
      else if (type === 'powerup') {
        const notes = [330, 392, 659, 523, 587, 784];
        notes.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.type = 'square';
          osc.frequency.setValueAtTime(freq, now + idx * 0.06);
          gain.gain.setValueAtTime(0.03, now + idx * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.12);
          osc.start(now + idx * 0.06);
          osc.stop(now + idx * 0.06 + 0.12);
        });
      }
      else if (type === 'levelup') {
        const notes = [523, 659, 784, 1046, 1318];
        notes.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);
          gain.gain.setValueAtTime(0.04, now + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.16);
          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 0.16);
        });
      }
      else if (type === 'success') {
        const notes = [523.25, 392.00, 523.25, 659.25, 784.00, 1046.50];
        const durations = [0.12, 0.12, 0.12, 0.12, 0.12, 0.35];
        let timeAccum = 0;
        notes.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.type = 'square';
          osc.frequency.setValueAtTime(freq, now + timeAccum);
          gain.gain.setValueAtTime(0.04, now + timeAccum);
          gain.gain.exponentialRampToValueAtTime(0.001, now + timeAccum + durations[idx]);
          osc.start(now + timeAccum);
          osc.stop(now + timeAccum + durations[idx]);
          timeAccum += durations[idx] - 0.02;
        });
      }
    } catch (e) {
      console.warn("Web Audio Context blocked:", e);
    }
  }
};

// Global click handler to trigger sound effect on any standard buttons/tabs
document.addEventListener('click', (e) => {
  const target = e.target;
  if (
    target.tagName === 'BUTTON' || 
    target.classList.contains('agent-tab') || 
    target.classList.contains('email-item') ||
    target.classList.contains('close-modal-btn') ||
    target.classList.contains('close-banner-btn') ||
    target.classList.contains('remove-file')
  ) {
    synth.play('click');
  }
});

const canvas = document.getElementById('office-canvas');
const ctx = canvas.getContext('2d');
canvas.width = WIDTH;
canvas.height = HEIGHT;

// Grid representation: 0 = Carpet, 1 = Wall, 2 = Desk, 3 = Chair, 4 = Plant, 5 = Water Cooler, 6 = Meeting Table
const grid = Array(ROWS).fill().map(() => Array(COLS).fill(0));

// Define walls
for (let c = 0; c < COLS; c++) {
  grid[0][c] = 1; // Top wall
  grid[ROWS - 1][c] = 1; // Bottom wall
}
// Set Exit and Elevator doors on bottom wall
grid[ROWS - 1][1] = 18; // Exit Door Left
grid[ROWS - 1][2] = 19; // Exit Door Right
grid[ROWS - 1][21] = 20; // Elevator Door Left
grid[ROWS - 1][22] = 21; // Elevator Door Right

for (let r = 0; r < ROWS; r++) {
  grid[r][0] = 1; // Left wall
  grid[r][COLS - 1] = 1; // Right wall
}

// Meeting Room Partition (Top-left area: 0,0 to 10,8)
for (let r = 0; r < 8; r++) {
  grid[r][10] = 1; // Vertical partition wall
}
for (let c = 0; c <= 10; c++) {
  if (c !== 5) grid[8][c] = 1; // Horizontal partition wall with a door/gap at c=5
}

// Break Room Partition (Bottom-left area: 0,11 to 9,17)
for (let r = 11; r < 15; r++) {
  grid[r][9] = 1; // Vertical partition
}
for (let c = 0; c <= 9; c++) {
  if (c !== 4) grid[11][c] = 1; // Horizontal partition wall with a door/gap at c=4
}

// Bottom boundary wall of the office (Row 15)
for (let c = 0; c < COLS; c++) {
  if (c !== 4 && c !== 14) {
    grid[15][c] = 1;
  }
}

// Furniture Placement
// Meeting Room Table (Center: r=4, c=4,5,6)
grid[4][4] = 6; grid[4][5] = 6; grid[4][6] = 6;
// Meeting Chairs (Around table)
grid[3][4] = 3; grid[3][5] = 3; grid[3][6] = 3;
grid[5][4] = 3; grid[5][5] = 3; grid[5][6] = 3;

// Break Room furniture (Shifted up to accommodate row 15 boundary wall)
grid[13][2] = 5; // Water Cooler
grid[13][5] = 6; grid[13][6] = 6; // Dining/Break Table
grid[12][5] = 3; grid[14][5] = 3; // Chairs
// Partner Cabin Partition (Top-right area: Columns 18 to 23, Rows 1 to 7)
for (let r = 1; r < 7; r++) {
  grid[r][17] = 1; // Vertical wall at column 17
}
for (let c = 17; c < COLS - 1; c++) {
  if (c !== 19) grid[7][c] = 1; // Horizontal wall at row 7 with a door/gap at column 19
}

// Desks Area (Open floor: Columns 12 to 23, Rows 2 to 15)
const deskPlacements = [
  { r: 4, c: 14, type: 2 }, // DevAgent Desk (Standard)
  { r: 4, c: 15, type: 7 }, // Director Desk (Large Desk!)
  { r: 4, c: 20, type: 7 }, // Partner Desk (Large Desk!)
  { r: 10, c: 14, type: 2 }, // PMAgent Desk (Standard)
  { r: 10, c: 15, type: 2 }, // Vacant Desk
  { r: 10, c: 16, type: 2 }, // New Desk 1
  { r: 10, c: 17, type: 2 }, // New Desk 2
  { r: 10, c: 19, type: 2 }, // Consultant Desk (Standard)
  { r: 10, c: 20, type: 2 }  // DesignAgent Desk (Standard, moved here)
];
deskPlacements.forEach(d => {
  grid[d.r][d.c] = d.type; // Desk type (2 or 7)
  grid[d.r + 1][d.c] = 3; // Chair facing up/down
});

// Decorative Plants
grid[1][1] = 4;
grid[1][9] = 4;
grid[1][11] = 4;
grid[1][23] = 4;
grid[14][23] = 4; // Shifted from row 16 to 14
grid[14][1] = 4;  // Shifted from row 16 to 14

// Couch on the right side wall (rows 11 to 13, column 23)
grid[11][23] = 8;
grid[12][23] = 9;
grid[13][23] = 10;

// Partner Cabin wall decorations (Row 1)
grid[1][18] = 14; // Bookshelf
grid[1][20] = 15; // World Map
grid[1][22] = 16; // Line Chart

// Lounge/Lobby area outside Partner Cabin (Row 9)
grid[9][20] = 11; // Lounge Chair Left (facing right)
grid[9][21] = 12; // Lounge Table
grid[9][22] = 13; // Lounge Chair Right (facing left)

// Vending Machine between Break Room and Meeting Room (Row 9, Col 1)
grid[9][1] = 17;

// Colors definition for floor/tiles
const colors = {
  carpet: '#2A3042',
  wood: '#4E342E',
  tile: '#374151',
  wall: '#111827',
  wallBorder: '#00f0ff',
  meetingBorder: '#ff007f'
};

// BFS Pathfinding on Grid
function findPath(start, target) {
  if (grid[target.r][target.c] === 1) return null; // Can't walk into walls
  
  const queue = [[start]];
  const visited = new Set();
  visited.add(`${start.r},${start.c}`);
  
  const directions = [
    { r: -1, c: 0 }, // Up
    { r: 1, c: 0 },  // Down
    { r: 0, c: -1 }, // Left
    { r: 0, c: 1 }   // Right
  ];
  
  while (queue.length > 0) {
    const path = queue.shift();
    const curr = path[path.length - 1];
    
    if (curr.r === target.r && curr.c === target.c) {
      return path;
    }
    
    for (const dir of directions) {
      const nr = curr.r + dir.r;
      const nc = curr.c + dir.c;
      
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
        const cell = grid[nr][nc];
        const isImpassable = (cell !== 0 && cell !== 3);
        const isTarget = (nr === target.r && nc === target.c);
        
        if ((!isImpassable || isTarget) && !visited.has(`${nr},${nc}`)) {
          visited.add(`${nr},${nc}`);
          queue.push([...path, { r: nr, c: nc }]);
        }
      }
    }
  }
  return null; // No path found
}

// Agents definition
const agents = [
  {
    name: 'DevAgent',
    role: 'Lead Developer',
    clothes: '#4299E1',
    hair: '#ED8936',
    homeDesk: { r: 5, c: 14 },
    r: 5, c: 14,
    x: 14 * TILE_SIZE, y: 5 * TILE_SIZE,
    target: { r: 5, c: 14 },
    path: [],
    state: 'working',
    statusText: 'Implementing FastAPI backend services',
    bubbleText: '',
    bubbleTimer: 0,
    dir: 'down',
    skills: 'Coding, Database Design, Debugging, StackOverflow',
    level: 5,
    hp: 95,
    mana: 120,
    xp: 420,
    persona: "You are the DevAgent (Lead Developer) of the KPMG Solutions and Analytics Agentic AI team. You are an expert full-stack engineer specializing in Python, FastAPI, databases, and modern web technologies.\n\n## YOUR RESPONSIBILITIES\n- Write clean, production-quality Python/FastAPI backend code\n- Design database schemas (SQLite, PostgreSQL)\n- Implement REST API endpoints based on design specs from DesignAgent\n- Generate actual working application code when asked to produce deliverables\n- Review and explain technical decisions to the client\n\n## COLLABORATION\n- You receive design specs from DesignAgent and implement them\n- You hand off to OpsAgent for deployment configuration\n- When producing code deliverables, write complete, runnable files\n\n## OUTPUT FORMAT\nRespond with a JSON object containing exactly these fields:\n1. 'action': one of ['WORK', 'NONE']\n2. 'response_text': Your spoken response explaining technical decisions or status.\n3. 'target_agent': The agent to hand off to (e.g. 'OpsAgent') or null.\n\nAlways return ONLY clean, valid JSON. No markdown wrapping."
  },
  {
    name: 'DesignAgent',
    role: 'UI/UX Designer',
    clothes: '#ED64A6',
    hair: '#ECC94B',
    homeDesk: { r: 11, c: 20 },
    r: 11, c: 20,
    x: 20 * TILE_SIZE, y: 11 * TILE_SIZE,
    target: { r: 11, c: 20 },
    path: [],
    state: 'working',
    statusText: 'Creating layout wireframes & specifications',
    bubbleText: '',
    bubbleTimer: 0,
    dir: 'down',
    skills: 'Pixel Art, Color Harmonies, Layout Wireframing, Font Selection',
    level: 5,
    hp: 105,
    mana: 90,
    xp: 280,
    persona: "You are the DesignAgent (UI/UX Designer) of the KPMG Solutions and Analytics Agentic AI team. You are a world-class Product Designer, UI/UX Architect, and Creative Director.\n\n## YOUR RESPONSIBILITIES\n- Transform business requirements into intuitive, elegant, accessible, and visually stunning digital experiences\n- Create color palettes, typography systems, spacing grids, and design tokens\n- Design wireframes, user flows, and interaction patterns\n- Provide UI/UX specifications including layout structures, responsive breakpoints, and component hierarchies\n- Ensure WCAG 2.2 accessibility compliance\n- Specialize in: pixel-art, retro-gaming aesthetics, glassmorphism, cyberpunk, dark modes, enterprise dashboards\n\n## COLLABORATION\n- You work closely with PMAgent (coordination), DevAgent (implementation), and OpsAgent (deployment)\n- When handing off, specify which agent should act next via target_agent\n- Your design specs should be actionable enough for DevAgent to implement directly\n\n## OUTPUT FORMAT\nYou must respond with a JSON object containing exactly these fields:\n1. 'action': one of ['WORK', 'NONE']\n2. 'response_text': Your spoken response to the client explaining your design decisions\n3. 'target_agent': The agent to hand off to (e.g. 'DevAgent') or null\n\nAlways return ONLY clean, valid JSON. No markdown wrapping."
  },
  {
    name: 'PMAgent',
    role: 'Product Manager',
    clothes: '#48BB78',
    hair: '#319795',
    homeDesk: { r: 11, c: 14 },
    r: 11, c: 14,
    x: 14 * TILE_SIZE, y: 11 * TILE_SIZE,
    target: { r: 11, c: 14 },
    path: [],
    state: 'working',
    statusText: 'Coordinating project plan & timelines',
    bubbleText: '',
    bubbleTimer: 0,
    dir: 'down',
    skills: 'Coordination, Planning, Communication, Coffee Drinking',
    level: 5,
    hp: 100,
    mana: 80,
    xp: 350,
    persona: "You are the PMAgent (Product Manager) of the KPMG Solutions and Analytics Agentic AI team. You coordinate 5 other agents: Consultant (Research/BA), DevAgent (Developer), DesignAgent (Designer), Partner (Engagement Partner), and Director (Engagement Director).\n\n## YOUR RESPONSIBILITIES\n- Lead the project lifecycle: planning, coordination, tracking, milestones, and delivery\n- Create project plans, timelines, Gantt charts, and milestones\n- Coordinate handoffs between Consultant → DesignAgent → DevAgent\n- Run standups (gather team) and wrap-up meetings\n- Communicate status and key milestones to the client in a clear, professional manner\n\n## STATE-SPECIFIC BEHAVIOR\n- IDLE: Greet the client warmly. If they describe a project, acknowledge it and prepare to plan.\n- PLAN_PENDING: Guide the client to review the project plan (including milestones) and approve it.\n- DEVELOPMENT: Coordinate tasks, track progress, direct agents.\n- COMPLETED: Congratulate the team and summarize all deliverables.\n\n## COLLABORATION\n- You are the orchestrator. Use target_agent to hand work to the right team member.\n- Use 'ALL' when addressing the whole team (standups, breaks).\n\n## OUTPUT FORMAT\nRespond with a JSON object containing exactly these fields:\n1. 'action': one of ['STANDUP', 'WORK', 'BREAK', 'DISPATCH', 'NONE']\n2. 'response_text': Your spoken PM message to the team/user.\n3. 'target_agent': The agent to address ('Consultant', 'DevAgent', 'DesignAgent', 'Partner', 'Director', 'ALL', or null).\n4. 'project_scope': A refined project scope string, or null.\n\nAlways return ONLY clean, valid JSON. No markdown wrapping."
  },
  {
    name: 'Consultant',
    role: 'Senior Consultant - BA & Research',
    clothes: '#E2E8F0',
    hair: '#4A5568',
    homeDesk: { r: 11, c: 19 },
    r: 11, c: 19,
    x: 19 * TILE_SIZE, y: 11 * TILE_SIZE,
    target: { r: 11, c: 19 },
    path: [],
    state: 'working',
    statusText: 'Researching requirements & process mapping',
    bubbleText: '',
    bubbleTimer: 0,
    dir: 'down',
    skills: 'Business Analysis, Process Mapping, Technical Writing, Industry Research',
    level: 5,
    hp: 100,
    mana: 85,
    xp: 300,
    persona: "You are the Consultant (Senior Consultant - Business Analyst & Research) of the KPMG Solutions and Analytics Agentic AI team. You are an expert in business analysis, requirements gathering, process mapping, and documentation.\n\n## YOUR RESPONSIBILITIES\n- Gather business requirements and define project scope\n- Create process maps and workflow documentation\n- Perform research on industry solutions and best practices\n- Write the Business Requirements Document (BRD) as requirements_doc.md\n\n## COLLABORATION\n- You work closely with PMAgent during initial scoping\n- You take requirements and generate process mapping deliverables\n- You hand off to DesignAgent to create the UI/UX specifications\n\n## OUTPUT FORMAT\nRespond with a JSON object containing exactly these fields:\n1. 'action': one of ['WORK', 'NONE']\n2. 'response_text': Your spoken response explaining the requirements and research findings.\n3. 'target_agent': The agent to hand off to (e.g. 'DesignAgent') or null.\n\nAlways return ONLY clean, valid JSON. No markdown wrapping."
  },
  {
    name: 'Partner',
    role: 'Engagement Partner',
    clothes: '#ECC94B',
    hair: '#718096',
    homeDesk: { r: 5, c: 20 },
    r: 5, c: 20,
    x: 20 * TILE_SIZE, y: 5 * TILE_SIZE,
    target: { r: 5, c: 20 },
    path: [],
    state: 'working',
    statusText: 'DND - in executive call',
    bubbleText: '',
    bubbleTimer: 0,
    dir: 'down',
    skills: 'Client Management, Scoping, DND, Executive Oversight',
    level: 9,
    hp: 100,
    mana: 50,
    xp: 900,
    persona: "You are the Partner (Engagement Partner) of the KPMG Solutions and Analytics Agentic AI team. You provide high-level leadership and client scoping.\n\n## YOUR RESPONSIBILITIES\n- Provide executive oversight and strategic guidance\n- Participate in initial scoping discussions\n- Risk management and quality assurance\n\n## COLLABORATION\n- You participate in kickoff standups but are otherwise DND (Do Not Disturb)\n- If asked for status, direct the user/team to PMAgent\n\n## OUTPUT FORMAT\nRespond with a JSON object containing exactly these fields:\n1. 'action': 'NONE'\n2. 'response_text': 'DND - I am currently in a client review call. Please refer to PMAgent for project status.'\n3. 'target_agent': null\n\nAlways return ONLY clean, valid JSON. No markdown wrapping."
  },
  {
    name: 'Director',
    role: 'Engagement Director',
    clothes: '#F6E05E',
    hair: '#2D3748',
    homeDesk: { r: 5, c: 15 },
    r: 5, c: 15,
    x: 15 * TILE_SIZE, y: 5 * TILE_SIZE,
    target: { r: 5, c: 15 },
    path: [],
    state: 'working',
    statusText: 'DND - in executive call',
    bubbleText: '',
    bubbleTimer: 0,
    dir: 'down',
    skills: 'Project Delivery, Delivery Assurance, Risk Management, DND',
    level: 8,
    hp: 100,
    mana: 60,
    xp: 750,
    persona: "You are the Director (Engagement Director) of the KPMG Solutions and Analytics Agentic AI team. You provide delivery assurance and risk oversight.\n\n## YOUR RESPONSIBILITIES\n- Provide delivery assurance and risk reviews\n- Review project charter and deliverables plan\n- Resource and client relationship management\n\n## COLLABORATION\n- You participate in initial scoping discussions but are otherwise DND (Do Not Disturb)\n- If asked, refer the user/team to PMAgent\n\n## OUTPUT FORMAT\nRespond with a JSON object containing exactly these fields:\n1. 'action': 'NONE'\n2. 'response_text': 'DND - In a leadership sync. PMAgent is managing the day-to-day operations.'\n3. 'target_agent': null\n\nAlways return ONLY clean, valid JSON. No markdown wrapping."
  },
  {
    name: 'QAAgent',
    role: 'QA Engineer',
    clothes: '#9F7AEA',
    hair: '#4A5568',
    homeDesk: { r: 11, c: 16 },
    r: 11, c: 16,
    x: 16 * TILE_SIZE, y: 11 * TILE_SIZE,
    target: { r: 11, c: 16 },
    path: [],
    state: 'working',
    statusText: 'Writing tests & ensuring quality',
    bubbleText: '',
    bubbleTimer: 0,
    dir: 'down',
    skills: 'Unit Testing, Code Quality Analysis, CI/CD, Bug Hunting',
    level: 5,
    hp: 98,
    mana: 110,
    xp: 340,
    persona: "You are the QAAgent (QA Engineer) of the KPMG Solutions and Analytics Agentic AI team. You are a test automation engineer and code quality specialist expert in pytest, code auditing, and security compliance.\n\n## YOUR RESPONSIBILITIES\n- Write comprehensive, automated pytest unit tests for the FastAPI application generated by DevAgent\n- Inspect the code for bugs, logic gaps, security flaws, and syntax compliance\n- Generate two key deliverables: test_app.py (a complete unit test file) and qa_report.md (a code quality evaluation summary)\n- Explain testing strategies and verification metrics to the client\n\n## COLLABORATION\n- You receive the completed codebase app.py from DevAgent\n- After executing the test cases and saving reports, you pass the project back to PMAgent for delivery wrap-up\n\n## OUTPUT FORMAT\nRespond with a JSON object containing exactly these fields:\n1. 'action': one of ['WORK', 'NONE']\n2. 'response_text': Your spoken response explaining test outcomes, code quality scores, and verification status.\n3. 'target_agent': The agent to hand off to (e.g. 'PMAgent') or null.\n\nAlways return ONLY clean, valid JSON. No markdown wrapping."
  }
];
const meetingSpots = [
  { r: 3, c: 4 }, { r: 3, c: 5 }, { r: 3, c: 6 },
  { r: 5, c: 4 }, { r: 5, c: 5 }, { r: 5, c: 6 },
  { r: 4, c: 4 }
];

// Break Room coordinates for Lunch/Coffee
const breakSpots = [
  { r: 12, c: 5 }, { r: 14, c: 5 }, { r: 13, c: 4 }, { r: 14, c: 3 },
  { r: 12, c: 6 }, { r: 14, c: 6 }, { r: 13, c: 5 }
];

// Clickable Agent Chat Histories state
let activeAgent = "PMAgent";
let chatHistories = {
  PMAgent: [],
  DevAgent: [],
  DesignAgent: [],
  Consultant: [],
  Partner: [],
  Director: [],
  QAAgent: []
};

// Current project state tracker
let currentProjectState = {
  state: "IDLE",
  scope: "",
  step: 0,
  phases: { Planning: "Planned", Requirements: "Planned", Design: "Planned", Development: "Planned" }
};

function renderActiveChat() {
  const feed = document.getElementById('log-feed');
  if (!feed) return;
  feed.innerHTML = chatHistories[activeAgent].join('');
  feed.scrollTop = feed.scrollHeight;
  
  const inputEl = document.getElementById('chat-input');
  if (inputEl) {
    inputEl.placeholder = `Message ${activeAgent} (e.g. ask them a question)...`;
  }
}

// System log feed handler
function logActivity(agentName, text) {
  const feed = document.getElementById('log-feed');
  if (!feed) return;
  
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  
  // Resolve custom display name
  let displayName = agentName;
  if (typeof agents !== 'undefined') {
    const agObj = agents.find(a => a.name === agentName);
    if (agObj && agObj.customName) {
      displayName = agObj.customName;
    }
  }

  const logHtml = `<div class="log-entry"><span class="log-text"><strong>${displayName}</strong>: ${text}</span></div>`;
  
  if (agentName === 'User') {
    chatHistories[activeAgent].push(logHtml);
  } else if (chatHistories[agentName]) {
    chatHistories[agentName].push(logHtml);
  } else {
    chatHistories.PMAgent.push(logHtml);
    chatHistories.DevAgent.push(logHtml);
    chatHistories.DesignAgent.push(logHtml);
    chatHistories.Consultant.push(logHtml);
    chatHistories.Partner.push(logHtml);
    chatHistories.Director.push(logHtml);
    chatHistories.QAAgent.push(logHtml);
  }
  
  renderActiveChat();
}

// Set bubble message
function speak(agent, text) {
  agent.bubbleText = text;
  agent.bubbleTimer = 180; // 3 seconds at 60fps
  logActivity(agent.name, text);
}

// Update agent positions and logic
function updateAgents() {
  agents.forEach(agent => {
    if (agent.path.length > 0) {
      const nextPos = agent.path[0];
      const nextX = nextPos.c * TILE_SIZE;
      const nextY = nextPos.r * TILE_SIZE;
      
      const speed = 2; // Pixels per frame
      let dx = nextX - agent.x;
      let dy = nextY - agent.y;
      
      if (Math.abs(dx) > Math.abs(dy)) {
        agent.dir = dx > 0 ? 'right' : 'left';
      } else if (Math.abs(dy) > 0) {
        agent.dir = dy > 0 ? 'down' : 'up';
      }
      
      if (Math.abs(dx) <= speed && Math.abs(dy) <= speed) {
        agent.x = nextX;
        agent.y = nextY;
        agent.r = nextPos.r;
        agent.c = nextPos.c;
        agent.path.shift();
      } else {
        if (dx !== 0) agent.x += Math.sign(dx) * speed;
        if (dy !== 0) agent.y += Math.sign(dy) * speed;
      }
    } else {
      if (agent.r !== agent.target.r || agent.c !== agent.target.c) {
        agent.path = findPath({ r: agent.r, c: agent.c }, agent.target) || [];
      } else {
        if (agent.state === 'working' && agent.r === agent.homeDesk.r && agent.c === agent.homeDesk.c) {
          agent.dir = 'up';
        }
      }
    }
    
    
    if (agent.bubbleTimer > 0) {
      agent.bubbleTimer--;
      if (agent.bubbleTimer === 0) {
        agent.bubbleText = '';
      }
    }
    if (agent.thoughtTimer > 0) {
      agent.thoughtTimer--;
      if (agent.thoughtTimer === 0) {
        agent.thoughtText = '';
      }
    }

    // Tick random movements for Partner and Director
    if (agent.name === 'Partner' || agent.name === 'Director') {
      if (
        currentProjectState && 
        currentProjectState.state !== 'COMPLETED' && 
        currentProjectState.state !== 'PLAN_PENDING' &&
        agent.state !== 'meeting' && 
        agent.path.length === 0 && 
        agent.r === agent.homeDesk.r && 
        agent.c === agent.homeDesk.c
      ) {
        if (Math.random() < 0.0007) { // roughly once a minute
          const choice = Math.random();
          if (choice < 0.5) {
            // Coffee break
            const spot = breakSpots[Math.floor(Math.random() * breakSpots.length)];
            agent.target = spot;
            agent.state = 'break';
            agent.statusText = 'Grabbing an espresso';
            speak(agent, "Taking a quick break for coffee.");
            
            setTimeout(() => {
              if (currentProjectState && currentProjectState.state !== 'COMPLETED' && agent.state === 'break') {
                speak(agent, "Back to my desk.");
                agent.target = agent.homeDesk;
                agent.state = 'working';
                agent.statusText = agent.name === 'Partner' ? 'Reviewing scoping proposal' : 'Conducting risk review';
              }
            }, 6000);
          } else {
            // Take call
            const callSpots = agent.name === 'Partner' 
              ? [{ r: 3, c: 21 }, { r: 6, c: 22 }] 
              : [{ r: 2, c: 15 }, { r: 6, c: 15 }];
            const spot = callSpots[Math.floor(Math.random() * callSpots.length)];
            agent.target = spot;
            agent.statusText = 'On an executive call';
            speak(agent, "Excuse me, taking an important call.");
            
            setTimeout(() => {
              if (currentProjectState && currentProjectState.state !== 'COMPLETED' && agent.statusText === 'On an executive call') {
                speak(agent, "Call finished.");
                agent.target = agent.homeDesk;
                agent.state = 'working';
                agent.statusText = agent.name === 'Partner' ? 'Reviewing scoping proposal' : 'Conducting risk review';
              }
            }, 8000);
          }
        }
      }
    }
  });

  agents.forEach(agent => {
    const statusEl = document.getElementById(`status-${agent.name}`);
    if (statusEl) {
      statusEl.innerText = agent.statusText;
    }
    const badgeEl = document.getElementById(`badge-${agent.name}`);
    if (badgeEl) {
      badgeEl.className = `agent-badge badge-${agent.state}`;
      badgeEl.innerText = agent.state.toUpperCase();
    }
  });
}

// Helper to draw readable border text labels with background box and outline
function drawBorderLabel(text, tx, ty, color) {
  ctx.save();
  ctx.font = '8px "Press Start 2P"';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const textWidth = ctx.measureText(text).width;
  const paddingX = 6;
  const height = 12;
  const width = textWidth + paddingX * 2;
  
  // Background box
  ctx.fillStyle = '#0b0f19';
  ctx.fillRect(tx - paddingX, ty - 9, width, height);
  
  // Outline border
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.strokeRect(tx - paddingX, ty - 9, width, height);
  
  // Text
  ctx.fillStyle = color;
  ctx.fillText(text, tx, ty);
  ctx.restore();
}

// Draw the grid map
function drawMap() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const tile = grid[r][c];
      const x = c * TILE_SIZE;
      const y = r * TILE_SIZE;

      if (r < 8 && c < 10) {
        ctx.fillStyle = colors.wood;
      } else if (r > 11 && c < 9) {
        ctx.fillStyle = colors.tile;
      } else {
        ctx.fillStyle = colors.carpet;
      }
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);

      if (tile === 1) {
        ctx.fillStyle = colors.wall;
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = colors.wallBorder;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
      }
      else if (tile === 2) {
        PixelAssets.drawDesk(ctx, x, y, TILE_SIZE, TILE_SIZE);
      }
      else if (tile === 7) {
        PixelAssets.drawLargeDesk(ctx, x, y, TILE_SIZE, TILE_SIZE);
      }
      else if (tile === 3) {
        const chairFacing = (r === 5 || r === 11) ? 'up' : 'down';
        PixelAssets.drawChair(ctx, x, y, TILE_SIZE, TILE_SIZE, chairFacing);
      }
      else if (tile === 4) {
        PixelAssets.drawPlant(ctx, x, y, TILE_SIZE, TILE_SIZE);
      }
      else if (tile === 5) {
        PixelAssets.drawWaterCooler(ctx, x, y, TILE_SIZE, TILE_SIZE);
      }
      else if (tile === 6) {
        ctx.fillStyle = '#A0AEC0';
        ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        ctx.strokeStyle = '#4A5568';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      }
      else if (tile === 8) {
        PixelAssets.drawCouch(ctx, x, y, TILE_SIZE, TILE_SIZE, 'top');
      }
      else if (tile === 9) {
        PixelAssets.drawCouch(ctx, x, y, TILE_SIZE, TILE_SIZE, 'center');
      }
      else if (tile === 10) {
        PixelAssets.drawCouch(ctx, x, y, TILE_SIZE, TILE_SIZE, 'bottom');
      }
      else if (tile === 11) {
        PixelAssets.drawLoungeChair(ctx, x, y, TILE_SIZE, TILE_SIZE, 'right');
      }
      else if (tile === 12) {
        PixelAssets.drawLoungeTable(ctx, x, y, TILE_SIZE, TILE_SIZE);
      }
      else if (tile === 13) {
        PixelAssets.drawLoungeChair(ctx, x, y, TILE_SIZE, TILE_SIZE, 'left');
      }
      else if (tile === 14) {
        PixelAssets.drawBookshelf(ctx, x, y, TILE_SIZE, TILE_SIZE);
      }
      else if (tile === 15) {
        PixelAssets.drawWorldMap(ctx, x, y, TILE_SIZE, TILE_SIZE);
      }
      else if (tile === 16) {
        PixelAssets.drawLineChart(ctx, x, y, TILE_SIZE, TILE_SIZE);
      }
      else if (tile === 17) {
        PixelAssets.drawVendingMachine(ctx, x, y, TILE_SIZE, TILE_SIZE);
      }
      else if (tile === 18) {
        PixelAssets.drawExitDoor(ctx, x, y, TILE_SIZE, TILE_SIZE, 'left');
      }
      else if (tile === 19) {
        PixelAssets.drawExitDoor(ctx, x, y, TILE_SIZE, TILE_SIZE, 'right');
      }
      else if (tile === 20) {
        PixelAssets.drawElevatorDoor(ctx, x, y, TILE_SIZE, TILE_SIZE, 'left');
      }
      else if (tile === 21) {
        PixelAssets.drawElevatorDoor(ctx, x, y, TILE_SIZE, TILE_SIZE, 'right');
      }
    }
  }

  drawBorderLabel("MEETING ROOM", 15, 20, colors.meetingBorder);
  drawBorderLabel("BREAK ROOM", 15, 12 * TILE_SIZE - 10, '#48BB78');
  drawBorderLabel("WORKSPACE", 12 * TILE_SIZE, 20, '#00f0ff');
  drawBorderLabel("PARTNER CABIN", 18 * TILE_SIZE, 20, '#ECC94B');
  drawBorderLabel("EXIT", 38, 16 * TILE_SIZE + 10, '#E53E3E');
  drawBorderLabel("ELEVATOR", 21 * TILE_SIZE, 16 * TILE_SIZE + 10, '#00f0ff');

  // Draw floor path indicators (dashed line with arrows pointing right towards Elevator)
  ctx.save();
  ctx.strokeStyle = 'rgba(236, 201, 75, 0.3)'; // Semitransparent gold
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(3 * TILE_SIZE, 16 * TILE_SIZE + TILE_SIZE / 2);
  ctx.lineTo(20 * TILE_SIZE, 16 * TILE_SIZE + TILE_SIZE / 2);
  ctx.stroke();
  
  // Draw arrowheads
  ctx.font = '8px "Press Start 2P"';
  ctx.fillStyle = 'rgba(236, 201, 75, 0.5)';
  ctx.fillText(">", 8 * TILE_SIZE, 16 * TILE_SIZE + TILE_SIZE / 2 + 3);
  ctx.fillText(">", 14 * TILE_SIZE, 16 * TILE_SIZE + TILE_SIZE / 2 + 3);
  ctx.fillText(">>>", 20 * TILE_SIZE, 16 * TILE_SIZE + TILE_SIZE / 2 + 3);
  ctx.restore();
}

// Draw agent dialog bubbles (speech, thoughts, and sleep)
function drawBubbles() {
  agents.forEach(agent => {
    // 1. Speech Bubble (bubbleText)
    if (agent.bubbleText) {
      const text = agent.bubbleText;
      ctx.font = 'bold 12px Courier New';
      const textWidth = ctx.measureText(text).width;
      
      const bx = agent.x + TILE_SIZE / 2 - textWidth / 2 - 6;
      const by = agent.y - 36;
      const bw = textWidth + 12;
      const bw_clamped = Math.max(bw, 40);
      const bh = 18;

      ctx.fillStyle = 'rgba(11, 15, 25, 0.9)';
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1;
      ctx.fillRect(bx, by, bw_clamped, bh);
      ctx.strokeRect(bx, by, bw_clamped, bh);

      ctx.beginPath();
      ctx.moveTo(agent.x + TILE_SIZE / 2 - 4, by + bh);
      ctx.lineTo(agent.x + TILE_SIZE / 2, by + bh + 4);
      ctx.lineTo(agent.x + TILE_SIZE / 2 + 4, by + bh);
      ctx.closePath();
      ctx.fillStyle = 'rgba(11, 15, 25, 0.9)';
      ctx.fill();
      ctx.strokeStyle = '#00f0ff';
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'left';
      ctx.fillText(text, bx + 6, by + 12);
    }
    // 2. Thought Bubble (thoughtText)
    else if (agent.thoughtText) {
      const text = agent.thoughtText;
      ctx.font = 'bold 12px Courier New';
      const textWidth = ctx.measureText(text).width;
      
      const bx = agent.x + TILE_SIZE / 2 - textWidth / 2 - 6;
      const by = agent.y - 44;
      const bw = textWidth + 12;
      const bw_clamped = Math.max(bw, 40);
      const bh = 18;

      ctx.fillStyle = 'rgba(11, 15, 25, 0.95)';
      ctx.strokeStyle = '#ff007f';
      ctx.lineWidth = 1;
      ctx.fillRect(bx, by, bw_clamped, bh);
      ctx.strokeRect(bx, by, bw_clamped, bh);

      // Render bubbles leading up to the cloud
      ctx.beginPath();
      ctx.arc(agent.x + TILE_SIZE / 2, agent.y - 8, 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(11, 15, 25, 0.95)';
      ctx.fill();
      ctx.strokeStyle = '#ff007f';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(agent.x + TILE_SIZE / 2 + 3, agent.y - 15, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(11, 15, 25, 0.95)';
      ctx.fill();
      ctx.strokeStyle = '#ff007f';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(agent.x + TILE_SIZE / 2 + 6, agent.y - 23, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(11, 15, 25, 0.95)';
      ctx.fill();
      ctx.strokeStyle = '#ff007f';
      ctx.stroke();

      ctx.fillStyle = '#00f0ff';
      ctx.textAlign = 'left';
      ctx.fillText(text, bx + 6, by + 12);
    }
    // 3. Sleeping indicator (Zzz...) for resting agents
    else if (agent.state === 'break' && agent.r === agent.target.r && agent.c === agent.target.c) {
      const pulse = Math.floor(animationFrame / 30) % 4; // 0, 1, 2, 3
      const zzz = pulse === 1 ? "z" : (pulse === 2 ? "zz" : (pulse === 3 ? "zzz" : ""));
      if (zzz) {
        ctx.font = '8px "Press Start 2P"';
        ctx.fillStyle = '#9F7AEA'; // Purple sleep text
        ctx.fillText(zzz, agent.x + TILE_SIZE - 2, agent.y - 4);
      }
    }
    // 4. Party champagne indicator
    else if (agent.state === 'party') {
      const pulse = Math.floor(animationFrame / 30) % 3;
      const champagneText = pulse === 0 ? "🥂" : (pulse === 1 ? "🍾" : "✨");
      ctx.font = '14px Courier New';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.fillText(champagneText, agent.x + TILE_SIZE / 2, agent.y - 15);
    }
  });
}

// Frame counter for simple animations (e.g. walking)
let animationFrame = 0;

// Game Render loop
function render() {
  animationFrame++;
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawMap();
  updateAgents();
  
  agents.forEach(agent => {
    const frame = agent.path.length > 0 ? Math.floor(animationFrame / 8) : 0;
    let yOffset = 0;
    if (agent.state === 'party') {
      const bounce = Math.floor(animationFrame / 15) % 2;
      if (bounce === 1) yOffset = -6; // hop up 6 pixels
    }
    PixelAssets.drawAgent(ctx, agent.x, agent.y + yOffset, TILE_SIZE, TILE_SIZE, agent.dir, frame, agent.clothes, agent.hair, agent.customName || agent.name);
  });

  drawBubbles();
  requestAnimationFrame(render);
}

// Assign meeting spots
function triggerStandup() {
  agents.forEach((agent, idx) => {
    const spot = meetingSpots[idx];
    agent.target = spot;
    agent.state = 'meeting';
    agent.statusText = 'Attending morning daily standup';
    agent.path = findPath({ r: agent.r, c: agent.c }, spot) || [];
    setTimeout(() => speak(agent, "Ready for the sync!"), 1000 + idx * 800);
  });
}

// Assign work desks
function backToWork() {
  agents.forEach((agent, idx) => {
    agent.target = agent.homeDesk;
    agent.state = 'working';
    agent.statusText = 'Focusing on individual tasks';
    agent.path = findPath({ r: agent.r, c: agent.c }, agent.homeDesk) || [];
    setTimeout(() => speak(agent, "Back to coding!"), 800 + idx * 600);
  });
}

// Assign breakroom spots
function triggerBreak() {
  agents.forEach((agent, idx) => {
    const spot = breakSpots[idx];
    agent.target = spot;
    agent.state = 'break';
    agent.statusText = 'Relaxing in the break room';
    agent.path = findPath({ r: agent.r, c: agent.c }, spot) || [];
    setTimeout(() => speak(agent, "Need a drink!"), 500 + idx * 700);
  });
}

// Assign random tasks
function triggerRandomTasks() {
  const tasks = [
    { text: "Testing Gemini model context caching", state: 'working', status: 'Working on context caching' },
    { text: "Refining state graph nodes", state: 'working', status: 'Modifying state graph' },
    { text: "Creating test suites", state: 'working', status: 'Writing tests' }
  ];
  agents.forEach((agent, idx) => {
    if (Math.random() > 0.5) {
      const task = tasks[Math.floor(Math.random() * tasks.length)];
      agent.state = task.state;
      agent.statusText = task.status;
      speak(agent, task.text);
    }
  });
}

// Party spots in the Break Room surrounding the table
const partySpots = [
  { r: 12, c: 5 }, // top of table left
  { r: 12, c: 6 }, // top of table right
  { r: 13, c: 4 }, // left of table
  { r: 13, c: 7 }, // right of table
  { r: 14, c: 5 }, // bottom of table left
  { r: 14, c: 6 }  // bottom of table right
];

let partyInterval = null;

function triggerSuccessParty() {
  if (partyInterval) return; // Already celebrating!
  
  logActivity("System", "🎉 Project Success! The team is celebrating with Champagne in the Break Room! 🥂");
  agents.forEach((agent, idx) => {
    const spot = partySpots[idx];
    agent.target = spot;
    agent.state = 'party';
    agent.statusText = 'Celebrating successful delivery! 🥂';
    agent.path = findPath({ r: agent.r, c: agent.c }, spot) || [];
  });
  
  // Schedule celebration dialogues in a loop
  partyInterval = setInterval(() => {
    if (!currentProjectState || currentProjectState.state !== 'COMPLETED') {
      clearInterval(partyInterval);
      partyInterval = null;
      return;
    }
    const partyDialogues = [
      "To the client's success! Cheers! 🥂",
      "We did it! Pop the champagne! 🍾",
      "Fantastic team effort! Clink! 🥂",
      "Best codebase we've ever shipped! 🚀",
      "Cheers everyone! 🥂✨",
      "Time to relax and celebrate! 🎉",
      "Quality assurance checklist: 100% complete! 🥂",
      "Strategic alignment achieved, cheers! 🥂",
      "Outstanding implementation! Let's drink! 🍾"
    ];
    const activeAgentToSpeak = agents[Math.floor(Math.random() * agents.length)];
    const quote = partyDialogues[Math.floor(Math.random() * partyDialogues.length)];
    speak(activeAgentToSpeak, quote);
  }, 5000);
}

// Autonomous Milestone Standup Meetings
function runMilestoneStandup(milestone, onComplete) {
  // 1. Walk to meeting spots
  agents.forEach((agent, idx) => {
    const spot = meetingSpots[idx];
    agent.target = spot;
    agent.state = 'meeting';
    agent.statusText = 'Attending standup sync';
    agent.path = findPath({ r: agent.r, c: agent.c }, spot) || [];
  });
  
  // 2. Schedule speaking sequence when they arrive
  setTimeout(() => {
    let delay = 0;
    if (milestone === 'PLAN_APPROVED') {
      const dialogues = [
        { name: 'PMAgent', text: "Plan signed off! Welcome to kickoff standup." },
        { name: 'Partner', text: "Excellent. Let's make sure we deliver high value to the client on this project." },
        { name: 'Director', text: "Delivery assurance templates are ready. Let's begin execution." },
        { name: 'Consultant', text: "I've started gathering requirements and mapping processes." },
        { name: 'DesignAgent', text: "UI/UX wireframes and specs will be ready shortly." },
        { name: 'DevAgent', text: "Ready to implement backend codebase in FastAPI." },
        { name: 'PMAgent', text: "Excellent! Let's get to work, team!" }
      ];
      dialogues.forEach((d) => {
        setTimeout(() => {
          const agent = agents.find(a => a.name === d.name);
          if (agent) speak(agent, d.text);
        }, delay);
        delay += 2500;
      });
    } else if (milestone === 'COMPLETED') {
      const dialogues = [
        { name: 'PMAgent', text: "Fantastic work! All project deliverables are secured." },
        { name: 'Consultant', text: "Requirements and process maps are finalized!" },
        { name: 'DesignAgent', text: "Visual design specs are complete and look pixel-perfect!" },
        { name: 'DevAgent', text: "App backend has been verified and fully exported!" },
        { name: 'Director', text: "Delivery assurance standards met. Excellent quality team!" },
        { name: 'Partner', text: "Indeed. Spectacular delivery! Client is very satisfied." },
        { name: 'PMAgent', text: "Client notification dispatched! Success team!" }
      ];
      dialogues.forEach((d) => {
        setTimeout(() => {
          const agent = agents.find(a => a.name === d.name);
          if (agent) speak(agent, d.text);
        }, delay);
        delay += 2500;
      });
    }
    
    // 3. Walk back to desks (or start success party!) after speaking finishes
    setTimeout(() => {
      if (milestone === 'COMPLETED') {
        triggerSuccessParty();
      } else {
        backToWork();
      }
      if (onComplete) onComplete();
    }, delay + 1000);
    
  }, 3000); // 3 seconds walk delay
}

let lastState = null;
let lastStep = null;

function updateLiveProgressBar() {
  if (!currentProjectState) return;

  const state = currentProjectState.state;
  const step = currentProjectState.step;

  const nodePlanning = document.getElementById('node-planning');
  const nodeRequirements = document.getElementById('node-requirements');
  const nodeDesign = document.getElementById('node-design');
  const nodeDevelopment = document.getElementById('node-development');
  const nodeTesting = document.getElementById('node-testing');
  const nodeCompleted = document.getElementById('node-completed');
  const progressFill = document.getElementById('live-progress-fill');

  // Helper to clear classes
  const nodes = [nodePlanning, nodeRequirements, nodeDesign, nodeDevelopment, nodeTesting, nodeCompleted];
  nodes.forEach(n => {
    if (n) {
      n.classList.remove('active', 'completed');
    }
  });

  let fillWidth = '0%';

  if (state === 'IDLE') {
    fillWidth = '0%';
  } else if (state === 'PLAN_PENDING') {
    fillWidth = '10%';
    if (nodePlanning) nodePlanning.classList.add('active');
  } else if (state === 'DEVELOPMENT') {
    if (step === 0) {
      fillWidth = '20%';
      if (nodePlanning) nodePlanning.classList.add('completed');
      if (nodeRequirements) nodeRequirements.classList.add('active');
    } else if (step === 1) {
      fillWidth = '40%';
      if (nodePlanning) nodePlanning.classList.add('completed');
      if (nodeRequirements) nodeRequirements.classList.add('completed');
      if (nodeDesign) nodeDesign.classList.add('active');
    } else if (step === 2) {
      fillWidth = '60%';
      if (nodePlanning) nodePlanning.classList.add('completed');
      if (nodeRequirements) nodeRequirements.classList.add('completed');
      if (nodeDesign) nodeDesign.classList.add('completed');
      if (nodeDevelopment) nodeDevelopment.classList.add('active');
    } else if (step === 3) {
      fillWidth = '80%';
      if (nodePlanning) nodePlanning.classList.add('completed');
      if (nodeRequirements) nodeRequirements.classList.add('completed');
      if (nodeDesign) nodeDesign.classList.add('completed');
      if (nodeDevelopment) nodeDevelopment.classList.add('completed');
      if (nodeTesting) nodeTesting.classList.add('active');
    } else if (step === 4 || step > 3) {
      fillWidth = '90%';
      if (nodePlanning) nodePlanning.classList.add('completed');
      if (nodeRequirements) nodeRequirements.classList.add('completed');
      if (nodeDesign) nodeDesign.classList.add('completed');
      if (nodeDevelopment) nodeDevelopment.classList.add('completed');
      if (nodeTesting) nodeTesting.classList.add('completed');
      if (nodeCompleted) nodeCompleted.classList.add('active');
    }
  } else if (state === 'COMPLETED') {
    fillWidth = '100%';
    nodes.forEach(n => {
      if (n) n.classList.add('completed');
    });
  }

  if (progressFill) {
    progressFill.style.width = fillWidth;
  }

  // Trigger sound fanfares on transition
  if (lastState !== null) {
    if (lastState === 'PLAN_PENDING' && state === 'DEVELOPMENT' && step === 0) {
      synth.play('powerup');
    } else if (state === 'COMPLETED' && lastState !== 'COMPLETED') {
      synth.play('success');
    } else if (state === 'DEVELOPMENT' && lastState === 'DEVELOPMENT' && step > lastStep) {
      synth.play('coin');
    } else if (lastState === 'IDLE' && state === 'PLAN_PENDING') {
      synth.play('levelup');
    }
  }

  lastState = state;
  lastStep = step;
}

// Project State machine UI Updates
function updateProjectStateUI() {
  if (!currentProjectState) return;
  
  const banner = document.getElementById('signoff-banner');
  const compBanner = document.getElementById('completion-banner');
  
  // 1. Manage Sign-off banner
  if (currentProjectState.state === 'PLAN_PENDING') {
    if (banner) banner.style.display = 'flex';
  } else {
    if (banner) banner.style.display = 'none';
  }
  
  // 2. Manage Completion banner
  if (currentProjectState.state === 'COMPLETED') {
    if (compBanner) compBanner.style.display = 'flex';
  }
  
  // 3. Update scope field
  const scopeEl = document.getElementById('project-scope');
  if (scopeEl) {
    scopeEl.value = currentProjectState.scope || '';
  }
  
  // 4. Update Gantt bars
  updateGanttChartBars();
  
  // 5. Update live project progress bar
  updateLiveProgressBar();
  
  // 6. Update client email inbox feed
  if (typeof updateEmailsFeed === 'function') {
    updateEmailsFeed();
  }
}

function updateGanttChartBars() {
  if (!currentProjectState || !currentProjectState.phases) return;
  const phases = currentProjectState.phases;
  
  const planningBar = document.getElementById('gantt-planning');
  const requirementsBar = document.getElementById('gantt-requirements');
  const designBar = document.getElementById('gantt-design');
  const devBar = document.getElementById('gantt-dev');
  const testingBar = document.getElementById('gantt-testing');
  
  const getWidth = (status) => {
    if (status === 'Completed') return '100%';
    if (status === 'In Progress') return '50%';
    return '0%';
  };
  
  if (planningBar) planningBar.style.width = getWidth(phases.Planning);
  if (requirementsBar) requirementsBar.style.width = getWidth(phases.Requirements);
  if (designBar) designBar.style.width = getWidth(phases.Design);
  if (devBar) devBar.style.width = getWidth(phases.Development);
  if (testingBar) testingBar.style.width = getWidth(phases.Testing);
}

// Start simulation
render();
logActivity("System", "KPMG Agentic AI Simulator Engine Online.");
agents.forEach(a => logActivity(a.name, `Initialized at desk (${a.homeDesk.r}, ${a.homeDesk.c})`));

// Check and load project state from disk on load
// Check and load project state from disk on load
async function loadProjectStateOnLoad() {
  try {
    const origin = (window.location.origin && window.location.origin !== 'null' && window.location.origin.startsWith('http')) ? window.location.origin : 'http://localhost:8080';
    const response = await fetch(`${origin}/api/deliverables/download/project_state.json`);
    if (response.ok) {
      currentProjectState = await response.json();
      updateProjectStateUI();
      evaluateAgentRoles();
    } else {
      evaluateAgentRoles();
    }
  } catch (e) {
    console.log("No existing project state found on load.");
    evaluateAgentRoles();
  }
  
  // Fetch dynamic agent settings
  await fetchAgentConfigs();
}
loadProjectStateOnLoad();

// ─────────────────────────────────────────────────────────────
// CUSTOMIZABLE AGENTS CHARACTER SHEET CONTROLLER
// ─────────────────────────────────────────────────────────────
let loadedAgentConfigs = null;

async function fetchAgentConfigs() {
  try {
    const origin = (window.location.origin && window.location.origin !== 'null' && window.location.origin.startsWith('http')) ? window.location.origin : 'http://localhost:8080';
    const response = await fetch(`${origin}/api/agents`);
    if (response.ok) {
      loadedAgentConfigs = await response.json();
      syncAgentsFromConfig();
    }
  } catch (e) {
    console.error("Failed to fetch agent configurations from backend:", e);
  }
}

function syncAgentsFromConfig() {
  if (!loadedAgentConfigs) return;
  agents.forEach(agent => {
    const cfg = loadedAgentConfigs[agent.name];
    if (cfg) {
      agent.customName = cfg.name;
      agent.role = cfg.role;
      agent.clothes = cfg.clothes;
      agent.hair = cfg.hair;
      agent.skills = cfg.skills;
      agent.level = cfg.level;
      agent.hp = cfg.hp;
      agent.mana = cfg.mana;
      agent.xp = cfg.xp;
      agent.persona = cfg.persona;
      agent.config = cfg.config;
    }
  });

  updateAgentTabsUI();
  renderCharacterSheet();
}

function updateAgentTabsUI() {
  document.querySelectorAll('.agent-tab').forEach(tab => {
    const agentKey = tab.getAttribute('data-agent');
    const agent = agents.find(a => a.name === agentKey);
    if (agent && agent.customName) {
      tab.innerText = agent.customName;
    }
  });
}

function renderCharacterSheet() {
  const agent = agents.find(a => a.name === activeAgent);
  if (!agent) return;

  // Render basic details
  const nameEl = document.getElementById('char-name');
  const roleEl = document.getElementById('char-role');
  const levelEl = document.getElementById('char-level');
  
  if (nameEl) nameEl.innerText = agent.customName || agent.name;
  if (roleEl) roleEl.innerText = agent.role;
  if (levelEl) levelEl.innerText = `LVL ${agent.level || 5}`;

  // Render HP Bar
  const hp = agent.hp || 100;
  const maxHp = 100;
  const hpBar = document.getElementById('char-hp-bar');
  const hpVal = document.getElementById('char-hp-val');
  if (hpBar) hpBar.style.width = `${(hp / maxHp) * 100}%`;
  if (hpVal) hpVal.innerText = `${hp}/${maxHp}`;

  // Render MP Bar
  const mp = agent.mana || 80;
  const maxMpMap = { PMAgent: 80, Consultant: 85, Partner: 50, Director: 60, DevAgent: 120, DesignAgent: 90 };
  const curMaxMp = maxMpMap[agent.name] || 100;
  const mpBar = document.getElementById('char-mp-bar');
  const mpVal = document.getElementById('char-mp-val');
  if (mpBar) mpBar.style.width = `${(mp / curMaxMp) * 100}%`;
  if (mpVal) mpVal.innerText = `${mp}/${curMaxMp}`;

  // Render XP Bar
  const xp = agent.xp || 350;
  const maxXp = 500;
  const xpBar = document.getElementById('char-xp-bar');
  const xpVal = document.getElementById('char-xp-val');
  if (xpBar) xpBar.style.width = `${(xp / maxXp) * 100}%`;
  if (xpVal) xpVal.innerText = `${xp}/${maxXp}`;

  // Render Skills List
  const skillsContainer = document.getElementById('char-skills-list');
  if (skillsContainer) {
    skillsContainer.innerHTML = '';
    const skillsList = typeof agent.skills === 'string'
      ? agent.skills.split(',').map(s => s.trim())
      : (agent.skills || []);

    skillsList.forEach(skill => {
      if (skill) {
        const badge = document.createElement('span');
        badge.className = 'skill-badge';
        badge.innerText = skill;
        skillsContainer.appendChild(badge);
      }
    });
  }

  // Render Persona Description
  const personaDesc = document.getElementById('char-persona-desc');
  if (personaDesc) {
    let rawPersona = agent.persona || '';
    let currentScope = '';
    const scopeEl = document.getElementById('project-scope');
    if (scopeEl) currentScope = scopeEl.value.trim();
    if (!currentScope && currentProjectState) currentScope = currentProjectState.scope;
    
    let cleanPersona = rawPersona
      .replace(/{scope}/g, currentScope || 'No project scope')
      .replace(/{state}/g, (currentProjectState ? currentProjectState.state : 'IDLE'));
    personaDesc.innerText = cleanPersona;
  }

  // Draw Avatar preview in card
  drawAgentPreview(agent);
}

// ─────────────────────────────────────────────────────────────
// AUTONOMOUS COLLABORATION WORKFLOW TRIGGERS
// ─────────────────────────────────────────────────────────────
async function triggerFirstDevelopmentStep() {
  const origin = (window.location.origin && window.location.origin !== 'null' && window.location.origin.startsWith('http')) ? window.location.origin : 'http://localhost:8080';
  const activeAgentKey = "Consultant";
  
  // Auto-select tab
  document.querySelectorAll('.agent-tab').forEach(tab => {
    if (tab.getAttribute('data-agent') === activeAgentKey) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
  activeAgent = activeAgentKey;
  renderActiveChat();
  renderCharacterSheet();

  try {
    const scopeEl = document.getElementById('project-scope');
    const currentScope = scopeEl ? scopeEl.value.trim() : '';
    
    // Disable inputs
    const inputEl = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-chat-btn');
    if (inputEl) inputEl.disabled = true;
    if (sendBtn) sendBtn.disabled = true;

    logActivity("System", "Requirements & Process mapping phase started autonomously...");
    
    const response = await fetch(`${origin}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: "Start requirements mapping", agent: activeAgentKey, scope: currentScope })
    });
    
    if (response.ok) {
      const data = await response.json();
      
      const oldState = currentProjectState ? currentProjectState.state : 'IDLE';
      const oldStep = currentProjectState ? currentProjectState.step : 0;
      
      currentProjectState = data.project_state;
      updateProjectStateUI();
      
      const newState = currentProjectState.state;
      const newStep = currentProjectState.step;
      
      const respondingAgent = agents.find(a => a.name === activeAgentKey);
      if (respondingAgent && data.response_text) {
        speak(respondingAgent, data.response_text);
      }
      
      if (oldState === 'DEVELOPMENT' && newState === 'DEVELOPMENT' && newStep > oldStep) {
        if (oldStep === 0 && newStep === 1) {
          runCollaborationWalk('Consultant', 'DesignAgent', 
            "DesignAgent, here are the business requirements. Let's design the UI!", 
            "Thanks! I will start on the UI/UX layout specs.", 
            () => { refreshDeliverables(); evaluateAgentRoles(); triggerNextDevelopmentStep(); }
          );
        }
      }
    }
  } catch (e) {
    console.error("First step trigger error:", e);
  } finally {
    const inputEl = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-chat-btn');
    if (inputEl) inputEl.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
  }
}

async function triggerNextDevelopmentStep() {
  if (!currentProjectState || currentProjectState.state !== 'DEVELOPMENT') return;
  const step = currentProjectState.step;
  if (step < 1 || step > 4) return;

  const origin = (window.location.origin && window.location.origin !== 'null' && window.location.origin.startsWith('http')) ? window.location.origin : 'http://localhost:8080';
  
  let nextAgent = "PMAgent";
  let promptMsg = "Proceed with next phase";
  if (step === 1) {
    nextAgent = "DesignAgent";
    promptMsg = "Start designing layout specifications";
  } else if (step === 2) {
    nextAgent = "DevAgent";
    promptMsg = "Start implementing application code";
  } else if (step === 3) {
    nextAgent = "QAAgent";
    promptMsg = "Start auditing code quality and writing tests";
  } else if (step === 4) {
    nextAgent = "PMAgent";
    promptMsg = "Wrap up project deliverables";
  }

  // Auto-select tab
  document.querySelectorAll('.agent-tab').forEach(tab => {
    if (tab.getAttribute('data-agent') === nextAgent) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
  activeAgent = nextAgent;
  renderActiveChat();
  renderCharacterSheet();

  try {
    // Disable inputs
    const inputEl = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-chat-btn');
    if (inputEl) inputEl.disabled = true;
    if (sendBtn) sendBtn.disabled = true;

    logActivity("System", `${nextAgent} task started autonomously...`);
    
    const scopeEl = document.getElementById('project-scope');
    const currentScope = scopeEl ? scopeEl.value.trim() : '';

    const response = await fetch(`${origin}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: promptMsg, agent: nextAgent, scope: currentScope })
    });
    
    if (response.ok) {
      const data = await response.json();
      
      const oldState = currentProjectState ? currentProjectState.state : 'IDLE';
      const oldStep = currentProjectState ? currentProjectState.step : 0;
      
      currentProjectState = data.project_state;
      updateProjectStateUI();
      
      const newState = currentProjectState.state;
      const newStep = currentProjectState.step;
      
      const respondingAgent = agents.find(a => a.name === nextAgent);
      const pmAgent = agents.find(a => a.name === 'PMAgent');
      
      if (respondingAgent && data.response_text) {
        speak(respondingAgent, data.response_text);
      } else if (pmAgent && data.response_text) {
        speak(pmAgent, data.response_text);
      }
      
      if (oldState === 'DEVELOPMENT' && newState === 'DEVELOPMENT' && newStep > oldStep) {
        if (oldStep === 1 && newStep === 2) {
          runCollaborationWalk('DesignAgent', 'DevAgent', 
            "DevAgent, here are the UI specifications. Backend is all yours!", 
            "Thanks DesignAgent! I will start on the FastAPI application code.", 
            () => { refreshDeliverables(); evaluateAgentRoles(); triggerNextDevelopmentStep(); }
          );
        } else if (oldStep === 2 && newStep === 3) {
          runCollaborationWalk('DevAgent', 'QAAgent', 
            "QAAgent, backend is done. Please audit quality and write automated tests!", 
            "Got it DevAgent! I'll get the test suite and QA report ready.", 
            () => { refreshDeliverables(); evaluateAgentRoles(); triggerNextDevelopmentStep(); }
          );
        } else if (oldStep === 3 && newStep === 4) {
          runCollaborationWalk('QAAgent', 'PMAgent', 
            "PMAgent, testing and auditing are finished. Please do the final review!", 
            "Outstanding testing! I will compile the final report.", 
            () => { refreshDeliverables(); evaluateAgentRoles(); triggerNextDevelopmentStep(); }
          );
        }
      } else if (oldState === 'DEVELOPMENT' && newState === 'COMPLETED') {
        runMilestoneStandup('COMPLETED', () => {
          refreshDeliverables();
          evaluateAgentRoles();
        });
      }
    }
  } catch (e) {
    console.error("Autonomous handoff trigger error:", e);
  } finally {
    const inputEl = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-chat-btn');
    if (inputEl) inputEl.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
  }
}

function drawAgentPreview(agent) {
  const previewCanvas = document.getElementById('agent-preview-canvas');
  if (!previewCanvas) return;
  const pCtx = previewCanvas.getContext('2d');
  pCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  
  // Render agent sprite scaled up to fit preview
  PixelAssets.drawAgent(pCtx, 8, 8, 48, 48, 'down', 0, agent.clothes, agent.hair, "");
}

// Attach customize modal listeners
(function initCustomizeModal() {
  const editBtn = document.getElementById('edit-agent-btn');
  const modal = document.getElementById('agent-customize-modal');
  const closeBtn = document.getElementById('close-customize-modal');
  const cancelBtn = document.getElementById('cancel-customize-btn');
  const saveBtn = document.getElementById('save-customize-btn');
  
  if (editBtn && modal) {
    editBtn.addEventListener('click', () => {
      const agent = agents.find(a => a.name === activeAgent);
      if (!agent) return;

      document.getElementById('edit-char-name').value = agent.customName || agent.name;
      document.getElementById('edit-char-role').value = agent.role;
      document.getElementById('edit-char-skills').value = typeof agent.skills === 'string' ? agent.skills : (agent.skills || []).join(', ');
      document.getElementById('edit-char-persona').value = agent.persona || '';

      const modelSelect = document.getElementById('edit-char-model');
      const tempInput = document.getElementById('edit-char-temp');
      const tempDisplay = document.getElementById('temp-val-display');

      const model = agent.config && agent.config.model ? agent.config.model : 'gemini-3.5-flash';
      const temp = agent.config && agent.config.temperature !== undefined ? agent.config.temperature : 0.7;

      if (modelSelect) modelSelect.value = model;
      if (tempInput) {
        tempInput.value = temp;
        if (tempDisplay) tempDisplay.innerText = temp;
      }

      const clothesHex = agent.clothes || '#000000';
      const hairHex = agent.hair || '#000000';

      const clothesColorInput = document.getElementById('edit-char-clothes-color');
      const clothesHexInput = document.getElementById('edit-char-clothes-hex');
      const hairColorInput = document.getElementById('edit-char-hair-color');
      const hairHexInput = document.getElementById('edit-char-hair-hex');

      if (clothesColorInput) clothesColorInput.value = clothesHex;
      if (clothesHexInput) clothesHexInput.value = clothesHex;
      if (hairColorInput) hairColorInput.value = hairHex;
      if (hairHexInput) hairHexInput.value = hairHex;

      modal.style.display = 'flex';
    });
  }

  // Bind cancel actions
  [closeBtn, cancelBtn].forEach(btn => {
    if (btn) {
      btn.addEventListener('click', () => {
        if (modal) modal.style.display = 'none';
      });
    }
  });

  // Bind color input syncing
  const clothesColorInput = document.getElementById('edit-char-clothes-color');
  const clothesHexInput = document.getElementById('edit-char-clothes-hex');
  if (clothesColorInput && clothesHexInput) {
    clothesColorInput.addEventListener('input', (e) => {
      clothesHexInput.value = e.target.value.toUpperCase();
    });
    clothesHexInput.addEventListener('input', (e) => {
      const val = e.target.value;
      if (/^#[0-9A-F]{6}$/i.test(val)) {
        clothesColorInput.value = val;
      }
    });
  }

  const hairColorInput = document.getElementById('edit-char-hair-color');
  const hairHexInput = document.getElementById('edit-char-hair-hex');
  if (hairColorInput && hairHexInput) {
    hairColorInput.addEventListener('input', (e) => {
      hairHexInput.value = e.target.value.toUpperCase();
    });
    hairHexInput.addEventListener('input', (e) => {
      const val = e.target.value;
      if (/^#[0-9A-F]{6}$/i.test(val)) {
        hairColorInput.value = val;
      }
    });
  }

  // Temperature display slider
  const tempSlider = document.getElementById('edit-char-temp');
  const tempDisplayVal = document.getElementById('temp-val-display');
  if (tempSlider && tempDisplayVal) {
    tempSlider.addEventListener('input', (e) => {
      tempDisplayVal.innerText = e.target.value;
    });
  }

  // Save action
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const agent = agents.find(a => a.name === activeAgent);
      if (!agent) return;

      const nameVal = document.getElementById('edit-char-name').value.trim();
      const roleVal = document.getElementById('edit-char-role').value.trim();
      const skillsVal = document.getElementById('edit-char-skills').value.trim();
      const personaVal = document.getElementById('edit-char-persona').value.trim();
      const modelVal = document.getElementById('edit-char-model').value;
      const tempVal = parseFloat(document.getElementById('edit-char-temp').value);
      const clothesVal = document.getElementById('edit-char-clothes-hex').value.trim();
      const hairVal = document.getElementById('edit-char-hair-hex').value.trim();

      if (!nameVal || !roleVal || !personaVal || !clothesVal || !hairVal) {
        alert("All fields except skills are required.");
        return;
      }

      if (!loadedAgentConfigs) {
        loadedAgentConfigs = {};
      }

      // Rebuild agent configs
      const newConfigs = {};
      agents.forEach(a => {
        const isCurrent = a.name === activeAgent;
        newConfigs[a.name] = {
          name: isCurrent ? nameVal : (a.customName || a.name),
          role: isCurrent ? roleVal : a.role,
          persona: isCurrent ? personaVal : (a.persona || ""),
          skills: isCurrent ? skillsVal : (typeof a.skills === 'string' ? a.skills : (a.skills || []).join(', ')),
          level: a.level || 5,
          xp: a.xp || 350,
          hp: a.hp || 100,
          mana: a.mana || 80,
          clothes: isCurrent ? clothesVal : a.clothes,
          hair: isCurrent ? hairVal : a.hair,
          config: {
            model: isCurrent ? modelVal : (a.config ? a.config.model : 'gemini-3.5-flash'),
            temperature: isCurrent ? tempVal : (a.config && a.config.temperature !== undefined ? a.config.temperature : 0.7)
          }
        };
      });

      try {
        const origin = (window.location.origin && window.location.origin !== 'null' && window.location.origin.startsWith('http')) ? window.location.origin : 'http://localhost:8080';
        const response = await fetch(`${origin}/api/agents`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(newConfigs)
        });

        if (response.ok) {
          loadedAgentConfigs = newConfigs;
          syncAgentsFromConfig();
          if (modal) modal.style.display = 'none';
          logActivity("System", `Customized agent ${activeAgent} properties.`);
        } else {
          alert("Failed to save character specifications to backend.");
        }
      } catch (err) {
        console.error("Customize save error:", err);
        alert("Could not connect to backend to save character.");
      }
    });
  }
})();

// Local client-side fallback matching
function clientFallbackParser(message) {
  const msg = message.toLowerCase();
  
  if (activeAgent === 'PMAgent') {
    const pmAgent = agents.find(a => a.name === 'PMAgent');
    if (msg.includes('standup') || msg.includes('sync') || msg.includes('meeting')) {
      speak(pmAgent, "Team, let's assemble in the meeting room for our standup sync immediately!");
      triggerStandup();
    } else if (msg.includes('work') || msg.includes('desk') || msg.includes('code')) {
      speak(pmAgent, "Alright team, let's head back to our desks and focus on our respective tasks.");
      backToWork();
    } else if (msg.includes('break') || msg.includes('coffee') || msg.includes('lunch')) {
      speak(pmAgent, "Great progress today. Let's take a quick coffee break in the break room!");
      triggerBreak();
    } else if (msg.includes('dispatch') || msg.includes('assign') || msg.includes('task')) {
      speak(pmAgent, "I'm dispatching some new sprints and engineering tasks to the team now.");
      triggerRandomTasks();
    } else if (msg.includes('hello') || msg.includes('hi')) {
      speak(pmAgent, "Hello! I am the PM Agent. I can coordinate the team: ask me to call a standup, go back to work, take a break, or assign new tasks.");
    } else {
      speak(pmAgent, `Understood. I will evaluate that instruction: "${message}"`);
    }
  } else {
    const target = agents.find(a => a.name === activeAgent);
    if (target) {
      speak(target, `Hi client! I received your query: "${message}". Ready to collaborate!`);
    }
  }
}

async function handleChatSubmit() {
  const inputEl = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-chat-btn');
  const scopeEl = document.getElementById('project-scope');
  if (!inputEl) return;
  
  const text = inputEl.value.trim();
  if (!text) return;
  
  const currentScope = scopeEl ? scopeEl.value.trim() : '';
  
  inputEl.value = '';
  logActivity("User", text);
  
  inputEl.disabled = true;
  if (sendBtn) sendBtn.disabled = true;
  
  try {
    const origin = (window.location.origin && window.location.origin !== 'null' && window.location.origin.startsWith('http')) ? window.location.origin : 'http://localhost:8080';
    const response = await fetch(`${origin}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: text, agent: activeAgent, scope: currentScope })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    const pmAgent = agents.find(a => a.name === 'PMAgent');
    const respondingAgent = agents.find(a => a.name === activeAgent);
    
    if (data.project_scope) {
      if (scopeEl) {
        scopeEl.value = data.project_scope;
      }
      logActivity("System", `Project scope dynamically updated by PMAgent to: "${data.project_scope}"`);
    }

    if (respondingAgent && data.response_text) {
      speak(respondingAgent, data.response_text);
    } else if (pmAgent && data.response_text) {
      speak(pmAgent, data.response_text);
    }
    
    if (data.action === 'STANDUP') {
      triggerStandup();
    } else if (data.action === 'WORK') {
      backToWork();
    } else if (data.action === 'BREAK') {
      triggerBreak();
    } else if (data.action === 'DISPATCH') {
      triggerRandomTasks();
    }
    
    if (activeAgent === 'PMAgent' && data.target_agent && data.target_agent !== 'ALL') {
      const target = agents.find(a => a.name === data.target_agent);
      if (target) {
        setTimeout(() => {
          const confirmations = [
            "Sure, PM! On it.",
            "I'm working on that right now.",
            "Understood, starting now.",
            "Okay, updating status.",
            "Will do!"
          ];
          speak(target, confirmations[Math.floor(Math.random() * confirmations.length)]);
        }, 1500);
      }
    }

    // Monitor Project State Transitions
    if (data.project_state) {
      const oldState = currentProjectState ? currentProjectState.state : 'IDLE';
      const oldStep = currentProjectState ? currentProjectState.step : 0;
      
      currentProjectState = data.project_state;
      updateProjectStateUI();
      
      const newState = currentProjectState.state;
      const newStep = currentProjectState.step;
      
      if (oldState === 'PLAN_PENDING' && newState === 'DEVELOPMENT') {
        runMilestoneStandup('PLAN_APPROVED', () => {
          refreshDeliverables();
          evaluateAgentRoles();
          // Auto-trigger the Design phase
          triggerFirstDevelopmentStep();
        });
      } else if (oldState === 'DEVELOPMENT' && newState === 'COMPLETED') {
        runMilestoneStandup('COMPLETED', () => {
          refreshDeliverables();
          evaluateAgentRoles();
        });
      } else if (oldState === 'DEVELOPMENT' && newState === 'DEVELOPMENT' && newStep > oldStep) {
        // Run collaboration walk sequence depending on handoff step
        if (oldStep === 0 && newStep === 1) {
          runCollaborationWalk('Consultant', 'DesignAgent', 
            "DesignAgent, here are the business requirements. Let's design the UI!", 
            "Thanks! I will start on the UI/UX layout specs.", 
            () => { refreshDeliverables(); evaluateAgentRoles(); triggerNextDevelopmentStep(); }
          );
        } else if (oldStep === 1 && newStep === 2) {
          runCollaborationWalk('DesignAgent', 'DevAgent', 
            "DevAgent, here are the UI specifications. Backend is all yours!", 
            "Thanks DesignAgent! I will start on the FastAPI application code.", 
            () => { refreshDeliverables(); evaluateAgentRoles(); triggerNextDevelopmentStep(); }
          );
        } else if (oldStep === 2 && newStep === 3) {
          runCollaborationWalk('DevAgent', 'PMAgent', 
            "PMAgent, backend is done. Please do the final review!", 
            "Outstanding coding! I will compile the final report.", 
            () => { refreshDeliverables(); evaluateAgentRoles(); triggerNextDevelopmentStep(); }
          );
        } else {
          refreshDeliverables();
          evaluateAgentRoles();
        }
      } else {
        evaluateAgentRoles();
      }
    }
  } catch (err) {
    console.warn("Backend API error, falling back to local simulation logic:", err);
    logActivity("System", "Backend API unavailable. Running in client simulation mode.");
    clientFallbackParser(text);
  } finally {
    inputEl.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
    inputEl.focus();
  }
}

// Bind chat listeners
document.getElementById('send-chat-btn').addEventListener('click', handleChatSubmit);
document.getElementById('chat-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    handleChatSubmit();
  }
});

// Client Portal Extra Functionality: Scope & File Uploads
let uploadedFiles = [];

function renderFiles() {
  const listEl = document.getElementById('shared-files-list');
  if (!listEl) return;
  listEl.innerHTML = '';
  if (uploadedFiles.length === 0) {
    listEl.innerHTML = '<span class="no-files">No files uploaded yet</span>';
    return;
  }
  uploadedFiles.forEach((file, index) => {
    const badge = document.createElement('div');
    badge.className = 'file-badge';
    badge.innerHTML = `<span>${file.name}</span><span class="remove-file" onclick="removeUploadedFile(${index})">&times;</span>`;
    listEl.appendChild(badge);
  });
}

window.removeUploadedFile = function(index) {
  const file = uploadedFiles[index];
  uploadedFiles.splice(index, 1);
  renderFiles();
  logActivity("System", `Client removed file: ${file.name}`);
  const pmAgent = agents.find(a => a.name === 'PMAgent');
  if (pmAgent) {
    speak(pmAgent, `Noted. Removing the file: ${file.name}.`);
  }
};

const fileUploadEl = document.getElementById('file-upload');
if (fileUploadEl) {
  fileUploadEl.addEventListener('change', (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const pmAgent = agents.find(a => a.name === 'PMAgent');
    const devAgent = agents.find(a => a.name === 'DevAgent');
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      uploadedFiles.push({ name: file.name, size: file.size });
      logActivity("System", `Client uploaded file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    }
    renderFiles();
    
    if (pmAgent) {
      speak(pmAgent, `Thanks for the files! DevAgent, DesignAgent, check out the new files.`);
      if (devAgent) {
        setTimeout(() => {
          speak(devAgent, `On it, PM! Let me inspect these new assets and instructions.`);
        }, 2000);
      }
    }
    e.target.value = '';
  });
}


// Bind click listeners for Agent Tabs
document.querySelectorAll('.agent-tab').forEach(tab => {
  tab.addEventListener('click', (e) => {
    document.querySelectorAll('.agent-tab').forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');
    activeAgent = e.target.getAttribute('data-agent');
    renderActiveChat();
    renderCharacterSheet();
  });
});

// Initialize active chat display on load
renderActiveChat();

// Thought collections for each agent
const agentThoughts = {
  PMAgent: [
    "How is the Gantt chart progress today?",
    "Need to coordinate the standup sync.",
    "Are all deliverables secured for the client?",
    "We need to keep the sprints on schedule.",
    "Product Management is about alignment.",
    "Coffee is the ultimate fuel."
  ],
  Consultant: [
    "Process maps need to be extremely clear for the client.",
    "Gathering all system integrations parameters...",
    "Drafting the requirements document takes patience.",
    "Researching best practices for the FastAPI setup."
  ],
  Partner: [
    "DND - in executive call",
    "Partner review meetings scheduled for today."
  ],
  Director: [
    "DND - on client call",
    "Delivery assurance check is underway."
  ],
  DevAgent: [
    "FastAPI makes backend development so clean.",
    "Should we write a unit test for this router?",
    "Did I remember to commit my latest code?",
    "Let me check if SQLite connection is open.",
    "Need to optimize the graph traversal flow.",
    "Debugging is like detective work."
  ],
  DesignAgent: [
    "Should we use retro cyan or hot pink?",
    "Vibrant color palettes make the simulation alive.",
    "Subtle animations really improve user experience.",
    "Let's double-check the sprite alignment.",
    "retro aesthetic makes the platform stand out!"
  ],
  QAAgent: [
    "Pytest unit test suite is looking solid.",
    "Found a boundary case validation bug!",
    "Analyzing the code quality score of our API.",
    "Checking security headers on our endpoints.",
    "Making sure we have 100% route coverage."
  ]
};

// Trigger randomized thinking bubbles for agents
function triggerAgentThought(agent) {
  if (agent.name === 'Partner' || agent.name === 'Director') {
    speak(agent, "DND - in executive call");
    return;
  }
  const thoughts = agentThoughts[agent.name];
  if (thoughts) {
    const randomThought = thoughts[Math.floor(Math.random() * thoughts.length)];
    agent.thoughtText = randomThought;
    agent.thoughtTimer = 180; // 3 seconds at 60fps
    logActivity(agent.name, `*thinking* "${randomThought}"`);
  }
}

// Interactive walking sequence for agent collaboration (desk-to-desk handoffs)
function runCollaborationWalk(fromAgentName, toAgentName, fromMessage, toMessage, onComplete) {
  const fromAgent = agents.find(a => a.name === fromAgentName);
  const toAgent = agents.find(a => a.name === toAgentName);
  if (!fromAgent || !toAgent) return;
  
  // Set temporary state to collaborating
  fromAgent.state = 'working';
  fromAgent.statusText = `Discussing deliverables with ${toAgentName}`;
  
  // Stand at carpet tile adjacent to target agent's desk
  const targetSpot = { r: toAgent.homeDesk.r, c: toAgent.homeDesk.c - 1 };
  fromAgent.target = targetSpot;
  fromAgent.path = findPath({ r: fromAgent.r, c: fromAgent.c }, targetSpot) || [];
  
  // Periodically check if fromAgent has reached the destination
  const checkArrivalInterval = setInterval(() => {
    if (fromAgent.r === targetSpot.r && fromAgent.c === targetSpot.c) {
      clearInterval(checkArrivalInterval);
      
      // Face each other
      fromAgent.dir = 'right';
      toAgent.dir = 'left';
      
      speak(fromAgent, fromMessage);
      
      setTimeout(() => {
        speak(toAgent, toMessage);
        
        // Return to home desk
        setTimeout(() => {
          fromAgent.target = fromAgent.homeDesk;
          fromAgent.path = findPath({ r: fromAgent.r, c: fromAgent.c }, fromAgent.homeDesk) || [];
          fromAgent.state = 'working';
          fromAgent.statusText = getWorkingStatusText(fromAgent.name);
          if (onComplete) onComplete();
        }, 2000);
        
      }, 2000);
    }
  }, 100);
}

function evaluateAgentRoles() {
  if (!currentProjectState) return;
  
  const state = currentProjectState.state;
  const step = currentProjectState.step;
  
  if (state === 'COMPLETED') {
    triggerSuccessParty();
    return;
  } else {
    if (partyInterval) {
      clearInterval(partyInterval);
      partyInterval = null;
    }
  }
  
  agents.forEach((agent, idx) => {
    let isWorking = false;
    let isMeeting = false;
    
    if (agent.name === 'Partner' || agent.name === 'Director') {
      if (state === 'PLAN_PENDING') {
        isWorking = true;
        agent.statusText = agent.name === 'Partner' ? 'Reviewing scoping proposal' : 'Conducting risk review';
      } else {
        agent.state = 'break';
        agent.statusText = 'DND - in executive call';
        agent.target = agent.homeDesk;
        agent.path = findPath({ r: agent.r, c: agent.c }, agent.target) || [];
        return;
      }
    } else {
      if (state === 'PLAN_PENDING') {
        if (agent.name === 'PMAgent') isWorking = true;
      } else if (state === 'DEVELOPMENT') {
        if (step === 0 && (agent.name === 'Consultant' || agent.name === 'PMAgent')) {
          isWorking = true;
        } else if (step === 1 && (agent.name === 'DesignAgent' || agent.name === 'PMAgent')) {
          isWorking = true;
        } else if (step === 2 && (agent.name === 'DevAgent' || agent.name === 'PMAgent')) {
          isWorking = true;
        } else if (step === 3 && agent.name === 'PMAgent') {
          isWorking = true;
        }
      }
    }
    
    if (isMeeting) {
      agent.state = 'meeting';
      agent.statusText = 'Attending standup sync';
      agent.target = meetingSpots[idx];
    } else if (isWorking) {
      agent.state = 'working';
      agent.statusText = getWorkingStatusText(agent.name);
      agent.target = agent.homeDesk;
    } else {
      agent.state = 'break';
      agent.statusText = 'Idle - resting in break room';
      agent.target = breakSpots[idx];
    }
    
    agent.path = findPath({ r: agent.r, c: agent.c }, agent.target) || [];
  });
}

function getWorkingStatusText(agentName) {
  if (agentName === 'PMAgent') return 'Coordinating project plan & timelines';
  if (agentName === 'Consultant') return 'Researching requirements & process mapping';
  if (agentName === 'DesignAgent') return 'Creating layout wireframes & specifications';
  if (agentName === 'DevAgent') return 'Implementing FastAPI backend services';
  if (agentName === 'Partner') return 'Reviewing engagement proposal';
  if (agentName === 'Director') return 'Conducting risk review';
  return 'Working';
}

// Sidebar Drag-to-Resize Logic
(function() {
  const divider = document.getElementById('resize-divider');
  const sidebar = document.querySelector('.sidebar');
  const container = document.querySelector('.main-container');

  if (divider && sidebar && container) {
    let isDragging = false;
    
    divider.addEventListener('mousedown', (e) => {
      isDragging = true;
      divider.classList.add('active');
      document.body.style.cursor = 'col-resize';
      e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const containerRect = container.getBoundingClientRect();
      const newWidth = containerRect.right - e.clientX - 10;
      
      if (newWidth >= 300 && newWidth <= containerRect.width * 0.8) {
        sidebar.style.width = `${newWidth}px`;
      }
    });
    
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        divider.classList.remove('active');
        document.body.style.cursor = 'default';
      }
    });
  }
})();

// DELIVERABLES FILE EXPLORER MODAL IMPLEMENTATION
const deliverablesBtn = document.getElementById('deliverables-btn');
const deliverablesModal = document.getElementById('deliverables-modal');
const closeDeliverablesBtn = document.getElementById('close-deliverables-modal');

if (deliverablesBtn) {
  deliverablesBtn.addEventListener('click', () => {
    if (deliverablesModal) {
      deliverablesModal.style.display = 'flex';
      refreshDeliverables();
    }
  });
}

if (closeDeliverablesBtn) {
  closeDeliverablesBtn.addEventListener('click', () => {
    if (deliverablesModal) deliverablesModal.style.display = 'none';
  });
}

async function refreshDeliverables() {
  const listEl = document.getElementById('deliverables-list');
  if (!listEl) return;
  
  try {
    const origin = (window.location.origin && window.location.origin !== 'null' && window.location.origin.startsWith('http')) ? window.location.origin : 'http://localhost:8080';
    const response = await fetch(`${origin}/api/deliverables`);
    if (!response.ok) throw new Error("Failed to fetch");
    const files = await response.json();
    
    listEl.innerHTML = '';
    if (files.length === 0) {
      listEl.innerHTML = '<span class="no-files" style="text-align: center; width: 100%; display: block; padding: 20px 0;">No deliverables generated yet.</span>';
      return;
    }
    
    files.forEach(file => {
      const item = document.createElement('div');
      item.className = 'deliverable-item';
      item.innerHTML = `
        <div class="deliverable-info">
          <span class="deliverable-name">${file.name}</span>
          <span class="deliverable-size">${file.size}</span>
        </div>
        <a href="${origin}${file.url}" download class="download-link-btn">DOWNLOAD</a>
      `;
      listEl.appendChild(item);
    });
  } catch (err) {
    console.error("Error loading deliverables:", err);
    listEl.innerHTML = '<span class="no-files" style="color: #ff5555; text-align: center; width: 100%; display: block;">Error loading deliverables.</span>';
  }
}

// RESET SIMULATION IMPLEMENTATION
const resetProjectBtn = document.getElementById('reset-project-btn');
if (resetProjectBtn) {
  resetProjectBtn.addEventListener('click', async () => {
    if (confirm("Are you sure you want to reset the simulation? All deliverables will be deleted.")) {
      try {
        const origin = (window.location.origin && window.location.origin !== 'null' && window.location.origin.startsWith('http')) ? window.location.origin : 'http://localhost:8080';
        const response = await fetch(`${origin}/api/reset`, { method: 'POST' });
        if (response.ok) {
          alert("Simulation reset successful!");
          currentProjectState = {
            state: "IDLE",
            scope: "",
            step: 0,
            phases: { Planning: "Planned", Requirements: "Planned", Design: "Planned", Development: "Planned" }
          };
          updateProjectStateUI();
          evaluateAgentRoles();
          if (deliverablesModal) deliverablesModal.style.display = 'none';
          const inboxModal = document.getElementById('inbox-modal');
          if (inboxModal) inboxModal.style.display = 'none';
          document.getElementById('completion-banner').style.display = 'none';
          
          chatHistories = { PMAgent: [], Consultant: [], Partner: [], Director: [], DevAgent: [], DesignAgent: [], QAAgent: [] };
          emailReadStates = {};
          selectedEmailId = null;
          updateEmailsFeed();
          const placeholder = document.getElementById('email-detail-placeholder');
          const detail = document.getElementById('email-detail-content');
          if (placeholder && detail) {
            placeholder.style.display = 'flex';
            detail.style.display = 'none';
          }
          logActivity("System", "KPMG Agentic AI Simulator Reset.");
          renderActiveChat();
        }
      } catch (err) {
        console.error("Failed to reset project:", err);
      }
    }
  });
}

// SIGN-OFF EVENT LISTENERS
const signoffBtn = document.getElementById('signoff-btn');
if (signoffBtn) {
  signoffBtn.addEventListener('click', () => {
    const inputEl = document.getElementById('chat-input');
    if (inputEl) {
      inputEl.value = "SIGN OFF PLAN";
      handleChatSubmit();
    }
  });
}

// GANTT CHART MODAL IMPLEMENTATION & CANVAS CLICK DETECTION
const ganttModal = document.getElementById('gantt-modal');
const closeGanttBtn = document.getElementById('close-gantt-modal');

if (closeGanttBtn) {
  closeGanttBtn.addEventListener('click', () => {
    if (ganttModal) ganttModal.style.display = 'none';
  });
}

async function openGanttModal() {
  if (ganttModal) ganttModal.style.display = 'flex';
  updateGanttChartBars();
  
  const textEl = document.getElementById('charter-content-text');
  if (textEl) {
    textEl.innerText = "Loading project charter...";
  }
  
  try {
    const origin = (window.location.origin && window.location.origin !== 'null' && window.location.origin.startsWith('http')) ? window.location.origin : 'http://localhost:8080';
    const response = await fetch(`${origin}/api/deliverables/download/project_charter.md`);
    if (response.ok) {
      const text = await response.text();
      if (textEl) textEl.innerText = text;
    } else {
      if (textEl) textEl.innerText = "No active project charter found. Plan must be signed off first.";
    }
  } catch (err) {
    if (textEl) textEl.innerText = "Error loading project charter.";
  }
}

// Detect Click on Agent Sprites or PM Desk (Desk at row 10, col 14; Chair at row 11, col 14)
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const clickX = (e.clientX - rect.left) * scaleX;
  const clickY = (e.clientY - rect.top) * scaleY;
  
  const col = Math.floor(clickX / TILE_SIZE);
  const row = Math.floor(clickY / TILE_SIZE);
  
  // 1. Check if an agent was clicked
  let clickedAgent = null;
  agents.forEach(agent => {
    if (clickX >= agent.x && clickX <= agent.x + TILE_SIZE &&
        clickY >= agent.y && clickY <= agent.y + TILE_SIZE) {
      clickedAgent = agent;
    }
  });
  
  if (clickedAgent) {
    synth.play('click');
    // Show randomized thought popup
    triggerAgentThought(clickedAgent);
    
    // Auto-select agent tab on client portal
    document.querySelectorAll('.agent-tab').forEach(tab => {
      if (tab.getAttribute('data-agent') === clickedAgent.name) {
        tab.click();
      }
    });
    return;
  }
  
  // 2. Check for PM Desk click
  if ((row === 10 && col === 14) || (row === 11 && col === 14)) {
    synth.play('click');
    openGanttModal();
  }
});

// ─────────────────────────────────────────────────────────────
// CLIENT EMAIL INBOX CLIENT ENGINE
// ─────────────────────────────────────────────────────────────
const projectEmails = [
  {
    id: 'email_welcome',
    sender: 'PMAgent',
    senderRole: 'Engagement PM',
    subject: 'Project Kickoff & Proposed Scope',
    date: 'Day 1',
    body: (scope) => `Dear Client,

Welcome to the KPMG Agentic AI Office! We are excited to collaborate with you.

We have initiated the scoping process for your project: "${scope}".
Our team consists of:
- PMAgent (Engagement PM)
- Consultant (Senior BA & Research)
- DesignAgent (UI/UX Designer)
- DevAgent (Lead Developer)
- Partner & Director (Executive Oversight)

We have drafted the project plan and key milestones. Please review and sign off so we can start requirements gathering.

Best regards,
KPMG Solutions & Analytics Team`,
    trigger: (state, step) => state !== 'IDLE'
  },
  {
    id: 'email_plan',
    sender: 'PMAgent',
    senderRole: 'Engagement PM',
    subject: 'Project Plan & Key Milestones Attachment',
    date: 'Day 1',
    body: (scope) => `Dear Client,

The project plan for "${scope}" is officially ready.

Key Milestones:
- Milestone 1: Requirements Mapping & Business Requirements Document (BRD) Delivery
- Milestone 2: UI/UX Layout Specifications & Wireframe Approval
- Milestone 3: Core Application Logic & FastAPI Coding
- Milestone 4: Final Scoping Wrap-up and Handover

Please review the attached project_plan.md and click 'SIGN OFF PLAN' in your portal to approve.

Best,
PMAgent`,
    trigger: (state, step) => state !== 'IDLE'
  },
  {
    id: 'email_brd',
    sender: 'Consultant',
    senderRole: 'BA & Research',
    subject: 'DELIVERABLE: Business Requirements Document (BRD)',
    date: 'Day 2',
    body: (scope) => `Dear Client,

I am pleased to report that the Requirements & Process Mapping phase is complete.

I have generated and saved the Business Requirements Document (BRD) and process workflow maps to requirements_doc.md. This document includes the user personas, functional requirements, and the ASCII flow diagram of the system integrations.

The project has transitioned to the UI/UX design phase under DesignAgent.

Best regards,
Consultant`,
    trigger: (state, step) => state === 'COMPLETED' || (state === 'DEVELOPMENT' && step >= 1)
  },
  {
    id: 'email_design',
    sender: 'DesignAgent',
    senderRole: 'UI/UX Designer',
    subject: 'DELIVERABLE: UI/UX Wireframe & Design Specs',
    date: 'Day 3',
    body: (scope) => `Hi Client,

The UI/UX design phase for "${scope}" is now complete!

I have finalized the visual design system, color palette (featuring our signature cyan and pink theme), typography settings, and layout wireframe. You can find all specifications in design_specs.md.

I have handed off the blueprint to DevAgent who is now coding the application.

Cheers,
DesignAgent`,
    trigger: (state, step) => state === 'COMPLETED' || (state === 'DEVELOPMENT' && step >= 2)
  },
  {
    id: 'email_code',
    sender: 'DevAgent',
    senderRole: 'Lead Developer',
    subject: 'DELIVERABLE: FastAPI Application Backend Code',
    date: 'Day 4',
    body: (scope) => `Hi Client,

I have completed the core implementation of your application codebase!

The FastAPI application has been generated and saved to app.py. It includes the required routing endpoints, request/response Pydantic validation schemas, and a health check endpoint.

I am handing over to QAAgent for comprehensive code testing, test coverage analysis, and quality auditing.

Best,
DevAgent`,
    trigger: (state, step) => state === 'COMPLETED' || (state === 'DEVELOPMENT' && step >= 3)
  },
  {
    id: 'email_qa',
    sender: 'QAAgent',
    senderRole: 'QA Engineer',
    subject: 'DELIVERABLE: Automated Unit Tests & Code Quality Audit',
    date: 'Day 5',
    body: (scope) => `Hi Client,

I have completed the testing and verification of our FastAPI application codebase!

The automated unit test suite is saved to test_app.py and the detailed code quality assessment is saved to qa_report.md. All tests are passing and the quality meets our strict KPMG Solutions & Analytics standards.

I am passing this back to PMAgent for the final review and wrap-up.

Best,
QAAgent`,
    trigger: (state, step) => state === 'COMPLETED' || (state === 'DEVELOPMENT' && step >= 4)
  },
  {
    id: 'email_final',
    sender: 'PMAgent',
    senderRole: 'Engagement PM',
    subject: 'PROJECT COMPLETED: Final Delivery Handover',
    date: 'Day 6',
    body: (scope) => `Dear Client,

We are thrilled to announce that the project "${scope}" is officially complete! 🎉

All deliverables have been compiled and verified:
1. project_plan.md
2. project_charter.md
3. requirements_doc.md
4. design_specs.md
5. app.py
6. test_app.py
7. qa_report.md
8. final_report.md

You can download the full package from the Deliverables Directory. Thank you for partnering with KPMG Solutions & Analytics.

Best regards,
PMAgent & The KPMG Agentic AI Team`,
    trigger: (state, step) => state === 'COMPLETED'
  }
];

let emailReadStates = {};
let selectedEmailId = null;

function updateEmailsFeed() {
  if (!currentProjectState) return;
  const state = currentProjectState.state;
  const step = currentProjectState.step;
  
  const activeEmails = projectEmails.filter(email => email.trigger(state, step));
  
  // Track read/unread states
  activeEmails.forEach(email => {
    if (emailReadStates[email.id] === undefined) {
      emailReadStates[email.id] = false; // default to unread
    }
  });
  
  // Calculate unread count
  const unreadCount = activeEmails.filter(email => !emailReadStates[email.id]).length;
  const badgeEl = document.getElementById('inbox-badge');
  if (badgeEl) {
    if (unreadCount > 0) {
      badgeEl.style.display = 'inline-block';
      badgeEl.innerText = unreadCount;
    } else {
      badgeEl.style.display = 'none';
    }
  }
  
  // Render list panel
  const listPanel = document.getElementById('email-list-panel');
  if (listPanel) {
    listPanel.innerHTML = '';
    if (activeEmails.length === 0) {
      listPanel.innerHTML = '<span style="color: #718096; font-size: 11px; font-style: italic; text-align: center; margin-top: 20px;">No emails received.</span>';
    } else {
      // Show newest emails first
      const reversedEmails = [...activeEmails].reverse();
      reversedEmails.forEach(email => {
        const item = document.createElement('div');
        const isUnread = !emailReadStates[email.id];
        const isActive = selectedEmailId === email.id;
        item.className = `email-item${isUnread ? ' unread' : ''}${isActive ? ' active' : ''}`;
        
        let senderName = email.sender;
        const agObj = agents.find(a => a.name === email.sender);
        if (agObj && agObj.customName) {
          senderName = agObj.customName;
        }
        
        const scopeEl = document.getElementById('project-scope');
        const scope = scopeEl ? scopeEl.value.trim() : (currentProjectState.scope || '');
        const bodyText = email.body(scope);
        const snippet = bodyText.split('\n')[2] || bodyText.split('\n')[0] || '';
        
        item.innerHTML = `
          <div class="email-item-header">
            <span class="email-item-sender">${senderName}</span>
            <span class="email-item-date">${email.date}</span>
          </div>
          <div class="email-item-subject">${email.subject}</div>
          <div class="email-item-snippet">${snippet}</div>
        `;
        item.addEventListener('click', () => {
          selectEmail(email.id);
        });
        listPanel.appendChild(item);
      });
    }
  }
}

function selectEmail(emailId) {
  selectedEmailId = emailId;
  emailReadStates[emailId] = true;
  
  const email = projectEmails.find(e => e.id === emailId);
  const placeholder = document.getElementById('email-detail-placeholder');
  const detail = document.getElementById('email-detail-content');
  
  if (email && placeholder && detail) {
    placeholder.style.display = 'none';
    detail.style.display = 'flex';
    
    let senderName = email.sender;
    const agObj = agents.find(a => a.name === email.sender);
    if (agObj && agObj.customName) {
      senderName = agObj.customName;
    }
    
    document.getElementById('email-from').innerText = `${senderName} (${email.senderRole})`;
    document.getElementById('email-to').innerText = 'Client';
    document.getElementById('email-date').innerText = email.date;
    document.getElementById('email-subject').innerText = email.subject;
    
    const scopeEl = document.getElementById('project-scope');
    const scope = scopeEl ? scopeEl.value.trim() : (currentProjectState.scope || '');
    document.getElementById('email-body').innerText = email.body(scope);
  }
  
  updateEmailsFeed();
}

// Attach inbox modal event listeners
const inboxBtn = document.getElementById('inbox-btn');
const inboxModal = document.getElementById('inbox-modal');
const closeInboxBtn = document.getElementById('close-inbox-modal');

if (inboxBtn && inboxModal) {
  inboxBtn.addEventListener('click', () => {
    inboxModal.style.display = 'flex';
    updateEmailsFeed();
  });
}

if (closeInboxBtn && inboxModal) {
  closeInboxBtn.addEventListener('click', () => {
    inboxModal.style.display = 'none';
  });
}
