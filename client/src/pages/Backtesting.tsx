import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";
import {
  FlaskConical,
  Plus,
  Play,
  Trash2,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Target,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";

interface Strategy {
  id: number;
  name: string;
  description?: string;
  criteria: {
    sports?: string[];
    minEdge?: number;
    maxOdds?: number;
    minOdds?: number;
    markets?: string[];
  };
  stakeType: string;
  stakeAmount?: string;
  kellyFraction?: string;
  isActive: boolean;
  createdAt: string;
}

interface BacktestResult {
  id: number;
  strategyId: number;
  totalBets: number;
  wonBets: number;
  lostBets: number;
  winRate: string;
  profit: string;
  roiPercent: string;
  maxDrawdown: string;
  sharpeRatio: string;
  bets?: Array<{
    matchId: number;
    date: string;
    market: string;
    odds: number;
    stake: number;
    result: string;
    profit: number;
  }>;
  computedAt: string;
}

export function Backtesting() {
  const queryClient = useQueryClient();
  const [selectedStrategy, setSelectedStrategy] = useState<number | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newStrategy, setNewStrategy] = useState({
    name: "",
    minEdge: 0.02,
    maxOdds: 3,
    minOdds: 1.2,
    stakeType: "fixed",
    stakeAmount: 10,
    markets: ["home", "away"],
  });

  const { data: strategiesData, isLoading: strategiesLoading } = useQuery<{
    strategies: Strategy[];
  }>({
    queryKey: ["/api/strategies"],
  });

  const { data: backtestData, isLoading: backtestLoading } = useQuery<{
    results: BacktestResult[];
  }>({
    queryKey: [`/api/strategies/${selectedStrategy}/backtest`],
    enabled: !!selectedStrategy,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newStrategy) => {
      const res = await fetch("/api/strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          criteria: {
            minEdge: data.minEdge,
            maxOdds: data.maxOdds,
            minOdds: data.minOdds,
            markets: data.markets,
          },
          stakeType: data.stakeType,
          stakeAmount: data.stakeAmount,
        }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategies"] });
      setIsCreateOpen(false);
      setNewStrategy({
        name: "",
        minEdge: 0.02,
        maxOdds: 3,
        minOdds: 1.2,
        stakeType: "fixed",
        stakeAmount: 10,
        markets: ["home", "away"],
      });
    },
  });

  const runBacktestMutation = useMutation({
    mutationFn: async (strategyId: number) => {
      const res = await fetch(`/api/strategies/${strategyId}/backtest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initialBankroll: 1000,
        }),
      });
      return res.json();
    },
    onSuccess: (_, strategyId) => {
      queryClient.invalidateQueries({
        queryKey: [`/api/strategies/${strategyId}/backtest`],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (strategyId: number) => {
      await fetch(`/api/strategies/${strategyId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategies"] });
      setSelectedStrategy(null);
    },
  });

  const strategies = strategiesData?.strategies || [];
  const latestResult = backtestData?.results?.[0];

  // Prepare chart data from bets
  const chartData =
    latestResult?.bets?.map((bet, index) => {
      const runningTotal = latestResult.bets!
        .slice(0, index + 1)
        .reduce((sum, b) => sum + b.profit, 0);
      return {
        bet: index + 1,
        profit: runningTotal,
        date: new Date(bet.date).toLocaleDateString(),
      };
    }) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-neon-cyan" />
            Strategy Backtesting
          </h1>
          <p className="text-muted-foreground">
            Build and test betting strategies on historical data
          </p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-neon-cyan text-black hover:bg-neon-cyan/80">
              <Plus className="w-4 h-4 mr-2" />
              New Strategy
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create Strategy</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Strategy Name</Label>
                <Input
                  value={newStrategy.name}
                  onChange={(e) =>
                    setNewStrategy({ ...newStrategy, name: e.target.value })
                  }
                  placeholder="e.g., Value Favorites"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Min Edge (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newStrategy.minEdge * 100}
                    onChange={(e) =>
                      setNewStrategy({
                        ...newStrategy,
                        minEdge: parseFloat(e.target.value) / 100,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Odds</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={newStrategy.maxOdds}
                    onChange={(e) =>
                      setNewStrategy({
                        ...newStrategy,
                        maxOdds: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Stake Type</Label>
                <Select
                  value={newStrategy.stakeType}
                  onValueChange={(value) =>
                    setNewStrategy({ ...newStrategy, stakeType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed ($)</SelectItem>
                    <SelectItem value="kelly">Kelly Criterion</SelectItem>
                    <SelectItem value="percentage">% of Bankroll</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Stake Amount</Label>
                <Input
                  type="number"
                  value={newStrategy.stakeAmount}
                  onChange={(e) =>
                    setNewStrategy({
                      ...newStrategy,
                      stakeAmount: parseFloat(e.target.value),
                    })
                  }
                />
              </div>

              <Button
                className="w-full"
                onClick={() => createMutation.mutate(newStrategy)}
                disabled={!newStrategy.name || createMutation.isPending}
              >
                {createMutation.isPending ? "Creating..." : "Create Strategy"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Strategy List */}
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Your Strategies</CardTitle>
          </CardHeader>
          <CardContent>
            {strategiesLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            ) : strategies.length > 0 ? (
              <div className="space-y-2">
                {strategies.map((strategy) => (
                  <motion.div
                    key={strategy.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-all",
                      selectedStrategy === strategy.id
                        ? "border-neon-cyan bg-neon-cyan/10"
                        : "border-border/30 hover:border-border/60"
                    )}
                    onClick={() => setSelectedStrategy(strategy.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{strategy.name}</h4>
                        <p className="text-xs text-muted-foreground">
                          {strategy.criteria.minEdge
                            ? `${(strategy.criteria.minEdge * 100).toFixed(0)}% min edge`
                            : "No filters"}
                        </p>
                      </div>
                      <Badge
                        variant={strategy.isActive ? "default" : "secondary"}
                      >
                        {strategy.stakeType}
                      </Badge>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FlaskConical className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>No strategies yet</p>
                <p className="text-sm">Create your first strategy</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results Area */}
        <div className="lg:col-span-2 space-y-4">
          {selectedStrategy ? (
            <>
              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  onClick={() => runBacktestMutation.mutate(selectedStrategy)}
                  disabled={runBacktestMutation.isPending}
                  className="bg-neon-green text-black hover:bg-neon-green/80"
                >
                  <Play className="w-4 h-4 mr-2" />
                  {runBacktestMutation.isPending
                    ? "Running..."
                    : "Run Backtest"}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteMutation.mutate(selectedStrategy)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              {/* Results */}
              {backtestLoading ? (
                <Card className="bg-card/80 backdrop-blur-sm">
                  <CardContent className="py-12 flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </CardContent>
                </Card>
              ) : latestResult ? (
                <>
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-card/80 backdrop-blur-sm">
                      <CardContent className="pt-4 text-center">
                        <p className="text-xs text-muted-foreground">
                          Total Bets
                        </p>
                        <p className="text-2xl font-bold">
                          {latestResult.totalBets}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-card/80 backdrop-blur-sm">
                      <CardContent className="pt-4 text-center">
                        <p className="text-xs text-muted-foreground">
                          Win Rate
                        </p>
                        <p className="text-2xl font-bold">
                          {(parseFloat(latestResult.winRate) * 100).toFixed(1)}%
                        </p>
                      </CardContent>
                    </Card>
                    <Card
                      className={cn(
                        "bg-card/80 backdrop-blur-sm",
                        parseFloat(latestResult.profit) > 0
                          ? "border-neon-green/30"
                          : "border-destructive/30"
                      )}
                    >
                      <CardContent className="pt-4 text-center">
                        <p className="text-xs text-muted-foreground">Profit</p>
                        <p
                          className={cn(
                            "text-2xl font-bold",
                            parseFloat(latestResult.profit) > 0
                              ? "text-neon-green"
                              : "text-destructive"
                          )}
                        >
                          ${parseFloat(latestResult.profit).toFixed(2)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card
                      className={cn(
                        "bg-card/80 backdrop-blur-sm",
                        parseFloat(latestResult.roiPercent) > 0
                          ? "border-neon-green/30"
                          : "border-destructive/30"
                      )}
                    >
                      <CardContent className="pt-4 text-center">
                        <p className="text-xs text-muted-foreground">ROI</p>
                        <p
                          className={cn(
                            "text-2xl font-bold flex items-center justify-center gap-1",
                            parseFloat(latestResult.roiPercent) > 0
                              ? "text-neon-green"
                              : "text-destructive"
                          )}
                        >
                          {parseFloat(latestResult.roiPercent) > 0 ? (
                            <TrendingUp className="w-5 h-5" />
                          ) : (
                            <TrendingDown className="w-5 h-5" />
                          )}
                          {parseFloat(latestResult.roiPercent).toFixed(2)}%
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* ROI Chart */}
                  {chartData.length > 0 && (
                    <Card className="bg-card/80 backdrop-blur-sm">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <BarChart3 className="w-5 h-5" />
                          Profit Over Time
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="hsl(var(--border))"
                              />
                              <XAxis
                                dataKey="bet"
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                              />
                              <YAxis
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                                tickFormatter={(v) => `$${v}`}
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "hsl(var(--card))",
                                  border: "1px solid hsl(var(--border))",
                                  borderRadius: "8px",
                                }}
                                labelStyle={{ color: "hsl(var(--foreground))" }}
                              />
                              <Line
                                type="monotone"
                                dataKey="profit"
                                stroke="hsl(var(--neon-cyan))"
                                strokeWidth={2}
                                dot={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Additional Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="bg-card/80 backdrop-blur-sm">
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            Max Drawdown
                          </span>
                          <span className="font-bold text-destructive">
                            -{parseFloat(latestResult.maxDrawdown).toFixed(2)}%
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-card/80 backdrop-blur-sm">
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            Sharpe Ratio
                          </span>
                          <span className="font-bold">
                            {parseFloat(latestResult.sharpeRatio).toFixed(2)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </>
              ) : (
                <Card className="bg-card/80 backdrop-blur-sm">
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No backtest results yet</p>
                    <p className="text-sm">
                      Click "Run Backtest" to test this strategy
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card className="bg-card/80 backdrop-blur-sm">
              <CardContent className="py-12 text-center text-muted-foreground">
                <FlaskConical className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select a strategy to view results</p>
                <p className="text-sm">Or create a new strategy to get started</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
