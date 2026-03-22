import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatOdds } from "@/lib/utils";

interface OddsButtonProps {
  label: string;
  odds: number;
  isSelected: boolean;
  onClick: () => void;
  variant?: "home" | "draw" | "away";
  movement?: "up" | "down" | null;
  size?: "sm" | "md" | "lg";
}

export function OddsButton({
  label,
  odds,
  isSelected,
  onClick,
  variant = "home",
  movement,
  size = "md",
}: OddsButtonProps) {
  const colorClasses = {
    home: isSelected
      ? "bg-neon-cyan text-black border-neon-cyan"
      : "hover:border-neon-cyan/50 hover:bg-neon-cyan/10",
    draw: isSelected
      ? "bg-muted-foreground text-background border-muted-foreground"
      : "hover:border-muted-foreground/50 hover:bg-muted/30",
    away: isSelected
      ? "bg-neon-magenta text-black border-neon-magenta"
      : "hover:border-neon-magenta/50 hover:bg-neon-magenta/10",
  };

  const sizeClasses = {
    sm: "h-12 min-w-[60px]",
    md: "h-14 min-w-[80px]",
    lg: "h-16 min-w-[100px]",
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Button
        variant="outline"
        className={cn(
          "flex flex-col gap-0.5 transition-all duration-200",
          sizeClasses[size],
          colorClasses[variant],
          isSelected && "shadow-lg"
        )}
        onClick={onClick}
      >
        <span className="text-xs opacity-70 uppercase">{label}</span>
        <div className="flex items-center gap-1">
          <motion.span
            key={odds}
            initial={{ y: movement === "up" ? 5 : movement === "down" ? -5 : 0, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-lg font-bold"
          >
            {formatOdds(odds)}
          </motion.span>
          {movement && (
            <motion.span
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className={cn(
                "text-xs",
                movement === "up" ? "text-neon-green" : "text-destructive"
              )}
            >
              {movement === "up" ? "▲" : "▼"}
            </motion.span>
          )}
        </div>
      </Button>
    </motion.div>
  );
}
