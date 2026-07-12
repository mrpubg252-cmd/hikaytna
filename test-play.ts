import { fetchPlayUrlFromAPI } from "./src/services/api";

async function main() {
  const url1 = await fetchPlayUrlFromAPI("https://fh.alooytv12.xyz/watch/fifa-2026.html?key=v9gicmbred1x");
  console.log("url1:", url1);
  const url2 = await fetchPlayUrlFromAPI("https://fh.alooytv12.xyz/world-cup-2026");
  console.log("url2:", url2);
}
main();
