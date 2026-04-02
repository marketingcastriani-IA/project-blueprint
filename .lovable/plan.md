# Varredura Completa — Melhorias para o Opções PRO X

## Resumo

Analisei todo o sistema: landing page, dashboard, trackers, portfólio, header, FAQ, calculadora e configurações. Identifiquei melhorias divididas em 3 categorias: Landing Page (funcionalidades ausentes), UX/Visual e Sistema.

---

## A. LANDING PAGE — Funcionalidades Novas Ausentes

A landing page atual apresenta OCR, Payoff, CDI, Portfólio, Diversificador, Manual e Tempo Real. Porém faltam seções para funcionalidades já existentes:

### A1. Seção "Rastreador de Box x CDI" com screenshot

O Box Tracker foi completamente redesenhado com troféus 3D e instruções de montagem, mas a landing page NÃO tem screenshot dele. Adicionar uma seção dedicada com screenshot e badge "🔴 AO VIVO" + "PRO", mostrando o ranking de melhores boxes.



### A3. Seção "Calculadora CDI x Opções"

Funcionalidade nova (marcada com "NOVO" no header) sem presença na landing. Adicionar seção com screenshot mostrando a comparação CDI vs estrutura.

### A4. Atualizar tabela de preços (Pricing)

A lista de features PRO não menciona:  Calculadora CDI x Opções, nem Push Notifications. Adicionar esses itens na coluna PRO.

### A5. Seção de Depoimentos / Social Proof

Não existe nenhum depoimento ou prova social. Adicionar seção com 3-4 cards de depoimentos (podem ser fictícios/placeholder inicialmente) para aumentar conversão.

### A6. Seção "Como Funciona" em 3 passos

Falta um fluxo visual simplificado: "1. Tire um print → 2. IA analisa → 3. Veja payoff e métricas". Aumenta clareza para visitantes novos.

---

## B. MELHORIAS VISUAIS / UX

### B1. Contraste no modo Branco — Auditoria completa

Problemas já corrigidos no History, mas podem existir em outras páginas (Portfolio, Dashboard cards, Diversificador). Varrer todas as páginas garantindo `text-foreground` em vez de `text-white` hardcoded.

### B2. Footer duplicado

O `App.tsx` tem um footer fixo com aviso legal E a landing page tem seu próprio footer. Quando logado, o footer do App.tsx aparece em todas as páginas. Unificar para evitar redundância.

### B3. Nome inconsistente na landing

A seção de comparação diz "OpçõesX vs. Planilhas" mas a marca oficial é "Opções PRO X". Corrigir para manter branding consistente.

### B4. Loading states inconsistentes

Dashboard usa `return null` durante loading (flash branco). Deveria mostrar skeleton loader como já existe em History e Portfolio.

---

## C. MELHORIAS DE SISTEMA

### C1. SEO e Meta Tags

O `index.html` provavelmente não tem Open Graph tags, description, etc. Adicionar meta tags para compartilhamento em redes sociais e SEO básico.

### C2. Botão "Voltar ao Topo" na landing page

A landing page é longa. Adicionar botão flutuante de scroll-to-top que aparece após scroll.

### C3. CTA flutuante na landing (mobile)

Em mobile, o botão "7 Dias Grátis" some ao scrollar. Adicionar barra fixa no bottom com CTA persistente.

---

## Plano de Implementação (Priorizado)


| Prioridade | Item                                             | Impacto                  |
| ---------- | ------------------------------------------------ | ------------------------ |
| 1          | A1-A3: Screenshots das features novas na landing | Alto — conversão         |
| 2          | A4: Atualizar pricing com features novas         | Alto — conversão         |
| 3          | A6: Seção "Como Funciona" 3 passos               | Alto — clareza           |
| 4          | B3: Corrigir nome "OpçõesX" → "Opções PRO X"     | Médio — branding         |
| 5          | B2: Remover footer duplicado                     | Baixo — cleanup          |
| 6          | A5: Social proof / depoimentos                   | Alto — conversão         |
| 7          | B1: Auditoria contraste modo Branco              | Médio — acessibilidade   |
| 8          | C1: Meta tags SEO/OG                             | Médio — marketing        |
| 9          | C3: CTA flutuante mobile                         | Médio — conversão mobile |
| 10         | B4: Skeleton no Dashboard                        | Baixo — polish           |


---

## Detalhes Técnicos

- **Landing page**: Todas as alterações em `src/pages/Index.tsx`
- **Screenshots**: Serão necessários novos screenshots em `public/assets/` para Box Tracker, Collar Tracker e Calculadora CDI
- **Footer**: Remover o footer hardcoded do `App.tsx` (linha ~80) e manter apenas o da landing page
- **Branding**: Buscar/substituir "OpçõesX" por "Opções PRO X" em toda a codebase
- **Meta tags**: Editar `index.html` com og:title, og:description, og:image