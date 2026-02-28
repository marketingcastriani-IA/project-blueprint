import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAccessControl } from '@/hooks/useAccessControl';
import { Button } from '@/components/ui/button';
import { TrendingUp, Sun, Moon, LogOut, PlusCircle, History, Menu, X, Shield, Briefcase, Settings } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export default function Header() {
  const { signOut, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const access = useAccessControl();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { label: 'Nova Análise', path: '/dashboard', icon: PlusCircle },
    { label: 'Histórico', path: '/history', icon: History },
    { label: 'Portfólio', path: '/portfolio', icon: Briefcase },
    { label: 'Configurações', path: '/settings', icon: Settings },
    ...(access.isAdmin ? [{ label: 'Admin', path: '/admin', icon: Shield }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-card/80 backdrop-blur-md">
      <div className="container flex h-14 items-center justify-between">
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 font-bold text-lg shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-[0_0_16px_-4px_hsl(var(--primary)/0.5)]">
            <TrendingUp className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="hidden sm:inline tracking-tight">OpçõesX</span>
          <Badge variant="outline" className="text-[8px] border-primary/30 text-primary hidden sm:inline-flex">PRO</Badge>
        </button>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-1">
          {access.daysRemaining !== null && !access.isAdmin && (
            <Badge variant="outline" className="text-[9px] border-warning/40 text-warning mr-2 hidden sm:inline-flex">
              {access.daysRemaining}d restantes
            </Badge>
          )}
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          {user && (
            <Button variant="ghost" size="icon" onClick={signOut} className="h-9 w-9">
              <LogOut className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-9 w-9 md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border/40 bg-card/95 backdrop-blur-md animate-fade-in">
          <nav className="container py-2 space-y-1">
            {navItems.map(item => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => { navigate(item.path); setMobileOpen(false); }}
                  className={cn(
                    'flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium transition-all',
                    isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
