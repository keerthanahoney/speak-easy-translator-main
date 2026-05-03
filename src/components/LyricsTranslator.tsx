import { useState, useCallback, useEffect, useRef } from "react";
import { Search, Music, Languages, Loader2, PlayCircle, PauseCircle, Mic, Copy, Check, Share2, Sparkles, Volume2, History, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LanguageSelector } from "./LanguageSelector";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getLanguageName } from "@/lib/languages";
import { cn } from "@/lib/utils";

interface SongResult {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  artworkUrl100: string;
  previewUrl: string;
}

interface ParsedLine {
  timestamp?: number;
  timeStr: string;
  original: string;
  translated: string;
}

export function LyricsTranslator() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SongResult[]>([]);
  const [selectedSong, setSelectedSong] = useState<SongResult | null>(null);
  const [lyrics, setLyrics] = useState("");
  const [parsedLines, setParsedLines] = useState<ParsedLine[]>([]);
  const [sourceLang, setSourceLang] = useState("auto");
  const [targetLang, setTargetLang] = useState("en");
  const [isSearching, setIsSearching] = useState(false);
  const [isFetchingLyrics, setIsFetchingLyrics] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [mode, setMode] = useState<"meaning" | "lyric">("meaning");
  const [copied, setCopied] = useState(false);
  
  // Player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  const searchSongs = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResults([]);
    setSelectedSong(null);
    setLyrics("");
    setParsedLines([]);
    
    try {
      const resp = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchQuery)}&entity=song&limit=12`);
      const data = await resp.json();
      const results = data.results || [];
      setSearchResults(results);
      
      if (results.length > 0) {
        // Automatically proceed with the first result
        fetchLyrics(results[0]);
      } else {
        toast.info("No matches in music database. Try Deep AI Search!");
      }
    } catch (error) {
      toast.error("Failed to search songs.");
    } finally {
      setIsSearching(false);
    }
  };

  const cleanTitle = (title: string) => {
    return title
      .replace(/\(feat\..*?\)/gi, '')
      .replace(/\[feat\..*?\]/gi, '')
      .replace(/\(with.*?\)/gi, '')
      .replace(/\(from.*?\)/gi, '')
      .replace(/\[from.*?\]/gi, '')
      .replace(/\(remastered.*?\)/gi, '')
      .replace(/\[remastered.*?\]/gi, '')
      .replace(/- .*? remix/gi, '')
      .replace(/\(.*? version\)/gi, '')
      .replace(/\[.*? version\]/gi, '')
      .replace(/\(.*? radio edit\)/gi, '')
      .replace(/\(.*? official.*?\)/gi, '')
      .replace(/\(.*? slowed.*?\)/gi, '')
      .replace(/\(.*? reverb.*?\)/gi, '')
      .replace(/\d{4} remastered/gi, '')
      .trim();
  };

  const parseTimestamp = (timeStr: string) => {
    // Handle [mm:ss.xx] or [mm:ss.xxx]
    const match = timeStr.match(/\[(\d{2}):(\d{2})[.:](\d{2,3})\]/);
    if (match) {
      const mins = parseInt(match[1]);
      const secs = parseInt(match[2]);
      const ms = parseInt(match[3]);
      // Normalize ms based on length
      const msValue = match[3].length === 3 ? ms / 1000 : ms / 100;
      return mins * 60 + secs + msValue;
    }
    return undefined;
  };

  const fetchLyrics = async (song: SongResult) => {
    setSelectedSong(song);
    setSearchResults([]);
    setIsFetchingLyrics(true);
    setLyrics("");
    setParsedLines([]);
    
    // Reset audio
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }

    try {
      const cleanTrackName = cleanTitle(song.trackName);
      const cleanArtistName = cleanTitle(song.artistName);

      // 1. Try LrcLib - Direct Get
      try {
        const lrcGet = await fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(cleanArtistName)}&track_name=${encodeURIComponent(cleanTrackName)}`);
        if (lrcGet.ok) {
          const data = await lrcGet.json();
          const content = data.syncedLyrics || data.plainLyrics;
          if (content && content.length > 20) {
            processFetchedLyrics(content);
            return;
          }
        }
      } catch (e) {
        console.warn("LrcLib direct get failed");
      }

      // 2. Try AI Search Fallback
      const { data, error } = await supabase.functions.invoke("translate", {
        body: { 
          text: `${cleanTrackName} by ${cleanArtistName}`, 
          mode: "lyrics_fetch" 
        },
      });
      
      if (!error && data?.lyrics && data.lyrics !== "Lyrics not found") {
        processFetchedLyrics(data.lyrics);
        return;
      }

      // 3. Try LrcLib Search
      try {
        const lrcSearch = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(cleanTrackName + " " + cleanArtistName)}`);
        if (lrcSearch.ok) {
          const lrcResults = await lrcSearch.json();
          if (lrcResults.length > 0) {
            const content = lrcResults[0].syncedLyrics || lrcResults[0].plainLyrics;
            processFetchedLyrics(content);
            return;
          }
        }
      } catch (e) {
        console.warn("LrcLib search failed");
      }

      throw new Error("Lyrics not found");
    } catch (error) {
      toast.info("Lyrics not found automatically. Paste them manually!");
    } finally {
      setIsFetchingLyrics(false);
    }
  };

  const processFetchedLyrics = (content: string) => {
    const cleaned = content.replace(/Paroles de .*\n/g, "").trim();
    setLyrics(cleaned);
    toast.success("Lyrics found! Translating...");
    
    setTimeout(() => {
      translateLyrics(cleaned);
    }, 100);
  };

  const translateLyrics = useCallback(async (manualText?: string) => {
    const textToTranslate = manualText || lyrics;
    if (!textToTranslate.trim()) return;

    setIsTranslating(true);
    
    // Parse lines and keep timestamps separate
    const rawLines = textToTranslate.split('\n');
    const processed = rawLines.map(line => {
      // More flexible timestamp regex: [00:00.00] or [00:00.000] or [00:00:00]
      const timestampMatch = line.match(/^(\[\d{2}:\d{2}[.:]\d{2,3}\])(.*)/);
      if (timestampMatch) {
        return { timeStr: timestampMatch[1], timestamp: parseTimestamp(timestampMatch[1]), text: timestampMatch[2].trim() };
      }
      return { timeStr: "", timestamp: undefined, text: line.trim() };
    });

    const cleanText = processed.map(l => l.text).join('\n');
    const songContext = selectedSong 
      ? `Song: "${selectedSong.trackName}", Artist: "${selectedSong.artistName}". IMPORTANT INSTRUCTION: The input text might be Romanized (written in English letters) but is actually in another language (like Tamil, Hindi, etc.). YOU MUST NOT TRANSLITERATE! Do not just rewrite the words in the target language's script. You MUST translate the actual MEANING of the words into ${targetLang}.` 
      : `IMPORTANT INSTRUCTION: The input text may be Romanized. DO NOT TRANSLITERATE. You MUST translate the actual definition and meaning of the words into the target language.`;
    const performFallback = async (text: string): Promise<string | null> => {
      try {
        const sLang = sourceLang === 'auto' ? 'auto' : sourceLang;
        const query = encodeURIComponent(text);
        // Try Google Translate fallback (Fast & Reliable)
        const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sLang}&tl=${targetLang}&dt=t&q=${query}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data && data[0]) {
            return data[0].map((x: any) => x[0] || "").join("");
          }
        }
      } catch (err) {
        console.error("Fallback error:", err);
      }
      return null;
    };

    try {
      const { data, error } = await supabase.functions.invoke("translate", {
        body: { 
          text: cleanText, 
          sourceLang: sourceLang === "auto" ? "auto" : getLanguageName(sourceLang), 
          targetLang: getLanguageName(targetLang), 
          mode,
          context: songContext
        },
      });

      let finalTranslatedText = "";

      if (error || !data?.translated_text) {
        console.warn("AI function failed, attempting fallback...", error);
        const fallback = await performFallback(cleanText);
        if (fallback) {
          finalTranslatedText = fallback;
          toast.info("Using standard translation engine.");
        } else {
          throw new Error("All translation engines failed");
        }
      } else {
        finalTranslatedText = data.translated_text;
      }

      const translatedLines = finalTranslatedText.split('\n');
      const finalParsed: ParsedLine[] = processed.map((item, i) => ({
        timestamp: item.timestamp,
        timeStr: item.timeStr,
        original: item.text,
        translated: translatedLines[i] || ""
      }));

      setParsedLines(finalParsed);
    } catch (e) {
      console.error("Critical translation error:", e);
      toast.error("Translation failed. Please check your connection or try again.");
    } finally {
      setIsTranslating(false);
    }
  }, [lyrics, sourceLang, targetLang, mode, selectedSong]);

  // Audio handling
  useEffect(() => {
    if (!audioRef.current) return;
    
    const updateTime = () => setCurrentTime(audioRef.current?.currentTime || 0);
    audioRef.current.addEventListener('timeupdate', updateTime);
    audioRef.current.addEventListener('ended', () => setIsPlaying(false));
    
    return () => {
      audioRef.current?.removeEventListener('timeupdate', updateTime);
    };
  }, [selectedSong]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Auto-scroll logic for synced lyrics
  useEffect(() => {
    if (!isPlaying || !activeLineRef.current) return;
    activeLineRef.current.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  }, [currentTime, isPlaying]);

  const handleCopy = async () => {
    const text = parsedLines.map(l => `${l.original}\n${l.translated}\n`).join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  // Re-translate when settings change
  useEffect(() => {
    if (lyrics.trim() && !isFetchingLyrics) {
      const timer = setTimeout(() => translateLyrics(), 800);
      return () => clearTimeout(timer);
    }
  }, [targetLang, sourceLang, mode, lyrics, translateLyrics, isFetchingLyrics]);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-12 pb-20 relative px-4">
      
      {/* Immersive Background Layer */}
      {selectedSong && (
        <div className="fixed inset-0 -z-10 overflow-hidden opacity-30 dark:opacity-20 pointer-events-none transition-opacity duration-1000">
          <img 
            src={selectedSong.artworkUrl100.replace('100x100', '1000x1000')} 
            alt="background" 
            className="w-full h-full object-cover blur-[100px] animate-slow-zoom" 
          />
          <div className="absolute inset-0 bg-background/40 premium-blur" />
        </div>
      )}

      {/* Floating Header Actions */}
      <div className="flex flex-col md:flex-row items-center gap-6 justify-between animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="relative group w-full max-w-2xl">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-blue-500/20 rounded-[2.5rem] blur-xl group-focus-within:opacity-100 opacity-0 transition duration-500" />
          <div className="relative flex items-center gap-2 bg-background/50 backdrop-blur-2xl border border-primary/10 rounded-[2rem] p-2 pr-4 shadow-2xl">
            <div className="pl-4">
              <Music className={cn("h-6 w-6 text-primary", isSearching && "animate-bounce")} />
            </div>
            <Input
              placeholder="Song, Artist, or Album..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchSongs()}
              className="bg-transparent border-none focus-visible:ring-0 text-xl font-bold h-14 placeholder:text-muted-foreground/50"
            />
            <Button 
              onClick={searchSongs} 
              disabled={isSearching}
              size="lg"
              className="rounded-[1.5rem] px-8 h-12 translator-gradient border-none shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all font-black"
            >
              {isSearching ? <Loader2 className="animate-spin" /> : "SEARCH"}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-secondary/30 backdrop-blur-md p-2 rounded-full border border-white/10">
          <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/10" onClick={() => toast.info("History coming soon!")}>
            <History className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/10" onClick={() => { setLyrics(""); setParsedLines([]); setSelectedSong(null); }}>
            <RotateCcw className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Search Results Grid */}
      {searchResults.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 animate-in zoom-in-95 duration-500">
          {searchResults.map((song) => (
            <Card 
              key={song.trackId} 
              className="group relative aspect-square overflow-hidden rounded-[2rem] border-none cursor-pointer bg-secondary/50 hover:ring-4 ring-primary/40 transition-all shadow-xl"
              onClick={() => fetchLyrics(song)}
            >
              <img src={song.artworkUrl100.replace('100x100', '300x300')} alt={song.trackName} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 text-white">
                <p className="font-black text-sm line-clamp-1">{song.trackName}</p>
                <p className="text-[10px] uppercase font-bold tracking-widest text-white/70">{song.artistName}</p>
              </div>
            </Card>
          ))}
        </div>
      ) : (searchQuery && !isSearching && !selectedSong && (
        <div className="flex flex-col items-center justify-center p-12 text-center space-y-6 bg-primary/5 rounded-[3rem] border-2 border-dashed border-primary/20 animate-in fade-in duration-500">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Mic className="h-10 w-10 text-primary opacity-40" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-black">No Exact Matches</h3>
            <p className="text-muted-foreground font-medium max-w-md mx-auto">We couldn't find an exact match in our music database, but our AI librarian can still find them!</p>
          </div>
          <Button 
            onClick={() => fetchLyrics({ trackId: 0, trackName: searchQuery, artistName: "", artworkUrl100: "", previewUrl: "" })}
            className="h-14 px-10 rounded-2xl translator-gradient text-white font-black shadow-xl hover:scale-105 transition-all"
          >
            <Sparkles className="h-5 w-5 mr-2" />
            DEEP AI SEARCH FOR LYRICS
          </Button>
        </div>
      ))}

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* Input & Settings Column */}
        <div className="lg:col-span-5 space-y-8 animate-in slide-in-from-left-4 duration-700">
          
          {selectedSong ? (
            <Card className="overflow-hidden rounded-[3rem] border-none bg-background/40 backdrop-blur-3xl shadow-2xl relative">
              <div className="p-8 space-y-6">
                <div className="flex gap-6">
                  <div className="relative">
                    <img src={selectedSong.artworkUrl100.replace('100x100', '300x300')} className="w-32 h-32 rounded-3xl shadow-2xl" />
                    {selectedSong.previewUrl && (
                      <button 
                        onClick={togglePlay}
                        className="absolute -bottom-2 -right-2 w-12 h-12 rounded-full translator-gradient flex items-center justify-center text-white shadow-xl hover:scale-110 transition-transform"
                      >
                        {isPlaying ? <PauseCircle className="h-7 w-7" /> : <PlayCircle className="h-7 w-7" />}
                      </button>
                    )}
                  </div>
                  <div className="flex-1 space-y-1 py-1">
                    <h2 className="text-3xl font-black leading-tight text-foreground line-clamp-2">{selectedSong.trackName}</h2>
                    <p className="text-xl font-bold text-primary italic line-clamp-1">{selectedSong.artistName}</p>
                    <div className="flex items-center gap-2 pt-2">
                       <audio ref={audioRef} src={selectedSong.previewUrl} />
                       {isPlaying && (
                         <div className="flex gap-1 h-3 items-end">
                            {[1,2,3,4,5].map(i => (
                              <div key={i} className="w-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s`, height: `${Math.random() * 100}%` }} />
                            ))}
                         </div>
                       )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Original Lyrics</p>
                    {isFetchingLyrics && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  </div>
                  <Textarea
                    value={lyrics}
                    onChange={(e) => setLyrics(e.target.value)}
                    placeholder="Paste lyrics or search..."
                    className="min-h-[250px] bg-secondary/20 border-none rounded-[2rem] p-6 text-lg font-medium leading-relaxed resize-none focus-visible:ring-primary/20 transition-all"
                  />
                </div>
              </div>
            </Card>
          ) : (
            <Card className="rounded-[3.5rem] border-4 border-dashed border-primary/10 bg-secondary/5 p-12 flex flex-col items-center justify-center text-center gap-6">
               <div className="w-24 h-24 rounded-full bg-primary/5 flex items-center justify-center">
                  <Sparkles className="h-10 w-10 text-primary opacity-30" />
               </div>
               <div className="space-y-2">
                  <h3 className="text-2xl font-black">Ready to Translate?</h3>
                  <p className="text-muted-foreground font-medium max-w-[280px]">Search for a song or paste lyrics manually to begin the experience.</p>
               </div>
               <Textarea
                    value={lyrics}
                    onChange={(e) => setLyrics(e.target.value)}
                    placeholder="Or paste your lyrics here..."
                    className="min-h-[150px] bg-background/50 border-primary/10 rounded-[2rem] p-6 text-lg focus-visible:ring-primary/20"
                />
            </Card>
          )}

          <Card className="p-8 rounded-[3rem] border-none bg-background/40 backdrop-blur-3xl shadow-xl space-y-8">
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h4 className="font-black text-lg uppercase tracking-wide">Translation Settings</h4>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                 <LanguageSelector value={sourceLang} onChange={setSourceLang} label="Source" />
                 <LanguageSelector value={targetLang} onChange={setTargetLang} excludeAuto label="Target" />
              </div>

              <div className="pt-6 border-t border-primary/10 space-y-6">
                <div className="flex flex-col gap-4">
                   <div 
                    onClick={() => setMode("meaning")}
                    className={cn(
                      "p-4 rounded-2xl cursor-pointer border-2 transition-all flex items-center gap-4",
                      mode === "meaning" ? "bg-primary/10 border-primary text-primary" : "bg-secondary/30 border-transparent hover:bg-secondary/50"
                    )}
                   >
                      <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center shadow-sm">
                        <Mic className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-black">The Meaning</p>
                        <p className="text-[10px] uppercase font-bold tracking-widest opacity-70">Deep context & soul</p>
                      </div>
                   </div>

                   <div 
                    onClick={() => setMode("lyric")}
                    className={cn(
                      "p-4 rounded-2xl cursor-pointer border-2 transition-all flex items-center gap-4",
                      mode === "lyric" ? "bg-primary/10 border-primary text-primary" : "bg-secondary/30 border-transparent hover:bg-secondary/50"
                    )}
                   >
                      <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center shadow-sm">
                        <Music className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-black">The Lyrics</p>
                        <p className="text-[10px] uppercase font-bold tracking-widest opacity-70">Poetic flow & rhythm</p>
                      </div>
                   </div>
                </div>

                <Button 
                  onClick={() => translateLyrics()} 
                  disabled={isTranslating || !lyrics.trim()}
                  className="w-full h-16 rounded-[1.5rem] translator-gradient text-white font-black text-xl shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  {isTranslating ? <Loader2 className="animate-spin h-6 w-6" /> : "MAGIC TRANSLATE"}
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Output Column */}
        <div className="lg:col-span-7 h-full animate-in slide-in-from-right-4 duration-700">
          <Card className="h-full rounded-[3.5rem] border-none bg-background/30 backdrop-blur-3xl shadow-2xl overflow-hidden min-h-[600px] flex flex-col">
            <div className="p-8 border-b border-white/10 flex items-center justify-between bg-white/5">
              <div className="space-y-1">
                <h3 className="text-2xl font-black flex items-center gap-3">
                  Immersion View 
                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-full uppercase tracking-widest">AI Enhanced</span>
                </h3>
                <p className="text-sm font-medium text-muted-foreground">Original vs. {getLanguageName(targetLang)} interpretation</p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={handleCopy} className="rounded-full hover:bg-primary/10">
                  {copied ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
                </Button>
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/10" onClick={() => toast.success("Sharing enabled!")}>
                  <Share2 className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1" ref={scrollAreaRef}>
              {isTranslating ? (
                <div className="p-20 flex flex-col items-center justify-center text-center gap-8">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full border-4 border-primary/10 animate-ping absolute inset-0" />
                    <div className="w-24 h-24 rounded-full border-4 border-t-primary border-transparent animate-spin relative z-10" />
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-2xl font-black">Understanding the Soul...</h4>
                    <p className="text-muted-foreground font-medium max-w-sm">Our AI is analyzing metaphors, cultural nuances, and the rhythm of the lyrics to craft a perfect interpretation.</p>
                  </div>
                </div>
              ) : parsedLines.length > 0 ? (
                <div className="p-8 space-y-10">
                  {parsedLines.map((line, i) => {
                     const lineTimestamp = line.timestamp ?? -1;
                     const nextLineTimestamp = parsedLines[i + 1]?.timestamp ?? Infinity;
                     const isActive = lineTimestamp !== -1 && currentTime >= lineTimestamp && currentTime < nextLineTimestamp;
                     
                     return (
                        <div 
                          key={i} 
                          ref={isActive ? activeLineRef : null}
                          className={cn(
                            "group grid grid-cols-1 md:grid-cols-2 gap-8 py-6 px-4 rounded-[2rem] transition-all duration-500 border border-transparent",
                            isActive ? "bg-primary/10 border-primary/20 scale-[1.02] shadow-xl shadow-primary/5 z-10 relative" : "hover:bg-white/5",
                            line.original === "" && "py-2"
                          )}
                        >
                          <div className="space-y-2">
                            {line.timeStr && <span className="text-[10px] font-black text-muted-foreground tracking-tighter block mb-1 opacity-40">{line.timeStr}</span>}
                            <p className={cn(
                              "text-xl font-medium leading-relaxed transition-all duration-500",
                              isActive ? "text-foreground opacity-100" : "text-muted-foreground opacity-60 group-hover:opacity-100"
                            )}>
                              {line.original || "•••"}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <p className={cn(
                              "text-xl font-black leading-relaxed transition-all duration-500",
                              isActive ? "text-primary scale-105 origin-left" : "text-foreground opacity-30 group-hover:opacity-100"
                            )}>
                              {line.translated || (line.original ? "..." : "")}
                            </p>
                          </div>
                        </div>
                     )
                  })}
                </div>
              ) : (
                <div className="p-32 flex flex-col items-center justify-center text-center opacity-20">
                   <Music className="h-24 w-24 mb-6" />
                   <p className="text-xl font-black uppercase tracking-[0.3em]">Lyrics Output</p>
                </div>
              )}
            </ScrollArea>
            
            {/* Visual Equalizer Footer (When Playing) */}
            {isPlaying && (
              <div className="h-20 bg-primary/5 backdrop-blur-xl border-t border-white/10 flex items-center justify-center gap-1">
                 {Array.from({length: 40}).map((_, i) => (
                   <div 
                    key={i} 
                    className="w-1 bg-primary rounded-full animate-bounce" 
                    style={{ 
                      height: `${20 + Math.random() * 60}%`,
                      animationDuration: `${0.5 + Math.random() * 1}s`,
                      animationDelay: `${i * 0.05}s`
                    }} 
                   />
                 ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
