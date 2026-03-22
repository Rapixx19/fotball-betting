import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Target, TrendingUp, Clock, ArrowRight, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ValueBadge } from "@/components/analysis/ValueBadge";
import { formatOdds, formatDate } from "@/lib/utils";
import { useState } from "react";

interface ValueBet {
  match: {
    id: number;
    homeTeam: string;
    awayTeam: string;
    sport: string;
    league?: string;
    homeOdds?: string;
    awayOdds?: string;
    drawOdds?: string;
    startsAt: string;
  };
  valueResult: {
    market: string;
    edge: number;
    modelProbability: number;
    impliedProbability: number;
    kellyStake: number;
    confidence: "low" | "medium" | "high";
  };
  confidence: string;
}

export function ValueBets() {
  const [minEdge, setMinEdge] = useState("0.02");
  const [selectedSport, setSelectedSport] = useState("");

  const { data, isLoading } = useQuery<{
    valueBets: ValueBet[];
    total: number;
    minEdgeUsed: number;
  }>({
    queryKey: ["/api/value-bets", { minEdge, sport: selectedSport }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("minEdge", minEdge);
      if (selectedSport) params.set("sport", selectedSport);
      const res = await fetch(`/api/value-bets?${params}`);
      return res.json();
    },
  });

  const { data: sportsData } = useQuery<{ sports: Array<{ sport: string }> }>({
    queryKey: ["/api/sports"],
  });

  const sports = [...new Set(sportsData?.sports?.map(s => s.sport) || [])];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="w-6 h-6 text-neon-green" />
            Value Bets
          </h1>
          <p className="text-muted-foreground">
            Positive EV opportunities detected by our algorithms
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={minEdge} onValueChange={setMinEdge}>
            <SelectTrigger className="w-[140px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Min Edge" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0.01">1%+ Edge</SelectItem>
              <SelectItem value="0.02">2%+ Edge</SelectItem>
              <SelectItem value="0.03">3%+ Edge</SelectItem>
              <SelectItem value="0.05">5%+ Edge</SelectItem>
              <SelectItem value="0.10">10%+ Edge</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedSport} onValueChange={setSelectedSport}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Sports" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Sports</SelectItem>
              {sports.map((sport) => (
                <SelectItem key={sport} value={sport}>
                  {sport}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card/80 backdrop-blur-sm border-neon-green/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Value Bets Found</p>
                <p className="text-3xl font-bold text-neon-green">{data?.total || 0}</p>
              </div>
              <Target className="w-10 h-10 text-neon-green/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Min Edge Filter</p>
                <p className="text-3xl font-bold">{parseFloat(minEdge) * 100}%</p>
              </div>
              <TrendingUp className="w-10 h-10 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Edge</p>
                <p className="text-3xl font-bold">
                  {data?.valueBets && data.valueBets.length > 0
                    ? (
                        (data.valueBets.reduce((acc, v) => acc + v.valueResult.edge, 0) /
                          data.valueBets.length) *
                        100
                      ).toFixed(1) + "%"
                    : "--"}
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Value Bets List */}
      <Card className="bg-card/80 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Opportunities</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : data?.valueBets && data.valueBets.length > 0 ? (
            <div className="space-y-3">
              {data.valueBets.map((item, index) => (
                <motion.div
                  key={`${item.match.id}-${item.valueResult.market}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link href={`/match/${item.match.id}`}>
                    <div className="p-4 rounded-lg bg-muted/20 border border-border/30 hover:border-neon-green/30 hover:bg-muted/30 transition-all cursor-pointer group">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <Badge variant="outline" className="text-xs">
                              {item.match.sport}
                            </Badge>
                            {item.match.league && (
                              <span>{item.match.league}</span>
                            )}
                          </div>
                          <h3 className="font-semibold">
                            {item.match.homeTeam} vs {item.match.awayTeam}
                          </h3>
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {formatDate(item.match.startsAt)}
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground mb-1">
                              Market: {item.valueResult.market.toUpperCase()}
                            </div>
                            <div className="text-lg font-bold">
                              {formatOdds(
                                item.valueResult.market === "home"
                                  ? parseFloat(item.match.homeOdds || "0")
                                  : item.valueResult.market === "away"
                                  ? parseFloat(item.match.awayOdds || "0")
                                  : parseFloat(item.match.drawOdds || "0")
                              )}
                            </div>
                          </div>

                          <ValueBadge
                            edge={item.valueResult.edge}
                            market={item.valueResult.market}
                            confidence={item.valueResult.confidence}
                            showKelly
                            kellyStake={item.valueResult.kellyStake}
                          />

                          <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-neon-green transition-colors" />
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No value bets found with current filters</p>
              <p className="text-sm">Try lowering the minimum edge threshold</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
