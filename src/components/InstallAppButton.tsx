import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export default function InstallAppButton({ variant = 'header' }: { variant?: 'header' | 'banner' }) {
  const [canInstall, setCanInstall] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSTip, setShowIOSTip] = useState(false);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('install-dismissed') === '1');

  useEffect(() => {
    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true;
    if (isStandalone) return;

    // iOS detection
    const ua = navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(isiOS);
    if (isiOS) {
      setCanInstall(true);
      return;
    }

    // Android / Desktop Chrome - listen for native prompt
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Already captured
    if (deferredPrompt) {
      setCanInstall(true);
    } else {
      // Always show the button — if native prompt isn't available,
      // we'll show manual instructions on click
      setCanInstall(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSTip(true);
      return;
    }
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setCanInstall(false);
      deferredPrompt = null;
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShowIOSTip(false);
    sessionStorage.setItem('install-dismissed', '1');
  };

  if (!canInstall || dismissed) return null;

  // iOS tip overlay
  if (showIOSTip) {
    return (
      <div className="fixed inset-0 z-[100] bg-black/60 flex items-end justify-center p-4 animate-fade-in" onClick={handleDismiss}>
        <div className="bg-card border border-border rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-3 mb-8" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h3 className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-primary" /> Instalar App
            </h3>
            <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <ol className="text-sm text-muted-foreground space-y-2">
            <li className="flex items-start gap-2">
              <span className="bg-primary text-primary-foreground rounded-full h-5 w-5 flex items-center justify-center text-xs font-bold shrink-0">1</span>
              Toque no ícone <strong className="text-foreground">Compartilhar</strong> (□↑) na barra do Safari
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-primary text-primary-foreground rounded-full h-5 w-5 flex items-center justify-center text-xs font-bold shrink-0">2</span>
              Role e toque em <strong className="text-foreground">"Adicionar à Tela de Início"</strong>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-primary text-primary-foreground rounded-full h-5 w-5 flex items-center justify-center text-xs font-bold shrink-0">3</span>
              Confirme tocando <strong className="text-foreground">"Adicionar"</strong>
            </li>
          </ol>
          <p className="text-xs text-muted-foreground/80">O app ficará na sua tela inicial como um app nativo!</p>
        </div>
      </div>
    );
  }

  if (variant === 'header') {
    return (
      <Button
        onClick={handleInstall}
        size="sm"
        className={cn(
          "h-8 px-3 font-black text-xs uppercase tracking-widest gap-1.5",
          "bg-green-500 hover:bg-green-400 text-white shadow-[0_0_12px_rgba(34,197,94,0.4)]"
        )}
      >
        <Download className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Instalar App</span>
        <span className="sm:hidden">App</span>
      </Button>
    );
  }

  return null;
}
