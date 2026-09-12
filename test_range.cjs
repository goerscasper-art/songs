const yt = require("youtube-dl-exec");
const https = require("https");
const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

yt(url, { dumpJson: true }).then(info => {
  const format = info.formats.find(f => f.format_id === '140') || info.formats.find(f => f.acodec !== 'none');
  console.log("Audio URL found.");
  
  const options = {
    headers: { 'Range': 'bytes=0-1000' }
  };
  
  https.get(format.url, options, (res) => {
    console.log("Status Code:", res.statusCode);
    console.log("Headers:", res.headers);
    let size = 0;
    res.on('data', chunk => {
      size += chunk.length;
    });
    res.on('end', () => {
        console.log("Total received:", size);
    });
  }).on('error', e => {
    console.error(e);
  });
}).catch(console.error);
