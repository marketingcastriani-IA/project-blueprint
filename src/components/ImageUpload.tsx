import { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, Loader2, X, Zap, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import { Leg } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  onLegsExtracted: (legs: Leg[]) => void;
  onImageChange?: () => void;
}

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
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
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
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
      
      if (error) throw error;
      
      if (data?.legs && data.legs.length > 0) {
        onLegsExtracted(data.legs);
        toast.success(`✓ ${data.legs.length} perna(s) extraída(s) com sucesso!`);
      } else {
        toast.error('Nenhuma perna detectada na imagem.');
      }
    } catch (err: any) {
      console.error('[ImageUpload] Erro:', err);
      toast.error('Erro ao processar imagem');
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
    onImageChange?.();

    try {
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
      const compressedDataUrl = await compressImage(file);
      await processImage(compressedDataUrl);
    } catch (error) {
      console.error("[ImageUpload] Erro:", error);
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
        'relative border-2 transition-all duration-300 cursor-pointer group overflow-hidden min-h-[400px] flex items-center justify-center',
        'bg-gradient-to-br from-info/10 via-card to-card',
        dragActive
          ? 'border-info/60 shadow-[0_0_60px_-8px_hsl(var(--info)/0.4)] scale-[1.01]'
          : 'border-dashed border-info/30 hover:border-info/50 hover:shadow-[0_0_60px_-12px_hsl(var(--info)/0.35)]'
      )}
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => !loading && fileInputRef.current?.click()}
    >
      <CardContent className="flex flex-col items-center justify-center py-20 gap-6 w-full max-w-2xl">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        {loading ? (
          <div className="flex flex-col items-center animate-pulse gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-info/20 blur-xl animate-ping" />
              <Loader2 className="h-16 w-16 animate-spin text-info relative" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-xl font-black text-info uppercase tracking-tighter">Analisando sua Nota...</p>
              <p className="text-sm text-muted-foreground font-medium">Nossa IA está extraindo os dados da B3</p>
            </div>
          </div>
        ) : preview ? (
          <div className="relative w-full flex flex-col items-center gap-6 animate-fade-in">
            <div className="relative group/preview">
              <img src={preview} alt="Preview" className="max-w-full max-h-[400px] rounded-2xl border-4 border-white/10 shadow-2xl transition-transform group-hover/preview:scale-[1.02]" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                <p className="text-white font-black text-sm uppercase tracking-widest">Trocar Imagem</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-success/10 border border-success/20 text-success">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Imagem Carregada</span>
            </div>
          </div>
        ) : (
          <>
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-info/10 text-info border border-info/20 shadow-inner group-hover:scale-110 transition-transform duration-500">
              <ImageIcon className="h-12 w-12" />
            </div>
            <div className="text-center space-y-3">
              <h3 className="text-3xl font-black tracking-tighter">Arraste ou Cole sua Nota</h3>
              <p className="text-base text-muted-foreground font-medium max-w-md mx-auto">
                Tire um print da sua corretora ou home broker e cole aqui. Nossa IA extrai ativos, strikes e preços instantaneamente.
              </p>
            </div>
            <div className="flex items-center gap-4 pt-4">
              <Badge variant="outline" className="px-4 py-1 border-info/30 text-info font-bold">CTRL + V</Badge>
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">ou</span>
              <Badge variant="outline" className="px-4 py-1 border-info/30 text-info font-bold">CLIQUE PARA SUBIR</Badge>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}