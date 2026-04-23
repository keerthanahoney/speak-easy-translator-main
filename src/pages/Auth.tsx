import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Languages, Chrome, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Function to handle redirection
    const handleRedirect = (session: any) => {
      if (session) {
        toast.success("Welcome back!");
        navigate("/", { replace: true });
      }
    };

    // 1. Initial manual check
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleRedirect(session);
    });

    // 2. Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth Event:", event);
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
        handleRedirect(session);
      }
    });

    // 3. Fallback for hash-based redirects that might be slow
    if (window.location.hash.includes("access_token")) {
      const timer = setTimeout(() => {
        supabase.auth.getSession().then(({ data: { session } }) => handleRedirect(session));
      }, 1000);
      return () => {
        clearTimeout(timer);
        subscription.unsubscribe();
      };
    }

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleGoogleLogin = async () => {
    if (!supabase) {
      toast.error("Supabase client not initialized. Check your environment variables.");
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth`,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      console.error("Google Login Error:", error);
      toast.error(error.message || "Failed to initialize Google login. Ensure it's enabled in Supabase.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen mesh-gradient flex items-center justify-center p-4">
      <div className="absolute top-8 left-8">
        <Button 
          variant="ghost" 
          onClick={() => navigate("/")}
          className="gap-2 font-semibold hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Button>
      </div>

      <Card className="w-full max-w-md border-white/20 bg-white/10 backdrop-blur-2xl shadow-2xl animate-in fade-in zoom-in duration-500">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl translator-gradient shadow-lg">
              <Languages className="h-6 w-6 text-white" />
            </div>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl font-black tracking-tight">
              Welcome to <span className="text-primary italic">SpeakEasy</span>
            </CardTitle>
            <CardDescription className="text-base font-medium">
              Join our community of global communicators
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Button 
            onClick={handleGoogleLogin} 
            disabled={isLoading}
            className="w-full h-14 text-lg font-bold gap-3 glass-button hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            {isLoading ? <Loader2 className="animate-spin" /> : <Chrome className="h-5 w-5" />}
            Continue with Google
          </Button>
          <p className="text-center text-xs text-muted-foreground pt-2">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col border-t border-white/10 pt-6">
          <p className="text-sm text-muted-foreground text-center">
            New here? Signing up is automatic on first login.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Auth;

