import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { BookOpen, TrendingUp, Shield, BarChart3, Zap, Target, DollarSign, Activity, ArrowUpDown, TrendingDown, Umbrella, Hexagon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GreekRow {
  greek: string;
  sinal: string;
  impacto: string;
}

interface OperationalRow {
  label: string;
  value: string;
}

interface Strategy {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  concept: string;
  whenToUse: string[];
  structure: OperationalRow[];
  greeks: GreekRow[];
  example: string[];
  notes: string[];
  payoffImage: string;
}

const strategies: Strategy[] = [
  {
    id: 'covered-call',
    number: '01',
    title: 'Venda Coberta (Covered Call)',
    subtitle: 'Neutro/Alta · Theta+ · Renda',
    icon: <DollarSign className="h-5 w-5" />,
    color: 'text-success',
    concept: 'A Venda Coberta consiste em lançar (vender) uma opção de compra (call) sobre ações que você já possui em carteira. O prêmio recebido reduz o custo médio do ativo e gera renda recorrente, mas limita o ganho potencial acima do strike lançado. É a estratégia de renda mais popular entre investidores que mantêm posição comprada no ativo e toleram entregar as ações ao preço acordado.',
    whenToUse: [
      'Ativo em tendência neutra a levemente altista — expectativa de lateralização ou alta moderada.',
      'Volatilidade implícita elevada: prêmio alto para o mesmo strike delta.',
      'Investidor disposto a limitar o upside em troca de renda imediata.',
      'Após alta expressiva no papel: reduz custo médio enquanto aguarda nova tendência.',
      'Taxas de juros altas: prêmio de call in-the-money embute valor de carrego.',
    ],
    structure: [
      { label: 'Leg 1 — Long Stock', value: 'Comprado 100 ações (ou múltiplo de 100)' },
      { label: 'Leg 2 — Short Call', value: 'Venda de 1 call OTM ou ATM, mesmo vencimento' },
      { label: 'Strike ideal', value: 'Delta 0,20–0,35 para OTM; delta ~0,50 para ATM' },
      { label: 'Vencimento', value: '21–45 DTE para maximizar decaimento temporal (Theta)' },
      { label: 'Margem exigida', value: 'Nenhuma adicional — as ações cobrem o lançamento' },
      { label: 'Gestão', value: 'Fechar/rolar se delta > 0,70 antes do vencimento' },
    ],
    greeks: [
      { greek: 'Delta', sinal: 'Positivo (+)', impacto: 'Lucra com alta do ativo; ganho limitado pelo short call acima do strike.' },
      { greek: 'Theta', sinal: 'Positivo (+)', impacto: 'O tempo correndo a favor: prêmio da call vendida decai todo dia.' },
      { greek: 'Vega', sinal: 'Negativo (–)', impacto: 'Alta na VI prejudica: call fica mais cara para recomprar.' },
      { greek: 'Gamma', sinal: 'Negativo (–)', impacto: 'Perto do vencimento com ativo no strike: aceleração indesejada.' },
    ],
    example: [
      'Ativo: VALE3 a R$45,00 em carteira com custo médio de R$45,00.',
      'Venda de 1 VALEK50 (call strike 50, vencimento 30 dias) por R$3,00.',
      'Prêmio recebido: R$300 por lote (100 ações). Novo custo médio: R$42,00.',
      'Breakeven: R$42,00. Lucro máximo: R$800 (se VALE3 ≥ R$50 no vencimento).',
      'Perda máxima: ação cair abaixo de R$42 — protegida pelo custo médio reduzido.',
      'ROI sobre margem (30 dias): R$300/R$4.500 = 6,7% ao mês.',
    ],
    notes: [
      'Rolling: se o ativo superar o strike, considere rolar a call para vencimento seguinte coletando crédito adicional.',
      'Custo de oportunidade: em tendências de alta forte (>15% no período), a call vendida limita o ganho — avalie não lançar.',
      'Liquidez: prefira séries com alto OI (open interest) para spreads bid-ask reduzidos.',
    ],
    payoffImage: '/assets/manual/payoff-covered-call.png',
  },
  {
    id: 'bull-call-spread',
    number: '02',
    title: 'Trava de Alta (Bull Call Spread)',
    subtitle: 'Alta · Risco Definido · Débito',
    icon: <TrendingUp className="h-5 w-5" />,
    color: 'text-primary',
    concept: 'A Trava de Alta consiste em comprar uma call de strike menor e vender uma call de strike maior, ambas com o mesmo vencimento. O débito líquido pago é o risco máximo; a diferença entre os strikes menos o débito é o lucro máximo. Reduz o custo de comprar uma call direcional ao abrir mão do upside acima do strike vendido. Ideal para operações direcionais com risco controlado.',
    whenToUse: [
      'Visão altista moderada: espera que o ativo suba, mas não de forma agressiva.',
      'Volatilidade implícita elevada: trava reduz o custo da call longa vs. compra simples.',
      'Definição de range: sabe até onde o ativo pode ir no prazo analisado.',
      'Capital limitado: débito muito menor que comprar a call desprotegida.',
      'Risco/retorno favorável: relação R/R ≥ 1:1.5 antes de entrar.',
    ],
    structure: [
      { label: 'Leg 1 — Long Call K1', value: 'Compra da call ATM ou levemente OTM (delta 0,45–0,55)' },
      { label: 'Leg 2 — Short Call K2', value: 'Venda da call mais OTM (delta 0,20–0,35)' },
      { label: 'Débito líquido', value: 'Máxima perda possível = prêmio pago na leg 1 – prêmio recebido na leg 2' },
      { label: 'Lucro máximo', value: '(K2 – K1) – Débito líquido' },
      { label: 'Breakeven', value: 'K1 + Débito líquido' },
      { label: 'Vencimento típico', value: '30–60 DTE' },
    ],
    greeks: [
      { greek: 'Delta', sinal: 'Positivo (+)', impacto: 'Posição direcional; delta líquido entre 0,15 e 0,35.' },
      { greek: 'Theta', sinal: 'Neutro/negativo', impacto: 'Theta da long call > short call: pequena erosão no início.' },
      { greek: 'Vega', sinal: 'Positivo (+)', impacto: 'Alta na VI beneficia levemente (call comprada > call vendida em Vega).' },
      { greek: 'Gamma', sinal: 'Positivo (+)', impacto: 'Próximo ao breakeven o Gamma líquido favorece a posição.' },
    ],
    example: [
      'Ativo: PETR4 a R$38,00.',
      'Compra PETRK40 (call strike 40, venc 45 dias) por R$2,50.',
      'Venda PETRK46 (call strike 46, venc 45 dias) por R$0,80.',
      'Débito líquido: R$1,70. Risco máximo: R$170/lote.',
      'Lucro máximo: R$4,30 por ação = R$430/lote (se PETR4 ≥ R$46 no venc).',
      'Breakeven: R$41,70. Relação R/R: R$430 / R$170 ≈ 2,5:1.',
    ],
    notes: [
      'Se o ativo superar K2 antes do vencimento, considere rolar a short call para strike superior.',
      'Saída antecipada: ao atingir 50–75% do lucro máximo, feche — o risco/retorno marginal piora muito.',
      'Calendário de earnings: evite entrar antes de resultado se a VI já estiver precificando o evento.',
    ],
    payoffImage: '/assets/manual/payoff-bull-call.png',
  },
  {
    id: 'iron-condor',
    number: '03',
    title: 'Iron Condor',
    subtitle: 'Lateral · Vega– · Crédito',
    icon: <Shield className="h-5 w-5" />,
    color: 'text-warning',
    concept: 'O Iron Condor combina uma trava de baixa com puts (short put spread) e uma trava de alta com calls (short call spread), gerando crédito líquido. Lucra quando o ativo fica dentro de um range definido entre os dois strikes internos até o vencimento. É a estratégia padrão de venda de volatilidade com risco limitado nos dois lados.',
    whenToUse: [
      'Volatilidade implícita historicamente alta (IV Rank > 50): prêmios gordos para o mesmo range.',
      'Ativo em lateralização confirmada com suporte e resistência bem definidos.',
      'Pré-eventos com VI inflada que tendem a esvaziar após o resultado.',
      'Vencimento 30–45 DTE: Theta máximo na fase final da série.',
      'Índices (ex: BOVA11, mini-índice) com movimento médio diário baixo e alta liquidez.',
    ],
    structure: [
      { label: 'Leg 1 — Long Put K1', value: 'Compra put OTM inferior (proteção baixa)' },
      { label: 'Leg 2 — Short Put K2', value: 'Venda put OTM (strike interno inferior)' },
      { label: 'Leg 3 — Short Call K3', value: 'Venda call OTM (strike interno superior)' },
      { label: 'Leg 4 — Long Call K4', value: 'Compra call OTM superior (proteção alta)' },
      { label: 'Crédito líquido', value: '(Prem K2 + Prem K3) – (Prem K1 + Prem K4)' },
      { label: 'Risco máximo', value: '(K2–K1 ou K4–K3) – Crédito líquido' },
    ],
    greeks: [
      { greek: 'Delta', sinal: 'Próximo de 0', impacto: 'Neutro ao iniciar; fica direcional se ativo se mover para uma das travas.' },
      { greek: 'Theta', sinal: 'Positivo (+)', impacto: 'Forte gerador de Theta: as 4 pernas somam decaimento positivo.' },
      { greek: 'Vega', sinal: 'Negativo (–)', impacto: 'Alta na VI = pior cenário: todas as opções ficam mais caras para recomprar.' },
      { greek: 'Gamma', sinal: 'Negativo (–)', impacto: 'Perto do vencimento com ativo nos strikes internos: Gamma forte e negativo.' },
    ],
    example: [
      'Ativo: BOVA11 a R$118,00. IV Rank: 65%.',
      'Long Put K1=108 por R$0,40 | Short Put K2=112 por R$1,20.',
      'Short Call K3=124 por R$1,40 | Long Call K4=128 por R$0,50.',
      'Crédito líquido: (1,20+1,40)–(0,40+0,50) = R$1,70/ação = R$170/lote.',
      'Risco máximo: R$1.030 por lote.',
      'Breakevens: R$110,30 e R$125,70. Range = 15,40 pontos (13% do ativo).',
    ],
    notes: [
      'Se o ativo romper K2 ou K3, rolar a asa atingida para vencimento seguinte.',
      'Iron Condor assimétrico: quando há viés direcional leve, estreite a asa contrária.',
      'Nunca segure até o vencimento com o ativo nos strikes internos — feche ao atingir 50% do lucro máximo.',
    ],
    payoffImage: '/assets/manual/payoff-iron-condor.png',
  },
  {
    id: 'straddle-strangle',
    number: '04',
    title: 'Straddle / Strangle',
    subtitle: 'Explosão · Vega+ · Débito',
    icon: <Zap className="h-5 w-5" />,
    color: 'text-destructive',
    concept: 'O Straddle é a compra simultânea de uma call e uma put ATM com o mesmo strike e vencimento. O Strangle é a variação com call e put OTM (strikes diferentes). Ambas lucram com movimentos expressivos do ativo em qualquer direção. O custo total pago é a perda máxima. Trata-se de uma aposta em expansão de volatilidade implícita.',
    whenToUse: [
      'Pré-earnings, decisões de BACEN, resultados trimestrais: catalisadores de alta volatilidade.',
      'IV Rank baixo (< 30): prêmios baratos antes de evento que deve expandir a VI.',
      'Ativo em compressão de volatilidade prolongada (bollinger bands contraindo).',
      'Cenário macro de grande incerteza: eleições, crises, dados de inflação surpresa.',
      'Strangle: quando o custo do straddle é alto e espera-se movimento acima dos breakevens.',
    ],
    structure: [
      { label: 'Straddle — Long Call ATM', value: 'Compra call com strike = preço atual do ativo' },
      { label: 'Straddle — Long Put ATM', value: 'Compra put com mesmo strike e vencimento' },
      { label: 'Strangle — Long Call OTM', value: 'Compra call com strike acima (delta ~0,25–0,30)' },
      { label: 'Strangle — Long Put OTM', value: 'Compra put com strike abaixo (delta ~0,25–0,30)' },
      { label: 'Débito total', value: 'Prêmio call + Prêmio put (custo = perda máxima)' },
      { label: 'Breakeven', value: 'Strike ± débito total' },
    ],
    greeks: [
      { greek: 'Delta', sinal: 'Próximo de 0', impacto: 'Neutro ao iniciar; torna-se fortemente direcional com movimento do ativo.' },
      { greek: 'Theta', sinal: 'Negativo (–)', impacto: 'Maior inimigo: cada dia sem movimento corrói o prêmio pago.' },
      { greek: 'Vega', sinal: 'Positivo (+)', impacto: 'Principal driver: alta na VI mesmo sem movimento do ativo gera lucro.' },
      { greek: 'Gamma', sinal: 'Positivo (+)', impacto: 'Gamma alto ATM: aceleração dos deltas com movimento.' },
    ],
    example: [
      'Ativo: MGLU3 a R$10,00, resultado amanhã, IV Rank = 22%.',
      'Straddle: compra call K10 por R$0,60 + put K10 por R$0,55.',
      'Débito total: R$1,15. Perda máxima: R$115/lote.',
      'Breakevens: R$8,85 e R$11,15 (±11,5% necessário).',
      'Strangle alternativo: call K11 R$0,35 + put K9 R$0,30 = R$0,65.',
      'Alvo: fechar ao dobrar o prêmio pago (retorno de 100%).',
    ],
    notes: [
      'IV crush pós-evento: após o catalisador a VI colapsa — venda assim que o movimento ocorrer.',
      'Vencimento curto: prefira 5–15 DTE para capturar o evento específico.',
      'Nunca carregue um straddle longo sem catalisador — Theta destrói o prêmio diariamente.',
    ],
    payoffImage: '/assets/manual/payoff-straddle.png',
  },
  {
    id: 'collar',
    number: '05',
    title: 'Collar',
    subtitle: 'Hedge · Custo Zero · Proteção',
    icon: <Shield className="h-5 w-5" />,
    color: 'text-primary',
    concept: 'O Collar combina long stock + long put (proteção) + short call (financiamento). O investidor que possui ações compra uma put OTM para se proteger de quedas e vende uma call OTM para financiar o custo da put, resultando frequentemente em custo zero. É uma estrutura de hedge de portfólio eficiente.',
    whenToUse: [
      'Carteira com ação valorizada significativamente e não quer vender.',
      'Cenário de incerteza macroeconômica de curto prazo.',
      'Custo de opções elevado: pode montar collar com crédito líquido.',
      'Posição concentrada: um único ativo representa >20% do portfólio.',
      'Proteção de ganhos acumulados antes de evento binário.',
    ],
    structure: [
      { label: 'Leg 1 — Long Stock', value: 'Ações em carteira (100 por lote)' },
      { label: 'Leg 2 — Long Put OTM', value: 'Compra put abaixo do preço atual (delta –0,20 a –0,35)' },
      { label: 'Leg 3 — Short Call OTM', value: 'Venda call acima do preço atual (delta 0,20 a 0,30)' },
      { label: 'Custo líquido', value: 'Prêmio put – Prêmio call (idealmente ≈ 0)' },
      { label: 'Floor (piso)', value: 'Strike da put – custo líquido' },
      { label: 'Cap (teto)', value: 'Strike da call + crédito líquido' },
    ],
    greeks: [
      { greek: 'Delta', sinal: 'Positivo reduzido', impacto: 'Delta líquido entre 0,40–0,60 (menor que long stock puro).' },
      { greek: 'Theta', sinal: 'Próximo de 0', impacto: 'Put long e call short se compensam em Theta.' },
      { greek: 'Vega', sinal: 'Próximo de 0', impacto: 'Put long e call short de deltas similares — quase neutro.' },
      { greek: 'Gamma', sinal: 'Positivo leve', impacto: 'Long put contribui com Gamma positivo em quedas.' },
    ],
    example: [
      'Ativo: ITUB4 a R$34,00, comprado a R$28 (custo médio). Ganho de 21%.',
      'Long Put K=30 (delta –0,25, venc 60 dias): paga R$0,90.',
      'Short Call K=38 (delta 0,22, venc 60 dias): recebe R$0,95.',
      'Crédito líquido: R$0,05/ação. Custo efetivo da proteção: zero.',
      'Floor: R$29,95 | Cap: R$38,05.',
      'Proteção: 12% de downside protegido sem custo.',
    ],
    notes: [
      'Collar de custo zero perfeito: escolha strikes de put e call com o mesmo prêmio absoluto.',
      'Em mercado altista, eleve o strike da call para capturar mais upside.',
      'Put e call de cobertura têm tratamento fiscal específico — consulte regras da Receita Federal.',
    ],
    payoffImage: '/assets/manual/payoff-collar.png',
  },
  {
    id: 'box-spread',
    number: '06',
    title: 'Box Spread',
    subtitle: 'Arbitragem · Taxa CDI · Neutro',
    icon: <Target className="h-5 w-5" />,
    color: 'text-success',
    concept: 'O Box Spread é uma posição delta-neutra de quatro opções (trava de alta com calls + trava de baixa com puts no mesmo par de strikes e vencimento) que replica matematicamente um empréstimo/aplicação à taxa de juros implícita nas opções. O box vale exatamente (K2 – K1) descontado pela taxa livre de risco até o vencimento.',
    whenToUse: [
      'Taxas de juros implícitas nas opções acima do CDI: vender o box equivale a captar recursos mais baratos.',
      'Taxas implícitas abaixo do CDI: comprar o box equivale a aplicar à taxa melhor que o mercado.',
      'Funding de posições: trader usa box como fonte de financiamento alavancado.',
      'Arbitragem de precificação entre puts e calls (violação de put-call parity).',
    ],
    structure: [
      { label: 'Bull Call Spread', value: 'Long Call K1 + Short Call K2 (mesmo venc)' },
      { label: 'Bear Put Spread', value: 'Long Put K2 + Short Put K1 (mesmo venc)' },
      { label: 'Valor teórico', value: '(K2 – K1) / (1 + r)^(T/252)' },
      { label: 'Resultado', value: 'Independente do preço no vencimento: sempre paga K2–K1' },
      { label: 'Risco', value: 'Risco de execução (bid-ask spread das 4 pernas) e liquidez' },
    ],
    greeks: [
      { greek: 'Delta', sinal: '≈ 0', impacto: 'Perfeitamente delta-neutro.' },
      { greek: 'Theta', sinal: '≈ 0', impacto: 'Sem decaimento temporal líquido.' },
      { greek: 'Vega', sinal: '≈ 0', impacto: 'Sem exposição à volatilidade.' },
      { greek: 'Gamma', sinal: '≈ 0', impacto: 'Zero gamma: não há convexidade.' },
    ],
    example: [
      'IBOV futuro em 128.000 pts. Box com K1=120.000 e K2=130.000, 63 DTE.',
      'Valor teórico: R$9.836.',
      'Box negociado a R$9.600: comprar = aplicar R$9.600 para receber R$10.000 em 63 dias.',
      'Taxa implícita: 16,7% a.a. (bem acima do CDI).',
      'Arbitragem: comprar box, vender CDI futuro — lucro de ~5,6% a.a. sem risco.',
    ],
    notes: [
      'A maior dificuldade é executar as 4 pernas simultaneamente sem que o preço se mova.',
      'Custos de transação comem grande parte da arbitragem — use limit orders.',
      'Opções americanas (padrão no Brasil) podem ser exercidas antes do vencimento, afetando o box.',
      'Gestoras de renda fixa usam box para alocar caixa com taxa superior ao overnight.',
    ],
    payoffImage: '/assets/manual/payoff-box-spread.png',
  },
  {
    id: 'ratio-spread',
    number: '07',
    title: 'Ratio Spread (1x2, 1x3)',
    subtitle: 'Alta Agressiva · Vega– · Gamma–',
    icon: <BarChart3 className="h-5 w-5" />,
    color: 'text-destructive',
    concept: 'O Ratio Spread consiste em comprar N calls de um strike e vender M calls de strike maior (M > N) — tipicamente 1x2 ou 1x3. A posição costuma ser montada por crédito zero, com lucro máximo no strike vendido. Acima do strike vendido, o risco torna-se ilimitado. É uma estrutura de alta moderada com viés de venda de volatilidade.',
    whenToUse: [
      'Alta moderada: espera-se que o ativo suba até o strike vendido, sem ultrapassar muito.',
      'IV elevada: prêmio alto para a short call financia a long call com sobra.',
      'Mercado com resistência técnica forte no strike vendido.',
      'Trader disposto a monitorar a posição diariamente e fechar se o ativo acelerar.',
    ],
    structure: [
      { label: 'Leg 1 — Long Call K1 (×1)', value: 'Compra de 1 call ATM ou levemente OTM' },
      { label: 'Leg 2 — Short Call K2 (×2)', value: 'Venda de 2 calls com strike superior' },
      { label: 'Crédito líquido', value: 'Ideal montar por crédito zero ou leve crédito' },
      { label: 'Lucro máximo', value: '(K2 – K1) + crédito inicial (se ativo = K2 no venc)' },
      { label: 'Risco superior', value: 'Ilimitado acima de K2 × 2 – K1' },
      { label: 'Breakeven superior', value: 'K2 + (K2 – K1) + crédito' },
    ],
    greeks: [
      { greek: 'Delta', sinal: 'Positivo (+)', impacto: 'Direcional; fica negativo acima de K2 conforme short calls dominam.' },
      { greek: 'Theta', sinal: 'Positivo (+)', impacto: 'Short calls vendem mais Theta do que a long compra.' },
      { greek: 'Vega', sinal: 'Negativo (–)', impacto: 'As 2 short calls têm mais Vega do que a 1 long — alta VI prejudica.' },
      { greek: 'Gamma', sinal: 'Negativo (–)', impacto: 'Perigoso perto de K2: grande aceleração do delta negativo.' },
    ],
    example: [
      'Ativo: BBAS3 a R$48,00. Expectativa: alta até R$55 em 30 dias.',
      'Long 1x BBASK50 call por R$2,40 | Short 2x BBASK55 call por R$1,20 cada.',
      'Resultado: 2 × R$1,20 – R$2,40 = crédito zero (montagem gratuita).',
      'Lucro máximo: R$5,00/ação = R$500/lote se BBAS3 = R$55 no venc.',
      'Breakeven superior: R$60,00.',
      'Acima de R$60: perda ilimitada — feche ao atingir R$57.',
    ],
    notes: [
      'Stop obrigatório: defina antes de entrar — ex: fechar se o ativo superar K2 + 3%.',
      'Recompre uma das short calls se o ativo superar K2 para reduzir o risco ilimitado.',
      'Nunca carregue naked calls sem monitoramento intradiário.',
      'Variação 1x3: ainda mais crédito, mas o risco se triplica.',
    ],
    payoffImage: '/assets/manual/payoff-ratio-spread.png',
  },
  {
    id: 'calendar-spread',
    number: '08',
    title: 'Calendar Spread (Horizontal Spread)',
    subtitle: 'Lateral · Theta+ · Vega+',
    icon: <Activity className="h-5 w-5" />,
    color: 'text-primary',
    concept: 'O Calendar Spread consiste em vender uma opção de vencimento próximo e comprar a mesma opção em vencimento mais longo. O lucro vem da diferença de decaimento temporal (Theta) entre as duas séries. Também se beneficia de alta na volatilidade implícita das opções longas. Lucra quando o ativo fica perto do strike no vencimento da opção curta.',
    whenToUse: [
      'IV Rank baixo na série longa: opções longas baratas, ideal para comprar Vega.',
      'Ativo lateral: sem catalisador de curto prazo.',
      'Diferença de VI entre séries: venda a cara, compre a barata.',
      'Pós-earnings: IV da série curta colapsa enquanto série longa mantém prêmio.',
      'Ativo chegando a resistência com expectativa de consolidação temporária.',
    ],
    structure: [
      { label: 'Leg 1 — Short Option (front)', value: 'Venda da opção no vencimento mais próximo' },
      { label: 'Leg 2 — Long Option (back)', value: 'Compra da opção no vencimento mais distante' },
      { label: 'Mesmo strike', value: 'Idealmente ATM para capturar Theta máximo' },
      { label: 'Débito líquido', value: 'Prêmio long – Prêmio short (custo = perda máxima)' },
      { label: 'Lucro máximo', value: 'Diferença de valor extrínseco no vencimento do front month' },
    ],
    greeks: [
      { greek: 'Delta', sinal: '≈ 0', impacto: 'Neutra ao iniciar ATM; torna-se direcional com movimento.' },
      { greek: 'Theta', sinal: 'Positivo (+)', impacto: 'Front month decai mais rápido: Theta líquido positivo.' },
      { greek: 'Vega', sinal: 'Positivo (+)', impacto: 'Back month tem mais Vega: alta na VI beneficia.' },
      { greek: 'Gamma', sinal: 'Negativo (–)', impacto: 'Front month Gamma domina perto do vencimento.' },
    ],
    example: [
      'Ativo: COGN3 a R$8,00. Lateral pós-resultado, IV Rank = 28%.',
      'Venda COGNK8 call vencimento Março por R$0,55.',
      'Compra COGNK8 call vencimento Maio por R$1,10.',
      'Débito líquido: R$0,55. Perda máxima: R$55/lote.',
      'Lucro estimado se COGN3 = R$8,00 no venc Março: R$0,90–R$1,20.',
      'Relação R/R: até 2:1. Após venc Março: rola a short call para Abril.',
    ],
    notes: [
      'Rolling: ao expirar a short call, venda o próximo mês — renda recorrente.',
      'Double calendar: monte com strike put e call para zona de lucro maior.',
      'Diagonal calendar: ajuste o strike da opção longa para capturar direcionalidade.',
    ],
    payoffImage: '/assets/manual/payoff-calendar-spread.png',
  },
  {
    id: 'backspread',
    number: '09',
    title: 'Backspread (Reverse Ratio Spread)',
    subtitle: 'Explosão · Vega+ · Gamma+',
    icon: <ArrowUpDown className="h-5 w-5" />,
    color: 'text-success',
    concept: 'O Backspread é o inverso do Ratio Spread: vende N opções de um strike e compra M opções de strike mais extremo (M > N). Na versão call: short 1 call K1 + long 2 calls K2. Tipicamente montado por crédito zero. Lucra com movimento explosivo na direção esperada e com alta na VI. É o instrumento de traders que buscam assimetria positiva.',
    whenToUse: [
      'IV Rank muito baixo (< 20%): opções OTM baratas para comprar em quantidade.',
      'Pré-evento de grande impacto com IV artificialmente baixa.',
      'Ativo em compressão técnica severa prestes a romper resistência forte.',
      'Posição de custo zero: sem pagar pelo acesso ao Gamma e Vega longos.',
      'Complemento a posição long stock: backspread de call como seguro de aceleração.',
    ],
    structure: [
      { label: 'Short Call K1 (×1)', value: 'Venda de 1 call ATM ou levemente OTM' },
      { label: 'Long Call K2 (×2)', value: 'Compra de 2 calls com strike mais alto' },
      { label: 'Crédito/débito', value: 'Idealmente crédito zero ou leve crédito líquido' },
      { label: 'Lucro máximo', value: 'Ilimitado (call)' },
      { label: 'Risco máximo', value: '(K2 – K1) – crédito recebido (zona entre os strikes)' },
    ],
    greeks: [
      { greek: 'Delta', sinal: 'Positivo (+)', impacto: 'Direcional; as 2 long calls dominam o delta acima de K2.' },
      { greek: 'Theta', sinal: 'Negativo (–)', impacto: 'As 2 long calls têm mais Theta que a 1 short: erosão temporal.' },
      { greek: 'Vega', sinal: 'Positivo (+)', impacto: 'Net long Vega: alta na VI aumenta imediatamente o valor.' },
      { greek: 'Gamma', sinal: 'Positivo (+)', impacto: 'Acima de K2 o Gamma líquido fica positivo e crescente.' },
    ],
    example: [
      'Ativo: WEGE3 a R$38,00. IV Rank = 15%. Expectativa: rompimento de R$42 pode levar ao R$50.',
      'Short 1x WEGEK40 call por R$1,20 | Long 2x WEGEK44 call por R$0,60 cada.',
      'Crédito líquido: R$1,20 – 2×R$0,60 = R$0,00 (custo zero).',
      'Risco máximo: R$4,00/ação = R$400/lote (se WEGE3 = R$44 no venc).',
      'Lucro acima de R$48: ilimitado. Em R$52: R$1.200.',
      'Abaixo de R$40: crédito zero retido. Posição expira sem custo.',
    ],
    notes: [
      'Timing é crítico: backspread em IV alta é caro — monte quando IV está na base histórica.',
      'A zona de perda máxima fica entre K1 e K2.',
      'Não carregue até o vencimento sem o movimento: feche com 10–15 DTE.',
      'Ratio 1x3: backspread mais agressivo, com crédito maior mas zona de risco mais estreita.',
    ],
    payoffImage: '/assets/manual/payoff-backspread.png',
  },
  {
    id: 'butterfly-spread',
    number: '10',
    title: 'Butterfly Spread (Borboleta)',
    subtitle: 'Lateral · Risco Definido · Débito',
    icon: <Hexagon className="h-5 w-5" />,
    color: 'text-primary',
    concept: 'A Butterfly Spread é uma estratégia de três pernas que combina uma trava de alta e uma trava de baixa com um strike central compartilhado. O lucro máximo ocorre quando o ativo fecha exatamente no strike central no vencimento. É ideal para cenários de lateralização precisa com risco limitado ao débito pago.',
    whenToUse: [
      'Ativo em lateralização clara com suporte e resistência bem definidos.',
      'Expectativa de que o ativo ficará próximo a um preço-alvo específico no vencimento.',
      'IV moderada a alta: prêmios permitem montar butterfly por débito baixo.',
      'Vencimento curto (15–30 DTE) para maximizar a convergência ao strike central.',
      'Quando o custo de uma iron condor é similar mas o lucro máximo da butterfly é superior.',
    ],
    structure: [
      { label: 'Leg 1 — Long Call K1', value: 'Compra de 1 call OTM inferior (asa esquerda)' },
      { label: 'Leg 2 — Short Call K2 (×2)', value: 'Venda de 2 calls ATM (corpo central)' },
      { label: 'Leg 3 — Long Call K3', value: 'Compra de 1 call OTM superior (asa direita)' },
      { label: 'Distância entre strikes', value: 'K2 – K1 = K3 – K2 (equidistante)' },
      { label: 'Débito líquido', value: 'Prêmio K1 + Prêmio K3 – 2 × Prêmio K2' },
      { label: 'Lucro máximo', value: '(K2 – K1) – Débito (se ativo = K2 no venc)' },
    ],
    greeks: [
      { greek: 'Delta', sinal: '≈ 0', impacto: 'Neutra quando montada ATM; fica direcional se ativo se afastar de K2.' },
      { greek: 'Theta', sinal: 'Positivo (+)', impacto: 'As 2 short calls vendem mais Theta do que as long compram.' },
      { greek: 'Vega', sinal: 'Negativo (–)', impacto: 'Net short Vega: alta na VI prejudica a posição.' },
      { greek: 'Gamma', sinal: 'Negativo (–)', impacto: 'Gamma negativo próximo de K2 — ativo precisa ficar parado.' },
    ],
    example: [
      'Ativo: VALE3 a R$60,00.',
      'Long 1x VALEK56 call por R$5,20 | Short 2x VALEK60 call por R$3,00 cada | Long 1x VALEK64 call por R$1,40.',
      'Débito: R$5,20 + R$1,40 – 2×R$3,00 = R$0,60/ação = R$60/lote.',
      'Lucro máximo: R$3,40/ação = R$340/lote (se VALE3 = R$60 no venc).',
      'Breakevens: R$56,60 e R$63,40.',
      'Relação R/R: R$340 / R$60 ≈ 5,7:1.',
    ],
    notes: [
      'A butterfly é uma das estratégias com melhor relação R/R, mas exige acertar o preço-alvo.',
      'Broken wing butterfly: ajuste uma asa para viés direcional mantendo risco controlado.',
      'Iron butterfly (versão crédito): substitua as long calls por puts para coletar crédito líquido.',
      'Feche ao atingir 50% do lucro máximo — o risco/retorno marginal piora muito após esse ponto.',
    ],
    payoffImage: '/assets/manual/payoff-butterfly.png',
  },
  {
    id: 'bear-put-spread',
    number: '11',
    title: 'Trava de Baixa (Bear Put Spread)',
    subtitle: 'Baixa · Risco Definido · Débito',
    icon: <TrendingDown className="h-5 w-5" />,
    color: 'text-destructive',
    concept: 'A Trava de Baixa consiste em comprar uma put de strike maior e vender uma put de strike menor, ambas com o mesmo vencimento. O débito líquido pago é o risco máximo; a diferença entre os strikes menos o débito é o lucro máximo. É a contraparte da trava de alta, ideal para operações direcionais de queda com risco controlado.',
    whenToUse: [
      'Visão baixista moderada: espera que o ativo caia, mas com risco definido.',
      'Proteção parcial: hedge mais barato do que comprar put simples.',
      'IV elevada: trava reduz impacto do prêmio alto da put comprada.',
      'Rompimento de suporte: operação direcional de queda com relação R/R atrativa.',
      'Mercado em correção: posição bearish de curto prazo.',
    ],
    structure: [
      { label: 'Leg 1 — Long Put K2', value: 'Compra da put ATM ou levemente ITM (delta –0,45 a –0,55)' },
      { label: 'Leg 2 — Short Put K1', value: 'Venda da put mais OTM (delta –0,20 a –0,35)' },
      { label: 'Débito líquido', value: 'Prêmio K2 – Prêmio K1 (máxima perda possível)' },
      { label: 'Lucro máximo', value: '(K2 – K1) – Débito líquido' },
      { label: 'Breakeven', value: 'K2 – Débito líquido' },
      { label: 'Vencimento típico', value: '30–60 DTE' },
    ],
    greeks: [
      { greek: 'Delta', sinal: 'Negativo (–)', impacto: 'Posição direcional de queda; delta líquido entre –0,15 e –0,35.' },
      { greek: 'Theta', sinal: 'Neutro/negativo', impacto: 'Long put decai mais rápido que short put no início.' },
      { greek: 'Vega', sinal: 'Positivo (+)', impacto: 'Alta na IV beneficia levemente (put comprada > put vendida em Vega).' },
      { greek: 'Gamma', sinal: 'Positivo (+)', impacto: 'Próximo ao breakeven o Gamma líquido favorece a posição.' },
    ],
    example: [
      'Ativo: BBDC4 a R$14,50. Expectativa: queda para R$12.',
      'Compra BBDCX14 (put strike 14) por R$1,10.',
      'Venda BBDCX11 (put strike 11) por R$0,30.',
      'Débito líquido: R$0,80. Risco máximo: R$80/lote.',
      'Lucro máximo: R$2,20/ação = R$220/lote (se BBDC4 ≤ R$11 no venc).',
      'Breakeven: R$13,20. Relação R/R: R$220 / R$80 ≈ 2,75:1.',
    ],
    notes: [
      'Saída antecipada: ao atingir 50–75% do lucro máximo, feche para garantir o resultado.',
      'Se o ativo reverter para alta, a perda máxima é apenas o débito pago.',
      'Combine com trava de alta em calls para montar um Iron Condor completo.',
    ],
    payoffImage: '/assets/manual/payoff-bear-put.png',
  },
  {
    id: 'protective-put',
    number: '12',
    title: 'Put Protetora (Protective Put)',
    subtitle: 'Hedge · Seguro · Débito',
    icon: <Umbrella className="h-5 w-5" />,
    color: 'text-warning',
    concept: 'A Put Protetora é a compra de uma put OTM sobre ações que você já possui em carteira. Funciona como um seguro: você paga um prêmio para limitar suas perdas caso o ativo caia abaixo do strike da put. Diferente do collar, a protective put não limita o ganho — mantém 100% do upside. É a estratégia de hedge mais simples e direta.',
    whenToUse: [
      'Carteira com ganhos acumulados que você quer proteger sem vender as ações.',
      'Pré-evento de alto impacto: resultado, eleições, dados macro.',
      'IV baixa: prêmio da put está barato em termos históricos.',
      'Investidor que não aceita limitar o upside (diferença para o collar).',
      'Proteção de posição concentrada antes de período de lockup ou restrição de venda.',
    ],
    structure: [
      { label: 'Leg 1 — Long Stock', value: 'Ações em carteira (100 por lote)' },
      { label: 'Leg 2 — Long Put OTM', value: 'Compra put com strike abaixo do preço atual' },
      { label: 'Custo do seguro', value: 'Prêmio pago pela put (débito)' },
      { label: 'Piso (floor)', value: 'Strike da put – prêmio pago' },
      { label: 'Upside', value: 'Ilimitado (mantém 100% da alta)' },
      { label: 'Breakeven', value: 'Preço de compra da ação + prêmio da put' },
    ],
    greeks: [
      { greek: 'Delta', sinal: 'Positivo (+)', impacto: 'Delta reduzido vs long stock puro; put comprada subtrai delta.' },
      { greek: 'Theta', sinal: 'Negativo (–)', impacto: 'Put comprada perde valor com o tempo — custo do seguro.' },
      { greek: 'Vega', sinal: 'Positivo (+)', impacto: 'Alta na IV aumenta o valor da put comprada.' },
      { greek: 'Gamma', sinal: 'Positivo (+)', impacto: 'Put comprada contribui com Gamma positivo em quedas.' },
    ],
    example: [
      'Ativo: PETR4 a R$38,00, comprada a R$32 (ganho de 18,75%).',
      'Compra put PETRX35 (strike 35, venc 45 dias) por R$1,20.',
      'Custo do seguro: R$120/lote. Piso: R$33,80.',
      'Se PETR4 cair para R$25: perda limitada a R$4,20/ação (vs R$13 sem proteção).',
      'Se PETR4 subir para R$50: lucro = R$50 – R$32 – R$1,20 = R$16,80/ação.',
      'Proteção: 11% de downside protegido. Custo: 3,2% do capital.',
    ],
    notes: [
      'A protective put é mais cara que o collar, mas mantém 100% do upside.',
      'Compre puts com 30–60 DTE para equilibrar custo vs proteção.',
      'Em mercado de alta forte, o custo da put é compensado pela valorização das ações.',
      'Married put: quando a ação e a put são compradas simultaneamente como uma posição integrada.',
    ],
    payoffImage: '/assets/manual/payoff-protective-put.png',
  },
];

const referenceTable = [
  { name: 'Venda Coberta', dir: 'Neutro/Alta', vega: '–', theta: '+', delta: '+', complexity: 'Baixa', risk: 'Ilimitado baixo' },
  { name: 'Trava de Alta', dir: 'Alta', vega: '±', theta: '–/+', delta: '+', complexity: 'Média', risk: 'Limitado' },
  { name: 'Trava de Baixa', dir: 'Baixa', vega: '±', theta: '–/+', delta: '–', complexity: 'Média', risk: 'Limitado' },
  { name: 'Iron Condor', dir: 'Lateral', vega: '–', theta: '+', delta: '≈0', complexity: 'Alta', risk: 'Limitado' },
  { name: 'Butterfly', dir: 'Lateral', vega: '–', theta: '+', delta: '≈0', complexity: 'Alta', risk: 'Limitado' },
  { name: 'Straddle', dir: 'Explosão', vega: '+', theta: '–', delta: '≈0', complexity: 'Alta', risk: 'Prêmio pago' },
  { name: 'Collar', dir: 'Ponderado', vega: '±', theta: '±', delta: '+', complexity: 'Baixa', risk: 'Limitado' },
  { name: 'Put Protetora', dir: 'Hedge', vega: '+', theta: '–', delta: '+', complexity: 'Baixa', risk: 'Prêmio pago' },
  { name: 'Box Spread', dir: 'Neutro', vega: '≈0', theta: '≈0', delta: '≈0', complexity: 'Média', risk: 'Custo crédito' },
  { name: 'Ratio Spread', dir: 'Alta', vega: '–', theta: '+', delta: '+', complexity: 'Alta', risk: 'Ilimitado acima' },
  { name: 'Calendar', dir: 'Lateral', vega: '+', theta: '+', delta: '≈0', complexity: 'Alta', risk: 'Débito pago' },
  { name: 'Backspread', dir: 'Explosão', vega: '+', theta: '–', delta: '+', complexity: 'Alta', risk: 'Spread ou zero' },
];

function StrategyCard({ strategy }: { strategy: Strategy }) {
  return (
    <Card className="border-border/40 bg-card/80 backdrop-blur-sm overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10", strategy.color)}>
            {strategy.icon}
          </div>
          <div className="flex-1">
            <CardTitle className="text-xl font-black tracking-tight flex items-center gap-2">
              <span className="text-primary font-mono text-sm">#{strategy.number}</span>
              {strategy.title}
            </CardTitle>
            <p className="text-xs font-bold text-muted-foreground mt-0.5">{strategy.subtitle}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Conceito */}
        <div>
          <h4 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-2">Conceito e Mecânica</h4>
          <p className="text-sm leading-relaxed text-foreground/90">{strategy.concept}</p>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {/* Quando Usar */}
          <AccordionItem value="when">
            <AccordionTrigger className="text-sm font-black uppercase tracking-widest text-muted-foreground hover:no-underline py-2">
              Quando Usar
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-2">
                {strategy.whenToUse.map((item, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <span className="text-primary mt-1 shrink-0">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>

          {/* Estrutura */}
          <AccordionItem value="structure">
            <AccordionTrigger className="text-sm font-black uppercase tracking-widest text-muted-foreground hover:no-underline py-2">
              Estrutura Operacional
            </AccordionTrigger>
            <AccordionContent>
              <div className="rounded-lg border border-border/40 overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {strategy.structure.map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-muted/30' : ''}>
                        <td className="px-3 py-2 font-bold text-xs whitespace-nowrap border-r border-border/30">{row.label}</td>
                        <td className="px-3 py-2 text-xs">{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Greeks */}
          <AccordionItem value="greeks">
            <AccordionTrigger className="text-sm font-black uppercase tracking-widest text-muted-foreground hover:no-underline py-2">
              Exposição às Greeks
            </AccordionTrigger>
            <AccordionContent>
              <div className="rounded-lg border border-border/40 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border/40">
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-widest">Greek</th>
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-widest">Sinal</th>
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-widest">Impacto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {strategy.greeks.map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-muted/20' : ''}>
                        <td className="px-3 py-2 font-bold text-xs">{row.greek}</td>
                        <td className={cn("px-3 py-2 text-xs font-bold", 
                          row.sinal.includes('+') ? 'text-success' : row.sinal.includes('–') ? 'text-destructive' : 'text-muted-foreground'
                        )}>{row.sinal}</td>
                        <td className="px-3 py-2 text-xs">{row.impacto}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Exemplo */}
          <AccordionItem value="example">
            <AccordionTrigger className="text-sm font-black uppercase tracking-widest text-muted-foreground hover:no-underline py-2">
              Exemplo Prático
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-2">
                {strategy.example.map((item, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <span className="text-primary mt-1 shrink-0">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>

          {/* Payoff */}
          <AccordionItem value="payoff">
            <AccordionTrigger className="text-sm font-black uppercase tracking-widest text-muted-foreground hover:no-underline py-2">
              Gráfico de Payoff
            </AccordionTrigger>
            <AccordionContent>
              <div className="rounded-xl overflow-hidden border border-border/30 bg-background">
                <img src={strategy.payoffImage} alt={`Payoff ${strategy.title}`} className="w-full h-auto" loading="lazy" />
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 text-center">Resultado líquido no vencimento em função do preço do ativo-objeto.</p>
            </AccordionContent>
          </AccordionItem>

          {/* Notas */}
          <AccordionItem value="notes">
            <AccordionTrigger className="text-sm font-black uppercase tracking-widest text-muted-foreground hover:no-underline py-2">
              Notas Operacionais
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-2">
                {strategy.notes.map((item, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <span className="text-warning mt-1 shrink-0">⚠</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}

export default function Manual() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-background pb-16">
      <Header />
      <main className="container px-3 sm:px-6 py-6 space-y-8 animate-fade-in">
        {/* Hero */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm font-bold">
            <BookOpen className="h-4 w-4" /> MANUAL COMPLETO DE ESTRATÉGIAS
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tighter">
            Estratégias com <span className="text-primary">Opções</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Nível Avançado · Foco Técnico-Operacional — 9 estratégias com payoff charts, exemplos com strikes e prêmios, e Greeks detalhados.
          </p>
        </div>

        {/* Tabela de Referência Rápida */}
        <Card className="border-primary/20 bg-card/80 backdrop-blur-sm overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg font-black tracking-tight">📊 Tabela de Referência Rápida</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b-2 border-primary/20 bg-primary/5">
                  <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-widest">Estratégia</th>
                  <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-widest">Direção</th>
                  <th className="px-3 py-2 text-center text-[10px] font-black uppercase tracking-widest">Vega</th>
                  <th className="px-3 py-2 text-center text-[10px] font-black uppercase tracking-widest">Theta</th>
                  <th className="px-3 py-2 text-center text-[10px] font-black uppercase tracking-widest">Delta</th>
                  <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-widest">Complexidade</th>
                  <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-widest">Risco Máx.</th>
                </tr>
              </thead>
              <tbody>
                {referenceTable.map((row, i) => (
                  <tr key={i} className={cn("border-b border-border/20", i % 2 === 0 ? 'bg-muted/20' : '')}>
                    <td className="px-3 py-2 font-bold">{row.name}</td>
                    <td className="px-3 py-2">{row.dir}</td>
                    <td className={cn("px-3 py-2 text-center font-bold", row.vega.includes('+') ? 'text-success' : row.vega.includes('–') ? 'text-destructive' : 'text-muted-foreground')}>{row.vega}</td>
                    <td className={cn("px-3 py-2 text-center font-bold", row.theta.includes('+') ? 'text-success' : row.theta.includes('–') ? 'text-destructive' : 'text-muted-foreground')}>{row.theta}</td>
                    <td className={cn("px-3 py-2 text-center font-bold", row.delta.includes('+') ? 'text-success' : row.delta.includes('–') ? 'text-destructive' : 'text-muted-foreground')}>{row.delta}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={cn("text-[10px]",
                        row.complexity === 'Baixa' ? 'border-success/30 text-success' :
                        row.complexity === 'Média' ? 'border-warning/30 text-warning' :
                        'border-destructive/30 text-destructive'
                      )}>{row.complexity}</Badge>
                    </td>
                    <td className="px-3 py-2 text-xs">{row.risk}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Estratégias */}
        <div className="space-y-6">
          {strategies.map(strategy => (
            <StrategyCard key={strategy.id} strategy={strategy} />
          ))}
        </div>

        {/* Disclaimer */}
        <Card className="border-warning/20 bg-warning/5">
          <CardContent className="py-4 text-center">
            <p className="text-xs text-muted-foreground font-medium">
              ⚠️ Este material é apenas educacional. Não constitui recomendação de investimento. Verifique com sua corretora antes de operar.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
