import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ValueBadgeProps {
  edge: number;
  market: string;
  confidence?: "low" | "medium" | "high";
  showKelly?: boolean;
  kellyStake?: number;
}

export function ValueBadge({ edge, market, confidence = "medium", showKelly, kellyStake }: ValueBadgeProps) {
  const edgePercent = (edge * 100).toFixed(1);
  const isPositive = edge > 0;
  const isHighValue = edge >= 0.05;

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
        isPositive
          ? "bg-neon-green/20 text-neon-green border border-neon-green/30"
          : "bg-destructive/20 text-destructive border border-destructive/30",
        isHighValue && "animate-pulse-slow"
      )}
    >
      <span className="font-bold">
        {isPositive ? "+" : ""}{edgePercent}%
      </span>
      <span className="text-xs opacity-80 uppercase">{market}</span>

      {confidence && (
        <div className={cn(
          "w-2 h-2 rounded-full",
          confidence === "high" && "bg-neon-green",
          confidence === "medium" && "bg-neon-orange",
          confidence === "low" && "bg-muted-foreground"
        )} />
      )}

      {showKelly && kellyStake && kellyStake > 0 && (
        <span className="text-xs opacity-70">
          Kelly: {(kellyStake * 100).toFixed(1)}%
        </span>
      )}
    </motion.div>
  );
}

interface ValueSectionProps {
  bestValue?: {
    market: string;
    edge: number;
    kellyStake: number;
    confidence: "low" | "medium" | "high";
  };
  homeValue?: { edge: number };
  drawValue?: { edge: number };
  awayValue?: { edge: number };
}

export function ValueSection({ bestValue, homeValue, drawValue, awayValue }: ValueSectionProps) {
  return (
    <div className="space-y-4">
      {bestValue && bestValue.edge > 0 && (
        <div className="p-4 rounded-lg bg-neon-green/10 border border-neon-green/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-neon-green">Best Value</span>
            <ValueBadge
              edge={bestValue.edge}
              market={bestValue.market}
              confidence={bestValue.confidence}
              showKelly
              kellyStake={bestValue.kellyStake}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Model suggests {bestValue.market.toUpperCase()} has the highest edge vs market odds
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <ValueCard label="Home" edge={homeValue?.edge || 0} />
        <ValueCard label="Draw" edge={drawValue?.edge || 0} />
        <ValueCard label="Away" edge={awayValue?.edge || 0} />
      </div>
    </div>
  );
}

function ValueCard({ label, edge }: { label: string; edge: number }) {
  const isPositive = edge > 0;
  const edgePercent = (edge * 100).toFixed(1);

  return (
    <div className={cn(
      "p-3 rounded-lg text-center border",
      isPositive
        ? "bg-neon-green/5 border-neon-green/20"
        : "bg-muted/30 border-border/30"
    )}>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={cn(
        "font-mono font-bold",
        isPositive ? "text-neon-green" : "text-muted-foreground"
      )}>
        {isPositive ? "+" : ""}{edgePercent}%
      </div>
    </div>
  );
}
