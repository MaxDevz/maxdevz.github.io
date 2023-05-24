import players from "./data/players.json" assert { type: "json" };
import league from "./data/league.json" assert { type: "json" };
import defaultGame from "./data/default_game.json" assert { type: "json" };

var pageHtml = "";
var seasonSelected = "";
var seasonJSON = "";
var playersInfo = null;
var playersStats = new Map();
var teamFiltered = "";

const PTS_BY_WIN = 2;
const PTS_BY_TIE = 1;

export const app = {
  init: () => {
    if(document.readyState !== 'loading') {
      app.load();
    }
    else {
      document.addEventListener("DOMContentLoaded", app.load);
    }
  },

  load: () => {
    window.app = app;
    console.log(players);
    console.log(league);
    app.getSeason();
    app.getTeamFiltered();
    app.getSeasonJSON();
    app.loadPage();
  },

  loadPage() {
    const urlParams = new URLSearchParams(window.location.search);
    var page = urlParams.get("page");

    var loadingText = "Chargement...";
    this.setLoadingSpinner(loadingText);

    switch (page) {
      case "ranking":
        this.createRanking();
        break;
      case "stats":
        this.createStats();
        break;
      default:
        this.createCalendar();
    }
  },

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

  getSeason() {
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

  getTeamFiltered() {
    const urlParams = new URLSearchParams(window.location.search);
    teamFiltered = urlParams.get("team");
  },

  getSeasonJSON() {
    seasonJSON = league.seasons.find((season) => season.name == seasonSelected);
  },

  formatDecimal(value) {
    return value >= 1
      ? (Math.round(value * 100) / 100).toFixed(2)
      : (Math.round(value * 100) / 100)
          .toFixed(3)
          .toString()
          .replace("0.", ".");
  },

  createPageTitle(title) {
    var html = `<div class="page-title">${title}<select name="season" id="season" onchange="app.changeSeason()">`;

    league.seasons.forEach((season) => {
      html += `<option value="${season.name}">${season.name}</option>`;
    });

    return (html += `</select></div>`);
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

    window.history.replaceState("", "", url);

    this.loadPage();
  },

  changeSeason() {
    const urlParams = new URLSearchParams(window.location.search);
    var page = urlParams.get("page");
    var season = document.getElementById("season").value;
    var url = page ? `/?page=${page}&season=${season}` : `/?season=${season}`;
    window.location.replace(url);
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

  async createStats() {
    var date = new Date();
    if (playersStats.size == 0) {
      for (const date of seasonJSON.schedule) {
        for (const game of date.games) {
          await this.createStatsMap(game, date);
        }
      }
    }

    pageHtml = this.createPageTitle("Statistiques");

    this.createTeamFilter();

    pageHtml += `<div class="stats">
      <table>
        <tr class="header">
          <th title="Rang" class="rank">RG</th>
          <th>Équipe</th>
          <th class="name">Nom</th>
          <th></th>
          <th title="Parties jouées">PJ</th>
          <th title="Apparitions au bâton">AB</th>
          <th title="Coups sûrs">CS</th>
          <th title="Moyenne au bâton">MAB</th>
          <th title="Présence sur les buts">PB</th>  
          <th title="Moyenne de présence sur les buts">MDP</th>  
          <th title="Coups de circuit">CC</th>
          <th title="Buts sur balles">BB</th>
          <th title="Retraits sans se rendre sur les buts">R0B</th>
          <th title="Optionnels">OPT</th>
          <th title="Erreurs">E</th>
          <th title="Sacrifices">SAC</th>
        </tr>`;

    playersStats = new Map(
      [...playersStats].sort((a, b) => b[1].CS / b[1].AB - a[1].CS / a[1].AB)
    );

    var index = 0;
    playersStats.forEach((player) => {
      if (!teamFiltered || teamFiltered == player.team) {
        index++;
        pageHtml += `<tr>
          <td class="rank">${index}</td>
          <td>
            <div class="team">
            <div class="team-link" onclick="app.selectTeam('${player.team.replaceAll(
              "'",
              "\\'"
            )}')">
                <img
                  title="${player.team.replaceAll("_", " ")}"
                  alt="Logo"
                  class="calendar-logo"
                  src="./logo/${player.team.toLowerCase()}.png"
                />
                </div>
              </div>
            </div>
          </td>
          <td class="name">${player.name}${
          player.captain ? `<span class="captain">C</span>` : ""
        }</td>
          <td class="rating">${player.rating}</td>
          <td>${player.gamesPlayed}</td>
          <td>${player.AB}</td>
          <td>${player.CS}</td>
          <th>${this.formatDecimal(player.CS / player.AB)}</th>
          <td>${player.PB}</td>
          <td>${this.formatDecimal(player.PB / (player.AB + player.BB))}</td>
          <td>${player.CC}</td>
          <td>${player.BB}</td>
          <td>${player.RB}</td>
          <td>${player.OPT}</td>
          <td>${player.ERR}</td>
          <td>${player.SAC}</td>
        <tr>`;
      }
    });

    pageHtml += `</table></div>`;
    pageHtml += `<div class="legend">
        <div class="legend-title">Légende</div>
        <div>
          <span class="captain">C</span> = Capitaine
          <span class="">RG</span> = Rang
          <span class="">PJ</span> = Parties jouées
          <span class="">AB</span> = Apparitions au bâton
          <span class="">CS</span> = Coups sûrs
          <span class="">MAB</span> = Moyenne au bâton
          <span class="">PB</span> = Présence sur les buts
          <span class="">MDP</span> = Moyenne de présence sur les buts
          <span class="">CC</span> = Coups de circuit
          <span class="">BB</span> = Buts sur balles
          <span class="">R0B</span> = Retraits sans se rendre sur les buts
          <span class="">OPT</span> = Optionnels
          <span class="">E</span> = Erreurs
          <span class="">SAC</span> = Sacrifices
        </div>
        
      </div>`;

    this.setPageHtml(pageHtml);
    console.log("Create Stats Delay: " + (new Date() - date));
  },

  async createStatsMap(game, date) {
    const games = await this.readGame(game, date);
    const homeStatsJson = games[0];
    const awayStatsJson = games[1];

    for (const inning of homeStatsJson.innings) {
      for (const hitter of inning.hitters) {
        await this.setPlayerMap(game, hitter, true);
      }
    }

    for (const inning of awayStatsJson.innings) {
      for (const hitter of inning.hitters) {
        await this.setPlayerMap(game, hitter, false);
      }
    }

    homeStatsJson.lineup.forEach((playerId) => {
      if (this.getTeamPlayers(game.home).includes(playerId)) {
        var hitterMap = playersStats.get(playerId);
        hitterMap.gamesPlayed += 1;
      }
    });

    awayStatsJson.lineup.forEach((playerId) => {
      if (this.getTeamPlayers(game.away).includes(playerId)) {
        var hitterMap = playersStats.get(playerId);
        hitterMap.gamesPlayed += 1;
      }
    });
  },

  async setPlayerMap(game, hitter, isHome) {
    var teamName = isHome ? game.home : game.away;
    if (!this.getTeamPlayers(teamName).includes(hitter.id)) {
      hitter.id = 0;
      teamName = "ligueDuMercredi_logo";
    }
    var hitterMap = playersStats.get(hitter.id);

    if (hitterMap) {
      if (!hitter.BB) hitterMap.AB += 1;
      if (hitter.bags == "4B") hitterMap.P += 1;
      if (hitter.bags != "0B") hitterMap.PB += 1;
      if (hitter.CS) hitterMap.CS += 1;
      if (hitter.R) hitterMap.R += 1;
      if (hitter.CC) hitterMap.CC += 1;
      if (hitter.BB) hitterMap.BB += 1;
      if (hitter.bags == "0B" && hitter.R) hitterMap.RB += 1;
      if (hitter.OPT) hitterMap.OPT += 1;
      if (hitter.ERR) hitterMap.ERR += 1;
      if (hitter.SAC) hitterMap.SAC += 1;
      playersStats.set(hitter.id, hitterMap);
    } else {
      var info = await this.getPlayerInfo(hitter.id);
      const stats = {
        name: this.getPlayerName(hitter.id),
        rating: info.rating,
        captain: info.captain,
        team: teamName,
        gamesPlayed: 0,
        AB: hitter.BB ? 0 : 1,
        P: hitter.bags == "4B" ? 1 : 0,
        PB: hitter.bags != "0B" ? 1 : 0,
        CS: hitter.CS ? 1 : 0,
        R: hitter.R ? 1 : 0,
        CC: hitter.CC ? 1 : 0,
        BB: hitter.BB ? 1 : 0,
        RB: hitter.bags == "0B" && hitter.R ? 1 : 0,
        OPT: hitter.OPT ? 1 : 0,
        ERR: hitter.ERR ? 1 : 0,
        SAC: hitter.SAC ? 1 : 0,
      };
      playersStats.set(hitter.id, stats);
    }
  },

  createRanking() {
    pageHtml = this.createPageTitle("Classement");

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

  async createCalendar() {
    pageHtml = this.createPageTitle("Calendrier");

    this.createTeamFilter();

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
          await this.createGame(game, date);
        }
      }

      pageHtml += `</div></div>`;
    }

    this.setPageHtml(pageHtml);
  },

  async readGame(game, date) {
    var homeStatsJson = defaultGame;
    var awayStatsJson = defaultGame;

    if (new Date(date.date + "T00:00") <= new Date()) {
      const homeStats = await fetch(
        `./data/${seasonSelected}/${game.home}/${date.date}_${game.time}.json`
      );
      if (!homeStats.ok) {
        const message = `An error has occured: ${homeStats.status}`;
        console.log(message);
      } else {
        homeStatsJson = await homeStats.json();
      }

      const awayStats = await fetch(
        `./data/${seasonSelected}/${game.away}/${date.date}_${game.time}.json`
      );
      if (!awayStats.ok) {
        const message = `An error has occured: ${awayStats.status}`;
        console.log(message);
      } else {
        awayStatsJson = await awayStats.json();
      }
    }

    return [homeStatsJson, awayStatsJson];
  },

  async createGame(game, date) {
    const games = await this.readGame(game, date);
    const homeStatsJson = games[0];
    const awayStatsJson = games[1];

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
          <div class="time">${game.time}</div>
          <div id="confrontation" class="confrontation">
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
  },
};
app.init();
