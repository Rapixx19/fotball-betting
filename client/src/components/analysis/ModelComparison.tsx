import { motion } from "framer-motion";

interface ModelResult {
  name: string;
  icon: string;
  home: number;
  draw: number;
  away: number;
  predictedScore?: string;
}

interface ModelComparisonProps {
  models: ModelResult[];
}

export function ModelComparison({ models }: ModelComparisonProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border/50 bg-muted/30">
            <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Model</th>
            <th className="px-4 py-3 text-center text-sm font-semibold text-neon-cyan">Home</th>
            <th className="px-4 py-3 text-center text-sm font-semibold text-muted-foreground">Draw</th>
            <th className="px-4 py-3 text-center text-sm font-semibold text-neon-magenta">Away</th>
            <th className="px-4 py-3 text-center text-sm font-semibold text-muted-foreground">Score</th>
          </tr>
        </thead>
        <tbody>
          {models.map((model, index) => (
            <motion.tr
              key={model.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="border-b border-border/30 hover:bg-muted/20 transition-colors"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{model.icon}</span>
                  <span className="font-medium">{model.name}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="font-mono font-bold text-neon-cyan">
                  {(model.home * 100).toFixed(0)}%
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="font-mono text-muted-foreground">
                  {(model.draw * 100).toFixed(0)}%
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="font-mono font-bold text-neon-magenta">
                  {(model.away * 100).toFixed(0)}%
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="font-mono text-sm text-muted-foreground">
                  {model.predictedScore || "--"}
                </span>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
