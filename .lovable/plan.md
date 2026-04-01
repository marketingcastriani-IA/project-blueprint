# Melhorias Visuais, de Sistema e Funcionalidades Inovadoras — OpçõesX

## O que o app já tem

O OpçõesX já possui: análise de estruturas via imagem/manual, payoff chart, gregas (Black-Scholes), rastreador de Box e Collar em tempo real, portfólio com P&L, diversificador, dados ao vivo via RTD Bridge, análise por IA, e push notifications para Box. É um produto maduro.

---

## A. MELHORIAS VISUAIS

### A1. Dark Mode Glass Morphism nos Cards

Os cards atuais usam `bg-gradient-to-br from-card/80 to-card/40` — funcional, mas plano. Adicionar efeito glassmorphism mais pronunciado com `backdrop-blur-2xl`, bordas sutis com gradiente, e micro-sombras internas para dar profundidade real, alinhado ao design language vibrante já existente.

### A2. Animações de Transição entre Páginas

Atualmente não há transição entre rotas — o conteúdo aparece abruptamente. Adicionar `framer-motion` com `AnimatePresence` no `App.tsx` para fade+slide suave entre páginas (200ms).

### A3. Skeleton Loaders em todas as Páginas

Portfolio, History, Dashboard e DadosAoVivo mostram `Loader2` spinner genérico. Substituir por skeletons que imitam o layout real (cards, tabelas, gráficos) para percepção de velocidade.

### A4. Microinterações nos Botões de Ação

Botões como "Salvar", "Analisar IA" e "Calcular" não têm feedback tátil além do hover. Adicionar scale(0.97) no click, ripple effect sutil, e ícone animado de confirmação (checkmark que desenha).

### A5. Gráfico de Payoff com Gradiente e Tooltip Rico

O PayoffChart atual é funcional mas básico. Adicionar gradiente de preenchimento (verde acima de zero, vermelho abaixo), tooltip com todas as gregas no ponto, e linha vertical de "preço atual" com label.

---

## B. MELHORIAS DE SISTEMA

### B1. Modo Offline / PWA Completo

Registrar Service Worker, adicionar `manifest.json`, cachear assets. O usuário poderá instalar o app no celular e acessar análises salvas offline. Isso também habilita as push notifications de forma mais robusta.

### B2. Atalhos de Teclado (Power User)

Adicionar shortcuts: `Ctrl+S` salvar análise, `Ctrl+Enter` analisar IA, `N` nova análise, `Esc` fechar modais. Exibir dica de atalho nos tooltips dos botões.

### B3. Export Avançado

Além do PDF atual, permitir exportar para Excel (.xlsx) com abas separadas (Resumo, Pernas, Payoff Data, Gregas). Útil para quem precisa importar em planilhas próprias.

### B4. Histórico de Alertas do Box Tracker

As notificações push atuais não ficam registradas. Criar um painel de "Histórico de Alertas" mostrando horário, ativo, % CDI, e strike do box que disparou o alerta.

---

