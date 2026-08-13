const axios = require('axios');

async function testFullFlow() {
  try {
    // 1. Fetch home/discover series
    const discoverRes = await axios.get('http://localhost:3000/api/v1/qeseh/discover');
    console.log('Discover series count:', discoverRes.data.data.length);
    const sampleSeries = discoverRes.data.data[0];
    console.log('Sample series title:', sampleSeries.title, 'URL:', sampleSeries.url);

    // 2. Fetch episodes for sample series
    const epRes = await axios.get('http://localhost:3000/api/v1/episodes?url=' + encodeURIComponent(sampleSeries.url));
    console.log('Episodes count:', epRes.data.data.length);
    const sampleEp = epRes.data.data[0];
    console.log('Sample Episode title:', sampleEp.title, 'URL:', sampleEp.url);

    // 3. Fetch play details for sample episode
    const playRes = await axios.get('http://localhost:3000/api/v1/play?url=' + encodeURIComponent(sampleEp.url));
    console.log('Play Status:', playRes.data.status);
    console.log('Primary Player URL:', playRes.data.player_url);
    console.log('Total Servers Found:', playRes.data.servers ? playRes.data.servers.length : 0);
    if (playRes.data.servers) {
      playRes.data.servers.forEach((s, idx) => {
        console.log(` -> ${s.name} : ${s.url}`);
      });
    }
  } catch (e) {
    console.error('Flow test error:', e.message);
  }
}

testFullFlow();
