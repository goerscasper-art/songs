const ytdl = require("@distube/ytdl-core");
ytdl.getInfo("https://www.youtube.com/watch?v=pXRviuL6vMY").then(info => console.log('success', info.videoDetails.title)).catch(e => console.error(e.message));
