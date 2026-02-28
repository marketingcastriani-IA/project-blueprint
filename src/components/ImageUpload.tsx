import { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, Loader2, X, Zap } from 'lucide-react';
import { Leg } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  onLegsExtracted: (legs: Leg[]) => void;
  onImageChange?: () => void;
}

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
      if (error) throw error;
      if (data?.legs && data.legs.length > 0) {
        onLegsExtracted(data.legs);
        toast.success(`✓ ${data.legs.length} perna(s) extraída(s) com sucesso!`, {
          description: 'Estrutura reconhecida e carregada automaticamente.',
        });
      } else {
        toast.error('Nenhuma perna detectada', {
          description: 'Tente outro screenshot ou insira manualmente.',
        });
      }
    } catch (err: any) {
      console.error('OCR error:', err);
      toast.error('Erro ao processar imagem', {
        description: err.message || 'Tente novamente',
      });
    } finally {
      setLoading(false);
    }
  }, [onLegsExtracted]);

  const handleFile = useCallback((file: File) => {
    if (processingRef.current) return; // Prevent double processing
    
    if (!file.type.startsWith('image/')) {
      toast.error('Formato inválido', { description: 'Por favor, envie uma imagem.' });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande', { description: 'Máximo 10MB.' });
      return;
    }

    processingRef.current = true;

    // Notificar que a imagem está sendo trocada (para limpar pernas antigas)
    onImageChange?.();

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (!result?.startsWith('data:image/')) {
        processingRef.current = false;
        toast.error('Formato inválido', { description: 'Não foi possível ler a imagem.' });
        return;
      }
      setPreview(result);
      processImage(result).finally(() => { processingRef.current = false; });
    };
    reader.readAsDataURL(file);
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
        'relative border-2 transition-all duration-300 cursor-pointer group',
        'bg-gradient-to-br from-info/5 via-card to-card',
        dragActive
          ? 'border-info/60 shadow-[0_0_40px_-8px_hsl(var(--info)/0.4)]'
          : 'border-dashed border-info/30 hover:border-info/50 hover:shadow-[0_0_40px_-12px_hsl(var(--info)/0.35)]'
      )}
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => !loading && fileInputRef.current?.click()}
      tabIndex={0}
    >
      <CardContent className="flex flex-col items-center justify-center py-16 gap-5">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        {loading ? (
          <>
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse" />
              <Loader2 className="h-12 w-12 animate-spin text-primary relative" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-sm font-semibold text-foreground">Analisando com IA...</p>
              <p className="text-xs text-muted-foreground">Extraindo pernas da operação</p>
            </div>
          </>
        ) : preview ? (
          <>
            <div className="relative group/img">
              <img 
                src={preview} 
                alt="Preview da imagem enviada" 
                className="max-h-72 w-full rounded-xl object-contain border border-info/20 shadow-lg" 
                loading="lazy" 
              />
              <button
                type="button"
                className="absolute -top-3 -right-3 rounded-full bg-destructive p-2 text-destructive-foreground shadow-lg hover:bg-destructive/90 transition-all duration-200 opacity-0 group-hover/img:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreview(null);
                  onImageChange?.();
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="text-center space-y-2">
              <p className="text-sm font-semibold text-foreground">Imagem carregada</p>
              <p className="text-xs text-muted-foreground">Ctrl+V, arraste ou clique para trocar</p>
            </div>
          </>
        ) : (
          <>
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-info/10 blur-2xl group-hover:bg-info/15 transition-colors" />
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-info/20 to-info/10 relative">
                <Zap className="h-8 w-8 text-info" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <p className="text-base font-bold text-foreground">Screenshot da Corretora</p>
              <p className="text-sm text-muted-foreground">Ctrl+V • Arraste • Clique</p>
              <p className="text-xs text-muted-foreground/60 pt-2">
                Suporta: PNG, JPG, WebP (máx 10MB)
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
