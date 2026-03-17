// ─── SpeedRead Training Course ───
// 28-day speed reading curriculum with persistence, drills, and certificates

const CURRICULUM = [
  // WEEK 1: FOUNDATIONS
  { day: 1, week: 1, title: "Your Baseline", type: "assessment", duration: 5,
    theory: "Before we can improve, we need to know where you are. Most adults read at 200-250 WPM — well below their potential. Your brain can process words much faster than you currently read. Today we measure your baseline.",
    drill: { type: "wpm_test", text: "standard_passage", target_wpm: null, description: "Read this passage at your natural pace. Don't try to go faster — just read normally." },
    lesson: "subvocalization_intro" },
  { day: 2, week: 1, title: "The Inner Voice Problem", type: "theory+drill", duration: 8,
    theory: "Subvocalization is the habit of 'saying' words in your head as you read. It's the single biggest limiter of reading speed — your inner voice can only speak at ~150-200 WPM, so that's your ceiling. Today we start breaking that ceiling.",
    drill: { type: "rsvp_drill", wpm_multiplier: 1.2, text: "short_article", description: "Read 20% faster than your baseline. Your inner voice won't be able to keep up — that's the point. Focus on understanding the meaning, not 'hearing' every word." },
    tip: "Hum softly to yourself while reading. This occupies your inner voice." },
  { day: 3, week: 1, title: "Stop Going Back", type: "theory+drill", duration: 8,
    theory: "Regression — re-reading words you've already passed — accounts for up to 30% of wasted reading time. Most regression is habitual, not necessary. Your comprehension is better than you think on first pass.",
    drill: { type: "rsvp_drill", wpm_multiplier: 1.2, lock_back: true, description: "Backtracking is disabled. Trust your first read." },
    tip: "If you feel the urge to re-read, keep going. Test yourself at the end — you understood more than you think." },
  { day: 4, week: 1, title: "How Your Eyes Actually Move", type: "theory+drill", duration: 10,
    theory: "Your eyes don't glide smoothly across text — they jump in saccades (rapid movements) and fixate (pause) on words. Average readers make 4-5 fixations per line. Speed readers make 1-2. RSVP eliminates fixations entirely by bringing words to you.",
    drill: { type: "rsvp_drill", wpm_multiplier: 1.3, description: "Try to see each word before it fully appears. Anticipate. Your visual cortex processes faster than you think." } },
  { day: 5, week: 1, title: "First Real Speed Push", type: "drill", duration: 10,
    theory: "Today we push to 150% of your baseline. This will feel uncomfortable. That discomfort is your brain building new neural pathways. Lean into it.",
    drill: { type: "rsvp_drill", wpm_multiplier: 1.5, description: "Push to 150% of your baseline WPM. 5 minutes. Go." } },
  { day: 6, week: 1, title: "Comprehension Check", type: "assessment", duration: 10,
    theory: "Speed without comprehension is worthless. Today we verify you're actually retaining what you read at your new speed.",
    drill: { type: "comprehension_test", wpm_multiplier: 1.3, questions: 5 } },
  { day: 7, week: 1, title: "Week 1 Assessment", type: "assessment", duration: 5,
    theory: "Let's measure your progress after one week.",
    drill: { type: "wpm_test", text: "standard_passage", description: "Same passage as Day 1. How much have you improved?" } },
  // WEEK 2: BUILDING SPEED
  { day: 8, week: 2, title: "Reading in Chunks", type: "theory+drill", duration: 10,
    theory: "Instead of reading word-by-word, train your brain to absorb 2-3 words as a single unit. This is how fast readers actually operate. Chunk mode in SpeedRead shows 2 words at once — let's practice.",
    drill: { type: "rsvp_drill", wpm_multiplier: 1.4, chunk: 2, description: "Words will appear in pairs. Read them as single units." } },
  { day: 9, week: 2, title: "The Pointer Technique", type: "theory+drill", duration: 8,
    theory: "Using your cursor or finger as a pacer forces your eyes to move at a consistent, controlled speed. It prevents the eye from drifting back and creates a rhythm.",
    drill: { type: "rsvp_drill", wpm_multiplier: 1.4, description: "Follow the pace. Let the rhythm guide you." } },
  { day: 10, week: 2, title: "Peripheral Vision Drills", type: "drill", duration: 10,
    theory: "Your peripheral vision can process words before your direct gaze lands on them. Today's drill builds that capability.",
    drill: { type: "rsvp_drill", wpm_multiplier: 1.5, description: "Focus on the center word but try to 'see' the next one coming." } },
  { day: 11, week: 2, title: "200% Speed Drill", type: "drill", duration: 10,
    theory: "Double your baseline. Comprehension will drop — that's normal and expected at this stage. We're building the speed pathway first, comprehension catches up.",
    drill: { type: "rsvp_drill", wpm_multiplier: 2.0, description: "2x your baseline. Don't worry about perfect comprehension — just absorb." } },
  { day: 12, week: 2, title: "Active Reading Setup", type: "theory+drill", duration: 10,
    theory: "Before you start reading, spend 60 seconds previewing: title, headings, first and last paragraphs. This primes your brain for what's coming and dramatically improves comprehension at speed.",
    drill: { type: "rsvp_drill", wpm_multiplier: 1.5, description: "Preview the passage title, then read at speed." } },
  { day: 13, week: 2, title: "Comprehension at 180%", type: "assessment", duration: 10,
    theory: "Speed check: can you maintain 75%+ comprehension at 180% of your baseline?",
    drill: { type: "comprehension_test", wpm_multiplier: 1.8, questions: 5 } },
  { day: 14, week: 2, title: "Week 2 Assessment", type: "assessment", duration: 5,
    theory: "Week 2 progress measurement. You should see 40-60% improvement over Day 1.",
    drill: { type: "wpm_test", text: "standard_passage", description: "How far have you come?" } },
  // WEEK 3: COMPREHENSION MASTERY
  { day: 15, week: 3, title: "The Speed-Comprehension Curve", type: "theory", duration: 8,
    theory: "There's a personal curve where comprehension starts dropping as speed increases. Finding YOUR curve — and learning to ride it — is the skill. Today we find your optimal zone." },
  { day: 16, week: 3, title: "Skimming vs. Speed Reading", type: "theory+drill", duration: 10,
    theory: "Skimming (reading only key sentences) and speed reading (reading everything fast) are different tools. Know when to use each.",
    drill: { type: "rsvp_drill", wpm_multiplier: 2.0, description: "Full speed read — absorb everything, not just key sentences." } },
  { day: 17, week: 3, title: "Technical Text Strategy", type: "theory+drill", duration: 10,
    theory: "Dense, technical content (legal, medical, academic) requires a different approach than narrative text. We cover the 3-pass reading strategy for complex material.",
    drill: { type: "rsvp_drill", wpm_multiplier: 1.5, description: "Technical passage. Slower is OK — calibrate for density." } },
  { day: 18, week: 3, title: "250% Speed Drill", type: "drill", duration: 10,
    theory: "2.5x your baseline. Short burst. Pure speed building.",
    drill: { type: "rsvp_drill", wpm_multiplier: 2.5, description: "Maximum effort. 2.5x baseline. Go." } },
  { day: 19, week: 3, title: "Note-Taking at Speed", type: "theory+drill", duration: 10,
    theory: "How to extract key ideas while reading fast. The Cornell method adapted for speed reading.",
    drill: { type: "rsvp_drill", wpm_multiplier: 1.8, description: "After reading, write 3 key takeaways from memory." } },
  { day: 20, week: 3, title: "Long-Form Practice", type: "drill", duration: 15,
    theory: "First long session — 15 minutes sustained at 200%+ baseline. Building endurance.",
    drill: { type: "rsvp_drill", wpm_multiplier: 2.0, description: "15 minutes sustained. Build your endurance." } },
  { day: 21, week: 3, title: "Week 3 Assessment", type: "assessment", duration: 8,
    theory: "You should be reading at 2-3x your Day 1 baseline with 75%+ comprehension.",
    drill: { type: "wpm_test", text: "standard_passage", description: "Week 3 measurement." } },
  // WEEK 4: MASTERY
  { day: 22, week: 4, title: "Content-Type Calibration", type: "theory+drill", duration: 10,
    theory: "Fiction vs. news vs. technical docs vs. academic papers all have optimal speed ranges. Learn to auto-calibrate.",
    drill: { type: "rsvp_drill", wpm_multiplier: 2.0, description: "Mixed content. Adjust your internal speed dial." } },
  { day: 23, week: 4, title: "300% Speed Burst", type: "drill", duration: 8,
    theory: "3x baseline for 3 minutes. Maximum speed training.",
    drill: { type: "rsvp_drill", wpm_multiplier: 3.0, description: "3x baseline. 3 minutes. Pure speed." } },
  { day: 24, week: 4, title: "Building the Daily Habit", type: "theory", duration: 8,
    theory: "The research on habit formation, identity-based habits, and how to make daily reading automatic. Habit stacking, implementation intentions, and environment design." },
  { day: 25, week: 4, title: "The 20-Minute Flow State", type: "drill", duration: 20,
    theory: "Extended session at your comfortable fast speed. Goal: enter a flow state where reading feels effortless.",
    drill: { type: "rsvp_drill", wpm_multiplier: 2.0, description: "20 minutes. Find your flow state." } },
  { day: 26, week: 4, title: "Teach What You Read", type: "theory+drill", duration: 10,
    theory: "The Feynman technique: the best way to verify comprehension is to explain it in simple terms. After this session you'll write a 3-sentence summary in your own words.",
    drill: { type: "rsvp_drill", wpm_multiplier: 2.0, description: "Read, then explain what you learned in 3 sentences." } },
  { day: 27, week: 4, title: "Full Speed Assessment", type: "assessment", duration: 10,
    theory: "Final speed + comprehension measurement. Your certificate will show your improvement from Day 1.",
    drill: { type: "wpm_test", text: "standard_passage", description: "Final speed measurement." } },
  { day: 28, week: 4, title: "Graduation Day 🎓", type: "assessment", duration: 5,
    theory: "You did it. Final measurement, certificate generation, and your personalized reading profile going forward.",
    drill: { type: "final_assessment" } },
];

// ─── Sample passages for drills ───
const PASSAGES = {
  standard_passage: `The art of reading quickly is not merely about moving your eyes faster across the page. It is a fundamental restructuring of how your brain processes written language. When most people read, they engage in a process called subvocalization — silently pronouncing each word in their mind. This creates an artificial speed limit tied to the pace of speech, roughly 150 to 250 words per minute.

Speed reading techniques bypass this bottleneck by training the visual cortex to process words as patterns rather than sounds. Just as you recognize a friend's face instantly without cataloging individual features, your brain can learn to recognize word groups and extract meaning directly from visual input.

The key insight is that comprehension does not require subvocalization. Research from cognitive psychology demonstrates that meaning is processed at a deeper level than phonological encoding. When you see the word "fire," you understand danger before your inner voice finishes saying it.

RSVP — Rapid Serial Visual Presentation — takes this principle to its logical extreme. By presenting words one at a time at a controlled pace, it eliminates saccadic eye movements entirely and forces your brain to process each word as it appears. The initial discomfort you feel is your brain building new neural pathways. Within days, what felt impossibly fast becomes your new normal.

The journey from average reader to speed reader is not about talent or intelligence. It is about practice, consistency, and the willingness to feel uncomfortable while your brain rewires itself. Every expert speed reader started exactly where you are now.`,

  short_article: `Technology has transformed how we consume information. The average person encounters more text in a single day than a medieval scholar read in an entire year. Email, news, social media, reports, and messages create a constant stream of words demanding our attention.

Yet our reading speed has barely changed in decades. Most adults read at the same pace they achieved in middle school. The mismatch between information volume and processing speed creates stress, missed details, and the nagging feeling of always being behind.

Speed reading is not a parlor trick. It is an essential modern skill. Those who can process information twice as fast effectively double their capacity for knowledge acquisition. In competitive fields, this advantage compounds daily.

The techniques are well-established and backed by decades of research. What was missing was accessible, daily practice. That is what this course provides — a structured path from wherever you are to wherever your brain can take you.`,

  technical_passage: `Neural plasticity, the brain's ability to reorganize synaptic connections in response to learning and experience, forms the scientific foundation for speed reading training. The visual word form area (VWFA), located in the left fusiform gyrus, specializes in orthographic processing — recognizing written words as visual patterns.

Studies using functional magnetic resonance imaging (fMRI) have demonstrated that skilled readers show increased activation in the VWFA and decreased activation in areas associated with phonological processing. This shift from sound-based to vision-based word recognition is precisely what speed reading training targets.

The dual-route model of reading proposes two pathways: a lexical route that maps whole words directly to meaning, and a sublexical route that converts letters to sounds before accessing meaning. Speed reading training strengthens the lexical route while reducing dependence on the slower sublexical pathway.

Cognitive load theory suggests that working memory has limited capacity. By automating low-level word recognition through practice, more cognitive resources become available for higher-order comprehension processes such as inference, integration, and critical evaluation.`
};

const COMPREHENSION_QUESTIONS = {
  standard_passage: [
    { q: "What is subvocalization?", options: ["Moving your lips while reading", "Silently pronouncing words in your mind", "Reading out loud to others", "Skipping words while reading"], answer: 1 },
    { q: "What does RSVP stand for?", options: ["Rapid Speed Visual Processing", "Rapid Serial Visual Presentation", "Reading Speed Verification Protocol", "Responsive Sequential Visual Parsing"], answer: 1 },
    { q: "What is the typical reading speed range for most adults?", options: ["50-100 WPM", "150-250 WPM", "400-600 WPM", "800-1000 WPM"], answer: 1 },
    { q: "How does the brain process the meaning of 'fire' according to the passage?", options: ["Only after subvocalization", "Before the inner voice finishes saying it", "Through phonological encoding first", "By sounding out the letters"], answer: 1 },
    { q: "What eliminates saccadic eye movements?", options: ["Reading faster", "Using a pointer", "RSVP presentation", "Skimming technique"], answer: 2 },
  ],
  short_article: [
    { q: "How does daily text exposure compare to medieval scholars?", options: ["About the same", "More in a day than they read in a year", "Less overall", "Double their weekly intake"], answer: 1 },
    { q: "What happens to most adults' reading speed after school?", options: ["It doubles naturally", "It barely changes", "It decreases significantly", "It improves with age"], answer: 1 },
    { q: "What does the passage call speed reading?", options: ["A parlor trick", "An essential modern skill", "An outdated technique", "A natural ability"], answer: 1 },
  ],
  technical_passage: [
    { q: "Where is the VWFA located?", options: ["Right temporal lobe", "Left fusiform gyrus", "Prefrontal cortex", "Broca's area"], answer: 1 },
    { q: "What does the lexical route do?", options: ["Converts letters to sounds", "Maps whole words directly to meaning", "Processes grammar rules", "Controls eye movements"], answer: 1 },
    { q: "What does cognitive load theory suggest about speed reading?", options: ["It increases cognitive load", "Automating word recognition frees resources for comprehension", "Working memory is unlimited", "Speed reading bypasses working memory"], answer: 1 },
  ]
};

// ─── State Management ───
const DEFAULT_STATE = {
  currentDay: 1,
  streak: 0,
  lastCompleted: null,
  completedDays: [],
  baselineWPM: null,
  currentWPM: null,
  xp: 0,
  startDate: null,
  dayResults: {} // { day: { wpm, comprehension, date } }
};

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem('speedread_training'));
    return s ? { ...DEFAULT_STATE, ...s } : { ...DEFAULT_STATE };
  } catch { return { ...DEFAULT_STATE }; }
}

function saveState(state) {
  localStorage.setItem('speedread_training', JSON.stringify(state));
}

let state = loadState();

// ─── UI Rendering ───
function getTypeBadge(type) {
  const colors = {
    'assessment': { bg: '#c9a84c33', text: '#c9a84c', label: '📊 Assessment' },
    'theory+drill': { bg: '#4a9c6d33', text: '#4a9c6d', label: '📖 Theory + Drill' },
    'drill': { bg: '#c94a4a33', text: '#c94a4a', label: '🏋️ Drill' },
    'theory': { bg: '#4a7cc933', text: '#4a7cc9', label: '📖 Theory' },
  };
  const c = colors[type] || colors['theory'];
  return `<span class="type-badge" style="background:${c.bg};color:${c.text}">${c.label}</span>`;
}

function getDayStatus(day) {
  if (state.completedDays.includes(day)) return 'complete';
  if (day === state.currentDay) return 'current';
  if (day < state.currentDay) return 'complete';
  return 'locked';
}

function renderProgress() {
  const pct = Math.round((state.completedDays.length / 28) * 100);
  const improvement = state.baselineWPM && state.currentWPM
    ? Math.round(((state.currentWPM - state.baselineWPM) / state.baselineWPM) * 100)
    : 0;

  document.getElementById('progress-header').innerHTML = `
    <div class="progress-top">
      <div class="progress-day">Day ${state.currentDay} of 28</div>
      <div class="progress-stats-inline">
        <span class="streak-badge">🔥 ${state.streak} day streak</span>
        <span class="xp-badge">⚡ ${state.xp} XP</span>
      </div>
    </div>
    <div class="progress-bar-container">
      <div class="progress-bar-fill" style="width:${pct}%"></div>
    </div>
    <div class="progress-pct">${pct}% complete</div>
  `;

  document.getElementById('stats-row').innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${state.baselineWPM || '—'}</div>
      <div class="stat-label">Starting WPM</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${state.currentWPM || '—'}</div>
      <div class="stat-label">Current WPM</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${improvement > 0 ? '+' + improvement + '%' : '—'}</div>
      <div class="stat-label">Improvement</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${state.completedDays.length}</div>
      <div class="stat-label">Sessions</div>
    </div>
  `;
}

function renderTodayCard() {
  const lesson = CURRICULUM[state.currentDay - 1];
  if (!lesson) return;
  const el = document.getElementById('today-card');
  el.innerHTML = `
    <div class="today-label">TODAY'S LESSON</div>
    <h2 class="today-title">Day ${lesson.day}: ${lesson.title}</h2>
    <div class="today-meta">
      ${getTypeBadge(lesson.type)}
      <span class="duration-badge">⏱ ${lesson.duration} min</span>
      ${lesson.tip ? `<div class="today-tip">💡 ${lesson.tip}</div>` : ''}
    </div>
    <p class="today-theory-preview">${lesson.theory.substring(0, 150)}…</p>
    <button class="btn btn-primary btn-start" onclick="startLesson(${lesson.day})">
      Start Lesson →
    </button>
  `;
}

function renderCurriculum() {
  const el = document.getElementById('curriculum-list');
  let html = '';
  let currentWeek = 0;
  const weekNames = ['', 'Week 1: Foundations', 'Week 2: Building Speed', 'Week 3: Comprehension Mastery', 'Week 4: Mastery'];

  for (const lesson of CURRICULUM) {
    if (lesson.week !== currentWeek) {
      currentWeek = lesson.week;
      html += `<div class="week-divider">${weekNames[currentWeek]}</div>`;
    }
    const status = getDayStatus(lesson.day);
    const icon = status === 'complete' ? '✅' : status === 'current' ? '📍' : '🔒';
    const cls = `curriculum-item ${status}`;
    const clickable = status !== 'locked';
    html += `
      <div class="${cls}" ${clickable ? `onclick="startLesson(${lesson.day})"` : ''}>
        <span class="ci-icon">${icon}</span>
        <div class="ci-info">
          <div class="ci-title">Day ${lesson.day}: ${lesson.title}</div>
          <div class="ci-meta">${lesson.duration} min · ${lesson.type}</div>
        </div>
      </div>
    `;
  }
  el.innerHTML = html;
}

function renderAll() {
  renderProgress();
  renderTodayCard();
  renderCurriculum();
}

// ─── Lesson Flow ───
function startLesson(day) {
  const lesson = CURRICULUM[day - 1];
  if (!lesson) return;
  const status = getDayStatus(day);
  if (status === 'locked') return;

  const overlay = document.getElementById('lesson-overlay');
  overlay.classList.add('active');
  showTheory(lesson);
}

function closeLesson() {
  document.getElementById('lesson-overlay').classList.remove('active');
}

function showTheory(lesson) {
  const content = document.getElementById('lesson-content');
  content.innerHTML = `
    <div class="lesson-phase theory-phase">
      <div class="lesson-header">
        <span class="lesson-day-label">Day ${lesson.day}</span>
        <button class="btn-close" onclick="closeLesson()">✕</button>
      </div>
      <h2 class="lesson-title">${lesson.title}</h2>
      ${getTypeBadge(lesson.type)}
      <div class="theory-text">${lesson.theory}</div>
      ${lesson.tip ? `<div class="theory-tip">💡 Pro tip: ${lesson.tip}</div>` : ''}
      ${lesson.drill || lesson.type === 'theory'
        ? `<button class="btn btn-primary" onclick='${lesson.drill ? `startDrill(${JSON.stringify(lesson.day)})` : `completeLesson(${lesson.day})`}'>
            ${lesson.drill ? "Got it → Start Drill" : "Complete Lesson ✓"}
           </button>`
        : `<button class="btn btn-primary" onclick="completeLesson(${lesson.day})">Complete Lesson ✓</button>`
      }
    </div>
  `;
  content.scrollTop = 0;
}

function startDrill(day) {
  const lesson = CURRICULUM[day - 1];
  const drill = lesson.drill;
  if (!drill) { completeLesson(day); return; }

  if (drill.type === 'wpm_test') showWPMTest(day);
  else if (drill.type === 'rsvp_drill') showRSVPDrill(day);
  else if (drill.type === 'comprehension_test') showComprehensionDrill(day);
  else if (drill.type === 'final_assessment') showFinalAssessment(day);
  else completeLesson(day);
}

// ─── WPM Test ───
let wpmTestStart = null;
let wpmInterval = null;

function showWPMTest(day) {
  const passage = PASSAGES.standard_passage;
  const wordCount = passage.split(/\s+/).length;
  showWPMInstructions(day, wordCount);
}

function showWPMInstructions(day, wordCount) {
  const content = document.getElementById('lesson-content');
  const isBaseline = day === 1 && !state.baselineWPM;
  content.innerHTML = `
    <div class="lesson-phase drill-phase">
      <div class="lesson-header">
        <span class="lesson-day-label">Day ${day} — Speed Test</span>
        <button class="btn-close" onclick="closeLesson()">✕</button>
      </div>
      <div style="max-width:520px;margin:40px auto;text-align:center">
        <div style="font-size:48px;margin-bottom:16px">📖</div>
        <h2 style="font-size:22px;font-weight:700;margin-bottom:12px">${isBaseline ? 'Let\'s measure your starting speed' : 'Time to measure your progress'}</h2>
        <p style="color:var(--text-muted);font-size:15px;line-height:1.7;margin-bottom:32px">
          ${isBaseline
            ? 'A short passage will appear when you click Start. Read it at your normal, comfortable pace — don\'t rush or slow down on purpose. Click <strong style="color:var(--text)">Done Reading</strong> the moment you finish the last word. The timer only runs while you\'re reading.'
            : 'The same passage from Day 1 will appear. Read at your natural pace and click Done when you finish. We\'ll compare this to your baseline.'}
        </p>
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:16px 20px;margin-bottom:32px;text-align:left">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:6px">What to expect</div>
          <div style="font-size:13px;color:var(--text);line-height:1.8">
            ✦ &nbsp;Passage appears only after you click Start<br>
            ✦ &nbsp;Timer starts the instant you click — begin reading immediately<br>
            ✦ &nbsp;Click Done as soon as you read the last word<br>
            ✦ &nbsp;Read naturally — this is a baseline, not a race
          </div>
        </div>
        <button class="btn btn-primary" style="font-size:16px;padding:14px 40px" onclick="showWPMReading(${day}, ${wordCount})">Start Reading →</button>
      </div>
    </div>
  `;
}

function showWPMReading(day, wordCount) {
  const passage = PASSAGES.standard_passage;
  const content = document.getElementById('lesson-content');
  wpmTestStart = Date.now();

  content.innerHTML = `
    <div class="lesson-phase drill-phase">
      <div class="lesson-header" style="justify-content:space-between">
        <span class="lesson-day-label">Day ${day} — Reading</span>
        <div style="display:flex;align-items:center;gap:14px">
          <div class="wpm-timer">⏱ <span id="wpm-seconds">0</span>s</div>
          <button class="btn btn-primary" onclick="finishWPMTimer(${day}, ${wordCount})">Done Reading ✓</button>
        </div>
      </div>
      <div class="wpm-passage" id="wpm-passage">${passage.replace(/\n\n/g, '</p><p>')}</div>
      <div style="text-align:center;padding:24px 0">
        <button class="btn btn-primary" style="font-size:15px;padding:12px 36px" onclick="finishWPMTimer(${day}, ${wordCount})">Done Reading ✓</button>
        <p style="color:var(--text-muted);font-size:12px;margin-top:10px">Click the moment you finish the last word</p>
      </div>
    </div>
  `;

  wpmInterval = setInterval(() => {
    const el = document.getElementById('wpm-seconds');
    if (el) el.textContent = Math.round((Date.now() - wpmTestStart) / 1000);
  }, 500);
}

function finishWPMTimer(day, wordCount) {
  clearInterval(wpmInterval);
  const elapsed = (Date.now() - wpmTestStart) / 60000;
  const wpm = Math.round(wordCount / elapsed);

  if (day === 1 && !state.baselineWPM) {
    state.baselineWPM = wpm;
    state.currentWPM = wpm;
  } else {
    state.currentWPM = wpm;
  }
  state.dayResults[day] = { wpm, date: new Date().toISOString() };
  saveState(state);
  showWPMResult(day, wpm, wordCount);
}

function showWPMResult(day, wpm, wordCount) {
  const content = document.getElementById('lesson-content');
  const improvement = state.baselineWPM && day > 1
    ? Math.round(((wpm - state.baselineWPM) / state.baselineWPM) * 100) : 0;
  let context = '';
  if (wpm < 150) context = 'below average — plenty of room to grow';
  else if (wpm < 238) context = 'around the adult average of 238 WPM';
  else if (wpm < 350) context = 'above average — a solid foundation to build on';
  else if (wpm < 500) context = 'college-level speed — faster than most readers';
  else context = 'speed reader territory — top 5%';

  content.innerHTML = `
    <div class="lesson-phase result-phase">
      <div class="lesson-header">
        <span class="lesson-day-label">Day ${day} — Your Result</span>
        <button class="btn-close" onclick="closeLesson()">✕</button>
      </div>
      <div class="wpm-result">
        <div class="wpm-big">${wpm}</div>
        <div class="wpm-label">words per minute</div>
        <div class="wpm-improvement" style="margin-top:8px;color:var(--text-muted);font-size:14px">${context}</div>
        ${improvement !== 0 ? `<div class="wpm-improvement ${improvement > 0 ? 'positive' : ''}" style="margin-top:8px;font-size:18px;font-weight:700">${improvement > 0 ? '+' : ''}${improvement}% from your baseline</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px;margin-top:8px">
        <button class="btn btn-primary" style="min-width:220px;font-size:15px;padding:13px 32px" onclick="completeLesson(${day})">
          ${day === 1 ? 'Lock in my baseline ✓' : 'Complete Day ' + day + ' ✓'}
        </button>
        <button class="btn" style="font-size:13px;color:var(--text-muted)" onclick="retakeWPMTest(${day}, ${wordCount})">
          ↩ Something looks off — retake the test
        </button>
      </div>
    </div>
  `;
}

function retakeWPMTest(day, wordCount) {
  // Clear any saved result for this day so baseline resets cleanly
  if (day === 1) {
    state.baselineWPM = null;
    state.currentWPM = null;
  }
  delete state.dayResults[day];
  saveState(state);
  showWPMInstructions(day, wordCount);
}

// ─── RSVP Drill ───
function showRSVPDrill(day) {
  const lesson = CURRICULUM[day - 1];
  const drill = lesson.drill;
  const baseWPM = state.baselineWPM || 250;
  const targetWPM = Math.round(baseWPM * (drill.wpm_multiplier || 1.2));
  const passageKey = drill.text || 'short_article';
  const passage = PASSAGES[passageKey] || PASSAGES.short_article;
  const words = passage.replace(/\n+/g, ' ').split(/\s+/).filter(Boolean);
  const msPerWord = Math.round(60000 / targetWPM);

  const content = document.getElementById('lesson-content');
  content.innerHTML = `
    <div class="lesson-phase drill-phase rsvp-phase">
      <div class="lesson-header">
        <span class="lesson-day-label">Day ${day} — RSVP Drill</span>
        <button class="btn-close" onclick="closeLesson()">✕</button>
      </div>
      <p class="drill-desc">${drill.description || ''}</p>
      <div class="rsvp-speed-label">Target: ${targetWPM} WPM</div>
      <div class="rsvp-display" id="rsvp-display">Ready</div>
      <div class="rsvp-progress-bar"><div class="rsvp-progress-fill" id="rsvp-progress"></div></div>
      <button class="btn btn-primary" id="rsvp-go" onclick="runRSVP(${day}, ${JSON.stringify(words).replace(/"/g, '&quot;')}, ${msPerWord})">Start RSVP</button>
    </div>
  `;
}

let rsvpTimer = null;
function runRSVP(day, words, msPerWord) {
  document.getElementById('rsvp-go').style.display = 'none';
  const display = document.getElementById('rsvp-display');
  const progress = document.getElementById('rsvp-progress');
  let i = 0;

  // Countdown
  display.textContent = '3';
  setTimeout(() => { display.textContent = '2'; }, 800);
  setTimeout(() => { display.textContent = '1'; }, 1600);
  setTimeout(() => {
    rsvpTimer = setInterval(() => {
      if (i >= words.length) {
        clearInterval(rsvpTimer);
        display.textContent = '✓ Done';
        progress.style.width = '100%';
        setTimeout(() => {
          const lesson = CURRICULUM[day - 1];
          if (lesson.drill && lesson.drill.type === 'comprehension_test') {
            showComprehensionQuiz(day);
          } else {
            showDrillComplete(day);
          }
        }, 1000);
        return;
      }
      display.textContent = words[i];
      progress.style.width = Math.round(((i + 1) / words.length) * 100) + '%';
      i++;
    }, msPerWord);
  }, 2400);
}

function showDrillComplete(day) {
  const content = document.getElementById('lesson-content');
  content.innerHTML = `
    <div class="lesson-phase result-phase">
      <div class="lesson-header">
        <span class="lesson-day-label">Day ${day} — Drill Complete</span>
        <button class="btn-close" onclick="closeLesson()">✕</button>
      </div>
      <div class="drill-complete-icon">🎯</div>
      <h2>Drill Complete!</h2>
      <p class="drill-complete-msg">Great work. Your brain is building new speed pathways.</p>
      <button class="btn btn-primary" onclick="completeLesson(${day})">Complete Day ${day} ✓</button>
    </div>
  `;
}

// ─── Comprehension Test ───
function showComprehensionDrill(day) {
  const lesson = CURRICULUM[day - 1];
  const drill = lesson.drill;
  const baseWPM = state.baselineWPM || 250;
  const targetWPM = Math.round(baseWPM * (drill.wpm_multiplier || 1.3));
  const passage = PASSAGES.standard_passage;
  const words = passage.replace(/\n+/g, ' ').split(/\s+/).filter(Boolean);
  const msPerWord = Math.round(60000 / targetWPM);

  const content = document.getElementById('lesson-content');
  content.innerHTML = `
    <div class="lesson-phase drill-phase rsvp-phase">
      <div class="lesson-header">
        <span class="lesson-day-label">Day ${day} — Speed + Comprehension</span>
        <button class="btn-close" onclick="closeLesson()">✕</button>
      </div>
      <p class="drill-desc">Read at ${targetWPM} WPM, then answer comprehension questions.</p>
      <div class="rsvp-speed-label">Target: ${targetWPM} WPM</div>
      <div class="rsvp-display" id="rsvp-display">Ready</div>
      <div class="rsvp-progress-bar"><div class="rsvp-progress-fill" id="rsvp-progress"></div></div>
      <button class="btn btn-primary" id="rsvp-go" onclick="runRSVPThenQuiz(${day}, ${JSON.stringify(words).replace(/"/g, '&quot;')}, ${msPerWord})">Start Reading</button>
    </div>
  `;
}

function runRSVPThenQuiz(day, words, msPerWord) {
  document.getElementById('rsvp-go').style.display = 'none';
  const display = document.getElementById('rsvp-display');
  const progress = document.getElementById('rsvp-progress');
  let i = 0;

  display.textContent = '3';
  setTimeout(() => { display.textContent = '2'; }, 800);
  setTimeout(() => { display.textContent = '1'; }, 1600);
  setTimeout(() => {
    rsvpTimer = setInterval(() => {
      if (i >= words.length) {
        clearInterval(rsvpTimer);
        display.textContent = '✓';
        progress.style.width = '100%';
        setTimeout(() => showComprehensionQuiz(day), 1000);
        return;
      }
      display.textContent = words[i];
      progress.style.width = Math.round(((i + 1) / words.length) * 100) + '%';
      i++;
    }, msPerWord);
  }, 2400);
}

function showComprehensionQuiz(day) {
  const questions = COMPREHENSION_QUESTIONS.standard_passage.slice(0, 3);
  const content = document.getElementById('lesson-content');
  content.innerHTML = `
    <div class="lesson-phase quiz-phase">
      <div class="lesson-header">
        <span class="lesson-day-label">Day ${day} — Comprehension Check</span>
        <button class="btn-close" onclick="closeLesson()">✕</button>
      </div>
      <h2>How much did you retain?</h2>
      <form id="quiz-form" onsubmit="return gradeQuiz(event, ${day})">
        ${questions.map((q, qi) => `
          <div class="quiz-question">
            <p class="quiz-q">${qi + 1}. ${q.q}</p>
            ${q.options.map((opt, oi) => `
              <label class="quiz-option">
                <input type="radio" name="q${qi}" value="${oi}" required>
                <span>${opt}</span>
              </label>
            `).join('')}
          </div>
        `).join('')}
        <button class="btn btn-primary" type="submit">Check Answers</button>
      </form>
    </div>
  `;
}

function gradeQuiz(e, day) {
  e.preventDefault();
  const questions = COMPREHENSION_QUESTIONS.standard_passage.slice(0, 3);
  let correct = 0;
  questions.forEach((q, qi) => {
    const selected = document.querySelector(`input[name="q${qi}"]:checked`);
    if (selected && parseInt(selected.value) === q.answer) correct++;
  });
  const pct = Math.round((correct / questions.length) * 100);
  state.dayResults[day] = { ...state.dayResults[day], comprehension: pct, date: new Date().toISOString() };
  saveState(state);

  const content = document.getElementById('lesson-content');
  content.innerHTML = `
    <div class="lesson-phase result-phase">
      <div class="lesson-header">
        <span class="lesson-day-label">Day ${day} — Results</span>
        <button class="btn-close" onclick="closeLesson()">✕</button>
      </div>
      <div class="quiz-result">
        <div class="quiz-score">${correct}/${questions.length}</div>
        <div class="quiz-pct">${pct}% comprehension</div>
        <p>${pct >= 75 ? '🎯 Excellent retention at speed!' : pct >= 50 ? '👍 Good — keep practicing to improve.' : '📖 Try slowing down slightly to boost retention.'}</p>
      </div>
      <button class="btn btn-primary" onclick="completeLesson(${day})">Complete Day ${day} ✓</button>
    </div>
  `;
  return false;
}

// ─── Final Assessment (Day 28) ───
function showFinalAssessment(day) {
  showWPMTest(day);
}

// ─── Lesson Completion ───
function completeLesson(day) {
  const lesson = CURRICULUM[day - 1];
  if (!state.completedDays.includes(day)) {
    state.completedDays.push(day);
    state.completedDays.sort((a, b) => a - b);
  }

  // XP
  let xpEarned = 10;
  if (lesson.type === 'drill') xpEarned = 25;
  else if (lesson.type === 'assessment') xpEarned = 50;
  else if (lesson.type === 'theory+drill') xpEarned = 25;

  // Streak
  const today = new Date().toISOString().split('T')[0];
  if (state.lastCompleted) {
    const last = new Date(state.lastCompleted);
    const now = new Date(today);
    const diff = Math.round((now - last) / 86400000);
    if (diff === 1) { state.streak++; xpEarned += 5; }
    else if (diff > 1) state.streak = 1;
  } else {
    state.streak = 1;
  }

  state.lastCompleted = today;
  state.xp += xpEarned;
  if (!state.startDate) state.startDate = today;

  // Advance day
  if (day === state.currentDay && state.currentDay < 28) {
    state.currentDay = day + 1;
  }

  saveState(state);

  // Show completion
  if (day === 28) {
    showCertificate();
    return;
  }

  const nextLesson = CURRICULUM[day]; // day is 1-indexed, so CURRICULUM[day] = next
  const content = document.getElementById('lesson-content');
  content.innerHTML = `
    <div class="lesson-phase complete-phase">
      <div class="lesson-header">
        <span class="lesson-day-label">Day ${day}</span>
        <button class="btn-close" onclick="closeLesson(); renderAll();">✕</button>
      </div>
      <div class="complete-icon">✅</div>
      <h2>Day ${day} Complete!</h2>
      <div class="xp-earned">+${xpEarned} XP earned</div>
      ${state.streak > 1 ? `<div class="streak-msg">🔥 ${state.streak} day streak!</div>` : ''}
      ${nextLesson ? `
        <div class="next-preview">
          <div class="next-label">NEXT UP</div>
          <div class="next-title">Day ${nextLesson.day}: ${nextLesson.title}</div>
          <div class="next-meta">${nextLesson.duration} min · ${nextLesson.type}</div>
        </div>
      ` : ''}
      <button class="btn btn-primary" onclick="closeLesson(); renderAll();">Continue</button>
    </div>
  `;
}

// ─── Certificate ───
function showCertificate() {
  const improvement = state.baselineWPM && state.currentWPM
    ? Math.round(((state.currentWPM - state.baselineWPM) / state.baselineWPM) * 100)
    : 0;

  const content = document.getElementById('lesson-content');
  content.innerHTML = `
    <div class="lesson-phase certificate-phase">
      <div class="lesson-header">
        <span class="lesson-day-label">🎓 Graduation</span>
        <button class="btn-close" onclick="closeLesson(); renderAll();">✕</button>
      </div>
      <div class="cert-wrapper">
        <canvas id="cert-canvas" width="800" height="500"></canvas>
      </div>
      <button class="btn btn-primary" onclick="downloadCertificate()">Download Certificate (PNG)</button>
      <button class="btn" onclick="closeLesson(); renderAll();" style="margin-top:8px">Close</button>
    </div>
  `;
  drawCertificate(improvement);
}

function drawCertificate(improvement) {
  const canvas = document.getElementById('cert-canvas');
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, 800, 500);

  // Gold border
  ctx.strokeStyle = '#c9a84c';
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, 760, 460);
  ctx.strokeRect(30, 30, 740, 440);

  // Title
  ctx.fillStyle = '#c9a84c';
  ctx.font = 'bold 36px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('⚡ SpeedRead Certified', 400, 90);

  // Divider
  ctx.strokeStyle = '#c9a84c44';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(150, 110); ctx.lineTo(650, 110); ctx.stroke();

  // Name
  ctx.fillStyle = '#f0e8d8';
  ctx.font = '28px Georgia, serif';
  ctx.fillText('Speed Reader', 400, 170);

  // Completion text
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = '#f0e8d888';
  ctx.fillText('has completed the 28-Day Speed Reading Course', 400, 210);

  // Stats
  ctx.font = 'bold 48px system-ui, sans-serif';
  ctx.fillStyle = '#f0e8d8';
  ctx.fillText(`${state.baselineWPM || '?'}`, 220, 300);
  ctx.fillText('→', 400, 300);
  ctx.fillStyle = '#c9a84c';
  ctx.fillText(`${state.currentWPM || '?'}`, 580, 300);

  ctx.font = '14px system-ui, sans-serif';
  ctx.fillStyle = '#f0e8d888';
  ctx.fillText('Starting WPM', 220, 325);
  ctx.fillText('Final WPM', 580, 325);

  // Improvement
  if (improvement > 0) {
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillStyle = '#4a9c6d';
    ctx.fillText(`+${improvement}% improvement`, 400, 380);
  }

  // Date
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillStyle = '#f0e8d866';
  ctx.fillText(`Completed ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 400, 440);
}

function downloadCertificate() {
  const canvas = document.getElementById('cert-canvas');
  const link = document.createElement('a');
  link.download = 'speedread-certificate.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// ─── Init ───
document.addEventListener('DOMContentLoaded', renderAll);
