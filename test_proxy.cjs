const yt = require("youtube-dl-exec");
const http = require("http");
const https = require("https");

const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

yt(url, { dumpJson: true }).then(info => {
  const format = info.formats.find(f => f.format_id === '140');
  console.log("Audio URL:", format.url.substring(0, 60) + "...");
  
  https.get(format.url, (res) => {
    console.log("Status Code:", res.statusCode);
    console.log("Headers:", res.headers['content-type']);
    res.on('data', chunk => {
      console.log("Got chunk of size", chunk.length);
      process.exit(0);
    });
  }).on('error', e => {
    console.error(e);
  });
}).catch(console.error);
