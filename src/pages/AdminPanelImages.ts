import type { PdfImageMap } from '@/lib/pdf-generator';

import faqPayoff from '@/assets/faq-payoff.png';
import faqCdi from '@/assets/faq-cdi.png';
import faqHistorico from '@/assets/faq-historico.png';
import faqPortfolio from '@/assets/faq-portfolio.png';
import faqAnaliseDetalhe from '@/assets/faq-analise-detalhe.png';
import faqDiversificador from '@/assets/faq-diversificador.png';
import faqTempoReal from '@/assets/faq-tempo-real.jpg';
import faqRastreadorBox from '@/assets/faq-rastreador-box.jpg';
import faqBridgeSetup from '@/assets/faq-bridge-setup.jpg';
import screenshotPayoff from '@/assets/screenshot-payoff.jpg';
import screenshotOcr from '@/assets/screenshot-ocr.jpg';
import screenshotAi from '@/assets/screenshot-ai-analysis.jpg';

export const landingImages: PdfImageMap = {
  analysis: faqHistorico,
  ocr: screenshotOcr,
  ai: screenshotAi,
  payoff: screenshotPayoff,
  cdi: faqCdi,
  realtime: faqTempoReal,
  portfolio: faqPortfolio,
  diversificador: faqDiversificador,
  box: faqRastreadorBox,
  calcCdi: faqCdi, // reuse CDI image
};
