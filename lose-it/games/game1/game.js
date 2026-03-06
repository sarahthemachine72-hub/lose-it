(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const livesEl = document.getElementById("lives");
  const timerEl = document.getElementById("timer");
  const restartBtn = document.getElementById("restartBtn");
  const hudExitBtn = document.getElementById("hudExitBtn");

  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlaySubtitle = document.getElementById("overlaySubtitle");
  const overlayMeterPanel = document.getElementById("overlayMeterPanel");
  const overlayMeter = document.getElementById("overlayMeter");
  const overlayStreakValue = document.getElementById("overlayStreakValue");
  const overlayMeterScore = document.getElementById("overlayMeterScore");
  const overlayMeterTier = document.getElementById("overlayMeterTier");
  const overlayMeterProgress = document.getElementById("overlayMeterProgress");
  const overlayFeatures = document.getElementById("overlayFeatures");
  const startBtn = document.getElementById("startBtn");
  const restoreBtn = document.getElementById("restoreBtn");
  const exitBtn = document.getElementById("exitBtn");
  const DEBUG_DISABLE_ASSIST = false;
  const params = new URLSearchParams(window.location.search);
  const receivedDifficulty = params.get("difficulty");
  const hasDifficulty = typeof receivedDifficulty === "string" && receivedDifficulty.trim() !== "";
  const difficulty = receivedDifficulty || "normal";

  const METRICS_STORAGE_KEY = "loseItMetricsV1";
  const MODE_STORAGE_KEY = "loseItModeV1";

  const requestedMode = params.get("mode");
  const storedMode = localStorage.getItem(MODE_STORAGE_KEY);
  const currentMode = requestedMode === "win" || requestedMode === "lose"
    ? requestedMode
    : (storedMode === "win" || storedMode === "lose" ? storedMode : "win");

  if (requestedMode !== currentMode) {
    localStorage.setItem(MODE_STORAGE_KEY, currentMode);
  }

  const failometerByDifficulty = {
    easy: { loss: 4, win: -8 },
    normal: { loss: 8, win: -6 },
    hard: { loss: 12, win: -4 },
    extreme: { loss: 16, win: -2 }
  };

  function readMetrics() {
    try {
      const raw = localStorage.getItem(METRICS_STORAGE_KEY);
      if (!raw) return { failometerScore: 0, lossStreak: 0 };

      const parsed = JSON.parse(raw);
      return {
        failometerScore: Number.isFinite(parsed.failometerScore) ? parsed.failometerScore : 0,
        lossStreak: Number.isFinite(parsed.lossStreak) ? parsed.lossStreak : 0
      };
    } catch (error) {
      return { failometerScore: 0, lossStreak: 0 };
    }
  }

  function getScoreDelta(outcome) {
    const weights = failometerByDifficulty[difficulty] || failometerByDifficulty.normal;
    return outcome === "loss" ? weights.loss : weights.win;
  }

  function reportGameOutcome(outcome) {
    const scoreDelta = getScoreDelta(outcome);
    const metrics = readMetrics();
    const previousScore = clamp(metrics.failometerScore, 0, 100);
    const previousStreak = Math.max(0, Math.floor(metrics.lossStreak));
    const nextScore = clamp(previousScore + scoreDelta, 0, 100);
    const nextStreak = outcome === "loss" ? previousStreak + 1 : 0;

    localStorage.setItem(
      METRICS_STORAGE_KEY,
      JSON.stringify({
        failometerScore: nextScore,
        lossStreak: nextStreak
      })
    );

    return {
      score: nextScore,
      streak: nextStreak,
      scoreDelta,
      outcome,
      previousScore,
      previousStreak
    };
  }

  function getMeterTierText(score) {
    const safeScore = clamp(score, 0, 100);

    if (safeScore < 20) return "not a loser";
    if (safeScore < 40) return "wannabe loser";
    if (safeScore < 60) return "loser in training";
    if (safeScore < 80) return "disappointing your parents";
    return "failure is your middle name";
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function animateNumber(from, to, duration, onUpdate, onDone) {
    const startTime = performance.now();

    function frame(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = easeOutCubic(progress);
      const value = Math.round(from + (to - from) * eased);
      onUpdate(value);

      if (progress < 1) {
        requestAnimationFrame(frame);
        return;
      }

      if (onDone) onDone();
    }

    requestAnimationFrame(frame);
  }

  const initialMetrics = readMetrics();
  let lastOverlayScore = Math.max(0, Math.min(100, Number(initialMetrics.failometerScore) || 0));
  let lastOverlayStreak = Math.max(0, Math.floor(Number(initialMetrics.lossStreak) || 0));
  let restoreState = null;
  let overlayStatsTimer = null;

  function restorePreviousMetrics() {
    if (!restoreState) return;

    localStorage.setItem(
      METRICS_STORAGE_KEY,
      JSON.stringify({
        failometerScore: restoreState.score,
        lossStreak: restoreState.streak
      })
    );

    const restoredStats = {
      score: restoreState.score,
      streak: restoreState.streak,
      previousScore: lastOverlayScore,
      previousStreak: lastOverlayStreak
    };

    restoreBtn.classList.add("is-hidden");
    restoreState = null;
    renderOverlayStats(restoredStats, { delayAnimation: false });
  }

  function renderOverlayStats(stats, options = {}) {
    const { delayAnimation = true } = options;

    if (overlayStatsTimer) {
      clearTimeout(overlayStatsTimer);
      overlayStatsTimer = null;
    }

    if (!stats) {
      overlayMeterPanel.classList.remove("is-visible");
      overlayMeterScore.textContent = "0";
      overlayMeterTier.textContent = getMeterTierText(0);
      overlayStreakValue.textContent = "0";
      overlayMeterProgress.style.strokeDashoffset = "100";
      return;
    }

    const targetScore = clamp(stats.score, 0, 100);
    const targetStreak = Math.max(0, Math.floor(stats.streak));
    const startScore = Number.isFinite(stats.previousScore) ? clamp(stats.previousScore, 0, 100) : lastOverlayScore;
    const startStreak = Number.isFinite(stats.previousStreak) ? Math.max(0, Math.floor(stats.previousStreak)) : lastOverlayStreak;

    overlayMeterPanel.classList.add("is-visible");
    overlayMeterScore.textContent = String(startScore);
    overlayMeterTier.textContent = getMeterTierText(startScore);
    overlayStreakValue.textContent = String(startStreak);
    overlayMeterProgress.style.strokeDashoffset = String(100 - clamp(startScore, 0, 100));

    const runAnimation = () => {
      animateNumber(startScore, targetScore, 650, (value) => {
        overlayMeterScore.textContent = String(value);
        overlayMeterTier.textContent = getMeterTierText(value);
        overlayMeterProgress.style.strokeDashoffset = String(100 - clamp(value, 0, 100));
      });

      animateNumber(startStreak, targetStreak, 650, (value) => {
        overlayStreakValue.textContent = String(value);
      }, () => {
        overlayStreakValue.textContent = String(targetStreak);
      });

      lastOverlayScore = targetScore;
      lastOverlayStreak = targetStreak;
    };

    if (!delayAnimation) {
      runAnimation();
      return;
    }

    overlayStatsTimer = setTimeout(() => {
      overlayStatsTimer = null;
      runAnimation();
    }, 200);
  }

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  function formatElapsed(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function nudgeBallHorizontal() {
    const minHorizontal = 1.35;
    if (Math.abs(ball.vx) < minHorizontal) {
      ball.vx = (Math.random() < 0.5 ? -1 : 1) * minHorizontal;
    }
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // --------------------
  // GAME STATE
  // --------------------

  let running = false;
  let pausedOnOverlay = true;

  const levelFeatureCards = {
    2: [
      { iconType: "gravityWell", text: "gravity can have odd effects..." },
      { iconType: "respawnBox", text: "bricks can resurrect too" }
    ],
    3: [
      { iconType: "redBrick", text: "beware the red bricks" },
      { iconType: "blackHole", text: "surely nothing good can come of this?" }
    ],
    4: [
      { icon: "🎯", text: "click/tap to release the ball" }
    ]
  };

  let levelBriefingPending = false;
  let awaitingLossChoice = false;
  let targetCenterX = 0; // where the cursor/finger wants the paddle center to be
  let powerToastText = "";
let powerToastStart = 0;
let powerToastDuration = 1200; // ms


  const state = {
    level: 1,
    lives: 5,
    resurrectionsLeft: 3,
    won: false,
    lost: false,
    elapsedMs: 0,
    startTimeMs: null,
    pausedDurationMs: 0,
    overlayShownAtMs: null
  };

  const resurrection = {
    active: false,
    phase: "idle",
    riseSpeed: 1.6,
    targetYFactor: 0.5
  };

  const paddle = {
    w: 120,
    h: 14,
    x: 0,
    y: 0,
    vx: 0,
    lastX: 0,

    baseWidth: 120,      // normal size


    assistActive: false
  };

  paddle.vx = 0;      // paddle horizontal speed (px per frame)
paddle.lastX = 0;   // last frame's x
paddle.assistWidth = paddle.w;     // smoothed width value
    paddle.assistSmooth = 0.12;        // smaller = smoother (0.06–0.18 good)
    paddle.assistOvershoot = 1.25;     // expand a bit more to keep contact visually believable
    paddle.assistPad = 14;             // extra px safety on each side
    paddle.assistLatched = false;     // stays true until hit/reset
paddle.assistTargetW = paddle.w;  // latched target width
paddle.assistTargetExt = 0;       // latched target extension amount
paddle.assistDirection = 0;       // -1 left, 1 right, 0 none
paddle.assistDisplayDirection = 0; // keeps extension visible while shrinking
paddle.bodyX = 0;
paddle.baseY = 0;          // normal slide line (set in layout)
paddle.jumpActive = false; // whether paddle is currently jumping
paddle.jumpClosePx = 60;   // how close above paddle to trigger jump
paddle.jumpMaxRise = 60;   // maximum jump height above the base line
paddle.jumpSmooth = 0.55;  // jump speed (0.35–0.7)
paddle.returnSmooth = 0.18; // return speed (0.1–0.25)

// Helper paddles (AI) that appear after losing 2 lives
const helpers = [];
const helperCfg = {
  count: 3,            // how many helper paddles
  widthFactor: 0.7,   // helper width relative to main paddle baseWidth
  minSpeed: 1.2,
  maxSpeed: 5.0,       // px per frame-ish
  followStrength: 0.12 // how strongly they steer toward target
};

function helperBaseY() {
  const helperHeight = Math.max(10, paddle.h - 2);
  return paddle.baseY + (paddle.h - helperHeight);
}

const missiles = [];

const missileCfg = {
  interval: 2000,   // milliseconds between bursts
  speed: 8,
  size: 10
};

let lastMissileShot = 0;

  const ball = {
    r: 8,
    baseR: 8,
    x: 0,
    y: 0,
    vx: 4,
    vy: -4,
    speedScale: 1,
    stuck: true
  };

  const bricks = {
    rows: 5,
    cols: 9,
    padding: 10,
    top: 60,
    side: 20,
    h: 20,
    grid: []
  };

  const gravityWells = [];
  const hazardHoles = [];
  const tntShards = [];
  const tntImpactBursts = [];

  function circleRectOverlap(cx, cy, radius, rx, ry, rw, rh) {
    const closestX = clamp(cx, rx, rx + rw);
    const closestY = clamp(cy, ry, ry + rh);
    const dx = cx - closestX;
    const dy = cy - closestY;
    return (dx * dx + dy * dy) <= radius * radius;
  }

  const wellTrap = {
    active: false,
    phase: "idle", // idle | attract | pause
    index: -1,
    pauseUntil: 0,
    gravityDisabledUntil: 0
  };

  const ballSizeLimits = {
    minScale: 0.25,
    maxScale: 5,
    stepScale: 0.25
  };


  // --------------------
// POWER UPS
// --------------------
const powerups = []; // falling items
const POWERUP_SIZE = 18;

const POWER_DURATION = 10000; // 10s
const RESPAWN_GLOW_HOLD_MS = 2200;
const RESPAWN_GLOW_FADE_MS = 700;

const PowerType = {
  MAX_PADDLE: "MAX_PADDLE",           // cap expansion at 4x
  SLOW_MOVE: "SLOW_MOVE",             // cap player paddle speed
  REDUCE_HELPERS: "REDUCE_HELPERS",   // reduce helper size by one step
  ENLARGE_HELPERS: "ENLARGE_HELPERS", // double helper size
  LESS_MISSILES: "LESS_MISSILES",
  MORE_MISSILES: "MORE_MISSILES", // shift missiles from x3 -> x5
  RESPAWN_BOXES: "RESPAWN_BOXES"
};

const PowerName = {
  [PowerType.MAX_PADDLE]: "MAX PADDLE (4x cap)",
  [PowerType.SLOW_MOVE]: "SLOW MOVE",
  [PowerType.REDUCE_HELPERS]: "REDUCE HELPERS",
  [PowerType.ENLARGE_HELPERS]: "ENLARGE HELPERS",
  [PowerType.LESS_MISSILES]: "LESS MISSILES",
  [PowerType.MORE_MISSILES]: "MORE MISSILES",
  [PowerType.RESPAWN_BOXES]: "RESPAWN BOXES"
};

const activePower = {
  [PowerType.MAX_PADDLE]: 0,
  [PowerType.SLOW_MOVE]: 0,
  [PowerType.REDUCE_HELPERS]: 0,
  [PowerType.ENLARGE_HELPERS]: 0,
  [PowerType.LESS_MISSILES]: 0,
  [PowerType.MORE_MISSILES]: 0
};

// Defaults (we’ll set baseWidth later in layout())
paddle.maxWidth = 0;           // used by assist clamp
paddle.playerMaxStep = Infinity; // px/frame movement cap (slow move uses this)

function getPowerDuration(type) {

  if (type === PowerType.MAX_PADDLE) return 3000;
  if (type === PowerType.SLOW_MOVE) return 4000;

  return 10000;

}

function pickPowerType(helpersActive, missilesActive) {

  const pool = [
    PowerType.MAX_PADDLE,
    PowerType.SLOW_MOVE
  ];

  if (helpersActive) {
    pool.push(PowerType.REDUCE_HELPERS);
    pool.push(PowerType.ENLARGE_HELPERS);
  }

  if (missilesActive) {
    pool.push(PowerType.LESS_MISSILES);
    pool.push(PowerType.MORE_MISSILES);
  }

  if (state.level >= 2) {
    pool.push(PowerType.RESPAWN_BOXES);

    if (remainingBricks() < 5) {
      // Weight respawn powerups more heavily in late-round cleanup.
      pool.push(PowerType.RESPAWN_BOXES);
    }
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

  function createBricks(level = state.level) {
  bricks.grid = [];
  gravityWells.length = 0;
  hazardHoles.length = 0;

  const tntPositions = new Set();

  for (let r = 0; r < bricks.rows; r++) {
    for (let c = 0; c < bricks.cols; c++) {
      const level1Alive = true;
      const level2Alive =
        (r === 0 && (c === 2 || c === 3 || c === 5 || c === 6)) ||
        (r === 1 && c >= 1 && c <= 7) ||
        (r === 2 && c >= 1 && c <= 7) ||
        (r === 3 && c >= 2 && c <= 6) ||
        (r === 4 && c === 4);

      const level3Alive =
        (r === 0 && (c === 1 || c === 2 || c === 4 || c === 6 || c === 7)) ||
        (r === 1 && (c === 0 || c === 2 || c === 3 || c === 5 || c === 6 || c === 8)) ||
        (r === 2 && c >= 1 && c <= 7) ||
        (r === 3 && (c === 0 || c === 2 || c === 4 || c === 6 || c === 8)) ||
        (r === 4 && (c === 1 || c === 4 || c === 7));

      const level4Alive = r === 2 && c === 4;

      const alive =
        level === 1 ? level1Alive :
        level === 2 ? level2Alive :
        level === 3 ? level3Alive :
        level4Alive;

      const key = `${r}-${c}`;

      if (level === 3 && (key === "0-1" || key === "1-8" || key === "3-0" || key === "4-7")) {
        tntPositions.add(key);
      }

      bricks.grid.push({
        r,
        c,
        alive,
        hasPower: false,
        isTnt: level === 3 && tntPositions.has(key)
      });

    }
  }

  if (level === 2) {
    gravityWells.push(
      { r: 4, c: 3, radius: 45, pulseMode: "outward", sizeEffect: 1 },
      { r: 4, c: 5, radius: 45, pulseMode: "inward", sizeEffect: -1 }
    );
  }

  if (level === 3) {
    gravityWells.push(
      { r: 2, c: 2, radius: 45, pulseMode: "outward", sizeEffect: 1 },
      { r: 2, c: 6, radius: 45, pulseMode: "inward", sizeEffect: -1 }
    );
    hazardHoles.push({ r: 4, c: 4, radius: 30, style: "skull" });
  }

  if (level === 4) {
    hazardHoles.push({ r: 0, c: 4, radius: 24, style: "skull" });
  }

  const powerBrickCount = 8;

if (level === 4) return;

for (let i = 0; i < powerBrickCount; i++) {

  let index;

  // pick a brick that doesn't already have power
  do {
    index = Math.floor(Math.random() * bricks.grid.length);
  } while (!bricks.grid[index].alive || bricks.grid[index].hasPower || bricks.grid[index].isTnt);

  bricks.grid[index].hasPower = true;

}
}

  function clearBricksOverlappingHazards() {
    if (![2, 3, 4].includes(state.level)) return;
    if (gravityWells.length === 0 && hazardHoles.length === 0) return;

    const bw = brickWidth();

    for (const b of bricks.grid) {
      if (!b.alive) continue;

      const x = bricks.side + b.c * (bw + bricks.padding);
      const y = bricks.top + b.r * (bricks.h + bricks.padding);

      const overlapsWell = gravityWells.some((well) => {
        const pos = wellPosition(well, bw);
        return circleRectOverlap(pos.x, pos.y, well.radius, x, y, bw, bricks.h);
      });

      const overlapsHole = hazardHoles.some((hole) => {
        const pos = wellPosition(hole, bw);
        return circleRectOverlap(pos.x, pos.y, hole.radius, x, y, bw, bricks.h);
      });

      if (overlapsWell || overlapsHole) {
        if (state.level === 4 && b.r === 2 && b.c === 4) continue;
        b.alive = false;
        b.hasPower = false;
        b.isTnt = false;
      }
    }
  }

  function layout() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    paddle.w = clamp(w * 0.22, 90, 160);
    paddle.h = 14;
    paddle.baseY = h - 30;
paddle.y = paddle.baseY;
    paddle.x = (w - paddle.w) / 2;
    paddle.bodyX = paddle.x;
    paddle.lastX = paddle.x;
    paddle.baseWidth = paddle.w;
    paddle.maxWidth = paddle.w * 8; // paddle growth with assist
    paddle.assistWidth = paddle.w;     // smoothed width value

    targetCenterX = paddle.x + paddle.w / 2;
    if (state.lives <= 3) setUpHelpers();


    ball.baseR = clamp(w * 0.015, 6, 10);
    ball.r = ball.baseR;
    resetBall();

    bricks.side = clamp(w * 0.04, 12, 28);
    bricks.padding = clamp(w * 0.015, 8, 14);
    bricks.top = clamp(h * 0.12, 50, 90);

    clearBricksOverlappingHazards();
  }

  function resetBall() {
    ball.stuck = true;
    ball.speedScale = 1;
    ball.r = ball.baseR;
    ball.x = paddle.bodyX + paddle.baseWidth / 2;
    ball.y = paddle.y - ball.r - 2;

    const dir = Math.random() < 0.5 ? -1 : 1;
    ball.vx = 4 * dir;
    ball.vy = -4;
    paddle.jumpActive = false;
    paddle.y = paddle.baseY;
    wellTrap.active = false;
    wellTrap.phase = "idle";
    wellTrap.index = -1;
    wellTrap.gravityDisabledUntil = 0;
  }

  function applyWellBallSizeEffect(sizeEffectDirection) {
    const currentScale = ball.r / ball.baseR;
    const nextScale = clamp(
      currentScale + sizeEffectDirection * ballSizeLimits.stepScale,
      ballSizeLimits.minScale,
      ballSizeLimits.maxScale
    );
    ball.r = ball.baseR * nextScale;
  }

  function openDifficultyLevelChoiceOverlay() {
    running = false;
    pausedOnOverlay = true;
    const stats = reportGameOutcome("loss");

    if (difficulty === "extreme") {
      awaitingLossChoice = false;
      state.lost = true;
      showOverlay("Game Over", `You survived ${formatElapsed(state.elapsedMs)}. Press R or Restart.`, {
        showStart: false,
        showExit: true,
        exitLabel: "Exit",
        stats
      });
      return;
    }

    awaitingLossChoice = true;
    showOverlay("Game Over", `You survived ${formatElapsed(state.elapsedMs)}.`, {
      buttonLabel: "Proceed to Next Level",
      showExit: true,
      exitLabel: "Exit",
      stats
    });
  }

  function goToNextLevelAfterLoss() {
    if (state.level === 1) {
      beginLevel2();
      return;
    }

    if (state.level === 2) {
      beginLevel3();
      return;
    }

    if (state.level === 3) {
      beginLevel4();
      return;
    }

    state.lost = true;
    running = false;
    const stats = reportGameOutcome("loss");
    showOverlay("Game Over", `You survived ${formatElapsed(state.elapsedMs)}. Press R or Restart.`, { stats });
  }

  function beginLevel2(fromTesting = false) {
    awaitingLossChoice = false;
    state.level = 2;
    state.lives = 5;
    state.resurrectionsLeft = 3;
    livesEl.textContent = String(state.lives);

    if (fromTesting) {
      state.elapsedMs = 0;
      state.startTimeMs = null;
      state.pausedDurationMs = 0;
      state.overlayShownAtMs = null;
      timerEl.textContent = "00:00";
      state.won = false;
      state.lost = false;
    }

    createBricks(2);
    clearTransientEffects();
    layout();
    resetBall();

    running = false;
    pausedOnOverlay = true;
    const subtitle = fromTesting
      ? "Testing mode: skipped to level 2. Tap / Click to start."
      : "You only reach this level by losing level 1. Tap / Click to start.";
    levelBriefingPending = true;
    showOverlay("Level 2 Unlocked", subtitle);
  }


  function beginLevel3(fromTesting = false) {
    awaitingLossChoice = false;
    state.level = 3;
    state.lives = 5;
    state.resurrectionsLeft = 3;
    livesEl.textContent = String(state.lives);

    if (fromTesting) {
      state.elapsedMs = 0;
      state.startTimeMs = null;
      state.pausedDurationMs = 0;
      state.overlayShownAtMs = null;
      timerEl.textContent = "00:00";
      state.won = false;
      state.lost = false;
    }

    createBricks(3);
    clearTransientEffects();
    layout();
    resetBall();

    running = false;
    pausedOnOverlay = true;
    const subtitle = fromTesting
      ? "Testing mode: skipped to level 3. Tap / Click to start."
      : "You only reach this level by losing level 2. Tap / Click to start.";
    levelBriefingPending = true;
    showOverlay("Level 3 Unlocked", subtitle);
  }

  function beginLevel4(fromTesting = false) {
    awaitingLossChoice = false;
    state.level = 4;
    state.lives = 5;
    state.resurrectionsLeft = 3;
    livesEl.textContent = String(state.lives);

    if (fromTesting) {
      state.elapsedMs = 0;
      state.startTimeMs = null;
      state.pausedDurationMs = 0;
      state.overlayShownAtMs = null;
      timerEl.textContent = "00:00";
      state.won = false;
      state.lost = false;
    }

    createBricks(4);
    clearTransientEffects();
    layout();
    resetBall();

    running = false;
    pausedOnOverlay = true;
    const subtitle = fromTesting
      ? "Testing mode: skipped to level 4. Tap / Click to start."
      : "You only reach this level by losing level 3. Tap / Click to start.";
    levelBriefingPending = true;
    showOverlay("Level 4 Unlocked", subtitle);
  }

  function renderOverlayFeatures(items = []) {
    overlayFeatures.innerHTML = "";
    if (!items.length) {
      overlayFeatures.classList.remove("is-visible");
      return;
    }

    overlayFeatures.classList.add("is-visible");

    for (const item of items) {
      const row = document.createElement("div");
      row.className = "featureItem";

      const icon = document.createElement("div");
      icon.className = "featureIcon";

      if (item.iconType) {
        icon.classList.add(`featureIcon--${item.iconType}`);
      } else {
        icon.textContent = item.icon || "";
      }

      const text = document.createElement("div");
      text.className = "featureText";
      text.textContent = item.text;

      row.append(icon, text);
      overlayFeatures.append(row);
    }
  }

  function showOverlay(title, subtitle, options = {}) {
    const now = performance.now();
    const wasHidden = overlay.classList.contains("is-hidden");

    overlayTitle.textContent = title;
    overlaySubtitle.textContent = subtitle;
    startBtn.textContent = options.buttonLabel || "Start";
    startBtn.classList.toggle("is-hidden", options.showStart === false);
    exitBtn.textContent = options.exitLabel || "Exit";
    exitBtn.classList.toggle("is-hidden", !options.showExit);
    restoreBtn.classList.toggle("is-hidden", !options.showRestore);

    if (options.restoreStats) {
      restoreState = {
        score: options.restoreStats.score,
        streak: options.restoreStats.streak
      };
    } else {
      restoreState = null;
    }

    renderOverlayStats(options.stats || null, { delayAnimation: options.delayStatsAnimation !== false });
    renderOverlayFeatures(options.features || []);
    overlay.classList.remove("is-hidden");

    if (wasHidden && state.startTimeMs !== null && state.overlayShownAtMs === null) {
      state.overlayShownAtMs = now;
    }
  }

  function hideOverlay() {
    if (overlayStatsTimer) {
      clearTimeout(overlayStatsTimer);
      overlayStatsTimer = null;
    }
    if (state.startTimeMs !== null && state.overlayShownAtMs !== null) {
      state.pausedDurationMs += Math.max(0, performance.now() - state.overlayShownAtMs);
      state.overlayShownAtMs = null;
    }

    overlay.classList.add("is-hidden");
  }

  function handleGameStart() {
    if (state.won || state.lost || awaitingLossChoice) return;

    if (levelBriefingPending && [2, 3, 4].includes(state.level)) {
      levelBriefingPending = false;
      showOverlay("Incoming", "", {
        features: levelFeatureCards[state.level] || [],
        buttonLabel: state.level === 4 ? "Ready" : "Start"
      });
      return;
    }

    pausedOnOverlay = false;
    running = true;
    if (state.startTimeMs === null) {
      const now = performance.now();
      state.startTimeMs = now - state.elapsedMs;
      state.pausedDurationMs = 0;
      state.overlayShownAtMs = now;
    }
    hideOverlay();

    if (state.level === 4) {
      ball.stuck = true;
      return;
    }

    ball.stuck = false;
  }

  function setStartingLevel(level, modeLabel) {
    state.level = level;
    state.lives = 5;
    state.resurrectionsLeft = 3;
    state.elapsedMs = 0;
    state.startTimeMs = null;
    state.pausedDurationMs = 0;
    state.overlayShownAtMs = null;
    state.won = false;
    state.lost = false;

    livesEl.textContent = "5";
    timerEl.textContent = "00:00";

    createBricks(level);
    clearTransientEffects();
    layout();
    resetBall();

    running = false;
    pausedOnOverlay = true;
    levelBriefingPending = [2, 3, 4].includes(level);
    awaitingLossChoice = false;

    showOverlay("Tap / Click to Start", `${modeLabel} mode · Level ${level}`);
  }

  function startGame(difficultySetting) {
    console.log("Game launched with difficulty:", difficultySetting);

    if (difficultySetting === "easy") {
      console.log("Launching easy mode");
      setStartingLevel(1, "Easy");
    } else if (difficultySetting === "normal") {
      if (hasDifficulty) {
        console.log("Launching normal mode");
        setStartingLevel(2, "Normal");
      } else {
        console.log("Launching normal mode");
        setStartingLevel(1, "Normal");
      }
    } else if (difficultySetting === "hard") {
      console.log("Launching hard mode");
      setStartingLevel(3, "Hard");
    } else if (difficultySetting === "extreme") {
      console.log("Launching extreme mode");
      setStartingLevel(4, "Extreme");
    } else {
      console.log("Launching normal mode");
      setStartingLevel(1, "Normal");
    }
  }

  function resetGame() {
    state.level = 1;
    state.lives = 5;
    state.resurrectionsLeft = 3;
    state.elapsedMs = 0;
    state.startTimeMs = null;
    state.pausedDurationMs = 0;
    state.overlayShownAtMs = null;
    state.won = false;
    state.lost = false;
    resurrection.active = false;
    resurrection.phase = "idle";

    livesEl.textContent = "5";
    timerEl.textContent = "00:00";

    createBricks(1);
    layout();
    resetBall();

    paddle.assistLatched = false;
paddle.assistTargetW = paddle.baseWidth;
paddle.assistTargetExt = 0;
paddle.assistDirection = 0;
paddle.assistDisplayDirection = 0;

paddle.assistWidth = paddle.baseWidth;
paddle.w = paddle.baseWidth;
paddle.bodyX = paddle.x;
helpers.length = 0;
missiles.length = 0;
lastMissileShot = 0;
powerups.length = 0;
tntShards.length = 0;
tntImpactBursts.length = 0;
clearAllPowers();

// (optional) reset y jump state if you added jump assist
paddle.jumpActive = false;
paddle.y = paddle.baseY ?? paddle.y;

    running = false;
    pausedOnOverlay = true;
    levelBriefingPending = false;
    awaitingLossChoice = false;
    showOverlay("Tap / Click to Start", "Destroy all boxes to win.");
  }

  function restartCurrentLevel() {
    state.elapsedMs = 0;
    state.startTimeMs = null;
    state.pausedDurationMs = 0;
    state.overlayShownAtMs = null;
    state.won = false;
    state.lost = false;
    state.resurrectionsLeft = 3;
    state.lives = 5;
    livesEl.textContent = "5";
    timerEl.textContent = "00:00";

    createBricks(state.level);
    clearTransientEffects();
    layout();
    resetBall();

    clearAllPowers();
    paddle.playerMaxStep = Infinity;
    missiles.length = 0;
    lastMissileShot = 0;
    awaitingLossChoice = false;
    levelBriefingPending = false;

    pausedOnOverlay = false;
    running = true;

    const now = performance.now();
    state.startTimeMs = now;
    state.pausedDurationMs = 0;
    state.overlayShownAtMs = now;

    hideOverlay();

    if (state.level === 4) {
      ball.stuck = true;
      return;
    }

    ball.stuck = false;
  }

  function triggerInstantLoss() {
    if (!running || pausedOnOverlay || state.won || state.lost || awaitingLossChoice) return;

    state.lives = 0;
    livesEl.textContent = "0";
    clearAllPowers();
    paddle.playerMaxStep = Infinity;
    paddle.assistLatched = false;
    paddle.assistTargetW = paddle.baseWidth;
    paddle.assistTargetExt = 0;
    paddle.assistDirection = 0;
    paddle.assistDisplayDirection = 0;
    missiles.length = 0;
    lastMissileShot = 0;

    if (hasDifficulty) {
      openDifficultyLevelChoiceOverlay();
      return;
    }

    goToNextLevelAfterLoss();
  }

  // --------------------
  // INPUT
  // --------------------

function movePaddle(clientX) {
  const rect = canvas.getBoundingClientRect();
  targetCenterX = clientX - rect.left;

  // keep the ball stuck to paddle if ball is stuck
  if (ball.stuck) {
    paddle.bodyX = clamp(targetCenterX - paddle.baseWidth / 2, 0, rect.width - paddle.baseWidth);
    paddle.x = paddle.bodyX;
    paddle.w = paddle.baseWidth;
    ball.x = paddle.bodyX + paddle.baseWidth / 2;
    ball.y = paddle.y - ball.r - 2;
  }
}

  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture?.(e.pointerId);
    movePaddle(e.clientX);
    if (pausedOnOverlay) {
      handleGameStart();
      return;
    }

    if (state.level === 4 && ball.stuck && running) {
      ball.stuck = false;
    }
  });

  canvas.addEventListener("pointermove", (e) => {
    movePaddle(e.clientX);
  });

  window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "r") resetGame();
    if (e.key.toLowerCase() === "l") triggerInstantLoss();
    if (e.key === "2") beginLevel2(true);
    if (e.key === "3") beginLevel3(true);
    if (e.key === "4") beginLevel4(true);
  });

  restoreBtn.addEventListener("click", () => {
    restorePreviousMetrics();
  });

  startBtn.addEventListener("click", () => {
    if (awaitingLossChoice) {
      awaitingLossChoice = false;
      state.elapsedMs = 0;
      state.startTimeMs = null;
      state.pausedDurationMs = 0;
      state.overlayShownAtMs = null;
      timerEl.textContent = "00:00";
      goToNextLevelAfterLoss();
      return;
    }

    if (state.won) {
      restartCurrentLevel();
      return;
    }

    if (state.lost) {
      resetGame();
      return;
    }

    else handleGameStart();
  });

  exitBtn.addEventListener("click", () => {
    if (!awaitingLossChoice && !state.won) return;

    window.location.href = `../../index.html?screen=difficulty&game=Game%201&path=games/game1/index.html&mode=${encodeURIComponent(currentMode)}`;
  });

  restartBtn.addEventListener("click", () => {
    resetGame();
  });

  hudExitBtn.addEventListener("click", () => {
    window.location.href = `../../index.html?screen=difficulty&game=Game%201&path=games/game1/index.html&mode=${encodeURIComponent(currentMode)}`;
  });

    // --------------------
  // COLLISIONS
  // --------------------

  function rectHit(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw &&
           ax + aw > bx &&
           ay < by + bh &&
           ay + ah > by;
  }

  function brickWidth() {
    const w = canvas.clientWidth;
    const totalPadding = bricks.padding * (bricks.cols - 1);
    const available = w - bricks.side * 2 - totalPadding;
    return available / bricks.cols;
  }

  function checkBrickCollisions(now) {
    const bw = brickWidth();

    for (const b of bricks.grid) {
      if (!b.alive) continue;

      const x = bricks.side + b.c * (bw + bricks.padding);
      const y = bricks.top + b.r * (bricks.h + bricks.padding);

      const bx = ball.x - ball.r;
      const by = ball.y - ball.r;
      const bs = ball.r * 2;

      if (rectHit(bx, by, bs, bs, x, y, bw, bricks.h)) {
        ball.vy *= -1;
        destroyBrickAndMaybeDrop(b, x, y, bw, now);

        ball.speedScale = Math.min(1.6, ball.speedScale + 0.02);
        break;
      }
    }
  }

  function wellPosition(well, bw) {
    return {
      x: bricks.side + well.c * (bw + bricks.padding) + bw / 2,
      y: bricks.top + well.r * (bricks.h + bricks.padding) + bricks.h / 2
    };
  }


  function ballEnteredHazardHole() {
    if (hazardHoles.length === 0 || ball.stuck) return false;

    const bw = brickWidth();

    for (const hole of hazardHoles) {
      const pos = wellPosition(hole, bw);
      const dist = Math.hypot(pos.x - ball.x, pos.y - ball.y);
      if (dist <= hole.radius) return true;
    }

    return false;
  }

  function updateGravityWellTrap(now) {
    if (![2, 3].includes(state.level) || ball.stuck) return false;
    if (now < wellTrap.gravityDisabledUntil) return false;

    const bw = brickWidth();

    if (!wellTrap.active) {
      for (let i = 0; i < gravityWells.length; i++) {
        const well = gravityWells[i];
        const pos = wellPosition(well, bw);
        const dx = pos.x - ball.x;
        const dy = pos.y - ball.y;
        const dist = Math.hypot(dx, dy);

        if (dist <= well.radius + ball.r) {
          applyWellBallSizeEffect(well.sizeEffect || 0);
          wellTrap.active = true;
          wellTrap.phase = "attract";
          wellTrap.index = i;
          break;
        }
      }
    }

    if (!wellTrap.active || wellTrap.index < 0) return false;

    const well = gravityWells[wellTrap.index];
    const pos = wellPosition(well, bw);

    if (wellTrap.phase === "attract") {
      ball.x += (pos.x - ball.x) * 0.22;
      ball.y += (pos.y - ball.y) * 0.22;
      ball.vx *= 0.9;
      ball.vy *= 0.9;

      if (Math.hypot(pos.x - ball.x, pos.y - ball.y) < 1.8) {
        ball.x = pos.x;
        ball.y = pos.y;
        wellTrap.phase = "pause";
        wellTrap.pauseUntil = now + 260;
      }
      return true;
    }

    if (wellTrap.phase === "pause") {
      ball.x = pos.x;
      ball.y = pos.y;

      if (now >= wellTrap.pauseUntil) {
        const angle = Math.random() * Math.PI * 2;
        const boostedSpeed = 5.6;
        ball.vx = Math.cos(angle) * boostedSpeed;
        ball.vy = Math.sin(angle) * boostedSpeed;
        ball.speedScale = Math.min(2.1, ball.speedScale + 0.18);
        wellTrap.active = false;
        wellTrap.phase = "idle";
        wellTrap.index = -1;
        wellTrap.gravityDisabledUntil = now + 700;
      }
      return true;
    }

    return false;
  }

  function applyGravityWellsToMissile(missile, bw) {
    if (![2, 3].includes(state.level) || gravityWells.length === 0) return;

    let pullX = 0;
    let pullY = 0;

    for (const well of gravityWells) {
      const pos = wellPosition(well, bw);
      const dx = pos.x - missile.x;
      const dy = pos.y - missile.y;
      const dist = Math.hypot(dx, dy);
      const influenceRadius = well.radius * 2;

      if (!dist || dist > influenceRadius) continue;

      const strength = (1 - dist / influenceRadius) * 1.2;
      pullX += (dx / dist) * strength;
      pullY += (dy / dist) * strength;
    }

    if (pullX || pullY) {
      missile.vx += pullX;
      missile.vy += pullY;

      const speed = Math.hypot(missile.vx, missile.vy);
      const maxSpeed = missileCfg.speed * 1.9;
      if (speed > maxSpeed) {
        missile.vx = (missile.vx / speed) * maxSpeed;
        missile.vy = (missile.vy / speed) * maxSpeed;
      }
    }
  }

  function remainingBricks() {
    return bricks.grid.filter(b => b.alive).length;
  }

  // --------------------
  // UPDATE
  // --------------------

  function requiredAssistWidth() {
    // Only assist when ball is moving downward
    if (ball.vy <= 0) return null;

    const effectiveVy = ball.vy * ball.speedScale;
    const minAssistVy = 0.85;
    // Near-horizontal downward shots make the long-range prediction unstable,
    // which can over-expand the paddle for a very long time.
    if (effectiveVy < minAssistVy) return null;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    // Only assist in the bottom third of the play area
    if (ball.y < h * (2 / 3)) return null;

    // Only assist if ball is above the paddle (approaching)
    const distanceY = paddle.y - ball.y;
    if (distanceY <= 0) return null;

    // Predict time (in frames-ish) until ball reaches paddle height
    const frames = distanceY / effectiveVy;
    if (!Number.isFinite(frames) || frames <= 0) return null;

    const maxAssistPredictionFrames = 95;
    // Ignore very long-horizon predictions: too many wall bounces and other
    // interactions can happen before impact, so this estimate is no longer
    // trustworthy.
    if (frames > maxAssistPredictionFrames) return null;

    // Predict X at paddle height, including side-wall reflections.
    const rawPredictedX = ball.x + ball.vx * ball.speedScale * frames;
    const minX = ball.r;
    const maxX = w - ball.r;
    const span = maxX - minX;

    let predictedX = rawPredictedX;
    if (span > 0) {
      const travel = rawPredictedX - minX;
      const period = span * 2;
      const wrapped = ((travel % period) + period) % period;
      predictedX = wrapped <= span
        ? minX + wrapped
        : maxX - (wrapped - span);
    }

    const center = paddle.bodyX + paddle.baseWidth / 2;
    const baseLeft = paddle.bodyX;
    const baseRight = paddle.bodyX + paddle.baseWidth;
    const ballLeft = predictedX - ball.r - paddle.assistPad;
    const ballRight = predictedX + ball.r + paddle.assistPad;

    // If the base paddle already covers the predicted contact point, no assist needed.
    if (ballLeft >= baseLeft && ballRight <= baseRight) return null;

    let direction = 0;
    let neededExtension = 0;

    if (predictedX >= center) {
      direction = 1;
      neededExtension = Math.max(0, ballRight - baseRight);
    } else {
      direction = -1;
      neededExtension = Math.max(0, baseLeft - ballLeft);
    }

    neededExtension *= paddle.assistOvershoot;

    const maxExtension = Math.max(0, paddle.maxWidth - paddle.baseWidth);
    neededExtension = clamp(neededExtension, 0, maxExtension);

    return {
      direction,
      extension: neededExtension,
      width: paddle.baseWidth + neededExtension
    };
  }

function setUpHelpers() {
    helpers.length = 0;

    const w = canvas.clientWidth;

    for (let i = 0; i < helperCfg.count; i++) {
      const hw = Math.max(40, paddle.baseWidth * helperCfg.widthFactor);
      const hx = (w - hw) * (i + 1) / (helperCfg.count + 1);

      helpers.push({
        baseW: hw,
        w: hw,
        h: Math.max(10, paddle.h - 2),
        x: clamp(hx, 0, w - hw),
        y: helperBaseY(),
        vx: (Math.random() < 0.5 ? -1 : 1) *
    (helperCfg.minSpeed + Math.random() * (helperCfg.maxSpeed - helperCfg.minSpeed))
      });
    }
  }

  function bounceOffPaddleLike(px, py, pw, ph, paddleVx = 0) {
    // Same collision shape you already use
    const hit =
      ball.y + ball.r >= py &&
      ball.y + ball.r <= py + ph + 2 &&
      ball.x >= px &&
      ball.x <= px + pw &&
      ball.vy > 0;

    if (!hit) return false;

    // reflect upward
    ball.vy = -Math.abs(ball.vy);

    // angle / english based on where it hits this paddle
    const center = px + pw / 2;
    const rel = (ball.x - center) / (pw / 2); // -1..1

    const hitInfluence = 2.8;
    const paddleInfluence = 0.35;

    ball.vx += rel * hitInfluence + paddleVx * paddleInfluence;

    const maxVx = 9;
    ball.vx = clamp(ball.vx, -maxVx, maxVx);

    ball.y = py - ball.r - 0.5;

    return true;
  }

  function fireMissiles(now) {

    const cx = paddle.x + paddle.w / 2;
    const cy = paddle.y - 6;

    const angles = getMissileVolleyCount(now) > 3
      ? [0, -30, 30, -15, 15]
      : [0, -30, 30];

    for (const a of angles) {

      const r = a * Math.PI / 180;

      const vx = Math.sin(r) * missileCfg.speed;
      const vy = -Math.cos(r) * missileCfg.speed;

      missiles.push({
        x: cx,
        y: cy,
        vx: vx,
        vy: vy,
        alive: true
      });

    }

    lastMissileShot = now;
  }

  function isPowerActive(type, now) {
    return activePower[type] && now < activePower[type];
  }

  function activatePower(type, now) {
    if (type === PowerType.RESPAWN_BOXES) {
      respawnRandomBricks(2, now);
      return;
    }

    activePower[type] = now + getPowerDuration(type);

    if (type === PowerType.LESS_MISSILES) missiles.length = 0;
  }

  function getHelperScale(now) {
    const enlarged = isPowerActive(PowerType.ENLARGE_HELPERS, now);
    const reduced = isPowerActive(PowerType.REDUCE_HELPERS, now);

    if (enlarged && !reduced) return 2;
    if (reduced && !enlarged) return 0.5;
    return 1;
  }

  function getMissileVolleyCount(now) {
    const baseVolley = 3;
    const moreActive = isPowerActive(PowerType.MORE_MISSILES, now);
    const lessActive = isPowerActive(PowerType.LESS_MISSILES, now);
    const volley = baseVolley + (moreActive ? 2 : 0) - (lessActive ? 3 : 0);

    return clamp(volley, 0, 5);
  }

  function updatePowerEffects(now) {
    // paddle max expansion cap
    paddle.maxWidth = isPowerActive(PowerType.MAX_PADDLE, now)
      ? paddle.baseWidth * 4
      : paddle.baseWidth * 8; // normal cap (change if you want)

    // slow player movement cap (tune number)
    paddle.playerMaxStep = isPowerActive(PowerType.SLOW_MOVE, now)
      ? 4
      : Infinity;
  }

  function spawnPowerup(type, x, y) {
    powerups.push({
      type,
      x,
      y,
      size: POWERUP_SIZE,
      vy: 2.2,
      alive: true
    });
  }

  function brickOverlapsHazards(brick, bw) {
    const x = bricks.side + brick.c * (bw + bricks.padding);
    const y = bricks.top + brick.r * (bricks.h + bricks.padding);

    const overlapsWell = gravityWells.some((well) => {
      const pos = wellPosition(well, bw);
      return circleRectOverlap(pos.x, pos.y, well.radius, x, y, bw, bricks.h);
    });

    const overlapsHole = hazardHoles.some((hole) => {
      const pos = wellPosition(hole, bw);
      return circleRectOverlap(pos.x, pos.y, hole.radius, x, y, bw, bricks.h);
    });

    return overlapsWell || overlapsHole;
  }

  function respawnRandomBricks(count, now) {
    const bw = brickWidth();
    const candidates = bricks.grid.filter((b) => {
      if (b.alive) return false;
      if (b.isTnt || b.hasPower) return false;
      if (state.level === 4 && b.r === 2 && b.c === 4) return false;
      return !brickOverlapsHazards(b, bw);
    });

    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const selected = candidates.slice(0, Math.min(count, candidates.length));

    for (const brick of selected) {
      brick.alive = true;
      brick.hasPower = false;
      brick.isTnt = false;
      brick.respawnAnimStart = now;
      brick.respawnGlowUntil = now + RESPAWN_GLOW_HOLD_MS;
      brick.respawnGlowFadeUntil = brick.respawnGlowUntil + RESPAWN_GLOW_FADE_MS;
    }
  }

  function explodeTnt(brick, now) {
    const blastRadius = 1;
    const shardSpreadFactor = 1.55;
    const shardCount = 40;
    const bw = brickWidth();
    const sourceX = bricks.side + brick.c * (bw + bricks.padding) + bw / 2;
    const sourceY = bricks.top + brick.r * (bricks.h + bricks.padding) + bricks.h / 2;

    const maxShardDistance = Math.max(bw, bricks.h) * shardSpreadFactor;

    for (let i = 0; i < shardCount; i++) {
      const angle = (Math.PI * 2 * i) / shardCount;
      const distance = maxShardDistance * (0.65 + Math.random() * 0.35);
      const targetX = sourceX + Math.cos(angle) * distance;
      const targetY = sourceY + Math.sin(angle) * distance;

      tntShards.push({
        x: sourceX,
        y: sourceY,
        targetX,
        targetY,
        progress: 0,
        speed: 0.1 + Math.random() * 0.05,
        bend: (Math.random() - 0.5) * 0.35,
        size: 2 + Math.random() * 2
      });
    }

    for (const target of bricks.grid) {
      if (!target.alive) continue;

      const dr = Math.abs(target.r - brick.r);
      const dc = Math.abs(target.c - brick.c);
      if (dr > blastRadius || dc > blastRadius) continue;

      const targetX = bricks.side + target.c * (bw + bricks.padding) + bw / 2;
      const targetY = bricks.top + target.r * (bricks.h + bricks.padding) + bricks.h / 2;

      tntImpactBursts.push({
        x: targetX,
        y: targetY,
        radius: 0,
        maxRadius: Math.min(bw, bricks.h) * 0.72,
        alpha: 0.9
      });

      if (target.hasPower) {
        const helpersActive = state.lives <= 3;
        const missilesActive = state.lives <= 2;
        const type = pickPowerType(helpersActive, missilesActive);
        spawnPowerup(type, targetX, targetY);
      }

      target.alive = false;
      target.hasPower = false;
      target.isTnt = false;
    }

  }

  function destroyBrickAndMaybeDrop(b, brickX, brickY, bw, now) {

    b.alive = false;

    if (b.isTnt) {
      b.isTnt = false;
      b.hasPower = false;
      explodeTnt(b, now);
      return;
    }

    if (b.hasPower) {

      const helpersActive = state.lives <= 3;
      const missilesActive = state.lives <= 2;

      const type = pickPowerType(helpersActive, missilesActive);

      spawnPowerup(type, brickX + bw/2, brickY + bricks.h/2);

      b.hasPower = false;
    }
  }

  function showPowerToast(text, now) {
    powerToastText = text;
    powerToastStart = now;
  }

  function clearAllPowers() {
    for (const type in activePower) {
      activePower[type] = 0;
    }
  }

  function clearTransientEffects() {
    clearAllPowers();
    powerups.length = 0;
    missiles.length = 0;
    lastMissileShot = 0;
  }

  function promoteOneBrickToPower() {

    if (state.level === 4) return;

    const candidates = [];

    for (let i = 0; i < bricks.grid.length; i++) {

      const b = bricks.grid[i];

      if (b.alive && !b.hasPower && !b.isTnt) candidates.push(i);

    }

    if (candidates.length === 0) return;

    const pick = candidates[Math.floor(Math.random() * candidates.length)];

    bricks.grid[pick].hasPower = true;

  }

  function update(now) {
    if (!running) return;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    if (state.startTimeMs !== null) {
      state.elapsedMs = Math.max(0, now - state.startTimeMs - state.pausedDurationMs);
      timerEl.textContent = formatElapsed(state.elapsedMs);
    }

    const resurrectionRising = resurrection.active && resurrection.phase === "rising";

    if (resurrectionRising) {
      ball.y -= resurrection.riseSpeed;

      const targetY = h * resurrection.targetYFactor;
      if (ball.y <= targetY) {
        resurrection.active = false;
        resurrection.phase = "idle";
        ball.y = targetY;
        ball.vx = (Math.random() < 0.5 ? -1 : 1) * 3.4;
        ball.vy = 4;
      }
    } else if (!ball.stuck) {
      ball.x += ball.vx * ball.speedScale;
      ball.y += ball.vy * ball.speedScale;
    }

    const trappedByWell = updateGravityWellTrap(now);

    updatePowerEffects(now);

// --------------------
// ASSIST MODE (latched)
// --------------------


// Only consider latching when ball is moving down and is in bottom third
const inBottomThird = ball.y >= h * (2 / 3);
const movingDown = ball.vy > 0;

if (!paddle.assistLatched && movingDown && inBottomThird) {
  const req = requiredAssistWidth(); // your function that returns width or null
  if (req !== null) {
    paddle.assistLatched = true;
    paddle.assistDirection = req.direction;
    paddle.assistDisplayDirection = req.direction;
    paddle.assistTargetExt = req.extension;
    paddle.assistTargetW = req.width;
  }

}
if (paddle.assistLatched && movingDown && inBottomThird) {
    const req2 = requiredAssistWidth();
    if (req2 !== null) {
      if (req2.direction === paddle.assistDirection) {
        paddle.assistTargetExt = Math.max(paddle.assistTargetExt, req2.extension);
      }
    }
}

if (ball.vy <= 0) {
  paddle.assistLatched = false;
  paddle.assistTargetW = paddle.baseWidth;
  paddle.assistTargetExt = 0;
  paddle.assistDirection = 0;
}

// If latched, keep using the same target width (no shrinking mid-approach)
let targetW = paddle.assistLatched ? paddle.baseWidth + paddle.assistTargetExt : paddle.baseWidth;

if (DEBUG_DISABLE_ASSIST) {
  targetW = paddle.baseWidth;
}

paddle.assistWidth += (targetW - paddle.assistWidth) * paddle.assistSmooth;

// move paddle toward targetCenterX, with optional speed cap
const desiredX = clamp(targetCenterX - paddle.baseWidth / 2, 0, w - paddle.baseWidth);
let dx = desiredX - paddle.bodyX;

if (Number.isFinite(paddle.playerMaxStep)) {
  dx = clamp(dx, -paddle.playerMaxStep, paddle.playerMaxStep);
}

const newX = clamp(paddle.bodyX + dx, 0, w - paddle.baseWidth);
paddle.vx = newX - paddle.bodyX;
paddle.bodyX = newX;

const currentExtension = Math.max(0, paddle.assistWidth - paddle.baseWidth);
const maxLeftExtension = paddle.bodyX;
const maxRightExtension = w - (paddle.bodyX + paddle.baseWidth);
const extensionDirection = paddle.assistLatched
  ? paddle.assistDirection
  : paddle.assistDisplayDirection;

if (extensionDirection < 0) {
  const ext = Math.min(currentExtension, maxLeftExtension);
  paddle.x = paddle.bodyX - ext;
  paddle.w = paddle.baseWidth + ext;
} else if (extensionDirection > 0) {
  const ext = Math.min(currentExtension, maxRightExtension);
  paddle.x = paddle.bodyX;
  paddle.w = paddle.baseWidth + ext;
} else {
  paddle.x = paddle.bodyX;
  paddle.w = paddle.baseWidth;
}

if (currentExtension <= 0.5) {
  paddle.assistDisplayDirection = 0;
}

// --------------------
// JUMP ASSIST (after first life lost)
// --------------------
const assistJumpEnabled = state.lives <= 4; // after first life is lost

if (assistJumpEnabled && !ball.stuck) {
  const movingDown = ball.vy > 0;

  // distance from ball bottom to paddle top (positive when ball is above paddle)
  const gap = paddle.y - (ball.y + ball.r);

  const closeAbove = gap >= 0 && gap <= paddle.jumpClosePx;

  // Are we moving away from the ball?
  const paddleCenter = paddle.x + paddle.w / 2;
  const ballSide = ball.x - paddleCenter; // + means ball is to the right, - left
  const movingAway =
    Math.abs(paddle.vx) > 0.2 &&
    Math.abs(ballSide) > 6 &&
    Math.sign(paddle.vx) === -Math.sign(ballSide);

  // Latch jump if conditions met
  if (!paddle.jumpActive && movingDown && closeAbove && movingAway) {
    paddle.jumpActive = true;
  }

  if (paddle.jumpActive) {
    // Stop jumping as soon as the ball starts moving up.
    if (!movingDown) {
      paddle.jumpActive = false;
    }

    // Target Y just above where collision will happen
    // (make paddle rise toward the ball)
    const targetY = clamp(
      ball.y + ball.r - 0.5,
      paddle.baseY - paddle.jumpMaxRise,
      paddle.baseY
    );

    // Fast smooth move upward
    if (paddle.jumpActive) {
      paddle.y += (targetY - paddle.y) * paddle.jumpSmooth;
    }

    // Safety clamp (don’t go off-screen)
    paddle.y = clamp(paddle.y, paddle.baseY - paddle.jumpMaxRise, paddle.baseY);
  } else {
    // Return to base line smoothly
    paddle.y += (paddle.baseY - paddle.y) * paddle.returnSmooth;
  }
} else {
  // If not enabled, always sit on base line
  paddle.jumpActive = false;
  paddle.y += (paddle.baseY - paddle.y) * paddle.returnSmooth;
}

// --------------------
// POWERUP FALL + PICKUP
// --------------------
for (const p of powerups) {
  if (!p.alive) continue;

  p.y += p.vy;

  // picked up by MAIN paddle
  const size = p.size || POWERUP_SIZE;
  const hit = rectHit(
    p.x - size / 2,
    p.y - size / 2,
    size,
    size,
    paddle.x,
    paddle.y,
    paddle.w,
    paddle.h
  );

    if (hit) {
      activatePower(p.type, now);
      showPowerToast(PowerName[p.type] || p.type, now);
      p.alive = false;
      continue;
    }

  // offscreen
  if (p.y > h + 30) p.alive = false;
}

// compact
for (let i = powerups.length - 1; i >= 0; i--) {
  if (!powerups[i].alive) powerups.splice(i, 1);
}

for (let i = tntShards.length - 1; i >= 0; i--) {
  const shard = tntShards[i];
  shard.progress += shard.speed;

  if (shard.progress >= 1) {
    tntShards.splice(i, 1);
    continue;
  }
}

for (let i = tntImpactBursts.length - 1; i >= 0; i--) {
  const burst = tntImpactBursts[i];
  burst.radius += 1.6;
  burst.alpha -= 0.045;
  if (burst.radius >= burst.maxRadius || burst.alpha <= 0) {
    tntImpactBursts.splice(i, 1);
  }
}

// --------------------
// HELPER PADDLES (random patrol) - after 2 lives lost
// --------------------
const helpersEnabled = state.lives <= 3;
const helperScale = getHelperScale(now);

if (helpersEnabled) {
  if (helpers.length === 0) setUpHelpers();

  const worldW = canvas.clientWidth;

  for (const hp of helpers) {
    hp.y = helperBaseY();
    hp.w = hp.baseW * helperScale;

    // Occasionally change speed a bit (random patrol behaviour)
    // About 2% chance per frame ~ changes every few seconds
    if (Math.random() < 0.02) {
      const delta = (Math.random() * 1.6 - 0.8); // -0.8..+0.8
      hp.vx += delta;
    }

    // Also occasionally flip direction
    if (Math.random() < 0.005) {
      hp.vx *= -1;
    }

    // Clamp speed
    const dir = Math.sign(hp.vx) || 1;

// enforce minimum speed
if (Math.abs(hp.vx) < helperCfg.minSpeed) {
  hp.vx = dir * helperCfg.minSpeed;
}

// enforce maximum speed
hp.vx = clamp(hp.vx, -helperCfg.maxSpeed, helperCfg.maxSpeed);

    // Move
    hp.x += hp.vx;

    // Bounce off walls
    if (hp.x < 0) {
      hp.x = 0;
      hp.vx = Math.abs(hp.vx) || 1.5;
    } else if (hp.x + hp.w > worldW) {
      hp.x = worldW - hp.w;
      hp.vx = -Math.abs(hp.vx) || -1.5;
    }
  }
} else {
  helpers.length = 0;
}

// MISSILES ENABLED AFTER LOSING 3 LIVES
if (state.lives <= 2 && running && !ball.stuck && getMissileVolleyCount(now) > 0) {
  if (now - lastMissileShot > missileCfg.interval) {
    fireMissiles(now);
  }
}

for (const m of missiles) {

  if (!m.alive) continue;

  const bw = brickWidth();
  applyGravityWellsToMissile(m, bw);

  m.x += m.vx;
  m.y += m.vy;

  // remove if offscreen
  if (m.y < -20) {
    m.alive = false;
    continue;
  }

  // check brick collision
  for (const b of bricks.grid) {

    if (!b.alive) continue;

    const bx = bricks.side + b.c * (bw + bricks.padding);
    const by = bricks.top + b.r * (bricks.h + bricks.padding);

    if (rectHit(m.x-2, m.y-2, 4, 4, bx, by, bw, bricks.h)) {

      destroyBrickAndMaybeDrop(b, bx, by, bw, now);
m.alive = false;

      break;
    }
  }

}

    // Wall bounce
    if (!trappedByWell)
    if (ball.x - ball.r <= 0) {
      ball.x = ball.r;
      ball.vx = Math.abs(ball.vx);
      nudgeBallHorizontal();
    } else if (ball.x + ball.r >= w) {
      ball.x = w - ball.r;
      ball.vx = -Math.abs(ball.vx);
      nudgeBallHorizontal();
    }

    if (!trappedByWell && ball.y - ball.r <= 0) {
      ball.y = ball.r;
      ball.vy = Math.abs(ball.vy);
      nudgeBallHorizontal();
    }

   // Main paddle bounce
if (!trappedByWell && !resurrectionRising && bounceOffPaddleLike(paddle.x, paddle.y, paddle.w, paddle.h, paddle.vx)) {
  // if you have assist/jump reset stuff, keep it here:
  paddle.jumpActive = false;

  paddle.assistDisplayDirection = paddle.assistDirection;
  paddle.assistLatched = false;
  nudgeBallHorizontal();
  paddle.assistTargetW = paddle.baseWidth;
  paddle.assistTargetExt = 0;
  paddle.assistDirection = 0;
}

// Helper paddles bounce
for (const hp of helpers) {
  if (!trappedByWell && !resurrectionRising && bounceOffPaddleLike(hp.x, hp.y, hp.w, hp.h, hp.vx)) {
    // optional: tiny damping so it doesn’t get too chaotic
    // ball.vx *= 0.98;
    break;
  }
}

    if (!trappedByWell) checkBrickCollisions(now);

    // Lose life
    const hitHazardHole = ballEnteredHazardHole();
    const lostByBottom = ball.y - ball.r > h;

    if (!resurrection.active && (lostByBottom || hitHazardHole)) {
      if (state.lives === 1 && state.resurrectionsLeft > 0) {
        state.resurrectionsLeft--;
        resurrection.active = true;
        resurrection.phase = "rising";
        ball.stuck = false;
        ball.speedScale = 1;
        ball.x = clamp(ball.x, ball.r + 2, w - ball.r - 2);
        ball.y = h + ball.r + 4;
        ball.vx = 0;
        ball.vy = -resurrection.riseSpeed;
        paddle.jumpActive = false;
        paddle.y = paddle.baseY;
        paddle.assistLatched = false;
        paddle.assistTargetW = paddle.baseWidth;
        paddle.assistTargetExt = 0;
        paddle.assistDirection = 0;
paddle.assistDisplayDirection = 0;
        showPowerToast(`RESURRECTION (${state.resurrectionsLeft} LEFT)`, now);
        return;
      }

      state.lives--;
      promoteOneBrickToPower();
      livesEl.textContent = state.lives;
      clearAllPowers();
      paddle.playerMaxStep = Infinity;
      paddle.assistLatched = false;
      paddle.assistTargetW = paddle.baseWidth;
      paddle.assistTargetExt = 0;
      paddle.assistDirection = 0;
paddle.assistDisplayDirection = 0;
      missiles.length = 0;

      if (state.lives <= 0) {
        if (hasDifficulty) {
          openDifficultyLevelChoiceOverlay();
          return;
        }

        goToNextLevelAfterLoss();
        return;
      }

      if (state.lives === 3) {
        setUpHelpers(); // just crossed the threshold (lost 2 lives)
      }

      resetBall();
      running = false;
      pausedOnOverlay = true;
      paddle.assistLatched = false;
      paddle.assistTargetW = paddle.baseWidth;
      paddle.assistTargetExt = 0;
      paddle.assistDirection = 0;
paddle.assistDisplayDirection = 0;
      missiles.length = 0;
      lastMissileShot = 0;
      if (state.level === 4) {
        showOverlay("Life Lost", "click/tap to release the ball");
      } else {
        showOverlay("Life Lost", hitHazardHole ? "Black hole consumed the ball. Tap / Click to continue." : "Tap / Click to continue.");
      }
    }

    // Win
    if (remainingBricks() === 0) {
      state.won = true;
      running = false;
      pausedOnOverlay = true;
      const stats = reportGameOutcome("win");
      showOverlay("You Win!", `Cleared level ${state.level} in ${formatElapsed(state.elapsedMs)}.`, {
        buttonLabel: "Try again",
        showExit: true,
        exitLabel: "Exit",
        showRestore: true,
        restoreStats: { score: stats.previousScore, streak: stats.previousStreak },
        stats
      });
      clearAllPowers();
      paddle.playerMaxStep = Infinity;
      paddle.assistLatched = false;
      paddle.assistTargetW = paddle.baseWidth;
      paddle.assistTargetExt = 0;
      paddle.assistDirection = 0;
paddle.assistDisplayDirection = 0;
      missiles.length = 0;
    }
  }

  function getActivePowers(now) {
    const list = [];

    for (const type in activePower) {
      const end = activePower[type];
      if (end && end > now) {
        list.push({ type, end, remaining: end - now });
      }
    }

    // show the ones expiring soonest first (change if you prefer)
    list.sort((a, b) => a.remaining - b.remaining);

    return list;
  }

  // --------------------
  // DRAW
  // --------------------

  function draw() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const now = performance.now();

    ctx.clearRect(0, 0, w, h);
    // --------------------
// POWER-UP BARS (stacked, top-left)
// --------------------


const powers = getActivePowers(now);

if (powers.length) {

  const x0 = 12;
  const y0 = 10;

  const cardW = 200;
  const cardH = 34;
  const gap = 10;

  ctx.save();
  ctx.font = "bold 12px system-ui";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  for (let i = 0; i < powers.length; i++) {

    const p = powers[i];
    const x = x0 + i * (cardW + gap);

    const label = PowerName[p.type] || p.type;
    const frac = p.remaining / getPowerDuration(p.type);

    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(x, y0, cardW, cardH);

    ctx.globalAlpha = 1;
    ctx.fillStyle = "white";
    ctx.fillText(label, x + 8, y0 + 6);

    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(x + 8, y0 + 20, cardW - 16, 8);

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillRect(x + 8, y0 + 20, (cardW - 16) * frac, 8);
  }

  ctx.restore();
}
    // Bricks
    const bw = brickWidth();
  for (const b of bricks.grid) {
      if (!b.alive) continue;

      const x = bricks.side + b.c * (bw + bricks.padding);
      const y = bricks.top + b.r * (bricks.h + bricks.padding);

      if (b.isTnt) {
        ctx.fillStyle = "rgba(255,98,82,0.96)";
      } else {
        ctx.fillStyle = b.hasPower
  ? "rgba(255,220,120,0.95)"
  : "rgba(122,168,255,0.9)";
      }

      const respawnStart = b.respawnAnimStart || 0;
      const animProgress = respawnStart ? clamp((now - respawnStart) / 260, 0, 1) : 1;

      const drawW = bw * animProgress;
      const drawH = bricks.h * animProgress;
      const drawX = x + (bw - drawW) / 2;
      const drawY = y + (bricks.h - drawH) / 2;

      const glowHoldUntil = b.respawnGlowUntil || 0;
      const glowFadeUntil = b.respawnGlowFadeUntil || glowHoldUntil;
      const glowFading = glowFadeUntil > glowHoldUntil && now > glowHoldUntil;
      const glowFadeProgress = glowFading ? clamp((now - glowHoldUntil) / (glowFadeUntil - glowHoldUntil), 0, 1) : 0;
      const glowStrength = glowFading ? 1 - glowFadeProgress : 1;

      if (animProgress < 1 || now < glowFadeUntil) {
        ctx.save();
        const baseGlowAlpha = animProgress < 1 ? 0.92 : 0.6;
        const baseGlowBlur = animProgress < 1 ? 22 : 16;
        const glowAlpha = baseGlowAlpha * glowStrength;
        ctx.shadowBlur = baseGlowBlur * (0.5 + 0.5 * glowStrength);
        ctx.shadowColor = `rgba(168,215,255,${glowAlpha})`;
        ctx.fillRect(drawX, drawY, drawW, drawH);
        ctx.restore();
      }

      ctx.fillRect(drawX, drawY, drawW, drawH);

      if (animProgress >= 1 && respawnStart) {
        b.respawnAnimStart = 0;
      }

      if (b.respawnGlowFadeUntil && now >= b.respawnGlowFadeUntil) {
        b.respawnGlowUntil = 0;
        b.respawnGlowFadeUntil = 0;
      }

    }

    if ([2, 3].includes(state.level) && gravityWells.length) {
      for (const well of gravityWells) {
        const pos = wellPosition(well, bw);
        const pulseProgress = ((now % 1300) / 1300);
        const outward = well.pulseMode === "outward";
        const innerRadius = well.radius * 0.58;

        const pulseRadius = outward
          ? innerRadius + (well.radius - innerRadius) * pulseProgress
          : innerRadius + (well.radius - innerRadius) * (1 - pulseProgress);

        const pulseAlpha = outward ? (1 - pulseProgress) : pulseProgress;
        const pulseColor = outward
          ? `rgba(120,255,180,${0.45 * pulseAlpha})`
          : `rgba(255,130,220,${0.45 * pulseAlpha})`;

        ctx.save();
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, pulseRadius, 0, Math.PI * 2);
        ctx.fillStyle = pulseColor;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, innerRadius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,240,120,0.95)";
        ctx.shadowBlur = 14;
        ctx.shadowColor = "rgba(255,230,90,0.9)";
        ctx.fill();
        ctx.restore();
      }
    }


    if (hazardHoles.length) {
      for (const hole of hazardHoles) {
        const pos = wellPosition(hole, bw);

        ctx.save();
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, hole.radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.95)";
        ctx.fill();

        ctx.strokeStyle = "rgba(255,255,255,0.24)";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.font = "bold 18px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("☠", pos.x, pos.y + 1);
        ctx.restore();
      }
    }

    const resurrectionRising = resurrection.active && resurrection.phase === "rising";

    function drawBall() {
    ctx.save();
    if (resurrectionRising) {
      ctx.shadowBlur = 16;
      ctx.shadowColor = "rgba(255,216,77,0.85)";
    }
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fillStyle = resurrectionRising ? "#ffd84d" : "#ffffff";
    ctx.fill();
    ctx.restore();
    }

    // Ball renders behind paddles while resurrection lift is active
    if (resurrectionRising) drawBall();

    // Helper paddles
if (helpers.length) {
  ctx.save();

  ctx.fillStyle = "rgba(110,220,255,0.78)";
  for (const hp of helpers) {
    ctx.fillRect(hp.x, hp.y, hp.w, hp.h);
  }

  ctx.restore();
}

    // Paddle (always on top of helpers)
    const extension = Math.max(0, paddle.w - paddle.baseWidth);
    const extensionDirection = paddle.assistLatched
      ? paddle.assistDirection
      : paddle.assistDisplayDirection;

    if (extension > 0 && extensionDirection !== 0) {
      const extX = extensionDirection > 0
        ? paddle.bodyX + paddle.baseWidth
        : paddle.bodyX - extension;
      ctx.fillStyle = "rgba(255,255,255,0.42)";
      ctx.fillRect(extX, paddle.y, extension, paddle.h);
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(paddle.bodyX, paddle.y, paddle.baseWidth, paddle.h);

    if (!resurrectionRising) drawBall();

  // Powerups ( ? boxes )
for (const p of powerups) {
  if (!p.alive) continue;

  const s = p.size || POWERUP_SIZE;
  const isRespawn = p.type === PowerType.RESPAWN_BOXES;

  ctx.fillStyle = isRespawn ? "rgba(84,165,255,0.95)" : "rgba(255,255,255,0.9)";
  ctx.fillRect(p.x - s/2, p.y - s/2, s, s);

  if (isRespawn) {
    ctx.strokeStyle = "rgba(200,230,255,0.95)";
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x - s/2 + 1, p.y - s/2 + 1, s - 2, s - 2);
  }

  ctx.fillStyle = isRespawn ? "rgba(235,247,255,0.95)" : "rgba(0,0,0,0.75)";
  ctx.font = "bold 14px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(isRespawn ? "+" : "?", p.x, p.y);
}


  // Missiles
  for (const m of missiles) {

    if (!m.alive) continue;

    const s = missileCfg.size;
    const ang = Math.atan2(m.vy, m.vx);

    // glowing trail
    ctx.save();

    ctx.beginPath();
    ctx.moveTo(m.x, m.y);
    ctx.lineTo(m.x - m.vx * 3, m.y - m.vy * 3);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,220,120,0.7)";
    ctx.shadowBlur = 8;
    ctx.shadowColor = "rgba(255,200,80,0.8)";
    ctx.stroke();

    ctx.restore();

    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(ang);

    ctx.beginPath();
    ctx.moveTo(s,0);
    ctx.lineTo(-s*0.6,-s*0.4);
    ctx.lineTo(-s*0.6,s*0.4);
    ctx.closePath();

    ctx.fillStyle = "white";
    ctx.fill();

    ctx.restore();
  }

for (const shard of tntShards) {
  const t = shard.progress;
  const x = shard.x + (shard.targetX - shard.x) * t;
  const yBase = shard.y + (shard.targetY - shard.y) * t;
  const arc = Math.sin(t * Math.PI) * 22 * shard.bend;
  const y = yBase - arc;

  ctx.save();
  ctx.fillStyle = "rgba(255,170,130,0.95)";
  ctx.shadowBlur = 8;
  ctx.shadowColor = "rgba(255,120,70,0.9)";
  ctx.fillRect(x - shard.size / 2, y - shard.size / 2, shard.size, shard.size);
  ctx.restore();
}

for (const burst of tntImpactBursts) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(burst.x, burst.y, burst.radius, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255,220,120,${Math.max(0, burst.alpha)})`;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

if (powerToastText) {

  const t = (now - powerToastStart) / powerToastDuration;

  if (t >= 1) {
    powerToastText = "";
  } else {

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    const alpha = 1 - t;
    const eased = alpha * alpha;

    ctx.save();
    ctx.globalAlpha = eased;

    ctx.font = "bold 28px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(w/2 - 190, h/2 - 30, 380, 60);

    ctx.fillStyle = "white";
    ctx.fillText(powerToastText, w/2, h/2);

    ctx.restore();
  }
}
}

  // --------------------
  // LOOP
  // --------------------

  function loop(now) {
    update(now);
    draw();
    requestAnimationFrame(loop);
  }

  window.addEventListener("resize", () => {
    resizeCanvas();
    layout();
  });

  resizeCanvas();
  startGame(difficulty);
  loop();

})();
