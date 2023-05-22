import players from "./data/players.json" assert { type: "json" };
import league from "./data/league.json" assert { type: "json" };
import defaultGame from "./data/default_game.json" assert { type: "json" };

var pageHtml = "";
var seasonSelected = "";
var seasonJSON = "";

const PTS_BY_WIN = 2;
const PTS_BY_TIE = 1;

const app = {
  init: () => {
    document.addEventListener("DOMContentLoaded", app.load);
    console.log("HTML loaded");
  },

  load: () => {
    console.log(players);
    console.log(league);
    app.getSeason();
    app.getSeasonJSON();
    app.loadPage();
  },

  loadPage() {
    const urlParams = new URLSearchParams(window.location.search);
    var page = urlParams.get("page");

    var loadingText = "Chargement...";
    this.setLoadingSpinner(loadingText);

    switch (page) {
      case "calendar":
        this.createCalendar();
        break;
      case "ranking":
        this.createRanking();
        break;
      default:
        if (page != "stats") {
          page = "home";
        }
        const url = `./pages/${page}.html`;

        fetch(url)
          .then((res) => {
            if (res.ok) {
              return res.text();
            }
          })
          .then((htmlPage) => {
            this.setPageHtml(htmlPage);
          });
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
    calendar.href = `/?page=calendar&season=${seasonSelected}`;

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

  getSeasonJSON() {
    seasonJSON = league.seasons.find((season) => season.name == seasonSelected);
  },

  createPageTitle(title) {
    var html = `<div class="page-title">${title}<select name="season" id="season" onchange="changeSeason()">`;

    league.seasons.forEach((season) => {
      html += `<option value="${season.name}">${season.name}</option>`;
    });

    return (html += `</select></div>`);
  },

  createRanking() {
    pageHtml = this.createPageTitle("Classement");

    pageHtml += `<div class="ranking">
      <table>
        <tr class="header">
          <th>Équipe</th>
          <th>PJ</th>
          <th>V</th>
          <th>D</th>
          <th>N</th>
          <th>PTS</th>
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

      return 0;
    });

    seasonJSON.teams.forEach((team) => {
      pageHtml += `<tr>
          <td>
            <div class="team">
              <a href="">
                <img
                  alt="Logo"
                  class="calendar-logo"
                  src="./logo/${team.name}.png"
                />
                <div>
                  <div class="team-name">${team.name.replaceAll("_", " ")}</div>
                </div>
              </a>
            </div>
          </td>`;
      var score = team.record.split("-");
      pageHtml += `<td>${
        parseInt(score[0], 10) + parseInt(score[1], 10) + parseInt(score[2], 10)
      }</td>
          <td>${score[0]}</td>
          <td>${score[1]}</td>
          <td>${score[2]}</td>
          <th>${
            parseInt(score[0], 10) * PTS_BY_WIN +
            parseInt(score[2], 10) * PTS_BY_TIE
          }</th>`;
      pageHtml += `</tr>`;
    });

    pageHtml += `</table></div>`;

    this.setPageHtml(pageHtml);
  },

  async createCalendar() {
    pageHtml = this.createPageTitle("Calendrier");

    for (const date of seasonJSON.schedule) {
      const gameDate = new Date(date.date + "T00:00");
      const options = { year: "numeric", month: "long", day: "numeric" };

      pageHtml += `<div class="date-card">
        <div class="date">${gameDate.toLocaleDateString("fr-CA", options)}</div>
        <div class="card-container">`;

      for (const game of date.games) {
        await this.createGame(game, date);
      }

      pageHtml += `</div></div>`;
    }

    this.setPageHtml(pageHtml);
  },

  async createGame(game, date) {
    var homeStatsJson = defaultGame;
    var awayStatsJson = defaultGame;

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
