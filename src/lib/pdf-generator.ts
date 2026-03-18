import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper to call autoTable and return finalY
const addTable = (doc: jsPDF, options: any): number => {
  autoTable(doc, options);
  return (doc as any).lastAutoTable.finalY;
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

const addHeader = (doc: jsPDF, title: string) => {
  // Background bar
  doc.setFillColor(...COLORS.dark);
  doc.rect(0, 0, 210, 28, 'F');

  // Logo text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.primary);
  doc.text('Opções PRO X', 14, 14);

  // Title
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.white);
  doc.text(title, 14, 22);

  // Date
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

// ==================== FAQ MANUAL PDF ====================
export const generateFAQPdf = () => {
  const doc = new jsPDF();
  
  // Cover page
  doc.setFillColor(...COLORS.dark);
  doc.rect(0, 0, 210, 297, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(36);
  doc.setTextColor(...COLORS.primary);
  doc.text('Opções PRO X', 105, 90, { align: 'center' });

  doc.setFontSize(18);
  doc.setTextColor(...COLORS.white);
  doc.text('Manual do Usuário', 105, 108, { align: 'center' });

  doc.setFontSize(11);
  doc.setTextColor(...COLORS.lightGray);
  doc.text('Guia completo para dominar a plataforma', 105, 120, { align: 'center' });
  doc.text('Da simulação ao controle do portfólio', 105, 128, { align: 'center' });

  const date = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.gray);
  doc.text(`Versão: ${date}`, 105, 200, { align: 'center' });

  // Page 2 - What is
  doc.addPage();
  addHeader(doc, 'Manual do Usuário');
  let y = 36;

  y = addSectionTitle(doc, '1. O que é o Opções PRO X?', y);
  y = addParagraph(doc, 'O Opções PRO X é uma ferramenta profissional de simulação e análise de estratégias com opções na B3. Ele permite montar estruturas, visualizar o gráfico de payoff, comparar com o CDI, receber análises de IA e gerenciar todo o ciclo de vida das suas operações — do estudo ao encerramento.', y);

  y += 4;
  doc.autoTable({
    startY: y,
    head: [['Recurso', 'Descrição']],
    body: [
      ['Simulação', 'Monte e analise estruturas de opções com gráfico de payoff'],
      ['IA Integrada', 'Análise inteligente automática da estrutura montada'],
      ['Comparação CDI', 'Compare o retorno da estratégia com a renda fixa'],
      ['Portfólio', 'Controle de operações encerradas com métricas consolidadas'],
      ['Diversificador', 'Planejamento de alocação entre diferentes estratégias'],
    ],
    theme: 'grid',
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8, textColor: COLORS.dark },
    alternateRowStyles: { fillColor: COLORS.bg },
    margin: { left: 14, right: 14 },
  });
  y = doc.lastAutoTable.finalY + 10;

  // How to create analysis
  y = checkPageBreak(doc, y, 80);
  y = addSectionTitle(doc, '2. Como Criar uma Análise', y);

  const steps = [
    ['1', 'Upload da Imagem (OCR)', 'Faça upload de um print da tela de opções da sua corretora. A IA irá extrair automaticamente os dados das opções via OCR.'],
    ['2', 'Ajuste as Pernas', 'Revise e ajuste as pernas da operação: lado (compra/venda), tipo (call/put/ação), strike, preço, quantidade e vencimento.'],
    ['3', 'Visualize Payoff e Métricas', 'O gráfico de payoff mostra lucro/prejuízo em cada cenário. Métricas: ganho máximo, perda máxima, breakevens e custo líquido.'],
    ['4', 'Solicite Análise de IA', 'A IA avalia risco/retorno, cenários favoráveis/desfavoráveis e sugere ajustes na estrutura.'],
    ['5', 'Salve a Análise', 'Dê um nome descritivo e salve. A operação ficará no Histórico como "Ativa".'],
  ];

  doc.autoTable({
    startY: y,
    head: [['Passo', 'Ação', 'Descrição']],
    body: steps,
    theme: 'grid',
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8, textColor: COLORS.dark },
    alternateRowStyles: { fillColor: COLORS.bg },
    columnStyles: { 0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' }, 1: { cellWidth: 40, fontStyle: 'bold' } },
    margin: { left: 14, right: 14 },
  });
  y = doc.lastAutoTable.finalY + 10;

  // Payoff
  y = checkPageBreak(doc, y, 50);
  y = addSectionTitle(doc, '3. Gráfico de Payoff & Métricas', y);
  y = addParagraph(doc, 'O gráfico de payoff mostra visualmente o lucro ou prejuízo da sua estrutura para cada cenário de preço do ativo-objeto no vencimento. Use os botões VALOR e % ROI para alternar a visualização. A linha tracejada amarela representa o retorno do CDI.', y);

  doc.autoTable({
    startY: y,
    head: [['Métrica', 'Descrição']],
    body: [
      ['Custo Líquido', 'Valor total investido na montagem da estrutura'],
      ['Lucro Máximo', 'Ganho máximo possível no vencimento'],
      ['Risco Máximo', 'Perda máxima possível no vencimento'],
      ['Breakeven', 'Preço do ativo onde o resultado é zero'],
      ['Eficiência vs CDI', 'Percentual do retorno comparado ao CDI no período'],
    ],
    theme: 'grid',
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8, textColor: COLORS.dark },
    alternateRowStyles: { fillColor: COLORS.bg },
    margin: { left: 14, right: 14 },
  });
  y = doc.lastAutoTable.finalY + 10;

  // CDI Comparison
  y = checkPageBreak(doc, y, 60);
  y = addSectionTitle(doc, '4. Comparação com CDI', y);
  y = addParagraph(doc, 'A comparação com CDI permite avaliar se a sua estratégia de opções supera o rendimento do CDI (Certificado de Depósito Interbancário), a taxa de referência para investimentos de renda fixa no Brasil.', y);

  doc.autoTable({
    startY: y,
    head: [['Campo', 'Descrição']],
    body: [
      ['Taxa CDI (% a.a.)', 'Taxa CDI anual utilizada no cálculo (configurável)'],
      ['Data de Vencimento', 'Data de vencimento da estrutura para calcular os dias úteis'],
      ['Capital Investido', 'Valor total investido para calcular o retorno proporcional do CDI'],
      ['Eficiência CDI', 'Percentual que indica quanto a estratégia rende em relação ao CDI. Ex: 220% = 2,2x mais que o CDI'],
      ['IR no CDI / IR Opções', 'Ative para incluir imposto de renda na comparação'],
      ['Retorno CDI (R$)', 'Valor que o capital renderia no CDI no mesmo período'],
    ],
    theme: 'grid',
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8, textColor: COLORS.dark },
    alternateRowStyles: { fillColor: COLORS.bg },
    columnStyles: { 0: { cellWidth: 40, fontStyle: 'bold' } },
    margin: { left: 14, right: 14 },
  });
  y = doc.lastAutoTable.finalY + 6;
  y = addParagraph(doc, 'Dica: Estratégias com risco limitado e eficiência CDI acima de 100% são consideradas atrativas, pois oferecem retorno superior à renda fixa com risco controlado.', y);

  // Monitoring active ops
  y = checkPageBreak(doc, y, 50);
  y = addSectionTitle(doc, '5. Acompanhamento de Operações Ativas', y);
  y = addParagraph(doc, 'Ao abrir uma operação ativa, você acessa a tela de Detalhes. Nela é possível monitorar o P&L em tempo real, comparar com o custo de oportunidade do CDI e solicitar um Veredito de Saída da IA para decidir o melhor momento de encerrar.', y);

  doc.autoTable({
    startY: y,
    head: [['Indicador', 'Descrição']],
    body: [
      ['Lucro Atual (PNL)', 'Resultado atual baseado nos preços de saída informados'],
      ['Custo Oportunidade (CDI)', 'Quanto seu capital teria rendido no CDI no mesmo período'],
      ['Eficiência vs CDI', 'Percentual de rendimento comparado ao CDI'],
      ['IA: Veredito de Saída', 'Análise automática que avalia se é hora de encerrar a operação'],
    ],
    theme: 'grid',
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8, textColor: COLORS.dark },
    alternateRowStyles: { fillColor: COLORS.bg },
    columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold' } },
    margin: { left: 14, right: 14 },
  });
  y = doc.lastAutoTable.finalY + 10;

  // History
  y = checkPageBreak(doc, y, 50);
  y = addSectionTitle(doc, '6. Aba Histórico', y);
  y = addParagraph(doc, 'O Histórico é o centro de controle das suas análises. Todas as operações salvas aparecem organizadas por status (Ativas e Encerradas) com filtros por mês e ano.', y);
  y = addParagraph(doc, '• Operações Ativas: Podem ser editadas, encerradas ou deletadas.\n• Operações Encerradas: Ficam registradas com a data de encerramento. Podem ser reabertas.', y);

  // Flow
  y = checkPageBreak(doc, y, 50);
  y = addSectionTitle(doc, '7. Fluxo: Histórico → Portfólio', y);

  doc.autoTable({
    startY: y,
    head: [['De', 'Para', 'Ação']],
    body: [
      ['Nova Análise', 'Histórico', 'Ao salvar, a operação vai para o Histórico como "Ativa"'],
      ['Histórico', 'Portfólio', 'Ao encerrar uma operação ativa, ela é movida para o Portfólio'],
      ['Portfólio', 'Histórico', 'Você pode reabrir uma operação encerrada se precisar'],
    ],
    theme: 'grid',
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8, textColor: COLORS.dark },
    alternateRowStyles: { fillColor: COLORS.bg },
    margin: { left: 14, right: 14 },
  });
  y = doc.lastAutoTable.finalY + 6;

  y = addParagraph(doc, 'Como encerrar: Acesse Histórico → Localize a operação Ativa → Clique em "Encerrar" → Confirme → A operação muda para "Encerrada" e aparece no Portfólio.', y);

  // Portfolio
  y = checkPageBreak(doc, y, 40);
  y = addSectionTitle(doc, '8. Aba Portfólio', y);
  y = addParagraph(doc, 'O Portfólio consolida todas as operações encerradas. Métricas disponíveis: Resultado Total, Capital Alocado, Média por Operação, VS CDI, Taxa de Acerto e total de Estratégias Encerradas.', y);

  // Diversifier
  y = checkPageBreak(doc, y, 40);
  y = addSectionTitle(doc, '9. Diversificador de Estratégias', y);
  y = addParagraph(doc, 'O módulo Diversificador permite criar planos de alocação para distribuir seu patrimônio entre diferentes estratégias de opções. Defina percentuais, nível de risco e alavancagem para cada estratégia, mantendo um controle disciplinado da sua exposição ao mercado.', y);

  // FAQ
  y = checkPageBreak(doc, y, 80);
  y = addSectionTitle(doc, '10. Perguntas Frequentes', y);

  const faqs = [
    ['Preciso ter conta em corretora?', 'O Opções PRO X é uma ferramenta de simulação. Você precisa de corretora apenas para executar operações reais.'],
    ['Como funciona o OCR?', 'Faça um print da tela de opções da sua corretora e faça upload. A IA extrai automaticamente os dados das opções.'],
    ['O que é "Eficiência CDI"?', 'Indica quanto a estratégia rende em relação ao CDI. Ex: 220% = 2,2x mais que o CDI. Acima de 100% supera renda fixa.'],
    ['Posso reabrir operação encerrada?', 'Sim! Na aba Histórico, operações encerradas possuem o botão "Reabrir".'],
    ['É recomendação de investimento?', 'Não. É uma ferramenta de simulação baseada nas regras da B3. Consulte um profissional antes de operar.'],
    ['Como a IA funciona?', 'Utiliza IA (OpenAI) para avaliar risco/retorno, cenários favoráveis/desfavoráveis e sugerir ajustes.'],
    ['Diferença Free vs PRO?', 'Free: acesso básico com limites. PRO: simulações ilimitadas, IA, CDI, diversificador e todos os recursos.'],
  ];

  doc.autoTable({
    startY: y,
    head: [['Pergunta', 'Resposta']],
    body: faqs,
    theme: 'grid',
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8, textColor: COLORS.dark },
    alternateRowStyles: { fillColor: COLORS.bg },
    columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold' } },
    margin: { left: 14, right: 14 },
  });

  // Add footers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages);
  }

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
    y = checkPageBreak(doc, y, 60);

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

    // Fetch legs
    try {
      const legs = await fetchLegs(a.id);
      if (legs.length > 0) {
        doc.autoTable({
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
          headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: 'bold', fontSize: 8 },
          bodyStyles: { fontSize: 8, textColor: COLORS.dark },
          alternateRowStyles: { fillColor: COLORS.bg },
          margin: { left: 14, right: 14 },
        });
        y = doc.lastAutoTable.finalY + 10;
      } else {
        y = addParagraph(doc, 'Nenhuma perna registrada.', y);
      }
    } catch {
      y = addParagraph(doc, 'Erro ao carregar pernas da operação.', y);
    }
  }

  // Footers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages);
  }

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

  doc.autoTable({
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
    theme: 'grid',
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: COLORS.dark },
    alternateRowStyles: { fillColor: COLORS.bg },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
    margin: { left: 14, right: 14 },
  });
  y = doc.lastAutoTable.finalY + 10;

  // Operations detail
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

  doc.autoTable({
    startY: y,
    head: [['Nome', 'Ativo', 'Entrada', 'Saída', 'Investido', 'Resultado', 'ROI']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: 'bold', fontSize: 8 },
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
  y = doc.lastAutoTable.finalY + 10;

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

    doc.autoTable({
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
      headStyles: { fillColor: COLORS.darkSlate, textColor: COLORS.white, fontStyle: 'bold', fontSize: 7 },
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
    y = doc.lastAutoTable.finalY + 8;
  }

  // Footers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages);
  }

  doc.save('OpçõesPROX_Portfólio.pdf');
};
