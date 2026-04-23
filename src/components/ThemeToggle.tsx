import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-3 glass-card px-4 py-2 rounded-full border border-white/20 shadow-lg animate-in fade-in slide-in-from-top-4 duration-700">
      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 hidden sm:block">
        {theme === "dark" ? "Dark Mode" : "Light Mode"}
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        className="rounded-full w-9 h-9 hover:bg-primary/10 transition-all duration-300 relative overflow-hidden group"
      >
        <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors" />
        <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-yellow-500" />
        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-blue-400" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    </div>
  );
}
