const homeScreen = document.getElementById("home-screen");
const hubScreen = document.getElementById("hub-screen");
const difficultyScreen = document.getElementById("difficulty-screen");

const backBtn = document.getElementById("back-btn");
const difficultyBackBtn = document.getElementById("difficulty-back-btn");

const modeTitle = document.getElementById("mode-title");
const meterLabel = document.getElementById("meter-label");
const meterScore = document.getElementById("meter-score");
const meterTier = document.getElementById("meter-tier");
const streakCount = document.getElementById("streak-count");
const meterProgress = document.getElementById("meter-progress");

const difficultyTitle = document.getElementById("difficulty-title");

const modeButtons = document.querySelectorAll(".main-btn");
const gameTiles = document.querySelectorAll(".game-tile");
const difficultyButtons = document.querySelectorAll(".difficulty-btn");

const METRICS_STORAGE_KEY = "loseItMetricsV1";
const MODE_STORAGE_KEY = "loseItModeV1";
const LOSE_HUB_SNAPSHOT_KEY = "loseItLoseHubSnapshotV1";
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

const displayedHubValues = {
  win: { score: appData.win.score, streak: appData.win.streak },
  lose: { score: appData.lose.score, streak: appData.lose.streak }
};

let currentMode = "win";
let selectedGame = "";
let selectedGamePath = "";
let hubAnimationTimer = null;
let pendingLoseHubSnapshot = null;

function logFailometer(stage, details = {}) {
  console.log(`[Failometer] ${stage}`, details);
}

function readLoseHubSnapshot() {
  try {
    const raw = localStorage.getItem(LOSE_HUB_SNAPSHOT_KEY);
    if (!raw) {
      logFailometer("snapshot:read:empty");
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!Number.isFinite(parsed.score) || !Number.isFinite(parsed.streak)) {
      logFailometer("snapshot:read:invalid", { parsed });
      return null;
    }

    const snapshot = {
      score: clamp(parsed.score, 0, 100),
      streak: Math.max(0, Math.floor(parsed.streak))
    };

    logFailometer("snapshot:read:success", snapshot);
    return snapshot;
  } catch (error) {
    logFailometer("snapshot:read:error", { error });
    return null;
  }
}

function writeLoseHubSnapshot(snapshot) {
  logFailometer("snapshot:write", snapshot);
  localStorage.setItem(LOSE_HUB_SNAPSHOT_KEY, JSON.stringify(snapshot));
}

function clearLoseHubSnapshot() {
  logFailometer("snapshot:clear");
  localStorage.removeItem(LOSE_HUB_SNAPSHOT_KEY);
}

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
  const requestedMode = params.get("mode");
  const targetScreen = params.get("screen");
  const snapshot = readLoseHubSnapshot();

  if (requestedMode === "win" || requestedMode === "lose") {
    currentMode = requestedMode;
    localStorage.setItem(MODE_STORAGE_KEY, currentMode);
  } else {
    const storedMode = localStorage.getItem(MODE_STORAGE_KEY);
    if (storedMode === "win" || storedMode === "lose") {
      currentMode = storedMode;
    }
  }

  if (currentMode === "lose" && snapshot) {
    displayedHubValues.lose = snapshot;
    pendingLoseHubSnapshot = snapshot;
    logFailometer("initialize:pending-snapshot-set", { pendingLoseHubSnapshot });
  }

  if (targetScreen !== "difficulty") {
    updateHub(currentMode, {
      animate: false,
      preserveDisplayedValues: currentMode === "lose" && Boolean(snapshot)
    });
    return;
  }

  if (!(currentMode === "lose" && snapshot)) {
    updateHub(currentMode, { animate: false });
  }

  selectedGame = params.get("game") || "Game 1";
  selectedGamePath = params.get("path") || "games/game1/index.html";
  difficultyTitle.textContent = selectedGame.toUpperCase();
  showScreen("difficulty");
}

function getMeterTierText(mode, score) {
  const tier = clamp(score, 0, 100);

  if (mode === "lose") {
    if (tier < 20) return "not a loser";
    if (tier < 40) return "wannabe loser";
    if (tier < 60) return "loser in training";
    if (tier < 80) return "disappointing your parents";
    return "failure is your middle name";
  }

  if (tier < 20) return "not a winner";
  if (tier < 40) return "wannabe winner";
  if (tier < 60) return "winner in training";
  if (tier < 80) return "making your parents proud";
  return "winner is your middle name";
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function animateNumber(from, to, duration, onUpdate, onDone) {
  const startedAt = performance.now();

  function step(now) {
    const progress = Math.min((now - startedAt) / duration, 1);
    const eased = easeOutCubic(progress);
    const value = Math.round(from + (to - from) * eased);
    onUpdate(value);

    if (progress < 1) {
      requestAnimationFrame(step);
      return;
    }

    if (onDone) onDone();
  }

  requestAnimationFrame(step);
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentMode = button.dataset.mode;
    localStorage.setItem(MODE_STORAGE_KEY, currentMode);
    showScreen("hub");
  });
});

gameTiles.forEach((tile) => {
  tile.addEventListener("click", () => {
    if (currentMode === "lose") {
      writeLoseHubSnapshot({
        score: clamp(appData.lose.score, 0, 100),
        streak: Math.max(0, Math.floor(appData.lose.streak))
      });
    } else {
      clearLoseHubSnapshot();
    }

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

    window.location.href = `${selectedGamePath}?difficulty=${encodeURIComponent(difficulty)}&mode=${encodeURIComponent(currentMode)}`;
  });
});

backBtn.addEventListener("click", () => {
  showScreen("home");
});

difficultyBackBtn.addEventListener("click", () => {
  showScreen("hub");
});

function showScreen(screenName) {
  if (hubAnimationTimer) {
    clearTimeout(hubAnimationTimer);
    hubAnimationTimer = null;
  }

  homeScreen.classList.remove("active");
  hubScreen.classList.remove("active");
  difficultyScreen.classList.remove("active");

  if (screenName === "home") {
    homeScreen.classList.add("active");
  } else if (screenName === "hub") {
    hubScreen.classList.add("active");
    hubAnimationTimer = setTimeout(() => {
      const snapshotStart = currentMode === "lose" ? pendingLoseHubSnapshot : null;
      if (currentMode === "lose") {
        logFailometer("showScreen:hub:animate", {
          pendingLoseHubSnapshot,
          snapshotStart,
          displayedLoseValues: displayedHubValues.lose,
          targetLoseValues: appData.lose
        });
      }

      updateHub(currentMode, {
        animate: true,
        startFrom: snapshotStart
      });

      if (currentMode === "lose") {
        logFailometer("showScreen:hub:pending-snapshot-cleared", { pendingLoseHubSnapshot });
        pendingLoseHubSnapshot = null;
        clearLoseHubSnapshot();
      }

      hubAnimationTimer = null;
    }, 200);
  } else if (screenName === "difficulty") {
    difficultyScreen.classList.add("active");
  }
}

function updateHub(mode, options = {}) {
  const { animate = true, preserveDisplayedValues = false, startFrom = null } = options;
  const data = appData[mode];
  const targetScore = clamp(data.score, 0, 100);
  const targetStreak = Math.max(0, Math.floor(data.streak));

  if (mode === "win") {
    modeTitle.textContent = "WIN MODE";
    meterLabel.textContent = "WINOMETER";
    meterProgress.style.stroke = "var(--accent-win)";
  } else {
    modeTitle.textContent = "LOSE MODE";
    meterLabel.textContent = "FAILOMETER";
    meterProgress.style.stroke = "var(--accent-lose)";
  }

  const displayed = displayedHubValues[mode] || { score: targetScore, streak: targetStreak };
  const fromScore = Number.isFinite(startFrom?.score)
    ? clamp(startFrom.score, 0, 100)
    : displayed.score;
  const fromStreak = Number.isFinite(startFrom?.streak)
    ? Math.max(0, Math.floor(startFrom.streak))
    : displayed.streak;

  if (mode === "lose") {
    logFailometer("updateHub:resolved-values", {
      animate,
      startFrom,
      pendingLoseHubSnapshot,
      displayedLoseValues: displayed,
      targetScore,
      targetStreak,
      fromScore,
      fromStreak
    });
  }


  if (!animate) {
    meterScore.textContent = String(targetScore);
    meterTier.textContent = getMeterTierText(mode, targetScore);
    streakCount.textContent = String(targetStreak);
    meterProgress.style.strokeDashoffset = String(100 - targetScore);

    if (!preserveDisplayedValues) {
      displayedHubValues[mode] = { score: targetScore, streak: targetStreak };
    }

    if (mode === "lose") {
      logFailometer("updateHub:no-animation", {
        preserveDisplayedValues,
        displayedLoseValues: displayedHubValues.lose,
        targetScore,
        targetStreak
      });
    }

    return;
  }

  animateNumber(fromScore, targetScore, 650, (value) => {
    if (mode === "lose") {
      logFailometer("animate:score:tick", { value, fromScore, targetScore });
    }
    meterScore.textContent = String(value);
    meterTier.textContent = getMeterTierText(mode, value);
    meterProgress.style.strokeDashoffset = String(100 - clamp(value, 0, 100));
  }, () => {
    displayedHubValues[mode].score = targetScore;
    if (mode === "lose") {
      logFailometer("animate:score:done", {
        finalScore: targetScore,
        displayedLoseValues: displayedHubValues.lose
      });
    }
  });

  animateNumber(fromStreak, targetStreak, 650, (value) => {
    if (mode === "lose") {
      logFailometer("animate:streak:tick", { value, fromStreak, targetStreak });
    }
    streakCount.textContent = String(value);
  }, () => {
    displayedHubValues[mode].streak = targetStreak;
    if (mode === "lose") {
      logFailometer("animate:streak:done", {
        finalStreak: targetStreak,
        displayedLoseValues: displayedHubValues.lose
      });
    }
  });
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
    updateHub(currentMode, { animate: true });
  }
}

window.updateFromGameResult = updateFromGameResult;
window.addEventListener("storage", (event) => {
  if (event.key !== METRICS_STORAGE_KEY) return;
  syncLoseModeFromStorage();
  if (currentMode === "lose") updateHub("lose", { animate: true });
});

syncLoseModeFromStorage();
initializeFromQuery();
