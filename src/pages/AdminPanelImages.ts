import type { PdfImageMap } from '@/lib/pdf-generator';

// Screenshots fiéis do sistema extraídas do catálogo oficial
import pdfNovaAnalise from '@/assets/pdf-nova-analise.jpg';
import pdfHistorico from '@/assets/pdf-historico.jpg';
import pdfPortfolio from '@/assets/pdf-portfolio.jpg';
import pdfDiversificador from '@/assets/pdf-diversificador.jpg';
import pdfTempoReal from '@/assets/pdf-tempo-real.jpg';
import pdfBoxRanking from '@/assets/pdf-box-ranking.jpg';
import pdfAnaliseDetalhe from '@/assets/pdf-analise-detalhe.jpg';
import pdfPayoff from '@/assets/pdf-payoff.jpg';
import pdfCalculadoraCdi from '@/assets/pdf-calculadora-cdi.jpg';

export const landingImages: PdfImageMap = {
  analysis: pdfNovaAnalise,
  ocr: pdfNovaAnalise,
  ai: pdfAnaliseDetalhe,
  payoff: pdfPayoff,
  cdi: pdfCalculadoraCdi,
  realtime: pdfTempoReal,
  portfolio: pdfPortfolio,
  diversificador: pdfDiversificador,
  box: pdfBoxRanking,
  calcCdi: pdfCalculadoraCdi,
  // Keys used by FAQ manual PDF
  historico: pdfHistorico,
  temporeal: pdfTempoReal,
};
