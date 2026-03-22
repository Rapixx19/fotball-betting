import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  X,
  Zap,
  TrendingUp,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useParlay } from "@/contexts/ParlayContext";
import {
  CorrelationWarning,
  LegCorrelationBadge,
} from "./CorrelationWarning";
import { formatOdds, formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface AdvancedAnalysis {
  basic: {
    combinedOdds: number;
    impliedProbability: number;
    expectedValue: number;
    kellyFraction: number;
    riskRating: string;
    recommendations: string[];
  };
  advanced: {
    correlationAnalysis: {
      totalCorrelationFactor: number;
      adjustedProbability: number;
      correlations: Array<{
        leg1Index: number;
        leg2Index: number;
        correlation: {
          isCorrelated: boolean;
          correlationType: string;
          correlationFactor: number;
          warning?: string;
          recommendation?: string;
        };
      }>;
      warnings: string[];
      recommendations: string[];
      hasConflict: boolean;
    };
    parlayBoost: {
      baseOdds: number;
      boostedOdds: number;
      boostPercentage: number;
    };
    combinedProbability: {
      independent: number;
      adjusted: number;
    };
    expectedValue: number;
    recommendation: string;
  };
}

export function BetBuilder() {
  const { legs, removeLeg, clearLegs, combinedOdds } = useParlay();
  const [stake, setStake] = useState(10);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const { data: analysisData } = useQuery<AdvancedAnalysis>({
    queryKey: ["/api/parlay/analyze-advanced", { legs, stake }],
    queryFn: async () => {
      const res = await fetch("/api/parlay/analyze-advanced", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legs: legs.map((leg) => ({
            matchId: leg.matchId,
            pick: leg.pick,
            odds: leg.odds,
          })),
          stake,
        }),
      });
      return res.json();
    },
    enabled: legs.length >= 2 && showAnalysis,
  });

  const { mutate: createSlip, isPending: isCreating } = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/slips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stake,
          legs: legs.map((leg) => ({
            matchId: leg.matchId,
            pick: leg.pick,
            odds: leg.odds,
          })),
        }),
      });
      return res.json();
    },
    onSuccess: () => {
      clearLegs();
      setShowAnalysis(false);
    },
  });

  if (legs.length === 0) {
    return (
      <Card className="bg-card/80 backdrop-blur-sm border-border/50">
        <CardContent className="py-8 text-center text-muted-foreground">
          <Zap className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="font-medium">Bet Builder</p>
          <p className="text-sm">Select odds to add to your parlay</p>
        </CardContent>
      </Card>
    );
  }

  const potentialPayout = stake * combinedOdds;
  const correlation = analysisData?.advanced?.correlationAnalysis;
  const parlayBoost = analysisData?.advanced?.parlayBoost;
  const hasBoost = parlayBoost && parlayBoost.boostPercentage > 0;

  // Build correlation map for each leg
  const legCorrelations: Map<number, number[]> = new Map();
  correlation?.correlations?.forEach((c) => {
    if (!legCorrelations.has(c.leg1Index)) legCorrelations.set(c.leg1Index, []);
    if (!legCorrelations.has(c.leg2Index)) legCorrelations.set(c.leg2Index, []);
    legCorrelations.get(c.leg1Index)!.push(c.leg2Index);
    legCorrelations.get(c.leg2Index)!.push(c.leg1Index);
  });

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="w-5 h-5 text-neon-cyan" />
            Bet Builder
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={clearLegs}>
            Clear All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Selected Legs */}
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {legs.map((leg, index) => (
              <motion.div
                key={`${leg.matchId}-${leg.pick}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20, height: 0 }}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/30"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {index + 1}.
                    </span>
                    <span className="font-medium truncate">
                      {leg.matchInfo?.homeTeam} vs {leg.matchInfo?.awayTeam}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        leg.pick === "home" && "border-neon-cyan text-neon-cyan",
                        leg.pick === "away" && "border-neon-magenta text-neon-magenta"
                      )}
                    >
                      {leg.pick.toUpperCase()} @ {formatOdds(leg.odds)}
                    </Badge>
                    {correlation && (
                      <LegCorrelationBadge
                        legIndex={index}
                        correlatedWith={legCorrelations.get(index) || []}
                        correlationType={
                          correlation.correlations.find(
                            (c) => c.leg1Index === index || c.leg2Index === index
                          )?.correlation.correlationType
                        }
                      />
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => removeLeg(leg.matchId)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Correlation Warnings */}
        {correlation && (
          <CorrelationWarning
            correlations={correlation.correlations}
            hasConflict={correlation.hasConflict}
            warnings={correlation.warnings}
            recommendations={correlation.recommendations}
          />
        )}

        {/* Odds and Payout */}
        <div className="p-4 rounded-lg bg-muted/20 border border-border/30">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-muted-foreground">Combined Odds</span>
            <span className="text-xl font-bold">{formatOdds(combinedOdds)}x</span>
          </div>

          {correlation && (
            <div className="flex justify-between items-center mb-2 text-sm">
              <span className="text-muted-foreground">Adjusted Probability</span>
              <span
                className={cn(
                  "font-medium",
                  correlation.adjustedProbability < analysisData?.advanced.combinedProbability.independent
                    ? "text-neon-orange"
                    : "text-foreground"
                )}
              >
                {(correlation.adjustedProbability * 100).toFixed(1)}%
                {correlation.totalCorrelationFactor > 0 && (
                  <span className="text-destructive ml-1">
                    (↓ from{" "}
                    {(analysisData?.advanced.combinedProbability.independent! * 100).toFixed(1)}%)
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Parlay Boost Banner */}
          {hasBoost && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-3 p-2 rounded-lg bg-gradient-to-r from-neon-cyan/20 to-neon-magenta/20 border border-neon-cyan/30"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-neon-cyan" />
                  <span className="text-sm font-medium">
                    PARLAY BOOST +{(parlayBoost!.boostPercentage * 100).toFixed(0)}%
                  </span>
                </div>
                <span className="text-sm font-bold text-neon-cyan">
                  {formatOdds(parlayBoost!.boostedOdds)}x
                </span>
              </div>
            </motion.div>
          )}
        </div>

        {/* Stake Input */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">
              Stake
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                type="number"
                value={stake}
                onChange={(e) => setStake(parseFloat(e.target.value) || 0)}
                className="pl-7"
                min={1}
              />
            </div>
          </div>
          <div className="flex-1 text-right">
            <label className="text-xs text-muted-foreground mb-1 block">
              Potential Payout
            </label>
            <div className="text-xl font-bold text-neon-green">
              {formatCurrency(potentialPayout)}
            </div>
          </div>
        </div>

        {/* Expected Value (if analysis available) */}
        {analysisData && (
          <div
            className={cn(
              "p-3 rounded-lg text-sm",
              analysisData.advanced.expectedValue > 0
                ? "bg-neon-green/10 border border-neon-green/30"
                : "bg-destructive/10 border border-destructive/30"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Expected Value</span>
              <span
                className={cn(
                  "font-bold",
                  analysisData.advanced.expectedValue > 0
                    ? "text-neon-green"
                    : "text-destructive"
                )}
              >
                {analysisData.advanced.expectedValue > 0 ? "+" : ""}
                {formatCurrency(analysisData.advanced.expectedValue * stake)}
              </span>
            </div>
            <p className="text-xs mt-1 text-muted-foreground">
              {analysisData.advanced.recommendation}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setShowAnalysis(!showAnalysis)}
            disabled={legs.length < 2}
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            {showAnalysis ? "Hide Analysis" : "Analyze"}
          </Button>
          <Button
            className="flex-1 bg-neon-cyan text-black hover:bg-neon-cyan/80"
            onClick={() => createSlip()}
            disabled={isCreating || Boolean(correlation?.hasConflict)}
          >
            {isCreating ? "Creating..." : "Place Bet"}
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
