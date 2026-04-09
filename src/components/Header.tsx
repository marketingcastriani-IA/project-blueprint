import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAccessControl } from '@/hooks/useAccessControl';
import { useSharedRtdBridge } from '@/contexts/RtdBridgeContext';
import { Button } from '@/components/ui/button';

import { Sun, Moon, LogOut, PlusCircle, History, Menu, X, Shield, ShieldCheck, Briefcase, Settings, Zap, PieChart, HelpCircle, Sparkles, Palette, BookOpen, Radio, BarChart2, Calculator, Database, Waves, TreePine, Wifi, WifiOff, ChevronDown, Crosshair, Headphones, Mail, MessageSquarePlus } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';


function RtdIndicator({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const { status: rtdStatus } = useSharedRtdBridge();
  const small = size === 'sm';

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-full font-black uppercase border-2 transition-all cursor-default shrink-0",
        small ? "px-2.5 py-1 text-[9px] tracking-wider" : "px-3 py-1.5 text-[10px] tracking-widest",
        rtdStatus === 'connected'
          ? "bg-emerald-500/25 text-emerald-600 dark:text-emerald-300 border-emerald-400/60 shadow-[0_0_20px_rgba(16,185,129,0.6),0_0_40px_rgba(16,185,129,0.2)]"
          : rtdStatus === 'connecting'
          ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/50 animate-pulse shadow-[0_0_12px_rgba(234,179,8,0.4)]"
          : "bg-muted text-muted-foreground border-border"
      )}
      title={rtdStatus === 'connected' ? 'Bridge RTD conectado — dados ao vivo' : rtdStatus === 'connecting' ? 'Conectando ao Bridge...' : 'Bridge RTD desconectado'}
    >
      {rtdStatus === 'connected' ? (
        <>
          <Wifi className={cn("shrink-0 drop-shadow-[0_0_6px_rgba(16,185,129,0.8)]", small ? "h-3 w-3" : "h-4 w-4")} />
          <span className="drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]">CONECTADO</span>
          <span className={cn("relative flex shrink-0", small ? "h-2 w-2" : "h-2.5 w-2.5")}>
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className={cn("relative inline-flex rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]", small ? "h-2 w-2" : "h-2.5 w-2.5")} />
          </span>
        </>
      ) : rtdStatus === 'connecting' ? (
        <>
          <Wifi className={cn("shrink-0", small ? "h-3 w-3" : "h-4 w-4")} />
          <span>CONECTANDO</span>
        </>
      ) : (
        <>
          <WifiOff className={cn("shrink-0", small ? "h-3 w-3" : "h-4 w-4")} />
          <span>OFFLINE</span>
        </>
      )}
    </div>
  );
}

export default function Header() {
  const { signOut, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const access = useAccessControl();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collarEnabled, setCollarEnabled] = useState(() => localStorage.getItem('feature-collar-tracker') !== 'false');

  useEffect(() => {
    const handler = () => setCollarEnabled(localStorage.getItem('feature-collar-tracker') !== 'false');
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const primaryNavLeft = [
    { label: 'Análise', path: '/dashboard', icon: PlusCircle },
    { label: 'Operações', path: '/history', icon: History },
    { label: 'Portfólio', path: '/portfolio', icon: Briefcase },
  ];

  const primaryNavRight = [
    { label: 'Diversificar', path: '/diversificador', icon: PieChart },
    { label: 'Tempo Real', path: '/dados-ao-vivo', icon: Radio },
    { label: 'Opções B3', path: '/ticker-opcoes', icon: Database },
  ];

  const primaryNav = [...primaryNavLeft, ...primaryNavRight];

  const trackerNav = [
    { label: 'Rastreador PRO', path: '/strategy-tracker', icon: Zap },
    { label: 'Rastrear Box', path: '/box-tracker', icon: BarChart2 },
    ...(collarEnabled ? [{ label: 'Rastrear Collar', path: '/collar-tracker', icon: ShieldCheck }] : []),
  ];

  const secondaryNav = [
    { label: 'CDI x Opções', path: '/calculadora-renda-fixa', icon: Calculator },
    { label: 'Manual', path: '/manual', icon: BookOpen },
    { label: 'FAQ', path: '/faq', icon: HelpCircle },
    { label: 'Config.', path: '/settings', icon: Settings },
    ...(access.isAdmin ? [{ label: 'Admin', path: '/admin', icon: Shield }] : []),
  ];

  const allNavItems = [...primaryNav, ...trackerNav, ...secondaryNav, { label: 'Suporte', path: '/suporte', icon: Headphones }];
  const isFree = access.planType === 'free';

  const themes = [
    { key: 'light' as const, label: 'Branco', icon: Sun },
    { key: 'dark' as const, label: 'Dark', icon: Moon },
    { key: 'destaque' as const, label: 'Destaque', icon: Sparkles },
    { key: 'midnight' as const, label: 'Midnight', icon: Waves },
    { key: 'forest' as const, label: 'Forest', icon: TreePine },
  ];

  const NavButton = ({ item }: { item: typeof primaryNav[0] }) => {
    const isActive = location.pathname === item.path;
    return (
      <button
        onClick={() => navigate(item.path)}
        className={cn(
          'flex items-center gap-1 rounded-lg font-black uppercase tracking-wide transition-all whitespace-nowrap',
          'px-2 py-1.5 text-[10px] lg:px-3 lg:py-2 lg:text-xs xl:tracking-widest',
          isActive && 'bg-primary-foreground/20 text-primary-foreground',
          !isActive && 'text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10'
        )}
      >
        <item.icon className="h-3.5 w-3.5 shrink-0 lg:h-4 lg:w-4" />
        <span>{item.label}</span>
      </button>
    );
  };

  const ProXButton = () => {
    const isActive = location.pathname === '/strategy-tracker';
    return (
      <button
        onClick={() => navigate('/strategy-tracker')}
        className={cn(
          'flex items-center gap-1.5 rounded-xl font-black uppercase tracking-widest transition-all whitespace-nowrap',
          'px-3 py-1.5 text-[10px] lg:px-4 lg:py-2 lg:text-xs',
          isActive
            ? 'bg-amber-400 text-black shadow-[0_0_20px_rgba(251,191,36,0.6)] ring-2 ring-amber-300'
            : 'bg-amber-400/90 text-black hover:bg-amber-300 shadow-[0_0_14px_rgba(251,191,36,0.4)] animate-pulse'
        )}
      >
        <Zap className="h-3.5 w-3.5 lg:h-4 lg:w-4 fill-current" />
        <span>PRO X</span>
      </button>
    );
  };

  return (
    <header className="sticky top-0 z-50 border-b border-primary/30 bg-primary shadow-lg">
      {/* Row 1: Logo + Primary Nav + Actions */}
      <div className="container flex h-14 items-center justify-between gap-2">
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
          
        </div>

        {/* Desktop Primary Nav — scrollable */}
        <nav className="hidden md:flex items-center gap-0.5 lg:gap-1 flex-1 overflow-x-auto scrollbar-none mx-2 pr-2" data-tour="nav-menu">
          {primaryNavLeft.map(item => (
            <NavButton key={item.path} item={item} />
          ))}

          {/* PRO X center button */}
          <ProXButton />

          {primaryNavRight.map(item => (
            <NavButton key={item.path} item={item} />
          ))}

          {/* Dropdown: Rastreadores PRO X */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'flex items-center gap-1 rounded-lg font-black uppercase tracking-wide transition-all whitespace-nowrap',
                  'px-2 py-1.5 text-[10px] lg:px-3 lg:py-2 lg:text-xs xl:tracking-widest',
                  trackerNav.some(t => location.pathname === t.path)
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10'
                )}
              >
                <Crosshair className="h-3.5 w-3.5 shrink-0 lg:h-4 lg:w-4" />
                <span>Rastreadores</span>
                <ChevronDown className="h-3 w-3 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[200px]">
              {trackerNav.map(item => {
                const isActive = location.pathname === item.path;
                return (
                  <DropdownMenuItem
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={cn(
                      'flex items-center gap-2 font-bold uppercase tracking-wide text-xs cursor-pointer',
                      isActive && 'bg-primary/10 text-primary'
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Dropdown: Suporte */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'flex items-center gap-1 rounded-lg font-black uppercase tracking-wide transition-all whitespace-nowrap',
                  'px-2 py-1.5 text-[10px] lg:px-3 lg:py-2 lg:text-xs xl:tracking-widest',
                  location.pathname === '/suporte'
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10'
                )}
              >
                <Headphones className="h-3.5 w-3.5 shrink-0 lg:h-4 lg:w-4" />
                <span>Suporte</span>
                <ChevronDown className="h-3 w-3 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[200px]">
              <DropdownMenuItem
                onClick={() => navigate('/suporte')}
                className="flex items-center gap-2 font-bold text-xs cursor-pointer"
              >
                <MessageSquarePlus className="h-4 w-4 shrink-0" />
                Deixe sua Sugestão
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => window.open('mailto:contato@opcoesprox.com.br')}
                className="flex items-center gap-2 font-bold text-xs cursor-pointer"
              >
                <Mail className="h-4 w-4 shrink-0" />
                Falar por E-mail
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

      {/* Row 2: Secondary Nav + RTD + Theme (desktop) — scrollable */}
      <div className="hidden md:flex border-t border-border/40 bg-background">
        <div className="container flex items-center gap-3 py-1.5 overflow-x-auto scrollbar-none">
          <nav className="flex items-center gap-1 shrink-0">
            {secondaryNav.map(item => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] lg:text-xs font-black uppercase tracking-wide lg:tracking-widest transition-all whitespace-nowrap',
                    isActive && 'bg-primary text-primary-foreground shadow-md',
                    !isActive && 'text-foreground/80 hover:text-foreground hover:bg-muted'
                  )}
                >
                  <item.icon className="h-3.5 w-3.5 shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* RTD Indicator */}
          <RtdIndicator size="md" />

          {/* Spacer */}
          <div className="flex-1 min-w-0" />

          {/* Theme selector */}
          <div className="flex items-center gap-1 shrink-0">
            <Palette className="h-3 w-3 text-muted-foreground" />
            {themes.map(item => (
              <button
                key={item.key}
                onClick={() => setTheme(item.key)}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-full text-[10px] lg:text-xs font-semibold transition-all whitespace-nowrap',
                  theme === item.key
                    ? 'bg-primary text-primary-foreground ring-1 ring-primary/30'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className="h-3 w-3" />
                <span className="hidden lg:inline">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-primary-foreground/10 bg-primary/95 backdrop-blur-md animate-fade-in max-h-[80vh] overflow-y-auto">
          <nav className="container py-2 space-y-1">
            {/* RTD Indicator mobile */}
            <div className="flex items-center justify-center pb-1">
              <RtdIndicator size="sm" />
            </div>

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
                      'flex items-center gap-1.5 w-full px-2.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all',
                      isRealtime && 'text-red-100 bg-red-600 animate-pulse',
                      isRealtime && isActive && 'ring-2 ring-red-300',
                      !isRealtime && isActive && 'bg-primary-foreground/20 text-primary-foreground',
                      !isRealtime && !isActive && 'text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10'
                    )}
                  >
                    <item.icon className={cn("h-3.5 w-3.5 shrink-0", isRealtime && "animate-pulse")} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
            {/* Theme selector mobile */}
            <div className="flex flex-wrap items-center gap-1 pt-2 mt-1 border-t border-primary-foreground/10">
              <Palette className="h-3 w-3 text-primary-foreground/60 ml-1" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-primary-foreground/60 mr-1">Tema:</span>
              {themes.map(item => (
                <button
                  key={item.key}
                  onClick={() => setTheme(item.key)}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1.5 rounded-full text-[10px] font-semibold transition-all',
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
