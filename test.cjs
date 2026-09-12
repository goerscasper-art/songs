const yt = require("youtube-dl-exec");
const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
console.log("executing");
const subprocess = yt.exec(url, { o: "-", f: "bestaudio[ext=webm]", quiet: true });
subprocess.stdout.on('data', d => console.log('data', d.length));
subprocess.on('error', e => console.error('error', e));
subprocess.on('close', c => console.log('close', c));
