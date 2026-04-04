import type { PdfImageMap } from '@/lib/pdf-generator';

// Screenshots fiéis do sistema extraídas do catálogo oficial
import pdfNovaAnalise from '@/assets/pdf-nova-analise.jpg';
import pdfHistorico from '@/assets/pdf-historico.jpg';
import pdfPortfolio from '@/assets/pdf-portfolio.jpg';
import pdfDiversificador from '@/assets/pdf-diversificador.jpg';
import pdfTempoReal from '@/assets/pdf-tempo-real.jpg';
import pdfBoxRanking from '@/assets/pdf-box-ranking.jpg';
import pdfBoxTabela from '@/assets/pdf-box-tabela.jpg';
import pdfAnaliseDetalhe from '@/assets/pdf-analise-detalhe.jpg';
import pdfAnaliseDetalhe2 from '@/assets/pdf-analise-detalhe2.jpg';
import pdfPayoff from '@/assets/pdf-payoff.jpg';
import pdfCalculadoraCdi from '@/assets/pdf-calculadora-cdi.jpg';
import pdfTemasCores from '@/assets/pdf-temas-cores.jpg';
import pdfManualTabela from '@/assets/pdf-manual-tabela.jpg';
import pdfManualGrafico from '@/assets/pdf-manual-grafico.jpg';
import pdfTomadaDecisao from '@/assets/pdf-tomada-decisao.jpg';

export const landingImages: PdfImageMap = {
  analysis: pdfNovaAnalise,
  ocr: pdfNovaAnalise,
  ai: pdfAnaliseDetalhe,
  ai2: pdfAnaliseDetalhe2,
  payoff: pdfPayoff,
  cdi: pdfCalculadoraCdi,
  realtime: pdfTempoReal,
  portfolio: pdfPortfolio,
  diversificador: pdfDiversificador,
  box: pdfBoxRanking,
  boxTabela: pdfBoxTabela,
  calcCdi: pdfCalculadoraCdi,
  temasCores: pdfTemasCores,
  manualTabela: pdfManualTabela,
  manualGrafico: pdfManualGrafico,
  tomadaDecisao: pdfTomadaDecisao,
  // Keys used by FAQ manual PDF
  historico: pdfHistorico,
  temporeal: pdfTempoReal,
};
