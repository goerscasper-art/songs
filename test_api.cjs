const https = require("https");
https.get("https://pipedapi.kavin.rocks/streams/dQw4w9WgXcQ", (res) => {
  let data = "";
  res.on("data", c => data+=c);
  res.on("end", () => {
    try {
      const json = JSON.parse(data);
      console.log(json.audioStreams.map(s => s.url).slice(0, 1));
    } catch(e) { console.error("Error parsing", e); }
  });
});
