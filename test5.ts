import axios from "axios";
import * as cheerio from "cheerio";

async function run() {
  const url = "https://3iskk.xyz/watch/tvshows/serie-ask-mantik-intikam-mudblij/";
  try {
    console.log("Fetching series page detail...");
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });
    const $ = cheerio.load(res.data);
    const title = $("h1.title").text().trim();
    const poster = $(".poster img").attr("src") || "";
    const description = $(".description").text().trim();
    const categories: string[] = [];
    $(".categories a").each((i, el) => {
      categories.push($(el).text().trim());
    });
    
    console.log("Title:", title);
    console.log("Poster:", poster);
    console.log("Description:", description);
    console.log("Categories:", categories.join(", "));
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}
run();
