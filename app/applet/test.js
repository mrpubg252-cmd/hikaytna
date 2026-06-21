import fetch from "node-fetch";

fetch("https://series.albesriali03.workers.dev/?action=series&url=https://a.alooytv13.xyz/genre/turki/100.html")
  .then(res => res.json())
  .then(data => console.log(JSON.stringify(data, null, 2)))
  .catch(err => console.error(err));
