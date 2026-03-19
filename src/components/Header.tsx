import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAccessControl } from '@/hooks/useAccessControl';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TrendingUp, Sun, Moon, LogOut, PlusCircle, History, Menu, X, Shield, Briefcase, Settings, Crown, Zap, PieChart, HelpCircle, Sparkles, Palette } from 'lucide-react';
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
    { label: 'Diversificador', path: '/diversificador', icon: PieChart },
    { label: 'FAQ', path: '/faq', icon: HelpCircle },
    { label: 'Configurações', path: '/settings', icon: Settings },
    ...(access.isAdmin ? [{ label: 'Admin', path: '/admin', icon: Shield }] : []),
  ];

  const isFree = access.planType === 'free';

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-card/80 backdrop-blur-md">
      <div className="container flex h-14 items-center justify-between">
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 font-bold text-lg shrink-0">
          <img src="/assets/logo.png" alt="Opções PRO X" className="h-8 w-8 object-contain" />
          <span className="hidden sm:inline tracking-tight">Opções PRO X</span>
          <Badge variant="outline" className={cn(
            "text-[8px] hidden sm:inline-flex",
            isFree ? "border-warning/50 text-warning" : "border-primary/30 text-primary"
          )}>
            {access.planType === 'pro' ? 'PRO' : 'FREE'}
          </Badge>
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

        <div className="flex items-center gap-2">
          {isFree && (
            <Button 
              onClick={() => navigate('/settings')}
              className="hidden sm:flex h-9 px-4 bg-warning hover:bg-warning/90 text-warning-foreground font-black text-[10px] uppercase tracking-widest animate-pulse shadow-[0_0_15px_-3px_hsl(var(--warning)/0.6)] border-b-2 border-black/20"
            >
              <Zap className="h-3 w-3 mr-1.5 fill-current" /> ASSINE PRO
            </Button>
          )}
          
          <Button 
            variant="outline" 
            size="icon" 
            onClick={toggleTheme} 
            className="h-9 w-9 border-foreground/30 bg-foreground/10 hover:bg-foreground/20 text-foreground shadow-sm"
          >
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
            {isFree && (
              <button
                onClick={() => { navigate('/settings'); setMobileOpen(false); }}
                className="flex items-center justify-center gap-2 w-full px-4 py-3 mb-2 rounded-lg bg-warning text-warning-foreground font-black text-xs animate-pulse"
              >
                <Zap className="h-4 w-4 fill-current" /> ASSINE PRO AGORA
              </button>
            )}
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