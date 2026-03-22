import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LogOut, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";

interface HeaderProps {
  user: { id: number; username: string };
}

export function Header({ user }: HeaderProps) {
  const queryClient = useQueryClient();

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("/api/auth/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });

  return (
    <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Zap className="h-7 w-7 text-neon-cyan" />
            <div className="absolute inset-0 h-7 w-7 bg-neon-cyan/30 blur-md" />
          </div>
          <span className="text-xl font-bold tracking-tight">
            Parlay<span className="text-neon-cyan">Edge</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            Welcome, <span className="font-medium text-foreground">{user.username}</span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            className="hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}
