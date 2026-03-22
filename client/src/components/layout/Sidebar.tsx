import { Link } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import {
  LayoutDashboard,
  Calendar,
  Receipt,
  BarChart3,
  MessageSquare,
  Target,
  FlaskConical,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/matches", label: "Matches", icon: Calendar },
  { href: "/value", label: "Value Bets", icon: Target },
  { href: "/slips", label: "My Slips", icon: Receipt },
  { href: "/analysis", label: "Analysis", icon: BarChart3 },
  { href: "/backtesting", label: "Backtesting", icon: FlaskConical },
  { href: "/chat", label: "AI Chat", icon: MessageSquare },
];

export function Sidebar() {
  const [location] = useHashLocation();

  return (
    <aside className="w-64 border-r border-border/50 bg-card/50 backdrop-blur-sm min-h-[calc(100vh-4rem)]">
      <nav className="p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;

          return (
            <Link key={item.href} href={item.href}>
              <a
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200",
                  isActive
                    ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 shadow-sm shadow-neon-cyan/20"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4", isActive && "text-neon-cyan")} />
                {item.label}
              </a>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
