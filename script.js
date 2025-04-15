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
var isPlayoffs = false;
var subStats = false;
var randomLineup = false;

var players;
var seasons;
var defaultGame;
var columns;
var rules;
var sponsors;

const PTS_BY_WIN = 2;
const PTS_BY_TIE = 1;

export const app = {
  async init() {
    var response = await fetch("./data/players.json");
    players = await response.json();

    response = await fetch("./data/seasons.json");
    seasons = await response.json();

    response = await fetch("./data/default_game.json");
    defaultGame = await response.json();

    response = await fetch("./data/columns.json");
    columns = await response.json();

    response = await fetch("./data/rules.json");
    rules = await response.json();

    response = await fetch("./data/sponsors.json");
    sponsors = await response.json();

    app.setSeason();
    await app.setSeasonJSON(seasonSelected);

    if (document.readyState !== "loading") {
      app.load();
    } else {
      document.addEventListener("DOMContentLoaded", app.load);
    }
  },

  load: () => {
    window.app = app;

    app.setTeamFiltered();
    app.setGameDateTime();
    app.loadPage();
  },

  loadPage() {
    const urlParams = new URLSearchParams(window.location.search);
    var page = urlParams.get("page");
    var seasonParam = urlParams.get("season");

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
      case "lineup":
        this.createLineup();
        break;
      case "playoffs":
        this.createPlayoffs();
        break;
      case "player":
        this.createPlayerPage();
        break;
      case "rules":
        this.createRules();
        break;
      case "sponsors":
        this.createSponsors();
        break;
      default:
        if (
          seasonJSON.playoffs &&
          seasonJSON.playoffs.length > 0 &&
          seasonJSON.playoffs[0].games[0].home !== "TBD" &&
          !seasonParam
        ) {
          this.createPlayoffs();
        } else {
          this.createCalendar();
        }
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
      const options = { year: "numeric", month: "long", day: "numeric" };
      const now = Date.now();
      var nextGameDate = null;
      var nextGames = null;
      for (const date of seasonJSON.schedule) {
        const gameDate = new Date(date.date + "T23:59");
        if (now <= gameDate) {
          nextGameDate = gameDate;
          nextGames = date;
          break;
        }
      }

      if (!nextGameDate) {
        for (const date of seasonJSON.playoffs) {
          const gameDate = new Date(date.date + "T23:59");
          if (now <= gameDate) {
            nextGameDate = gameDate;
            nextGames = date;
            break;
          }
        }
      }

      if (nextGames && nextGameDate) {
        var time_difference =
          new Date(nextGameDate).getTime() - new Date(now).getTime();

        //calculate days difference by dividing total milliseconds in a day
        var days_difference = Math.round(
          time_difference / (1000 * 60 * 60 * 24)
        );
        var daysLeft = "";
        switch (days_difference) {
          case 0:
            daysLeft = `Aujourd'hui`;
            break;
          case 1:
            daysLeft = `Demain`;
            break;
          default:
            daysLeft = `${days_difference} jours restants`;
        }

        pageHtml += `<div class="date-card">
        <div class="nextGame">
          <div class="date nextGame">Prochain Match - ${nextGameDate.toLocaleDateString(
            "fr-CA",
            options
          )}</div>
          <span>${daysLeft}</span>
        </div>
        <div class="card-container">`;

        for (const game of nextGames.games) {
          if (
            !teamFiltered ||
            teamFiltered == game.home ||
            teamFiltered == game.away
          ) {
            await this.createNextGameCalendar(game, nextGames.date);
          }
        }

        pageHtml += `</div></div>`;
      }

      for (const date of seasonJSON.schedule) {
        const gameDate = new Date(date.date + "T00:00");

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

      if (seasonJSON.playoffs) {
        await this.createPlayoffsCalendar();
      }
    }

    this.setPageHtml(pageHtml);
  },

  async createGameCalendar(game, date) {
    var homePoints = 0;
    var homeHits = 0;
    var homeErrors = 0;

    var awayPoints = 0;
    var awayHits = 0;
    var awayErrors = 0;

    if (!homeStatsJson) {
      homeStatsJson = await this.readGame(game, date, true);
    }
    if (!awayStatsJson) {
      awayStatsJson = await this.readGame(game, date, false);
    }

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

    if (game.homePoints && game.awayPoints) {
      homePoints = game.homePoints;
      awayPoints = game.awayPoints;
    }

    pageHtml += `<div class="game">
          <div class="time">${game.time}`;

    if (game.rescheduled || game.game_number) {
      var note = `Partie ${game.game_number} de 3`;
      if (game.game_number == 3) {
        note += ` (Si Nécessaire)`;
      }

      if (game.rescheduled) {
        const gameRescheduled = new Date(game.rescheduled + "T00:00");
        const options = { year: "numeric", month: "long", day: "numeric" };
        note = `(Reprise du ${gameRescheduled.toLocaleDateString(
          "fr-CA",
          options
        )})`;
      }

      pageHtml += `<span class="game-note">${note}</span>`;
    }

    pageHtml += `</div>
          <div id="confrontation" class="confrontation ${
            game.reported ? "reported" : ""
          }" ${
      game.reported || game.home == "TBD" || game.away == "TBD"
        ? ""
        : "onclick=\"app.selectGame('" + date + "_" + game.time + "')\""
    }>
            <div class="reported">Partie reportée : ${game.reported}</div>
            <div id="teams" class="teams">
              <div class="team ${
                awayPoints == homePoints
                  ? ""
                  : awayPoints > homePoints
                  ? "winner"
                  : "loser"
              }">
                <div class="team-group">
                <a class="team-link" ${
                  game.away != "TBD"
                    ? `href="?page=stats&season=${seasonSelected}&team=${game.away}"`
                    : ""
                }>
                  <img
                    alt="Logo"
                    class="calendar-logo"
                    src="./img/logo/${game.away.toLowerCase()}.png"
                  />
                  <div>
                  <div class="team-name">${this.formatTeamName(game.away)}</div>
                  <div class="team-record">${this.getTeamRecord(
                    game.away
                  )} ${this.formatPosition(game.away_position)}</div>
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
                  <a class="team-link" ${
                    game.home != "TBD"
                      ? ` href="?page=stats&season=${seasonSelected}&team=${game.home}"`
                      : ""
                  }>
                  <img
                    alt="Logo"
                    class="calendar-logo"
                    src="./img/logo/${game.home.toLowerCase()}.png"
                  />
                  <div>
                  <div class="team-name">${this.formatTeamName(game.home)}</div>
                  <div class="team-record">${this.getTeamRecord(
                    game.home
                  )} ${this.formatPosition(game.home_position)}</div>
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

  async createNextGameCalendar(game, date) {
    pageHtml += `<div class="game">
          <div class="time">${game.time}`;

    if (game.rescheduled || game.game_number) {
      var note = `Partie ${game.game_number} de 3`;
      if (game.game_number == 3) {
        note += ` (Si Nécessaire)`;
      }

      if (game.rescheduled) {
        const gameRescheduled = new Date(game.rescheduled + "T00:00");
        const options = { year: "numeric", month: "long", day: "numeric" };
        note = `(Reprise du ${gameRescheduled.toLocaleDateString(
          "fr-CA",
          options
        )})`;
      }

      pageHtml += `<span class="game-note">${note}</span>`;
    }

    pageHtml += `</div>
          <div id="confrontation" class="confrontation">
            <div class="teamNextGame">
              <div class="team-group">
                <img
                  alt="Logo"
                  class="calendar-logo"
                  src="./img/logo/${game.away.toLowerCase()}.png"
                />
              </div>
              VS
              <div class="team-group">
                <img
                  alt="Logo"
                  class="calendar-logo"
                  src="./img/logo/${game.home.toLowerCase()}.png"
                />
              </div>
            </div>`;

    pageHtml += `</div></div>`;
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
                  title="${this.formatTeamName(team.name)}"
                  alt="Logo"
                  class="calendar-logo"
                  src="./img/logo/${team.name.toLowerCase()}.png"
                />
                <div>
                  <div class="team-name">${this.formatTeamName(team.name)}</div>
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
  // Rules
  // ****************************

  createRules() {
    pageHtml = this.createPageTitle("Règlements", false);

    pageHtml += `<div class="rules"></div>
    <ol>`;

    rules.forEach((rule) => {
      pageHtml += `<li> ${rule}</li>`;
    });

    pageHtml += `</ol> <div class="bold">Bonne saison à tous!</div>`;

    this.setPageHtml(pageHtml);
  },

  // ****************************
  // Sponsors
  // ****************************

  createSponsors() {
    pageHtml = this.createPageTitle("NOS COMMANDITAIRES", false);

    pageHtml += `<div class="sponsors">`;

    sponsors.forEach((sponsor) => {
      pageHtml += `<div class="sponsor">
                      <img
                        title="${sponsor.name}"
                        alt="Logo"
                        class="sponsor-logo"
                        src="./img/logo/${sponsor.logo}.png"
                      />
                      <div class="rank">${sponsor.type}</div>
                      <div class="sponsor-name">${sponsor.name}</div>
                      <div class="address">${
                        sponsor.address
                      }<a target="_blank" href="https://www.google.ca/maps/place/${
        sponsor.address
      }"><i class="fas fa-map-marker-alt"></i></a></div>
                      ${
                        sponsor.site
                          ? `<a target="_blank" href="${sponsor.site}">${sponsor.site}</a>`
                          : ""
                      }
                      ${
                        sponsor.fb
                          ? `<div><a target="_blank" href="${sponsor.fb}"><i class="fab fa-facebook-square"></i></a></div>`
                          : ""
                      }
                    </div>`;
    });

    pageHtml += `</div>`;

    this.setPageHtml(pageHtml);
  },

  // ****************************
  // STATS
  // ****************************

  async createStats() {
    var dateStart = new Date();
    await this.createStatsSeasonOrPlayoffsMap();

    // Uncomment Export JSON in logs
    /*var statsArrayJson = [];
    playersStats.forEach((value, key) => {
      var statsJson = {
        id: key,
        stats: value,
      };
      statsArrayJson.push(statsJson);
    });

    console.log(JSON.stringify(statsArrayJson));*/

    pageHtml = this.createPageTitle("STATISTIQUES", true);

    this.createTeamFilter();

    this.createSortBy();

    if (this.hasSubstitute()) {
      this.createSubStatsFilter();
    }

    this.createRegularSeasonPlayoffsSwitch();

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
        </tr>`;

      var index = 0;

      playersStats.forEach((player, id) => {
        if (
          (!teamFiltered && subStats == true) ||
          (!teamFiltered && subStats == false && !player.isSubstitute) ||
          teamFiltered == player.team
        ) {
          index++;

          var imgName = player.team.toLowerCase();
          var imgTitle = this.formatTeamName(player.team);
          if (player.isSubstitute) {
            imgName = "liguebrasserieduboulevard_logo";
            imgTitle = "Substitut";
          }

          pageHtml += `<tr>
            <td class="rank">${index}</td>
            <td>
              <div class="team">
              <div>
                  <img
                    title="${imgTitle}"
                    alt="Logo"
                    class="calendar-logo"
                    src="./img/logo/${imgName}.png"
                  />
                  </div>
                </div>
              </div>
            </td>
            <td class="name">
              <a class="team-link" href="?page=player&id=${
                isNaN(id) ? id.replace("_S", "") : id
              }">
                ${player.name}${
            player.captain ? `<span class="captain">C</span>` : ""
          }
              </a>
            </td>
          <tr>`;
        }
      });

      pageHtml += `</table></div><div class="sortable-columns"><table><tr class="header">`;

      columns.forEach((column) => {
        if (column.sortable && !(this.isGamePage() && column.short == "PJ")) {
          pageHtml += `<th ${
            column.short == "Cote" ? 'class="rating"' : ""
          } title="${column.description}" ${this.isSorted(
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

          pageHtml += `<tr>
          <td class="rating" ${this.isSorted("Cote")}>${player.rating}</td>`;
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

    var date = seasonJSON.schedule.find((date) => date.date == dateSelected);
    if (!date) {
      date = seasonJSON.playoffs.find((date) => date.date == dateSelected);
    }

    const game = date.games.find((game) => game.time == timeSelected);

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

    pageHtml += `<div>
    <div class="summary-selection">
      <button onclick="app.selectGameSummary(true)" ${
        gameSummary ? 'class="activated"' : ""
      }>Sommaire</button>
      <button onclick="app.selectGameSummary(false)" ${
        !gameSummary ? 'class="activated"' : ""
      }>Statistiques</button>
    </div>`;

    this.createGameButton(game);

    pageHtml += `<div class="team-selection">`;
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

    pageHtml += `</div></div>`;

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

    playersStats.forEach((player, id) => {
      if (!teamFiltered || teamFiltered == player.team) {
        index++;

        var imgName = player.team.toLowerCase();
        var imgTitle = this.formatTeamName(player.team);
        if (player.isSubstitute) {
          imgName = "liguebrasserieduboulevard_logo";
          imgTitle = "Substitut";
        }

        pageHtml += `<tr>
        <td class="rank">${index}</td>
        <td>
          <div class="team">
          <div>
              <img
                title="${imgTitle}"
                alt="Logo"
                class="calendar-logo"
                src="./img/logo/${imgName}.png"
              />
              </div>
            </div>
          </div>
        </td>
        <td class="name">
        <a class="team-link" href="?page=player&id=${
          isNaN(id) ? id.replace("_S", "") : id
        }">
                    ${player.name}${
          player.captain ? `<span class="captain">C</span>` : ""
        }
              </a>
        </td>
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
  // LINEUP
  // ****************************

  async createLineup() {
    pageHtml = this.createPageTitle("LINEUP", true);

    var random = randomLineup;

    await this.createStatsSeasonOrPlayoffsMap();

    var lineupMap = new Map();

    playersStats.forEach((player, id) => {
      var teamList = lineupMap.get(player.team);
      player.id = id;
      if (teamList) {
        teamList.push(player);
      } else {
        lineupMap.set(player.team, [player]);
      }
    });

    if (playersStats.size > 0) {
      this.createTeamFilter();
      if (!teamFiltered) {
        pageHtml += `<div class="card-container">`;
        seasonJSON.teams.forEach((team) => {
          this.createLineupCard(
            this.generateBestLineup(lineupMap.get(team.name)),
            false
          );
        });
        pageHtml += `</div>`;
      } else {
        pageHtml += `<div class="card-container suffleButton"><button class="card" onclick="app.shuffleLineup()"> <i class="fas fa-question"></i>Génération aléatoire</button></div>`;

        this.createLineupCard(
          this.generateBestLineup(lineupMap.get(teamFiltered)),
          random
        );
      }
    }

    this.setPageHtml(pageHtml);
  },

  // ****************************
  // PLAYOFFS
  // ****************************

  async createPlayoffs() {
    pageHtml = this.createPageTitle("PLAYOFFS", true);

    if (seasonJSON.playoffs) {
      await this.createPlayoffsBanner();
      if (seasonJSON.playoffs.length > 0) {
        await this.createPlayoffsTree();
      }
      await this.createPlayoffsCalendar();
    }
    this.setPageHtml(pageHtml);
  },

  async createPlayoffsCalendar() {
    if (seasonJSON.playoffs.length == 0) {
      pageHtml += `<div>Aucune horaire pour les playoffs</div>`;
    } else {
      for (const date of seasonJSON.playoffs) {
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
  },

  async createPlayoffsBanner() {
    pageHtml += `<div class="winner-section">
      <div class="banner">
      <div class="banner-top">
        <div class="banner-content">
          <div class="champions">CHAMPIONS</div>
          <img
            alt="Logo"
            class="winner-logo"
            src="./img/logo/${seasonJSON.winner.toLowerCase()}.png"
          />
          <div class="year">${seasonSelected}</div>
          <img
            alt="Logo"
            class="league-logo"
            src="./img/logo/tbd.png"
          />
        </div>
      </div>
      <div class="arrow-down"></div>
      </div>`;
    pageHtml += `<img
                    title="Photo des gagnants ${seasonSelected}"
                    class="winner-img"
                    src="./img/winners/winner_${seasonSelected}.jpg"
                    /></div>`;
  },

  async createPlayoffsTree() {
    pageHtml += `<div class="bracket">
                  <div class="round">
                    <div class="semi-final">${this.createTeams(
                      seasonJSON.playoffs[0].games[0],
                      false
                    )}</div>
                    <div class="semi-final">${this.createTeams(
                      seasonJSON.playoffs[0].games[1],
                      false
                    )}</div>
                  </div>
                  <div class="bracket-connector">
                    <img
                    class="connector"
                    src="./img/bracket-connector.png"
                    />
                  </div>
                  <div class="round">
                    <div class="final">${this.createTeams(
                      seasonJSON.playoffs[4]
                        ? seasonJSON.playoffs[4].games[0]
                        : seasonJSON.playoffs[3]
                        ? seasonJSON.playoffs[3].games[0]
                        : seasonJSON.playoffs[2].games[0],
                      true
                    )}</div>
                  </div>
                </div>`;
  },

  createTeams(game, final) {
    return `<div id="teams">
              <div class="team">
                <div class="team-group">
                  <div class="position">${game.home_position}</div>
                  <img
                    alt="Logo"
                    class="calendar-logo"
                    src="./img/logo/${game.home.toLowerCase()}.png"
                  />
                  <div>
                    <div class="team-name">${this.formatTeamName(
                      game.home
                    )}</div>
                    <div class="team-record">${this.getTeamRecord(game.home)}
                    </div>
                  </div>
                  ${this.createPlayoffsRecord(game.home, final)}
                </div>
              </div>
              <div class="team">
                <div class="team-group">
                  <div class="position">${game.away_position}</div>
                  <img
                    alt="Logo"
                    class="calendar-logo "
                    src="./img/logo/${game.away.toLowerCase()}.png"
                  />
                  <div>
                    <div class="team-name">${this.formatTeamName(
                      game.away
                    )}</div>
                    <div class="team-record">${this.getTeamRecord(game.away)}
                    </div>
                  </div>
                  ${this.createPlayoffsRecord(game.away, final)}
                </div>
              </div>
            </div>`;
  },

  createPlayoffsRecord(team, final) {
    var record = this.getSemiFinalRecord(team);
    if (final) {
      record = record = this.getFinalRecord(team);
    }

    return `<div class="playoffs-record">
              <div class="point ${record > 0 ? "active" : ""}"></div>
              <div class="point ${record > 1 ? "active" : ""}"></div>
            </div>`;
  },

  // ****************************
  // PLAYERS
  // ****************************

  async createPlayerPage() {
    const urlParams = new URLSearchParams(window.location.search);
    var id = urlParams.get("id");

    var infoActualSeason = null;
    var playerGeneralInfo = this.getPlayerGeneralInfo(id);
    var playerSeasons = new Map();
    var playerPlayoffs = new Map();
    var activeSeason = seasonSelected;
    var lastPlayedSeason = seasonSelected;

    for (const season of seasons) {
      playersStats = new Map();
      seasonSelected = season;
      isPlayoffs = false;
      await this.createStatsSeasonOrPlayoffsMap();
      await this.setSeasonJSON(season);

      var seasonStats = playersStats.get(+id);
      if (seasonStats) {
        if (infoActualSeason == null) {
          playersInfo = null;
          lastPlayedSeason = season;
          infoActualSeason = await this.getPlayerInfo(id);
        }

        seasonStats["winner"] = false;
        if (seasonJSON.winner == seasonStats.team) {
          seasonStats["winner"] = true;
        }
        playerSeasons.set(season, seasonStats);
      }

      var seasonStatsSub = playersStats.get(id + "_S");
      if (seasonStatsSub) {
        playerSeasons.set(season + "_S", seasonStatsSub);
      }

      isPlayoffs = true;
      playersStats = new Map();
      await this.createStatsSeasonOrPlayoffsMap();

      var playoffStats = playersStats.get(+id);
      if (playoffStats) {
        playoffStats["winner"] = false;
        if (seasonJSON.winner == seasonStats.team) {
          playoffStats["winner"] = true;
        }
        playerPlayoffs.set(season, playoffStats);
      }

      var playoffStatsSub = playersStats.get(id + "_S");
      if (playoffStatsSub) {
        playerPlayoffs.set(season + "_S", playoffStatsSub);
      }
    }

    seasonSelected = activeSeason;

    const fullName = playerGeneralInfo.name;
    const splitName = fullName.split(" ");
    const firstName = splitName[0];
    const lastName = splitName[1];

    var hasImage = await this.loadImage(id);
    var imageName = hasImage ? id : "placeholder_headshot";

    pageHtml = `<div>`;
    pageHtml += `
    <div class="playerHeader">
      <div class="nameHeadshot">
        <div class="playerHeadshot">
            <img
                id="headshot"
                title="${fullName}"
                alt="Logo"
                class="headshot"
                src="./img/headshots/${imageName}.jpg"
              />
           <img
              alt="Logo"
              class="playerTeam"
              src="./img/logo/${playerSeasons
                .get(lastPlayedSeason)
                .team.toLowerCase()}.png"
            />
        </div>  
        <div class="fullName">
          <div class="firstName">
            ${firstName}
            ${
              playerGeneralInfo.nickname
                ? `<span class="nickname">
              "${playerGeneralInfo.nickname}"
            </span>`
                : ""
            }
          </div>
          <div class="lastName">
            ${lastName} ${
      infoActualSeason.captain ? `<span class="captain-badge">C</span>` : ""
    }
    ${
      activeSeason == lastPlayedSeason
        ? '<span class="actif">Actif</span>'
        : `<span class="inactif">Inactif</span>`
    }
          </div>
          <div class="all-info">
            <div class="info-player">
              <div class="title">
              No.
              </div>
              <div class="value">
                ${infoActualSeason.number ? infoActualSeason.number : 0}
              </div>
            </div>
            <div class="info-player">
              <div class="title">
              Lance
              </div>
              <div class="value">
                ${playerGeneralInfo.throws}
              </div>
            </div>
            <div class="info-player">
              <div class="title">
              Frappe
              </div>
              <div class="value">
                ${playerGeneralInfo.bats}
              </div>
            </div>
            <div class="info-player">
              <div class="title">
              Cote
              </div>
              <div class="value">
                ${infoActualSeason.rating}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;

    pageHtml += `<div class="player-title">Saison</div><div class="stats">`;

    if (playerSeasons.size == 0) {
      pageHtml += `<div>Aucune statistique pour cette saison</div>`;
    } else {
      pageHtml += `<div class="unsortable-columns"><table>
        <tr class="header">
          <th title="Rang" class="rank">Année</th>
          <th>Équipe</th>
        </tr>`;

      playerSeasons.forEach((stats, id) => {
        var imgName = stats.team.toLowerCase();
        var imgTitle = this.formatTeamName(stats.team);
        if (stats.isSubstitute) {
          imgName = "liguebrasserieduboulevard_logo";
          imgTitle = "Substitut";
        }

        pageHtml += `<tr ${id.includes("_S") ? 'class="subs"' : ""}>
          <td class="rank">${id.includes("_S") ? id.replace("_S", "") : id}</td>
          <td>
            <div class="team">
            <div class="team-stats">
            ${
              id.includes("_S")
                ? ""
                : `
                <a class="team-link" href="?page=stats&season=${id}&team=${imgName}">
                <img 
                  title="${imgTitle}" 
                  alt="Logo" 
                  class="stats-logo"
                  src="./img/logo/${imgName}.png"
                />
                </a>`
            }
                <div>
                  <div class="team-name">${imgTitle}</div>
                </div>
                ${stats.captain ? `<span class="captain">C</span>` : ""}
                ${stats.winner ? `<i class="fas fa-trophy"></i>` : ""}
                </div>
              </div>
            </div>
          </td>
        <tr>`;
      });

      pageHtml += `</table></div><div class="sortable-columns"><table><tr class="header">`;

      columns.forEach((column) => {
        if (column.sortable) {
          pageHtml += `<th title="${column.description}" ${
            column.short == "Cote" ? 'class="rating"' : ""
          }>${column.short}</th>`;
        }
      });

      pageHtml += `</tr>`;

      playerSeasons.forEach((stats, id) => {
        const fristGame2023CC = stats.fristGame2023CC
          ? stats.fristGame2023CC
          : 0;
        const fristGame2023AB = stats.fristGame2023AB
          ? stats.fristGame2023AB
          : 0;
        const tdb =
          stats.S +
          stats.double * 2 +
          stats.triple * 3 +
          (id == 2023 ? stats.CC - fristGame2023CC : stats.CC) * 4;
        const pmdp = stats.PB / (stats.AB + stats.BB);
        var mdp =
          id == 2023 ? tdb / (stats.AB - fristGame2023AB) : tdb / stats.AB;
        mdp = mdp ? mdp : 0;

        pageHtml += `<tr ${id.includes("_S") ? 'class="subs"' : ""}>
        <td class="rating"> ${id.includes("_S") ? "" : stats.rating}</td>`;
        pageHtml += `<td>${stats.PJ}</td>
          <td>${stats.AB}</td>
          <td>${stats.P}</td>
          <td>${stats.CS}</td>
          <td>${this.formatDecimal(stats.CS / stats.AB)}</td>
          <td>${stats.PB}</td>
          <td>${this.formatDecimal(pmdp)}</td>
          <td>${stats.S}</td>
          <td>${stats.double}</td>
          <td>${stats.triple}</td>
          <td>${stats.CC}</td>
          <td>${stats.GC}</td>
          <td>${tdb}</td>
          <td>${this.formatDecimal(mdp)}</td>
          <td>${this.formatDecimal(pmdp + mdp)}</td>
          <td>${stats.PP}</td>
          <td>${stats.BB}</td>
          <td>${stats.RB}</td>
          <td>${stats.OPT}</td>
          <td>${stats.ERR}</td>
          <td>${stats.SAC}</td>
        <tr>`;
      });
      pageHtml += `</table></div></div>`;
    }

    pageHtml += `<div class="player-title">Playoffs</div><div class="stats player-stats">`;

    if (playerPlayoffs.size == 0) {
      pageHtml += `<div>Aucune statistique pour cette saison</div>`;
    } else {
      pageHtml += `<div class="unsortable-columns"><table>
        <tr class="header">
          <th title="Rang" class="rank">Année</th>
          <th>Équipe</th>
        </tr>`;

      playerPlayoffs.forEach((stats, id) => {
        var imgName = stats.team.toLowerCase();
        var imgTitle = this.formatTeamName(stats.team);
        if (stats.isSubstitute) {
          imgName = "liguebrasserieduboulevard_logo";
          imgTitle = "Substitut";
        }

        pageHtml += `<tr ${id.includes("_S") ? 'class="subs"' : ""}>
          <td class="rank">${id.includes("_S") ? id.replace("_S", "") : id}</td>
          <td>
            <div class="team">
            <div class="team-stats">
            ${
              id.includes("_S")
                ? ""
                : `<img 
                  title="${imgTitle}" 
                  alt="Logo" 
                  class="stats-logo"
                  src="./img/logo/${imgName}.png"
                />`
            }
                <div>
                  <div class="team-name">${imgTitle}</div>
                </div>
                ${stats.captain ? `<span class="captain">C</span>` : ""}
                ${stats.winner ? `<i class="fas fa-trophy"></i>` : ""}
                </div>
              </div>
            </div>
          </td>
        <tr>`;
      });

      pageHtml += `</table></div><div class="sortable-columns"><table><tr class="header">`;

      columns.forEach((column) => {
        if (column.sortable) {
          pageHtml += `<th title="${column.description}" ${
            column.short == "Cote" ? 'class="rating"' : ""
          }>${column.short}</th>`;
        }
      });

      pageHtml += `</tr>`;

      playerPlayoffs.forEach((stats, id) => {
        const fristGame2023CC = stats.fristGame2023CC
          ? stats.fristGame2023CC
          : 0;
        const fristGame2023AB = stats.fristGame2023AB
          ? stats.fristGame2023AB
          : 0;
        const tdb =
          stats.S +
          stats.double * 2 +
          stats.triple * 3 +
          (id == 2023 ? stats.CC - fristGame2023CC : stats.CC) * 4;
        const pmdp = stats.PB / (stats.AB + stats.BB);
        var mdp =
          id == 2023 ? tdb / (stats.AB - fristGame2023AB) : tdb / stats.AB;
        mdp = mdp ? mdp : 0;

        pageHtml += `<tr ${id.includes("_S") ? 'class="subs"' : ""}>
        <td class="rating"> ${id.includes("_S") ? "" : stats.rating}</td>`;
        pageHtml += `<td>${stats.PJ}</td>
          <td>${stats.AB}</td>
          <td>${stats.P}</td>
          <td>${stats.CS}</td>
          <td>${this.formatDecimal(stats.CS / stats.AB)}</td>
          <td>${stats.PB}</td>
          <td>${this.formatDecimal(pmdp)}</td>
          <td>${stats.S}</td>
          <td>${stats.double}</td>
          <td>${stats.triple}</td>
          <td>${stats.CC}</td>
          <td>${stats.GC}</td>
          <td>${tdb}</td>
          <td>${this.formatDecimal(mdp)}</td>
          <td>${this.formatDecimal(pmdp + mdp)}</td>
          <td>${stats.PP}</td>
          <td>${stats.BB}</td>
          <td>${stats.RB}</td>
          <td>${stats.OPT}</td>
          <td>${stats.ERR}</td>
          <td>${stats.SAC}</td>
        <tr>`;
      });
      pageHtml += `</table></div></div>`;
    }

    pageHtml += `</div></div>`;

    this.setPageHtml(pageHtml);
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

  shuffleLineup() {
    randomLineup = true;
    this.loadPage();
    randomLineup = false;
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

  updateSeason() {
    var seasonPlayoffsValue =
      document.getElementById("season-playoffs").checked;
    if (isPlayoffs != seasonPlayoffsValue) {
      isPlayoffs = seasonPlayoffsValue;
      playersStats = new Map();
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

  shuffle(array) {
    let currentIndex = array.length,
      randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex != 0) {
      // Pick a remaining element.
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;

      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex],
        array[currentIndex],
      ];
    }

    return array;
  },

  formatDecimal(value) {
    return value >= 1
      ? (Math.round(value * 100) / 100).toFixed(2)
      : (Math.round(value * 1000) / 1000)
          .toFixed(3)
          .toString()
          .replace("0.", ".");
  },

  formatTeamName(value) {
    return value.split("-")[0].replaceAll("_", " ");
  },

  formatPosition(value) {
    var position;
    switch (value) {
      case 1:
        position = `(${value}er)`;
        break;
      case 2:
      case 3:
      case 4:
        position = `(${value}e)`;
        break;
      default:
        position = "";
    }
    return position;
  },

  async loadImage(id) {
    return new Promise((resolve) => {
      let img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = `./img/headshots/${id}.jpg`;
    });
  },

  createPageTitle(title, addSelect) {
    var html = `<div class="page-title">${title}`;

    if (addSelect) {
      html += `<select name="season" id="season" onchange="app.changeSeason()">`;

      seasons.forEach((season) => {
        html += `<option value="${season}">${season}</option>`;
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

  createRegularSeasonPlayoffsSwitch() {
    pageHtml += `
    <div class="season-playoffs">
      <span>Saison Régulière<span>
      <label class="switch">
        <input type="checkbox" id="season-playoffs" name="season-playoffs" onchange="app.updateSeason()" ${
          isPlayoffs ? "checked" : ""
        }>
        <span class="slider round"></span>
      </label>
      <span>Playoffs<span>
    </div>`;
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
          title="${this.formatTeamName(team.name)}"
          alt="Logo"
          class="logo-filter ${
            teamFiltered == team.name ? "team-selected" : ""
          }"
          src="./img/logo/${team.name.toLowerCase()}.png"
        />`;
    });

    pageHtml += `</div>`;
  },

  createLineupCard(teamLineup, random) {
    pageHtml += `<div class="lineup">`;
    pageHtml += `<div><table>
      <tr class="header">
        <th title="Rang" class="lineup-stats">RG</th>
        <th>Équipe</th>
        <th title="Rang" class="lineup-stats">#</th>
        <th class="name">Nom</th>
        <th class="lineup-stats">MAB</th>
        <th class="lineup-stats">PPP</th>
      </tr>`;

    if (random) {
      teamLineup = this.shuffle([...teamLineup]);
    }

    var index = 0;
    teamLineup.forEach((player) => {
      index++;
      if (player) {
        var imgName = player.team.toLowerCase();
        var imgTitle = this.formatTeamName(player.team);
        if (player.isSubstitute) {
          imgName = "liguebrasserieduboulevard_logo";
          imgTitle = "Substitut";
        }

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

        pageHtml += `<tr>
              <td class="lineup-stats">${index}</td>
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
                      src="./img/logo/${imgName}.png"
                    />
                    </div>
                  </div>
                </div>
              </td>
              <td class="lineup-stats">${
                player.number ? player.number : "-"
              }</td>
              <td class="name">
              <a class="team-link" href="?page=player&id=${
                isNaN(player.id) ? player.id.replace("_S", "") : player.id
              }">
                    ${player.name}${
          player.captain ? `<span class="captain">C</span>` : ""
        }
              </a>
            </td>
            <td class="lineup-stats">${this.formatDecimal(
              player.CS / player.AB
            )}</td>
            <td class="lineup-stats">${this.formatDecimal(pmdp + mdp)}</td>
            <tr>`;
      }
    });

    pageHtml += `</table></div></div>`;
  },

  async createStatsSeasonOrPlayoffsMap() {
    if (playersStats.size == 0) {
      var seasonPlayoffsStat = await this.readSeasonPlayoffsStats();
      if (seasonPlayoffsStat === undefined || seasonPlayoffsStat.size == 0) {
        var schedule = isPlayoffs ? seasonJSON.playoffs : seasonJSON.schedule;
        if (schedule) {
          for (const date of schedule) {
            if (new Date(date.date + "T00:00") <= new Date()) {
              for (const game of date.games) {
                homeStatsJson = null;
                awayStatsJson = null;
                await this.createStatsMap(game, date.date);
              }
            }
          }
        }
      } else {
        seasonPlayoffsStat.forEach((player) => {
          playersStats.set(player.id, player.stats);
        });
      }
    }
  },

  generateBestLineup(teamLineup) {
    var bestLineup = teamLineup;

    sortedColumn = "PPP";
    teamLineup = [...teamLineup].sort((a, b) =>
      this.sortByColumn([0, a], [0, b])
    );

    bestLineup[3] = teamLineup.shift();
    bestLineup[2] = teamLineup.shift();

    sortedColumn = "MAB";
    teamLineup = [...teamLineup].sort((a, b) =>
      this.sortByColumn([0, a], [0, b])
    );

    bestLineup[0] = teamLineup.shift();
    bestLineup[1] = teamLineup.shift();
    bestLineup[4] = teamLineup.shift();
    bestLineup[5] = teamLineup.shift();
    bestLineup[6] = teamLineup.shift();
    bestLineup[7] = teamLineup.shift();
    bestLineup[8] = teamLineup.shift();
    bestLineup[9] = teamLineup.shift();
    bestLineup[10] = teamLineup.shift();

    return bestLineup;
  },

  createGameButton(game) {
    pageHtml += `<div class="team-selection">`;
    pageHtml += `<button onclick="app.selectTeam('${game.home.replaceAll(
      "'",
      "\\'"
    )}')" ${
      teamFiltered == game.home ? 'class="activated"' : ""
    }><div class="side-name">Local</div>${this.formatTeamName(
      game.home
    )} </button>`;
    pageHtml += `<button onclick="app.selectTeam('${game.away.replaceAll(
      "'",
      "\\'"
    )}')" ${
      teamFiltered == game.away ? 'class="activated"' : ""
    }><div class="side-name">Visiteur</div>${this.formatTeamName(
      game.away
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
      case "Cote":
        return b[1].rating - a[1].rating;
      default:
        return b[1].CS / b[1].AB - a[1].CS / a[1].AB;
    }
  },

  isSorted(column) {
    return sortedColumn == column ||
      (column == "MAB" && !sortedColumn) ||
      (column == "MAB" && sortedColumn == "Cote")
      ? 'class="sorted"'
      : "";
  },

  isGamePage() {
    const urlParams = new URLSearchParams(window.location.search);
    var page = urlParams.get("page");
    return page == "game";
  },

  hasSubstitute() {
    for (let [key, value] of playersStats) {
      if (value.isSubstitute) {
        return true;
      }
    }
    return false;
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
          (player) => player == hitter.id
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
        teamName = "tbd";
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
          (isSubstitute ? "<span class='sub rank'>  Sub</span>" : ""),
        order: order,
        rating: info.rating,
        captain: isSubstitute ? false : info.captain,
        team: teamName,
        number: isSubstitute ? 0 : info.number,
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

    if (
      new Date(date + "T00:00") <= new Date() &&
      !game.reported &&
      !game.homePoints &&
      !game.awayPoints
    ) {
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

  async readSeasonPlayoffsStats() {
    var statsJson;
    const stats = await fetch(
      `./data/${seasonSelected}/stats_${
        isPlayoffs ? "playoff" : "season"
      }_${seasonSelected}.json`
    );

    if (!stats.ok) {
      const message = `An error has occured: ${stats.status}`;
      console.log(message);
    } else {
      statsJson = await stats.json();
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

    var lineup = document.getElementById("lineup");
    lineup.href = `/?page=lineup&season=${seasonSelected}`;

    var playoffs = document.getElementById("playoffs");
    playoffs.href = `/?page=playoffs&season=${seasonSelected}`;
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
    var team = seasonJSON.teams.find((team) => team.name == teamName);
    return team ? team.record : "0-0-0";
  },

  getSemiFinalRecord(teamName) {
    var team = seasonJSON.teams.find((team) => team.name == teamName);
    return team ? team.semiFinal : 0;
  },

  getFinalRecord(teamName) {
    var team = seasonJSON.teams.find((team) => team.name == teamName);
    return team ? team.final : 0;
  },

  getTeamPlayers(teamName) {
    return seasonJSON.teams.find((team) => team.name == teamName).players;
  },

  getPlayerName(id) {
    return players.players.find((player) => player.id == id).name;
  },

  getPlayerGeneralInfo(id) {
    return players.players.find((player) => player.id == id);
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

    if (!seasonSelected) {
      const gameDate = urlParams.get("game");
      if (gameDate) {
        seasonSelected = gameDate.split("-")[0];
      }
    }

    if (seasons.findIndex((season) => season == seasonSelected) == -1) {
      seasonSelected = seasons[0];
    }

    console.log("Season selected: " + seasonSelected);
  },

  setTeamFiltered() {
    const urlParams = new URLSearchParams(window.location.search);
    teamFiltered = urlParams.get("team");
  },

  async setSeasonJSON(seasonToLoad) {
    if (!seasonJSON || seasonJSON.name != seasonToLoad) {
      const seasonInfo = await fetch(
        `./data/${seasonToLoad}/season_${seasonToLoad}.json`
      );
      if (!seasonInfo.ok) {
        const message = `An error has occured: ${seasonInfo.status}`;
        console.log(message);
      } else {
        seasonJSON = await seasonInfo.json();
      }
    }
  },

  setGameDateTime() {
    const urlParams = new URLSearchParams(window.location.search);
    gameDateTime = urlParams.get("game");
  },
};
app.init();
