import { Languages, Type, Music } from "lucide-react";
import { TranslatorCard } from "@/components/TranslatorCard";
import { LyricsTranslator } from "@/components/LyricsTranslator";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const [session, setSession] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen mesh-gradient selection:bg-primary/20 transition-colors duration-500">
      <div className="container max-w-6xl mx-auto px-4 py-8 md:py-16 relative">
        {/* Navigation Actions */}
        <div className="absolute top-4 right-4 md:top-8 md:right-8 z-50 flex items-center gap-3">
          <ThemeToggle />
          <UserMenu />
        </div>

        {/* Header */}
        <div className="text-center mb-12 space-y-4 animate-float">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl translator-gradient mb-6 shadow-[0_20px_50px_rgba(79,119,255,0.3)] rotate-3 hover:rotate-0 transition-transform duration-500">
            <Languages className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-foreground leading-[1.1]">
            Speak<span className="text-primary italic">Easy</span>
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto text-base md:text-lg font-medium leading-relaxed">
            Breaking barriers one word at a time. Experience lightning-fast,
            <span className="text-primary font-bold"> AI-powered</span> translations.
          </p>
          {session ? (
            <div className="pt-4 flex flex-col items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="bg-primary/10 px-6 py-3 rounded-2xl border border-primary/20 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-bold text-primary">Logged in as {session.user.email}</span>
              </div>
            </div>
          ) : (
            <div className="pt-4 flex justify-center">
              <Button 
                onClick={() => navigate("/auth")}
                className="rounded-full px-8 py-6 h-auto text-lg font-bold gap-3 shadow-xl hover:scale-105 transition-all duration-300 glass-button"
              >
                <Languages className="h-5 w-5" />
                Sign Up to Save History
              </Button>
            </div>
          )}
        </div>

        <Tabs defaultValue="text" className="w-full">
          <div className="flex justify-center mb-10">
            <TabsList className="bg-background/40 backdrop-blur-xl border border-primary/10 p-1.5 rounded-2xl h-auto shadow-xl">
              <TabsTrigger 
                value="text" 
                className="rounded-xl px-6 py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-300 gap-2 font-bold text-muted-foreground hover:text-foreground"
              >
                <Type className="h-4 w-4" />
                Text Translator
              </TabsTrigger>
              <TabsTrigger 
                value="lyrics" 
                className="rounded-xl px-6 py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-300 gap-2 font-bold text-muted-foreground hover:text-foreground"
              >
                <Music className="h-4 w-4" />
                Lyrics Translator
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="text" className="relative focus-visible:outline-none">
            <div className="absolute -inset-4 bg-primary/5 blur-3xl rounded-full -z-10" />
            <TranslatorCard />
          </TabsContent>

          <TabsContent value="lyrics" className="focus-visible:outline-none">
            <LyricsTranslator />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
