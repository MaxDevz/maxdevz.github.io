let currentBases = new Set();
let currentStats = new Set();
let players = [];
let teams = [];
let lineup = [];
let selectedTeam = "";
let currentPlayerIndex = -1;
let currentInningIndex = -1;

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

async function init() {
  await loadPlayers();
  await loadTeams();
  populateTeamSelect();
  setupDateDefaults();
  updateLineupDisplay(); // Ajout de cette ligne pour afficher la liste vide au démarrage
}

function setupDateDefaults() {
  const today = new Date();
  const dateInput = document.getElementById("game-date");
  dateInput.value = today.toISOString().split("T")[0];
}

async function loadPlayers() {
  const response = await fetch(
    "http://127.0.0.1:5000/load?filename=players.json"
  );
  if (!response.ok) {
    console.error("Erreur chargement players.json");
    return;
  }
  const data = await response.json();
  players = data.players;
}

async function loadTeams() {
  const response = await fetch(
    "http://127.0.0.1:5000/load?filename=2025/season_2025.json"
  );
  if (!response.ok) {
    console.error("Erreur chargement season_2025.json");
    return;
  }
  const data = await response.json();
  teams = data.teams;
}

function populateTeamSelect() {
  const select = document.getElementById("team-select");
  select.innerHTML = '<option value="">Sélectionner une équipe</option>';

  teams.forEach((team) => {
    const option = document.createElement("option");
    option.value = team.name;
    option.textContent = formatTeamName(team.name);
    select.appendChild(option);
  });
}

function formatTeamName(name) {
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function loadTeamPlayers() {
  selectedTeam = document.getElementById("team-select").value;
  lineup = []; // Reset lineup when team changes
  updateLineupDisplay();
}

function getAvailablePlayers(currentPlayerId) {
  const team = teams.find((t) => t.name === selectedTeam);
  if (!team) return [];

  // Retourne les joueurs qui ne sont pas dans le lineup
  // ou qui sont le joueur actuellement sélectionné à cette position
  return team.players.filter((playerId) => {
    const isPlayerInLineup = lineup.some(
      (player) => player && player.id === playerId
    );
    return !isPlayerInLineup || playerId === currentPlayerId;
  });
}

function getSubstitutePlayers(currentPlayerId) {
  const currentTeam = teams.find((t) => t.name === selectedTeam);
  if (!currentTeam) return [];

  // Obtenir tous les joueurs des autres équipes
  const substitutePlayers = teams
    .filter((team) => team.name !== selectedTeam)
    .flatMap((team) => team.players);

  // Filtrer les joueurs déjà dans le lineup
  return substitutePlayers.filter((playerId) => {
    const isPlayerInLineup = lineup.some(
      (player) => player && player.id === playerId
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
                  (_, i) => `<div class="inning-header">${i + 1}</div>`
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
    select.innerHTML = `<option value="">Sélectionner une équipe</option>`;

    // Ajouter les options des joueurs disponibles
    const availablePlayers = getAvailablePlayers();
    availablePlayers.forEach((playerId) => {
      const player = players.find((p) => p.id === playerId);
      if (player) {
        select.innerHTML += `
                                        <option value="${player.id}" 
                                                        ${
                                                          lineup[i]?.id ===
                                                          player.id
                                                            ? "selected"
                                                            : ""
                                                        }>
                                                ${player.name}
                                        </option>`;
      }
    });

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

      STATS_OPTIONS.forEach((stat) => {
        const statButton = document.createElement("button");
        statButton.className = "stat-button";
        statButton.textContent = stat;
        statButton.dataset.stat = stat;
        const statKey = statMap[statButton.textContent];
        if (statKey && lineup[i]?.innings?.[j]?.[statKey]) {
          statButton.classList.add("active");
        }
        statButton.onclick = () => toggleStatForInning(i, j, stat);
        statsContainer.appendChild(statButton);
      });

      // Ajouter l'image de base
      const cell = document.createElement("div");
      cell.className = "inning-cell";
      cell.id = `inning-${i}-${j}`;

      const img = document.createElement("img");
      img.src = `../img/field.png`;
      img.className = "base-image";
      img.dataset.currentBase = "field";
      img.onclick = () => {
        currentPlayerIndex = i;
        currentInningIndex = j;
        rotateBase(img);
        updateStatsForCurrentPlayer();
      };

      cell.appendChild(img);

      inningContainer.appendChild(statsContainer);
      inningContainer.appendChild(cell);
      row.appendChild(inningContainer);
    }

    container.appendChild(row);
  }
}

function toggleStatForInning(playerIndex, inningIndex, stat) {
  // Désactiver tous les boutons de stats pour cette manche
  const row = document.querySelectorAll(`.lineup .lineup-row`)[playerIndex];
  const inning_container =
    row.querySelectorAll(`.inning-container`)[inningIndex];
  inning_container.querySelectorAll(".stat-button").forEach((button) => {
    button.classList.remove("active");
  });

  // Si on clique sur le même stat, le désactiver
  const statKey = statMap[stat];
  if (lineup[playerIndex]?.innings?.[inningIndex]?.[statKey]) {
    if (lineup[playerIndex]?.innings?.[inningIndex]) {
      lineup[playerIndex].innings[inningIndex][statKey] = false;
      if (CS_STATS.includes(stat)) {
        lineup[playerIndex].innings[inningIndex].CS = false;
      }
    }
  } else {
    // Sinon, activer le nouveau stat
    if (!lineup[playerIndex]) {
      lineup[playerIndex] = {
        innings: Array.from({ length: MAX_INNINGS }, () =>
          createDefaultStats()
        ),
      };
    }

    Object.values(statMap).forEach((key) => {
      lineup[playerIndex].innings[inningIndex][key] =
        key === statKey ? true : false;
    });

    if (CS_STATS.includes(stat))
      lineup[playerIndex].innings[inningIndex].CS = true;
    else lineup[playerIndex].innings[inningIndex].CS = false;

    inning_container
      .querySelector(`[data-stat="${stat}"]`)
      .classList.add("active");
  }
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
}

function updateStatsForCurrentPlayer() {
  if (currentPlayerIndex === -1 || currentInningIndex === -1) return;

  // Mettre à jour les stats du joueur pour la manche courante
  if (!lineup[currentPlayerIndex].innings) {
    lineup[currentPlayerIndex].innings = [];
  }

  if (!lineup[currentPlayerIndex].innings[currentInningIndex]) {
    lineup[currentPlayerIndex].innings[currentInningIndex] = {
      bags: "field",
      CS: false,
      R: false,
      S: false,
      double: false,
      triple: false,
      PP: 0,
      CC: false,
      BB: false,
      OPT: false,
      ERR: false,
      SAC: false,
    };
  }

  const cell = document.querySelector(
    `#inning-${currentPlayerIndex}-${currentInningIndex} img`
  );
  lineup[currentPlayerIndex].innings[currentInningIndex].bags =
    cell.dataset.currentBase;
}

function selectPlayerInning(playerIndex, inningIndex) {
  // Désélectionner toute autre cellule active
  document
    .querySelectorAll(".inning-cell")
    .forEach((cell) => cell.classList.remove("selected"));

  // Sélectionner la cellule courante
  const cell = document.getElementById(`inning-${playerIndex}-${inningIndex}`);
  cell.classList.add("selected");

  // Mettre à jour les stats pour cette cellule
  currentPlayerIndex = playerIndex;
  currentInningIndex = inningIndex;
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

  // Réinitialiser la sélection et retirer le joueur du lineup
  select.value = "";
  if (lineup[index]) {
    lineup[index] = null;
  }

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

  if (!playerId) {
    lineup[index] = null;
    select.value = ""; // Mettre à jour la valeur du select
  } else {
    const player = players.find((p) => p.id === playerId);
    if (player) {
      lineup[index] = {
        id: player.id,
        name: player.name,
        innings: Array.from({ length: MAX_INNINGS }, () =>
          createDefaultStats()
        ),
        isSubstitute: document.getElementById(`sub-${index}`)?.checked || false,
      };
      select.value = player.id; // Mettre à jour la valeur du select
    }
  }

  // Mettre à jour tous les autres menus déroulants pour refléter la nouvelle sélection
  updateAllPlayerLists();
}

function updateAllPlayerLists() {
  console.log("Updating all player lists");
  for (let i = 0; i < DEFAULT_LINEUP_SIZE; i++) {
    const select = document.getElementById(`player-${i}`);
    const currentValue = select.value;
    const isSubstitute = document.getElementById(`sub-${i}`)?.checked || false;

    // Sauvegarder la valeur actuelle et recréer les options
    const currentPlayerId = lineup[i]?.id;
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
  if (player && !lineup.find((p) => p.id === playerId)) {
    lineup.push({
      id: player.id,
      name: player.name,
    });
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

  return team.players
    .filter((playerId) => {
      // Un joueur est disponible s'il n'est pas déjà dans le lineup
      // ou s'il est le joueur actuellement sélectionné à cette position
      return !lineup.some(
        (player, index) =>
          player && player.id === playerId && index !== currentSpot
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
  lineup = lineup.filter((_, i) => i !== index);
  updateLineupDisplay();
}

function generateJson() {
  // Filtrer les joueurs null du lineup
  const cleanLineup = lineup.filter((player) => player !== null);

  // Créer un tableau pour stocker les manches
  const innings = [];

  // Pour chaque manche (1-9)
  for (let inning = 0; inning < MAX_INNINGS; inning++) {
    const hitters = [];
    let hasValidStats = false;

    // Pour chaque joueur dans le lineup
    cleanLineup.forEach((player) => {
      const stats = player.innings?.[inning] || createDefaultStats();

      if (stats.bags !== "field") {
        // Ajouter l'id du joueur dans stats
        stats.id = player.id;
        hitters.push(stats);
        hasValidStats = true;
      }
    });

    // Ajouter la manche seulement si elle contient des stats valides
    if (hasValidStats) {
      innings.push({
        value: (inning + 1).toString(),
        hitters: hitters,
      });
    }
  }

  const gameData = {
    lineup: cleanLineup.map((player) => player.id),
    innings: innings,
  };

  document.getElementById("output").textContent = JSON.stringify(
    gameData,
    null,
    2
  );
}

async function saveJson() {
  const gameDate = document.getElementById("game-date").value;
  const gameTime = document.getElementById("game-time").value;
  const filename = `../data/2025/${selectedTeam}/${gameDate}_${gameTime}.json`;

  const data = JSON.parse(document.getElementById("output").textContent);

  try {
    const response = await fetch(
      `http://127.0.0.1:5000/save?filename=${filename}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    );
    const result = await response.json();
    alert(result.message);
  } catch (error) {
    alert("Erreur lors de la sauvegarde: " + error);
  }
}

init();
