import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Save, Download, Loader2 } from 'lucide-react';

interface FloatingAnalysisBarProps {
  onAnalyze: () => void;
  onSave: () => void;
  onDownloadPdf: () => void;
  loadingAI: boolean;
  saving: boolean;
}

export default function FloatingAnalysisBar({ onAnalyze, onSave, onDownloadPdf, loadingAI, saving }: FloatingAnalysisBarProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show floating bar only when scrolled past 400px (away from original buttons)
      setIsVisible(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-primary/30 bg-card/95 backdrop-blur-md shadow-[0_-4px_30px_-8px_hsl(var(--primary)/0.3)] animate-fade-in">
      <div className="container flex items-center justify-center py-3 gap-3">
        <Button
          onClick={onAnalyze}
          disabled={loadingAI}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-black text-base h-12 px-8 shadow-[0_0_30px_-5px_hsl(var(--primary)/0.6)]"
        >
          {loadingAI ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
          Analisar por IA
        </Button>
        <Button
          onClick={onSave}
          disabled={saving}
          variant="outline"
          className="font-black text-base h-12 px-6"
        >
          {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
          Salvar
        </Button>
        <Button
          onClick={onDownloadPdf}
          variant="outline"
          className="font-black text-base h-12 px-6 border-primary/30 text-primary"
        >
          <Download className="mr-2 h-5 w-5" />
          PDF
        </Button>
      </div>
    </div>
  );
}
