import { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, Loader2, X, Zap, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import { Leg } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  onLegsExtracted: (legs: Leg[]) => void;
  onImageChange?: () => void;
}

// Função auxiliar para comprimir imagem
const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1024; // Reduz resolução para economizar payload
        const MAX_HEIGHT = 1024;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Converte para JPEG com qualidade 0.7 (reduz muito o tamanho mantendo legibilidade)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(dataUrl);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

export default function ImageUpload({ onLegsExtracted, onImageChange }: ImageUploadProps) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false);

  const processImage = useCallback(async (imageDataUrl: string): Promise<void> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-options-image', {
        body: { imageDataUrl },
      });
      
      if (error) {
        console.error('[ImageUpload] Supabase function error:', error);
        throw new Error(error.message || 'Erro ao chamar a função de análise');
      }
      
      if (data?.legs && data.legs.length > 0) {
        onLegsExtracted(data.legs);
        toast.success(`✓ ${data.legs.length} perna(s) extraída(s) com sucesso!`, {
          description: 'Estrutura reconhecida e carregada automaticamente.',
        });
      } else {
        toast.error('Nenhuma perna detectada', {
          description: 'A imagem pode estar ilegível ou não conter uma tabela de opções clara.',
        });
      }
    } catch (err: any) {
      console.error('[ImageUpload] OCR error details:', err);
      const message = err.message || 'Tente novamente';
      
      if (message.includes('Failed to send a request') || message.includes('payload')) {
        toast.error('Erro de envio', {
          description: 'A imagem pode ser muito complexa. Tente cortar apenas a parte da tabela.',
        });
      } else {
        toast.error('Erro ao processar imagem', {
          description: message,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [onLegsExtracted]);

  const handleFile = useCallback(async (file: File) => {
    if (processingRef.current) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error('Formato inválido', { description: 'Por favor, envie uma imagem (PNG, JPG).' });
      return;
    }

    processingRef.current = true;
    onImageChange?.();

    try {
      // Exibe preview rápido
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);

      // Comprime antes de enviar
      const compressedDataUrl = await compressImage(file);
      await processImage(compressedDataUrl);
    } catch (error) {
      console.error("[ImageUpload] Erro na compressão:", error);
      toast.error("Erro ao preparar imagem");
    } finally {
      processingRef.current = false;
    }
  }, [processImage, onImageChange]);

  const handleClipboardItems = useCallback((items: DataTransferItemList | undefined | null) => {
    if (!items) return false;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          handleFile(file);
          return true;
        }
      }
    }
    return false;
  }, [handleFile]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const found = handleClipboardItems(e.clipboardData?.items);
    if (found) e.preventDefault();
  }, [handleClipboardItems]);

  useEffect(() => {
    const onWindowPaste = (e: ClipboardEvent) => {
      // Só captura o paste global se não estivermos focados em um input de texto
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }
      const found = handleClipboardItems(e.clipboardData?.items);
      if (found) e.preventDefault();
    };

    window.addEventListener('paste', onWindowPaste);
    return () => window.removeEventListener('paste', onWindowPaste);
  }, [handleClipboardItems]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragActive(false);
  }, []);

  return (
    <Card
      className={cn(
        'relative border-2 transition-all duration-300 cursor-pointer group overflow-hidden',
        'bg-gradient-to-br from-info/5 via-card to-card',
        dragActive
          ? 'border-info/60 shadow-[0_0_40px_-8px_hsl(var(--info)/0.4)] scale-[1.01]'
          : 'border-dashed border-info/30 hover:border-info/50 hover:shadow-[0_0_40px_-12px_hsl(var(--info)/0.35)]'
      )}
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => !loading && fileInputRef.current?.click()}
      tabIndex={0}
    >
      <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        {loading ? (
          <div className="flex flex-col items-center animate-pulse gap-3">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-spin-slow" />
              <Loader2 className="h-10 w-10 animate-spin text-primary relative" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-primary">Processando Inteligente...</p>
              <p className="text-xs text-muted-foreground">Otimizando e extraindo dados</p>
            </div>
          </div>
        ) : preview ? (
          <div className="relative w-full flex flex-col items-center gap-3">
            <div className="relative group/img w-full max-w-[300px]">
              <img 
                src={preview} 
                alt="Preview" 
                className="w-full rounded-lg object-contain border border-border shadow-md" 
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                <p className="text-white text-xs font-bold">Clique para trocar</p>
              </div>
              <button
                type="button"
                className="absolute -top-2 -right-2 rounded-full bg-destructive p-1.5 text-destructive-foreground shadow-lg hover:bg-destructive/90 transition-all z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreview(null);
                  onImageChange?.();
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <p className="text-xs text-success font-medium flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Imagem carregada
            </p>
          </div>
        ) : (
          <>
            <div className="h-14 w-14 rounded-2xl bg-info/10 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform duration-300">
              <ImageIcon className="h-7 w-7 text-info" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-base font-bold text-foreground">Arraste ou Cole sua Nota</p>
              <p className="text-xs text-muted-foreground">
                Suportamos prints de Profit, Tryd e Home Brokers
              </p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="px-2 py-0.5 rounded-full bg-muted border text-[10px] text-muted-foreground font-mono">CTRL+V</span>
                <span className="px-2 py-0.5 rounded-full bg-muted border text-[10px] text-muted-foreground font-mono">JPG/PNG</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}