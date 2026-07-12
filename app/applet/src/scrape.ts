import axios from "axios";
import * as cheerio from "cheerio";

async function test() {
  const { data } = await axios.get("https://t.alooytv8.xyz/watch/cqc7rwwjoibp.html?key=9e5dac6e0584");
  const $ = cheerio.load(data);
  const episodes: any[] = [];
  
  // Try to find episodes list in the HTML
  $('.episodes-list a, .list-episodes a, a[href*="/watch/"], .seasons a').each((i, el) => {
    const title = $(el).text().trim();
    const href = $(el).attr('href');
    if (href && title) {
      if (!episodes.some(e => e.url === href)) {
        episodes.push({ title, url: href });
      }
    }
  });

  console.log("Found links:", episodes.length);
  // Just print first few
  console.log(episodes.slice(0, 10));
}

test();
