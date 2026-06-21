import { fetchEpisodesFromAPI } from "./src/services/api";

async function main() {
  const url1 = await fetchEpisodesFromAPI("https://fh.alooytv12.xyz/watch/fifa-2026.html");
  console.log("episodes:", url1);
}
main();
