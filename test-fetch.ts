import axios from "axios";
axios.get("https://series.albesriali03.workers.dev/?action=episodes&url=https://t.alooytv8.xyz/watch/cqc7rwwjoibp.html?key=9e5dac6e0584")
  .then(res => console.log(JSON.stringify(res.data, null, 2)))
  .catch(err => console.error(err));
