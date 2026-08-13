const axios = require('axios');
const cheerio = require('cheerio');

async function debugEpisodeHtml() {
  const url = 'https://e.3cktv.cam/video/musalsal-kiskanmak-ep-01/';
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Referer': 'https://e.3cktv.cam/'
      }
    });
    const $ = cheerio.load(res.data);
    console.log('HTML Length:', res.data.length);
    console.log('Page Title:', $('title').text().trim());

    console.log('\n--- IFRAMES ---');
    $('iframe').each((i, el) => {
      console.log(`Iframe ${i}: src="${$(el).attr('src')}" data-src="${$(el).attr('data-src')}"`);
    });

    console.log('\n--- LINKS WITH WATCH/SERVER/PLAY ---');
    $('a').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();
      const cls = $(el).attr('class') || '';
      if (href.includes('watch') || href.includes('server') || href.includes('play') || text.includes('سيرفر') || text.includes('مشاهدة') || cls.includes('server')) {
        console.log(`A tag ${i}: text="${text}" href="${href}" class="${cls}" data-server="${$(el).attr('data-server')}" data-url="${$(el).attr('data-url')}"`);
      }
    });

    console.log('\n--- LI ELEMENTS WITH SERVERS ---');
    $('li').each((i, el) => {
      const text = $(el).text().trim();
      const cls = $(el).attr('class') || '';
      const dataServer = $(el).attr('data-server') || $(el).attr('data-id') || $(el).attr('data-url') || '';
      if (text.includes('سيرفر') || cls.includes('serv') || dataServer) {
        console.log(`LI ${i}: text="${text}" class="${cls}" data-server="${dataServer}" data-url="${$(el).attr('data-url')}"`);
      }
    });

    console.log('\n--- DIV/BUTTON ELEMENTS WITH SERVERS ---');
    $('*[data-server], *[data-url], .server, .servList, .serversList').each((i, el) => {
      console.log(`Elem ${i} (${el.tagName}): class="${$(el).attr('class')}" data-server="${$(el).attr('data-server')}" data-url="${$(el).attr('data-url')}" text="${$(el).text().trim().slice(0, 40)}"`);
    });

  } catch (e) {
    console.error('Error:', e.message);
  }
}

debugEpisodeHtml();
