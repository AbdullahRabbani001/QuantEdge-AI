import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  LineChart, 
  Wallet, 
  BrainCircuit, 
  Settings, 
  LogOut,
  Activity,
  Menu,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function Sidebar() {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const links = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/markets", label: "Markets", icon: LineChart },
    { href: "/portfolio", label: "Portfolio", icon: Wallet },
    { href: "/strategies", label: "Quant Lab", icon: BrainCircuit },
  ];

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <>
      {/* Mobile Top Navbar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-16 border-b bg-card/95 backdrop-blur-xl flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
            <Activity className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-foreground">
            QuantEdge<span className="text-primary">.AI</span>
          </span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 hover:bg-primary/10 rounded-lg transition-colors"
          data-testid="button-mobile-menu"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
          onClick={closeMobileMenu}
        />
      )}

      {/* Mobile Sidebar (Slide-out) */}
      <aside
        className={cn(
          "md:hidden fixed top-16 right-0 z-40 h-[calc(100vh-4rem)] w-64 border-l bg-card/95 backdrop-blur-xl transition-transform duration-300 ease-in-out",
          mobileMenuOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex h-full flex-col px-4 py-6">
          {/* Nav */}
          <nav className="flex-1 space-y-1">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = location === link.href;
              
              return (
                <Link key={link.href} href={link.href}>
                  <div
                    onClick={closeMobileMenu}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all hover:bg-primary/10 hover:text-primary cursor-pointer",
                      isActive 
                        ? "bg-primary/15 text-primary shadow-[0_0_15px_-5px_rgba(0,255,255,0.3)]" 
                        : "text-muted-foreground"
                    )}
                  >
                    <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary")} />
                    {link.label}
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Bottom */}
          <div className="border-t border-border pt-4">
            <button 
              onClick={() => window.location.href = '/api/logout'}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden md:block fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card/50 backdrop-blur-xl">
        <div className="flex h-full flex-col px-4 py-6">
          {/* Logo */}
          <div className="mb-10 flex items-center gap-2 px-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
              <Activity className="h-5 w-5" />
            </div>
            <span className="font-display text-xl font-bold tracking-tight text-foreground">
              QuantEdge<span className="text-primary">.AI</span>
            </span>
          </div>

          {/* Nav */}
          <nav className="flex-1 space-y-1">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = location === link.href;
              
              return (
                <Link key={link.href} href={link.href}>
                  <div
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all hover:bg-primary/10 hover:text-primary cursor-pointer",
                      isActive 
                        ? "bg-primary/15 text-primary shadow-[0_0_15px_-5px_rgba(0,255,255,0.3)]" 
                        : "text-muted-foreground"
                    )}
                  >
                    <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary")} />
                    {link.label}
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Bottom */}
          <div className="border-t border-border pt-4">
            <button 
              onClick={() => window.location.href = '/api/logout'}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
