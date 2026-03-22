import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { TrendingUp, Calendar, Receipt, BarChart3, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatOdds } from "@/lib/utils";

interface Match {
  id: number;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  homeOdds: string;
  awayOdds: string;
  drawOdds: string | null;
  startsAt: string;
}

interface Slip {
  id: number;
  status: string;
  potentialPayout: string | null;
  createdAt: string;
}

export function Dashboard() {
  const { data: matchesData } = useQuery<{ matches: Match[] }>({
    queryKey: ["/api/matches?status=upcoming"],
  });

  const { data: slipsData } = useQuery<{ slips: Slip[] }>({
    queryKey: ["/api/slips"],
  });

  const upcomingMatches = matchesData?.matches?.slice(0, 3) || [];
  const recentSlips = slipsData?.slips?.slice(0, 3) || [];
  const pendingSlips = slipsData?.slips?.filter((s) => s.status === "pending").length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your betting overview.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Matches</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{matchesData?.matches?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Available for betting</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Slips</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingSlips}</div>
            <p className="text-xs text-muted-foreground">Pending results</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Slips</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{slipsData?.slips?.length || 0}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-muted-foreground">Start betting to track</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Matches */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Upcoming Matches</CardTitle>
                <CardDescription>Next matches available for betting</CardDescription>
              </div>
              <Link href="/matches">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {upcomingMatches.length > 0 ? (
              <div className="space-y-4">
                {upcomingMatches.map((match: any) => (
                  <div
                    key={match.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div>
                      <p className="font-medium">
                        {match.homeTeam} vs {match.awayTeam}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {match.sport} - {formatDate(match.startsAt)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline">{formatOdds(match.homeOdds)}</Badge>
                      {match.drawOdds && (
                        <Badge variant="outline">{formatOdds(match.drawOdds)}</Badge>
                      )}
                      <Badge variant="outline">{formatOdds(match.awayOdds)}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No upcoming matches available
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recent Slips */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Slips</CardTitle>
                <CardDescription>Your latest betting slips</CardDescription>
              </div>
              <Link href="/slips">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentSlips.length > 0 ? (
              <div className="space-y-4">
                {recentSlips.map((slip: any) => (
                  <div
                    key={slip.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div>
                      <p className="font-medium">Slip #{slip.id}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(slip.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {slip.potentialPayout && (
                        <span className="text-sm font-medium">
                          ${parseFloat(slip.potentialPayout).toFixed(2)}
                        </span>
                      )}
                      <Badge
                        variant={
                          slip.status === "won"
                            ? "success"
                            : slip.status === "lost"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {slip.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No slips yet. Start building parlays!
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
