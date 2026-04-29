let currentBases = new Set();
let currentStats = new Set();
let players = [];
let yearPlayers = [];
let teams = [];
let homeLineup = [];
let awayLineup = [];
let currentTab = "home"; // "home" or "away"
let selectedTeam = "";
let selectedVisitorTeam = "";
let currentPlayerIndex = -1;
let currentInningIndex = -1;

const YEAR = 2025;
const BASES_ORDER = ["field", "0B", "1B", "2B", "3B", "4B"];
const DEFAULT_LINEUP_SIZE = 11;
const MAX_INNINGS = 9;
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
const STORAGE_KEY = "gameApp_state";

function saveGameState() {
  const state = {
    gameDate: document.getElementById("game-date")?.value || "",
    gameTime: document.getElementById("game-time")?.value || "19h00",
    selectedTeam,
    selectedVisitorTeam,
    homeLineup,
    awayLineup,
    currentTab,
    currentPlayerIndex,
    currentInningIndex,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadGameState() {
  const state = localStorage.getItem(STORAGE_KEY);
  if (!state) return null;

  try {
    return JSON.parse(state);
  } catch (e) {
    console.error("Error parsing saved game state:", e);
    return null;
  }
}

function clearGameState() {
  localStorage.removeItem(STORAGE_KEY);
}

function resetGameState() {
  clearGameState();

  selectedTeam = "";
  selectedVisitorTeam = "";
  homeLineup = [];
  awayLineup = [];
  currentTab = "home";
  currentPlayerIndex = -1;
  currentInningIndex = -1;

  const teamSelect = document.getElementById("team-select");
  const visitorSelect = document.getElementById("team-select-visiteur");
  if (teamSelect) teamSelect.value = "";
  if (visitorSelect) visitorSelect.value = "";

  updateTeamSelects();

  document
    .querySelectorAll(".tab-button")
    .forEach((btn) => btn.classList.remove("active"));
  const homeTabButton = document.querySelector(
    `.tab-button[onclick="switchTab('home')"]`,
  );
  if (homeTabButton) homeTabButton.classList.add("active");

  setupDateDefaults();
  updateLineupDisplay();
  updateActiveInningInfo();
  document.getElementById("output").textContent = "";
}

function calculateScore(lineup) {
  if (!Array.isArray(lineup)) return 0;
  return lineup.reduce((total, player) => {
    if (!player || !Array.isArray(player.innings)) return total;
    return (
      total +
      player.innings.reduce(
        (inningTotal, inning) =>
          inning?.bags === "4B" ? inningTotal + 1 : inningTotal,
        0,
      )
    );
  }, 0);
}

function calculateInningPoints(lineup, inningIndex) {
  if (!Array.isArray(lineup)) return 0;
  return lineup.reduce((total, player) => {
    if (!player || !Array.isArray(player.innings)) return total;
    return player.innings[inningIndex]?.bags === "4B" ? total + 1 : total;
  }, 0);
}

function countErrors(lineup) {
  if (!Array.isArray(lineup)) return 0;
  return lineup.reduce((total, player) => {
    if (!player || !Array.isArray(player.innings)) return total;
    return (
      total +
      player.innings.reduce(
        (inningTotal, inning) => (inning?.ERR ? inningTotal + 1 : inningTotal),
        0,
      )
    );
  }, 0);
}

function countCC(lineup) {
  if (!Array.isArray(lineup)) return 0;
  return lineup.reduce((total, player) => {
    if (!player || !Array.isArray(player.innings)) return total;
    return (
      total +
      player.innings.reduce(
        (inningTotal, inning) => (inning?.CC ? inningTotal + 1 : inningTotal),
        0,
      )
    );
  }, 0);
}

function getActiveTeamName() {
  return currentTab === "home" ? "Local" : "Visiteur";
}

function countActiveOuts() {
  if (currentPlayerIndex === -1 || currentInningIndex === -1) return 0;
  const currentLineup = getCurrentLineup();
  if (!Array.isArray(currentLineup)) return 0;
  return currentLineup.reduce((total, player) => {
    if (!player || !Array.isArray(player.innings)) return total;
    return player.innings[currentInningIndex]?.R ? total + 1 : total;
  }, 0);
}

function updateActiveInningInfo() {
  const activeTeamLabel = document.getElementById("active-team-label");
  const activeInningLabel = document.getElementById("active-inning-label");
  const activeOutLabel = document.getElementById("active-out-label");
  const activeTeamName = getActiveTeamName();
  const activeInning =
    currentInningIndex === -1 ? "N/A" : currentInningIndex + 1;
  const outCount = countActiveOuts();

  if (activeTeamLabel)
    activeTeamLabel.textContent = `Équipe active: ${activeTeamName}`;
  if (activeInningLabel)
    activeInningLabel.textContent = `Manche active: ${activeInning}`;
  if (activeOutLabel) activeOutLabel.textContent = `Out (R): ${outCount}`;
}

function updateScoreDisplay() {
  const homeTotal = calculateScore(homeLineup);
  const awayTotal = calculateScore(awayLineup);
  const homeErrTotal = countErrors(awayLineup);
  const awayErrTotal = countErrors(homeLineup);
  const homeCCTotal = countCC(homeLineup);
  const awayCCTotal = countCC(awayLineup);

  for (let inning = 1; inning <= MAX_INNINGS; inning++) {
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

  // Restore from localStorage if available
  const savedState = loadGameState();
  if (savedState) {
    selectedTeam = savedState.selectedTeam;
    selectedVisitorTeam = savedState.selectedVisitorTeam;
    homeLineup = savedState.homeLineup || [];
    awayLineup = savedState.awayLineup || [];
    currentTab = savedState.currentTab || "home";
    currentPlayerIndex = savedState.currentPlayerIndex || -1;
    currentInningIndex = savedState.currentInningIndex || -1;

    // Restore form values
    if (savedState.gameDate) {
      document.getElementById("game-date").value = savedState.gameDate;
    }
    if (savedState.gameTime) {
      document.getElementById("game-time").value = savedState.gameTime;
    }
    if (savedState.selectedTeam) {
      document.getElementById("team-select").value = savedState.selectedTeam;
    }
    if (savedState.selectedVisitorTeam) {
      document.getElementById("team-select-visiteur").value =
        savedState.selectedVisitorTeam;
    }

    updateTeamSelects();
    document
      .querySelectorAll(".tab-button")
      .forEach((btn) => btn.classList.remove("active"));
    const activeButton = document.querySelector(
      `.tab-button[onclick="switchTab('${currentTab}')"]`,
    );
    if (activeButton) activeButton.classList.add("active");
  }

  updateLineupDisplay(); // Ajout de cette ligne pour afficher la liste vide au démarrage
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

  // Créer l'en-tête des manches
  const headerRow = document.createElement("div");
  headerRow.className = "lineup-header";
  headerRow.innerHTML = `
                <div class="player-info">Joueur</div>
                ${Array.from(
                  { length: MAX_INNINGS },
                  (_, i) => `<div class="inning-header">${i + 1}</div>`,
                ).join("")}
        `;
  container.appendChild(headerRow);

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

    const select = document.createElement("select");
    select.id = `player-${i}`;
    select.onchange = (e) => updateLineupSpot(i, parseInt(e.target.value));
    select.innerHTML = `<option value="">Sélectionner un joueur</option>`;

    const currentLineup = getCurrentLineup();
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

    row.appendChild(playerSection);

    // Pour chaque manche (1-9)
    for (let j = 0; j < MAX_INNINGS; j++) {
      const inningContainer = document.createElement("div");
      inningContainer.className = "inning-container";

      // Ajouter les boutons de stats
      const statsContainer = document.createElement("div");
      statsContainer.className = "stats-container";

      // Ajouter l'image de base
      const cell = document.createElement("div");
      cell.className = "inning-cell";
      cell.id = `inning-${i}-${j}`;

      const playerStats =
        currentLineup[i]?.innings?.[j] || createDefaultStats();
      const baseState = playerStats.bags || "field";
      if (i === currentPlayerIndex && j === currentInningIndex) {
        cell.classList.add("selected");
      }

      const img = document.createElement("img");
      img.src = `../img/${baseState}.png`;
      img.className = "base-image";
      img.dataset.currentBase = baseState;
      img.onclick = () => {
        selectPlayerInning(i, j);
        rotateBase(img);
        updateStatsForCurrentPlayer();
      };

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
        statButton.disabled = currentBase === "field";
        statButton.onclick = () => toggleStatForInning(i, j, stat);
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
      rButton.disabled = currentBase === "field";
      rButton.onclick = () => toggleRForInning(i, j);
      statsContainer.appendChild(rButton);

      inningContainer.appendChild(statsContainer);
      inningContainer.appendChild(cell);
      inningContainer.appendChild(rButton);
      row.appendChild(inningContainer);
    }

    container.appendChild(row);
  }

  updateScoreDisplay();
  updateActiveInningInfo();
}

function toggleStatForInning(playerIndex, inningIndex, stat) {
  selectPlayerInning(playerIndex, inningIndex);
  // Désactiver tous les boutons de stats pour cette manche
  const row = document.querySelectorAll(`.lineup .lineup-row`)[playerIndex];
  const inning_container =
    row.querySelectorAll(`.inning-container`)[inningIndex];
  inning_container.querySelectorAll(".stat-button").forEach((button) => {
    button.classList.remove("active");
  });

  // Si on clique sur le même stat, le désactiver
  const statKey = statMap[stat];
  const currentLineup = getCurrentLineup();
  if (currentLineup[playerIndex]?.innings?.[inningIndex]?.[statKey]) {
    if (currentLineup[playerIndex]?.innings?.[inningIndex]) {
      currentLineup[playerIndex].innings[inningIndex][statKey] = false;
      if (CS_STATS.includes(stat)) {
        currentLineup[playerIndex].innings[inningIndex].CS = false;
      }
    }
  } else {
    // Sinon, activer le nouveau stat
    if (!currentLineup[playerIndex]) {
      currentLineup[playerIndex] = {
        innings: Array.from({ length: MAX_INNINGS }, () =>
          createDefaultStats(),
        ),
      };
    }

    Object.values(statMap).forEach((key) => {
      currentLineup[playerIndex].innings[inningIndex][key] =
        key === statKey ? true : false;
    });

    if (CS_STATS.includes(stat))
      currentLineup[playerIndex].innings[inningIndex].CS = true;
    else currentLineup[playerIndex].innings[inningIndex].CS = false;

    inning_container
      .querySelector(`[data-stat="${stat}"]`)
      .classList.add("active");
  }
  setCurrentLineup(currentLineup);
  updateActiveInningInfo();
}

function toggleRForInning(playerIndex, inningIndex) {
  selectPlayerInning(playerIndex, inningIndex);
  const currentLineup = getCurrentLineup();
  if (!currentLineup[playerIndex]) {
    currentLineup[playerIndex] = {
      innings: Array.from({ length: MAX_INNINGS }, () => createDefaultStats()),
    };
  }

  const currentValue = currentLineup[playerIndex].innings[inningIndex].R;
  currentLineup[playerIndex].innings[inningIndex].R = !currentValue;

  setCurrentLineup(currentLineup);

  // Update visual
  const row = document.querySelectorAll(`.lineup-row`)[playerIndex];
  const inning_container =
    row.querySelectorAll(`.inning-container`)[inningIndex];
  const rButton = Array.from(
    inning_container.querySelectorAll(".stat-button"),
  ).find((btn) => btn.textContent === "R");
  rButton.classList.toggle("active");
  updateActiveInningInfo();
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

  if (!currentLineup[currentPlayerIndex].innings) {
    currentLineup[currentPlayerIndex].innings = [];
  }

  const cell = document.querySelector(
    `#inning-${currentPlayerIndex}-${currentInningIndex} img`,
  );
  const currentBase = cell?.dataset?.currentBase || "field";

  if (currentBase === "field") {
    currentLineup[currentPlayerIndex].innings[currentInningIndex] =
      createDefaultStats();
  } else {
    if (!currentLineup[currentPlayerIndex].innings[currentInningIndex]) {
      currentLineup[currentPlayerIndex].innings[currentInningIndex] =
        createDefaultStats();
    }
    currentLineup[currentPlayerIndex].innings[currentInningIndex].bags =
      currentBase;
  }

  setCurrentLineup(currentLineup);
}

function selectPlayerInning(playerIndex, inningIndex) {
  // Désélectionner toute autre cellule active
  document
    .querySelectorAll(".inning-cell")
    .forEach((cell) => cell.classList.remove("selected"));

  // Sélectionner la cellule courante
  const cell = document.getElementById(`inning-${playerIndex}-${inningIndex}`);
  if (cell) {
    cell.classList.add("selected");
  }

  // Mettre à jour les stats pour cette cellule
  currentPlayerIndex = playerIndex;
  currentInningIndex = inningIndex;
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
        innings: Array.from({ length: MAX_INNINGS }, () =>
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

function buildGameData(lineup) {
  const cleanLineup = Array.isArray(lineup)
    ? lineup.filter((player) => player !== null)
    : [];

  const innings = [];

  for (let inning = 0; inning < MAX_INNINGS; inning++) {
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
  }

  return {
    lineup: cleanLineup.map((player) => player.id),
    innings: innings,
  };
}

function generateJson(lineup = getCurrentLineup()) {
  const gameData = buildGameData(lineup);
  const jsonOutput = JSON.stringify(gameData, null, 2);
  document.getElementById("output").textContent = jsonOutput;
  return jsonOutput;
}

async function saveJson() {
  const gameDate = document.getElementById("game-date").value;
  const gameTime = document.getElementById("game-time").value;
  if (!gameDate || !gameTime) {
    alert("Veuillez sélectionner une date et une heure de match.");
    return;
  }

  const saves = [];

  if (selectedTeam) {
    const filename = `../data/${YEAR}/${selectedTeam}/${gameDate}_${gameTime}.json`;
    const data = JSON.stringify(buildGameData(homeLineup), null, 2);
    saves.push({ filename, data, team: "Local" });
  }

  if (selectedVisitorTeam) {
    const filename = `../data/${YEAR}/${selectedVisitorTeam}/${gameDate}_${gameTime}.json`;
    const data = JSON.stringify(buildGameData(awayLineup), null, 2);
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

init();
