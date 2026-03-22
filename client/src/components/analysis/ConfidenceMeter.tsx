import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ConfidenceMeterProps {
  agreement: number; // 0-1
  label?: string;
}

export function ConfidenceMeter({ agreement, label = "Model Agreement" }: ConfidenceMeterProps) {
  const percentage = Math.round(agreement * 100);
  const segments = 10;
  const filledSegments = Math.round(agreement * segments);

  const getColor = () => {
    if (agreement >= 0.8) return "neon-green";
    if (agreement >= 0.6) return "neon-cyan";
    if (agreement >= 0.4) return "neon-orange";
    return "destructive";
  };

  const colorClass = getColor();

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={cn(
          "font-mono font-bold",
          `text-${colorClass}`
        )}>
          {percentage}%
        </span>
      </div>

      <div className="flex gap-1">
        {Array.from({ length: segments }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ delay: i * 0.05, duration: 0.2 }}
            className={cn(
              "flex-1 h-3 rounded-sm origin-bottom",
              i < filledSegments
                ? `bg-${colorClass}`
                : "bg-muted/30"
            )}
            style={{
              backgroundColor: i < filledSegments
                ? `hsl(var(--${colorClass}))`
                : undefined
            }}
          />
        ))}
      </div>

      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Low</span>
        <span>Medium</span>
        <span>High</span>
      </div>
    </div>
  );
}
