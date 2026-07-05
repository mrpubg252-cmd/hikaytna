const axios = require('axios');

async function test() {
  try {
    const res = await axios.get('http://localhost:3000/api/resolve-video?url=' + encodeURIComponent('/api/proxy-embed?nume=1&post=254194&type=tv'));
    console.log("STATUS:", res.status);
    console.log("DATA:", JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.log("ERROR:", err.message);
    if (err.response) {
      console.log("RESP DATA:", err.response.data);
    }
  }
}

test();
