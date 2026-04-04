import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'onboarding_completed';

interface TourStep {
  targetSelector: string;
  title: string;
  description: string;
  position: 'bottom' | 'top' | 'left' | 'right';
}

const steps: TourStep[] = [
  {
    targetSelector: '[data-tour="input-mode"]',
    title: '1. Escolha como inserir',
    description: 'Selecione entre digitar manualmente ou enviar um print da sua corretora para a IA ler.',
    position: 'bottom',
  },
  {
    targetSelector: '[data-tour="analysis-config"]',
    title: '2. Configure sua análise',
    description: 'Defina o nome, data de entrada e a taxa CDI para comparar com a renda fixa.',
    position: 'bottom',
  },
  {
    targetSelector: '[data-tour="ai-button"]',
    title: '3. Peça para a IA analisar',
    description: 'Após adicionar as pernas, clique aqui para receber análise de risco, nota e sugestões.',
    position: 'top',
  },
  {
    targetSelector: '[data-tour="save-button"]',
    title: '4. Salve no histórico',
    description: 'Salve a análise para acompanhar no Portfólio e gerar relatórios em PDF.',
    position: 'top',
  },
  {
    targetSelector: '[data-tour="nav-menu"]',
    title: '5. Explore a plataforma',
    description: 'Acesse Portfólio, Rastreadores, Diversificador e muito mais no menu.',
    position: 'bottom',
  },
];

export default function OnboardingTour() {
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties>({});
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;
    const timer = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const positionTooltip = useCallback(() => {
    const step = steps[currentStep];
    const el = document.querySelector(step.targetSelector);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const padding = 8;

    // Highlight
    setHighlightStyle({
      position: 'fixed',
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
      borderRadius: '12px',
    });

    // Tooltip position
    const tooltip: React.CSSProperties = { position: 'fixed' };
    const gap = 16;

    switch (step.position) {
      case 'bottom':
        tooltip.top = rect.bottom + gap;
        tooltip.left = Math.max(16, rect.left + rect.width / 2 - 160);
        break;
      case 'top':
        tooltip.bottom = window.innerHeight - rect.top + gap;
        tooltip.left = Math.max(16, rect.left + rect.width / 2 - 160);
        break;
      case 'left':
        tooltip.top = rect.top;
        tooltip.right = window.innerWidth - rect.left + gap;
        break;
      case 'right':
        tooltip.top = rect.top;
        tooltip.left = rect.right + gap;
        break;
    }

    // Clamp horizontal
    if (tooltip.left && typeof tooltip.left === 'number') {
      tooltip.left = Math.min(tooltip.left, window.innerWidth - 340);
    }

    setTooltipStyle(tooltip);

    // Scroll element into view
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentStep]);

  useEffect(() => {
    if (!visible) return;
    // Small delay for DOM to settle
    const timer = setTimeout(positionTooltip, 300);
    window.addEventListener('resize', positionTooltip);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', positionTooltip);
    };
  }, [visible, currentStep, positionTooltip]);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, 'true');
  };

  const next = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      dismiss();
    }
  };

  const prev = () => {
    if (currentStep > 0) setCurrentStep(prev => prev - 1);
  };

  if (!visible) return null;

  const step = steps[currentStep];

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-[9998] bg-black/60 transition-opacity" onClick={dismiss} />

      {/* Highlight cutout */}
      <div
        className="fixed z-[9999] pointer-events-none ring-4 ring-primary/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"
        style={highlightStyle}
      />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="fixed z-[10000] w-[320px] bg-card border-2 border-primary/40 rounded-2xl shadow-2xl shadow-primary/20 p-5 space-y-4 animate-fade-in"
        style={tooltipStyle}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <h3 className="text-sm font-black text-foreground">{step.title}</h3>
          </div>
          <button onClick={dismiss} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5">
          {steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === currentStep ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
              )}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={dismiss} className="text-xs text-muted-foreground">
            Pular Tour
          </Button>
          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button variant="outline" size="sm" onClick={prev} className="text-xs">
                <ArrowLeft className="h-3 w-3 mr-1" /> Anterior
              </Button>
            )}
            <Button size="sm" onClick={next} className="text-xs font-bold">
              {currentStep === steps.length - 1 ? 'Concluir' : 'Próximo'}
              {currentStep < steps.length - 1 && <ArrowRight className="h-3 w-3 ml-1" />}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export function resetOnboardingTour() {
  localStorage.removeItem(STORAGE_KEY);
}

export function isOnboardingCompleted() {
  return !!localStorage.getItem(STORAGE_KEY);
}
