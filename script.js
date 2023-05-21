import players from "./data/players.json" assert { type: "json" };
import league from "./data/league.json" assert { type: "json" };

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
    const contentDiv = document.getElementById("page");

    if (page == "calendar") {
      contentDiv.innerHTML = app.createCalendar();
    } else {
      if (page != "ranking" && page != "stats") {
        page = "home";
      }
      const url = `./pages/${page}.html`;

      const contentDiv = document.getElementById("page");
      fetch(url)
        .then((res) => {
          if (res.ok) {
            return res.text();
          }
        })
        .then((htmlPage) => {
          contentDiv.innerHTML = htmlPage;
        });
    }
  },

  createCalendar() {
    const urlParams = new URLSearchParams(window.location.search);
    var seasonSelected = urlParams.get("season");
    if (!league.seasons.includes(seasonSelected)) {
      const newDate = new Date();
      seasonSelected = newDate.getFullYear();
    }
    var seasonObject = league.seasons.find(
      (season) => season.name == seasonSelected
    );

    var calendarHtml = `<div class="page-title">
        CALENDRIER
        <select name="season" id="season">
          <option value="2023">2023</option>
          <option value="2022">2022</option>
        </select>
      </div>`;

    seasonObject.schedule.forEach((date) => {
      const gameDate = new Date(date.date + "T00:00");
      const options = { year: "numeric", month: "long", day: "numeric" };

      calendarHtml += `<div class="date-card">
        <div class="date">${gameDate.toLocaleDateString("fr-CA", options)}</div>
        <div class="card-container">`;

      date.games.forEach((game) => {
        calendarHtml += `<div class="game">
          <div class="time">${game.time}</div>
          <div id="confrontation" class="confrontation">
            <div id="teams">
              <div class="team">
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
              <div class="team">
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

        /*fetch(
          `./data/${seasonSelected}/${game.home}/${date.date}_${game.time}.json`
        )
          .then((response) => {
            if (response.ok) {
              return response.json();
            }
          })
          .then((json) => {
            console.log(json);
          })
          .catch(console.log("Not Found Away"));*/

        calendarHtml += `<div class="score">
          <table class="innings">
            <tr>
              <th>1</th>
              <th>2</th>
              <th>3</th>
              <th>4</th>
              <th>5</th>
              <th>6</th>
              <th>7</th>
              <th>8</th>
              <th>9</th>
            </tr>
            <tr>
              <td>0</td>
              <td>0</td>
              <td>0</td>
              <td>0</td>
              <td>0</td>
              <td>0</td>
              <td>0</td>
              <td>0</td>
              <td>0</td>
            </tr>
            <tr>
              <td>0</td>
              <td>0</td>
              <td>0</td>
              <td>0</td>
              <td>0</td>
              <td>0</td>
              <td>0</td>
              <td>0</td>
              <td>0</td>
            </tr>
          </table>
          <table>
            <tr>
              <th>P</th>
              <th>CS</th>
              <th>E</th>
            </tr>
            <tr>
              <th>0</th>
              <th>0</th>
              <th>0</th>
            </tr>
            <tr>
              <th>0</th>
              <th>0</th>
              <th>0</th>
            </tr>
          </table>
        </div>`;

        calendarHtml += `</div></div>`;
      });

      calendarHtml += `</div></div>`;
    });

    return calendarHtml;
  },
};
app.init();
