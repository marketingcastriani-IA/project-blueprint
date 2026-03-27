import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAccessControl } from '@/hooks/useAccessControl';
import { Button } from '@/components/ui/button';

import { TrendingUp, Sun, Moon, LogOut, PlusCircle, History, Menu, X, Shield, Briefcase, Settings, Crown, Zap, PieChart, HelpCircle, Sparkles, Palette, BookOpen, Radio } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export default function Header() {
  const { signOut, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const access = useAccessControl();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { label: 'Nova Análise', path: '/dashboard', icon: PlusCircle },
    { label: 'Operações em Aberto', path: '/history', icon: History },
    { label: 'Portfólio', path: '/portfolio', icon: Briefcase },
    { label: 'Diversificador', path: '/diversificador', icon: PieChart },
    { label: 'Tempo Real', path: '/dados-ao-vivo', icon: Radio },
    { label: 'Manual', path: '/manual', icon: BookOpen },
    { label: 'FAQ', path: '/faq', icon: HelpCircle },
    { label: 'Configurações', path: '/settings', icon: Settings },
    ...(access.isAdmin ? [{ label: 'Admin', path: '/admin', icon: Shield }] : []),
  ];

  const isFree = access.planType === 'free';

  return (
    <header className="sticky top-0 z-50 border-b border-primary/30 bg-primary shadow-lg">
      <div className="container flex h-14 items-center justify-between">
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 font-black text-lg shrink-0">
          <img src="/assets/logo.png" alt="Opções PRO X" className="h-8 w-8 object-contain" />
          <span className="hidden sm:inline tracking-tight text-primary-foreground">Opções PRO X</span>
          <Badge variant="outline" className={cn(
            "text-[8px] hidden sm:inline-flex border-primary-foreground/40",
            isFree ? "text-yellow-300" : "text-primary-foreground"
          )}>
            {access.planType === 'pro' ? 'PRO' : 'FREE'}
          </Badge>
        </button>

        <nav className="hidden md:flex items-center gap-0.5">
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
            const isRealtime = item.path === '/dados-ao-vivo';
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all',
                  isRealtime && 'text-red-100 bg-red-600 hover:bg-red-500 animate-pulse shadow-[0_0_16px_rgba(239,68,68,0.5)] border border-red-400/50',
                  isRealtime && isActive && 'ring-2 ring-red-300',
                  !isRealtime && isActive && 'bg-primary-foreground/20 text-primary-foreground',
                  !isRealtime && !isActive && 'text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10'
                )}
              >
                <item.icon className={cn("h-3.5 w-3.5", isRealtime && "animate-pulse")} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {isFree && (
            <Button 
              onClick={() => navigate('/settings')}
              className="hidden sm:flex h-9 px-4 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-[10px] uppercase tracking-widest animate-pulse shadow-[0_0_15px_rgba(250,204,21,0.6)] border-b-2 border-black/20"
            >
              <Zap className="h-3 w-3 mr-1.5 fill-current" /> ASSINE PRO
            </Button>
          )}
          
          {user && (
            <Button variant="ghost" size="icon" onClick={async () => { await signOut(); navigate('/auth'); }} className="h-9 w-9 text-primary-foreground hover:bg-primary-foreground/10">
              <LogOut className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-9 w-9 md:hidden text-primary-foreground hover:bg-primary-foreground/10" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Theme selector strip */}
      <div className="hidden md:flex border-t border-border/30 bg-card/50 backdrop-blur-sm">
        <div className="container flex items-center gap-1 py-1">
          <Palette className="h-3 w-3 text-muted-foreground mr-1" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mr-2">Tema:</span>
          {([
            { key: 'light' as const, label: 'Branco', icon: Sun },
            { key: 'dark' as const, label: 'Dark', icon: Moon },
            { key: 'destaque' as const, label: 'Destaque', icon: Sparkles },
          ]).map(item => (
            <button
              key={item.key}
              onClick={() => setTheme(item.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-all',
                theme === item.key
                  ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className="h-3 w-3" />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border/40 bg-card/95 backdrop-blur-md animate-fade-in">
          <nav className="container py-2 space-y-1">
            {isFree && (
              <button
                onClick={() => { navigate('/settings'); setMobileOpen(false); }}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 mb-1 rounded-lg bg-warning text-warning-foreground font-black text-xs animate-pulse"
              >
                <Zap className="h-4 w-4 fill-current" /> ASSINE PRO AGORA
              </button>
            )}
            <div className="grid grid-cols-2 gap-1">
              {navItems.map(item => {
                const isActive = location.pathname === item.path;
                const isRealtime = item.path === '/dados-ao-vivo';
                return (
                  <button
                    key={item.path}
                    onClick={() => { navigate(item.path); setMobileOpen(false); }}
                    className={cn(
                      'flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all',
                      isRealtime && !isActive && 'text-warning animate-pulse border border-warning/30 bg-warning/5',
                      isRealtime && isActive && 'bg-warning/20 text-warning border border-warning/40',
                      !isRealtime && isActive && 'bg-primary/15 text-primary border border-primary/30',
                      !isRealtime && !isActive && 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    )}
                  >
                    <item.icon className={cn("h-3.5 w-3.5", isRealtime && "animate-pulse")} />
                    {item.label}
                  </button>
                );
              })}
            </div>
            {/* Theme selector mobile */}
            <div className="flex items-center gap-1 pt-2 mt-1 border-t border-border/30">
              <Palette className="h-3 w-3 text-muted-foreground ml-1" />
              <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mr-1">Tema:</span>
              {([
                { key: 'light' as const, label: 'Branco', icon: Sun },
                { key: 'dark' as const, label: 'Dark', icon: Moon },
                { key: 'destaque' as const, label: 'Destaque', icon: Sparkles },
              ]).map(item => (
                <button
                  key={item.key}
                  onClick={() => setTheme(item.key)}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-semibold transition-all',
                    theme === item.key
                      ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <item.icon className="h-3 w-3" />
                  {item.label}
                </button>
              ))}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}