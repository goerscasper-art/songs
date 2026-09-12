const yt = require("youtube-dl-exec");
const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
yt(url, { dumpJson: true }).then(info => {
  const f = info.formats.find(f => f.format_id === '140'); // m4a
  console.log(f.url.substring(0, 50) + "...");
});
