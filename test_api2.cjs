const https = require("https");
https.get("https://invidious.nerdvpn.de/api/v1/videos/dQw4w9WgXcQ", { headers: { 'User-Agent': 'Mozilla/5.0' }}, (res) => {
  let data = "";
  res.on("data", c => data+=c);
  res.on("end", () => {
    console.log("Status:", res.statusCode);
    if(data.length > 500) console.log("Data length:", data.length);
    else console.log(data);
  });
});
