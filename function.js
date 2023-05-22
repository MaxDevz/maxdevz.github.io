function changeSeason() {
  const urlParams = new URLSearchParams(window.location.search);
  var page = urlParams.get("page");
  var season = document.getElementById("season").value;
  var url = page ? `/?page=${page}&season=${season}` : `/?season=${season}`;
  window.location.replace(url);
}
