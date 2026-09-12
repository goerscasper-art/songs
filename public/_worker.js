export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle /api/search route on Cloudflare Workers / Pages
    if (url.pathname === "/api/search") {
      const q = url.searchParams.get("q") || "";
      if (!q.trim()) {
        return new Response(JSON.stringify({ results: [] }), {
          status: 400,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }

      // Tier 1: Direct YouTube search from Cloudflare Edge
      try {
        const ytRes = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9"
          }
        });
        const html = await ytRes.text();
        const match = html.match(/ytInitialData\s*=\s*({.+?});<\/script>/);
        if (match) {
          const data = JSON.parse(match[1]);
          const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
          const items = [];
          if (Array.isArray(contents)) {
            for (const c of contents) {
              const vids = c?.itemSectionRenderer?.contents;
              if (Array.isArray(vids)) {
                for (const item of vids) {
                  if (item.videoRenderer && item.videoRenderer.videoId) {
                    const v = item.videoRenderer;
                    items.push({
                      id: v.videoId,
                      title: v.title?.runs?.[0]?.text || "Unknown Title",
                      thumbnail: v.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
                      duration: v.lengthText?.simpleText || "0:00",
                      author: v.ownerText?.runs?.[0]?.text || "Unknown Artist"
                    });
                  }
                }
              }
            }
          }
          if (items.length > 0) {
            return new Response(JSON.stringify({ results: items.slice(0, 20) }), {
              headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
              }
            });
          }
        }
      } catch (err) {
        console.warn("YouTube edge search error:", err);
      }

      // Tier 2: Piped API Fallback from Edge
      const pipedInstances = [
        "https://api.piped.private.coffee",
        "https://pipedapi.ducks.party"
      ];
      for (const inst of pipedInstances) {
        try {
          const pRes = await fetch(`${inst}/search?q=${encodeURIComponent(q)}&filter=all`);
          if (pRes.ok) {
            const pData = await pRes.json();
            const items = (pData.items || [])
              .filter(i => i.type === "stream" && i.url)
              .map(i => {
                const vidId = i.url.replace("/watch?v=", "");
                const dur = typeof i.duration === "number" && i.duration > 0
                  ? `${Math.floor(i.duration / 60)}:${String(i.duration % 60).padStart(2, "0")}`
                  : "0:00";
                return {
                  id: vidId,
                  title: i.title,
                  thumbnail: i.thumbnail || `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`,
                  duration: dur,
                  author: i.uploaderName || "Unknown Artist"
                };
              });
            if (items.length > 0) {
              return new Response(JSON.stringify({ results: items.slice(0, 20) }), {
                headers: { 
                  "Content-Type": "application/json",
                  "Access-Control-Allow-Origin": "*"
                }
              });
            }
          }
        } catch (_) {}
      }

      return new Response(JSON.stringify({ results: [] }), {
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    // Serve static frontend assets
    if (env && env.ASSETS && typeof env.ASSETS.fetch === "function") {
      return env.ASSETS.fetch(request);
    }

    return fetch(request);
  }
};
