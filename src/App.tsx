import { useState, useRef, useEffect, type FormEvent, type ChangeEvent } from "react";
import type { SearchResult } from "./types";
import { searchSongs } from "./lib/search";
import YouTube, { YouTubePlayer, YouTubeEvent } from "react-youtube";
import { 
  Search, Heart, Play, Pause, 
  SkipForward, SkipBack, Volume2, MonitorPlay,
  Maximize, Minimize, AlertCircle, RefreshCw
} from "lucide-react";

export default function App() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [fallbackAttempt, setFallbackAttempt] = useState(0);

  // Playback state
  const [currentSong, setCurrentSong] = useState<SearchResult | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [volume, setVolume] = useState(100);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showVideo, setShowVideo] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  // App state
  const [activeTab, setActiveTab] = useState<'search' | 'liked'>('search');
  
  // Persisted state
  const [likedSongs, setLikedSongs] = useState<SearchResult[]>([]);

  const playerRef = useRef<YouTubePlayer | null>(null);
  const progressInterval = useRef<number | null>(null);

  // --- API ---
  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setActiveTab('search');
    setLoading(true);
    setError("");
    try {
      const songResults = await searchSongs(query);
      setResults(songResults);
      if (songResults.length === 0) {
        setError("No songs found matching your search. Please try different keywords.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred searching for songs");
    } finally {
      setLoading(false);
    }
  };

  // --- Player Controls ---
  const playSong = (song: SearchResult) => {
    setError("");
    setStatusMessage("");
    setFallbackAttempt(0);
    setCurrentSong(song);
    setIsPlaying(true);
  };

  const togglePlay = () => {
    if (!playerRef.current || !currentSong) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };

  const handleVolumeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setVolume(val);
    if (playerRef.current) {
      playerRef.current.setVolume(val);
    }
  };

  const cyclePlaybackRate = () => {
    const rates = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIdx];
    setPlaybackRate(nextRate);
    if (playerRef.current) {
      playerRef.current.setPlaybackRate(nextRate);
    }
  };

  const handleSeek = (e: ChangeEvent<HTMLInputElement>) => {
    if (!playerRef.current || !durationMs) return;
    const newProgress = parseFloat(e.target.value);
    const seekTime = (newProgress / 100) * durationMs;
    playerRef.current.seekTo(seekTime, true);
    setProgress(newProgress);
  };

  // --- YouTube API Events ---
  useEffect(() => {
    if (isPlaying) {
      progressInterval.current = window.setInterval(async () => {
        if (playerRef.current) {
          const cTime = await playerRef.current.getCurrentTime();
          const dur = await playerRef.current.getDuration();
          setCurrentTimeMs(cTime);
          setDurationMs(dur);
          if (dur > 0) {
            setProgress((cTime / dur) * 100);
          }
        }
      }, 500);
    } else {
      if (progressInterval.current) clearInterval(progressInterval.current);
    }
    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, [isPlaying]);

  const onPlayerReady = (event: YouTubeEvent) => {
    playerRef.current = event.target;
    event.target.setVolume(volume);
    event.target.setPlaybackRate(playbackRate);
    if (isPlaying) event.target.playVideo();
  };

  const onPlayerStateChange = (event: YouTubeEvent) => {
    if (event.data === 1) setIsPlaying(true); // PLAYING
    else if (event.data === 2) setIsPlaying(false); // PAUSED
    else if (event.data === 0) { // ENDED
      setIsPlaying(false);
      setProgress(0);
    }
  };

  const onPlayerError = async (event: YouTubeEvent) => {
    const errorCode = event.data;
    console.error("YouTube error code:", errorCode);

    // Error codes 101, 150, 151 indicate embedding or playback restrictions on this video
    if ((errorCode === 101 || errorCode === 150 || errorCode === 151 || errorCode === 2) && currentSong) {
      if (fallbackAttempt < 2) {
        const nextAttempt = fallbackAttempt + 1;
        setFallbackAttempt(nextAttempt);
        setStatusMessage(`Embedding restricted on this version (Error ${errorCode}). Finding playable alternative...`);

        try {
          const searchQuery = nextAttempt === 1
            ? `${currentSong.title} ${currentSong.author} audio`
            : `${currentSong.title} lyric video`;
          
          const alts = await searchSongs(searchQuery);
          const alt = alts.find((v: SearchResult) => v.id !== currentSong.id);
          if (alt) {
            setStatusMessage(`Switched to playable version for "${currentSong.title}"`);
            setCurrentSong({
              ...currentSong,
              id: alt.id,
              thumbnail: alt.thumbnail || currentSong.thumbnail
            });
            setIsPlaying(true);
            return;
          }
        } catch (err) {
          console.error("Fallback search failed:", err);
        }
      }
    }

    setStatusMessage("");
    setError(`Cannot play this video (Code ${errorCode}). The video owner has restricted external embedding.`);
    setIsPlaying(false);
  };

  // --- App Features ---
  const toggleLike = (song: SearchResult) => {
    if (likedSongs.some(s => s.id === song.id)) {
      setLikedSongs(prev => prev.filter(s => s.id !== song.id));
    } else {
      setLikedSongs(prev => [...prev, song]);
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // --- Renders ---
  const renderSongList = (songs: SearchResult[]) => (
    <div className="w-full">
      <div className="grid grid-cols-[16px_1fr_2fr_minmax(140px,1fr)] gap-4 px-4 py-2 text-sm text-[#b3b3b3] border-b border-[#282828] mb-4">
        <div>#</div>
        <div>Title</div>
        <div>Artist</div>
        <div className="text-right">Actions</div>
      </div>
      <div className="flex flex-col gap-1">
        {songs.map((song, idx) => {
          const isLiked = likedSongs.some(s => s.id === song.id);
          const isPlayingThis = currentSong?.id === song.id;
          
          return (
            <div 
              key={`${song.id}-${idx}`}
              className="group grid grid-cols-[16px_1fr_2fr_minmax(140px,1fr)] gap-4 px-4 py-2 text-sm text-[#b3b3b3] hover:bg-[#2a2a2a] rounded-md items-center cursor-pointer transition-colors"
              onClick={() => playSong(song)}
            >
              <div className="text-center group-hover:hidden">{idx + 1}</div>
              <div className="hidden group-hover:block text-purple-400">
                <Play className="w-4 h-4 fill-purple-400" />
              </div>
              <div className="flex items-center gap-3 overflow-hidden">
                <img src={song.thumbnail} alt="" className="w-10 h-10 object-cover rounded shadow" />
                <span className={`truncate ${isPlayingThis ? 'text-[#a855f7]' : 'text-white'}`}>
                  {song.title}
                </span>
              </div>
              <div className="truncate">{song.author}</div>
              <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                <button onClick={() => toggleLike(song)} className="text-[#b3b3b3] hover:text-white" title={isLiked ? "Unlike" : "Like"}>
                  <Heart className={`w-4 h-4 ${isLiked ? 'fill-[#a855f7] text-[#a855f7]' : ''}`} />
                </button>
                <span className="text-xs ml-2 w-10 text-right">{song.duration}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden font-sans select-none">
      
      {/* Top / Main Body */}
      <div className="flex flex-1 overflow-hidden p-2 gap-2 pb-[96px]">
        
        {/* Sidebar */}
        <div className="w-64 bg-[#121212] rounded-lg flex flex-col p-6 gap-6 overflow-hidden shrink-0">
          <div className="flex items-center gap-2.5 group cursor-pointer select-none">
            {/* Spotify copy mark in purple */}
            <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.5)] shrink-0 transition-transform group-hover:scale-105">
              <div className="relative w-4 h-4 flex flex-col items-center justify-center -rotate-[16deg] -translate-x-[0.5px]">
                <div className="w-[17px] h-[5px] border-t-[2.8px] border-[#121212] rounded-t-full -mb-[2px]" />
                <div className="w-[13px] h-[4.5px] border-t-[2.8px] border-[#121212] rounded-t-full -mb-[1.5px]" />
                <div className="w-[9px] h-[4px] border-t-[2.4px] border-[#121212] rounded-t-full" />
              </div>
            </div>
            <div className="flex items-baseline gap-1 overflow-hidden">
              <span className="font-black tracking-tight text-xl text-white whitespace-nowrap">Illegal Songs</span>
              <span className="text-[10px] text-purple-400 font-bold">®</span>
            </div>
          </div>
          
          <nav className="flex flex-col gap-2">
            <button 
              onClick={() => setActiveTab('search')}
              className={`flex items-center gap-4 font-bold transition-colors px-3 py-2.5 rounded-md ${activeTab === 'search' ? 'text-purple-400 bg-purple-500/10' : 'text-[#b3b3b3] hover:text-white hover:bg-[#1a1a1a]'}`}
            >
              <Search className="w-6 h-6 shrink-0" /> Search
            </button>
            <button 
              onClick={() => setActiveTab('liked')}
              className={`flex items-center gap-4 font-bold transition-colors px-3 py-2.5 rounded-md ${activeTab === 'liked' ? 'text-purple-400 bg-purple-500/10' : 'text-[#b3b3b3] hover:text-white hover:bg-[#1a1a1a]'}`}
            >
              <Heart className="w-6 h-6 shrink-0" /> Liked Songs
            </button>
          </nav>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 bg-[#121212] rounded-lg overflow-y-auto flex flex-col relative bg-gradient-to-b from-purple-900/20 to-[#121212]">
          
          {/* Header */}
          <div className="sticky top-0 z-10 bg-[#121212]/90 backdrop-blur-md p-4 flex items-center gap-4 border-b border-transparent shadow-sm">
            {activeTab === 'search' && (
              <form onSubmit={handleSearch} className="flex-1 max-w-md relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="What do you want to listen to?"
                  className="w-full bg-[#242424] text-white rounded-full py-3 pl-10 pr-4 outline-none focus:bg-[#2a2a2a] hover:bg-[#2a2a2a] transition-colors border border-[#333] focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
              </form>
            )}
            {activeTab === 'liked' && <h1 className="text-3xl font-bold py-1">Liked Songs</h1>}
          </div>

          <div className="p-6 pb-20">
            {statusMessage && (
              <div className="bg-purple-900/40 border border-purple-500/40 text-purple-200 p-3 rounded-lg mb-6 flex items-center gap-3 text-sm animate-pulse">
                <RefreshCw className="w-4 h-4 animate-spin text-purple-400 shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}
            {error && (
              <div className="bg-red-500/20 border border-red-500/30 text-red-300 p-4 rounded-lg mb-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
                  <span>{error}</span>
                </div>
                {currentSong && (
                  <a 
                    href={`https://www.youtube.com/watch?v=${currentSong.id}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-xs bg-red-500/30 hover:bg-red-500/50 text-white font-medium px-3 py-1.5 rounded transition-colors whitespace-nowrap"
                  >
                    Watch on YouTube
                  </a>
                )}
              </div>
            )}
            
            {activeTab === 'search' && (
              <>
                {loading && <div className="text-[#b3b3b3] mt-10 text-center text-lg font-bold">Searching...</div>}
                {!loading && results.length > 0 && renderSongList(results)}
                {!loading && results.length === 0 && !error && query && (
                  <div className="text-[#b3b3b3] mt-10 text-center font-bold text-lg">No results found for "{query}"</div>
                )}
              </>
            )}

            {activeTab === 'liked' && (
              <>
                {likedSongs.length === 0 ? (
                  <div className="text-[#b3b3b3] mt-10 text-center font-bold text-lg">Songs you like will appear here.</div>
                ) : renderSongList(likedSongs)}
              </>
            )}
          </div>
        </div>

        {/* Persistent YouTube Player */}
        {currentSong && (
          <div className={
            !showVideo 
              ? "fixed -left-[9999px] -top-[9999px] w-[320px] h-[180px] opacity-0 pointer-events-none" 
              : isMaximized 
              ? "fixed inset-0 w-full h-full z-[100] bg-black group/video" 
              : "absolute bottom-28 right-6 w-[320px] aspect-video bg-black rounded-lg overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.5)] border border-[#282828] z-50 group/video"
          }>
            {/* Hover overlay controls when video is showing */}
            {showVideo && (
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/video:opacity-100 flex items-start justify-end p-4 transition-opacity z-10 pointer-events-none">
                <button 
                  onClick={() => setIsMaximized(!isMaximized)} 
                  className="bg-black/50 hover:bg-purple-500/80 text-white p-2 rounded-full pointer-events-auto transition-colors backdrop-blur-md"
                  title={isMaximized ? "Minimize" : "Maximize"}
                >
                  {isMaximized ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                </button>
              </div>
            )}
            
            <YouTube
              videoId={currentSong.id}
              opts={{
                width: '100%',
                height: '100%',
                playerVars: { 
                  autoplay: 1, 
                  controls: 0, 
                  disablekb: 1, 
                  fs: 1, 
                  rel: 0,
                  origin: typeof window !== 'undefined' ? window.location.origin : undefined,
                  enablejsapi: 1,
                  playsinline: 1,
                },
              }}
              onReady={onPlayerReady}
              onStateChange={onPlayerStateChange}
              onError={onPlayerError}
              className="w-full h-full"
            />
          </div>
        )}
      </div>

      {/* Playback Bar */}
      <div className="fixed bottom-0 left-0 w-full h-[90px] bg-black border-t border-[#282828] flex items-center justify-between px-4 z-50">
        
        {/* Left: Now Playing Info */}
        <div className="w-[30%] flex items-center gap-4 min-w-[180px]">
          {currentSong ? (
            <>
              <img src={currentSong.thumbnail} alt="" className="w-14 h-14 object-cover rounded shadow-lg" />
              <div className="overflow-hidden flex flex-col justify-center">
                <div className="text-sm font-bold truncate hover:underline cursor-pointer">{currentSong.title}</div>
                <div className="text-xs text-[#b3b3b3] truncate hover:underline cursor-pointer">{currentSong.author}</div>
              </div>
              <button onClick={() => toggleLike(currentSong)} className="text-[#b3b3b3] hover:text-white ml-2 shrink-0">
                <Heart className={`w-4 h-4 ${likedSongs.some(s => s.id === currentSong.id) ? 'fill-[#a855f7] text-[#a855f7]' : ''}`} />
              </button>
            </>
          ) : null}
        </div>

        {/* Center: Playback Controls */}
        <div className="w-[40%] max-w-[722px] flex flex-col items-center justify-center gap-2">
          <div className="flex items-center gap-6">
            <button className="text-[#b3b3b3] hover:text-white disabled:opacity-50 transition-colors" disabled={!currentSong}>
              <SkipBack className="w-5 h-5 fill-current" />
            </button>
            <button 
              className="w-10 h-10 rounded-full bg-purple-500 text-white flex items-center justify-center hover:scale-105 hover:bg-purple-400 transition-all disabled:opacity-50 disabled:hover:scale-100 shadow-[0_0_10px_rgba(168,85,247,0.4)]"
              onClick={togglePlay}
              disabled={!currentSong}
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-1" />}
            </button>
            <button className="text-[#b3b3b3] hover:text-white disabled:opacity-50 transition-colors" disabled={!currentSong}>
              <SkipForward className="w-5 h-5 fill-current" />
            </button>
          </div>
          
          <div className="w-full flex items-center gap-2 text-xs text-[#b3b3b3]">
            <span className="w-10 text-right">{formatTime(currentTimeMs)}</span>
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={progress}
              onChange={handleSeek}
              disabled={!currentSong}
              className="w-full h-1 bg-[#4d4d4d] rounded-full appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400 disabled:opacity-50"
            />
            <span className="w-10">{formatTime(durationMs)}</span>
          </div>
        </div>

        {/* Right: Extra Controls */}
        <div className="w-[30%] flex items-center justify-end gap-4 text-[#b3b3b3] min-w-[180px]">
          <div className="flex items-center gap-2 relative group" title="Playback Speed">
            <button onClick={cyclePlaybackRate} className="hover:text-white flex items-center gap-1 text-xs font-bold w-12 justify-end transition-colors">
              {playbackRate}x
            </button>
          </div>

          <button 
            onClick={() => setShowVideo(!showVideo)} 
            className={`hover:text-white transition-colors ${showVideo ? 'text-[#a855f7]' : ''}`}
            title="Toggle Video Player"
            disabled={!currentSong}
          >
            <MonitorPlay className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-2 w-24 group">
            <Volume2 className="w-4 h-4 shrink-0" />
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={volume}
              onChange={handleVolumeChange}
              className="w-full h-1 bg-[#4d4d4d] rounded-full appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400"
            />
          </div>
        </div>

      </div>
    </div>
  );
}
