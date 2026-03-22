import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Calendar, Filter, BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BetBuilder } from "@/components/betting/BetBuilder";
import { formatDate, formatOdds, cn } from "@/lib/utils";
import { useParlay } from "@/contexts/ParlayContext";

interface Match {
  id: number;
  sport: string;
  league: string | null;
  homeTeam: string;
  awayTeam: string;
  homeOdds: string | null;
  awayOdds: string | null;
  drawOdds: string | null;
  startsAt: string;
  status: string;
}

export function Matches() {
  const [sportFilter, setSportFilter] = useState<string>("all");
  const { toggleLeg, isSelected } = useParlay();

  const { data, isLoading } = useQuery<{ matches: Match[] }>({
    queryKey: ["/api/matches"],
  });

  const matches: Match[] = data?.matches || [];

  const filteredMatches =
    sportFilter === "all"
      ? matches
      : matches.filter((m) => m.sport.toLowerCase() === sportFilter.toLowerCase());

  const sports = [...new Set(matches.map((m) => m.sport))];

  const handleToggleLeg = (match: Match, pick: string, odds: number) => {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Matches</h1>
          <p className="text-muted-foreground">Browse upcoming matches and build your parlay</p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={sportFilter} onValueChange={setSportFilter}>
            <SelectTrigger className="w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by sport" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sports</SelectItem>
              {sports.map((sport) => (
                <SelectItem key={sport} value={sport.toLowerCase()}>
                  {sport}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Matches List */}
        <div className="lg:col-span-2 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredMatches.length > 0 ? (
            <div className="grid gap-3">
              {filteredMatches.map((match) => (
                <Card key={match.id} className="bg-card/80 backdrop-blur-sm border-border/50 hover:border-primary/30 transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <Link href={`/match/${match.id}`}>
                        <div className="flex-1 cursor-pointer group">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">{match.sport}</Badge>
                            {match.league && (
                              <span className="text-xs text-muted-foreground">{match.league}</span>
                            )}
                          </div>
                          <h3 className="font-semibold group-hover:text-primary transition-colors">
                            {match.homeTeam} vs {match.awayTeam}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(match.startsAt)}
                          </div>
                        </div>
                      </Link>

                      <div className="flex items-center gap-2">
                        {match.homeOdds && (
                          <Button
                            variant={isSelected(match.id, "home") ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleToggleLeg(match, "home", parseFloat(match.homeOdds!))}
                            className={cn(
                              "min-w-20 h-14 flex flex-col",
                              isSelected(match.id, "home")
                                ? "bg-neon-cyan text-black"
                                : "hover:border-neon-cyan/50 hover:bg-neon-cyan/10"
                            )}
                          >
                            <span className="text-xs opacity-70">Home</span>
                            <span className="font-bold">{formatOdds(match.homeOdds)}</span>
                          </Button>
                        )}

                        {match.drawOdds && (
                          <Button
                            variant={isSelected(match.id, "draw") ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleToggleLeg(match, "draw", parseFloat(match.drawOdds!))}
                            className={cn(
                              "min-w-20 h-14 flex flex-col",
                              isSelected(match.id, "draw")
                                ? "bg-muted-foreground text-background"
                                : "hover:border-muted-foreground/50 hover:bg-muted/30"
                            )}
                          >
                            <span className="text-xs opacity-70">Draw</span>
                            <span className="font-bold">{formatOdds(match.drawOdds)}</span>
                          </Button>
                        )}

                        {match.awayOdds && (
                          <Button
                            variant={isSelected(match.id, "away") ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleToggleLeg(match, "away", parseFloat(match.awayOdds!))}
                            className={cn(
                              "min-w-20 h-14 flex flex-col",
                              isSelected(match.id, "away")
                                ? "bg-neon-magenta text-black"
                                : "hover:border-neon-magenta/50 hover:bg-neon-magenta/10"
                            )}
                          >
                            <span className="text-xs opacity-70">Away</span>
                            <span className="font-bold">{formatOdds(match.awayOdds)}</span>
                          </Button>
                        )}

                        <Link href={`/match/${match.id}`}>
                          <Button variant="ghost" size="icon" className="h-14 w-10">
                            <BarChart3 className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-card/80 backdrop-blur-sm">
              <CardContent className="py-12">
                <p className="text-center text-muted-foreground">
                  No matches available. Check back later for upcoming events.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Bet Builder Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-4">
            <BetBuilder />
          </div>
        </div>
      </div>
    </div>
  );
}
