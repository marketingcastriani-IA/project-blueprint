import { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, Loader2, X, Zap, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import { Leg } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
        const MAX_WIDTH = 1024;
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
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(dataUrl);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

interface ImageUploadProps {
  onLegsExtracted: (legs: Leg[]) => void;
  onImageChange?: (hasImage: boolean) => void;
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
      
      if (error) {
        console.error('[ImageUpload] Erro na Edge Function:', error);
        throw error;
      }
      
      if (data?.legs && data.legs.length > 0) {
        onLegsExtracted(data.legs);
        toast.success(`✓ ${data.legs.length} perna(s) extraída(s) com sucesso!`);
      } else {
        toast.error('Nenhuma perna detectada na imagem.');
      }
    } catch (err: any) {
      console.error('[ImageUpload] Erro completo:', err);
      toast.error('Erro ao processar imagem', {
        description: err.message || 'Verifique os logs do console para mais detalhes.',
      });
    } finally {
      setLoading(false);
    }
  }, [onLegsExtracted]);

  const handleFile = useCallback(async (file: File) => {
    if (processingRef.current) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Formato inválido');
      return;
    }

    processingRef.current = true;
    onImageChange?.(true);

    try {
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
      const compressedDataUrl = await compressImage(file);
      await processImage(compressedDataUrl);
    } catch (error) {
      console.error("[ImageUpload] Erro no fluxo de arquivo:", error);
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
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
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
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-bold text-primary">Analisando imagem...</p>
          </div>
        ) : preview ? (
          <div className="relative w-full flex flex-col items-center gap-3">
            <img src={preview} alt="Preview" className="max-w-[200px] rounded-lg border shadow-md" />
            <p className="text-xs text-muted-foreground">Clique para trocar</p>
          </div>
        ) : (
          <>
            <ImageIcon className="h-10 w-10 text-info" />
            <div className="text-center">
              <p className="text-base font-bold">Arraste ou Cole sua Nota</p>
              <p className="text-xs text-muted-foreground">Extração automática via IA</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}