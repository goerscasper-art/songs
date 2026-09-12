import type { SearchResult } from "../types";

const PIPED_FALLBACK_INSTANCES = [
  "https://api.piped.private.coffee",
  "https://pipedapi.ducks.party"
];

/**
 * Searches for songs across available backends:
 * 1. Checks local /api/search endpoint (Express or Cloudflare edge worker)
 * 2. If /api/search returns HTML (like <!doctype html> from a static host or SPA fallback),
 *    or fails, seamlessly queries public CORS-enabled API instances directly from the browser.
 */
export async function searchSongs(query: string): Promise<SearchResult[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  // 1. Try the local /api/search endpoint
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(cleanQuery)}`, {
      headers: { "Accept": "application/json" }
    });

    const contentType = res.headers.get("content-type") || "";
    
    // Check if the response is actually JSON and not an HTML SPA fallback (<!doctype html>)
    if (res.ok && contentType.includes("application/json")) {
      const text = await res.text();
      const trimmed = text.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        const data = JSON.parse(trimmed);
        if (Array.isArray(data.results) && data.results.length > 0) {
          return data.results;
        }
      }
    }
  } catch (err) {
    console.warn("Primary /api/search unavailable or returned non-JSON, attempting fallback...", err);
  }

  // 2. Client-side fallback to public CORS-enabled search providers
  for (const instance of PIPED_FALLBACK_INSTANCES) {
    try {
      const res = await fetch(`${instance}/search?q=${encodeURIComponent(cleanQuery)}&filter=all`, {
        signal: AbortSignal.timeout(5000),
        headers: { "Accept": "application/json" }
      });

      if (res.ok) {
        const data = await res.json();
        const rawItems = Array.isArray(data.items) ? data.items : [];
        const validItems = rawItems
          .filter((item: any) => item.type === "stream" && item.url)
          .map((item: any) => {
            const videoId = item.url.replace("/watch?v=", "").trim();
            const dur = typeof item.duration === "number" && item.duration > 0
              ? `${Math.floor(item.duration / 60)}:${String(item.duration % 60).padStart(2, "0")}`
              : "3:00";

            return {
              id: videoId,
              title: item.title || "Unknown Track",
              thumbnail: item.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
              duration: dur,
              author: item.uploaderName || "Unknown Artist"
            };
          });

        if (validItems.length > 0) {
          return validItems.slice(0, 20);
        }
      }
    } catch (err) {
      console.warn(`Fallback search on ${instance} failed:`, err);
    }
  }

  throw new Error("Unable to load songs right now. Please check your internet connection and try again.");
}
