const https = require("https");
const instances = [
  "pipedapi.kavin.rocks",
  "pipedapi.smnz.de",
  "pipedapi.tokhmi.xyz",
  "pipedapi.moomoo.me",
  "piped-api.lunar.icu",
  "pipedapi.leptons.xyz",
  "pipedapi.r4fo.com"
];

function testInstance(host) {
  https.get(`https://${host}/streams/pXRviuL6vMY`, { headers: { 'User-Agent': 'Mozilla/5.0' }}, (res) => {
    let data = "";
    res.on("data", c => data+=c);
    res.on("end", () => {
      try {
        const json = JSON.parse(data);
        if (json.audioStreams && json.audioStreams.length > 0) {
           console.log(`Success on ${host}:`, json.audioStreams[0].url.substring(0, 50));
        } else {
           console.log(`Failed on ${host} (No streams):`, data.substring(0, 50));
        }
      } catch(e) {
        console.log(`Failed on ${host} (Parse error):`, data.substring(0, 50));
      }
    });
  }).on('error', e => console.log(`Failed on ${host} (Request error)`));
}

instances.forEach(testInstance);
