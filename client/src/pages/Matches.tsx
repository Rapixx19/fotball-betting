import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Filter } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, formatOdds, toAmericanOdds } from "@/lib/utils";
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
  const { legs, toggleLeg, clearLegs, isSelected, combinedOdds, legCount } = useParlay();

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

      {/* Selected Legs Summary */}
      {legCount > 0 && (
        <Card className="border-primary">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Your Parlay ({legCount} legs)</CardTitle>
            <CardDescription>
              Combined Odds: <span className="font-bold text-foreground">{formatOdds(combinedOdds)}</span>
              {" "}({toAmericanOdds(combinedOdds)})
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {legs.map((leg) => (
                <Badge key={`${leg.matchId}-${leg.pick}`} variant="secondary">
                  {leg.matchInfo?.homeTeam} vs {leg.matchInfo?.awayTeam}: {leg.pick}
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  window.location.hash = "#/analysis";
                }}
              >
                Analyze Parlay
              </Button>
              <Button variant="outline" onClick={clearLegs}>
                Clear All
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredMatches.length > 0 ? (
        <div className="grid gap-4">
          {filteredMatches.map((match) => (
            <Card key={match.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{match.sport}</Badge>
                      {match.league && (
                        <span className="text-sm text-muted-foreground">{match.league}</span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold">
                      {match.homeTeam} vs {match.awayTeam}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <Calendar className="h-4 w-4" />
                      {formatDate(match.startsAt)}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {match.homeOdds && (
                      <Button
                        variant={isSelected(match.id, "home") ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleToggleLeg(match, "home", parseFloat(match.homeOdds!))}
                        className="min-w-24"
                      >
                        <div className="text-center">
                          <div className="text-xs opacity-70">Home</div>
                          <div className="font-bold">{formatOdds(match.homeOdds)}</div>
                        </div>
                      </Button>
                    )}

                    {match.drawOdds && (
                      <Button
                        variant={isSelected(match.id, "draw") ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleToggleLeg(match, "draw", parseFloat(match.drawOdds!))}
                        className="min-w-24"
                      >
                        <div className="text-center">
                          <div className="text-xs opacity-70">Draw</div>
                          <div className="font-bold">{formatOdds(match.drawOdds)}</div>
                        </div>
                      </Button>
                    )}

                    {match.awayOdds && (
                      <Button
                        variant={isSelected(match.id, "away") ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleToggleLeg(match, "away", parseFloat(match.awayOdds!))}
                        className="min-w-24"
                      >
                        <div className="text-center">
                          <div className="text-xs opacity-70">Away</div>
                          <div className="font-bold">{formatOdds(match.awayOdds)}</div>
                        </div>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">
              No matches available. Check back later for upcoming events.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
