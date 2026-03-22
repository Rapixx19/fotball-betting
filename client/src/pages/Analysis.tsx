import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Calculator, Plus, Trash2, TrendingUp, AlertTriangle, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { formatOdds, formatProbability, formatCurrency, toAmericanOdds } from "@/lib/utils";
import { useParlay } from "@/contexts/ParlayContext";

interface Leg {
  id: string;
  pick: string;
  odds: string;
}

interface AnalysisResult {
  combinedOdds: number;
  impliedProbability: number;
  expectedValue: number;
  kellyFraction: number;
  riskRating: "low" | "medium" | "high";
  recommendations: string[];
}

export function Analysis() {
  const { legs: parlayLegs, clearLegs: clearParlayLegs } = useParlay();

  // Initialize legs from parlay context if available
  const [legs, setLegs] = useState<Leg[]>(() => {
    if (parlayLegs.length > 0) {
      return parlayLegs.map((leg, index) => ({
        id: `parlay-${index}`,
        pick: leg.matchInfo
          ? `${leg.matchInfo.homeTeam} vs ${leg.matchInfo.awayTeam}: ${leg.pick}`
          : leg.pick,
        odds: leg.odds.toString(),
      }));
    }
    return [{ id: "1", pick: "", odds: "" }];
  });
  const [stake, setStake] = useState("10");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  // Sync with parlay context changes
  useEffect(() => {
    if (parlayLegs.length > 0) {
      setLegs(
        parlayLegs.map((leg, index) => ({
          id: `parlay-${index}`,
          pick: leg.matchInfo
            ? `${leg.matchInfo.homeTeam} vs ${leg.matchInfo.awayTeam}: ${leg.pick}`
            : leg.pick,
          odds: leg.odds.toString(),
        }))
      );
    }
  }, [parlayLegs]);

  const analyzeMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ analysis: AnalysisResult }>("/api/analyze", {
        method: "POST",
        body: JSON.stringify({
          legs: legs.filter((l) => l.pick && l.odds).map((l) => ({
            pick: l.pick,
            odds: l.odds,
          })),
          stake,
        }),
      }),
    onSuccess: (data) => {
      setAnalysis(data.analysis);
      // Clear the parlay context after successful analysis
      clearParlayLegs();
    },
  });

  const addLeg = () => {
    setLegs([...legs, { id: Date.now().toString(), pick: "", odds: "" }]);
  };

  const removeLeg = (id: string) => {
    if (legs.length > 1) {
      setLegs(legs.filter((l) => l.id !== id));
    }
  };

  const updateLeg = (id: string, field: "pick" | "odds", value: string) => {
    setLegs(legs.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const validLegs = legs.filter((l) => l.pick && l.odds && parseFloat(l.odds) > 0);

  const getRiskBadge = (rating: string) => {
    switch (rating) {
      case "low":
        return <Badge variant="success">Low Risk</Badge>;
      case "medium":
        return <Badge variant="warning">Medium Risk</Badge>;
      case "high":
        return <Badge variant="destructive">High Risk</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Parlay Analysis</h1>
        <p className="text-muted-foreground">
          Analyze your parlay with advanced probability calculations
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Build Your Parlay
            </CardTitle>
            <CardDescription>
              Enter the details for each leg of your parlay
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {legs.map((leg, index) => (
                <div key={leg.id} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label htmlFor={`pick-${leg.id}`}>Leg {index + 1}</Label>
                    <Input
                      id={`pick-${leg.id}`}
                      value={leg.pick}
                      onChange={(e) => updateLeg(leg.id, "pick", e.target.value)}
                      placeholder="e.g., Lakers ML"
                    />
                  </div>
                  <div className="w-24">
                    <Label htmlFor={`odds-${leg.id}`}>Odds</Label>
                    <Input
                      id={`odds-${leg.id}`}
                      type="number"
                      step="0.01"
                      min="1.01"
                      value={leg.odds}
                      onChange={(e) => updateLeg(leg.id, "odds", e.target.value)}
                      placeholder="1.50"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLeg(leg.id)}
                    disabled={legs.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button variant="outline" onClick={addLeg} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Leg
            </Button>

            <div>
              <Label htmlFor="stake">Stake Amount ($)</Label>
              <Input
                id="stake"
                type="number"
                min="1"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                placeholder="10"
              />
            </div>

            <Button
              className="w-full"
              onClick={() => analyzeMutation.mutate()}
              disabled={validLegs.length === 0 || analyzeMutation.isPending}
            >
              {analyzeMutation.isPending ? "Analyzing..." : "Analyze Parlay"}
            </Button>
          </CardContent>
        </Card>

        {/* Analysis Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Analysis Results
            </CardTitle>
            <CardDescription>
              Probability and expected value calculations
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analysis ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground">Combined Odds</p>
                    <p className="text-2xl font-bold">
                      {formatOdds(analysis.combinedOdds)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {toAmericanOdds(analysis.combinedOdds)}
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground">Implied Probability</p>
                    <p className="text-2xl font-bold">
                      {formatProbability(analysis.impliedProbability)}
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground">Potential Payout</p>
                    <p className="text-2xl font-bold text-primary">
                      {formatCurrency(parseFloat(stake) * analysis.combinedOdds)}
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground">Expected Value</p>
                    <p
                      className={`text-2xl font-bold ${
                        analysis.expectedValue >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {analysis.expectedValue >= 0 ? "+" : ""}
                      {formatCurrency(analysis.expectedValue)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <p className="text-sm text-muted-foreground">Risk Assessment</p>
                    <div className="mt-1">{getRiskBadge(analysis.riskRating)}</div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Kelly Fraction</p>
                    <p className="font-semibold">
                      {(analysis.kellyFraction * 100).toFixed(2)}%
                    </p>
                  </div>
                </div>

                {analysis.recommendations.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      Recommendations
                    </p>
                    <ul className="space-y-2">
                      {analysis.recommendations.map((rec, i) => (
                        <li
                          key={i}
                          className="text-sm text-muted-foreground flex items-start gap-2"
                        >
                          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <Calculator className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Enter your parlay details and click Analyze
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
