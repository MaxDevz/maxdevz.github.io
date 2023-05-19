const app = {
  init: () => {
    document.addEventListener("DOMContentLoaded", app.load);
    console.log("HTML loaded");
  },
  load: () => {
    app.loadPage();
  },

  loadPage: (url) => {
    url = "./pages/seasons.html";
    const contentDiv = document.getElementById("page");
    fetch(url)
      .then((res) => {
        if (res.ok) {
          console.log(res);
          return res.text();
        }
      })
      .then((htmlPage) => {
        contentDiv.innerHTML = htmlPage;
      });
  },
};
app.init();
