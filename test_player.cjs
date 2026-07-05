const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');

const SOURCE_URL = "https://3iskk.xyz";
const embedUrl = `${SOURCE_URL}/embed/1/254194/2/`; // server 1

const axiosInstance = axios.create({
  timeout: 30000,
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Referer': SOURCE_URL,
    'Origin': SOURCE_URL,
    'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
  }
});

async function test() {
  try {
    const res = await axiosInstance.get(embedUrl);
    let iframeSrc = cheerio.load(res.data)("iframe").first().attr("src");
    if (iframeSrc.startsWith("//")) iframeSrc = `https:${iframeSrc}`;
    
    // Let's try fetching with different Referers
    console.log(`\n--- Fetching player with Embed URL Referer ---`);
    const p1 = await axiosInstance.get(iframeSrc, { headers: { 'Referer': embedUrl } });
    console.log(`p1 contains 'Embeds disabled': ${p1.data.includes('Embeds disabled')}`);
    
    console.log(`\n--- Fetching player with Home Page Referer ---`);
    const p2 = await axiosInstance.get(iframeSrc, { headers: { 'Referer': SOURCE_URL } });
    console.log(`p2 contains 'Embeds disabled': ${p2.data.includes('Embeds disabled')}`);

    // Print all scripts or text inside p1 that might contain block logic
    const $ = cheerio.load(p1.data);
    console.log(`\n--- Scripts in player HTML ---`);
    $("script").each((i, el) => {
      const src = $(el).attr("src");
      const content = $(el).html() || "";
      if (src) {
        console.log(`Script src: ${src}`);
      } else {
        console.log(`Script content snippet (${content.length} chars):`);
        console.log(content.substring(0, 1000));
      }
    });

    console.log(`\n--- Full Player Body HTML ---`);
    console.log($("body").html());

  } catch (e) {
    console.error(`Error:`, e.message);
  }
}

test();
