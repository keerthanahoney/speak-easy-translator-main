import { useState, useCallback, useRef, useEffect } from "react";
import { ArrowLeftRight, Copy, Mic, Volume2, Loader2, Check, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LanguageSelector } from "./LanguageSelector";
import { getLanguageName } from "@/lib/languages";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface HistoryItem {
  id: string;
  source: string;
  translated: string;
  from: string;
  to: string;
  timestamp: number;
}

export function TranslatorCard() {
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [sourceLang, setSourceLang] = useState("auto");
  const [targetLang, setTargetLang] = useState("es");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [copied, setCopied] = useState(false);
  const [detectedLang, setDetectedLang] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("translator-history") || "[]");
    } catch { return []; }
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const translate = useCallback(async (text: string) => {
    if (!text.trim()) {
      setTranslatedText("");
      return;
    }
    setIsLoading(true);
    
    // Internal function to perform fallback translation
    const performFallback = async () => {
      try {
        const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.trim())}&langpair=${sourceLang === 'auto' ? 'it' : sourceLang}|${targetLang}`);
        const data = await response.json();
        if (data?.responseData?.translatedText) {
          setTranslatedText(data.responseData.translatedText);
          return true;
        }
      } catch (err) {
        console.error("Fallback error:", err);
      }
      return false;
    };

    try {
      const { data, error } = await supabase.functions.invoke("translate", {
        body: { 
          text: text.trim(), 
          sourceLang: sourceLang === "auto" ? "auto" : getLanguageName(sourceLang), 
          targetLang: getLanguageName(targetLang) 
        },
      });

      if (error || data?.error) {
        console.warn("Edge function call failed, trying fallback...", error || data?.error);
        const success = await performFallback();
        if (success) return;
        throw new Error(error?.message || data?.error || "Translation service error");
      }

      const result = data.translated_text || "";
      setTranslatedText(result);
      if (data.detected_language) setDetectedLang(data.detected_language);

      if (result) {
        const item: HistoryItem = {
          id: crypto.randomUUID(),
          source: text.trim(),
          translated: result,
          from: sourceLang,
          to: targetLang,
          timestamp: Date.now(),
        };
        setHistory(prev => {
          const next = [item, ...prev].slice(0, 20);
          localStorage.setItem("translator-history", JSON.stringify(next));
          return next;
        });
      }
    } catch (e: any) {
      console.error("Primary translation failed:", e);
      // Last resort fallback if error caught
      const success = await performFallback();
      if (!success) {
        toast.error("Translation service is currently unreachable.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [sourceLang, targetLang]);

  const handleInputChange = (val: string) => {
    setSourceText(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => translate(val), 800);
  };

  const handleSwapLanguages = () => {
    if (sourceLang === "auto") return;
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setSourceText(translatedText);
    setTranslatedText(sourceText);
  };

  const handleCopy = async () => {
    if (!translatedText) return;
    await navigator.clipboard.writeText(translatedText);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMic = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SR) {
      toast.error("Speech recognition is not supported in this browser. Please try Chrome or Edge.");
      return;
    }

    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      toast.error("Microphone access requires a secure connection (HTTPS) or localhost.");
      return;
    }

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    
    if (sourceLang !== "auto") recognition.lang = sourceLang;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setSourceText(transcript);
      translate(transcript);
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      console.error("Speech recognition error:", event.error);
      
      const errorMessages: Record<string, string> = {
        'not-allowed': 'Microphone permission denied. Please enable it in browser settings.',
        'no-speech': 'No speech was detected. Please try again.',
        'network': 'Network error occurred during speech recognition.',
        'aborted': 'Speech recognition was aborted.',
      };
      
      toast.error(errorMessages[event.error] || `Microphone error: ${event.error}`);
    };

    recognition.onend = () => setIsListening(false);

    try {
      recognition.start();
    } catch (e) {
      console.error("Failed to start recognition:", e);
      setIsListening(false);
    }
  };

  const handleSpeak = () => {
    if (!translatedText || !window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(translatedText);
    utterance.lang = targetLang;
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Language selectors */}
      <div className="flex flex-col md:flex-row items-center gap-4 p-2 glass-card rounded-2xl">
        <div className="w-full">
          <LanguageSelector value={sourceLang} onChange={setSourceLang} label="From" />
          {detectedLang && sourceLang === "auto" && (
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest mt-1.5 ml-1">Detected: {detectedLang}</p>
          )}
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSwapLanguages}
          disabled={sourceLang === "auto"}
          className="rounded-xl hover:bg-primary/10 hover:text-primary transition-all duration-300 active:scale-95"
        >
          <ArrowLeftRight className="h-5 w-5" />
        </Button>

        <div className="w-full">
          <LanguageSelector value={targetLang} onChange={setTargetLang} excludeAuto label="To" />
        </div>
      </div>

      {/* Translation panels */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Source */}
        <div className="glass-card rounded-[2rem] p-6 flex flex-col min-h-[280px] transition-all duration-300 hover:shadow-xl group">
          <Textarea
            placeholder="What should I translate?"
            value={sourceText}
            onChange={e => handleInputChange(e.target.value)}
            className="flex-1 min-h-[160px] resize-none border-0 bg-transparent p-0 focus-visible:ring-0 text-lg md:text-xl font-medium placeholder:text-muted-foreground/50 leading-relaxed"
          />
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-primary/5">
            <div className="flex gap-2">
              <Button 
                variant="secondary" 
                size="icon" 
                onClick={handleMic} 
                className={`rounded-full transition-all duration-300 ${isListening ? "bg-red-500 text-white animate-pulse-soft scale-110 shadow-lg shadow-red-200" : "hover:bg-primary hover:text-white"}`}
              >
                <Mic className="h-5 w-5" />
              </Button>
            </div>
            <span className="text-[10px] uppercase tracking-tighter font-bold text-muted-foreground/60 bg-muted/50 px-2 py-1 rounded-md">
              {sourceText.length} characters
            </span>
          </div>
        </div>

        {/* Target */}
        <div className="glass-card rounded-[2rem] p-6 flex flex-col min-h-[280px] relative transition-all duration-300 hover:shadow-xl">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[2px] rounded-[2rem] z-10">
              <div className="bg-card p-4 rounded-2xl shadow-xl flex items-center gap-3 animate-in fade-in zoom-in duration-300 border border-border">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-sm font-bold text-foreground">Translating...</span>
              </div>
            </div>
          )}
          <div className={`flex-1 min-h-[160px] text-lg md:text-xl font-semibold leading-relaxed ${!translatedText ? "text-muted-foreground/30 italic" : "text-primary"}`}>
            {translatedText || "Translation magic happens here..."}
          </div>
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-primary/5">
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleSpeak} 
                disabled={!translatedText} 
                className="rounded-full hover:bg-primary/10 hover:text-primary transition-colors active:scale-95"
              >
                <Volume2 className="h-5 w-5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleCopy} 
                disabled={!translatedText} 
                className="rounded-full hover:bg-primary/10 hover:text-primary transition-colors active:scale-95"
              >
                {copied ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
              </Button>
            </div>
            <Button
              onClick={() => translate(sourceText)}
              disabled={!sourceText.trim() || isLoading}
              className="translator-gradient text-white rounded-2xl px-8 h-12 text-sm font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50"
            >
              Translate Now
            </Button>
          </div>
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="glass-card rounded-[2rem] p-8 mt-12">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Languages className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-foreground">Recent Activity</h3>
                <p className="text-xs font-bold text-muted-foreground/60 uppercase tracking-tighter">Your translation history</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs font-bold hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
              onClick={() => { setHistory([]); localStorage.removeItem("translator-history"); }}
            >
              Clear History
            </Button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {history.slice(0, 6).map(item => (
              <button
                key={item.id}
                onClick={() => { setSourceText(item.source); setTranslatedText(item.translated); }}
                className="group relative w-full text-left p-4 rounded-2xl bg-secondary/50 border border-border/50 hover:bg-background hover:shadow-lg hover:border-primary/20 transition-all duration-300"
              >
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium text-muted-foreground line-clamp-1 group-hover:text-foreground transition-colors">{item.source}</p>
                  <p className="text-sm font-bold text-primary line-clamp-1">{item.translated}</p>
                </div>
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowLeftRight className="h-3 w-3 text-primary/40" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
