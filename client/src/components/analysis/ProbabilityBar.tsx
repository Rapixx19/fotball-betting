import { motion } from "framer-motion";

interface ProbabilityBarProps {
  homeWin: number;
  draw: number;
  awayWin: number;
  homeTeam: string;
  awayTeam: string;
}

export function ProbabilityBar({ homeWin, draw, awayWin, homeTeam, awayTeam }: ProbabilityBarProps) {
  const homePercent = Math.round(homeWin * 100);
  const drawPercent = Math.round(draw * 100);
  const awayPercent = Math.round(awayWin * 100);

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm font-medium">
        <span className="text-neon-cyan">{homeTeam}</span>
        <span className="text-muted-foreground">Draw</span>
        <span className="text-neon-magenta">{awayTeam}</span>
      </div>

      <div className="relative h-8 rounded-lg overflow-hidden bg-secondary/50 backdrop-blur-sm">
        {/* Home win section */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${homePercent}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="absolute left-0 h-full bg-gradient-to-r from-neon-cyan/80 to-neon-cyan/50"
        />

        {/* Draw section */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${drawPercent}%` }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="absolute h-full bg-muted-foreground/30"
          style={{ left: `${homePercent}%` }}
        />

        {/* Away win section */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${awayPercent}%` }}
          transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
          className="absolute right-0 h-full bg-gradient-to-l from-neon-magenta/80 to-neon-magenta/50"
        />

        {/* Labels inside bar */}
        <div className="absolute inset-0 flex items-center justify-between px-3 text-sm font-bold">
          <span className="text-white drop-shadow-md">{homePercent}%</span>
          {drawPercent > 10 && (
            <span className="text-white/80 drop-shadow-md">{drawPercent}%</span>
          )}
          <span className="text-white drop-shadow-md">{awayPercent}%</span>
        </div>
      </div>
    </div>
  );
}
