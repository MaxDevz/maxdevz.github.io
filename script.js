import players from "./data/players.json" assert { type: "json" };
import league from "./data/league.json" assert { type: "json" };
import defaultGame from "./data/default_game.json" assert { type: "json" };

var calendarHtml = "";
const app = {
  init: () => {
    document.addEventListener("DOMContentLoaded", app.load);
    console.log("HTML loaded");
  },

  load: () => {
    console.log(players);
    console.log(league);
    app.loadPage();
  },

  loadPage: () => {
    const urlParams = new URLSearchParams(window.location.search);
    var page = urlParams.get("page");

    if (page == "calendar") {
      app.createCalendar();
    } else {
      if (page != "ranking" && page != "stats") {
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
          app.setPageHtml(htmlPage);
        });
    }
  },

  setPageHtml(html) {
    const contentDiv = document.getElementById("page");
    contentDiv.innerHTML = html;
  },

  async createCalendar() {
    const urlParams = new URLSearchParams(window.location.search);
    var seasonSelected = urlParams.get("season");
    if (!league.seasons.includes(seasonSelected)) {
      const newDate = new Date();
      seasonSelected = newDate.getFullYear();
    }
    var seasonObject = league.seasons.find(
      (season) => season.name == seasonSelected
    );

    calendarHtml = `<div class="page-title">
        CALENDRIER
        <select name="season" id="season">
          <option value="2023">2023</option>
          <option value="2022">2022</option>
        </select>
      </div>`;

    for (const date of seasonObject.schedule) {
      const gameDate = new Date(date.date + "T00:00");
      const options = { year: "numeric", month: "long", day: "numeric" };

      calendarHtml += `<div class="date-card">
        <div class="date">${gameDate.toLocaleDateString("fr-CA", options)}</div>
        <div class="card-container">`;

      for (const game of date.games) {
        await app.createGame(game, seasonSelected, date);
      }

      calendarHtml += `</div></div>`;
    }

    app.setPageHtml(calendarHtml);
  },

  async createGame(game, season, date) {
    var homeStatsJson = defaultGame;
    var awayStatsJson = defaultGame;

    const homeStats = await fetch(
      `./data/${season}/${game.home}/${date.date}_${game.time}.json`
    );
    if (!homeStats.ok) {
      const message = `An error has occured: ${homeStats.status}`;
      console.log(message);
    } else {
      homeStatsJson = await homeStats.json();
    }

    const awayStats = await fetch(
      `./data/${season}/${game.away}/${date.date}_${game.time}.json`
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

    calendarHtml += `<div class="game">
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
                <a href="">
                  <img
                    alt="Logo"
                    class="calendar-logo"
                    src="./logo/${game.away.toLowerCase()}.png"
                  />
                  <span class="team-name">${game.away.replaceAll(
                    "_",
                    " "
                  )}</span>
                </a>
              </div>
              <div class="team ${
                awayPoints == homePoints
                  ? ""
                  : awayPoints < homePoints
                  ? "winner"
                  : "loser"
              }">
                <a href="">
                  <img
                    alt="Logo"
                    class="calendar-logo"
                    src="./logo/${game.home.toLowerCase()}.png"
                  />
                  <span class="team-name">${game.home.replaceAll(
                    "_",
                    " "
                  )}</span>
                </a>
              </div>
            </div>`;

    calendarHtml += `<div class="score">
          <table class="innings">
            <tr>`;

    for (let i = 0; i < homeStatsJson.innings.length; i++) {
      calendarHtml += `<th>${i + 1}</th>`;
    }
    calendarHtml += `</tr><tr>`;

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

      calendarHtml += `<td>${points}</td>`;
    });
    calendarHtml += `</tr><tr>`;

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

      calendarHtml += `<td>${points}</td>`;
    });

    calendarHtml += `</tr>
          </table>
          <table>
            <tr>
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

    calendarHtml += `</div></div>`;
  },
};
app.init();
