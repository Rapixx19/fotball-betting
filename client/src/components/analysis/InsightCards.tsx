import { motion } from "framer-motion";
import { Lightbulb, TrendingUp, TrendingDown, AlertTriangle, Flame } from "lucide-react";

interface InsightCardsProps {
  insights: string[];
}

function getInsightIcon(insight: string) {
  const lowerInsight = insight.toLowerCase();
  if (lowerInsight.includes("value") || lowerInsight.includes("edge")) {
    return <Flame className="w-4 h-4 text-neon-green" />;
  }
  if (lowerInsight.includes("improving") || lowerInsight.includes("excellent")) {
    return <TrendingUp className="w-4 h-4 text-neon-green" />;
  }
  if (lowerInsight.includes("declining") || lowerInsight.includes("struggling")) {
    return <TrendingDown className="w-4 h-4 text-destructive" />;
  }
  if (lowerInsight.includes("warning") || lowerInsight.includes("caution")) {
    return <AlertTriangle className="w-4 h-4 text-neon-orange" />;
  }
  return <Lightbulb className="w-4 h-4 text-neon-cyan" />;
}

export function InsightCards({ insights }: InsightCardsProps) {
  if (!insights || insights.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        No insights available yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {insights.map((insight, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/30 hover:border-primary/30 transition-colors"
        >
          <div className="mt-0.5">{getInsightIcon(insight)}</div>
          <p className="text-sm leading-relaxed">{insight}</p>
        </motion.div>
      ))}
    </div>
  );
}
