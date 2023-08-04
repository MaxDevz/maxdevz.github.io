var pageHtml = "";
var seasonSelected = "";
var seasonJSON = "";
var playersInfo = null;
var homeStatsJson = null;
var awayStatsJson = null;
var playersStats = new Map();
var teamFiltered = "";
var sortedColumn = "";
var gameDateTime = "";
var gameSummary = true;
var subStats = false;

var players;
var league;
var defaultGame;
var columns;

const PTS_BY_WIN = 2;
const PTS_BY_TIE = 1;

export const app = {
  async init() {
    var response = await fetch("./data/players.json");
    players = await response.json();

    response = await fetch("./data/league.json");
    league = await response.json();

    response = await fetch("./data/default_game.json");
    defaultGame = await response.json();

    response = await fetch("./data/columns.json");
    columns = await response.json();

    if (document.readyState !== "loading") {
      app.load();
    } else {
      document.addEventListener("DOMContentLoaded", app.load);
    }
  },

  load: () => {
    window.app = app;

    app.setSeason();
    app.setTeamFiltered();
    app.setGameDateTime();
    app.setSeasonJSON(seasonSelected);
    app.loadPage();
  },

  loadPage() {
    const urlParams = new URLSearchParams(window.location.search);
    var page = urlParams.get("page");

    this.setLoadingSpinner("Chargement...");

    switch (page) {
      case "ranking":
        this.createRanking();
        break;
      case "stats":
        this.createStats();
        break;
      case "game":
        this.createGame();
        break;
      default:
        this.createCalendar();
    }
  },

  // ****************************
  // CALENDAR
  // ****************************

  async createCalendar() {
    pageHtml = this.createPageTitle("CALENDRIER", true);

    this.createTeamFilter();

    if (seasonJSON.schedule.length == 0) {
      pageHtml += `<div>Aucune horaire pour cette saison</div>`;
    } else {
      for (const date of seasonJSON.schedule) {
        const gameDate = new Date(date.date + "T00:00");
        const options = { year: "numeric", month: "long", day: "numeric" };

        pageHtml += `<div class="date-card">
        <div class="date">${gameDate.toLocaleDateString("fr-CA", options)}</div>
        <div class="card-container">`;

        for (const game of date.games) {
          if (
            !teamFiltered ||
            teamFiltered == game.home ||
            teamFiltered == game.away
          ) {
            await this.createGameCalendar(game, date.date);
          }
        }

        pageHtml += `</div></div>`;
      }
    }

    this.setPageHtml(pageHtml);
  },

  async createGameCalendar(game, date) {
    if (!homeStatsJson) {
      homeStatsJson = await this.readGame(game, date, true);
    }
    if (!awayStatsJson) {
      awayStatsJson = await this.readGame(game, date, false);
    }

    var homePoints = 0;
    var homeHits = 0;
    var homeErrors = 0;

    var awayPoints = 0;
    var awayHits = 0;
    var awayErrors = 0;

    homeStatsJson.innings.forEach((inning) => {
      inning.hitters.forEach((hitter) => {
        if (hitter.bags == "4B") {
          homePoints++;
        }
        if (hitter.CS) {
          homeHits++;
        }
        if (hitter.ERR) {
          awayErrors++;
        }
      });
    });

    awayStatsJson.innings.forEach((inning) => {
      inning.hitters.forEach((hitter) => {
        if (hitter.bags == "4B") {
          awayPoints++;
        }
        if (hitter.CS) {
          awayHits++;
        }
        if (hitter.ERR) {
          homeErrors++;
        }
      });
    });

    pageHtml += `<div class="game">
          <div class="time">${game.time}`;

    if (game.rescheduled) {
      const gameRescheduled = new Date(game.rescheduled + "T00:00");
      const options = { year: "numeric", month: "long", day: "numeric" };
      pageHtml += `<span class="rescheduled">(Reprise du ${gameRescheduled.toLocaleDateString(
        "fr-CA",
        options
      )})</span>`;
    }

    pageHtml += `</div>
          <div id="confrontation" class="confrontation ${
            game.reported ? "reported" : ""
          }" ${
      game.reported
        ? ""
        : "onclick=\"app.selectGame('" + date + "_" + game.time + "')\""
    }>
            <div class="reported">Partie reportée : ${game.reported}</div>
            <div id="teams">
              <div class="team ${
                awayPoints == homePoints
                  ? ""
                  : awayPoints > homePoints
                  ? "winner"
                  : "loser"
              }">
                <div class="team-group">
                  <a class="team-link" href="?page=stats&season=${seasonSelected}&team=${
      game.away
    }">
                  <img
                    alt="Logo"
                    class="calendar-logo"
                    src="./logo/${game.away.toLowerCase()}.png"
                  />
                  <div>
                  <div class="team-name">${game.away.replaceAll("_", " ")}</div>
                  <div class="team-record">${this.getTeamRecord(
                    game.away
                  )}</div>
                  </div>
                  </a>
                </div>
              </div>
              <div class="team ${
                awayPoints == homePoints
                  ? ""
                  : awayPoints < homePoints
                  ? "winner"
                  : "loser"
              }">
                <div class="team-group">
                  <a class="team-link" href="?page=stats&season=${seasonSelected}&team=${
      game.home
    }">
                  <img
                    alt="Logo"
                    class="calendar-logo"
                    src="./logo/${game.home.toLowerCase()}.png"
                  />
                  <div>
                  <div class="team-name">${game.home.replaceAll("_", " ")}</div>
                  <div class="team-record">${this.getTeamRecord(
                    game.home
                  )}</div>
                  </div>
                  </a>
                </div>
              </div>
            </div>`;

    pageHtml += `<div class="score">
          <table class="innings">
            <tr class="header">`;

    for (let i = 0; i < homeStatsJson.innings.length; i++) {
      pageHtml += `<th>${i + 1}</th>`;
    }
    pageHtml += `</tr><tr>`;

    awayStatsJson.innings.forEach((inning, index, array) => {
      var points = 0;
      if (index === array.length - 1 && inning.hitters.length == 0) {
        points = "X";
      } else {
        inning.hitters.forEach((hitter) => {
          if (hitter.bags == "4B") {
            points++;
          }
        });
      }

      pageHtml += `<td>${points}</td>`;
    });
    pageHtml += `</tr><tr>`;

    homeStatsJson.innings.forEach((inning, index, array) => {
      var points = 0;
      if (index === array.length - 1 && inning.hitters.length == 0) {
        points = "X";
      } else {
        inning.hitters.forEach((hitter) => {
          if (hitter.bags == "4B") {
            points++;
          }
        });
      }

      pageHtml += `<td>${points}</td>`;
    });

    pageHtml += `</tr>
          </table>
          <table>
            <tr class="header">
              <th>P</th>
              <th>CS</th>
              <th>E</th>
            </tr>
            <tr>
              <th>${awayPoints}</th>
              <th>${awayHits}</th>
              <th>${awayErrors}</th>
            </tr>
            <tr>
              <th>${homePoints}</th>
              <th>${homeHits}</th>
              <th>${homeErrors}</th>
            </tr>
          </table>
        </div>`;

    pageHtml += `</div></div>`;

    homeStatsJson = null;
    awayStatsJson = null;
  },

  // ****************************
  // RANKING
  // ****************************

  createRanking() {
    pageHtml = this.createPageTitle("CLASSEMENT", true);

    pageHtml += `<div class="ranking">
      <table>
        <tr class="header">
          <th title="Rang" class="rank">RG</th>
          <th>Équipe</th>
          <th title="Parties jouées">PJ</th>
          <th title="Victoires">V</th>
          <th title="Défaites">D</th>
          <th title="Partie Nulle">N</th>     
          <th title="Pourcentage de victoire">%V</th>
          <th title="Points">PTS</th>
          <th title="Points marqués" >PM</th>
          <th title="Points alloués">PA</th>
          <th title="Différentiel">Diff.</th>
        </tr>`;

    seasonJSON.teams.sort((a, b) => {
      const scoreA = a.record.split("-");
      const scoreB = b.record.split("-");

      const ptsA =
        parseInt(scoreA[0], 10) * PTS_BY_WIN +
        parseInt(scoreA[2], 10) * PTS_BY_TIE;
      const ptsB =
        parseInt(scoreB[0], 10) * PTS_BY_WIN +
        parseInt(scoreB[2], 10) * PTS_BY_TIE;

      if (ptsA > ptsB) {
        return -1;
      }
      if (ptsA < ptsB) {
        return 1;
      }

      const diffA = a.ptsFor - a.ptsAgainst;
      const diffB = b.ptsFor - b.ptsAgainst;

      if (diffA > diffB) {
        return -1;
      }
      if (diffA < diffB) {
        return 1;
      }

      return 0;
    });

    seasonJSON.teams.forEach((team, index) => {
      pageHtml += `<tr>
          <td class="rank">${index + 1}</td>
          <td>
            <div class="team">
              <a class="team-link" href="?page=stats&season=${seasonSelected}&team=${
        team.name
      }">
                <img
                  title="${team.name.replaceAll("_", " ")}"
                  alt="Logo"
                  class="calendar-logo"
                  src="./logo/${team.name.toLowerCase()}.png"
                />
                <div>
                  <div class="team-name">${team.name.replaceAll("_", " ")}</div>
                </div>
              </a>
            </div>
          </td>`;

      var score = team.record.split("-");
      const diff = team.ptsFor - team.ptsAgainst;
      const v = parseInt(score[0], 10);
      const d = parseInt(score[1], 10);
      const n = parseInt(score[2], 10);
      const pj = v + d + n;
      const pourcentageV = v / pj;

      pageHtml += `<td>${pj}</td>
          <td>${score[0]}</td>
          <td>${score[1]}</td>
          <td>${score[2]}</td>
          <td>${this.formatDecimal(pourcentageV)}</td>
          <th>${
            parseInt(score[0], 10) * PTS_BY_WIN +
            parseInt(score[2], 10) * PTS_BY_TIE
          }</th>
          <td>${team.ptsFor ? team.ptsFor : "-"}</td>
          <td>${team.ptsAgainst ? team.ptsAgainst : "-"}</td>
          <td class="${diff > 0 ? "positive" : diff < 0 ? "negative" : ""}">${
        diff ? diff : "-"
      }</td>`;
      pageHtml += `</tr>`;
    });

    pageHtml += `</table></div>`;
    pageHtml += `<div class="legend">
        <div class="legend-title">Légende</div>
        <div>
          <span class="">RG</span> = Rang
          <span class="">PJ</span> = Parties jouées
          <span class="">V</span> = Victoires
          <span class="">D</span> = Défaites
          <span class="">N</span> = Parties Nulles
          <span class="">%V</span> = Pourcentage de victoire
          <span class="">PTS</span> = Points
          <span class="">PM</span> = Points marqués
          <span class="">PA</span> = Points alloués
          <span class="">Diff.</span> = Différentiel
        </div>
        
      </div>`;

    this.setPageHtml(pageHtml);
  },

  // ****************************
  // STATS
  // ****************************

  async createStats() {
    var dateStart = new Date();
    if (playersStats.size == 0) {
      for (const date of seasonJSON.schedule) {
        if (new Date(date.date + "T00:00") <= new Date()) {
          for (const game of date.games) {
            homeStatsJson = null;
            awayStatsJson = null;
            await this.createStatsMap(game, date.date);
          }
        }
      }
    }

    pageHtml = this.createPageTitle("STATISTIQUES", true);

    this.createTeamFilter();

    this.createSortBy();

    this.createSubStatsFilter();

    this.createStatsTable(
      seasonSelected == 2023
        ? "*La première partie de la saison n'est pas inclut dans le TDB et la MDP ainsi que les PP"
        : null,
      true
    );

    this.setPageHtml(pageHtml);
    console.log("Create Stats Delay: " + (new Date() - dateStart));
  },

  createStatsTable(note, asBorderTop) {
    if (!this.isGamePage()) {
      playersStats = new Map(
        [...playersStats].sort((a, b) => this.sortByColumn(a, b))
      );
    }

    pageHtml += `<div class="stats-container"><div class="stats ${
      !asBorderTop ? "no-border-radius-top" : ""
    }">`;

    if (playersStats.size == 0) {
      pageHtml += `<div>Aucune statistique pour cette ${
        this.isGamePage() ? "partie" : "saison"
      }</div>`;
    } else {
      pageHtml += `<div class="unsortable-columns"><table>
        <tr class="header">
          <th title="Rang" class="rank">RG</th>
          <th>Équipe</th>
          <th class="name">Nom</th>
          <th></th>
        </tr>`;

      var index = 0;

      playersStats.forEach((player) => {
        if (
          (!teamFiltered && subStats == true) ||
          (!teamFiltered && subStats == false && !player.isSubstitute) ||
          teamFiltered == player.team
        ) {
          index++;

          var imgName = player.team.toLowerCase();
          var imgTitle = player.team.replaceAll("_", " ");
          if (player.isSubstitute) {
            imgName = "liguedumercredi_logo";
            imgTitle = "Substitut";
          }

          pageHtml += `<tr>
            <td class="rank">${index}</td>
            <td>
              <div class="team">
              <div class="team-link" onclick="app.selectTeam('${player.team.replaceAll(
                "'",
                "\\'"
              )}')">
                  <img
                    title="${imgTitle}"
                    alt="Logo"
                    class="calendar-logo"
                    src="./logo/${imgName}.png"
                  />
                  </div>
                </div>
              </div>
            </td>
            <td class="name">${player.name}${
            player.captain ? `<span class="captain">C</span>` : ""
          }</td>
            <td class="rating">${player.rating}</td>
          <tr>`;
        }
      });

      pageHtml += `</table></div><div class="sortable-columns"><table><tr class="header">`;

      columns.forEach((column) => {
        if (column.sortable && !(this.isGamePage() && column.short == "PJ")) {
          pageHtml += `<th title="${column.description}" ${this.isSorted(
            column.short
          )} onclick="app.sortBy('${column.short}')">${column.short}</th>`;
        }
      });

      pageHtml += `</tr>`;

      playersStats.forEach((player) => {
        if (
          (!teamFiltered && subStats == true) ||
          (!teamFiltered && subStats == false && !player.isSubstitute) ||
          teamFiltered == player.team
        ) {
          const fristGame2023CC = player.fristGame2023CC
            ? player.fristGame2023CC
            : 0;
          const fristGame2023AB = player.fristGame2023AB
            ? player.fristGame2023AB
            : 0;
          const tdb =
            player.S +
            player.double * 2 +
            player.triple * 3 +
            (seasonSelected == 2023 ? player.CC - fristGame2023CC : player.CC) *
              4;
          const pmdp = player.PB / (player.AB + player.BB);
          var mdp =
            seasonSelected == 2023
              ? tdb / (player.AB - fristGame2023AB)
              : tdb / player.AB;
          mdp = mdp ? mdp : 0;

          pageHtml += `<tr>`;
          pageHtml += !this.isGamePage()
            ? `<td ${this.isSorted("PJ")}>${player.PJ}</td>`
            : "";
          pageHtml += `<td ${this.isSorted("AB")}>${player.AB}</td>
          <td ${this.isSorted("P")}>${player.P}</td>
          <td ${this.isSorted("CS")}>${player.CS}</td>
          <td ${this.isSorted("MAB")}>${this.formatDecimal(
            player.CS / player.AB
          )}</td>
          <td ${this.isSorted("PB")}>${player.PB}</td>
          <td ${this.isSorted("%MDP")}>${this.formatDecimal(pmdp)}</td>
          <td ${this.isSorted("S")}>${player.S}</td>
          <td ${this.isSorted("2B")}>${player.double}</td>
          <td ${this.isSorted("3B")}>${player.triple}</td>
          <td ${this.isSorted("CC")}>${player.CC}</td>
          <td ${this.isSorted("GC")}>${player.GC}</td>
          <td ${this.isSorted("TDB")}>${tdb}</td>
          <td ${this.isSorted("MDP")}>${this.formatDecimal(mdp)}</td>
          <td ${this.isSorted("PPP")}>${this.formatDecimal(pmdp + mdp)}</td>
          <td ${this.isSorted("PP")}>${player.PP}</td>
          <td ${this.isSorted("BB")}>${player.BB}</td>
          <td ${this.isSorted("R0B")}>${player.RB}</td>
          <td ${this.isSorted("OPT")}>${player.OPT}</td>
          <td ${this.isSorted("E")}>${player.ERR}</td>
          <td ${this.isSorted("SAC")}>${player.SAC}</td>
        <tr>`;
        }
      });
      pageHtml += `</table></div>`;
    }

    pageHtml += `</div></div>`;

    pageHtml += note ? `<div class="note">${note}</div>` : "";

    pageHtml += `<div class="legend">
        <div class="legend-title">Légende</div>
        <div>
          <span class="captain">C</span> = Capitaine
          <span class="">RG</span> = Rang`;

    columns.forEach((column) => {
      if (column.sortable) {
        pageHtml += `<span class="">${column.short}</span> = ${column.description}`;
      }
    });

    pageHtml += `</div></div>`;
  },

  // ****************************
  // GAME
  // ****************************

  async createGame() {
    var dateStart = new Date();

    var gameDateTimeSplit = gameDateTime.split("_");
    const dateSelected = gameDateTimeSplit[0];
    const timeSelected = gameDateTimeSplit[1];

    const date = seasonJSON.schedule.find((date) => date.date == dateSelected);
    const game = date.games.find((game) => game.time == timeSelected);
    this.setSeasonJSON(date.date.split("-")[0]);

    teamFiltered = teamFiltered ? teamFiltered : game.home;

    if (playersStats.size == 0) {
      await this.createStatsMap(game, dateSelected);
      sortedColumn = "RANG";

      playersStats = new Map(
        [...playersStats].sort((a, b) => this.sortByColumn(a, b))
      );
    }

    const gameDate = new Date(date.date + "T00:00");
    const options = { year: "numeric", month: "long", day: "numeric" };

    pageHtml = this.createPageTitle(
      `Sommaire - ${gameDate.toLocaleDateString(
        "fr-CA",
        options
      )} - ${timeSelected}`,
      false
    );

    pageHtml += `<div class="summary-selection">
      <button onclick="app.selectGameSummary(true)" ${
        gameSummary ? 'class="activated"' : ""
      }>Sommaire</button>
      <button onclick="app.selectGameSummary(false)" ${
        !gameSummary ? 'class="activated"' : ""
      }>Statistiques</button>
    </div>`;

    this.createGameButton(game);

    if (gameSummary) {
      await this.createGameSummary(game, date.date);
    } else {
      this.createStatsTable(
        seasonSelected == 2023
          ? "*La première partie de la saison n'est pas inclut dans le TDB et la MDP ainsi que les PP"
          : null,
        false
      );
    }

    this.setPageHtml(pageHtml);
    console.log("Create Game Stats Delay: " + (new Date() - dateStart));
  },

  async createGameSummary(game, date) {
    pageHtml += `<div class="summary no-border-radius-top">`;

    pageHtml += `<div class="unsortable-columns"><table>
    <tr class="header">
      <th title="Rang" class="rank">RG</th>
      <th>Équipe</th>
      <th class="name">Nom</th>
      <th></th>
    </tr>`;

    var index = 0;

    playersStats.forEach((player) => {
      if (!teamFiltered || teamFiltered == player.team) {
        index++;

        var imgName = player.team.toLowerCase();
        var imgTitle = player.team.replaceAll("_", " ");
        if (player.isSubstitute) {
          imgName = "liguedumercredi_logo";
          imgTitle = "Substitut";
        }

        pageHtml += `<tr>
        <td class="rank">${index}</td>
        <td>
          <div class="team">
          <div class="team-link" onclick="app.selectTeam('${player.team.replaceAll(
            "'",
            "\\'"
          )}')">
              <img
                title="${imgTitle}"
                alt="Logo"
                class="calendar-logo"
                src="./logo/${imgName}.png"
              />
              </div>
            </div>
          </div>
        </td>
        <td class="name">${player.name}${
          player.captain ? `<span class="captain">C</span>` : ""
        }</td>
      <tr>`;
      }
    });

    pageHtml += `</table></div>`;

    const stats = teamFiltered == game.home ? homeStatsJson : awayStatsJson;

    pageHtml += `<div class="sortable-columns">`;
    for (const inning of stats.innings) {
      const emptyPlayer = {
        bags: "field",
      };

      pageHtml += `<table>
        <tr class="header">
          <th>${inning.value}</th>
        </tr>`;

      for (let i = 0; i < stats.lineup.length; i++) {
        pageHtml += `<tr><td>`;
        const playerId = stats.lineup.at(i);
        const hitter = inning.hitters.find((hitter) => hitter.id == playerId);
        this.createAttendance(hitter ? hitter : emptyPlayer);
        pageHtml += `</td></tr>`;
      }

      pageHtml += `</table>`;
    }
    pageHtml += `</div></div>`;
  },

  createAttendance(attendance) {
    pageHtml += `<div class="attendance-summary">
      <div class="base">
        <span class="single ${attendance.S ? "activated" : ""}">1B</span>
        <span class="double ${attendance.double ? "activated" : ""}">2B</span>
        <span class="triple ${attendance.triple ? "activated" : ""}">3B</span>
        <span class="homerun ${attendance.CC ? "activated" : ""}">CC</span>
        <span class="base-on-balls ${
          attendance.BB ? "activated" : ""
        }">BB</span>
      </div>
      <span class="points ${attendance.PP ? "activated" : ""}">${
      attendance.PP ? attendance.PP : ""
    } PP</span>
      <img
        onclick=""
        title="${attendance.bags}"
        alt="${attendance.bags}"
        class="attendance"
        src="./img/${attendance.bags}.png"
      />
      <div class="opt-sac">
        <span class="optional ${attendance.OPT ? "activated" : ""}">Opt.</span>
        <span class="sacrifice ${attendance.SAC ? "activated" : ""}">Sac.</span>
      </div>
      <div class="out-error">
        <span class="error ${attendance.ERR ? "activated" : ""}">E</span>
        <span class="out ${attendance.R ? "activated" : ""}">R</span>
      </div>
    </div>`;
  },

  // ****************************
  // EVENT FUNCTION
  // ****************************

  selectGameSummary(value) {
    gameSummary = value;
    this.loadPage();
  },

  selectTeam(team) {
    const urlParams = new URLSearchParams(window.location.search);
    var page = urlParams.get("page");
    var url = "/?";

    if (page) {
      url += `page=${page}&`;
    }

    url += `season=${seasonSelected}`;

    if (teamFiltered == team) {
      teamFiltered = null;
    } else {
      teamFiltered = team;
      url += `&team=${team}`;
    }

    if (page != "game") {
      window.history.replaceState("", "", url);
    }

    this.loadPage();
  },

  changeSeason() {
    const urlParams = new URLSearchParams(window.location.search);
    var page = urlParams.get("page");
    var season = document.getElementById("season").value;
    var url = page ? `/?page=${page}&season=${season}` : `/?season=${season}`;
    window.location.replace(url);
  },

  updateSubs() {
    var subStatsValue = document.getElementById("sub-stats").checked;
    if (subStats != subStatsValue) {
      subStats = subStatsValue;
      this.loadPage();
    }
  },

  sortByWithSelect() {
    var column = document.getElementById("select-column").value;
    if (sortedColumn != column) {
      sortedColumn = column;
      this.loadPage();
    }
  },

  sortBy(column) {
    if (document.getElementById("select-column")) {
      document.getElementById("select-column").value = column;
    }
    if (sortedColumn != column) {
      sortedColumn = column;
      this.loadPage();
    }
  },

  selectGame(date) {
    window.location.href = `/?page=game&game=${date}`;
  },

  // ****************************
  // UTILS
  // ****************************

  formatDecimal(value) {
    return value >= 1
      ? (Math.round(value * 100) / 100).toFixed(2)
      : (Math.round(value * 100) / 100)
          .toFixed(3)
          .toString()
          .replace("0.", ".");
  },

  createPageTitle(title, addSelect) {
    var html = `<div class="page-title">${title}`;

    if (addSelect) {
      html += `<select name="season" id="season" onchange="app.changeSeason()">`;

      league.seasons.forEach((season) => {
        html += `<option value="${season.name}">${season.name}</option>`;
      });

      html += `</select>`;
    }

    return (html += `</div>`);
  },

  createSubStatsFilter() {
    pageHtml += `
    <div class="sort-by">
    <input type="checkbox" id="sub-stats" name="sub-stats" onchange="app.updateSubs()" ${
      subStats ? "checked" : ""
    }>
    Stats Substituts`;

    pageHtml += `</div>`;
  },

  createSortBy() {
    pageHtml += `
    <div class="sort-by">Trié par : 
      <select name="select-column" id="select-column" onchange="app.sortByWithSelect()">`;

    columns.forEach((column) => {
      if (column.sortable) {
        pageHtml += `<option value="${column.short}" ${
          sortedColumn == column.short ||
          (column.short == "MAB" && !sortedColumn)
            ? "selected"
            : ""
        }>${column.short}</option>`;
      }
    });

    pageHtml += `</select></div>`;
  },

  createTeamFilter() {
    pageHtml += `<div class="team-filter">`;

    seasonJSON.teams.forEach((team) => {
      pageHtml += `<img
          onclick="app.selectTeam('${team.name.replaceAll("'", "\\'")}')"
          title="${team.name.replaceAll("_", " ")}"
          alt="Logo"
          class="logo-filter ${
            teamFiltered == team.name ? "team-selected" : ""
          }"
          src="./logo/${team.name.toLowerCase()}.png"
        />`;
    });

    pageHtml += `</div>`;
  },

  createGameButton(game) {
    pageHtml += `<div class="team-selection">`;
    pageHtml += `<button onclick="app.selectTeam('${game.home.replaceAll(
      "'",
      "\\'"
    )}')" ${
      teamFiltered == game.home ? 'class="activated"' : ""
    }><div class="side-name">Local</div>${game.home.replaceAll(
      "_",
      " "
    )} </button>`;
    pageHtml += `<button onclick="app.selectTeam('${game.away.replaceAll(
      "'",
      "\\'"
    )}')" ${
      teamFiltered == game.away ? 'class="activated"' : ""
    }><div class="side-name">Visiteur</div>${game.away.replaceAll(
      "_",
      " "
    )} </button>`;

    pageHtml += `</div>`;
  },

  sortByColumn(a, b) {
    const fristGame2023CCA = a[1].fristGame2023CC ? a[1].fristGame2023CC : 0;
    const fristGame2023ABA = a[1].fristGame2023AB ? a[1].fristGame2023AB : 0;
    const tdbA =
      a[1].S +
      a[1].double * 2 +
      a[1].triple * 3 +
      (seasonSelected == 2023 ? a[1].CC - fristGame2023CCA : a[1].CC) * 4;

    const fristGame2023CCB = b[1].fristGame2023CC ? b[1].fristGame2023CC : 0;
    const fristGame2023ABB = b[1].fristGame2023AB ? b[1].fristGame2023AB : 0;
    const tdbB =
      b[1].S +
      b[1].double * 2 +
      b[1].triple * 3 +
      (seasonSelected == 2023 ? b[1].CC - fristGame2023CCB : b[1].CC) * 4;

    const pmdpA = a[1].PB / (a[1].AB + a[1].BB);
    const pmdpB = b[1].PB / (b[1].AB + b[1].BB);

    var mdpA =
      seasonSelected == 2023
        ? tdbA / (a[1].AB - fristGame2023ABA)
        : tdbA / a[1].AB;

    var mdpB =
      seasonSelected == 2023
        ? tdbB / (b[1].AB - fristGame2023ABB)
        : tdbB / b[1].AB;
    mdpA = mdpA ? mdpA : 0;
    mdpB = mdpB ? mdpB : 0;

    switch (sortedColumn) {
      case "PJ":
        return b[1].PJ - a[1].PJ;
      case "AB":
        return b[1].AB - a[1].AB;
      case "P":
        return b[1].P - a[1].P;
      case "CS":
        return b[1].CS - a[1].CS;
      case "PB":
        return b[1].PB - a[1].PB;
      case "%MDP":
        return pmdpB - pmdpA;
      case "S":
        return b[1].S - a[1].S;
      case "2B":
        return b[1].double - a[1].double;
      case "3B":
        return b[1].triple - a[1].triple;
      case "CC":
        return b[1].CC - a[1].CC;
      case "GC":
        return b[1].GC - a[1].GC;
      case "TDB":
        return tdbB - tdbA;
      case "MDP":
        return mdpB - mdpA;
      case "PPP":
        return pmdpB + mdpB - (pmdpA + mdpA);
      case "PP":
        return b[1].PP - a[1].PP;
      case "BB":
        return b[1].BB - a[1].BB;
      case "R0B":
        return b[1].RB - a[1].RB;
      case "OPT":
        return b[1].OPT - a[1].OPT;
      case "E":
        return b[1].ERR - a[1].ERR;
      case "SAC":
        return b[1].SAC - a[1].SAC;
      case "RANG":
        return a[1].order - b[1].order;
      default:
        return b[1].CS / b[1].AB - a[1].CS / a[1].AB;
    }
  },

  isSorted(column) {
    return sortedColumn == column || (column == "MAB" && !sortedColumn)
      ? 'class="sorted"'
      : "";
  },

  isGamePage() {
    const urlParams = new URLSearchParams(window.location.search);
    var page = urlParams.get("page");
    return page == "game";
  },

  async createStatsMap(game, date) {
    if (!homeStatsJson) {
      homeStatsJson = await this.readGame(game, date, true);
    }

    if (!awayStatsJson) {
      awayStatsJson = await this.readGame(game, date, false);
    }

    for (const inning of homeStatsJson.innings) {
      for (const hitter of inning.hitters) {
        var index = homeStatsJson.lineup.findIndex(
          (player) => player == hitter.id
        );
        await this.setPlayerMap(game, hitter, true, index);
      }
    }

    for (const inning of awayStatsJson.innings) {
      for (const hitter of inning.hitters) {
        var index = awayStatsJson.lineup.findIndex(
          (player) => player.id == hitter.id
        );
        await this.setPlayerMap(game, hitter, false, index);
      }
    }

    homeStatsJson.lineup.forEach((playerId) => {
      var hitterMap = playersStats.get(
        this.getTeamPlayers(game.home).includes(playerId)
          ? playerId
          : playerId + "_S"
      );
      if (!this.isGamePage()) {
        hitterMap.PJ += 1;
      }
      if (date == "2023-05-17") {
        hitterMap.fristGame2023AB = hitterMap.AB;
        hitterMap.fristGame2023CC = hitterMap.CC;
      }
    });

    awayStatsJson.lineup.forEach((playerId) => {
      var hitterMap = playersStats.get(
        this.getTeamPlayers(game.away).includes(playerId)
          ? playerId
          : playerId + "_S"
      );
      if (!this.isGamePage()) {
        hitterMap.PJ += 1;
      }
      if (date == "2023-05-17") {
        hitterMap.fristGame2023AB = hitterMap.AB;
        hitterMap.fristGame2023CC = hitterMap.CC;
      }
    });
  },

  async setPlayerMap(game, hitter, isHome, order) {
    var teamName = isHome ? game.home : game.away;

    var isSubstitute = false;
    var originalId = hitter.id;
    if (!this.getTeamPlayers(teamName).includes(hitter.id)) {
      isSubstitute = true;
      if (!this.isGamePage()) {
        hitter.id = hitter.id + "_S";
        teamName = "liguedumercredi_logo";
      }
    }
    var hitterMap = playersStats.get(hitter.id);

    if (hitterMap) {
      if (!hitter.BB) hitterMap.AB += 1;
      if (hitter.bags == "4B") hitterMap.P += 1;
      if (hitter.bags != "0B") hitterMap.PB += 1;
      if (hitter.CS) hitterMap.CS += 1;
      if (hitter.S) hitterMap.S += 1;
      if (hitter.double) hitterMap.double += 1;
      if (hitter.triple) hitterMap.triple += 1;
      if (hitter.R) hitterMap.R += 1;
      if (hitter.CC) hitterMap.CC += 1;
      if ((hitter.PP == 4) & hitter.CC) hitterMap.GC += 1;
      hitterMap.PP += hitter.PP ? hitter.PP : 0;
      if (hitter.BB) hitterMap.BB += 1;
      if (hitter.bags == "0B" && hitter.R) hitterMap.RB += 1;
      if (hitter.OPT) hitterMap.OPT += 1;
      if (hitter.ERR) hitterMap.ERR += 1;
      if (hitter.SAC) hitterMap.SAC += 1;
      playersStats.set(hitter.id, hitterMap);
    } else {
      var info = await this.getPlayerInfo(originalId);
      const stats = {
        name:
          this.getPlayerName(originalId) +
          (isSubstitute ? "<span class='rank'>  Sub</span>" : ""),
        order: order,
        rating: info.rating,
        captain: isSubstitute ? false : info.captain,
        team: teamName,
        PJ: 0,
        AB: hitter.BB ? 0 : 1,
        P: hitter.bags == "4B" ? 1 : 0,
        PB: hitter.bags != "0B" ? 1 : 0,
        CS: hitter.CS ? 1 : 0,
        S: hitter.S ? 1 : 0,
        double: hitter.double ? 1 : 0,
        triple: hitter.triple ? 1 : 0,
        CC: hitter.CC ? 1 : 0,
        GC: (hitter.PP == 4) & hitter.CC ? 1 : 0,
        PP: hitter.PP ? hitter.PP : 0,
        R: hitter.R ? 1 : 0,
        BB: hitter.BB ? 1 : 0,
        RB: hitter.bags == "0B" && hitter.R ? 1 : 0,
        OPT: hitter.OPT ? 1 : 0,
        ERR: hitter.ERR ? 1 : 0,
        SAC: hitter.SAC ? 1 : 0,
        isSubstitute: isSubstitute,
      };
      playersStats.set(hitter.id, stats);
    }
  },

  async readGame(game, date, isHome) {
    var statsJson = defaultGame;

    if (new Date(date + "T00:00") <= new Date()) {
      const stats = await fetch(
        `./data/${seasonSelected}/${isHome ? game.home : game.away}/${date}_${
          game.time
        }.json`
      );
      if (!stats.ok) {
        const message = `An error has occured: ${stats.status}`;
        console.log(message);
      } else {
        statsJson = await stats.json();
      }
    }

    return statsJson;
  },

  // ****************************
  // GETTER, SETTER
  // ****************************

  setSeasonSelector() {
    var selector = document.getElementById("season");
    if (selector) {
      selector.value = seasonSelected;
    }

    var ranking = document.getElementById("ranking");
    ranking.href = `/?page=ranking&season=${seasonSelected}`;

    var calendar = document.getElementById("calendar");
    calendar.href = `/?season=${seasonSelected}`;

    var stats = document.getElementById("stats");
    stats.href = `/?page=stats&season=${seasonSelected}`;
  },

  setPageHtml(html) {
    const contentDiv = document.getElementById("page");
    contentDiv.innerHTML = html;
    this.setSeasonSelector();
  },

  setLoadingSpinner(text) {
    const html = `<div class="loader"></div><span class="spinner-text">${text}</span>`;
    this.setPageHtml(html);
  },

  getTeamRecord(teamName) {
    return seasonJSON.teams.find((team) => team.name == teamName).record;
  },

  getTeamPlayers(teamName) {
    return seasonJSON.teams.find((team) => team.name == teamName).players;
  },

  getPlayerName(id) {
    return players.players.find((player) => player.id == id).name;
  },

  async getPlayerInfo(id) {
    if (!playersInfo) {
      const seasonInfo = await fetch(
        `./data/${seasonSelected}/players_${seasonSelected}.json`
      );
      if (!seasonInfo.ok) {
        const message = `An error has occured: ${seasonInfo.status}`;
        console.log(message);
      } else {
        playersInfo = await seasonInfo.json();
      }
    }

    return playersInfo.players.find((player) => player.id == id);
  },

  setSeason() {
    const urlParams = new URLSearchParams(window.location.search);
    seasonSelected = urlParams.get("season");
    if (
      league.seasons.findIndex((season) => season.name == seasonSelected) == -1
    ) {
      const newDate = new Date();
      seasonSelected = newDate.getFullYear();
    }
    console.log("Season selected: " + seasonSelected);
  },

  setTeamFiltered() {
    const urlParams = new URLSearchParams(window.location.search);
    teamFiltered = urlParams.get("team");
  },

  setSeasonJSON(seasonToLoad) {
    seasonJSON = league.seasons.find((season) => season.name == seasonToLoad);
  },

  setGameDateTime() {
    const urlParams = new URLSearchParams(window.location.search);
    gameDateTime = urlParams.get("game");
  },
};
app.init();
