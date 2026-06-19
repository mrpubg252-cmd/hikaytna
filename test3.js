import http from "http";
const req = http.get("http://127.0.0.1:3000/api/v1/episodes?url=" + encodeURIComponent("https://t.alooytv8.xyz/watch/cqc7rwwjoibp.html?key=9e5dac6e0584"), res => {
  let data = "";
  res.on("data", chunk => data += chunk);
  res.on("end", () => console.log(JSON.parse(data).data.length));
});
req.end();
