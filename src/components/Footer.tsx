import { Mail } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-border/40 bg-muted/20 py-10">
      <div className="container text-center space-y-4">
        <div className="flex items-center justify-center gap-2.5 font-black text-xl">
          <img src="/assets/logo.png" alt="Opções PRO X" className="h-8 w-8 object-contain" />
          <span className="tracking-tighter text-foreground">Opções PRO X</span>
        </div>

        <a
          href="mailto:contato@opcoesprox.com.br"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <Mail className="h-3.5 w-3.5" />
          contato@opcoesprox.com.br
        </a>

        <p className="text-[10px] text-muted-foreground max-w-3xl mx-auto leading-relaxed">
          AVISO LEGAL: Este aplicativo é uma ferramenta de simulação algorítmica baseada nas regras da B3.
          Os dados apresentados não constituem recomendação de investimento. Verifique os dados com sua corretora antes de operar.
          © {new Date().getFullYear()} Opções PRO X. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
