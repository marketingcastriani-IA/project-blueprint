import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAccessControl } from '@/hooks/useAccessControl';
import { useSharedRtdBridge } from '@/contexts/RtdBridgeContext';
import { Button } from '@/components/ui/button';

import { Sun, Moon, LogOut, PlusCircle, History, Menu, X, Shield, ShieldCheck, Briefcase, Settings, Zap, PieChart, HelpCircle, Sparkles, Palette, BookOpen, Radio, BarChart2, Calculator, Database, Waves, TreePine, Wifi, WifiOff } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import InstallAppButton from '@/components/InstallAppButton';

export default function Header() {
  const { signOut, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const access = useAccessControl();
  const { status: rtdStatus } = useSharedRtdBridge();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collarEnabled, setCollarEnabled] = useState(() => localStorage.getItem('feature-collar-tracker') !== 'false');

  useEffect(() => {
    const handler = () => setCollarEnabled(localStorage.getItem('feature-collar-tracker') !== 'false');
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // Primary nav items (always visible on desktop)
  const primaryNav = [
    { label: 'Nova Análise', path: '/dashboard', icon: PlusCircle },
    { label: 'Operações', path: '/history', icon: History },
    { label: 'Portfólio', path: '/portfolio', icon: Briefcase },
    { label: 'Diversificador', path: '/diversificador', icon: PieChart },
    { label: 'Tempo Real', path: '/dados-ao-vivo', icon: Radio },
    { label: 'Rastrear Box', path: '/box-tracker', icon: BarChart2 },
    ...(collarEnabled ? [{ label: 'Rastrear Collar', path: '/collar-tracker', icon: ShieldCheck }] : []),
    { label: 'Opções B3', path: '/ticker-opcoes', icon: Database },
  ];

  // Secondary nav items (inside "More" dropdown on md, visible on xl+)
  const secondaryNav = [
    { label: 'Manual', path: '/manual', icon: BookOpen },
    { label: 'CDI x Opções', path: '/calculadora-renda-fixa', icon: Calculator, highlight: true },
    { label: 'FAQ', path: '/faq', icon: HelpCircle },
    { label: 'Configurações', path: '/settings', icon: Settings },
    ...(access.isAdmin ? [{ label: 'Admin', path: '/admin', icon: Shield }] : []),
  ];

  const allNavItems = [...primaryNav, ...secondaryNav];
  const isFree = access.planType === 'free';

  const NavButton = ({ item }: { item: typeof primaryNav[0] }) => {
    const isActive = location.pathname === item.path;
    const isRealtime = item.path === '/dados-ao-vivo';
    const isHighlight = 'highlight' in item && item.highlight;
    return (
      <button
        onClick={() => navigate(item.path)}
        className={cn(
          'flex items-center gap-1.5 rounded-lg font-black uppercase tracking-widest transition-all whitespace-nowrap',
          'px-3 py-2 text-xs lg:text-xs lg:px-4',
          isHighlight && !isActive && 'bg-yellow-400/90 text-black hover:bg-yellow-300 shadow-[0_0_16px_rgba(250,204,21,0.5)] animate-pulse border border-yellow-300/50',
          isHighlight && isActive && 'bg-yellow-400 text-black shadow-[0_0_20px_rgba(250,204,21,0.6)] ring-2 ring-yellow-300',
          isRealtime && !isHighlight && 'text-red-100 bg-red-600 hover:bg-red-500 animate-pulse shadow-[0_0_16px_rgba(239,68,68,0.5)] border border-red-400/50',
          isRealtime && isActive && !isHighlight && 'ring-2 ring-red-300',
          !isRealtime && !isHighlight && isActive && 'bg-primary-foreground/20 text-primary-foreground',
          !isRealtime && !isHighlight && !isActive && 'text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10'
        )}
      >
        <item.icon className={cn("h-4 w-4 shrink-0", isRealtime && "animate-pulse")} />
        {item.label}
      </button>
    );
  };

  return (
    <header className="sticky top-0 z-50 border-b border-primary/30 bg-primary shadow-lg">
      {/* Row 1: Logo + Primary Nav + Actions */}
      <div className="container flex h-14 items-center justify-between gap-3">
        {/* Logo + Install */}
        <div className="flex flex-col items-start shrink-0">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 font-black text-lg">
            <img src="/assets/logo.png" alt="Opções PRO X" className="h-8 w-8 object-contain" />
            <span className="hidden sm:inline tracking-tight text-primary-foreground">Opções PRO X</span>
            <Badge variant="outline" className={cn(
              "text-[8px] hidden sm:inline-flex border-primary-foreground/40",
              isFree ? "text-yellow-300" : "text-primary-foreground"
            )}>
              {access.planType === 'pro' ? 'PRO' : 'FREE'}
            </Badge>
          </button>
          <InstallAppButton />
        </div>

        {/* Desktop Primary Nav */}
        <nav className="hidden md:flex items-center gap-1 flex-1 justify-center" data-tour="nav-menu">
          {primaryNav.map(item => (
            <NavButton key={item.path} item={item} />
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isFree && (
            <Button 
              onClick={() => navigate('/settings')}
              className="hidden sm:flex h-8 px-3 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs uppercase tracking-widest animate-pulse shadow-[0_0_15px_rgba(250,204,21,0.6)] border-b-2 border-black/20"
            >
              <Zap className="h-3 w-3 mr-1 fill-current" /> ASSINE PRO
            </Button>
          )}
          
          {user && (
            <Button variant="ghost" size="icon" onClick={async () => { await signOut(); navigate('/auth'); }} className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/10">
              <LogOut className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden text-primary-foreground hover:bg-primary-foreground/10" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Row 2: Secondary Nav + Theme (desktop) */}
      <div className="hidden md:flex border-t border-primary-foreground/10 bg-background dark:bg-[hsl(222,47%,6%)]">
        <div className="container flex items-center justify-between py-2">
          <nav className="flex items-center gap-2">
            {secondaryNav.map(item => {
              const isActive = location.pathname === item.path;
              const isHighlight = 'highlight' in item && item.highlight;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap',
                    isHighlight && !isActive && 'bg-yellow-400/90 text-black hover:bg-yellow-300 shadow-[0_0_16px_rgba(250,204,21,0.5)] animate-pulse',
                    isHighlight && isActive && 'bg-yellow-400 text-black shadow-[0_0_20px_rgba(250,204,21,0.6)] ring-2 ring-yellow-300',
                    !isHighlight && isActive && 'bg-primary text-primary-foreground shadow-md',
                    !isHighlight && !isActive && 'text-foreground/80 hover:text-foreground hover:bg-muted'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                  {isHighlight && <span className="text-[8px] bg-black/20 px-1.5 py-0.5 rounded-full">NOVO</span>}
                </button>
              );
            })}
          </nav>
          {/* RTD Live Indicator */}
          <div
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-widest border-2 transition-all cursor-default",
              rtdStatus === 'connected'
                ? "bg-emerald-500/25 text-emerald-600 dark:text-emerald-300 border-emerald-400/60 shadow-[0_0_20px_rgba(16,185,129,0.6),0_0_40px_rgba(16,185,129,0.2)] animate-pulse"
                : rtdStatus === 'connecting'
                ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/50 animate-pulse shadow-[0_0_12px_rgba(234,179,8,0.4)]"
                : "bg-muted text-muted-foreground border-border"
            )}
            title={rtdStatus === 'connected' ? 'Bridge RTD conectado — dados ao vivo' : rtdStatus === 'connecting' ? 'Conectando ao Bridge...' : 'Bridge RTD desconectado'}
          >
            {rtdStatus === 'connected' ? (
              <>
                <Wifi className="h-4 w-4 drop-shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                <span className="drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]">CONECTADO</span>
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                </span>
              </>
            ) : rtdStatus === 'connecting' ? (
              <>
                <Wifi className="h-4 w-4" />
                <span>CONECTANDO</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4" />
                <span>OFFLINE</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Palette className="h-3 w-3 text-muted-foreground mr-1" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mr-2">Tema:</span>
            {([
              { key: 'light' as const, label: 'Branco', icon: Sun },
              { key: 'dark' as const, label: 'Dark', icon: Moon },
              { key: 'destaque' as const, label: 'Destaque', icon: Sparkles },
              { key: 'midnight' as const, label: 'Midnight', icon: Waves },
              { key: 'forest' as const, label: 'Forest', icon: TreePine },
            ]).map(item => (
              <button
                key={item.key}
                onClick={() => setTheme(item.key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
                  theme === item.key
                    ? 'bg-primary text-primary-foreground ring-1 ring-primary/30'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className="h-3 w-3" />
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-primary-foreground/10 bg-primary/95 backdrop-blur-md animate-fade-in">
          <nav className="container py-2 space-y-1">
            {isFree && (
              <button
                onClick={() => { navigate('/settings'); setMobileOpen(false); }}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 mb-1 rounded-lg bg-yellow-400 text-black font-black text-xs animate-pulse"
              >
                <Zap className="h-4 w-4 fill-current" /> ASSINE PRO AGORA
              </button>
            )}
            <div className="grid grid-cols-2 gap-1">
              {allNavItems.map(item => {
                const isActive = location.pathname === item.path;
                const isRealtime = item.path === '/dados-ao-vivo';
                return (
                  <button
                    key={item.path}
                    onClick={() => { navigate(item.path); setMobileOpen(false); }}
                    className={cn(
                      'flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all',
                      isRealtime && 'text-red-100 bg-red-600 animate-pulse',
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
            </div>
            {/* Theme selector mobile */}
            <div className="flex items-center gap-1 pt-2 mt-1 border-t border-primary-foreground/10">
              <Palette className="h-3 w-3 text-primary-foreground/60 ml-1" />
              <span className="text-xs font-semibold uppercase tracking-widest text-primary-foreground/60 mr-1">Tema:</span>
              {([
                { key: 'light' as const, label: 'Branco', icon: Sun },
                { key: 'dark' as const, label: 'Dark', icon: Moon },
                { key: 'destaque' as const, label: 'Destaque', icon: Sparkles },
                { key: 'midnight' as const, label: 'Midnight', icon: Waves },
                { key: 'forest' as const, label: 'Forest', icon: TreePine },
              ]).map(item => (
                <button
                  key={item.key}
                  onClick={() => setTheme(item.key)}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all',
                    theme === item.key
                      ? 'bg-primary-foreground/20 text-primary-foreground ring-1 ring-primary-foreground/30'
                      : 'text-primary-foreground/60 hover:bg-primary-foreground/10 hover:text-primary-foreground'
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
