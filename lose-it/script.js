const homeScreen = document.getElementById("home-screen");
const hubScreen = document.getElementById("hub-screen");
const difficultyScreen = document.getElementById("difficulty-screen");

const backBtn = document.getElementById("back-btn");
const difficultyBackBtn = document.getElementById("difficulty-back-btn");

const modeTitle = document.getElementById("mode-title");
const meterLabel = document.getElementById("meter-label");
const meterScore = document.getElementById("meter-score");
const streakCount = document.getElementById("streak-count");
const meterProgress = document.getElementById("meter-progress");

const difficultyTitle = document.getElementById("difficulty-title");

const modeButtons = document.querySelectorAll(".main-btn");
const gameTiles = document.querySelectorAll(".game-tile");
const difficultyButtons = document.querySelectorAll(".difficulty-btn");

const METRICS_STORAGE_KEY = "loseItMetricsV1";
const defaultMetrics = {
  failometerScore: 0,
  lossStreak: 0
};

const appData = {
  win: {
    score: 62,
    streak: 4
  },
  lose: {
    score: 0,
    streak: 0
  }
};

let currentMode = "win";
let selectedGame = "";
let selectedGamePath = "";

function readMetrics() {
  try {
    const raw = localStorage.getItem(METRICS_STORAGE_KEY);
    if (!raw) return { ...defaultMetrics };

    const parsed = JSON.parse(raw);
    return {
      failometerScore: Number.isFinite(parsed.failometerScore) ? parsed.failometerScore : defaultMetrics.failometerScore,
      lossStreak: Number.isFinite(parsed.lossStreak) ? parsed.lossStreak : defaultMetrics.lossStreak
    };
  } catch (error) {
    return { ...defaultMetrics };
  }
}

function writeMetrics(metrics) {
  localStorage.setItem(METRICS_STORAGE_KEY, JSON.stringify(metrics));
}

function syncLoseModeFromStorage() {
  const metrics = readMetrics();
  appData.lose.score = clamp(metrics.failometerScore, 0, 100);
  appData.lose.streak = Math.max(0, Math.floor(metrics.lossStreak));
}

function applyLoseModeResult(result = {}) {
  const metrics = readMetrics();

  if (typeof result.scoreDelta === "number") {
    metrics.failometerScore = clamp(metrics.failometerScore + result.scoreDelta, 0, 100);
  }

  if (result.outcome === "win") {
    metrics.lossStreak = 0;
  } else if (result.outcome === "loss") {
    metrics.lossStreak += 1;
  } else if (typeof result.streak === "number") {
    metrics.lossStreak = Math.max(0, Math.floor(result.streak));
  }

  writeMetrics(metrics);
  appData.lose.score = metrics.failometerScore;
  appData.lose.streak = metrics.lossStreak;
}


function initializeFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const targetScreen = params.get("screen");

  if (targetScreen !== "difficulty") {
    return;
  }

  selectedGame = params.get("game") || "Game 1";
  selectedGamePath = params.get("path") || "games/game1/index.html";
  difficultyTitle.textContent = selectedGame.toUpperCase();
  showScreen("difficulty");
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentMode = button.dataset.mode;
    updateHub(currentMode);
    showScreen("hub");
  });
});

gameTiles.forEach((tile) => {
    tile.addEventListener("click", () => {
      selectedGame = tile.dataset.game;
      selectedGamePath = tile.dataset.path;
  
      difficultyTitle.textContent = selectedGame.toUpperCase();
      showScreen("difficulty");
    });
  });

  difficultyButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const difficulty = button.dataset.difficulty;
  
      if (!selectedGamePath) return;
  
      window.location.href = `${selectedGamePath}?difficulty=${encodeURIComponent(difficulty)}`;
    });
  });

backBtn.addEventListener("click", () => {
  showScreen("home");
});

difficultyBackBtn.addEventListener("click", () => {
  showScreen("hub");
});

function showScreen(screenName) {
  homeScreen.classList.remove("active");
  hubScreen.classList.remove("active");
  difficultyScreen.classList.remove("active");

  if (screenName === "home") {
    homeScreen.classList.add("active");
  } else if (screenName === "hub") {
    hubScreen.classList.add("active");
  } else if (screenName === "difficulty") {
    difficultyScreen.classList.add("active");
  }
}

function updateHub(mode) {
  const data = appData[mode];
  const score = clamp(data.score, 0, 100);
  const streak = data.streak;

  if (mode === "win") {
    modeTitle.textContent = "WIN MODE";
    meterLabel.textContent = "WINOMETER";
    meterProgress.style.stroke = "var(--accent-win)";
  } else {
    modeTitle.textContent = "LOSE MODE";
    meterLabel.textContent = "FAILOMETER";
    meterProgress.style.stroke = "var(--accent-lose)";
  }

  meterScore.textContent = score;
  streakCount.textContent = streak;

  const dashOffset = 100 - score;
  meterProgress.style.strokeDashoffset = dashOffset;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function updateFromGameResult(mode, result) {
  if (!appData[mode]) return;

  if (mode === "lose") {
    applyLoseModeResult(result);
  } else {
    if (typeof result.scoreDelta === "number") {
      appData[mode].score = clamp(appData[mode].score + result.scoreDelta, 0, 100);
    }

    if (typeof result.streak === "number") {
      appData[mode].streak = result.streak;
    }
  }

  if (mode === currentMode) {
    updateHub(currentMode);
  }
}

window.updateFromGameResult = updateFromGameResult;
window.addEventListener("storage", (event) => {
  if (event.key !== METRICS_STORAGE_KEY) return;
  syncLoseModeFromStorage();
  if (currentMode === "lose") updateHub("lose");
});

syncLoseModeFromStorage();
initializeFromQuery();
