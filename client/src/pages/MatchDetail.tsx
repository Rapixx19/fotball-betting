import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, Trophy, TrendingUp, Zap, Target, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProbabilityBar } from "@/components/analysis/ProbabilityBar";
import { ModelComparison } from "@/components/analysis/ModelComparison";
import { InsightCards } from "@/components/analysis/InsightCards";
import { ValueSection } from "@/components/analysis/ValueBadge";
import { ConfidenceMeter } from "@/components/analysis/ConfidenceMeter";
import { useParlay } from "@/contexts/ParlayContext";
import { formatOdds } from "@/lib/utils";

interface Match {
  id: number;
  sport: string;
  league?: string;
  homeTeam: string;
  awayTeam: string;
  homeOdds?: string;
  awayOdds?: string;
  drawOdds?: string;
  startsAt: string;
  status: string;
}

interface MatchAnalysis {
  matchId: number;
  consensus: {
    homeWin: number;
    draw: number;
    awayWin: number;
    modelAgreement: number;
    confidence: "low" | "medium" | "high";
  };
  poisson?: {
    homeWin: number;
    draw: number;
    awayWin: number;
    predictedScore: string;
    overUnder?: Record<string, { over: number; under: number }>;
    btts?: { yes: number; no: number };
  };
  dixonColes?: {
    adjustedHomeWin: number;
    adjustedDraw: number;
    adjustedAwayWin: number;
  };
  elo?: {
    homeWinProb: number;
    drawProb: number;
    awayWinProb: number;
    homeRating: number;
    awayRating: number;
  };
  value?: {
    home: { edge: number; kellyStake: number };
    draw: { edge: number; kellyStake: number };
    away: { edge: number; kellyStake: number };
    bestValue?: {
      market: string;
      edge: number;
      kellyStake: number;
      confidence: "low" | "medium" | "high";
    };
  };
  insights: string[];
}

export function MatchDetail() {
  const [, params] = useRoute("/match/:id");
  const matchId = params?.id ? parseInt(params.id) : null;

  const { toggleLeg, isSelected } = useParlay();

  const { data: matchData, isLoading: matchLoading } = useQuery<{ match: Match }>({
    queryKey: [`/api/matches/${matchId}`],
    enabled: !!matchId,
  });

  const { data: analysisData, isLoading: analysisLoading } = useQuery<{ analysis: MatchAnalysis }>({
    queryKey: [`/api/matches/${matchId}/analysis`],
    enabled: !!matchId,
  });

  const match = matchData?.match;
  const analysis = analysisData?.analysis;

  if (matchLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">Match not found</h2>
        <Link href="/matches">
          <Button variant="link" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Matches
          </Button>
        </Link>
      </div>
    );
  }

  const timeUntil = new Date(match.startsAt).getTime() - Date.now();
  const hoursUntil = Math.floor(timeUntil / (1000 * 60 * 60));
  const minutesUntil = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));

  const handleToggleLeg = (pick: "home" | "away" | "draw", odds: number) => {
    toggleLeg({
      matchId: match.id,
      pick,
      odds,
      matchInfo: {
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        sport: match.sport,
      },
    });
  };

  // Prepare model data for comparison table
  const modelResults = [];
  if (analysis?.poisson) {
    modelResults.push({
      name: "Poisson",
      icon: "📈",
      home: analysis.poisson.homeWin,
      draw: analysis.poisson.draw,
      away: analysis.poisson.awayWin,
      predictedScore: analysis.poisson.predictedScore,
    });
  }
  if (analysis?.dixonColes) {
    modelResults.push({
      name: "Dixon-Coles",
      icon: "📊",
      home: analysis.dixonColes.adjustedHomeWin,
      draw: analysis.dixonColes.adjustedDraw,
      away: analysis.dixonColes.adjustedAwayWin,
    });
  }
  if (analysis?.elo) {
    modelResults.push({
      name: "Elo Rating",
      icon: "⚡",
      home: analysis.elo.homeWinProb,
      draw: analysis.elo.drawProb,
      away: analysis.elo.awayWinProb,
    });
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/matches">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Trophy className="w-4 h-4" />
            <span>{match.league || match.sport}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            {timeUntil > 0 ? (
              <Badge variant="secondary" className="bg-neon-cyan/20 text-neon-cyan border-neon-cyan/30">
                Live in {hoursUntil}h {minutesUntil}m
              </Badge>
            ) : (
              <Badge variant="secondary">{match.status}</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Match Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="bg-card/80 backdrop-blur-sm border-border/50 overflow-hidden">
          <CardContent className="pt-6">
            {/* Teams and Odds */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {/* Home */}
              <div className="text-center">
                <h2 className="text-xl font-bold mb-3">{match.homeTeam}</h2>
                {match.homeOdds && (
                  <Button
                    variant={isSelected(match.id, "home") ? "default" : "outline"}
                    className={`w-full h-16 flex flex-col ${
                      isSelected(match.id, "home")
                        ? "bg-neon-cyan text-black"
                        : "hover:border-neon-cyan/50 hover:bg-neon-cyan/10"
                    }`}
                    onClick={() => handleToggleLeg("home", parseFloat(match.homeOdds!))}
                  >
                    <span className="text-xs opacity-70">HOME</span>
                    <span className="text-xl font-bold">{formatOdds(parseFloat(match.homeOdds))}</span>
                  </Button>
                )}
              </div>

              {/* Draw */}
              <div className="text-center">
                <h2 className="text-xl font-bold mb-3 text-muted-foreground">vs</h2>
                {match.drawOdds && (
                  <Button
                    variant={isSelected(match.id, "draw") ? "default" : "outline"}
                    className={`w-full h-16 flex flex-col ${
                      isSelected(match.id, "draw")
                        ? "bg-muted-foreground text-background"
                        : "hover:border-muted-foreground/50 hover:bg-muted/30"
                    }`}
                    onClick={() => handleToggleLeg("draw", parseFloat(match.drawOdds!))}
                  >
                    <span className="text-xs opacity-70">DRAW</span>
                    <span className="text-xl font-bold">{formatOdds(parseFloat(match.drawOdds))}</span>
                  </Button>
                )}
              </div>

              {/* Away */}
              <div className="text-center">
                <h2 className="text-xl font-bold mb-3">{match.awayTeam}</h2>
                {match.awayOdds && (
                  <Button
                    variant={isSelected(match.id, "away") ? "default" : "outline"}
                    className={`w-full h-16 flex flex-col ${
                      isSelected(match.id, "away")
                        ? "bg-neon-magenta text-black"
                        : "hover:border-neon-magenta/50 hover:bg-neon-magenta/10"
                    }`}
                    onClick={() => handleToggleLeg("away", parseFloat(match.awayOdds!))}
                  >
                    <span className="text-xs opacity-70">AWAY</span>
                    <span className="text-xl font-bold">{formatOdds(parseFloat(match.awayOdds))}</span>
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Analysis Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-muted/30 p-1">
          <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <BarChart3 className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="models" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <TrendingUp className="w-4 h-4 mr-2" />
            Models
          </TabsTrigger>
          <TabsTrigger value="value" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Target className="w-4 h-4 mr-2" />
            Value
          </TabsTrigger>
          <TabsTrigger value="insights" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Zap className="w-4 h-4 mr-2" />
            Insights
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {analysisLoading ? (
            <Card>
              <CardContent className="py-12 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </CardContent>
            </Card>
          ) : analysis ? (
            <>
              {/* Consensus Probability */}
              <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    Consensus Probability
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ProbabilityBar
                    homeWin={analysis.consensus.homeWin}
                    draw={analysis.consensus.draw}
                    awayWin={analysis.consensus.awayWin}
                    homeTeam={match.homeTeam}
                    awayTeam={match.awayTeam}
                  />
                </CardContent>
              </Card>

              {/* Model Agreement */}
              <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                <CardContent className="pt-6">
                  <ConfidenceMeter agreement={analysis.consensus.modelAgreement} />
                </CardContent>
              </Card>

              {/* Quick Stats */}
              {analysis.elo && (
                <div className="grid grid-cols-2 gap-4">
                  <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                    <CardContent className="pt-6 text-center">
                      <div className="text-sm text-muted-foreground mb-1">{match.homeTeam} Elo</div>
                      <div className="text-2xl font-bold text-neon-cyan">
                        {Math.round(analysis.elo.homeRating)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                    <CardContent className="pt-6 text-center">
                      <div className="text-sm text-muted-foreground mb-1">{match.awayTeam} Elo</div>
                      <div className="text-2xl font-bold text-neon-magenta">
                        {Math.round(analysis.elo.awayRating)}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Analysis not available for this match
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Models Tab */}
        <TabsContent value="models">
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Model Predictions</CardTitle>
            </CardHeader>
            <CardContent>
              {modelResults.length > 0 ? (
                <ModelComparison models={modelResults} />
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  No model data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Value Tab */}
        <TabsContent value="value">
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="w-5 h-5 text-neon-green" />
                Value Detection
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analysis?.value ? (
                <ValueSection
                  bestValue={analysis.value.bestValue}
                  homeValue={analysis.value.home}
                  drawValue={analysis.value.draw}
                  awayValue={analysis.value.away}
                />
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  Value analysis not available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights">
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap className="w-5 h-5 text-neon-orange" />
                AI Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <InsightCards insights={analysis?.insights || []} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
