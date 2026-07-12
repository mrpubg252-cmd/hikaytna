const cheerio = require('cheerio');
const fs = require('fs');

const html = fs.readFileSync('test.html', 'utf-8');
const $ = cheerio.load(html);

const eps = [];
$('.season-eps a.ep-num').each((i, el) => {
    eps.push({
        url: $(el).attr('href'),
        title: $(el).attr('title') || $(el).text()
    });
});
console.log(eps);
