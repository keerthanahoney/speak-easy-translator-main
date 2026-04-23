import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const DebugAuth = () => {
  const [status, setStatus] = useState("Checking...");
  const [event, setEvent] = useState("None");
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setStatus(session ? `Session Active: ${session.user.email}` : "No Session Active");
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((e, session) => {
      setEvent(e);
      setStatus(session ? `Session Active: ${session.user.email}` : "No Session Active");
    });
    return () => subscription.unsubscribe();
  }, []);

  const isActive = !status.includes("No Session");

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[100] pointer-events-none">
      <div 
        className="pointer-events-auto group glass-card flex items-center gap-3 px-5 py-2 rounded-full border border-white/20 shadow-2xl transition-all duration-500 hover:w-auto overflow-hidden whitespace-nowrap cursor-default"
      >
        <div className="relative flex items-center justify-center w-2 h-2">
          <div className={`absolute inset-0 rounded-full blur-sm ${isActive ? 'bg-green-500' : 'bg-orange-500'} animate-pulse`} />
          <div className={`relative w-2 h-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-orange-500'}`} />
        </div>
        
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-black tracking-widest text-primary uppercase">System</span>
          <span className="text-[10px] font-medium text-muted-foreground">Live</span>
        </div>

        <div className="flex items-center gap-4 ml-1 pl-4 border-l border-white/10 translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-500 delay-75">
          <div className="flex flex-col">
            <span className="text-[7px] text-primary/60 font-black uppercase tracking-tighter">Status</span>
            <span className="text-[9px] font-mono leading-none font-bold text-foreground/80">{status}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[7px] text-primary/60 font-black uppercase tracking-tighter">Event</span>
            <span className="text-[9px] font-mono leading-none font-bold text-foreground/80">{event}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[7px] text-primary/60 font-black uppercase tracking-tighter">Instance</span>
            <span className="text-[9px] font-mono leading-none font-bold text-foreground/80">Dev:{window.location.port}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <DebugAuth />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
