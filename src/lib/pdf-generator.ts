import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calculateMetrics, calculateCDIOpportunityCost } from './payoff';
import type { Leg, AnalysisMetrics } from './types';

// Helper to load an image URL as base64 data URL for jsPDF
const loadImageAsBase64 = (src: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas context unavailable')); return; }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
};

// Helper to add an image to PDF with proper aspect ratio
const addImageToPdf = (doc: jsPDF, dataUrl: string, y: number, maxWidth = 182, maxHeight = 110): { newY: number } => {
  const imageProps = doc.getImageProperties(dataUrl);
  const sourceWidth = Number(imageProps.width ?? 0);
  const sourceHeight = Number(imageProps.height ?? 0);

  if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight) || sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error('Não foi possível calcular o tamanho da imagem para o PDF.');
  }

  const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
  const w = sourceWidth * scale;
  const h = sourceHeight * scale;
  const x = (210 - w) / 2;
  const format = imageProps.fileType === 'PNG' ? 'PNG' : 'JPEG';

  // Shadow effect behind image
  doc.setFillColor(200, 200, 200);
  doc.roundedRect(x + 1.5, y + 1.5, w, h, 2, 2, 'F');
  // Border
  doc.setDrawColor(180, 190, 200);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 2, 2, 'S');
  doc.addImage(dataUrl, format, x, y, w, h);
  return { newY: y + h + 8 };
};

// Helper to call autoTable and return finalY + spacing
const addTable = (doc: jsPDF, options: any, spacing = 10): number => {
  autoTable(doc, options);
  return (doc as any).lastAutoTable.finalY + spacing;
};

const COLORS = {
  primary: [0, 163, 204] as [number, number, number],
  dark: [15, 23, 42] as [number, number, number],
  gray: [100, 116, 139] as [number, number, number],
  lightGray: [226, 232, 240] as [number, number, number],
  success: [34, 197, 94] as [number, number, number],
  destructive: [239, 68, 68] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  bg: [241, 245, 249] as [number, number, number],
  darkSlate: [30, 41, 59] as [number, number, number],
};

const TABLE_STYLES = {
  theme: 'grid' as const,
  headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: 'bold' as const, fontSize: 9 },
  bodyStyles: { fontSize: 8, textColor: COLORS.dark },
  alternateRowStyles: { fillColor: COLORS.bg },
  margin: { left: 14, right: 14 },
};

const addHeader = (doc: jsPDF, title: string) => {
  doc.setFillColor(...COLORS.dark);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.primary);
  doc.text('Opções PRO X', 14, 14);
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.white);
  doc.text(title, 14, 22);
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.lightGray);
  const date = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  doc.text(date, 196, 22, { align: 'right' });
};

const addFooter = (doc: jsPDF, pageNum: number, totalPages: number) => {
  const y = 290;
  doc.setDrawColor(...COLORS.lightGray);
  doc.line(14, y - 4, 196, y - 4);
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.gray);
  doc.text('Opções PRO X — Ferramenta de simulação. Não constitui recomendação de investimento.', 14, y);
  doc.text(`Página ${pageNum} de ${totalPages}`, 196, y, { align: 'right' });
};

const addSectionTitle = (doc: jsPDF, title: string, y: number): number => {
  doc.setFillColor(...COLORS.primary);
  doc.rect(14, y, 3, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...COLORS.dark);
  doc.text(title, 20, y + 6);
  return y + 14;
};

const addParagraph = (doc: jsPDF, text: string, y: number, maxWidth = 178): number => {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.gray);
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, 14, y);
  return y + lines.length * 4.5 + 4;
};

const checkPageBreak = (doc: jsPDF, y: number, needed: number = 30): number => {
  if (y + needed > 275) {
    doc.addPage();
    addHeader(doc, '');
    return 36;
  }
  return y;
};

const addAllFooters = (doc: jsPDF) => {
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages);
  }
};

const formatMetricValue = (val: number | string | 'Ilimitado'): string => {
  if (val === 'Ilimitado') return 'Ilimitado';
  const n = typeof val === 'string' ? parseFloat(val) : val;
  return `R$ ${n.toFixed(2)}`;
};

// ==================== FAQ MANUAL PDF ====================

export type PdfImageMap = Record<string, string>; // key → imported URL

const loadAllImages = async (urls: string[]): Promise<Record<string, string>> => {
  const map: Record<string, string> = {};
  await Promise.allSettled(
    urls.map(async (src) => {
      try {
        const b64 = await loadImageAsBase64(src);
        map[src] = b64;
      } catch { /* skip failed images */ }
    })
  );
  return map;
};

export const generateFAQPdf = async (images: PdfImageMap = {}) => {
  const doc = new jsPDF();

  // Pre-load all images from the imported URLs
  const urls = Object.values(images).filter(Boolean);
  const imageMap = await loadAllImages(urls);
  const getImg = (key: string) => images[key] ? imageMap[images[key]] : undefined;
  
  // ── CAPA ──
  doc.setFillColor(...COLORS.dark);
  doc.rect(0, 0, 210, 297, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(36);
  doc.setTextColor(...COLORS.primary);
  doc.text('Opções PRO X', 105, 80, { align: 'center' });
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.white);
  doc.text('Manual do Usuário', 105, 98, { align: 'center' });
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.lightGray);
  doc.text('Guia completo para dominar a plataforma', 105, 112, { align: 'center' });
  doc.text('Da simulação ao controle do portfólio', 105, 120, { align: 'center' });

  // Sumário na capa
  const tocItems = [
    '1. Visão Geral da Plataforma',
    '2. Criar uma Análise (OCR)',
    '3. Gráfico de Payoff e Métricas',
    '4. Comparação com CDI',
    '5. Análise de IA e Veredito de Saída',
    '6. Histórico de Operações',
    '7. Fluxo: Histórico > Portfólio',
    '8. Portfólio Consolidado',
    '9. Diversificador de Estratégias',
    '10. Dados ao Vivo (Tempo Real)',
    '11. Rastreador de Box',
    '12. Ticker Opções B3',
    '13. Rastreador de Collar',
    '14. Temas e Personalização',
    '15. Tabelas de Referência',
    '16. Perguntas Frequentes',
  ];
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.gray);
  doc.text('Sumário', 105, 148, { align: 'center' });
  doc.setFontSize(9);
  let tocY = 158;
  for (const item of tocItems) {
    doc.text(item, 105, tocY, { align: 'center' });
    tocY += 7;
  }

  const dateStr = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  doc.setFontSize(10);
  doc.text(`Versão: ${dateStr}`, 105, 270, { align: 'center' });

  // ── 1. VISÃO GERAL ──
  doc.addPage();
  addHeader(doc, 'Manual do Usuário');
  let y = 36;

  y = addSectionTitle(doc, '1. Visão Geral da Plataforma', y);
  y = addParagraph(doc, 'O Opções PRO X é uma ferramenta profissional de simulação e análise de estratégias com opções na B3. Ele permite montar estruturas, visualizar o gráfico de payoff, comparar com o CDI, receber análises de IA e gerenciar todo o ciclo de vida das suas operações — do estudo ao encerramento.', y);

  y = addTable(doc, {
    startY: y,
    head: [['Módulo', 'Descrição']],
    body: [
      ['Nova Análise', 'Monte estruturas de opções com OCR automático e gráfico de payoff'],
      ['Análise de IA', 'Avaliação inteligente de risco/retorno e sugestões de ajuste'],
      ['Comparação CDI', 'Compare o retorno da estratégia com a renda fixa'],
      ['Histórico', 'Centro de controle de todas as operações salvas'],
      ['Portfólio', 'Consolidação de operações encerradas com métricas'],
      ['Diversificador', 'Planejamento de alocação entre diferentes estratégias'],
      ['Dados ao Vivo', 'Preços em tempo real via integração com Profit Pro'],
      ['Rastreador de Box', 'Ranking dos melhores boxes da B3 em tempo real'],
    ],
    ...TABLE_STYLES,
  });

  // ── 2. CRIAR UMA ANÁLISE ──
  y = checkPageBreak(doc, y, 80);
  y = addSectionTitle(doc, '2. Criar uma Análise (OCR)', y);
  y = addParagraph(doc, 'A tela Nova Análise permite montar uma estrutura de opções em poucos cliques. Use o OCR para importar dados automaticamente de um print da sua corretora ou insira manualmente as pernas da operação.', y);

  const ocrImg = getImg('ocr');
  if (ocrImg) {
    y = checkPageBreak(doc, y, 140);
    ({ newY: y } = addImageToPdf(doc, ocrImg, y, 182, 120));
  }

  y = addTable(doc, {
    startY: y,
    head: [['Passo', 'Ação', 'Descrição']],
    body: [
      ['1', 'Upload da Imagem', 'Faça upload de um print da tela de opções da sua corretora. A IA extrai automaticamente os dados via OCR.'],
      ['2', 'Ajuste as Pernas', 'Revise lado (compra/venda), tipo (call/put/ação), strike, preço, quantidade e vencimento.'],
      ['3', 'Payoff e Métricas', 'O gráfico é gerado automaticamente com lucro/prejuízo, breakevens e custo líquido.'],
      ['4', 'Análise de IA', 'Solicite análise automática de risco/retorno e sugestões de ajuste.'],
      ['5', 'Salvar', 'Dê um nome descritivo e salve. A operação ficará no Histórico como "Ativa".'],
    ],
    ...TABLE_STYLES,
    columnStyles: { 0: { cellWidth: 12, halign: 'center' as const, fontStyle: 'bold' as const }, 1: { cellWidth: 38, fontStyle: 'bold' as const } },
  });

  // ── 3. GRÁFICO DE PAYOFF ──
  y = checkPageBreak(doc, y, 50);
  y = addSectionTitle(doc, '3. Gráfico de Payoff e Métricas', y);
  y = addParagraph(doc, 'O gráfico de payoff mostra visualmente o lucro ou prejuízo da sua estrutura para cada cenário de preço do ativo-objeto no vencimento. Use os botões VALOR e % ROI para alternar a visualização. A linha tracejada amarela representa o retorno do CDI.', y);

  const payoffImg = getImg('payoff');
  if (payoffImg) {
    y = checkPageBreak(doc, y, 140);
    ({ newY: y } = addImageToPdf(doc, payoffImg, y, 182, 120));
  }

  y = addTable(doc, {
    startY: y,
    head: [['Métrica', 'O que significa']],
    body: [
      ['Custo Líquido', 'Valor total investido (débito) ou recebido (crédito) na montagem'],
      ['Lucro Máximo', 'Ganho máximo possível no vencimento da estrutura'],
      ['Risco Máximo', 'Perda máxima possível no vencimento'],
      ['Breakeven', 'Preço do ativo onde o resultado é zero (ponto de equilíbrio)'],
      ['Eficiência vs CDI', 'Percentual do retorno comparado ao CDI no período'],
      ['Tipo de Estratégia', 'Nome da estratégia identificada automaticamente (trava, borboleta, etc.)'],
    ],
    ...TABLE_STYLES,
  });

  // ── 4. COMPARAÇÃO COM CDI ──
  y = checkPageBreak(doc, y, 50);
  y = addSectionTitle(doc, '4. Comparação com CDI', y);
  y = addParagraph(doc, 'Compare o retorno da sua estratégia com o CDI (Certificado de Depósito Interbancário), a taxa de referência para renda fixa no Brasil. Essa comparação ajuda a avaliar se o risco da operação com opções se justifica frente à renda fixa.', y);

  const cdiImg = getImg('cdi');
  if (cdiImg) {
    y = checkPageBreak(doc, y, 140);
    ({ newY: y } = addImageToPdf(doc, cdiImg, y, 182, 120));
  }

  y = addTable(doc, {
    startY: y,
    head: [['Campo', 'Descrição']],
    body: [
      ['Taxa CDI (% a.a.)', 'Taxa CDI anual utilizada no cálculo (configurável)'],
      ['Data de Vencimento', 'Data de expiração da estrutura para calcular dias úteis restantes'],
      ['Capital Investido', 'Valor total investido para calcular o retorno proporcional do CDI'],
      ['Eficiência CDI', 'Percentual que indica quanto a estratégia rende vs CDI. Ex: 220% = 2,2x mais'],
      ['IR CDI / IR Opções', 'Ative para incluir imposto de renda na comparação'],
      ['Retorno CDI (R$)', 'Valor que o capital renderia aplicado no CDI no mesmo período'],
    ],
    ...TABLE_STYLES,
    columnStyles: { 0: { cellWidth: 40, fontStyle: 'bold' as const } },
  });
  y = addParagraph(doc, 'Dica: Estratégias com risco limitado e eficiência CDI acima de 100% são consideradas atrativas, pois superam a renda fixa com risco controlado.', y);

  // ── 5. ANÁLISE DE IA ──
  y = checkPageBreak(doc, y, 50);
  y = addSectionTitle(doc, '5. Análise de IA e Veredito de Saída', y);
  y = addParagraph(doc, 'A IA avalia sua estrutura automaticamente, analisando risco/retorno, cenários favoráveis e desfavoráveis, e sugere ajustes. Para operações ativas, o Veredito de Saída recomenda se é hora de encerrar com base no P&L atual vs CDI e risco residual.', y);

  const aiImg = getImg('ai');
  if (aiImg) {
    y = checkPageBreak(doc, y, 140);
    ({ newY: y } = addImageToPdf(doc, aiImg, y, 182, 120));
  }

  const ai2Img = getImg('ai2');
  if (ai2Img) {
    y = checkPageBreak(doc, y, 140);
    ({ newY: y } = addImageToPdf(doc, ai2Img, y, 182, 120));
  }

  y = addTable(doc, {
    startY: y,
    head: [['Recurso de IA', 'Descrição']],
    body: [
      ['Análise da Estrutura', 'Avalia risco/retorno ao criar a operação e sugere ajustes'],
      ['Veredito de Saída', 'Analisa se é hora de encerrar a operação baseado em P&L e CDI'],
      ['Lucro Atual (PNL)', 'Resultado atual baseado nos preços de saída informados'],
      ['Custo Oportunidade', 'Quanto seu capital teria rendido no CDI no mesmo período'],
    ],
    ...TABLE_STYLES,
    columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold' as const } },
  });

  // ── 6. HISTÓRICO ──
  y = checkPageBreak(doc, y, 50);
  y = addSectionTitle(doc, '6. Histórico de Operações', y);
  y = addParagraph(doc, 'O Histórico é o centro de controle das suas análises. Todas as operações salvas aparecem organizadas por status (Ativas e Encerradas) com filtros por mês e ano.', y);

  const histImg = getImg('historico');
  if (histImg) {
    y = checkPageBreak(doc, y, 140);
    ({ newY: y } = addImageToPdf(doc, histImg, y, 182, 120));
  }

  y = addParagraph(doc, 'Operações Ativas: Podem ser editadas, encerradas ou deletadas. Operações Encerradas: Ficam registradas com a data de encerramento e podem ser reabertas.', y);

  // ── 7. FLUXO ──
  y = checkPageBreak(doc, y, 50);
  y = addSectionTitle(doc, '7. Fluxo: Histórico > Portfólio', y);

  y = addTable(doc, {
    startY: y,
    head: [['De', 'Para', 'Ação']],
    body: [
      ['Nova Análise', 'Histórico', 'Ao salvar, a operação vai para o Histórico como "Ativa"'],
      ['Histórico', 'Portfólio', 'Ao encerrar uma operação ativa, ela aparece no Portfólio'],
      ['Portfólio', 'Histórico', 'Você pode reabrir uma operação encerrada se precisar'],
    ],
    ...TABLE_STYLES,
  });
  y = addParagraph(doc, 'Como encerrar: Histórico > Localize a operação Ativa > Clique em "Encerrar" > Confirme > A operação muda para "Encerrada" e aparece no Portfólio.', y);

  // ── 8. PORTFÓLIO ──
  y = checkPageBreak(doc, y, 50);
  y = addSectionTitle(doc, '8. Portfólio Consolidado', y);
  y = addParagraph(doc, 'O Portfólio consolida todas as operações encerradas com métricas de desempenho: Resultado Total, Capital Alocado, Média por Operação, VS CDI, Taxa de Acerto e total de Estratégias Encerradas.', y);

  const portImg = getImg('portfolio');
  if (portImg) {
    y = checkPageBreak(doc, y, 140);
    ({ newY: y } = addImageToPdf(doc, portImg, y, 182, 120));
  }

  // ── 9. DIVERSIFICADOR ──
  y = checkPageBreak(doc, y, 50);
  y = addSectionTitle(doc, '9. Diversificador de Estratégias', y);
  y = addParagraph(doc, 'O módulo Diversificador permite criar planos de alocação para distribuir seu patrimônio entre diferentes estratégias de opções. Defina percentuais, nível de risco e alavancagem para cada estratégia.', y);

  const divImg = getImg('diversificador');
  if (divImg) {
    y = checkPageBreak(doc, y, 140);
    ({ newY: y } = addImageToPdf(doc, divImg, y, 182, 120));
  }

  // ── 10. TEMPO REAL ──
  y = checkPageBreak(doc, y, 50);
  y = addSectionTitle(doc, '10. Dados ao Vivo (Tempo Real)', y);
  y = addParagraph(doc, 'Conecte ao Profit Pro via RTD Bridge e acompanhe suas operações com preços ao vivo, P&L em tempo real e encerramento direto pelo app. Requer o módulo Bridge instalado no computador.', y);

  const rtImg = getImg('temporeal');
  if (rtImg) {
    y = checkPageBreak(doc, y, 140);
    ({ newY: y } = addImageToPdf(doc, rtImg, y, 182, 120));
  }

  // ── 11. RASTREADOR DE BOX ──
  y = checkPageBreak(doc, y, 50);
  y = addSectionTitle(doc, '11. Rastreador de Box', y);
  y = addParagraph(doc, 'Rastreie automaticamente os melhores boxes da B3 em tempo real. Ranking com classificação visual, percentual do CDI e instruções de montagem passo a passo para cada box identificado.', y);

  const boxImg = getImg('box');
  if (boxImg) {
    y = checkPageBreak(doc, y, 140);
    ({ newY: y } = addImageToPdf(doc, boxImg, y, 182, 120));
  }

  const boxTabelaImg = getImg('boxTabela');
  if (boxTabelaImg) {
    y = checkPageBreak(doc, y, 140);
    ({ newY: y } = addImageToPdf(doc, boxTabelaImg, y, 182, 120));
  }

  // ── 12. TICKER OPÇÕES B3 ──
  y = checkPageBreak(doc, y, 50);
  y = addSectionTitle(doc, '12. Ticker Opções B3 — Banco de Opções', y);
  y = addParagraph(doc, 'O módulo Ticker Opções B3 centraliza um banco de dados com mais de 99.000 opções listadas na B3. Pesquise por ticker, filtre por família, vencimento e tipo (Call/Put), identifique pares Call+Put automaticamente e envie tickers para Tempo Real ou Box Tracker.', y);

  const tickerImg = getImg('tickerOpcoes');
  if (tickerImg) {
    y = checkPageBreak(doc, y, 140);
    ({ newY: y } = addImageToPdf(doc, tickerImg, y, 182, 120));
  }

  const tickerBuscaImg = getImg('tickerOpcoesBusca');
  if (tickerBuscaImg) {
    y = checkPageBreak(doc, y, 140);
    ({ newY: y } = addImageToPdf(doc, tickerBuscaImg, y, 182, 120));
  }

  const tickerTabelaImg = getImg('tickerOpcoesTabela');
  if (tickerTabelaImg) {
    y = checkPageBreak(doc, y, 140);
    ({ newY: y } = addImageToPdf(doc, tickerTabelaImg, y, 182, 120));
  }

  y = addTable(doc, {
    startY: y,
    head: [['Recurso', 'Descrição']],
    body: [
      ['Busca Inteligente', 'Hierarquia de precisão: Exata > Inicia com > Contém'],
      ['Pares Call+Put', 'Identificação automática com badge PAR para Box/Straddle'],
      ['Filtros de Strike', 'Sliders de distância percentual acima/abaixo do preço base'],
      ['Integração', 'Envie tickers selecionados para Tempo Real ou Box Tracker'],
      ['Oportunidades de Box', 'Detecção automática de oportunidades com cálculo BID/ASK'],
    ],
    ...TABLE_STYLES,
    columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold' as const } },
  });

  // ── 13. RASTREADOR DE COLLAR ──
  y = checkPageBreak(doc, y, 50);
  y = addSectionTitle(doc, '13. Rastreador de Collar', y);
  y = addParagraph(doc, 'O Rastreador de Collar monitora combinações de proteção de carteira (Ação + Put comprada + Call vendida) em tempo real. Calcula custo de proteção, piso (floor), teto (cap) e identifica collars de custo zero.', y);

  y = addTable(doc, {
    startY: y,
    head: [['Métrica', 'Descrição']],
    body: [
      ['Floor (Piso)', 'Perda máxima limitada pelo strike da put de proteção'],
      ['Cap (Teto)', 'Ganho máximo limitado pelo strike da call vendida'],
      ['Custo Líquido', 'Prêmio da put - Prêmio da call (idealmente zero)'],
      ['Rentabilidade', 'Retorno máximo comparado ao CDI do período'],
    ],
    ...TABLE_STYLES,
    columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold' as const } },
  });

  // ── 14. TEMAS ──
  y = checkPageBreak(doc, y, 50);
  y = addSectionTitle(doc, '14. Temas e Personalização', y);
  y = addParagraph(doc, 'Escolha entre tema claro e escuro, com paleta de cores profissional otimizada para diferentes condições de luminosidade. As configurações ficam salvas no seu perfil.', y);

  const temasImg = getImg('temasCores');
  if (temasImg) {
    y = checkPageBreak(doc, y, 140);
    ({ newY: y } = addImageToPdf(doc, temasImg, y, 182, 120));
  }

  // ── 15. TABELAS DE REFERÊNCIA ──
  y = checkPageBreak(doc, y, 50);
  y = addSectionTitle(doc, '15. Tabelas de Referência', y);
  y = addParagraph(doc, 'Referência rápida com tabelas detalhadas de funcionalidades, atalhos de teclado e parâmetros do sistema.', y);

  const manualTabelaImg = getImg('manualTabela');
  if (manualTabelaImg) {
    y = checkPageBreak(doc, y, 140);
    ({ newY: y } = addImageToPdf(doc, manualTabelaImg, y, 182, 120));
  }

  const manualGraficoImg = getImg('manualGrafico');
  if (manualGraficoImg) {
    y = checkPageBreak(doc, y, 140);
    ({ newY: y } = addImageToPdf(doc, manualGraficoImg, y, 182, 120));
  }

  const tomadaImg = getImg('tomadaDecisao');
  if (tomadaImg) {
    y = checkPageBreak(doc, y, 140);
    ({ newY: y } = addImageToPdf(doc, tomadaImg, y, 182, 120));
  }

  // ── 16. PERGUNTAS FREQUENTES ──
  y = checkPageBreak(doc, y, 80);
  y = addSectionTitle(doc, '16. Perguntas Frequentes', y);

  y = addTable(doc, {
    startY: y,
    head: [['Pergunta', 'Resposta']],
    body: [
      ['Preciso ter conta em corretora?', 'O Opções PRO X é uma ferramenta de simulação. Corretora é necessária apenas para operações reais.'],
      ['Como funciona o OCR?', 'Faça um print da tela de opções da sua corretora e faça upload. A IA extrai os dados automaticamente.'],
      ['O que é Eficiência CDI?', 'Indica quanto a estratégia rende vs CDI. Ex: 220% = 2,2x mais que o CDI.'],
      ['Posso reabrir operação encerrada?', 'Sim. Na aba Histórico, operações encerradas possuem o botão "Reabrir".'],
      ['É recomendação de investimento?', 'Não. É uma ferramenta de simulação. Consulte um profissional antes de operar.'],
      ['Como a IA funciona?', 'Utiliza IA (OpenAI) para avaliar risco/retorno e sugerir ajustes na estrutura.'],
      ['Diferença Free vs PRO?', 'Free: acesso básico com limites. PRO: simulações ilimitadas e todos os recursos.'],
    ],
    ...TABLE_STYLES,
    columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold' as const } },
  });

  addAllFooters(doc);
  doc.save('OpçõesPROX_Manual.pdf');
};

// ==================== HISTORY PDF ====================
interface HistoryAnalysis {
  id: string;
  name: string;
  underlying_asset: string | null;
  status: string;
  created_at: string;
  closed_at: string | null;
  expiry_date: string | null;
  days_to_expiry: number | null;
  cdi_rate?: number | null;
}

interface LegData {
  asset: string;
  option_type: string;
  side: string;
  strike: number;
  price: number;
  quantity: number;
  expiry_date: string | null;
}

export const generateHistoryPdf = async (
  analyses: HistoryAnalysis[], 
  fetchLegs: (analysisId: string) => Promise<LegData[]>
) => {
  const doc = new jsPDF();
  addHeader(doc, 'Relatório de Estruturas — Histórico');
  let y = 36;

  y = addSectionTitle(doc, 'Estruturas de Opções', y);
  y = addParagraph(doc, `Relatório gerado em ${new Date().toLocaleDateString('pt-BR')} com ${analyses.length} operação(ões).`, y);

  for (let i = 0; i < analyses.length; i++) {
    const a = analyses[i];
    y = checkPageBreak(doc, y, 80);

    // Operation header
    doc.setFillColor(...COLORS.bg);
    doc.roundedRect(14, y, 182, 16, 2, 2, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.dark);
    doc.text(a.name, 18, y + 6);

    doc.setFontSize(8);
    const statusText = a.status === 'active' ? 'ATIVA' : 'ENCERRADA';
    const statusColor = a.status === 'active' ? COLORS.success : COLORS.gray;
    doc.setTextColor(...statusColor);
    doc.text(statusText, 18, y + 13);

    doc.setTextColor(...COLORS.gray);
    const infoText = [
      a.underlying_asset ? `Ativo: ${a.underlying_asset}` : '',
      `Criada: ${new Date(a.created_at).toLocaleDateString('pt-BR')}`,
      a.expiry_date ? `Venc: ${(() => { const [yr, m, d] = a.expiry_date.split('-').map(Number); return new Date(yr, m-1, d).toLocaleDateString('pt-BR'); })()}` : '',
      a.closed_at ? `Encerrada: ${new Date(a.closed_at).toLocaleDateString('pt-BR')}` : '',
    ].filter(Boolean).join('  |  ');
    doc.text(infoText, 192, y + 6, { align: 'right' });

    y += 20;

    // Fetch legs and calculate metrics
    try {
      const legs = await fetchLegs(a.id);
      if (legs.length > 0) {
        // Calculate metrics from legs
        const typedLegs: Leg[] = legs.map(l => ({
          side: l.side as 'buy' | 'sell',
          option_type: l.option_type as 'call' | 'put' | 'stock',
          asset: l.asset,
          strike: l.strike,
          price: l.price,
          quantity: l.quantity,
          expiry_date: l.expiry_date || undefined,
        }));

        const metrics = calculateMetrics(typedLegs);
        const cdiRate = a.cdi_rate || 15;
        const daysToExpiry = a.days_to_expiry || 0;
        const investedCapital = Math.max(Math.abs(metrics.montageTotal || metrics.netCost || 0), 1);
        const cdiReturn = daysToExpiry > 0 ? calculateCDIOpportunityCost(investedCapital, cdiRate, daysToExpiry) : 0;
        const cdiEfficiency = cdiReturn > 0 && typeof metrics.maxGain === 'number' ? Math.round((metrics.maxGain / cdiReturn) * 100) : null;

        // Metrics table
        y = addTable(doc, {
          startY: y,
          head: [['Métrica', 'Valor']],
          body: [
            ['Estratégia', metrics.strategyLabel || 'Personalizada'],
            ['Custo da Montagem / PM', formatMetricValue(Math.abs(metrics.montageTotal || metrics.netCost))],
            ['Lucro Máximo', formatMetricValue(metrics.maxGain)],
            ['Risco Máximo', metrics.isRiskFree ? 'R$ 0,00 (Risco Zero)' : formatMetricValue(metrics.maxLoss)],
            ['Breakeven(s)', metrics.breakevens.length > 0 ? metrics.breakevens.map(b => `R$ ${b.toFixed(2)}`).join(' / ') : '—'],
            ['Dias Úteis (DU)', daysToExpiry > 0 ? `${daysToExpiry} du` : '—'],
            ['Retorno CDI no Período', cdiReturn > 0 ? `R$ ${cdiReturn.toFixed(2)}` : '—'],
            ['Eficiência vs CDI', cdiEfficiency != null ? `${cdiEfficiency}%` : '—'],
            ['Lucro Acima do CDI (R$)', cdiReturn > 0 && typeof metrics.maxGain === 'number' ? `R$ ${(metrics.maxGain - cdiReturn).toFixed(2)}` : '—'],
          ],
          theme: 'grid',
          headStyles: { fillColor: COLORS.darkSlate, textColor: COLORS.white, fontStyle: 'bold' as const, fontSize: 8 },
          bodyStyles: { fontSize: 8, textColor: COLORS.dark },
          alternateRowStyles: { fillColor: COLORS.bg },
          columnStyles: { 0: { fontStyle: 'bold' as const, cellWidth: 50 } },
          margin: { left: 14, right: 14 },
          didParseCell: (data: any) => {
            if (data.section === 'body') {
              const label = data.row.cells[0]?.raw;
              const val = data.row.cells[1]?.raw;
              if (data.column.index === 1) {
                if (label === 'Lucro Máximo' && val !== '—' && val !== 'Ilimitado') {
                  const n = parseFloat(val.replace('R$ ', ''));
                  if (n > 0) data.cell.styles.textColor = COLORS.success;
                }
                if (label === 'Risco Máximo' && !val.includes('Risco Zero')) {
                  data.cell.styles.textColor = COLORS.destructive;
                }
                if (label === 'Risco Máximo' && val.includes('Risco Zero')) {
                  data.cell.styles.textColor = COLORS.success;
                }
                if (label === 'Eficiência vs CDI') {
                  const n = parseFloat(val);
                  if (n > 100) data.cell.styles.textColor = COLORS.success;
                }
              }
            }
          },
        }, 6);

        // Legs table
        y = checkPageBreak(doc, y, 30);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.gray);
        doc.text('Pernas da Estrutura:', 14, y);
        y += 4;

        y = addTable(doc, {
          startY: y,
          head: [['Ativo', 'Tipo', 'Lado', 'Strike', 'Preço', 'Qtd', 'Vencimento']],
          body: legs.map(l => [
            l.asset,
            l.option_type.toUpperCase(),
            l.side === 'buy' ? 'COMPRA' : 'VENDA',
            `R$ ${l.strike.toFixed(2)}`,
            `R$ ${l.price.toFixed(2)}`,
            l.quantity.toString(),
            l.expiry_date ? (() => { const [yr, m, d] = l.expiry_date.split('-').map(Number); return new Date(yr, m-1, d).toLocaleDateString('pt-BR'); })() : '-',
          ]),
          theme: 'grid',
          headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: 'bold' as const, fontSize: 8 },
          bodyStyles: { fontSize: 8, textColor: COLORS.dark },
          alternateRowStyles: { fillColor: COLORS.bg },
          margin: { left: 14, right: 14 },
        });
      } else {
        y = addParagraph(doc, 'Nenhuma perna registrada.', y);
      }
    } catch {
      y = addParagraph(doc, 'Erro ao carregar pernas da operação.', y);
    }

    // Separator line between operations
    if (i < analyses.length - 1) {
      y = checkPageBreak(doc, y, 10);
      doc.setDrawColor(...COLORS.lightGray);
      doc.line(14, y, 196, y);
      y += 8;
    }
  }

  addAllFooters(doc);
  doc.save('OpçõesPROX_Histórico.pdf');
};

// ==================== PORTFOLIO PDF ====================
interface PortfolioAnalysis {
  id: string;
  name: string;
  underlying_asset: string | null;
  created_at: string;
  closed_at: string | null;
  cdi_rate: number | null;
}

interface PortfolioLeg {
  side: string;
  price: number;
  current_price: number | null;
  quantity: number;
  option_type: string;
  asset?: string;
  strike?: number;
}

export const generatePortfolioPdf = (
  analyses: PortfolioAnalysis[],
  legsMap: Record<string, PortfolioLeg[]>,
  stats: {
    totalPL: number;
    totalInvested: number;
    avgPL: number;
    winRate: number;
    wins: number;
    losses: number;
  }
) => {
  const doc = new jsPDF();
  addHeader(doc, 'Relatório do Portfólio — Operações Encerradas');
  let y = 36;

  y = addSectionTitle(doc, 'Resumo do Portfólio', y);

  y = addTable(doc, {
    startY: y,
    head: [['Métrica', 'Valor']],
    body: [
      ['Resultado Total', `R$ ${stats.totalPL.toFixed(2)}`],
      ['Capital Total Alocado', `R$ ${stats.totalInvested.toFixed(2)}`],
      ['Lucro Médio por Operação', `R$ ${stats.avgPL.toFixed(2)}`],
      ['Taxa de Acerto', `${stats.winRate.toFixed(1)}%`],
      ['Operações W/L', `${stats.wins}W / ${stats.losses}L`],
      ['Total de Operações', analyses.length.toString()],
    ],
    ...TABLE_STYLES,
    columnStyles: { 0: { fontStyle: 'bold' as const, cellWidth: 60 } },
  });

  y = checkPageBreak(doc, y, 40);
  y = addSectionTitle(doc, 'Detalhamento por Operação', y);

  const rows = analyses.map(a => {
    const legs = legsMap[a.id] || [];
    const pnl = legs.reduce((total, leg) => {
      const exitPrice = leg.current_price != null ? leg.current_price : leg.price;
      const mult = leg.side === 'buy' ? 1 : -1;
      return total + mult * (exitPrice - leg.price) * leg.quantity;
    }, 0);
    const invested = legs.reduce((acc, leg) => {
      const mult = leg.side === 'buy' ? -1 : 1;
      return acc + mult * leg.price * leg.quantity;
    }, 0);
    const roi = invested !== 0 ? (pnl / Math.abs(invested)) * 100 : 0;

    return [
      a.name,
      a.underlying_asset || '-',
      new Date(a.created_at).toLocaleDateString('pt-BR'),
      a.closed_at ? new Date(a.closed_at).toLocaleDateString('pt-BR') : '-',
      `R$ ${Math.abs(invested).toFixed(2)}`,
      `R$ ${pnl.toFixed(2)}`,
      `${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%`,
    ];
  });

  y = addTable(doc, {
    startY: y,
    head: [['Nome', 'Ativo', 'Entrada', 'Saída', 'Investido', 'Resultado', 'ROI']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: 'bold' as const, fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: COLORS.dark },
    alternateRowStyles: { fillColor: COLORS.bg },
    margin: { left: 14, right: 14 },
    didParseCell: (data: any) => {
      if (data.section === 'body' && data.column.index === 5) {
        const val = parseFloat(data.cell.raw.replace('R$ ', ''));
        data.cell.styles.textColor = val >= 0 ? COLORS.success : COLORS.destructive;
        data.cell.styles.fontStyle = 'bold';
      }
      if (data.section === 'body' && data.column.index === 6) {
        const val = parseFloat(data.cell.raw);
        data.cell.styles.textColor = val >= 0 ? COLORS.success : COLORS.destructive;
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  // Legs detail per operation
  for (const a of analyses) {
    const legs = legsMap[a.id] || [];
    if (legs.length === 0) continue;

    y = checkPageBreak(doc, y, 40);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.dark);
    doc.text(`Pernas — ${a.name}`, 14, y);
    y += 4;

    y = addTable(doc, {
      startY: y,
      head: [['Tipo', 'Lado', 'Preço Entrada', 'Preço Saída', 'Qtd', 'P&L']],
      body: legs.map(l => {
        const exitPrice = l.current_price != null ? l.current_price : l.price;
        const mult = l.side === 'buy' ? 1 : -1;
        const pnl = mult * (exitPrice - l.price) * l.quantity;
        return [
          l.option_type.toUpperCase(),
          l.side === 'buy' ? 'COMPRA' : 'VENDA',
          `R$ ${l.price.toFixed(2)}`,
          `R$ ${exitPrice.toFixed(2)}`,
          l.quantity.toString(),
          `R$ ${pnl.toFixed(2)}`,
        ];
      }),
      theme: 'grid',
      headStyles: { fillColor: COLORS.darkSlate, textColor: COLORS.white, fontStyle: 'bold' as const, fontSize: 7 },
      bodyStyles: { fontSize: 7, textColor: COLORS.dark },
      alternateRowStyles: { fillColor: COLORS.bg },
      margin: { left: 14, right: 14 },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 5) {
          const val = parseFloat(data.cell.raw.replace('R$ ', ''));
          data.cell.styles.textColor = val >= 0 ? COLORS.success : COLORS.destructive;
        }
      },
    });
  }

  addAllFooters(doc);
  doc.save('OpçõesPROX_Portfólio.pdf');
};

// ==================== DASHBOARD / ANALYSIS PDF ====================

export const generateAnalysisPdf = (
  name: string,
  legs: Leg[],
  metrics: AnalysisMetrics,
  options?: {
    cdiRate?: number;
    daysToExpiry?: number;
    aiSuggestion?: string;
  }
) => {
  const doc = new jsPDF();
  addHeader(doc, 'Relatório de Análise — Simulação');
  let y = 36;

  y = addSectionTitle(doc, name || 'Análise', y);
  y = addParagraph(doc, `Relatório gerado em ${new Date().toLocaleDateString('pt-BR')}`, y);

  const cdiRate = options?.cdiRate || 15;
  const daysToExpiry = options?.daysToExpiry || 0;
  const investedCapital = Math.max(Math.abs(metrics.montageTotal || metrics.netCost || 0), 1);
  const cdiReturn = daysToExpiry > 0 ? calculateCDIOpportunityCost(investedCapital, cdiRate, daysToExpiry) : 0;
  const cdiEfficiency = cdiReturn > 0 && typeof metrics.maxGain === 'number' ? Math.round((metrics.maxGain / cdiReturn) * 100) : null;

  // Metrics table
  y = addTable(doc, {
    startY: y,
    head: [['Métrica', 'Valor']],
    body: [
      ['Estratégia', metrics.strategyLabel || 'Personalizada'],
      ['Custo da Montagem / PM', formatMetricValue(Math.abs(metrics.montageTotal || metrics.netCost))],
      ['Lucro Máximo', formatMetricValue(metrics.maxGain)],
      ['Risco Máximo', metrics.isRiskFree ? 'R$ 0,00 (Risco Zero)' : formatMetricValue(metrics.maxLoss)],
      ['Breakeven(s)', metrics.breakevens.length > 0 ? metrics.breakevens.map(b => `R$ ${b.toFixed(2)}`).join(' / ') : '—'],
      ['Dias Úteis (DU)', daysToExpiry > 0 ? `${daysToExpiry} du` : '—'],
      ['Retorno CDI no Período', cdiReturn > 0 ? `R$ ${cdiReturn.toFixed(2)}` : '—'],
      ['Eficiência vs CDI', cdiEfficiency != null ? `${cdiEfficiency}%` : '—'],
    ],
    ...TABLE_STYLES,
    columnStyles: { 0: { fontStyle: 'bold' as const, cellWidth: 50 } },
    didParseCell: (data: any) => {
      if (data.section === 'body' && data.column.index === 1) {
        const label = data.row.cells[0]?.raw;
        const val = data.row.cells[1]?.raw;
        if (label === 'Lucro Máximo' && val !== '—' && val !== 'Ilimitado') {
          const n = parseFloat(val.replace('R$ ', ''));
          if (n > 0) data.cell.styles.textColor = COLORS.success;
        }
        if (label === 'Risco Máximo' && !val.includes('Risco Zero')) {
          data.cell.styles.textColor = COLORS.destructive;
        }
        if (label === 'Risco Máximo' && val.includes('Risco Zero')) {
          data.cell.styles.textColor = COLORS.success;
        }
      }
    },
  });

  // Legs table
  y = checkPageBreak(doc, y, 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.dark);
  doc.text('Pernas da Estrutura', 14, y);
  y += 5;

  y = addTable(doc, {
    startY: y,
    head: [['Ativo', 'Tipo', 'Lado', 'Strike', 'Preço', 'Qtd', 'Vencimento']],
    body: legs.map(l => [
      l.asset,
      l.option_type.toUpperCase(),
      l.side === 'buy' ? 'COMPRA' : 'VENDA',
      `R$ ${l.strike.toFixed(2)}`,
      `R$ ${l.price.toFixed(2)}`,
      l.quantity.toString(),
      l.expiry_date ? (() => { const [yr, m, d] = l.expiry_date.split('-').map(Number); return new Date(yr, m-1, d).toLocaleDateString('pt-BR'); })() : '-',
    ]),
    ...TABLE_STYLES,
  });

  // AI suggestion
  if (options?.aiSuggestion) {
    y = checkPageBreak(doc, y, 40);
    y = addSectionTitle(doc, 'Análise da IA', y);
    try {
      const ai = typeof options.aiSuggestion === 'string' ? JSON.parse(options.aiSuggestion) : options.aiSuggestion;
      if (ai.summary) y = addParagraph(doc, ai.summary, y);
    } catch {
      y = addParagraph(doc, options.aiSuggestion, y);
    }
  }

  addAllFooters(doc);
  doc.save(`OpçõesPROX_${name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
};

// ==================== LANDING PAGE PDF ====================

const LANDING_FEATURES: { key: string; title: string; desc: string; extraKeys?: string[] }[] = [
  { key: 'analysis', title: 'Dashboard de Análise + OCR', desc: 'Visão completa da estrutura com P&L em tempo real, métricas e gráfico de payoff. Tire um print da corretora e a IA lê strikes, prêmios e quantidades em 2 segundos.' },
  { key: 'ai', title: 'Análise com IA', desc: 'Relatório quantitativo com nota de atratividade, risco, cenários e sugestões.', extraKeys: ['ai2'] },
  { key: 'payoff', title: 'Gráfico de Payoff', desc: 'Visualize lucro máximo, risco máximo, breakeven e métricas em tempo real.' },
  { key: 'cdi', title: 'Comparativo CDI', desc: 'Compare sua estratégia contra o CDI e saiba se o risco vale a pena.' },
  { key: 'realtime', title: 'Tempo Real - AO VIVO', desc: 'Conecte ao Profit Pro via RTD Bridge e acompanhe operações com preços ao vivo.' },
  { key: 'portfolio', title: 'Portfolio P&L', desc: 'Acompanhe P&L consolidado, ROI total e taxa de acerto das suas operações.' },
  { key: 'diversificador', title: 'Diversificador', desc: 'Gerencie a alocação do seu patrimônio entre estratégias com balanceamento automático.' },
  { key: 'box', title: 'Rastreador de Box - AO VIVO', desc: 'Rastreie os melhores boxes da B3 em tempo real. Ranking com troféus e % do CDI.', extraKeys: ['boxTabela'] },
  { key: 'calcCdi', title: 'Calculadora CDI × Opções', desc: 'Compare o rendimento de qualquer estratégia com a renda fixa.' },
  { key: 'temasCores', title: 'Temas e Personalização', desc: 'Escolha entre tema claro e escuro, com paleta profissional para qualquer condição.' },
  { key: 'tomadaDecisao', title: 'Tomada de Decisão com IA', desc: 'Use o veredito da IA para decidir quando manter ou encerrar uma operação.' },
  { key: 'manualTabela', title: 'Manual & Referência', desc: 'Tabelas detalhadas de funcionalidades, atalhos e parâmetros do sistema.', extraKeys: ['manualGrafico'] },
];

export const generateLandingPagePdf = async (images: PdfImageMap = {}) => {
  const doc = new jsPDF();

  // Pre-load all images from imported URLs
  const urls = Object.values(images).filter(Boolean);
  const imageMap = await loadAllImages(urls);

  // ===== COVER PAGE =====
  doc.setFillColor(...COLORS.dark);
  doc.rect(0, 0, 210, 297, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(42);
  doc.setTextColor(...COLORS.primary);
  doc.text('Opções PRO X', 105, 80, { align: 'center' });

  doc.setFontSize(20);
  doc.setTextColor(...COLORS.white);
  doc.text('Análise de Opções com IA', 105, 100, { align: 'center' });

  doc.setFontSize(14);
  doc.setTextColor(...COLORS.lightGray);
  doc.text('Único no Brasil', 105, 115, { align: 'center' });

  doc.setFontSize(12);
  doc.setTextColor(...COLORS.gray);
  doc.text('Tire um print da sua estrutura na corretora e receba', 105, 145, { align: 'center' });
  doc.text('payoff, métricas e análise de IA em segundos.', 105, 157, { align: 'center' });

  doc.setFontSize(16);
  doc.setTextColor(...COLORS.primary);
  doc.text('www.opcoesprox.com.br', 105, 185, { align: 'center' });

  const date = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.gray);
  doc.text(`Catálogo de Produto — ${date}`, 105, 250, { align: 'center' });

  // ===== COMO FUNCIONA =====
  doc.addPage();
  addHeader(doc, 'Catálogo de Produto');
  let y = 36;

  y = addSectionTitle(doc, 'Como Funciona — 3 Passos', y);
  y = addTable(doc, {
    startY: y,
    head: [['Passo', 'Ação', 'Descrição']],
    body: [
      ['1', 'Tire um Print', 'Capture a tela da sua estrutura no Profit, FlexScan ou Home Broker.'],
      ['2', 'IA Analisa', 'Nossa IA lê strikes, prêmios e quantidades e monta a estrutura automaticamente.'],
      ['3', 'Veja o Resultado', 'Payoff, métricas, comparativo CDI e relatório com sugestões da IA.'],
    ],
    ...TABLE_STYLES,
    columnStyles: { 0: { cellWidth: 15, halign: 'center' as const, fontStyle: 'bold' as const }, 1: { cellWidth: 35, fontStyle: 'bold' as const } },
  });

  // ===== FEATURES PAGES (one per feature with screenshot) =====
  for (const item of LANDING_FEATURES) {
    doc.addPage();
    addHeader(doc, 'Catálogo de Produto');
    y = 36;

    // Feature title with accent bar
    doc.setFillColor(...COLORS.primary);
    doc.roundedRect(14, y, 182, 20, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...COLORS.white);
    doc.text(item.title, 105, y + 13, { align: 'center' });
    y += 26;

    // Description
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.gray);
    const descLines = doc.splitTextToSize(item.desc, 178);
    doc.text(descLines, 14, y);
    y += descLines.length * 5 + 6;

    // Main screenshot — large
    const imgUrl = images[item.key];
    const imgData = imgUrl ? imageMap[imgUrl] : undefined;
    if (imgData) {
      ({ newY: y } = addImageToPdf(doc, imgData, y, 184, 160));
    }

    // Extra images on a new page if needed
    if (item.extraKeys) {
      for (const extraKey of item.extraKeys) {
        const extraUrl = images[extraKey];
        const extraData = extraUrl ? imageMap[extraUrl] : undefined;
        if (extraData) {
          doc.addPage();
          addHeader(doc, 'Catálogo de Produto');
          y = 36;
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(9);
          doc.setTextColor(...COLORS.gray);
          doc.text(`${item.title} — continuação`, 14, y);
          y += 8;
          ({ newY: y } = addImageToPdf(doc, extraData, y, 184, 180));
        }
      }
    }
  }
  doc.addPage();
  addHeader(doc, 'Catálogo de Produto');
  y = 36;

  y = addSectionTitle(doc, 'Opções PRO X vs. Planilhas', y);
  y = addTable(doc, {
    startY: y,
    head: [['', 'Planilhas', 'Opções PRO X']],
    body: [
      ['Entrada de dados', 'Manual, lenta', 'OCR: Print → dados em 2s'],
      ['Fórmulas', 'Quebram e exigem manutenção', 'Automático e preciso'],
      ['CDI', 'Sem comparativo real', 'Eficiência vs CDI integrada'],
      ['Mobile', 'Impossível no celular', 'Mobile-First, use no pregão'],
      ['IA', 'Inexistente', 'Análise e sugestões da IA'],
      ['Tempo Real', 'Manual', 'RTD Bridge com Profit Pro'],
    ],
    ...TABLE_STYLES,
    columnStyles: { 0: { fontStyle: 'bold' as const, cellWidth: 35 } },
  });

  // (Tabela de planos removida - foco no catálogo de funcionalidades)

  // ===== CTA =====
  y = checkPageBreak(doc, y, 60);
  doc.setFillColor(...COLORS.primary);
  doc.roundedRect(14, y, 182, 40, 4, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.white);
  doc.text('Teste 7 Dias Grátis!', 105, y + 16, { align: 'center' });
  doc.setFontSize(12);
  doc.text('www.opcoesprox.com.br', 105, y + 30, { align: 'center' });

  addAllFooters(doc);
  doc.save('OpçõesPROX_Catalogo.pdf');
};
