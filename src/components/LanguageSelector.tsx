import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { languages } from "@/lib/languages";

interface LanguageSelectorProps {
  value: string;
  onChange: (value: string) => void;
  excludeAuto?: boolean;
  label: string;
}

export function LanguageSelector({ value, onChange, excludeAuto, label }: LanguageSelectorProps) {
  const filtered = excludeAuto ? languages.filter(l => l.code !== "auto") : languages;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.2em] ml-1">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full bg-secondary/50 border-0 focus:ring-2 focus:ring-primary/20 rounded-xl h-12 font-bold text-foreground hover:bg-background transition-all">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-80 rounded-2xl border-border shadow-2xl">
          {filtered.map(lang => (
            <SelectItem key={lang.code} value={lang.code} className="rounded-lg focus:bg-primary/10 focus:text-primary font-medium py-2.5">
              {lang.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
