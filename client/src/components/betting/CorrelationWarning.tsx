import { motion } from "framer-motion";
import { AlertTriangle, Info, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Correlation {
  leg1Index: number;
  leg2Index: number;
  correlation: {
    isCorrelated: boolean;
    correlationType: string;
    correlationFactor: number;
    warning?: string;
    recommendation?: string;
  };
}

interface CorrelationWarningProps {
  correlations: Correlation[];
  hasConflict: boolean;
  warnings: string[];
  recommendations: string[];
}

export function CorrelationWarning({
  correlations,
  hasConflict,
  warnings,
  recommendations,
}: CorrelationWarningProps) {
  if (correlations.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        className="p-3 rounded-lg bg-neon-green/10 border border-neon-green/30"
      >
        <div className="flex items-center gap-2 text-neon-green">
          <CheckCircle className="w-4 h-4" />
          <span className="text-sm font-medium">All legs are independent</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="space-y-2"
    >
      {/* Conflict warning */}
      {hasConflict && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
          <div className="flex items-start gap-2">
            <XCircle className="w-5 h-5 text-destructive mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">
                Conflicting Bets Detected
              </p>
              <p className="text-xs text-destructive/80 mt-1">
                This parlay contains bets that cannot both win. Please remove one
                of the conflicting selections.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Correlation warnings */}
      {warnings.length > 0 && !hasConflict && (
        <div className="p-3 rounded-lg bg-neon-orange/10 border border-neon-orange/30">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-neon-orange mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-neon-orange">
                Correlation Detected
              </p>
              <ul className="text-xs text-neon-orange/80 mt-1 space-y-1">
                {warnings.map((warning, i) => (
                  <li key={i}>• {warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">
                {recommendations[0]}
              </p>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

interface LegCorrelationBadgeProps {
  legIndex: number;
  correlatedWith: number[];
  correlationType?: string;
}

export function LegCorrelationBadge({
  correlatedWith,
  correlationType,
}: LegCorrelationBadgeProps) {
  if (correlatedWith.length === 0) {
    return (
      <span className="text-xs text-neon-green flex items-center gap-1">
        <CheckCircle className="w-3 h-3" />
        Independent
      </span>
    );
  }

  const isConflict = correlationType === "same_match";

  return (
    <span
      className={cn(
        "text-xs flex items-center gap-1",
        isConflict ? "text-destructive" : "text-neon-orange"
      )}
    >
      <AlertTriangle className="w-3 h-3" />
      Correlated with leg {correlatedWith.map((i) => i + 1).join(", ")}
    </span>
  );
}
