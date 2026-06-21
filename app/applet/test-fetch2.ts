import axios from "axios";
axios.get("https://series.albesriali03.workers.dev/?action=series&url=https://a.alooytv13.xyz/genre/turki/100.html")
  .then(res => console.log(JSON.stringify(res.data, null, 2)))
  .catch(err => console.error(err));
