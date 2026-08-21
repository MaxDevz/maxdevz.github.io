let currentBases = new Set();
let currentStats = new Set();
let players = [];
let yearPlayers = [];
let teams = [];
let homeLineup = [];
let awayLineup = [];
let currentTab = "away"; // "home" or "away"
let selectedTeam = "";
let selectedVisitorTeam = "";
let currentPlayerIndex = -1;
let currentInningIndex = -1;
let currentInningIsExtra = false;
let freeMode = false;
// Tant que la partie n'est pas démarrée (bouton "Démarrer la partie"), rien n'est
// enregistré dans le localStorage, même si date/heure/équipes sont déjà remplis.
let gameStarted = false;
// Second at-bat columns for innings where the lineup batted around (index = inning - 1).
let homeExtraPasses = [];
let awayExtraPasses = [];
// Nombre de points qui ferme automatiquement une manche (configurable via l'UI).
let inningPointsLimit = 4;
// Permet de rouvrir manuellement une manche fermée automatiquement (3 retraits ou limite de points atteinte).
// Index = inning - 1, { normal, extra } = passage concerné.
let homeInningOverrides = [];
let awayInningOverrides = [];
// Compteur de coureurs par équipe : gardé en mémoire (localStorage) mais jamais inclus dans le JSON généré.
let homeRunnerCount = 0;
let awayRunnerCount = 0;

const YEAR = 2026;
const BASES_ORDER = ["field", "0B", "1B", "2B", "3B", "4B"];
const ON_BASE_STATES = ["1B", "2B", "3B"];
const DEFAULT_LINEUP_SIZE = 11;
// Nombre de manches par défaut, modifiable via l'UI (voir updateInningsCount()).
let maxInnings = 9;
const DEFAULT_MAX_INNINGS_FREE = 6;
const DEFAULT_MAX_INNINGS_TEAM = 9;
const DEFAULT_INNING_POINTS_LIMIT = 4;
const OUTS_LIMIT = 3;
const STATS_OPTIONS = ["1B", "2B", "3B", "CC", "BB", "Opt", "Err", "Sac"];
const CS_STATS = ["1B", "2B", "3B", "CC"];
const statMap = {
  "1B": "S",
  "2B": "double",
  "3B": "triple",
  CC: "CC",
  BB: "BB",
  Opt: "OPT",
  Err: "ERR",
  Sac: "SAC",
};

// LocalStorage management
// Une clé distincte par partie (date + heure + équipes) permet d'ouvrir plusieurs
// parties dans des onglets différents sans qu'elles n'écrasent leur état respectif.
const STORAGE_KEY_PREFIX = "gameApp_state";

function getStorageKey() {
  const gameDate = document.getElementById("game-date")?.value || "nodate";
  const gameTime = getGameTime() || "notime";
  const home = selectedTeam || "nohome";
  const away = selectedVisitorTeam || "noaway";
  return [STORAGE_KEY_PREFIX, gameDate, gameTime, home, away].join("::");
}

function formatTimeForFilename(timeValue) {
  // Convertit "19:00" (input type=time) en "19h00" (format utilisé pour les noms de fichiers)
  return (timeValue || "").replace(":", "h");
}

function formatTimeForInput(timeLabel) {
  // Convertit "19h00" en "19:00" (format attendu par input type=time)
  return (timeLabel || "").replace("h", ":");
}

function getGameTime() {
  if (freeMode) {
    const input = document.getElementById("game-time-input");
    return formatTimeForFilename(input?.value || "");
  }
  return document.getElementById("game-time-select")?.value || "";
}

function setGameTime(formattedValue) {
  if (!formattedValue) return;
  const select = document.getElementById("game-time-select");
  const input = document.getElementById("game-time-input");
  if (select) select.value = formattedValue;
  if (input) input.value = formatTimeForInput(formattedValue);
}

function applyGameUrlParameters() {
  const params = new URLSearchParams(window.location.search);
  const away = params.get("away");
  const home = params.get("home");
  const date = params.get("date");
  const time = params.get("time");

  if (!away && !home && !date && !time) return;

  // Ne fait que renseigner les champs (date/heure/équipes) : le lineup en mémoire
  // (localStorage) pour cette partie précise sera restauré ensuite par restoreGameState().
  freeMode = params.get("free") === "1";
  selectedVisitorTeam = away || "";
  selectedTeam = home || "";

  applyFreeModeUI();
  if (date) document.getElementById("game-date").value = date;
  if (time) setGameTime(time);

  if (freeMode) {
    document.getElementById("team-name-input").value = selectedTeam;
    document.getElementById("team-name-input-visiteur").value = selectedVisitorTeam;
  }

  updateTeamSelects();
  updateTabLabels();
}

function createDefaultInningOverrides() {
  return Array.from({ length: maxInnings }, () => ({
    normal: false,
    extra: false,
  }));
}

function hasRequiredGameInfo() {
  const gameDate = document.getElementById("game-date")?.value || "";
  const gameTime = getGameTime();
  return Boolean(gameDate && gameTime && selectedTeam && selectedVisitorTeam);
}

function updateGameStartUI() {
  const button = document.getElementById("start-game-button");
  const status = document.getElementById("game-status-label");
  if (button) {
    button.disabled = gameStarted;
    button.textContent = gameStarted
      ? "Partie démarrée"
      : "Démarrer la partie";
  }
  if (status) {
    status.textContent = gameStarted
      ? "Partie en cours : enregistrement automatique actif."
      : "Sélectionnez la date, l'heure et les 2 équipes, puis démarrez la partie pour activer l'enregistrement automatique.";
  }
}

function startGame() {
  if (!hasRequiredGameInfo()) {
    alert(
      "Veuillez sélectionner la date, l'heure et les 2 équipes avant de démarrer la partie.",
    );
    return;
  }
  gameStarted = true;
  updateGameStartUI();
  saveGameState();
}

function saveGameState() {
  // On n'enregistre l'état de la partie que si elle a été démarrée explicitement
  // et que la date, l'heure et les 2 équipes sont renseignées.
  if (!gameStarted || !hasRequiredGameInfo()) return;

  const state = {
    gameDate: document.getElementById("game-date")?.value || "",
    gameTime: getGameTime() || "19h00",
    freeMode,
    selectedTeam,
    selectedVisitorTeam,
    homeLineup,
    awayLineup,
    homeExtraPasses,
    awayExtraPasses,
    inningPointsLimit,
    maxInnings,
    homeInningOverrides,
    awayInningOverrides,
    homeRunnerCount,
    awayRunnerCount,
    currentTab,
    currentPlayerIndex,
    currentInningIndex,
  };
  localStorage.setItem(getStorageKey(), JSON.stringify(state));
  refreshMemoryGamesList();
}

function getMemoryGameKeys() {
  return Object.keys(localStorage).filter((key) =>
    key.startsWith(`${STORAGE_KEY_PREFIX}::`),
  );
}

function parseMemoryGameKey(key) {
  const [, gameDate, gameTime, home, away] = key.split("::");
  return { gameDate, gameTime, home, away };
}

function formatMemoryGameLabel(key) {
  const { gameDate, gameTime, home, away } = parseMemoryGameKey(key);
  const dateLabel = gameDate === "nodate" ? "Date ?" : gameDate;
  const timeLabel = gameTime === "notime" ? "" : ` ${formatTimeForInput(gameTime)}`;
  const homeLabel = home === "nohome" ? "?" : formatTeamName(home);
  const awayLabel = away === "noaway" ? "?" : formatTeamName(away);
  return `${dateLabel}${timeLabel} — ${awayLabel} @ ${homeLabel}`;
}

function refreshMemoryGamesList() {
  const select = document.getElementById("memory-games-select");
  if (!select) return;

  const currentKey = getStorageKey();
  const previousValue = select.value;
  // Tri du plus récent au plus ancien (les clés commencent par la date au format ISO).
  const keys = getMemoryGameKeys().sort().reverse();

  select.innerHTML =
    '<option value="">Sélectionner une partie en mémoire...</option>';
  keys.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent =
      formatMemoryGameLabel(key) + (key === currentKey ? " (partie active)" : "");
    select.appendChild(option);
  });

  // La partie active (celle chargée via le lien ou en cours) doit toujours
  // apparaître sélectionnée dans le menu, sinon on garde la sélection précédente.
  if (keys.includes(currentKey)) {
    select.value = currentKey;
  } else if (keys.includes(previousValue)) {
    select.value = previousValue;
  }
}

function loadSelectedMemoryGame(lineupOnly = false) {
  const select = document.getElementById("memory-games-select");
  const key = select?.value;
  if (!key) return;

  const raw = localStorage.getItem(key);
  if (!raw) return;

  let savedState;
  try {
    savedState = JSON.parse(raw);
  } catch (e) {
    console.error("Error parsing saved game state:", e);
    return;
  }

  if (lineupOnly) {
    applyLineupOnlyFromMemoryGame(savedState);
  } else {
    restoreGameState(savedState);
    // Met à jour l'URL pour refléter la partie sélectionnée (au lieu de garder les
    // paramètres de l'ancienne partie), afin que le lien reste correct après un refresh.
    syncUrlParameters();
  }

  const pointsLimitInput = document.getElementById("points-limit-input");
  if (pointsLimitInput) pointsLimitInput.value = inningPointsLimit;

  updateLineupDisplay();
  updateScoreDisplay();
  updateRunnerCountDisplay();
  updateActiveInningInfo();
  refreshMemoryGamesList();
}

function resetLineupStats(lineup) {
  return lineup.map((player) => ({
    ...player,
    innings: Array.from({ length: maxInnings }, () => createDefaultStats()),
    innings2: Array.from({ length: maxInnings }, () => createDefaultStats()),
  }));
}

// Reprend uniquement l'alignement (sans les stats) d'une partie en mémoire pour chaque
// côté (locale/visiteuse) dont l'équipe correspond à la partie en cours, peu importe le
// côté qu'elle occupait dans la partie en mémoire.
function applyLineupOnlyFromMemoryGame(savedState) {
  let matched = false;

  if (selectedTeam && selectedTeam === savedState.selectedTeam) {
    homeLineup = resetLineupStats(savedState.homeLineup || []);
    matched = true;
  } else if (selectedTeam && selectedTeam === savedState.selectedVisitorTeam) {
    homeLineup = resetLineupStats(savedState.awayLineup || []);
    matched = true;
  }
  if (matched) {
    homeExtraPasses = Array.from({ length: maxInnings }, () => false);
    homeInningOverrides = createDefaultInningOverrides();
  }

  let visitorMatched = false;
  if (
    selectedVisitorTeam &&
    selectedVisitorTeam === savedState.selectedVisitorTeam
  ) {
    awayLineup = resetLineupStats(savedState.awayLineup || []);
    visitorMatched = true;
  } else if (
    selectedVisitorTeam &&
    selectedVisitorTeam === savedState.selectedTeam
  ) {
    awayLineup = resetLineupStats(savedState.homeLineup || []);
    visitorMatched = true;
  }
  if (visitorMatched) {
    awayExtraPasses = Array.from({ length: maxInnings }, () => false);
    awayInningOverrides = createDefaultInningOverrides();
  }

  if (!matched && !visitorMatched) {
    alert(
      "Cette partie en mémoire ne concerne aucune des équipes sélectionnées.",
    );
    return;
  }

  saveGameState();
}

function syncUrlParameters() {
  const gameDate = document.getElementById("game-date")?.value || "";
  const gameTime = getGameTime();
  const params = new URLSearchParams();
  if (selectedVisitorTeam) params.set("away", selectedVisitorTeam);
  if (selectedTeam) params.set("home", selectedTeam);
  if (gameDate) params.set("date", gameDate);
  if (gameTime) params.set("time", gameTime);
  if (freeMode) params.set("free", "1");

  const query = params.toString();
  const newUrl = query
    ? `${window.location.pathname}?${query}`
    : window.location.pathname;
  window.history.replaceState({}, "", newUrl);
}

function deleteSelectedMemoryGame() {
  const select = document.getElementById("memory-games-select");
  const key = select?.value;
  if (!key) return;
  if (!confirm("Oublier cette partie de la mémoire du navigateur ?")) return;

  localStorage.removeItem(key);
  refreshMemoryGamesList();
}

function updateRunnerCountDisplay() {
  const homeEl = document.getElementById("home-runner-count");
  const awayEl = document.getElementById("away-runner-count");
  if (homeEl) homeEl.textContent = homeRunnerCount;
  if (awayEl) awayEl.textContent = awayRunnerCount;
}

function incrementRunnerCount(side) {
  if (side === "home") homeRunnerCount++;
  else awayRunnerCount++;
  updateRunnerCountDisplay();
  saveGameState();
}

function decrementRunnerCount(side) {
  if (side === "home") homeRunnerCount = Math.max(0, homeRunnerCount - 1);
  else awayRunnerCount = Math.max(0, awayRunnerCount - 1);
  updateRunnerCountDisplay();
  saveGameState();
}

function loadGameState() {
  const state = localStorage.getItem(getStorageKey());
  if (!state) return null;

  try {
    return JSON.parse(state);
  } catch (e) {
    console.error("Error parsing saved game state:", e);
    return null;
  }
}

function clearGameState() {
  localStorage.removeItem(getStorageKey());
}

function resetGameState() {
  clearGameState();

  gameStarted = false;
  selectedTeam = "";
  selectedVisitorTeam = "";
  homeLineup = [];
  awayLineup = [];
  homeExtraPasses = [];
  awayExtraPasses = [];
  inningPointsLimit = DEFAULT_INNING_POINTS_LIMIT;
  setInningsCount(getDefaultMaxInnings());
  homeRunnerCount = 0;
  awayRunnerCount = 0;
  currentTab = "away";
  currentPlayerIndex = -1;
  currentInningIndex = -1;
  currentInningIsExtra = false;

  const teamSelect = document.getElementById("team-select");
  const visitorSelect = document.getElementById("team-select-visiteur");
  const teamNameInput = document.getElementById("team-name-input");
  const teamNameInputVisitor = document.getElementById(
    "team-name-input-visiteur",
  );
  const pointsLimitInput = document.getElementById("points-limit-input");
  if (teamSelect) teamSelect.value = "";
  if (visitorSelect) visitorSelect.value = "";
  if (teamNameInput) teamNameInput.value = "";
  if (teamNameInputVisitor) teamNameInputVisitor.value = "";
  if (pointsLimitInput) pointsLimitInput.value = inningPointsLimit;

  updateTeamSelects();

  document
    .querySelectorAll(".tab-button")
    .forEach((btn) => btn.classList.remove("active"));
  const awayTabButton = document.querySelector(
    `.tab-button[onclick="switchTab('away')"]`,
  );
  if (awayTabButton) awayTabButton.classList.add("active");

  setupDateDefaults();
  updateTabLabels();
  updateLineupDisplay();
  updateActiveInningInfo();
  updateRunnerCountDisplay();
  document.getElementById("output").textContent = "";
  updateGameStartUI();
  refreshMemoryGamesList();
}

function applyFreeModeUI() {
  const selectLocal = document.getElementById("team-select");
  const selectVisitor = document.getElementById("team-select-visiteur");
  const inputLocal = document.getElementById("team-name-input");
  const inputVisitor = document.getElementById("team-name-input-visiteur");
  const timeSelect = document.getElementById("game-time-select");
  const timeInput = document.getElementById("game-time-input");
  const toggle = document.getElementById("free-mode-toggle");

  if (selectLocal) selectLocal.style.display = freeMode ? "none" : "";
  if (selectVisitor) selectVisitor.style.display = freeMode ? "none" : "";
  if (inputLocal) inputLocal.style.display = freeMode ? "" : "none";
  if (inputVisitor) inputVisitor.style.display = freeMode ? "" : "none";
  if (timeSelect) timeSelect.style.display = freeMode ? "none" : "";
  if (timeInput) timeInput.style.display = freeMode ? "" : "none";
  if (toggle) toggle.checked = freeMode;
}

function toggleFreeMode() {
  const previousGameTime = getGameTime();
  freeMode = document.getElementById("free-mode-toggle").checked;

  // Réinitialiser la sélection des équipes et les lineups: les deux modes
  // ont des structures de données incompatibles (id d'équipe vs nom libre).
  gameStarted = false;
  selectedTeam = "";
  selectedVisitorTeam = "";
  homeLineup = [];
  awayLineup = [];
  homeExtraPasses = [];
  awayExtraPasses = [];
  setInningsCount(getDefaultMaxInnings());

  document.getElementById("team-select").value = "";
  document.getElementById("team-select-visiteur").value = "";
  document.getElementById("team-name-input").value = "";
  document.getElementById("team-name-input-visiteur").value = "";

  applyFreeModeUI();
  setGameTime(previousGameTime);
  updateTeamSelects();
  updateTabLabels();
  updateLineupDisplay();
  updateGameStartUI();
  saveGameState();
}

function updateCustomTeamName(tab, name) {
  if (tab === "home") {
    selectedTeam = name;
  } else {
    selectedVisitorTeam = name;
  }
  updateTabLabels();
  saveGameState();
}

function updateCustomLineupName(index, name) {
  const currentLineup = getCurrentLineup();
  const trimmedName = name.trim();

  if (!trimmedName) {
    currentLineup[index] = null;
  } else {
    const existing = currentLineup[index];
    currentLineup[index] = {
      id: existing?.id ?? -(index + 1),
      name: trimmedName,
      innings:
        existing?.innings ||
        Array.from({ length: maxInnings }, () => createDefaultStats()),
      isCustom: true,
    };
  }

  setCurrentLineup(currentLineup);
}

function slugifyTeamName(name) {
  return (
    (name || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "equipe"
  );
}

// Iterates every recorded at-bat for a player, across both the regular pass
// and the extra (batted-around) pass, and calls back with the stat object.
function forEachPlayerInningStat(player, callback) {
  if (Array.isArray(player?.innings)) {
    player.innings.forEach((stat, inningIndex) =>
      callback(stat, inningIndex),
    );
  }
  if (Array.isArray(player?.innings2)) {
    player.innings2.forEach((stat, inningIndex) =>
      callback(stat, inningIndex),
    );
  }
}

function calculateScore(lineup) {
  if (!Array.isArray(lineup)) return 0;
  return lineup.reduce((total, player) => {
    if (!player) return total;
    let count = 0;
    forEachPlayerInningStat(player, (stat) => {
      if (stat?.bags === "4B") count++;
    });
    return total + count;
  }, 0);
}

function calculateInningPoints(lineup, inningIndex) {
  if (!Array.isArray(lineup)) return 0;
  return lineup.reduce((total, player) => {
    if (!player) return total;
    let count = 0;
    if (player.innings?.[inningIndex]?.bags === "4B") count++;
    if (player.innings2?.[inningIndex]?.bags === "4B") count++;
    return total + count;
  }, 0);
}

// Points/retraits pour un seul passage (normal ou 2e passage) d'une manche.
function getInningPointsForPass(lineup, inningIndex, isExtra) {
  if (!Array.isArray(lineup)) return 0;
  const inningsKey = isExtra ? "innings2" : "innings";
  return lineup.reduce((total, player) => {
    if (player?.[inningsKey]?.[inningIndex]?.bags === "4B") return total + 1;
    return total;
  }, 0);
}

function getInningOutsForPass(lineup, inningIndex, isExtra) {
  if (!Array.isArray(lineup)) return 0;
  const inningsKey = isExtra ? "innings2" : "innings";
  return lineup.reduce((total, player) => {
    if (player?.[inningsKey]?.[inningIndex]?.R) return total + 1;
    return total;
  }, 0);
}

function isInningAutoClosed(lineup, inningIndex, isExtra) {
  const outsReached =
    getInningOutsForPass(lineup, inningIndex, isExtra) >= OUTS_LIMIT;
  // La dernière manche se termine uniquement par les retraits, jamais par la limite de points.
  const isLastInning = inningIndex === maxInnings - 1;
  if (isLastInning) return outsReached;
  return (
    outsReached ||
    getInningPointsForPass(lineup, inningIndex, isExtra) >= inningPointsLimit
  );
}

function getCurrentInningOverrides() {
  return currentTab === "home" ? homeInningOverrides : awayInningOverrides;
}

function setCurrentInningOverrides(newOverrides) {
  if (currentTab === "home") {
    homeInningOverrides = newOverrides;
  } else {
    awayInningOverrides = newOverrides;
  }
  saveGameState();
}

function isInningOverridden(overrides, inningIndex, isExtra) {
  const entry = overrides?.[inningIndex];
  return isExtra ? !!entry?.extra : !!entry?.normal;
}

function isCurrentInningClosed(inningIndex, isExtra) {
  const lineup = getCurrentLineup();
  const overrides = getCurrentInningOverrides();
  return (
    isInningAutoClosed(lineup, inningIndex, isExtra) &&
    !isInningOverridden(overrides, inningIndex, isExtra)
  );
}

// Rouvre/referme manuellement une manche automatiquement fermée (3 retraits ou limite de points).
function toggleInningOverride(inningIndex, isExtra) {
  const overrides = getCurrentInningOverrides().map((entry) => ({
    normal: entry?.normal || false,
    extra: entry?.extra || false,
  }));
  if (!overrides[inningIndex]) {
    overrides[inningIndex] = { normal: false, extra: false };
  }
  if (isExtra) {
    overrides[inningIndex].extra = !overrides[inningIndex].extra;
  } else {
    overrides[inningIndex].normal = !overrides[inningIndex].normal;
  }
  setCurrentInningOverrides(overrides);
  updateLineupDisplay();
}

// Point de départ (index d'alignement) du frappeur qui a commencé ce passage de manche :
// reprend où le passage précédent (2e passage de la même manche, ou manche précédente)
// s'est arrêté, ou l'index 0 pour tout premier passage.
function getPassStartIndex(currentLineup, extraPasses, inningIndex, isExtra) {
  if (isExtra) {
    const normalLastBatter = getLastActiveIndexForInning(
      currentLineup,
      extraPasses,
      inningIndex,
      false,
    );
    return normalLastBatter === -1
      ? 0
      : (normalLastBatter + 1) % DEFAULT_LINEUP_SIZE;
  }

  if (inningIndex <= 0) return 0;

  const prevInningIndex = inningIndex - 1;
  const prevIsExtra = !!extraPasses[prevInningIndex];
  const prevLastBatter = getLastActiveIndexForInning(
    currentLineup,
    extraPasses,
    prevInningIndex,
    prevIsExtra,
  );
  return prevLastBatter === -1
    ? 0
    : (prevLastBatter + 1) % DEFAULT_LINEUP_SIZE;
}

// Dernier frappeur ayant une action enregistrée dans ce passage de manche, en suivant l'ordre
// réel d'alignement à partir du frappeur qui a commencé le passage (l'alignement peut boucler,
// donc on ne peut pas simplement prendre le plus grand index du tableau).
function getLastActiveIndexForInning(
  lineup,
  extraPasses,
  inningIndex,
  isExtra,
) {
  if (!Array.isArray(lineup)) return -1;
  const inningsKey = isExtra ? "innings2" : "innings";
  const size = DEFAULT_LINEUP_SIZE;
  const startIndex = getPassStartIndex(
    lineup,
    extraPasses,
    inningIndex,
    isExtra,
  );

  let lastIndex = -1;
  for (let step = 0; step < size; step++) {
    const idx = (startIndex + step) % size;
    const stat = lineup[idx]?.[inningsKey]?.[inningIndex];
    if (stat && stat.bags && stat.bags !== "field") {
      lastIndex = idx;
    } else {
      break;
    }
  }
  return lastIndex;
}

// Prochain frappeur attendu pour ce passage de manche : continue l'ordre d'alignement à partir
// du dernier frappeur ayant déjà une valeur dans ce passage, ou sinon reprend au point de départ
// du passage (2e passage de la même manche, ou manche précédente).
function getNextBatterIndexForInning(
  currentLineup,
  extraPasses,
  inningIndex,
  isExtra,
) {
  if (isCurrentInningClosed(inningIndex, isExtra)) return -1;

  const lastActiveInThisPass = getLastActiveIndexForInning(
    currentLineup,
    extraPasses,
    inningIndex,
    isExtra,
  );
  if (lastActiveInThisPass !== -1) {
    return (lastActiveInThisPass + 1) % DEFAULT_LINEUP_SIZE;
  }

  return getPassStartIndex(currentLineup, extraPasses, inningIndex, isExtra);
}

function updatePointsLimit() {
  const input = document.getElementById("points-limit-input");
  const value = parseInt(input?.value, 10);
  inningPointsLimit =
    Number.isFinite(value) && value > 0
      ? value
      : DEFAULT_INNING_POINTS_LIMIT;
  if (input) input.value = inningPointsLimit;
  saveGameState();
  updateLineupDisplay();
}

// Regénère les colonnes de manches du tableau de pointage pour correspondre à maxInnings.
function renderScoreTableInningColumns() {
  const headerRow = document.getElementById("score-header-row");
  const awayRow = document.getElementById("away-score-row");
  const homeRow = document.getElementById("home-score-row");
  if (!headerRow || !awayRow || !homeRow) return;

  headerRow
    .querySelectorAll(".inning-col-header")
    .forEach((el) => el.remove());
  const errHeader = document.getElementById("err-total");
  for (let i = 1; i <= maxInnings; i++) {
    const th = document.createElement("th");
    th.className = "inning-col-header";
    th.id = `inning-header-${i}`;
    th.textContent = i.toString();
    headerRow.insertBefore(th, errHeader);
  }

  [
    { row: awayRow, side: "away" },
    { row: homeRow, side: "home" },
  ].forEach(({ row, side }) => {
    row.querySelectorAll(".inning-col").forEach((el) => el.remove());
    const errCell = document.getElementById(`${side}-err-total`);
    for (let i = 1; i <= maxInnings; i++) {
      const td = document.createElement("td");
      td.className = "inning-col";
      td.id = `${side}-inning-${i}`;
      td.textContent = "0";
      row.insertBefore(td, errCell);
    }
  });

  highlightActiveInning();
}

// Nombre de manches par défaut selon le mode (6 en mode libre, 9 en mode équipes).
function getDefaultMaxInnings() {
  return freeMode ? DEFAULT_MAX_INNINGS_FREE : DEFAULT_MAX_INNINGS_TEAM;
}

// Applique un nouveau nombre de manches: régénère le tableau et les états dépendants.
function setInningsCount(count) {
  const parsed = parseInt(count, 10);
  maxInnings =
    Number.isFinite(parsed) && parsed > 0 ? parsed : getDefaultMaxInnings();

  const inningsCountInput = document.getElementById("innings-count-input");
  if (inningsCountInput) inningsCountInput.value = maxInnings;

  renderScoreTableInningColumns();
  homeInningOverrides = createDefaultInningOverrides();
  awayInningOverrides = createDefaultInningOverrides();
}

function updateInningsCount() {
  const input = document.getElementById("innings-count-input");
  setInningsCount(input?.value);
  saveGameState();
  updateLineupDisplay();
  updateScoreDisplay();
}

// Avertit et bascule automatiquement vers l'autre équipe dès qu'une manche vient de se fermer
// (3 retraits ou limite de points atteinte), sans redéclencher si elle était déjà fermée.
function notifyInningClosedIfNeeded(inningIndex, isExtra, wasClosed) {
  if (wasClosed) return;

  const lineup = getCurrentLineup();
  const overrides = getCurrentInningOverrides();
  if (!isInningAutoClosed(lineup, inningIndex, isExtra)) return;
  if (isInningOverridden(overrides, inningIndex, isExtra)) return;

  const outs = getInningOutsForPass(lineup, inningIndex, isExtra);
  const reason =
    outs >= OUTS_LIMIT ? `${OUTS_LIMIT} retraits` : `${inningPointsLimit} points`;
  const inningLabel = `${inningIndex + 1}${isExtra ? " (2e passage)" : ""}`;

  alert(`Manche ${inningLabel} fermée : ${reason} atteint(s).`);
  switchTab(currentTab === "home" ? "away" : "home");
}

// Trouve le passage actif (le premier passage non fermé, dans l'ordre chronologique) : seul ce
// passage doit surligner un "prochain frappeur", les manches suivantes n'ont pas encore commencé.
function findActivePass(extraPasses) {
  for (let j = 0; j < maxInnings; j++) {
    if (!isCurrentInningClosed(j, false)) return { inningIndex: j, isExtra: false };
    if (extraPasses[j] && !isCurrentInningClosed(j, true)) {
      return { inningIndex: j, isExtra: true };
    }
  }
  return null;
}

// Met à jour uniquement les surlignages "dernier frappeur" / "prochain frappeur" sur les
// cellules déjà affichées, sans reconstruire tout le tableau (évite de perdre l'état du DOM).
function refreshInningIndicators() {
  const currentLineup = getCurrentLineup();
  const extraPasses = getCurrentExtraPasses();
  const activePass = findActivePass(extraPasses);

  for (let j = 0; j < maxInnings; j++) {
    [false, true].forEach((isExtra) => {
      if (isExtra && !extraPasses[j]) return;

      const closed = isCurrentInningClosed(j, isExtra);
      const lastBatter = closed
        ? getLastActiveIndexForInning(currentLineup, extraPasses, j, isExtra)
        : -1;
      const isActivePass =
        activePass &&
        activePass.inningIndex === j &&
        activePass.isExtra === isExtra;
      const nextBatter = isActivePass
        ? getNextBatterIndexForInning(currentLineup, extraPasses, j, isExtra)
        : -1;
      const suffix = isExtra ? "-ex" : "";

      for (let i = 0; i < DEFAULT_LINEUP_SIZE; i++) {
        const cell = document.getElementById(`inning-${i}-${j}${suffix}`);
        if (!cell) continue;
        const baseState =
          cell.querySelector("img")?.dataset?.currentBase || "field";

        cell.classList.toggle("inning-last-batter", i === lastBatter);
        cell.classList.toggle(
          "inning-next-batter",
          i === nextBatter && baseState === "field",
        );
      }
    });
  }
}

function countErrors(lineup) {
  if (!Array.isArray(lineup)) return 0;
  return lineup.reduce((total, player) => {
    if (!player) return total;
    let count = 0;
    forEachPlayerInningStat(player, (stat) => {
      if (stat?.ERR) count++;
    });
    return total + count;
  }, 0);
}

function countCC(lineup) {
  if (!Array.isArray(lineup)) return 0;
  return lineup.reduce((total, player) => {
    if (!player) return total;
    let count = 0;
    forEachPlayerInningStat(player, (stat) => {
      if (stat?.CC) count++;
    });
    return total + count;
  }, 0);
}

function getActiveTeamName() {
  return currentTab === "home" ? "Local" : "Visiteur";
}

function countActiveOuts() {
  if (currentPlayerIndex === -1 || currentInningIndex === -1) return 0;
  const currentLineup = getCurrentLineup();
  if (!Array.isArray(currentLineup)) return 0;
  const inningsKey = currentInningIsExtra ? "innings2" : "innings";
  return currentLineup.reduce((total, player) => {
    if (!player || !Array.isArray(player[inningsKey])) return total;
    return player[inningsKey][currentInningIndex]?.R ? total + 1 : total;
  }, 0);
}

function updateActiveInningInfo() {
  const activeInningLabel = document.getElementById("active-inning-label");
  const activeOutLabel = document.getElementById("active-out-label");
  const activeInning =
    currentInningIndex === -1
      ? "N/A"
      : `${currentInningIndex + 1}${currentInningIsExtra ? " (2e passage)" : ""}`;
  const outCount = countActiveOuts();

  if (activeInningLabel)
    activeInningLabel.textContent = `Manche active: ${activeInning}`;
  if (activeOutLabel) activeOutLabel.textContent = `Out (R): ${outCount}`;

  highlightActiveInning();
}

// Surligne dans le tableau de pointage la colonne de la manche en cours, ainsi que la
// cellule de l'équipe correspondant à l'onglet sélectionné (home/away).
function highlightActiveInning() {
  document
    .querySelectorAll(".inning-col-header.active-inning, .inning-col.active-inning")
    .forEach((el) => el.classList.remove("active-inning"));
  document
    .querySelectorAll(".inning-col.active-team-inning")
    .forEach((el) => el.classList.remove("active-team-inning"));

  if (currentInningIndex === -1) return;

  const inningNumber = currentInningIndex + 1;
  const header = document.getElementById(`inning-header-${inningNumber}`);
  const homeCell = document.getElementById(`home-inning-${inningNumber}`);
  const awayCell = document.getElementById(`away-inning-${inningNumber}`);

  if (header) header.classList.add("active-inning");
  if (homeCell) homeCell.classList.add("active-inning");
  if (awayCell) awayCell.classList.add("active-inning");

  const activeCell = currentTab === "home" ? homeCell : awayCell;
  if (activeCell) activeCell.classList.add("active-team-inning");
}

function updateScoreDisplay() {
  const homeTotal = calculateScore(homeLineup);
  const awayTotal = calculateScore(awayLineup);
  const homeErrTotal = countErrors(awayLineup);
  const awayErrTotal = countErrors(homeLineup);
  const homeCCTotal = countCC(homeLineup);
  const awayCCTotal = countCC(awayLineup);

  for (let inning = 1; inning <= maxInnings; inning++) {
    const homeInningCell = document.getElementById(`home-inning-${inning}`);
    const awayInningCell = document.getElementById(`away-inning-${inning}`);
    const homeInningPoints = calculateInningPoints(homeLineup, inning - 1);
    const awayInningPoints = calculateInningPoints(awayLineup, inning - 1);

    if (homeInningCell) homeInningCell.textContent = homeInningPoints;
    if (awayInningCell) awayInningCell.textContent = awayInningPoints;
  }

  const homeScoreElement = document.getElementById("home-score");
  const awayScoreElement = document.getElementById("away-score");
  const homeErrElement = document.getElementById("home-err-total");
  const awayErrElement = document.getElementById("away-err-total");
  const homeCCElement = document.getElementById("home-cc-total");
  const awayCCElement = document.getElementById("away-cc-total");
  const homeTotalElement = document.getElementById("home-total");
  const awayTotalElement = document.getElementById("away-total");

  if (homeScoreElement) homeScoreElement.textContent = homeTotal;
  if (awayScoreElement) awayScoreElement.textContent = awayTotal;
  if (homeErrElement) homeErrElement.textContent = homeErrTotal;
  if (awayErrElement) awayErrElement.textContent = awayErrTotal;
  if (homeCCElement) homeCCElement.textContent = homeCCTotal;
  if (awayCCElement) awayCCElement.textContent = awayCCTotal;
  if (homeTotalElement) homeTotalElement.textContent = homeTotal;
  if (awayTotalElement) awayTotalElement.textContent = awayTotal;
}

async function init() {
  await loadAllPlayers();
  await loadYearPlayers(YEAR);
  await loadTeams(YEAR);
  populateTeamSelect();
  updateTeamSelects(); // Ensure selects are updated initially
  setupDateDefaults();

  // Renseigne d'abord la date/heure/équipes depuis l'URL (lien du calendrier),
  // puis restaure le lineup sauvegardé pour cette partie précise (clé basée
  // sur date/heure/équipes), afin que plusieurs onglets/parties ouverts en
  // même temps ne se marchent pas dessus dans le localStorage.
  applyGameUrlParameters();

  // Doit être appelé après applyGameUrlParameters() pour tenir compte du freeMode
  // (mode libre = 6 manches par défaut) déterminé depuis l'URL (?free=1).
  setInningsCount(getDefaultMaxInnings());

  restoreGameState();

  const pointsLimitInput = document.getElementById("points-limit-input");
  if (pointsLimitInput) pointsLimitInput.value = inningPointsLimit;

  updateLineupDisplay(); // Ajout de cette ligne pour afficher la liste vide au démarrage
  updateRunnerCountDisplay();
  updateGameStartUI();
  refreshMemoryGamesList();
}

function restoreGameState(savedState = loadGameState()) {
  if (!savedState) return;

  // Une partie retrouvée en mémoire a nécessairement été démarrée auparavant.
  gameStarted = true;
  freeMode = savedState.freeMode || false;
  selectedTeam = savedState.selectedTeam;
  selectedVisitorTeam = savedState.selectedVisitorTeam;
  homeLineup = savedState.homeLineup || [];
  awayLineup = savedState.awayLineup || [];
  homeExtraPasses = savedState.homeExtraPasses || [];
  awayExtraPasses = savedState.awayExtraPasses || [];
  inningPointsLimit =
    savedState.inningPointsLimit || DEFAULT_INNING_POINTS_LIMIT;
  setInningsCount(savedState.maxInnings || getDefaultMaxInnings());
  homeInningOverrides =
    savedState.homeInningOverrides || createDefaultInningOverrides();
  awayInningOverrides =
    savedState.awayInningOverrides || createDefaultInningOverrides();
  homeRunnerCount = savedState.homeRunnerCount || 0;
  awayRunnerCount = savedState.awayRunnerCount || 0;
  currentTab = savedState.currentTab || "away";
  currentPlayerIndex = savedState.currentPlayerIndex || -1;
  currentInningIndex = savedState.currentInningIndex || -1;

  // Restore form values
  if (savedState.gameDate) {
    document.getElementById("game-date").value = savedState.gameDate;
  }
  if (savedState.gameTime) {
    setGameTime(savedState.gameTime);
  }

  applyFreeModeUI();

  if (freeMode) {
    document.getElementById("team-name-input").value =
      savedState.selectedTeam || "";
    document.getElementById("team-name-input-visiteur").value =
      savedState.selectedVisitorTeam || "";
  } else {
    if (savedState.selectedTeam) {
      document.getElementById("team-select").value = savedState.selectedTeam;
    }
    if (savedState.selectedVisitorTeam) {
      document.getElementById("team-select-visiteur").value =
        savedState.selectedVisitorTeam;
    }
  }

  updateTeamSelects();
  updateTabLabels();
  document
    .querySelectorAll(".tab-button")
    .forEach((btn) => btn.classList.remove("active"));
  const activeButton = document.querySelector(
    `.tab-button[onclick="switchTab('${currentTab}')"]`,
  );
  if (activeButton) activeButton.classList.add("active");
  updateGameStartUI();
}

function setupDateDefaults() {
  const today = new Date();
  const dateInput = document.getElementById("game-date");
  dateInput.value = today.toISOString().split("T")[0];
}

async function loadYearPlayers(year) {
  const response = await fetch(
    `http://127.0.0.1:5000/load?filename=${year}/players_${year}.json`,
  );
  if (!response.ok) {
    console.error(`Erreur chargement players_${year}.json`);
    return;
  }
  const data = await response.json();
  yearPlayers = data.players.filter((player) => player.id !== 0); // Remove player with id 0
}

async function loadAllPlayers() {
  const response = await fetch(
    "http://127.0.0.1:5000/load?filename=players.json",
  );
  if (!response.ok) {
    console.error("Erreur chargement players.json");
    return;
  }
  const data = await response.json();
  players = data.players;
}

async function loadTeams(year) {
  const response = await fetch(
    `http://127.0.0.1:5000/load?filename=${year}/season_${year}.json`,
  );
  if (!response.ok) {
    console.error(`Erreur chargement season_${year}.json`);
    return;
  }
  const data = await response.json();
  teams = data.teams;
}

function populateTeamSelect() {
  const selectLocal = document.getElementById("team-select");
  const selectVisitor = document.getElementById("team-select-visiteur");

  selectLocal.innerHTML = '<option value="">Sélectionner une équipe</option>';
  selectVisitor.innerHTML = '<option value="">Sélectionner une équipe</option>';

  teams.forEach((team) => {
    // Local select
    const optionLocal = document.createElement("option");
    optionLocal.value = team.name;
    optionLocal.textContent = formatTeamName(team.name);
    selectLocal.appendChild(optionLocal);

    // Visitor select
    const optionVisitor = document.createElement("option");
    optionVisitor.value = team.name;
    optionVisitor.textContent = formatTeamName(team.name);
    selectVisitor.appendChild(optionVisitor);
  });
}

function formatTeamName(name) {
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function updateTabLabels() {
  const awayButton = document.getElementById("tab-button-away");
  const homeButton = document.getElementById("tab-button-home");

  if (awayButton) {
    const awayName = freeMode
      ? selectedVisitorTeam
      : formatTeamName(selectedVisitorTeam || "");
    awayButton.textContent = selectedVisitorTeam
      ? `Visiteur (${awayName})`
      : "Visiteur";
  }

  if (homeButton) {
    const homeName = freeMode
      ? selectedTeam
      : formatTeamName(selectedTeam || "");
    homeButton.textContent = selectedTeam ? `Local (${homeName})` : "Local";
  }
}

function loadTeamPlayers() {
  const previousSelectedTeam = selectedTeam;
  selectedTeam = document.getElementById("team-select").value;
  selectedVisitorTeam = document.getElementById("team-select-visiteur").value;

  // If local team changed and visitor was the same, reset visitor
  if (
    selectedTeam !== previousSelectedTeam &&
    selectedVisitorTeam === previousSelectedTeam
  ) {
    document.getElementById("team-select-visiteur").value = "";
    selectedVisitorTeam = "";
  }

  // Ensure visitor is different from local
  if (selectedTeam && selectedVisitorTeam === selectedTeam) {
    alert("L'équipe visiteur ne peut pas être la même que l'équipe locale.");
    document.getElementById("team-select-visiteur").value = "";
    selectedVisitorTeam = "";
    return;
  }

  // Update dropdowns to exclude selected teams
  updateTeamSelects();

  // Reset lineups when teams change
  homeLineup = [];
  awayLineup = [];
  homeExtraPasses = [];
  awayExtraPasses = [];
  homeInningOverrides = createDefaultInningOverrides();
  awayInningOverrides = createDefaultInningOverrides();
  updateTabLabels();
  updateLineupDisplay();
  saveGameState();
}

function updateTeamSelects() {
  const selectLocal = document.getElementById("team-select");
  const selectVisitor = document.getElementById("team-select-visiteur");

  // Update local select: include all except selectedVisitorTeam
  selectLocal.innerHTML = '<option value="">Sélectionner une équipe</option>';
  teams.forEach((team) => {
    if (team.name !== selectedVisitorTeam) {
      const option = document.createElement("option");
      option.value = team.name;
      option.textContent = formatTeamName(team.name);
      if (team.name === selectedTeam) {
        option.selected = true;
      }
      selectLocal.appendChild(option);
    }
  });

  // Update visitor select: include all except selectedTeam
  selectVisitor.innerHTML = '<option value="">Sélectionner une équipe</option>';
  teams.forEach((team) => {
    if (team.name !== selectedTeam) {
      const option = document.createElement("option");
      option.value = team.name;
      option.textContent = formatTeamName(team.name);
      if (team.name === selectedVisitorTeam) {
        option.selected = true;
      }
      selectVisitor.appendChild(option);
    }
  });
}

function getCurrentLineup() {
  return currentTab === "home" ? homeLineup : awayLineup;
}

function setCurrentLineup(newLineup) {
  if (currentTab === "home") {
    homeLineup = newLineup;
  } else {
    awayLineup = newLineup;
  }
  saveGameState();
  updateScoreDisplay();
}

function getCurrentExtraPasses() {
  return currentTab === "home" ? homeExtraPasses : awayExtraPasses;
}

function setCurrentExtraPasses(newExtraPasses) {
  if (currentTab === "home") {
    homeExtraPasses = newExtraPasses;
  } else {
    awayExtraPasses = newExtraPasses;
  }
  saveGameState();
}

function toggleExtraPass(inningIndex) {
  const extraPasses = getCurrentExtraPasses().slice();
  extraPasses[inningIndex] = !extraPasses[inningIndex];
  setCurrentExtraPasses(extraPasses);
  updateLineupDisplay();
}

function getCurrentTeam() {
  return currentTab === "home" ? selectedTeam : selectedVisitorTeam;
}

function switchTab(tab) {
  currentTab = tab;
  // Update tab buttons
  document
    .querySelectorAll(".tab-button")
    .forEach((btn) => btn.classList.remove("active"));
  document
    .querySelector(`.tab-button[onclick="switchTab('${tab}')"]`)
    .classList.add("active");
  saveGameState();
  updateLineupDisplay();
  updateActiveInningInfo();
}
function getAvailablePlayers(currentPlayerId) {
  const team = teams.find((t) => t.name === getCurrentTeam());
  if (!team) return [];

  // Retourne les joueurs qui ne sont pas dans le lineup
  // ou qui sont le joueur actuellement sélectionné à cette position
  const currentLineup = getCurrentLineup();
  return team.players.filter((playerId) => {
    const isPlayerInLineup = currentLineup.some(
      (player) => player && player.id === playerId,
    );
    return !isPlayerInLineup || playerId === currentPlayerId;
  });
}

function getSubstitutePlayers(currentPlayerId) {
  const currentTeam = teams.find((t) => t.name === getCurrentTeam());
  const teamPlayerIds = currentTeam ? new Set(currentTeam.players) : new Set();

  const substitutePlayers = yearPlayers
    .filter((player) => !teamPlayerIds.has(player.id))
    .map((player) => player.id);

  // Filtrer les joueurs déjà dans le lineup
  const currentLineup = getCurrentLineup();
  return substitutePlayers.filter((playerId) => {
    const isPlayerInLineup = currentLineup.some(
      (player) => player && player.id === playerId,
    );
    return !isPlayerInLineup || playerId === currentPlayerId;
  });
}

function updateLineupDisplay() {
  const container = document.getElementById("lineup-container");
  container.innerHTML = "";

  const currentLineup = getCurrentLineup();

  // Créer l'en-tête des manches
  const extraPasses = getCurrentExtraPasses();

  // Précalculer l'état (fermée/dernier frappeur) de chaque manche pour l'équipe active.
  const normalClosedByInning = [];
  const normalLastBatterByInning = [];
  const extraClosedByInning = [];
  const extraLastBatterByInning = [];
  for (let j = 0; j < maxInnings; j++) {
    const normalClosed = isCurrentInningClosed(j, false);
    normalClosedByInning[j] = normalClosed;
    normalLastBatterByInning[j] = normalClosed
      ? getLastActiveIndexForInning(currentLineup, extraPasses, j, false)
      : -1;

    const extraClosed = isCurrentInningClosed(j, true);
    extraClosedByInning[j] = extraClosed;
    extraLastBatterByInning[j] = extraClosed
      ? getLastActiveIndexForInning(currentLineup, extraPasses, j, true)
      : -1;
  }

  // Prochain frappeur attendu : uniquement pour le passage actif (le premier non fermé), les
  // manches suivantes n'affichent pas de surlignage tant que leur tour n'est pas arrivé.
  const activePass = findActivePass(extraPasses);
  const normalNextBatterByInning = Array.from({ length: maxInnings }, (_, j) =>
    activePass && activePass.inningIndex === j && !activePass.isExtra
      ? getNextBatterIndexForInning(currentLineup, extraPasses, j, false)
      : -1,
  );
  const extraNextBatterByInning = Array.from({ length: maxInnings }, (_, j) =>
    activePass && activePass.inningIndex === j && activePass.isExtra
      ? getNextBatterIndexForInning(currentLineup, extraPasses, j, true)
      : -1,
  );

  const headerRow = document.createElement("div");
  headerRow.className = "lineup-header";
  headerRow.innerHTML = `
                <div class="player-info">Joueur</div>
                ${Array.from({ length: maxInnings }, (_, i) => {
                  const isExtra = !!extraPasses[i];
                  const toggleTitle = isExtra
                    ? "Retirer le 2e passage de cette manche"
                    : "Ajouter un 2e passage (l'alignement a fait le tour)";
                  const normalClosed = normalClosedByInning[i];
                  const normalAutoClosed = isInningAutoClosed(
                    currentLineup,
                    i,
                    false,
                  );
                  let html = `<div class="inning-header${normalClosed ? " inning-header-closed" : ""}">${i + 1}<button type="button" class="extra-pass-toggle" onclick="toggleExtraPass(${i})" title="${toggleTitle}">${isExtra ? "\u2212" : "+"}</button>`;
                  if (normalAutoClosed) {
                    const lockTitle = normalClosed
                      ? "Réactiver cette manche"
                      : "Refermer cette manche";
                    html += `<button type="button" class="inning-lock-toggle" onclick="toggleInningOverride(${i}, false)" title="${lockTitle}">${normalClosed ? "\u{1F513}" : "\u{1F512}"}</button>`;
                  }
                  html += `</div>`;
                  if (isExtra) {
                    const extraClosed = extraClosedByInning[i];
                    const extraAutoClosed = isInningAutoClosed(
                      currentLineup,
                      i,
                      true,
                    );
                    html += `<div class="inning-header inning-header-extra${extraClosed ? " inning-header-closed" : ""}">${i + 1} (2)`;
                    if (extraAutoClosed) {
                      const lockTitle = extraClosed
                        ? "Réactiver cette manche"
                        : "Refermer cette manche";
                      html += `<button type="button" class="inning-lock-toggle" onclick="toggleInningOverride(${i}, true)" title="${lockTitle}">${extraClosed ? "\u{1F513}" : "\u{1F512}"}</button>`;
                    }
                    html += `</div>`;
                  }
                  return html;
                }).join("")}
        `;
  container.appendChild(headerRow);

  const rowsWrapper = document.createElement("div");
  rowsWrapper.className = "lineup-rows";

  // Créer les 11 lignes de joueurs
  for (let i = 0; i < DEFAULT_LINEUP_SIZE; i++) {
    const row = document.createElement("div");
    row.className = "lineup-row";

    // Section sélection du joueur
    const playerSection = document.createElement("div");
    playerSection.className = "player-section";

    // Ajouter le span de position
    const positionSpan = document.createElement("span");
    positionSpan.className = "player-position";
    positionSpan.textContent = `${i + 1} - `;
    playerSection.appendChild(positionSpan);

    if (freeMode) {
      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.id = `player-${i}`;
      nameInput.className = "player-name-input";
      nameInput.placeholder = "Nom du joueur";
      nameInput.value = currentLineup[i]?.name || "";
      nameInput.oninput = (e) => updateCustomLineupName(i, e.target.value);

      playerSection.appendChild(nameInput);
    } else {
      const select = document.createElement("select");
      select.id = `player-${i}`;
      select.onchange = (e) => updateLineupSpot(i, parseInt(e.target.value));
      select.innerHTML = `<option value="">Sélectionner un joueur</option>`;

      const isSubstitute = currentLineup[i]?.isSubstitute || false;
      const availablePlayers = isSubstitute
        ? getSubstitutePlayers(currentLineup[i]?.id)
        : getAvailablePlayers(currentLineup[i]?.id);

      availablePlayers.forEach((playerId) => {
        const player = players.find((p) => p.id === playerId);
        if (player) {
          select.innerHTML += `
                                        <option value="${player.id}" 
                                                        ${
                                                          currentLineup[i]
                                                            ?.id === player.id
                                                            ? "selected"
                                                            : ""
                                                        }>
                                                ${player.name}
                                        </option>`;
        }
      });

      if (currentLineup[i]?.id) {
        select.value = currentLineup[i].id;
      }

      const subCheckbox = document.createElement("input");
      subCheckbox.type = "checkbox";
      subCheckbox.id = `sub-${i}`;
      subCheckbox.className = "sub-checkbox";
      subCheckbox.onchange = () => updatePlayerOptions(i);

      playerSection.appendChild(select);
      playerSection.appendChild(subCheckbox);
      playerSection.appendChild(document.createTextNode("Sub"));
    }

    row.appendChild(playerSection);

    // Pour chaque manche (1-9), avec un 2e passage optionnel si le lineup a fait le tour
    for (let j = 0; j < maxInnings; j++) {
      row.appendChild(
        buildInningContainer(
          currentLineup,
          i,
          j,
          false,
          normalClosedByInning[j],
          i === normalLastBatterByInning[j],
          i === normalNextBatterByInning[j],
        ),
      );
      if (extraPasses[j]) {
        row.appendChild(
          buildInningContainer(
            currentLineup,
            i,
            j,
            true,
            extraClosedByInning[j],
            i === extraLastBatterByInning[j],
            i === extraNextBatterByInning[j],
          ),
        );
      }
    }

    rowsWrapper.appendChild(row);
  }

  container.appendChild(rowsWrapper);
  updateScoreDisplay();
  updateActiveInningInfo();
}

function buildInningContainer(
  currentLineup,
  playerIndex,
  inningIndex,
  isExtra,
  closed = false,
  isLastBatter = false,
  isNextBatter = false,
) {
  const inningsKey = isExtra ? "innings2" : "innings";
  const suffix = isExtra ? "-ex" : "";

  const inningContainer = document.createElement("div");
  inningContainer.className = "inning-container";
  if (closed) inningContainer.classList.add("inning-container-closed");

  // Ajouter les boutons de stats
  const statsContainer = document.createElement("div");
  statsContainer.className = "stats-container";

  // Ajouter l'image de base
  const cell = document.createElement("div");
  cell.className = "inning-cell";
  cell.id = `inning-${playerIndex}-${inningIndex}${suffix}`;

  const playerStats =
    currentLineup[playerIndex]?.[inningsKey]?.[inningIndex] ||
    createDefaultStats();
  const baseState = playerStats.bags || "field";
  if (
    playerIndex === currentPlayerIndex &&
    inningIndex === currentInningIndex &&
    isExtra === currentInningIsExtra
  ) {
    cell.classList.add("selected");
  }
  if (isLastBatter) {
    cell.classList.add("inning-last-batter");
    cell.title = "Manche terminée à ce frappeur";
  }
  if (isNextBatter && baseState === "field") {
    cell.classList.add("inning-next-batter");
    cell.title = "Prochain frappeur";
  }
  if (ON_BASE_STATES.includes(baseState)) {
    cell.classList.add("on-base");
  }

  const img = document.createElement("img");
  img.src = `../img/${baseState}.png`;
  img.className = "base-image";
  img.dataset.currentBase = baseState;
  img.onclick = closed
    ? null
    : () => {
        const wasClosed = isCurrentInningClosed(inningIndex, isExtra);
        selectPlayerInning(playerIndex, inningIndex, isExtra);
        rotateBase(img);
        updateStatsForCurrentPlayer();
        // Fait avancer le highlight du prochain frappeur sans reconstruire tout le tableau.
        refreshInningIndicators();
        notifyInningClosedIfNeeded(inningIndex, isExtra, wasClosed);
      };
  if (closed) img.classList.add("inning-control-disabled");

  cell.appendChild(img);

  STATS_OPTIONS.forEach((stat) => {
    const statButton = document.createElement("button");
    statButton.className = "stat-button";
    statButton.textContent = stat;
    statButton.dataset.stat = stat;
    const statKey = statMap[statButton.textContent];
    const currentBase = img.dataset.currentBase;
    if (statKey && playerStats[statKey] && currentBase !== "field") {
      statButton.classList.add("active");
    }
    statButton.disabled = currentBase === "field" || closed;
    statButton.onclick = () =>
      toggleStatForInning(playerIndex, inningIndex, stat, isExtra);
    statsContainer.appendChild(statButton);
  });

  // Modify the R button to also be disabled when base is field
  const rButton = document.createElement("button");
  rButton.className = "stat-button";
  rButton.textContent = "R";
  const currentBase = img.dataset.currentBase;
  if (playerStats.R && currentBase !== "field") {
    rButton.classList.add("active");
  }
  rButton.disabled = currentBase === "field" || closed;
  rButton.onclick = () => toggleRForInning(playerIndex, inningIndex, isExtra);
  statsContainer.appendChild(rButton);

  inningContainer.appendChild(statsContainer);
  inningContainer.appendChild(cell);
  inningContainer.appendChild(rButton);
  return inningContainer;
}

function toggleStatForInning(playerIndex, inningIndex, stat, isExtra = false) {
  selectPlayerInning(playerIndex, inningIndex, isExtra);
  const inningsKey = isExtra ? "innings2" : "innings";
  // Désactiver tous les boutons de stats pour cette manche
  const cell = document.getElementById(
    `inning-${playerIndex}-${inningIndex}${isExtra ? "-ex" : ""}`,
  );
  const inning_container = cell.closest(".inning-container");
  inning_container.querySelectorAll(".stat-button").forEach((button) => {
    button.classList.remove("active");
  });

  // Si on clique sur le même stat, le désactiver
  const statKey = statMap[stat];
  const currentLineup = getCurrentLineup();
  if (!currentLineup[playerIndex]) {
    currentLineup[playerIndex] = {
      innings: Array.from({ length: maxInnings }, () => createDefaultStats()),
    };
  }
  if (!currentLineup[playerIndex][inningsKey]) {
    currentLineup[playerIndex][inningsKey] = Array.from(
      { length: maxInnings },
      () => createDefaultStats(),
    );
  }
  if (!currentLineup[playerIndex][inningsKey][inningIndex]) {
    currentLineup[playerIndex][inningsKey][inningIndex] = createDefaultStats();
  }

  if (currentLineup[playerIndex][inningsKey][inningIndex][statKey]) {
    currentLineup[playerIndex][inningsKey][inningIndex][statKey] = false;
    if (CS_STATS.includes(stat)) {
      currentLineup[playerIndex][inningsKey][inningIndex].CS = false;
    }
  } else {
    // Sinon, activer le nouveau stat
    Object.values(statMap).forEach((key) => {
      currentLineup[playerIndex][inningsKey][inningIndex][key] =
        key === statKey ? true : false;
    });

    if (CS_STATS.includes(stat))
      currentLineup[playerIndex][inningsKey][inningIndex].CS = true;
    else currentLineup[playerIndex][inningsKey][inningIndex].CS = false;

    inning_container
      .querySelector(`[data-stat="${stat}"]`)
      .classList.add("active");
  }
  setCurrentLineup(currentLineup);
  updateActiveInningInfo();
}

function toggleRForInning(playerIndex, inningIndex, isExtra = false) {
  selectPlayerInning(playerIndex, inningIndex, isExtra);
  const wasClosed = isCurrentInningClosed(inningIndex, isExtra);
  const inningsKey = isExtra ? "innings2" : "innings";
  const currentLineup = getCurrentLineup();
  if (!currentLineup[playerIndex]) {
    currentLineup[playerIndex] = {
      innings: Array.from({ length: maxInnings }, () => createDefaultStats()),
    };
  }
  if (!currentLineup[playerIndex][inningsKey]) {
    currentLineup[playerIndex][inningsKey] = Array.from(
      { length: maxInnings },
      () => createDefaultStats(),
    );
  }
  if (!currentLineup[playerIndex][inningsKey][inningIndex]) {
    currentLineup[playerIndex][inningsKey][inningIndex] = createDefaultStats();
  }

  const currentValue = currentLineup[playerIndex][inningsKey][inningIndex].R;
  currentLineup[playerIndex][inningsKey][inningIndex].R = !currentValue;

  setCurrentLineup(currentLineup);

  // Update visual
  const cell = document.getElementById(
    `inning-${playerIndex}-${inningIndex}${isExtra ? "-ex" : ""}`,
  );
  const inning_container = cell.closest(".inning-container");
  const rButton = Array.from(
    inning_container.querySelectorAll(".stat-button"),
  ).find((btn) => btn.textContent === "R");
  rButton.classList.toggle("active");
  updateActiveInningInfo();
  console.log("Refresh inning indicators after toggling R");
  refreshInningIndicators();
  notifyInningClosedIfNeeded(inningIndex, isExtra, wasClosed);
}

function getKeyByValue(object, value) {
  return Object.keys(object).find((key) => object[key] === value);
}

function rotateBase(imgElement) {
  const currentBase = imgElement.dataset.currentBase;
  const currentIndex = BASES_ORDER.indexOf(currentBase);
  const nextIndex = (currentIndex + 1) % BASES_ORDER.length;
  const nextBase = BASES_ORDER[nextIndex];

  imgElement.src = `../img/${nextBase}.png`;
  imgElement.dataset.currentBase = nextBase;

  // Get the stats container for this cell and update button states
  const cell = imgElement.closest(".inning-cell");
  cell.classList.toggle("on-base", ON_BASE_STATES.includes(nextBase));
  const statsContainer = cell.parentElement.querySelector(".stats-container");
  const buttons = statsContainer.querySelectorAll(".stat-button");
  const rbutton = cell.parentElement.querySelector(":scope > .stat-button");

  rbutton.disabled = nextBase === "field";
  buttons.forEach((button) => {
    button.disabled = nextBase === "field";
  });
}

function updateStatsForCurrentPlayer() {
  if (currentPlayerIndex === -1 || currentInningIndex === -1) return;

  const currentLineup = getCurrentLineup();
  if (!currentLineup[currentPlayerIndex]) return;

  const inningsKey = currentInningIsExtra ? "innings2" : "innings";
  if (!currentLineup[currentPlayerIndex][inningsKey]) {
    currentLineup[currentPlayerIndex][inningsKey] = [];
  }

  const cell = document.querySelector(
    `#inning-${currentPlayerIndex}-${currentInningIndex}${currentInningIsExtra ? "-ex" : ""} img`,
  );
  const currentBase = cell?.dataset?.currentBase || "field";

  if (currentBase === "field") {
    currentLineup[currentPlayerIndex][inningsKey][currentInningIndex] =
      createDefaultStats();
  } else {
    if (!currentLineup[currentPlayerIndex][inningsKey][currentInningIndex]) {
      currentLineup[currentPlayerIndex][inningsKey][currentInningIndex] =
        createDefaultStats();
    }
    currentLineup[currentPlayerIndex][inningsKey][currentInningIndex].bags =
      currentBase;
  }

  setCurrentLineup(currentLineup);
}

function selectPlayerInning(playerIndex, inningIndex, isExtra = false) {
  // Désélectionner toute autre cellule active
  document
    .querySelectorAll(".inning-cell")
    .forEach((cell) => cell.classList.remove("selected"));

  // Sélectionner la cellule courante
  const cell = document.getElementById(
    `inning-${playerIndex}-${inningIndex}${isExtra ? "-ex" : ""}`,
  );
  if (cell) {
    cell.classList.add("selected");
  }

  // Mettre à jour les stats pour cette cellule
  currentPlayerIndex = playerIndex;
  currentInningIndex = inningIndex;
  currentInningIsExtra = isExtra;
  updateActiveInningInfo();
}

function getPlayerStats(playerId) {
  const player = players.find((p) => p.id === playerId);
  return player ? player.stats : null;
}

function updatePlayerOptions(index) {
  console.log(`Updating player options for index: ${index}`);
  const select = document.getElementById(`player-${index}`);
  const subCheckbox = document.getElementById(`sub-${index}`);
  const isSubstitute = subCheckbox.checked;

  const currentLineup = getCurrentLineup();
  // Réinitialiser la sélection et retirer le joueur du lineup
  select.value = "";
  if (currentLineup[index]) {
    currentLineup[index] = null;
  }
  setCurrentLineup(currentLineup);

  // Mettre à jour les options disponibles
  select.innerHTML = `<option value="">Sélectionner un joueur</option>`;

  const availablePlayers = isSubstitute
    ? getSubstitutePlayers()
    : getAvailablePlayers();

  availablePlayers.forEach((playerId) => {
    const player = players.find((p) => p.id === playerId);
    if (player) {
      const option = document.createElement("option");
      option.value = player.id;
      option.textContent = `${player.name}`;
      select.appendChild(option);
    }
  });

  // Mettre à jour tous les autres menus déroulants
  updateAllPlayerLists();
}

function updateLineupSpot(index, playerId) {
  console.log(`Updating lineup spot ${index} with player ID: ${playerId}`);
  const select = document.getElementById(`player-${index}`);
  const currentLineup = getCurrentLineup();

  if (!playerId) {
    currentLineup[index] = null;
    select.value = ""; // Mettre à jour la valeur du select
  } else {
    const player = players.find((p) => p.id === playerId);
    if (player) {
      currentLineup[index] = {
        id: player.id,
        name: player.name,
        innings: Array.from({ length: maxInnings }, () =>
          createDefaultStats(),
        ),
        isSubstitute: document.getElementById(`sub-${index}`)?.checked || false,
      };
      select.value = player.id; // Mettre à jour la valeur du select
    }
  }

  setCurrentLineup(currentLineup);
  // Mettre à jour tous les autres menus déroulants pour refléter la nouvelle sélection
  updateAllPlayerLists();
}

function updateAllPlayerLists() {
  console.log("Updating all player lists");
  const currentLineup = getCurrentLineup();
  for (let i = 0; i < DEFAULT_LINEUP_SIZE; i++) {
    const select = document.getElementById(`player-${i}`);
    const currentValue = select.value;
    const isSubstitute = document.getElementById(`sub-${i}`)?.checked || false;

    // Sauvegarder la valeur actuelle et recréer les options
    const currentPlayerId = currentLineup[i]?.id;
    const availablePlayers = isSubstitute
      ? getSubstitutePlayers(currentPlayerId)
      : getAvailablePlayers(currentPlayerId);
    select.innerHTML = `<option value="">Sélectionner un joueur</option>`;

    // Ajouter les options des joueurs
    availablePlayers.forEach((playerId) => {
      const player = players.find((p) => p.id === playerId);
      if (player) {
        const option = document.createElement("option");
        option.value = player.id;
        option.textContent = `${player.name}`;
        select.appendChild(option);
      }
    });

    // Restaurer la valeur sélectionnée
    if (currentValue) {
      select.value = currentValue;
    }
  }
}

function toggleBase(base) {
  if (currentBases.has(base)) {
    currentBases.delete(base);
  } else {
    currentBases.add(base);
  }
  updateBaseVisuals();
}

function toggleStat(stat) {
  if (currentStats.has(stat)) {
    currentStats.delete(stat);
  } else {
    currentStats.add(stat);
  }
  updateStatVisuals();
}

function updateBaseVisuals() {
  document.querySelectorAll(".base").forEach((base) => {
    base.classList.remove("active");
  });

  currentBases.forEach((base) => {
    const baseElement = getBaseElement(base);
    if (baseElement) baseElement.classList.add("active");
  });
}

function updateStatVisuals() {
  document.querySelectorAll(".stat-button").forEach((button) => {
    const stat = button.textContent;
    button.classList.toggle("active", currentStats.has(stat));
  });
}

function addPlayerToLineup() {
  const playerId = parseInt(document.getElementById("player-select").value);
  if (!playerId) return;

  const player = players.find((p) => p.id === playerId);
  const currentLineup = getCurrentLineup();
  if (player && !currentLineup.find((p) => p.id === playerId)) {
    currentLineup.push({
      id: player.id,
      name: player.name,
    });
    setCurrentLineup(currentLineup);
    updateLineupDisplay();
  }
}

function createDefaultStats() {
  return {
    bags: "field",
    CS: false,
    R: false,
    S: false,
    double: false,
    triple: false,
    CC: false,
    BB: false,
    OPT: false,
    ERR: false,
    SAC: false,
    PP: 0,
  };
}

function generatePlayerOptions(currentSpot) {
  const team = teams.find((t) => t.name === selectedTeam);
  if (!team) return "";

  const currentLineup = getCurrentLineup();
  return team.players
    .filter((playerId) => {
      // Un joueur est disponible s'il n'est pas déjà dans le lineup
      // ou s'il est le joueur actuellement sélectionné à cette position
      return !currentLineup.some(
        (player, index) =>
          player && player.id === playerId && index !== currentSpot,
      );
    })
    .map((playerId) => {
      const player = players.find((p) => p.id === playerId);
      if (!player) return "";
      return `<option value="${player.id}">${player.name}</option>`;
    })
    .join("");
}

function removeFromLineup(index) {
  const currentLineup = getCurrentLineup();
  const newLineup = currentLineup.filter((_, i) => i !== index);
  setCurrentLineup(newLineup);
  updateLineupDisplay();
}

function buildGameData(lineup, includeNames = false, extraPasses = []) {
  const cleanLineup = Array.isArray(lineup)
    ? lineup.filter((player) => player !== null)
    : [];

  const innings = [];

  for (let inning = 0; inning < maxInnings; inning++) {
    const hitters = [];
    let hasValidStats = false;

    cleanLineup.forEach((player) => {
      const stats = player.innings?.[inning] || createDefaultStats();

      if (stats.bags !== "field") {
        hitters.push({ ...stats, id: player.id });
        hasValidStats = true;
      }
    });

    if (hasValidStats) {
      innings.push({
        value: (inning + 1).toString(),
        hitters: hitters,
      });
    }

    // Second at-bat column for innings where the lineup batted around.
    if (extraPasses[inning]) {
      const extraHitters = [];
      let hasExtraStats = false;

      cleanLineup.forEach((player) => {
        const stats = player.innings2?.[inning] || createDefaultStats();

        if (stats.bags !== "field") {
          extraHitters.push({ ...stats, id: player.id });
          hasExtraStats = true;
        }
      });

      if (hasExtraStats) {
        innings.push({
          value: (inning + 1).toString(),
          pass: 2,
          hitters: extraHitters,
        });
      }
    }
  }

  const gameData = {
    lineup: cleanLineup.map((player) => player.id),
    innings: innings,
  };

  if (includeNames) {
    gameData.players = {};
    cleanLineup.forEach((player) => {
      gameData.players[player.id] = player.name;
    });
  }

  return gameData;
}

function generateJson(lineup = getCurrentLineup()) {
  const gameData = buildGameData(lineup, freeMode, getCurrentExtraPasses());
  const jsonOutput = JSON.stringify(gameData, null, 2);
  document.getElementById("output").textContent = jsonOutput;
  return jsonOutput;
}

async function saveJson() {
  const gameDate = document.getElementById("game-date").value;
  const gameTime = getGameTime();
  if (!gameDate || !gameTime) {
    alert("Veuillez sélectionner une date et une heure de match.");
    return;
  }

  const saves = [];

  if (selectedTeam) {
    const teamFolder = freeMode
      ? `custom/${slugifyTeamName(selectedTeam)}`
      : selectedTeam;
    const filename = `../data/${YEAR}/${teamFolder}/${gameDate}_${gameTime}.json`;
    const gameData = buildGameData(homeLineup, freeMode, homeExtraPasses);
    if (freeMode) gameData.team = selectedTeam;
    const data = JSON.stringify(gameData, null, 2);
    saves.push({ filename, data, team: "Local" });
  }

  if (selectedVisitorTeam) {
    const teamFolder = freeMode
      ? `custom/${slugifyTeamName(selectedVisitorTeam)}`
      : selectedVisitorTeam;
    const filename = `../data/${YEAR}/${teamFolder}/${gameDate}_${gameTime}.json`;
    const gameData = buildGameData(awayLineup, freeMode, awayExtraPasses);
    if (freeMode) gameData.team = selectedVisitorTeam;
    const data = JSON.stringify(gameData, null, 2);
    saves.push({ filename, data, team: "Visiteur" });
  }

  if (saves.length === 0) {
    alert("Veuillez sélectionner au moins une équipe avant de sauvegarder.");
    return;
  }

  try {
    const results = await Promise.all(
      saves.map(async ({ filename, data, team }) => {
        const response = await fetch(
          `http://127.0.0.1:5000/save?filename=${filename}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: data,
          },
        );
        const result = await response.json();
        return `${team}: ${result.message}`;
      }),
    );
    alert(results.join("\n"));
  } catch (error) {
    alert("Erreur lors de la sauvegarde: " + error);
  }
}

function buildLineupFromGameData(data, teamName) {
  const ids = Array.isArray(data?.lineup) ? data.lineup : [];
  const nameMap = data?.players || {};
  const team = teams.find((t) => t.name === teamName);
  const teamPlayerIds = team ? new Set(team.players) : new Set();

  return ids.map((id) => {
    const innings = Array.from({ length: maxInnings }, (_, inningIndex) => {
      const inning = Array.isArray(data?.innings)
        ? data.innings.find(
            (inn) =>
              inn.value === (inningIndex + 1).toString() && inn.pass !== 2,
          )
        : null;
      const hitter = inning?.hitters?.find((h) => h.id === id);
      if (!hitter) return createDefaultStats();
      const { id: _hitterId, ...stats } = hitter;
      return { ...createDefaultStats(), ...stats };
    });

    const innings2 = Array.from({ length: maxInnings }, (_, inningIndex) => {
      const inning = Array.isArray(data?.innings)
        ? data.innings.find(
            (inn) =>
              inn.value === (inningIndex + 1).toString() && inn.pass === 2,
          )
        : null;
      const hitter = inning?.hitters?.find((h) => h.id === id);
      if (!hitter) return createDefaultStats();
      const { id: _hitterId, ...stats } = hitter;
      return { ...createDefaultStats(), ...stats };
    });

    const lineupPlayer = { id, innings, innings2 };

    if (freeMode) {
      lineupPlayer.name = nameMap[id] || `Joueur ${id}`;
      lineupPlayer.isCustom = true;
    } else {
      const player = players.find((p) => p.id === id);
      lineupPlayer.name = player ? player.name : nameMap[id] || `#${id}`;
      lineupPlayer.isSubstitute = !teamPlayerIds.has(id);
    }

    return lineupPlayer;
  });
}

function getExtraPassesFromGameData(data) {
  const extraPasses = Array.from({ length: maxInnings }, () => false);
  if (Array.isArray(data?.innings)) {
    data.innings.forEach((inning) => {
      if (inning.pass === 2) {
        const inningIndex = parseInt(inning.value, 10) - 1;
        if (inningIndex >= 0 && inningIndex < maxInnings) {
          extraPasses[inningIndex] = true;
        }
      }
    });
  }
  return extraPasses;
}

async function loadGameJson() {
  const gameDate = document.getElementById("game-date").value;
  const gameTime = getGameTime();
  if (!gameDate || !gameTime) {
    alert("Veuillez sélectionner une date et une heure de match.");
    return;
  }

  const loads = [];

  if (selectedTeam) {
    const teamFolder = freeMode
      ? `custom/${slugifyTeamName(selectedTeam)}`
      : selectedTeam;
    loads.push({
      filename: `${YEAR}/${teamFolder}/${gameDate}_${gameTime}.json`,
      teamName: selectedTeam,
      side: "home",
      label: "Local",
    });
  }

  if (selectedVisitorTeam) {
    const teamFolder = freeMode
      ? `custom/${slugifyTeamName(selectedVisitorTeam)}`
      : selectedVisitorTeam;
    loads.push({
      filename: `${YEAR}/${teamFolder}/${gameDate}_${gameTime}.json`,
      teamName: selectedVisitorTeam,
      side: "away",
      label: "Visiteur",
    });
  }

  if (loads.length === 0) {
    alert("Veuillez sélectionner au moins une équipe avant de charger.");
    return;
  }

  const fetched = await Promise.all(
    loads.map(async ({ filename, teamName, side, label }) => {
      try {
        const response = await fetch(
          `http://127.0.0.1:5000/load?filename=${filename}`,
        );
        if (!response.ok) {
          return {
            side,
            label,
            error: "aucune partie trouvée pour cette date/heure.",
          };
        }
        const data = await response.json();
        return { side, label, teamName, data };
      } catch (error) {
        return { side, label, error: `erreur lors du chargement (${error}).` };
      }
    }),
  );

  // Ajuste le nombre de manches en fonction de la partie chargée avant de reconstruire les alignements.
  const loadedInningsCounts = fetched
    .filter((r) => !r.error && Array.isArray(r.data?.innings))
    .flatMap((r) => r.data.innings.map((inn) => parseInt(inn.value, 10)))
    .filter((n) => Number.isFinite(n));
  if (loadedInningsCounts.length > 0) {
    setInningsCount(Math.max(maxInnings, ...loadedInningsCounts));
  }

  const results = fetched.map(({ side, label, teamName, data, error }) => {
    if (error) return `${label}: ${error}`;
    const lineup = buildLineupFromGameData(data, teamName);
    const extraPasses = getExtraPassesFromGameData(data);
    if (side === "home") {
      homeLineup = lineup;
      homeExtraPasses = extraPasses;
      homeInningOverrides = createDefaultInningOverrides();
    } else {
      awayLineup = lineup;
      awayExtraPasses = extraPasses;
      awayInningOverrides = createDefaultInningOverrides();
    }
    return `${label}: partie chargée.`;
  });

  updateLineupDisplay();
  updateScoreDisplay();
  saveGameState();
  alert(results.join("\n"));
}

init();
