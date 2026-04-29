const YEAR = 2026;
const BASE_URL = "http://127.0.0.1:5000";
const STATE_KEY = `draft_state_${YEAR}`;
let yearPlayers = [];
let basePlayers = [];
let basePlayerMap = new Map();
let seasonData = null;
let draftTeams = [];
let pickOrder = [];
let currentPickIndex = 0;
let totalPicks = 0;
let draftHistory = [];
let pendingTieGroups = [];
let tieBreakerRunning = false;
let tieBreakerStatus = "";
let lastTieBreakerMessage = "";
let lastTieLoserByPair = new Map();
let lastFinalOrder = null;

function saveDraftState() {
  const state = {
    timestamp: new Date().toISOString(),
    totalPicks,
    currentPickIndex,
    draftHistory: draftHistory.map((entry) => ({ ...entry })),
    draftTeams: draftTeams.map((team) => ({
      name: team.name,
      displayName: team.displayName,
      players: [...team.players],
      captainIds: [...team.captainIds],
      picks: team.picks.map((p) => ({ ...p })),
      captains: team.captains.map((c) => ({ ...c })),
      captainSum: team.captainSum,
    })),
    pickOrder: pickOrder.map((team) => team.name),
    pendingTieGroups: pendingTieGroups.map((group) =>
      group.map((team) => team.name),
    ),
    lastTieBreakerMessage,
    lastTieLoserByPair: Array.from(lastTieLoserByPair.entries()),
  };
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
  console.log("Draft state saved to localStorage");
}

function loadDraftState() {
  const saved = localStorage.getItem(STATE_KEY);
  if (!saved) {
    console.log("No saved draft state found");
    return false;
  }

  try {
    const state = JSON.parse(saved);

    totalPicks = state.totalPicks;
    currentPickIndex = state.currentPickIndex;
    draftHistory = state.draftHistory;
    lastTieBreakerMessage = state.lastTieBreakerMessage || "";
    lastTieLoserByPair = new Map(state.lastTieLoserByPair);

    draftTeams = state.draftTeams
      .map((teamData) => {
        const team = draftTeams.find((t) => t.name === teamData.name);
        if (team) {
          team.players = teamData.players;
          team.captainIds = teamData.captainIds;
          team.picks = teamData.picks;
          team.captains = teamData.captains;
          team.captainSum = teamData.captainSum;
        }
        return team;
      })
      .filter(Boolean);

    pickOrder = state.pickOrder
      .map((name) => draftTeams.find((team) => team.name === name))
      .filter(Boolean);

    pendingTieGroups = state.pendingTieGroups
      .map((groupNames) =>
        groupNames
          .map((name) => draftTeams.find((team) => team.name === name))
          .filter(Boolean),
      )
      .filter((group) => group.length > 0);

    console.log("Draft state loaded from localStorage");
    return true;
  } catch (error) {
    console.error("Error loading draft state:", error);
    return false;
  }
}

function clearDraftState() {
  localStorage.removeItem(STATE_KEY);
  console.log("Draft state cleared from localStorage");
}

function downloadDraftState() {
  const saved = localStorage.getItem(STATE_KEY);
  if (!saved) {
    alert("Aucun brouillon sauvegardé à télécharger.");
    return;
  }

  const blob = new Blob([saved], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `draft_${YEAR}_backup_${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function uploadDraftState(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const content = e.target.result;
      const state = JSON.parse(content);

      if (!state.timestamp || state.totalPicks === undefined) {
        throw new Error("Invalid draft state file format");
      }

      localStorage.setItem(STATE_KEY, content);
      loadDraftState();
      renderDraft();
      alert("Brouillon restauré avec succès!");
    } catch (error) {
      alert("Erreur lors du chargement du brouillon: " + error.message);
    }
  };
  reader.readAsText(file);
}

async function initDraft() {
  console.log("Initializing draft application");
  await loadPlayerNames();
  await loadYearPlayers();
  await loadSeason();
  buildDraftTeams();

  // Try to load saved draft state
  const stateLoaded = loadDraftState();

  // Check if rating adjustment has been done
  if (localStorage.getItem("rating_adjusted") === "true") {
    renderDraft();
  } else {
    renderRatingAdjustment();
  }
}

function renderRatingAdjustment() {
  console.log("Rendering rating adjustment interface");
  //hide other items
  document.getElementById("round-order").style.display = "none";
  document.getElementById("draft-history").style.display = "none";
  document.getElementById("captain-selection").style.display = "none";
  document.getElementById("player-pool").style.display = "none";
  document.getElementById("draft-controls").style.display = "none";

  const container = document.getElementById("rating-adjustment");
  const columnsContainer = document.getElementById("rating-columns");
  columnsContainer.innerHTML = "";

  // Create columns for ratings 19 to 26
  for (let rating = 19; rating <= 26; rating++) {
    const column = document.createElement("div");
    column.className = "rating-column";
    column.dataset.rating = rating;
    column.innerHTML = `<h4>Cote ${rating}</h4>`;
    column.addEventListener("dragover", handleDragOver);
    column.addEventListener("drop", handleDrop);
    columnsContainer.appendChild(column);
  }

  // Group players by current rating
  const playersByRating = {};
  for (let r = 19; r <= 26; r++) {
    playersByRating[r] = [];
  }

  yearPlayers.forEach((player) => {
    const rating = player.rating || 19; // Default to 19 if not set
    if (rating >= 19 && rating <= 26) {
      playersByRating[rating].push(player);
    } else {
      // If outside range, put in 19
      playersByRating[19].push(player);
    }
  });

  // Sort players alphabetically within each rating
  Object.keys(playersByRating).forEach((rating) => {
    playersByRating[rating].sort((a, b) =>
      (a.name || `#${a.id}`).localeCompare(b.name || `#${b.id}`),
    );
  });

  // Add players to columns
  Object.keys(playersByRating).forEach((rating) => {
    const column = columnsContainer.querySelector(`[data-rating="${rating}"]`);
    playersByRating[rating].forEach((player) => {
      const playerDiv = document.createElement("div");
      playerDiv.className = "rating-player";
      playerDiv.textContent = player.name || `#${player.id}`;
      playerDiv.dataset.playerId = player.id;
      playerDiv.draggable = true;
      playerDiv.addEventListener("dragstart", handleDragStart);
      column.appendChild(playerDiv);
    });
  });

  container.style.display = "block";
}

let draggedPlayer = null;
let originalRating = null;

function handleDragStart(e) {
  draggedPlayer = e.target;
  e.target.classList.add("dragging");
}

function handleDragOver(e) {
  e.preventDefault(); // Allow drop
}

function handleDrop(e) {
  e.preventDefault();
  if (!draggedPlayer) return;

  const column = e.currentTarget;
  const newRating = parseInt(column.dataset.rating);

  // Update player's rating
  const playerId = parseInt(draggedPlayer.dataset.playerId);
  const player = yearPlayers.find((p) => p.id === playerId);
  if (player) {
    const originalRating = player.originalRating ?? player.rating;
    player.rating = newRating;

    if (newRating === originalRating) {
      removeRatingChangeIndicator(draggedPlayer);
    } else {
      const difference = newRating - originalRating;
      showRatingChangeIndicator(draggedPlayer, difference);
    }
  }

  // Move the player div to the new column
  column.appendChild(draggedPlayer);
  draggedPlayer.classList.remove("dragging");

  // Re-sort the column alphabetically
  sortColumn(column);

  draggedPlayer = null;
}

function sortColumn(column) {
  const players = Array.from(column.querySelectorAll(".rating-player"));
  players.sort((a, b) => {
    const nameA = a.textContent;
    const nameB = b.textContent;
    return nameA.localeCompare(nameB);
  });
  players.forEach((player) => column.appendChild(player));
}

function showRatingChangeIndicator(playerElement, difference) {
  // Remove any existing indicator
  const existingIndicator = playerElement.querySelector(".rating-indicator");
  if (existingIndicator) {
    existingIndicator.remove();
  }

  // Ensure difference is a number
  if (typeof difference !== "number" || isNaN(difference)) {
    console.error("Invalid difference:", difference);
    return;
  }

  // Create indicator element
  const indicator = document.createElement("span");
  indicator.className = "rating-indicator";
  const sign = difference > 0 ? "+" : difference < 0 ? "-" : "";
  const text = sign + Math.abs(difference);
  indicator.textContent = text;
  indicator.style.cssText = `
    position: absolute;
    top: -5px;
    right: -5px;
    min-width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 12px;
    color: white;
    background-color: ${difference > 0 ? "#28a745" : "#dc3545"};
    z-index: 10;
    padding: 0 4px;
  `;

  // Make sure the player element has relative positioning
  playerElement.style.position = "relative";

  playerElement.appendChild(indicator);
}

function removeRatingChangeIndicator(playerElement) {
  const existingIndicator = playerElement.querySelector(".rating-indicator");
  if (existingIndicator) {
    existingIndicator.remove();
  }
}

async function saveRatingsAndStartDraft() {
  // Ratings are already updated via drag-and-drop

  // Remove transient fields added during loading, keep only original JSON fields
  const cleanPlayers = yearPlayers.map(({ name, originalRating, ...rest }) => rest);

  // Save to server
  try {
    const response = await fetch(
      `${BASE_URL}/save?filename=${YEAR}/players_${YEAR}.json`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ players: cleanPlayers }, null, 2),
      },
    );
    if (!response.ok) {
      throw new Error("Erreur lors de la sauvegarde");
    }
    alert("Cotes sauvegardées!");
  } catch (error) {
    alert("Erreur: " + error.message);
    return;
  }

  // Mark rating adjustment as done
  localStorage.setItem("rating_adjusted", "true");

  // Rebuild teams with new ratings
  buildDraftTeams();

  // Hide rating adjustment and start draft
  document.getElementById("rating-adjustment").style.display = "none";
  renderDraft();
}

function resetRatingAdjustment() {
  localStorage.removeItem("rating_adjusted");
  // Reload the page to restart the process
  window.location.reload();
}

async function loadPlayerNames() {
  const response = await fetch(`${BASE_URL}/load?filename=players.json`);
  if (!response.ok) {
    console.warn("Impossible de charger players.json.");
    return;
  }
  const data = await response.json();
  basePlayers = data.players;
  basePlayerMap = new Map(basePlayers.map((player) => [player.id, player]));
}

async function loadYearPlayers() {
  const response = await fetch(
    `${BASE_URL}/load?filename=${YEAR}/players_${YEAR}.json`,
  );
  if (!response.ok) {
    document.getElementById("draft-summary").textContent =
      `Impossible de charger players_${YEAR}.json.`;
    return;
  }
  const data = await response.json();
  yearPlayers = data.players
    .filter((player) => player.id !== 0)
    .map((player) => ({
      ...player,
      name: basePlayerMap.get(player.id)?.name || `#${player.id}`,
      originalRating: player.rating,
    }));
}

async function loadSeason() {
  const response = await fetch(
    `${BASE_URL}/load?filename=${YEAR}/season_${YEAR}.json`,
  );
  if (!response.ok) {
    document.getElementById("draft-summary").textContent =
      `Impossible de charger season_${YEAR}.json.`;
    return;
  }
  seasonData = await response.json();
}

function buildDraftTeams() {
  const playerMap = new Map(yearPlayers.map((player) => [player.id, player]));

  draftTeams = seasonData.teams.map((team) => {
    const teamPlayers = team.players
      .map((playerId) => playerMap.get(playerId))
      .filter(Boolean);
    const captainIds = teamPlayers
      .filter((player) => player.captain)
      .map((player) => player.id)
      .slice(0, 2);

    while (captainIds.length < 2) {
      captainIds.push(null);
    }

    const players = [...team.players];
    captainIds.forEach((captainId) => {
      if (captainId && !players.includes(captainId)) {
        players.push(captainId);
      }
    });

    return {
      name: team.name,
      displayName: formatTeamName(team.name),
      players,
      captainIds,
      picks: [],
      captains: [],
      captainSum: 0,
    };
  });

  updateTeamCaptains();
  reorderPickOrder();
}

function updateTeamCaptains() {
  draftTeams.forEach((team) => {
    team.captains = team.captainIds
      .map((id) => yearPlayers.find((player) => player.id === id))
      .filter(Boolean);
    team.captainSum = team.captains.reduce(
      (sum, player) => sum + player.rating,
      0,
    );
  });
}

function reorderPickOrder() {
  const sortedTeams = [...draftTeams].sort((a, b) => {
    const sumA = getTeamCurrentSum(a);
    const sumB = getTeamCurrentSum(b);
    if (sumA !== sumB) return sumA - sumB;
    return a.name.localeCompare(b.name);
  });

  pendingTieGroups = findTieGroups(sortedTeams);
  pickOrder = sortedTeams;

  // Reset tie breaker status and last result when a new tie draws appears
  if (pendingTieGroups.length > 0) {
    tieBreakerStatus = "";
    lastTieBreakerMessage = "";
  }
}

function findTieGroups(sortedTeams) {
  const groups = [];
  let group = [sortedTeams[0]];

  for (let i = 1; i < sortedTeams.length; i += 1) {
    const currentTeam = sortedTeams[i];
    const previousTeam = sortedTeams[i - 1];

    if (getTeamCurrentSum(currentTeam) === getTeamCurrentSum(previousTeam)) {
      group.push(currentTeam);
    } else {
      if (group.length > 1) groups.push(group);
      group = [currentTeam];
    }
  }

  if (group.length > 1) groups.push(group);
  return groups;
}

function getTiePairKey(nameA, nameB) {
  return [nameA, nameB].sort().join("|");
}

function shuffleArray(array) {
  return array.slice().sort(() => Math.random() - 0.5);
}

function resolveTieBreaks() {
  if (pendingTieGroups.length === 0 || tieBreakerRunning) return;

  lastTieBreakerMessage = "";
  tieBreakerRunning = true;
  tieBreakerStatus = "Tirage en cours…";
  renderDraft();

  let finalShuffledGroups = pendingTieGroups.map((group) => {
    let predetermined = false;
    let orderedGroup;
    if (group.length === 2) {
      const [firstTeam, secondTeam] = group;
      const pairKey = getTiePairKey(firstTeam.name, secondTeam.name);
      const lastLoser = lastTieLoserByPair.get(pairKey);

      if (lastLoser === firstTeam.name) {
        orderedGroup = [firstTeam, secondTeam];
        lastTieLoserByPair.delete(pairKey);
        predetermined = true;
      } else if (lastLoser === secondTeam.name) {
        orderedGroup = [secondTeam, firstTeam];
        lastTieLoserByPair.delete(pairKey);
        predetermined = true;
      } else {
        orderedGroup = shuffleArray(group);
        lastTieLoserByPair.set(pairKey, orderedGroup[1].name);
      }
    } else {
      orderedGroup = shuffleArray(group);
    }
    return { orderedGroup, predetermined };
  });

  let needsAnimation = finalShuffledGroups.some(
    ({ predetermined }) => !predetermined,
  );

  if (!needsAnimation) {
    tieBreakerStatus = finalShuffledGroups
      .map(({ orderedGroup }, index) => {
        const orderPreview = orderedGroup
          .map((team) => getTeamLogoMarkup(team))
          .join(" → ");
        return `<strong>Groupe ${index + 1}: </strong>${orderPreview} <em style="font-size: 12px;">Résultat déterminé par l'avantage précédent.</em>`;
      })
      .join("<br/>");
    renderDraft();
    setTimeout(() => {
      lastFinalOrder = finalShuffledGroups;
      finalizeTieBreaks();
      tieBreakerRunning = false;
      tieBreakerStatus = "Tirage terminé.";
      renderDraft();
    }, 5000);
  } else {
    let remainingSteps = 15;
    const interval = setInterval(() => {
      remainingSteps -= 1;
      if (remainingSteps > 0) {
        let groupsToUse;
        if (remainingSteps === 1) {
          groupsToUse = finalShuffledGroups.map(
            ({ orderedGroup }) => orderedGroup,
          );
          lastFinalOrder = finalShuffledGroups;
        } else {
          groupsToUse = pendingTieGroups.map((group) => shuffleArray(group));
        }
        tieBreakerStatus = groupsToUse
          .map((group, index) => {
            const orderPreview = group
              .map((team) => getTeamLogoMarkup(team))
              .join(" → ");
            return `<strong>Groupe ${index + 1}: </strong>${orderPreview}`;
          })
          .join("<br/>");

        renderDraft();
      }

      if (remainingSteps <= 0) {
        clearInterval(interval);
        setTimeout(() => {
          finalizeTieBreaks();
          tieBreakerRunning = false;
          tieBreakerStatus = "Tirage terminé.";
          renderDraft();
        }, 3000);
      }
    }, 250);
  }
}

function finalizeTieBreaks() {
  const grouped = [];
  let group = [pickOrder[0]];

  for (let i = 1; i < pickOrder.length; i += 1) {
    const currentTeam = pickOrder[i];
    const previousTeam = pickOrder[i - 1];

    if (getTeamCurrentSum(currentTeam) === getTeamCurrentSum(previousTeam)) {
      group.push(currentTeam);
    } else {
      grouped.push(group);
      group = [currentTeam];
    }
  }
  grouped.push(group);

  let groupedIndex = 0;
  pickOrder = grouped.flatMap((tieGroup) => {
    if (tieGroup.length === 1) return tieGroup;

    let { orderedGroup, predetermined } = lastFinalOrder[groupedIndex];
    let entryTitle = predetermined
      ? "Ordre déterminé par avantage précédent"
      : "Tirage ex-aequo";
    let groupNames = tieGroup.map((team) => team.displayName).join(" / ");

    const finalOrder = orderedGroup.map((team) => team.displayName).join(" → ");
    const finalOrderTeamNames = orderedGroup.map((team) => team.name);
    lastTieBreakerMessage = `Résultat : ${finalOrder}`;
    draftHistory.push({
      type: "tie",
      title: entryTitle,
      groupNames,
      finalOrder,
      finalOrderTeamNames,
      pickNumber: totalPicks + 1,
    });

    groupedIndex += 1;
    return orderedGroup;
  });

  pendingTieGroups = [];
  saveDraftState();
}

function renderCaptainSelection() {
  const container = document.getElementById("captain-selection");
  container.innerHTML = "<h2>Sélection des équipes</h2>";

  const grid = document.createElement("div");
  grid.className = "draft-captain-selection";

  draftTeams.forEach((team) => {
    const card = document.createElement("div");
    const isCurrentTeam =
      totalPicks < 36 &&
      team.name === pickOrder[currentPickIndex].name &&
      pendingTieGroups.length === 0;
    card.className = `team-card${isCurrentTeam ? " current-team" : ""}`;
    if (isCurrentTeam) {
      card.style.border = "3px solid #28a745";
      card.style.background = "#e8f5e8";
    }

    const title = document.createElement("div");
    title.className = "team-title";
    title.innerHTML = `${getTeamLogoMarkup(team)}<strong>${team.displayName}</strong>${isCurrentTeam ? ' <span style="color: #28a745; font-weight: bold;">← TOUR</span>' : ""}`;
    card.appendChild(title);

    for (let index = 0; index < 2; index += 1) {
      const row = document.createElement("div");
      row.style.marginBottom = "8px";

      const label = document.createElement("label");
      label.textContent = `Capitaine ${index + 1}: `;
      row.appendChild(label);

      const select = document.createElement("select");
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = "Sélectionner";
      select.appendChild(emptyOption);

      getCaptainSelectOptions(team, index).forEach((option) => {
        select.appendChild(option);
      });

      select.value = team.captainIds[index] || "";
      select.onchange = () => {
        const value = select.value === "" ? null : parseInt(select.value, 10);
        selectCaptain(team.name, index, value);
      };

      row.appendChild(select);
      card.appendChild(row);
    }

    const div = document.createElement("div");
    div.innerHTML += `
      <p>Somme: ${getTeamCurrentSum(team)}</p>
      <span><strong>Joueurs ajoutés (${team.picks.length}):</strong></span>
      <ul>
        ${team.picks
          .map((player) => `<li>${player.name} (${player.rating})</li>`)
          .join("")}
      </ul>
      ${getAdvantageMarkup(team)}
    `;
    card.appendChild(div);
    grid.appendChild(card);
  });

  container.appendChild(grid);
}

function getCaptainSelectOptions(team, index) {
  const selectedIds = new Set(
    draftTeams.flatMap((otherTeam, otherIndex) =>
      otherTeam.captainIds.filter(
        (id) => id && !(otherTeam.name === team.name && otherIndex === index),
      ),
    ),
  );

  return yearPlayers
    .filter(
      (player) =>
        player.captain &&
        (player.id === team.captainIds[index] || !selectedIds.has(player.id)),
    )
    .map((player) => {
      const option = document.createElement("option");
      option.value = player.id;
      option.textContent = `${player.name} (${player.rating})`;
      return option;
    });
}

function selectCaptain(teamName, index, playerId) {
  const team = draftTeams.find((t) => t.name === teamName);
  if (!team) return;

  if (
    playerId &&
    draftTeams.some(
      (otherTeam) =>
        otherTeam.name !== team.name && otherTeam.captainIds.includes(playerId),
    )
  ) {
    return;
  }

  team.captainIds[index] = playerId;
  if (playerId && !team.players.includes(playerId)) {
    team.players.push(playerId);
  }

  updateTeamCaptains();
  reorderPickOrder();
  renderDraft();
}

function formatTeamName(name) {
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getTeamLogoPath(teamName) {
  const normalized = teamName.toLowerCase();
  return encodeURI(`../img/logo/${normalized}.png`);
}

function getTeamLogoMarkup(team) {
  const path = getTeamLogoPath(team.name);
  return `
    <img
      src="${path}"
      alt="Logo ${team.displayName}"
      class="team-logo"
      onerror="this.onerror=null;this.src='../img/logo/tbd.png'"
    />
  `;
}

function getAdvantageMarkup(team) {
  let advantage = "";
  if (!tieBreakerRunning) {
    for (let [pairKey, loserName] of lastTieLoserByPair) {
      if (loserName === team.name) {
        const [teamA, teamB] = pairKey.split("|");
        const winnerName = teamA === loserName ? teamB : teamA;
        const winnerTeam = draftTeams.find((t) => t.name === winnerName);
        if (!winnerTeam) continue;
        const path = getTeamLogoPath(winnerName);
        advantage += ` <img src="${path}" alt="Avantage ${winnerTeam.displayName}" style="width: 20px; height: 20px; object-fit: contain; border-radius: 3px; border: 1px solid #ccc; background: white;" onerror="this.onerror=null;this.src='../img/logo/tbd.png'" />`;
      }
    }
  }
  return advantage;
}

function getAvailablePlayers() {
  const assignedIds = new Set(
    draftTeams.flatMap((team) => [
      ...team.players,
      ...team.captainIds.filter(Boolean),
    ]),
  );
  return yearPlayers.filter(
    (player) => !assignedIds.has(player.id) && !player.captain,
  );
}

function getAvailableCaptains() {
  return yearPlayers.filter(
    (player) =>
      player.captain &&
      !draftTeams.some((team) => team.captainIds.includes(player.id)),
  );
}

function isCaptainSelectionComplete() {
  return draftTeams.every(
    (team) => team.captainIds.filter(Boolean).length === 2,
  );
}

function getTeamCurrentSum(team) {
  const picksSum = team.picks.reduce((sum, player) => sum + player.rating, 0);
  return team.captainSum + picksSum;
}

function getFirstTeamBaseline() {
  const firstTeam = pickOrder[0];
  if (!firstTeam || firstTeam.picks.length === 0) return null;
  return (
    firstTeam.captainSum +
    firstTeam.picks.reduce((sum, player) => sum + player.rating, 0)
  );
}

function getCurrentRound() {
  return Math.min(Math.floor(totalPicks / pickOrder.length) + 1, 9);
}

function getOrdinal(number) {
  if (number === 1) return "1er";
  return `${number}e`;
}

function getAllowedPlayers() {
  const currentTeam = pickOrder[currentPickIndex];
  const allAvailable = getAvailablePlayers();
  const baseline = getFirstTeamBaseline();

  if (currentPickIndex === 0 || baseline === null) {
    return {
      players: allAvailable.sort((a, b) => b.rating - a.rating),
      fallback: false,
      closestDiff: null,
    };
  }

  const candidates = allAvailable.map((player) => {
    const projectedSum = getTeamCurrentSum(currentTeam) + player.rating;
    const diff = Math.abs(projectedSum - baseline);
    return { player, diff };
  });

  const allowed = candidates
    .filter(({ diff }) => diff <= 2)
    .map(({ player }) => player)
    .sort((a, b) => b.rating - a.rating);

  if (allowed.length > 0) {
    return { players: allowed, fallback: false, closestDiff: null };
  }

  const closestDiff = Math.min(...candidates.map(({ diff }) => diff));
  const closestPlayers = candidates
    .filter(({ diff }) => diff === closestDiff)
    .map(({ player }) => player)
    .sort((a, b) => b.rating - a.rating);

  return { players: closestPlayers, fallback: true, closestDiff };
}

function renderDraft() {
  console.log("Rendering draft interface");
  renderCaptainSelection();
  renderRoundOrder();
  renderAvailablePlayers();
  renderDraftHistory();
  updateDraftStatus();
}

function updateDraftStatus() {
  const saved = localStorage.getItem(STATE_KEY);
  const statusEl = document.getElementById("draft-status");
  if (!statusEl) return;

  if (saved) {
    try {
      const state = JSON.parse(saved);
      const timestamp = new Date(state.timestamp).toLocaleString("fr-FR");
      statusEl.textContent = `✓ Brouillon sauvegardé: ${timestamp} (Pick #${state.totalPicks} / 36)`;
    } catch (e) {
      statusEl.textContent = "✓ Brouillon présent en mémoire";
    }
  } else {
    statusEl.textContent = "⚠ Aucun brouillon sauvegardé";
  }
}

function getPickOrderMarkup() {
  const rankNumbers = [];

  for (let index = 0; index < pickOrder.length; index += 1) {
    if (pendingTieGroups.length === 0) {
      rankNumbers[index] = index + 1;
      continue;
    }

    if (index === 0) {
      rankNumbers[index] = 1;
      continue;
    }

    const currentTotal = getTeamCurrentSum(pickOrder[index]);
    const previousTotal = getTeamCurrentSum(pickOrder[index - 1]);
    rankNumbers[index] =
      currentTotal === previousTotal ? rankNumbers[index - 1] : index + 1;
  }

  return pickOrder
    .map((team, index) => {
      const isCurrent = index === currentPickIndex;
      const rankLabel = `${rankNumbers[index]}.`;
      return `<li class="${isCurrent ? "current-pick-order" : ""}">
        <strong>${rankLabel}</strong> ${getTeamLogoMarkup(team)} ${team.displayName}${isCurrent ? " (actuel)" : ""}
      </li>`;
    })
    .join("");
}

function getLastTieResultMarkup() {
  const tieEntries = draftHistory.filter(
    (entry) => entry.type === "tie" && Array.isArray(entry.finalOrderTeamNames),
  );

  if (tieEntries.length === 0) return "";

  const maxPickNumber = Math.max(
    ...tieEntries.map((entry) => entry.pickNumber),
  );
  const lastTieEntries = tieEntries.filter(
    (entry) => entry.pickNumber === maxPickNumber,
  );

  const results = lastTieEntries
    .map((entry) => {
      const orderTeams = entry.finalOrderTeamNames
        .map((name) => draftTeams.find((team) => team.name === name))
        .filter(Boolean);

      if (orderTeams.length === 0) return "";

      return `
      <div class="tie-result">
        ${orderTeams
          .map(
            (team) =>
              `<span class="tie-order-item">${getTeamLogoMarkup(team)}</span>`,
          )
          .join('<span class="tie-arrow">→</span>')}
      </div>
    `;
    })
    .filter((result) => result !== "");

  return results.join("");
}

function renderRoundOrder() {
  const container = document.getElementById("round-order");
  const currentRound = getCurrentRound();
  const currentPickTotal = Math.min(totalPicks + 1, 36);

  if (totalPicks >= 36) {
    container.innerHTML = `
      <h2>Ordre de sélection</h2>
      <p>Ronde : <strong>9</strong> / 9 <span class="choice-number">(36e choix)</span></p>
      <p style="color: #28a745; font-weight: bold;">✅ Repêchage terminé</p>
      <div class="round-order">
        <ol>${getPickOrderMarkup()}</ol>
      </div>
    `;
    return;
  }

  const tieSection =
    pendingTieGroups.length > 0
      ? `<div class="tie-breaker-section">
      <p class="warning">
        Ex-aequo détecté&nbsp;: ${pendingTieGroups.length} groupe(s).
      </p>
      <p>${pendingTieGroups
        .map(
          (group, index) =>
            `
          <strong>Groupe ${index + 1}: </strong>${group
            .map((team) => team.displayName)
            .join(" / ")}`,
        )
        .join("<br/>")}
      </p>
      <button class="player-button" onclick="resolveTieBreaks()" ${
        tieBreakerRunning ? "disabled" : ""
      }>
        ${tieBreakerRunning ? "Tirage en cours…" : "Lancer le tirage ex-aequo"}
      </button>
      ${tieBreakerRunning ? `<div class="tie-breaker-animation">${tieBreakerStatus}</div>` : ""}</div>
    `
      : `<div class="tie-breaker-section">Dernier(s) Tirage(s) : ${getLastTieResultMarkup()}</div>`;

  container.innerHTML = `
    <h2>Ordre de sélection</h2>
    <p>Ronde : <strong>${currentRound}</strong> / 9 <span class="choice-number">(${getOrdinal(currentPickTotal)} choix)</span></p>
    ${tieSection}
    <div class="round-order">
      <ol>${getPickOrderMarkup()}</ol>
    </div>
  `;
}

function renderAvailablePlayers() {
  const container = document.getElementById("player-pool");
  const captainsReady = isCaptainSelectionComplete();
  const allAvailable = getAvailablePlayers();
  const currentTeam = pickOrder[currentPickIndex];
  const baseline = getFirstTeamBaseline();

  container.innerHTML = "<h2>Joueurs disponibles</h2>";

  if (totalPicks >= 36) {
    container.innerHTML += `
      <p class="warning" style="background: #d4edda; color: #155724; padding: 12px; border-radius: 8px;">
        🎉 Le repêchage est terminé! Tous les 36 choix ont été effectués.
      </p>
      <p>Vous pouvez maintenant enregistrer la saison avec le bouton ci-dessous.</p>
    `;
    return;
  }

  if (!captainsReady) {
    container.innerHTML += `
      <p class="warning">
        Sélectionnez d'abord les 2 capitaines de chaque équipe pour commencer le draft.
      </p>
    `;
    return;
  }

  if (pendingTieGroups.length > 0) {
    container.innerHTML += `
      <p class="warning">
        Un tirage ex-aequo est nécessaire avant de continuer.
      </p>
    `;
    return;
  }

  const { players: allowed, fallback, closestDiff } = getAllowedPlayers();

  if (allAvailable.length === 0) {
    container.innerHTML += "<p>Aucun joueur disponible pour le draft.</p>";
    return;
  }

  if (fallback) {
    container.innerHTML += `
      <p class="warning">
        Aucun joueur disponible dans l'écart ±2. Affichage des joueurs les plus proches (écart de ${closestDiff}).
      </p>
    `;
  } else if (allowed.length === 0) {
    container.innerHTML += `
      <p class="warning">
        Aucun joueur autorisé par la règle de différence de ±2 par rapport à la première équipe.
      </p>
    `;
  }

  const list = document.createElement("div");
  list.className = "draft-grid";

  allowed.forEach((player) => {
    const card = document.createElement("div");
    card.className = "available-player";
    const projectedSum = getTeamCurrentSum(currentTeam) + player.rating;
    const showDifference = baseline !== null && currentPickIndex !== 0;
    const difference = showDifference ? projectedSum - baseline : null;
    const differenceText =
      difference === null
        ? ""
        : `<span>(${difference >= 0 ? "+" : ""}${difference})</span>`;

    card.innerHTML = `
      <strong>${player.name} (${player.rating})</strong>
      <p>Nouvelle somme: ${projectedSum} ${differenceText}</p>
      <button class="player-button" onclick="pickPlayer(${player.id})">Choisir</button>
    `;
    list.appendChild(card);
  });

  container.appendChild(list);
}

function renderDraftHistory() {
  const container = document.getElementById("draft-history");
  container.innerHTML = "<h2>Historique des choix</h2>";

  if (draftHistory.length === 0) {
    container.innerHTML += "<p>Aucun choix effectué pour le moment.</p>";
    return;
  }

  const historyList = document.createElement("div");
  draftHistory.forEach((entry) => {
    const item = document.createElement("div");
    item.className = "draft-history-item";

    if (entry.type === "tie") {
      const orderTeams = (entry.finalOrderTeamNames || [])
        .map((name) => draftTeams.find((team) => team.name === name))
        .filter(Boolean);
      const orderMarkup = orderTeams.length
        ? orderTeams
            .map(
              (team) =>
                `<span class="tie-order-item">${getTeamLogoMarkup(team)}</span>`,
            )
            .join('<span class="tie-arrow">→</span>')
        : entry.finalOrder;

      item.innerHTML = `
        <div class="history-entry-tie">
          <span class="history-logo"></span>
          <span><strong>${entry.title}</strong> : ${entry.groupNames}</span>
          <div class="tie-result">${orderMarkup}</div>
        </div>
      `;
    } else {
      const team = draftTeams.find((t) => t.name === entry.teamName);
      const logo = team ? getTeamLogoMarkup(team) : "";
      item.innerHTML = `
        <div class="history-entry">
          <span class="history-logo">${logo}</span>
          <span><strong>${entry.team}</strong> a choisi <strong>${entry.playerName}</strong> (${entry.playerRating}) <span class="history-choice-number">(${getOrdinal(entry.pickNumber)} choix)</span></span>
        </div>
      `;
    }

    historyList.appendChild(item);
  });

  container.appendChild(historyList);
}

function pickPlayer(playerId) {
  if (totalPicks >= 36) {
    alert("Le repêchage est terminé! Tous les choix ont été effectués.");
    return;
  }

  if (pendingTieGroups.length > 0) {
    alert(
      "Tirage ex-aequo requis avant de continuer. Lancez le tirage puis choisissez le joueur.",
    );
    return;
  }

  if (!isCaptainSelectionComplete()) {
    alert("Sélectionnez d'abord les 2 capitaines de chaque équipe.");
    return;
  }

  const player = yearPlayers.find((candidate) => candidate.id === playerId);
  if (!player) return;

  const currentTeam = pickOrder[currentPickIndex];
  currentTeam.picks.push(player);
  currentTeam.players.push(player.id);

  draftHistory.push({
    team: currentTeam.displayName,
    teamName: currentTeam.name,
    playerName: player.name,
    playerRating: player.rating,
    teamTotal: getTeamCurrentSum(currentTeam),
    pickNumber: totalPicks + 1,
  });

  totalPicks += 1;
  currentPickIndex = totalPicks % pickOrder.length;
  if (currentPickIndex === 0) {
    // End of round, reorder pick order based on new totals
    reorderPickOrder();
  }
  saveDraftState();
  renderDraft();
}

async function saveSeason() {
  seasonData.teams = seasonData.teams.map((team) => {
    const draftTeam = draftTeams.find((draft) => draft.name === team.name);
    return {
      ...team,
      players: draftTeam ? draftTeam.players : team.players,
    };
  });

  const orderedSeason = {
    name: seasonData.name,
    winner: seasonData.winner,
    season_winner: seasonData.season_winner,
    teams: seasonData.teams,
    schedule: seasonData.schedule,
    playoffs: seasonData.playoffs,
  };

  try {
    const response = await fetch(
      `${BASE_URL}/save?filename=${YEAR}/season_${YEAR}.json`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderedSeason, null, 2),
      },
    );
    const result = await response.json();
    document.getElementById("save-message").textContent =
      result.message || "Liste de joueurs enregistrée.";
  } catch (error) {
    document.getElementById("save-message").textContent =
      "Erreur lors de l'enregistrement: " + error;
  }
}

initDraft();
