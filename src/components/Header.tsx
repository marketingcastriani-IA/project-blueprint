import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAccessControl } from '@/hooks/useAccessControl';
import { useSharedRtdBridge } from '@/contexts/RtdBridgeContext';
import { Button } from '@/components/ui/button';
import TrialBanner from '@/components/TrialBanner';

import { Sun, Moon, LogOut, PlusCircle, History, Menu, X, Shield, ShieldCheck, Briefcase, Settings, Zap, PieChart, HelpCircle, Sparkles, Palette, BookOpen, Radio, BarChart2, Calculator, Waves, TreePine, Wifi, WifiOff, ChevronDown, Headphones, Mail, MessageSquarePlus, CheckCircle2 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';


function RtdIndicator({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const { status: rtdStatus } = useSharedRtdBridge();
  const small = size === 'sm';

  // Conectado: moldura com luz de LED correndo ao redor
  if (rtdStatus === 'connected') {
    return (
      <div
        className="relative rounded-full p-[2px] overflow-hidden isolate shrink-0 shadow-[0_0_20px_rgba(16,185,129,0.5)]"
        title="Bridge RTD conectado — dados ao vivo"
      >
        <span
          className="absolute inset-[-150%] -z-10 animate-[spin_2.8s_linear_infinite]"
          style={{ background: 'conic-gradient(from 0deg, transparent 0deg, transparent 185deg, rgba(110,231,183,0.85) 245deg, #34d399 300deg, rgba(167,243,208,0.95) 330deg, transparent 360deg)' }}
        />
        <div className={cn(
          "relative flex items-center gap-1.5 rounded-full bg-slate-900/90 font-black uppercase text-emerald-300",
          small ? "px-2.5 py-1 text-[9px] tracking-wider" : "px-3.5 py-1.5 text-[11px] tracking-widest"
        )}>
          <Wifi className={cn("shrink-0 drop-shadow-[0_0_6px_rgba(16,185,129,0.9)]", small ? "h-3 w-3" : "h-4 w-4")} />
          <span className="drop-shadow-[0_0_8px_rgba(16,185,129,0.75)]">CONECTADO</span>
          <span className={cn("relative flex shrink-0", small ? "h-2 w-2" : "h-2.5 w-2.5")}>
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className={cn("relative inline-flex rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.9)]", small ? "h-2 w-2" : "h-2.5 w-2.5")} />
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-full font-black uppercase border-2 transition-all shrink-0",
          small ? "px-2.5 py-1 text-[9px] tracking-wider" : "px-3.5 py-1.5 text-[11px] tracking-widest",
          rtdStatus === 'connecting'
            ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/60 animate-pulse shadow-[0_0_12px_rgba(234,179,8,0.4)]"
            : "bg-white/5 text-slate-400 border-white/15"
        )}
        title={rtdStatus === 'connecting' ? 'Conectando ao Bridge...' : 'Offline — use o menu Conectar Profit Pro'}
      >
        {rtdStatus === 'connecting' ? (
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
      {rtdStatus !== 'connecting' && (
        <span className={cn(
          "text-slate-400 font-semibold italic whitespace-nowrap",
          small ? "text-[8px]" : "text-[10px]"
        )}>
          Aperte CONECTAR no menu
        </span>
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
    { label: 'Operações em Aberto', path: '/history', icon: History },
    { label: 'Portfólio', path: '/portfolio', icon: Briefcase },
  ];

  const primaryNavRight = [
    { label: 'Diversificar', path: '/diversificador', icon: PieChart },
  ];

  // Conectar Profit Pro vive na barra inferior, ao lado do indicador CONECTADO
  const connectItem = { label: 'Conectar Profit Pro', path: '/dados-ao-vivo', icon: Radio };

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

  const allNavItems = [...primaryNav, connectItem, ...trackerNav, ...secondaryNav, { label: 'Suporte', path: '/suporte', icon: Headphones }];
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
          'flex items-center gap-1.5 rounded-lg font-black uppercase tracking-wide transition-all duration-200 whitespace-nowrap',
          'px-3 py-2 text-[11px] lg:px-3.5 lg:text-[13px] xl:text-sm',
          isActive
            ? 'bg-background text-foreground ring-2 ring-white/70 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.5)] scale-[1.04]'
            : 'text-primary-foreground/90 hover:bg-primary-foreground/15 hover:text-primary-foreground hover:-translate-y-px'
        )}
      >
        <item.icon className={cn("h-4 w-4 shrink-0", isActive && "text-primary")} />
        <span>{item.label}</span>
      </button>
    );
  };

  return (
    <header
      className="sticky top-0 z-50 border-b border-black/10 overflow-hidden"
      style={{
        background: [
          'radial-gradient(120% 130% at 10% -30%, color-mix(in srgb, hsl(var(--primary)) 78%, #fff) 0%, transparent 45%)',
          'radial-gradient(140% 160% at 95% 130%, color-mix(in srgb, hsl(var(--primary)) 45%, #000) 0%, transparent 55%)',
          'linear-gradient(180deg, color-mix(in srgb, hsl(var(--primary)) 94%, #000) 0%, color-mix(in srgb, hsl(var(--primary)) 60%, #000) 100%)',
        ].join(', '),
        boxShadow: 'inset 0 1px 0 color-mix(in srgb, hsl(var(--primary)) 55%, #fff), inset 0 -2px 6px rgba(0,0,0,0.35), 0 10px 32px -8px rgba(0,0,0,0.55)',
      }}
    >
      <TrialBanner />
      {/* Row 1: Logo + Primary Nav + Actions */}
      <div className="max-w-full px-3 lg:px-4 flex h-14 items-center justify-between gap-1">
        {/* Logo + Install */}
        <div className="flex flex-col items-start shrink-0">
          <button onClick={() => navigate('/dashboard')} className="group flex items-center gap-1.5 font-black text-base">
            <img src="/assets/logo.png" alt="Opções PRO X" className="h-6 w-6 object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-transform group-hover:scale-105" />
            <span className="hidden sm:inline tracking-tight text-primary-foreground">Opções PRO X</span>
            <Badge className={cn(
              "text-[7px] px-1.5 py-0 font-black hidden sm:inline-flex border-0 shadow-sm",
              isFree ? "bg-yellow-400 text-black" : "bg-background text-foreground"
            )}>
              {access.planType === 'pro' ? 'PRO' : 'FREE'}
            </Badge>
          </button>

        </div>

        {/* Desktop Primary Nav — scrollable */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-1.5 xl:gap-2 flex-1 justify-center xl:justify-start overflow-x-auto scrollbar-none mx-2 pr-2" data-tour="nav-menu">
          {primaryNavLeft.map(item => (
            <NavButton key={item.path} item={item} />
          ))}

          {primaryNavRight.map(item => (
            <NavButton key={item.path} item={item} />
          ))}

          {/* Dropdown: Rastreadores (agrupa PRO X, Box e Collar) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'flex items-center gap-1.5 rounded-lg font-black uppercase tracking-wide transition-all duration-200 whitespace-nowrap',
                  'px-3 py-2 text-[11px] lg:px-3.5 lg:text-[13px] xl:text-sm',
                  trackerNav.some(t => location.pathname === t.path)
                    ? 'bg-background text-foreground ring-2 ring-white/70 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.5)] scale-[1.04]'
                    : 'text-primary-foreground/90 hover:bg-primary-foreground/15 hover:text-primary-foreground hover:-translate-y-px'
                )}
              >
                <Zap className="h-4 w-4 shrink-0" />
                <span>Rastreadores B3</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
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
                  'flex items-center gap-1.5 rounded-lg font-black uppercase tracking-wide transition-all duration-200 whitespace-nowrap',
                  'px-2 py-1.5 text-[9px] lg:px-3 lg:py-1.5 lg:text-[11px]',
                  location.pathname === '/suporte'
                    ? 'bg-background text-foreground ring-2 ring-white/70 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.5)] scale-[1.04]'
                    : 'text-primary-foreground/90 hover:bg-primary-foreground/15 hover:text-primary-foreground hover:-translate-y-px'
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
            <Button variant="ghost" size="icon" aria-label="Sair da conta" onClick={async () => { await signOut(); navigate('/auth'); }} className="h-8 w-8 text-primary-foreground/90 hover:text-primary-foreground hover:bg-primary-foreground/15">
              <LogOut className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'} aria-expanded={mobileOpen} className="h-8 w-8 md:hidden text-primary-foreground/90 hover:text-primary-foreground hover:bg-primary-foreground/15" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Row 2: Secondary Nav + RTD + Theme (desktop) — scrollable */}
      <div className="hidden md:flex border-t border-black/40 bg-gradient-to-b from-slate-800 to-slate-900 shadow-inner">
        <div className="max-w-full px-3 lg:px-4 flex items-center gap-3 py-1.5 overflow-x-auto scrollbar-none w-full">
          <nav className="flex items-center gap-1 shrink-0">
            {secondaryNav.map(item => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] lg:text-[13px] xl:text-sm font-black uppercase tracking-wide transition-all duration-200 whitespace-nowrap',
                    isActive && 'bg-primary text-primary-foreground ring-2 ring-white/40 shadow-[0_2px_14px_-2px_hsl(var(--primary)/0.85)] scale-[1.04]',
                    !isActive && 'text-slate-300 hover:text-white hover:bg-white/10 hover:-translate-y-px'
                  )}
                >
                  <item.icon className="h-3.5 w-3.5 shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Conectar Profit Pro — amarelo p/ chamar atenção, antes do indicador */}
          <button
            onClick={() => navigate(connectItem.path)}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] lg:text-[13px] xl:text-sm font-black uppercase tracking-wide transition-all duration-200 whitespace-nowrap shrink-0',
              'bg-amber-400 text-black hover:bg-amber-300',
              location.pathname === connectItem.path
                ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-105 shadow-[0_0_26px_rgba(251,191,36,0.95)]'
                : 'shadow-[0_0_16px_rgba(251,191,36,0.5)] ring-1 ring-amber-300/50 hover:-translate-y-px'
            )}
          >
            {location.pathname === connectItem.path ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <Radio className="h-4 w-4 shrink-0" />}
            Conectar Profit Pro
          </button>

          {/* RTD Indicator */}
          <RtdIndicator size="md" />

          {/* Spacer */}
          <div className="flex-1 min-w-0" />

          {/* Theme selector */}
          <div className="flex items-center gap-1 shrink-0 rounded-full bg-white/5 p-0.5 ring-1 ring-white/10">
            <Palette className="h-3 w-3 text-slate-400 ml-1.5" />
            {themes.map(item => (
              <button
                key={item.key}
                onClick={() => setTheme(item.key)}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-full text-[10px] lg:text-xs font-semibold transition-all duration-200 whitespace-nowrap',
                  theme === item.key
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-slate-400 hover:bg-white/10 hover:text-white'
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
                
                return (
                  <button
                    key={item.path}
                    onClick={() => { navigate(item.path); setMobileOpen(false); }}
                    className={cn(
                      'flex items-center gap-1.5 w-full px-2.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all',
                      item.path === '/strategy-tracker' && !isActive && 'bg-amber-400/90 text-black shadow-[0_0_10px_rgba(251,191,36,0.4)] animate-pulse',
                      item.path === '/strategy-tracker' && isActive && 'bg-amber-400 text-black ring-2 ring-amber-300',
                      item.path !== '/strategy-tracker' && isActive && 'bg-primary-foreground/20 text-primary-foreground',
                      item.path !== '/strategy-tracker' && !isActive && 'text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10'
                    )}
                  >
                    <item.icon className="h-3.5 w-3.5 shrink-0" />
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
