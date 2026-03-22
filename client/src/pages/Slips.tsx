import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Receipt, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatCurrency } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

interface Slip {
  id: number;
  stake: string | null;
  potentialPayout: string | null;
  status: string;
  createdAt: string;
  legs?: Array<{
    id: number;
    matchId: number;
    pick: string;
    odds: string;
    status: string;
  }>;
}

export function Slips() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ slips: Slip[] }>({
    queryKey: ["/api/slips"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/slips/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/slips"] });
    },
  });

  const slips: Slip[] = data?.slips || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "won":
        return <Badge variant="success">Won</Badge>;
      case "lost":
        return <Badge variant="destructive">Lost</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const stats = {
    total: slips.length,
    pending: slips.filter((s) => s.status === "pending").length,
    won: slips.filter((s) => s.status === "won").length,
    lost: slips.filter((s) => s.status === "lost").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Slips</h1>
        <p className="text-muted-foreground">Track your betting slips and parlays</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Slips</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Won
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.won}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Lost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.lost}</div>
          </CardContent>
        </Card>
      </div>

      {/* Slips List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : slips.length > 0 ? (
        <div className="space-y-4">
          {slips.map((slip) => (
            <Card key={slip.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Receipt className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-lg">Slip #{slip.id}</CardTitle>
                      <CardDescription>{formatDate(slip.createdAt)}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {getStatusBadge(slip.status)}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(slip.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between border-t pt-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Stake</p>
                    <p className="text-lg font-semibold">
                      {slip.stake ? formatCurrency(slip.stake) : "--"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Potential Payout</p>
                    <p className="text-lg font-semibold text-primary">
                      {slip.potentialPayout ? formatCurrency(slip.potentialPayout) : "--"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No slips yet</h3>
              <p className="text-muted-foreground mb-4">
                Build your first parlay by selecting matches
              </p>
              <Button onClick={() => (window.location.hash = "#/matches")}>
                Browse Matches
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
