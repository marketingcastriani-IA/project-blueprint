import Header from '@/components/Header';
import { ProfessionalHeader, ProfessionalCard } from '@/components/ProfessionalLayout';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { 
  BookOpen, Upload, BarChart3, History, Briefcase, TrendingUp, 
  Zap, Target, ArrowRight, CheckCircle2, AlertTriangle, HelpCircle,
  Camera, Brain, PieChart, Calculator, Shield, Eye, Download,
  Radio, Wifi, Activity, Trophy, Box, Settings, Terminal,
  Keyboard, Palette, BookOpenCheck, Lock, Bell, Layers, Search, Database
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { generateFAQPdf, type PdfImageMap } from '@/lib/pdf-generator';

import faqNovaAnalise from '@/assets/pdf-nova-analise.jpg';
import faqPayoff from '@/assets/pdf-payoff.jpg';
import faqCdi from '@/assets/pdf-calculadora-cdi.jpg';
import faqHistorico from '@/assets/pdf-historico.jpg';
import faqPortfolio from '@/assets/pdf-portfolio.jpg';
import faqAnaliseDetalhe from '@/assets/pdf-analise-detalhe.jpg';
import faqDiversificador from '@/assets/pdf-diversificador.jpg';
import faqTempoReal from '@/assets/pdf-tempo-real.jpg';
import faqRastreadorBox from '@/assets/pdf-box-ranking.jpg';
import faqBridgeSetup from '@/assets/pdf-tempo-real.jpg';
import faqTickerOpcoes from '@/assets/pdf-ticker-opcoes.jpg';
import faqTickerOpcoesBusca from '@/assets/pdf-ticker-opcoes-busca.jpg';
import faqTickerOpcoesTabela from '@/assets/pdf-ticker-opcoes-tabela.jpg';

const StepCard = ({ step, title, description, icon: Icon }: { step: number; title: string; description: string; icon: React.ComponentType<{ className?: string }> }) => (
  <div className="flex gap-4 items-start">
    <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
      <span className="text-sm font-black text-primary">{step}</span>
    </div>
    <div className="space-y-1 flex-1">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h4 className="font-bold text-sm">{title}</h4>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  </div>
);

const FeatureSection = ({ icon: Icon, title, children, badge }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode; badge?: string }) => (
  <ProfessionalCard className="overflow-hidden">
    <div className="p-6 sm:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black tracking-tight">{title}</h2>
            {badge && (
              <Badge variant="outline" className="text-xs border-primary/30 text-primary font-bold uppercase tracking-widest">
                {badge}
              </Badge>
            )}
          </div>
        </div>
      </div>
      {children}
    </div>
  </ProfessionalCard>
);

const ScreenshotImage = ({ src, alt }: { src: string; alt: string }) => (
  <div className="rounded-xl overflow-hidden border border-border/50 shadow-lg">
    <img src={src} alt={alt} className="w-full h-auto" loading="lazy" />
  </div>
);

const FlowStep = ({ from, to, description }: { from: string; to: string; description: string }) => (
  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
    <Badge className="bg-primary/10 text-primary border-primary/20 font-bold text-xs shrink-0">{from}</Badge>
    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
    <Badge className="bg-success/10 text-success border-success/20 font-bold text-xs shrink-0">{to}</Badge>
    <span className="text-xs text-muted-foreground">{description}</span>
  </div>
);

export default function FAQ() {
  return (
    <div className="min-h-screen bg-background pb-16">
      <Header />
      <main className="container py-8 space-y-8 animate-fade-in max-w-4xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <ProfessionalHeader 
            title="Manual do Usuário" 
            subtitle="Guia completo para dominar o Opções PRO X — da simulação ao controle do portfólio"
          />
          <Button 
            variant="outline" 
            onClick={async () => {
              const { toast } = await import('sonner');
              toast.info('Gerando PDF com imagens...');
              const faqImages: PdfImageMap = {
                analysis: faqNovaAnalise,
                ocr: faqNovaAnalise,
                payoff: faqPayoff,
                cdi: faqCdi,
                calcCdi: faqCdi,
                historico: faqHistorico,
                portfolio: faqPortfolio,
                ai: faqAnaliseDetalhe,
                diversificador: faqDiversificador,
                temporeal: faqTempoReal,
                box: faqRastreadorBox,
                tickerOpcoes: faqTickerOpcoes,
                tickerOpcoesBusca: faqTickerOpcoesBusca,
                tickerOpcoesTabela: faqTickerOpcoesTabela,
              };
              await generateFAQPdf(faqImages);
              toast.success('PDF do manual baixado!');
            }} 
            className="h-12 px-5 font-bold border-primary/30 text-primary hover:bg-primary/10 shrink-0"
          >
            <Download className="mr-2 h-5 w-5" /> Baixar PDF
          </Button>
        </div>

        {/* Visão Geral */}
        <FeatureSection icon={BookOpen} title="O que é o Opções PRO X?" badge="Visão Geral">
          <p className="text-sm text-muted-foreground leading-relaxed">
            O <strong className="text-foreground">Opções PRO X</strong> é uma ferramenta profissional de simulação e análise de estratégias 
            com opções na B3. Ele permite montar estruturas, visualizar o gráfico de payoff, comparar com o CDI, 
            receber análises de IA e gerenciar todo o ciclo de vida das suas operações — do estudo ao encerramento.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: Calculator, label: 'Simulação', desc: 'Monte e analise estruturas' },
              { icon: Brain, label: 'IA Integrada', desc: 'Análise inteligente automática' },
              { icon: Briefcase, label: 'Portfólio', desc: 'Controle de operações encerradas' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
                <item.icon className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="text-xs font-bold">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </FeatureSection>

        {/* Como Criar uma Análise */}
        <FeatureSection icon={Upload} title="Como Criar uma Análise" badge="Passo a Passo">
          <img src={faqNovaAnalise} alt="Tela de Nova Análise" className="w-full rounded-lg border border-border/40 shadow-md mb-4" />
          <div className="space-y-4">
            <StepCard 
              step={1} icon={Camera}
              title="Faça o Upload da Imagem (OCR)" 
              description="Na tela 'Nova Análise', faça upload de um print da tela de opções da sua corretora. A IA irá extrair automaticamente os dados das opções (ativo, strike, preço, tipo) via OCR. Um vídeo tutorial está disponível ao lado do campo de upload para orientá-lo."
            />
            <StepCard 
              step={2} icon={Target}
              title="Ajuste as Pernas (Legs)" 
              description="Após o OCR preencher os dados, revise e ajuste as pernas da operação. Você pode adicionar, remover ou editar manualmente cada perna. Defina o lado (compra/venda), tipo (call/put/ação), strike, preço, quantidade e data de vencimento."
            />
            <StepCard 
              step={3} icon={BarChart3}
              title="Visualize o Payoff e Métricas" 
              description="O gráfico de payoff é gerado automaticamente, mostrando lucro/prejuízo em cada cenário de preço. As métricas exibem ganho máximo, perda máxima, breakevens, custo líquido e tipo de estratégia identificada."
            />
            <StepCard 
              step={4} icon={Brain}
              title="Solicite Análise de IA" 
              description="Clique em 'Analisar com IA' para receber uma análise detalhada da sua estrutura. A IA avalia risco/retorno, cenários favoráveis e desfavoráveis, e oferece sugestões de ajuste."
            />
            <StepCard 
              step={5} icon={CheckCircle2}
              title="Salve a Análise" 
              description="Dê um nome descritivo à análise e clique em salvar. A operação ficará registrada com status 'Ativa' e será automaticamente visível na aba Histórico."
            />
          </div>
        </FeatureSection>

        {/* Gráfico de Payoff & Métricas */}
        <FeatureSection icon={BarChart3} title="Gráfico de Payoff & Métricas" badge="Simulação">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              O gráfico de payoff mostra visualmente o lucro ou prejuízo da sua estrutura para cada cenário de preço do ativo-objeto no vencimento. 
              As métricas resumem os dados mais importantes: <strong className="text-foreground">Lucro Máximo</strong>, <strong className="text-foreground">Risco Máximo</strong>, 
              <strong className="text-foreground">Breakeven</strong>, <strong className="text-foreground">Custo Líquido</strong> e <strong className="text-foreground">Eficiência vs CDI</strong>.
            </p>
            <ScreenshotImage src={faqPayoff} alt="Gráfico de Payoff e Métricas do Opções PRO X" />
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
              <div className="flex items-start gap-2">
                <Eye className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Dica:</strong> Use os botões <strong className="text-foreground">VALOR</strong> e <strong className="text-foreground">% ROI</strong> para 
                  alternar entre visualização em reais e em percentual de retorno. A linha tracejada amarela representa o retorno do CDI para comparação direta.
                </p>
              </div>
            </div>
          </div>
        </FeatureSection>

        {/* Comparação com CDI */}
        <FeatureSection icon={TrendingUp} title="Comparação com CDI" badge="Recurso PRO">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              A comparação com CDI é um dos recursos mais poderosos do Opções PRO X. Ela permite avaliar se a sua estratégia 
              de opções supera o rendimento do CDI (Certificado de Depósito Interbancário), que é a taxa de referência 
              para investimentos de renda fixa no Brasil.
            </p>
            
            <ScreenshotImage src={faqCdi} alt="Comparação com CDI - Opções PRO X" />

            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
              <h4 className="text-sm font-black flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" /> Como Funciona
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                  <span><strong className="text-foreground">Taxa CDI:</strong> O sistema utiliza a taxa CDI atual (configurável) para calcular quanto seu capital renderia se estivesse aplicado em renda fixa pelo mesmo período.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                  <span><strong className="text-foreground">Data de Vencimento:</strong> Informe a data de vencimento correta da sua estrutura para que o cálculo reflita exatamente o período restante em dias úteis.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                  <span><strong className="text-foreground">Capital Investido:</strong> Informe o valor total investido na operação para calcular o retorno do CDI proporcional.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                  <span><strong className="text-foreground">Eficiência CDI:</strong> Mostra o percentual do CDI que a sua estratégia entrega. Exemplo: 220% significa que sua operação rende 2,2x mais que o CDI no mesmo período.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                  <span><strong className="text-foreground">IR no CDI / IR Opções:</strong> Ative ou desative o cálculo de imposto de renda para uma comparação mais realista entre os investimentos.</span>
                </li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-warning/5 border border-warning/20">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Dica:</strong> Estratégias com risco limitado e eficiência CDI acima de 100% são consideradas atrativas, 
                  pois oferecem retorno superior à renda fixa com risco controlado. A comparação com CDI é especialmente 
                  útil para operações de renda estruturada como travas e borboletas.
                </p>
              </div>
            </div>
          </div>
        </FeatureSection>

        {/* Acompanhamento de Operações Ativas */}
        <FeatureSection icon={Eye} title="Acompanhamento de Operações Ativas" badge="Monitoramento">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Ao abrir uma operação ativa no Histórico, você acessa a tela de <strong className="text-foreground">Detalhes da Análise</strong>. 
              Nela, é possível monitorar o P&L em tempo real, comparar com o custo de oportunidade do CDI e solicitar um 
              <strong className="text-foreground"> Veredito de Saída da IA</strong> para decidir o melhor momento de encerrar a operação.
            </p>

            <ScreenshotImage src={faqAnaliseDetalhe} alt="Detalhes da análise ativa - Opções PRO X" />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: 'Lucro Atual (PNL)', desc: 'Resultado atual baseado nos preços de saída informados' },
                { label: 'Custo Oportunidade', desc: 'Quanto seu capital teria rendido no CDI no mesmo período' },
                { label: 'Eficiência vs CDI', desc: 'Percentual de rendimento comparado ao CDI' },
              ].map(item => (
                <div key={item.label} className="p-3 rounded-xl bg-muted/30 border border-border/50">
                  <p className="text-xs font-bold">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
              <h4 className="text-sm font-black flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" /> IA: Veredito de Saída
              </h4>
              <p className="text-xs text-muted-foreground">
                Clique em <strong className="text-foreground">"Analisar Momento de Saída"</strong> para que a IA avalie se é hora de encerrar a operação. 
                Ela compara seu lucro atual contra o CDI do período e o risco residual, oferecendo uma recomendação objetiva de saída.
              </p>
            </div>
          </div>
        </FeatureSection>

        {/* Aba Histórico */}
        <FeatureSection icon={History} title="Aba Histórico" badge="Gestão">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              A aba <strong className="text-foreground">Histórico</strong> é o centro de controle das suas análises. 
              Todas as operações salvas aparecem aqui, organizadas por status (Ativas e Encerradas) com filtros por mês e ano.
            </p>

            <ScreenshotImage src={faqHistorico} alt="Aba Histórico - Opções PRO X" />

            <div className="grid gap-3">
              <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-2">
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                  Operações Ativas
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  São as operações que estão em andamento. Você pode <strong className="text-foreground">editar</strong> (abrir e ajustar pernas, 
                  reanalisar com IA), <strong className="text-foreground">encerrar</strong> (mover para portfólio) ou <strong className="text-foreground">deletar</strong>.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-2">
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                  Operações Encerradas
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Operações que você já finalizou. Ficam registradas com a data de encerramento. 
                  Você pode <strong className="text-foreground">reabrir</strong> uma operação encerrada se necessário.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
              <h4 className="text-sm font-black">Filtros Disponíveis</h4>
              <p className="text-xs text-muted-foreground">
                Use os filtros de <strong className="text-foreground">mês</strong> e <strong className="text-foreground">ano</strong> para 
                localizar rapidamente operações específicas. Ideal para revisão mensal de performance e controle de vencimentos.
              </p>
            </div>
          </div>
        </FeatureSection>

        {/* Fluxo: Histórico → Portfólio */}
        <FeatureSection icon={ArrowRight} title="Fluxo: Histórico → Portfólio" badge="Ciclo de Vida">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              O Opções PRO X possui um fluxo integrado que acompanha o ciclo completo de uma operação:
            </p>
            
            <div className="space-y-2">
              <FlowStep from="Nova Análise" to="Histórico" description="Ao salvar, a operação vai para o Histórico como 'Ativa'" />
              <FlowStep from="Histórico" to="Portfólio" description="Ao encerrar uma operação ativa, ela é movida para o Portfólio" />
              <FlowStep from="Portfólio" to="Histórico" description="Você pode reabrir uma operação encerrada se precisar" />
            </div>

            <div className="p-4 rounded-xl bg-success/5 border border-success/20 space-y-2">
              <h4 className="text-sm font-black flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" /> Como Encerrar uma Operação
              </h4>
              <ol className="space-y-1 text-xs text-muted-foreground list-decimal list-inside">
                <li>Acesse a aba <strong className="text-foreground">Histórico</strong></li>
                <li>Localize a operação que deseja encerrar (status "Ativa")</li>
                <li>Clique no botão <strong className="text-foreground">Encerrar</strong> (ícone X)</li>
                <li>Confirme a ação no diálogo de confirmação</li>
                <li>A operação muda para status <strong className="text-foreground">"Encerrada"</strong> com a data registrada</li>
                <li>Ela agora aparece na aba <strong className="text-foreground">Portfólio</strong> para controle consolidado</li>
              </ol>
            </div>
          </div>
        </FeatureSection>

        {/* Aba Portfólio */}
        <FeatureSection icon={Briefcase} title="Aba Portfólio" badge="Consolidação">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              A aba <strong className="text-foreground">Portfólio</strong> consolida todas as operações que foram encerradas. 
              É o seu registro histórico de trades finalizados, permitindo acompanhar a evolução e performance ao longo do tempo.
            </p>

            <ScreenshotImage src={faqPortfolio} alt="Aba Portfólio - Opções PRO X" />

            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                <span><strong className="text-foreground">Resultado Total:</strong> Veja o lucro/prejuízo acumulado de todas as operações encerradas</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                <span><strong className="text-foreground">Capital Alocado:</strong> Total desembolsado nas operações</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                <span><strong className="text-foreground">VS CDI:</strong> Compare seu desempenho geral contra a renda fixa</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                <span><strong className="text-foreground">Taxa de Acerto:</strong> Percentual de operações vencedoras vs perdedoras</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                <span>Reabra operações se necessário (volta para o Histórico como "Ativa")</span>
              </li>
            </ul>
          </div>
        </FeatureSection>

        {/* Diversificador */}
        <FeatureSection icon={PieChart} title="Diversificador de Estratégias" badge="Avançado">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              O módulo <strong className="text-foreground">Diversificador</strong> permite criar planos de alocação para distribuir 
              seu patrimônio entre diferentes estratégias de opções. Defina percentuais, frequências, nível de risco e alavancagem 
              para cada estratégia, mantendo um controle disciplinado da sua exposição ao mercado.
            </p>

            <ScreenshotImage src={faqDiversificador} alt="Diversificador de Estratégias - Opções PRO X" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'Patrimônio', desc: 'Defina o valor total do capital disponível para alocação' },
                { label: 'Estratégias', desc: 'Crie e gerencie suas estratégias com percentual, risco e alavancagem' },
                { label: 'Alocação', desc: 'Visualize a distribuição do seu patrimônio entre as estratégias' },
                { label: 'Resumo', desc: 'Acompanhe o saldo livre, total alocado e percentual utilizado' },
              ].map(item => (
                <div key={item.label} className="p-3 rounded-xl bg-muted/30 border border-border/50">
                  <p className="text-xs font-bold">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </FeatureSection>

        {/* ─── PRÉ-REQUISITO: PROFIT RTD BRIDGE ─── */}
        <FeatureSection icon={Terminal} title="Pré-Requisito: Profit RTD Bridge" badge="Configuração">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Os módulos <strong className="text-foreground">Tempo Real</strong> e <strong className="text-foreground">Rastreador de Box</strong> dependem 
              de dados ao vivo vindos do Profit Pro (Nelogica) via o <strong className="text-foreground">ProfitRTD Bridge</strong>. 
              Antes de usar essas funcionalidades, é necessário instalar e iniciar o Bridge no seu computador.
            </p>

            <ScreenshotImage src={faqBridgeSetup} alt="Setup do ProfitRTD Bridge" />

            <div className="space-y-4">
              <StepCard 
                step={1} icon={Download}
                title="Baixe o Bridge" 
                description="Na seção 'Dados ao Vivo', clique no botão 'Download Bridge' para baixar o pacote .zip contendo o executável, o arquivo .bat e o README de instruções."
              />
              <StepCard 
                step={2} icon={Settings}
                title="Instale o .NET 8 Runtime (x86)" 
                description="O Bridge requer o .NET 8 Runtime na versão x86. O link para download aparece no README e na própria página. Instale antes de prosseguir."
              />
              <StepCard 
                step={3} icon={Activity}
                title="Abra o Profit Pro e Inicie o Bridge" 
                description="Com o Profit Pro aberto e logado, execute o arquivo 'iniciar_bridge.bat'. O terminal mostrará a conexão WebSocket na porta 8765. Mantenha o terminal aberto."
              />
              <StepCard 
                step={4} icon={Wifi}
                title="Conecte no Opções PRO X" 
                description="Volte para o Opções PRO X e verifique o badge de status. Quando aparecer 'Conectado' em verde, você está pronto para usar Tempo Real e Rastreador de Box."
              />
            </div>

            <div className="p-4 rounded-xl bg-warning/5 border border-warning/20">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Importante:</strong> O Profit Pro deve estar aberto e logado ANTES de iniciar o Bridge. 
                  Caso a conexão caia, feche o terminal e execute o .bat novamente. O sistema reconecta automaticamente.
                </p>
              </div>
            </div>
          </div>
        </FeatureSection>

        {/* ─── TEMPO REAL ─── */}
        <FeatureSection icon={Radio} title="Tempo Real — Dados ao Vivo" badge="PRO">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              A aba <strong className="text-foreground">Tempo Real</strong> permite monitorar cotações de opções ao vivo, 
              acompanhar operações em aberto com P&L atualizado e visualizar o gráfico de payoff com dados reais do mercado. 
              Todos os dados vêm diretamente do Profit Pro via WebSocket.
            </p>

            <ScreenshotImage src={faqTempoReal} alt="Aba Tempo Real - Dados ao Vivo" />

            <div className="space-y-4">
              <StepCard 
                step={1} icon={Wifi}
                title="Verifique a Conexão" 
                description="No topo da tela, o badge de status mostra se o Bridge está conectado (verde), desconectado (vermelho) ou reconectando (amarelo). Certifique-se de que está 'Conectado' antes de adicionar tickers."
              />
              <StepCard 
                step={2} icon={Target}
                title="Adicione Tickers para Monitorar" 
                description="Digite o código do ticker (ex: PETR4, PETRA260, VALE3) no campo de pesquisa e clique em Adicionar. Os dados de Último Preço, Strike, Bid, Ask e Negócios aparecem em tempo real na tabela."
              />
              <StepCard 
                step={3} icon={Activity}
                title="Operações em Aberto (Sincronização Automática)" 
                description="Se você tem análises ativas salvas no Histórico, os tickers são automaticamente extraídos e sincronizados. O sistema exibe Lucro (R$), Rentabilidade (%) e Capital Investido atualizados em tempo real."
              />
              <StepCard 
                step={4} icon={BarChart3}
                title="Gráfico de Payoff em Tempo Real" 
                description="Preencha Preço de Entrada, Quantidade e Vencimento para cada ticker. O gráfico de payoff é gerado automaticamente com as métricas atualizadas conforme os preços mudam."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: 'Cotações ao Vivo', desc: 'Último, BID, ASK, Strike e Volume em tempo real' },
                { label: 'P&L Automático', desc: 'Lucro/prejuízo calculado com preços de mercado' },
                { label: 'Payoff Dinâmico', desc: 'Gráfico atualizado conforme o mercado se move' },
              ].map(item => (
                <div key={item.label} className="p-3 rounded-xl bg-muted/30 border border-border/50">
                  <p className="text-xs font-bold">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
              <div className="flex items-start gap-2">
                <Eye className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Dica:</strong> Use a seção "Pesquisa" para monitorar tickers isolados sem vincular 
                  a nenhuma operação. Ideal para acompanhar opções que você está estudando antes de montar uma estrutura.
                </p>
              </div>
            </div>
          </div>
        </FeatureSection>

        {/* ─── RASTREADOR DE BOX ─── */}
        <FeatureSection icon={Box} title="Rastreador de Box Spread" badge="PRO">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              O <strong className="text-foreground">Rastreador de Box</strong> monitora automaticamente todas as combinações de Box Spread 
              para as ações que você configurar, calculando em tempo real o custo, lucro, rentabilidade e comparação com o CDI. 
              A fórmula é: <strong className="text-foreground">Custo = (Ação + Put) - Call</strong> e <strong className="text-foreground">Lucro = Strike - Custo</strong>.
            </p>

            <ScreenshotImage src={faqRastreadorBox} alt="Rastreador de Box Spread" />

            <div className="space-y-4">
              <StepCard 
                step={1} icon={Target}
                title="Adicione uma Família de Ações" 
                description="Clique em 'Adicionar Família' e informe o nome do ativo base (ex: PETR4). Em seguida, cole ou adicione os tickers de CALL e PUT do ativo. O sistema identifica automaticamente o tipo (Call/Put) e o strike de cada ticker."
              />
              <StepCard 
                step={2} icon={Settings}
                title="Configure CDI e Quantidade" 
                description="Edite a taxa CDI anual (persistida no navegador) e defina a quantidade de contratos. O CDI é usado para calcular o rendimento de referência do período e comparar com o retorno do box."
              />
              <StepCard 
                step={3} icon={BarChart3}
                title="Selecione o Vencimento" 
                description="Use o seletor de data para definir o vencimento das opções. O sistema calcula os dias úteis até o vencimento e o CDI proporcional ao período automaticamente."
              />
              <StepCard 
                step={4} icon={Trophy}
                title="Analise os Resultados" 
                description="O sistema exibe cards de destaque com o melhor box de cada ação, mostrando o '% do CDI' (ex: 120% do CDI significa que rende 20% a mais que a renda fixa). A tabela de ranking lista os Top 10 melhores spreads."
              />
            </div>

            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
              <h4 className="text-sm font-black flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" /> Entendendo o % do CDI
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                  <span><strong className="text-foreground">100% do CDI:</strong> O box rende exatamente o mesmo que o CDI no período</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                  <span><strong className="text-foreground">120% do CDI:</strong> Rende o CDI + 20% de bônus (fórmula: CDI × 1,20)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                  <span><strong className="text-foreground">200% do CDI:</strong> Rende o dobro do CDI — operação muito atrativa</span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                  <span><strong className="text-foreground">Abaixo de 100%:</strong> O box rende menos que a renda fixa — pode não valer a pena</span>
                </li>
              </ul>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'Simulador de IR Ações', desc: 'Ative para descontar 15% de IR sobre o lucro das ações e ver o retorno líquido' },
                { label: 'Simulador de IR Renda Fixa', desc: 'Ative para descontar 22,5% de IR sobre o CDI e comparar de forma justa' },
                { label: 'Cards de Destaque', desc: 'Exibe apenas o melhor box de cada ação, evitando poluição visual' },
                { label: 'Tabela por Strike', desc: 'Expanda cada família para ver todos os strikes com preços de Call, Put, Ação, custo e lucro detalhados' },
              ].map(item => (
                <div key={item.label} className="p-3 rounded-xl bg-muted/30 border border-border/50">
                  <p className="text-xs font-bold">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-warning/5 border border-warning/20">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Dica:</strong> Cole os tickers diretamente do Profit Pro usando o botão "Colar Tickers". 
                  O sistema identifica automaticamente o tipo (Call/Put) e o strike pelo código do ticker da B3. 
                  Adicione várias ações para comparar qual oferece o melhor retorno relativo ao CDI.
                </p>
              </div>
            </div>
          </div>
        </FeatureSection>

        {/* ─── RASTREADOR DE COLLAR ─── */}
        <FeatureSection icon={Layers} title="Rastreador de Collar — Risco Zero" badge="PRO">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              O <strong className="text-foreground">Rastreador de Collar</strong> foca exclusivamente em modelos de <strong className="text-foreground">Risco Zero</strong>, 
              monitorando automaticamente combinações de proteção de carteira em tempo real. Ele trabalha com dois modelos distintos 
              para proteger suas posições sem risco de perda.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'Collar de Alta', desc: 'Condição: Kp + Net >= S0. Proteção com viés de alta — lucro quando o ativo sobe acima do custo.' },
                { label: 'Collar de Baixa', desc: 'Condição: S0 + Net >= Kc. Proteção com viés de baixa — lucro quando o ativo cai abaixo do teto.' },
                { label: 'Quality Score', desc: 'Ranking automático dos melhores collars por qualidade geral (lucro, risco, custo).' },
                { label: 'Net Credit', desc: 'Collars com crédito líquido — você recebe prêmio ao montar a proteção.' },
              ].map(item => (
                <div key={item.label} className="p-3 rounded-xl bg-muted/30 border border-border/50">
                  <p className="text-xs font-bold">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <StepCard 
                step={1} icon={Target}
                title="Selecione o Ativo e Tickers" 
                description="Escolha a ação que deseja proteger e adicione os tickers de PUT (proteção) e CALL (financiamento). O sistema resolve automaticamente o vencimento pelo código do ticker."
              />
              <StepCard 
                step={2} icon={Calculator}
                title="Configure Quantidade e CDI" 
                description="Defina a quantidade de contratos para cálculo em R$. A taxa CDI é 14,65% (editável). O sistema calcula automaticamente o lucro/investimento em reais."
              />
              <StepCard 
                step={3} icon={Trophy}
                title="Veja os Top 3 por Categoria" 
                description="O painel apresenta automaticamente os 3 melhores resultados nas categorias: Maior Lucro, Quality Score e Net Credit. Cada resultado mostra lucro em R$, % e comparação com CDI."
              />
              <StepCard 
                step={4} icon={BarChart3}
                title="Gráfico de Payoff com CDI" 
                description="Visualize o payoff do collar com a linha de benchmark do CDI para comparação visual imediata. Ative o toggle de IR para ver 22,5% no CDI e 15% no Collar."
              />
            </div>

            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
              <div className="flex items-start gap-2">
                <Eye className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Dica:</strong> Monte collars de Risco Zero escolhendo combinações onde o crédito líquido (Net) cobre o custo da proteção. 
                  Use o filtro de Quality Score para encontrar os melhores equilíbrios entre proteção e custo.
                </p>
              </div>
            </div>
          </div>
        </FeatureSection>

        {/* ─── TICKER OPÇÕES B3 ─── */}
        <FeatureSection icon={Database} title="Ticker Opções B3 — Banco de Opções" badge="NOVO">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              O módulo <strong className="text-foreground">Ticker Opções B3</strong> centraliza um banco de dados com mais de 
              <strong className="text-foreground"> 99.000 opções</strong> listadas na B3. Inclui uma <strong className="text-foreground">Seleção Rápida Top 18</strong> com 
              as ações mais líquidas (as 6 primeiras com ranking numerado), filtros avançados por família, 
              vencimento, tipo (Call/Put), moneyness e faixa de prêmio, além de identificação automática de pares Call+Put para montagem de Box e outras estratégias.
            </p>

            <ScreenshotImage src={faqTickerOpcoes} alt="Ticker Opções B3 - Banco de Opções" />

            <div className="space-y-4">
              <StepCard 
                step={1} icon={Search}
                title="Busque por Ticker ou Família" 
                description="Digite o código da ação (ex: PETR, VALE) no campo de busca. O sistema utiliza busca inteligente com hierarquia de precisão: Exata > Inicia com > Contém. Filtre por ativo base, vencimento e tipo."
              />
              <StepCard 
                step={2} icon={Target}
                title="Filtros de Strike por % do Preço Base" 
                description="Use os sliders de 'Abaixo' e 'Acima' para filtrar strikes por distância percentual do preço do ativo. O preço base é sincronizado automaticamente via RTD Bridge ou estimado pela mediana dos strikes."
              />
              <StepCard 
                step={3} icon={CheckCircle2}
                title="Identifique Pares Call+Put" 
                description="Opções com par correspondente (mesmo strike e vencimento) são marcadas com o badge 'PAR'. Ideal para identificar rapidamente componentes de Box Spread, Straddle e outras estruturas."
              />
              <StepCard 
                step={4} icon={Activity}
                title="Envie para Tempo Real ou Box Tracker" 
                description="Selecione opções na tabela com checkbox e envie diretamente para o módulo Tempo Real ou Rastreador de Box com um clique. Também é possível copiar os tickers selecionados."
              />
            </div>

            <ScreenshotImage src={faqTickerOpcoesTabela} alt="Tabela de opções PETR com dados e pares" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'Seleção Rápida Top 18', desc: 'Cards interativos das 18 ações mais líquidas com ranking numerado para as 6 primeiras' },
                { label: 'Pares Automáticos', desc: 'Identificação automática de pares Call+Put com badge visual' },
                { label: 'Filtros Avançados', desc: 'Moneyness, prêmio, % do strike, família, vencimento e tipo com chips ativos' },
                { label: 'Integração Direta', desc: 'Envie tickers para Tempo Real, Box Tracker ou Collar Tracker em 1 clique' },
              ].map(item => (
                <div key={item.label} className="p-3 rounded-xl bg-muted/30 border border-border/50">
                  <p className="text-xs font-bold">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
              <div className="flex items-start gap-2">
                <Eye className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Oportunidades de Box:</strong> Na parte inferior da página, o sistema identifica 
                  automaticamente oportunidades de Box Spread comparando pares Call+Put de mesmo strike. 
                  O cálculo usa BID/ASK em tempo real quando o RTD Bridge está conectado, garantindo valores realistas de execução.
                </p>
              </div>
            </div>
          </div>
        </FeatureSection>

        {/* ─── CALCULADORA RENDA FIXA ─── */}
        <FeatureSection icon={Calculator} title="Calculadora CDI x Opções" badge="NOVO">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              A <strong className="text-foreground">Calculadora CDI x Opções</strong> é uma ferramenta independente que permite 
              comparar rapidamente o retorno de qualquer operação de opções com o CDI do mesmo período. 
              Ideal para avaliar se vale a pena montar uma estrutura ou deixar o capital rendendo em renda fixa.
            </p>

            <ScreenshotImage src={faqCdi} alt="Calculadora CDI x Opções - Opções PRO X" />

            <div className="space-y-4">
              <StepCard 
                step={1} icon={Calculator}
                title="Informe Capital e Período" 
                description="Digite o valor do capital investido na operação e selecione a data de vencimento. O sistema calcula automaticamente os dias úteis e o rendimento do CDI no período."
              />
              <StepCard 
                step={2} icon={TrendingUp}
                title="Defina o Lucro da Estrutura" 
                description="Informe o percentual de lucro esperado (ou realizado) da sua estrutura de opções. O sistema compara instantaneamente com o CDI equivalente."
              />
              <StepCard 
                step={3} icon={Shield}
                title="Ative IR se Desejar" 
                description="Ative o cálculo de Imposto de Renda para CDI (tabela regressiva automática) e/ou para opções (15%) para uma comparação líquida e mais realista."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'Eficiência CDI', desc: 'Descubra quantos % do CDI sua operação equivale (ex: 160% do CDI)' },
                { label: 'IR Automático', desc: 'Tabela regressiva de IR aplicada automaticamente ao CDI' },
                { label: 'Dias Úteis', desc: 'Cálculo preciso usando calendário B3 de dias úteis' },
                { label: 'Comparação Visual', desc: 'Veja lado a lado o rendimento da operação vs CDI' },
              ].map(item => (
                <div key={item.label} className="p-3 rounded-xl bg-muted/30 border border-border/50">
                  <p className="text-xs font-bold">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
              <div className="flex items-start gap-2">
                <Eye className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Dica:</strong> Acesse pelo menu lateral em <strong className="text-foreground">CDI x Opções</strong> (destaque amarelo). 
                  Use esta calculadora antes de montar qualquer estrutura para saber se o retorno esperado justifica o risco em relação à renda fixa.
                </p>
              </div>
            </div>
          </div>
        </FeatureSection>

        {/* ─── ATALHOS DE TECLADO ─── */}
        <FeatureSection icon={Keyboard} title="Atalhos de Teclado" badge="Power User">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              O Opções PRO X possui atalhos de teclado para acelerar o uso. Os atalhos funcionam em qualquer página 
              (exceto quando o cursor está em campos de texto).
            </p>

            <div className="rounded-lg border border-border/40 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border/40">
                    <th className="px-4 py-2 text-left text-xs font-black uppercase tracking-widest">Atalho</th>
                    <th className="px-4 py-2 text-left text-xs font-black uppercase tracking-widest">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { key: 'Ctrl + S', action: 'Salvar a análise atual' },
                    { key: 'Ctrl + Enter', action: 'Analisar com IA' },
                    { key: 'N', action: 'Nova análise (ir para Dashboard)' },
                    { key: 'Esc', action: 'Fechar modais e diálogos abertos' },
                    { key: 'H', action: 'Ir para Histórico' },
                    { key: 'P', action: 'Ir para Portfólio' },
                  ].map((item, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-muted/20' : ''}>
                      <td className="px-4 py-2">
                        <kbd className="px-2 py-1 rounded bg-muted border border-border text-xs font-mono font-bold">{item.key}</kbd>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{item.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 rounded-xl bg-warning/5 border border-warning/20">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Nota:</strong> Os atalhos são desativados automaticamente quando você está digitando em campos de texto, 
                  como nome da análise, tickers ou formulários.
                </p>
              </div>
            </div>
          </div>
        </FeatureSection>

        {/* ─── CONFIGURAÇÕES ─── */}
        <FeatureSection icon={Settings} title="Configurações e Personalização" badge="Sistema">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              A página de <strong className="text-foreground">Configurações</strong> (/settings) permite personalizar sua experiência no Opções PRO X.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'Tema (Dark/Light)', desc: 'Alterne entre modo escuro e claro conforme sua preferência visual' },
                { label: 'Nome de Exibição', desc: 'Personalize como seu nome aparece no topo da aplicação' },
                { label: 'Foto de Perfil', desc: 'Faça upload de uma imagem de perfil para identificação visual' },
                { label: 'Informações do Plano', desc: 'Veja o status do seu plano (Free/PRO), data de expiração e simulações restantes' },
              ].map(item => (
                <div key={item.label} className="p-3 rounded-xl bg-muted/30 border border-border/50">
                  <p className="text-xs font-bold">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </FeatureSection>

        {/* ─── GLOSSÁRIO ─── */}
        <FeatureSection icon={BookOpenCheck} title="Glossário de Termos" badge="Referência">
          <div className="space-y-1">
            <Accordion type="single" collapsible className="w-full">
              {[
                { term: 'ATM (At The Money)', def: 'Opção cujo strike é igual ou muito próximo do preço atual do ativo-objeto.' },
                { term: 'OTM (Out of The Money)', def: 'Opção cujo strike está fora do dinheiro — call com strike acima do preço, ou put com strike abaixo do preço.' },
                { term: 'ITM (In The Money)', def: 'Opção cujo strike está dentro do dinheiro — call com strike abaixo do preço, ou put com strike acima.' },
                { term: 'Delta', def: 'Sensibilidade do preço da opção em relação à variação de R$1 no ativo-objeto. Delta 0,50 = a opção sobe R$0,50 se o ativo subir R$1.' },
                { term: 'Gamma', def: 'Taxa de variação do Delta. Quanto mais perto do vencimento e do strike, maior o Gamma.' },
                { term: 'Theta', def: 'Decaimento temporal da opção. Representa quanto valor a opção perde por dia que passa.' },
                { term: 'Vega', def: 'Sensibilidade do preço da opção à variação de 1% na volatilidade implícita.' },
                { term: 'Rho', def: 'Sensibilidade do preço da opção à variação de 1% na taxa de juros livre de risco.' },
                { term: 'IV (Implied Volatility)', def: 'Volatilidade implícita nos preços das opções pelo mercado. Quanto maior a IV, mais caras as opções.' },
                { term: 'IV Rank', def: 'Percentual que indica onde a IV atual se encontra em relação ao range dos últimos 12 meses. IV Rank 80% = IV está no top 20% do histórico.' },
                { term: 'DTE (Days to Expiry)', def: 'Dias úteis restantes até o vencimento da opção.' },
                { term: 'Breakeven', def: 'Preço do ativo no qual a operação não tem lucro nem prejuízo no vencimento.' },
                { term: 'CDI', def: 'Certificado de Depósito Interbancário — taxa de referência de juros no Brasil, usada como benchmark de renda fixa.' },
                { term: 'Payoff', def: 'Gráfico que mostra o resultado (lucro/prejuízo) de uma estrutura de opções em função do preço do ativo no vencimento.' },
                { term: 'Rolling (Rolagem)', def: 'Fechar a posição atual e abrir nova posição em vencimento ou strike diferente para estender ou ajustar a estratégia.' },
                { term: 'Spread', def: 'Diferença entre dois preços (bid/ask) ou combinação de duas ou mais opções formando uma estrutura.' },
                { term: 'Prêmio', def: 'Preço pago (ou recebido) para comprar (ou vender) uma opção.' },
                { term: 'Open Interest (OI)', def: 'Número de contratos de opção em aberto no mercado para determinado strike/vencimento.' },
              ].map((item, i) => (
                <AccordionItem key={i} value={`glossary-${i}`}>
                  <AccordionTrigger className="text-sm font-bold py-2">{item.term}</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">{item.def}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </FeatureSection>

        {/* ─── NOTIFICAÇÕES PUSH ─── */}
        <FeatureSection icon={Bell} title="Notificações Push" badge="PRO">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              O Opções PRO X envia <strong className="text-foreground">notificações push</strong> diretamente no navegador 
              quando o Rastreador de Box encontra oportunidades que superam o CDI configurado. Isso permite que você 
              não precise ficar olhando a tela constantemente.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'Ativação', desc: 'Clique em "Ativar Notificações" no Rastreador de Box para permitir alertas do navegador' },
                { label: 'Critério de Disparo', desc: 'O alerta é enviado quando um box atinge rentabilidade ≥ threshold configurado vs CDI' },
                { label: 'Histórico', desc: 'Todos os alertas disparados ficam registrados no painel de Histórico de Alertas do Box' },
                { label: 'Silenciar', desc: 'Desative as notificações a qualquer momento nas configurações do navegador' },
              ].map(item => (
                <div key={item.label} className="p-3 rounded-xl bg-muted/30 border border-border/50">
                  <p className="text-xs font-bold">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </FeatureSection>

        {/* FAQ Perguntas Frequentes */}
        <FeatureSection icon={HelpCircle} title="Perguntas Frequentes">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="q1">
              <AccordionTrigger className="text-sm font-bold">Preciso ter conta em alguma corretora?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                O Opções PRO X é uma ferramenta de simulação e análise. Você precisa de uma conta em corretora apenas para executar as operações reais. 
                A ferramenta não executa ordens — ela ajuda você a estudar e planejar antes de operar.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q2">
              <AccordionTrigger className="text-sm font-bold">Como funciona o OCR de imagem?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                Faça um print da tela de opções da sua corretora e faça upload na ferramenta. A IA irá identificar e extrair automaticamente os dados 
                das opções (código, strike, preço, tipo). Assista ao vídeo tutorial disponível na tela de upload para saber como fazer o print correto.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q3">
              <AccordionTrigger className="text-sm font-bold">O que significa "Eficiência CDI"?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                É o percentual que indica quanto a sua estratégia rende em relação ao CDI no mesmo período. 
                Por exemplo, 220% de eficiência CDI significa que sua operação rende 2,2 vezes mais que o CDI. 
                Valores acima de 100% indicam que a estratégia supera a renda fixa.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q4">
              <AccordionTrigger className="text-sm font-bold">Posso reabrir uma operação encerrada?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                Sim! Na aba Histórico, operações encerradas possuem o botão "Reabrir". Ao clicar, a operação volta 
                para o status "Ativa" e sai do Portfólio.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q5">
              <AccordionTrigger className="text-sm font-bold">A ferramenta constitui recomendação de investimento?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                Não. O Opções PRO X é uma ferramenta de simulação baseada nas regras da B3. Não constitui recomendação de investimento. 
                Sempre verifique com sua corretora e consulte um profissional antes de operar.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q6">
              <AccordionTrigger className="text-sm font-bold">Como a análise de IA funciona?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                A análise de IA utiliza inteligência artificial (OpenAI) para avaliar a estrutura montada. Ela analisa 
                o risco/retorno, identifica cenários favoráveis e desfavoráveis, e sugere possíveis ajustes. 
                É um recurso complementar para apoiar sua tomada de decisão.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q7">
              <AccordionTrigger className="text-sm font-bold">Qual a diferença entre plano Free e PRO?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                O plano Free permite acesso básico com limite de simulações. O plano PRO oferece simulações ilimitadas, 
                análise de IA ilimitada, OCR de imagens, comparação com CDI, Calculadora CDI x Opções, Rastreador de Box, 
                Rastreador de Collar, Tempo Real, Diversificador de Estratégias, Ticker Opções B3 (99.000+ opções), 
                Notificações Push e acesso completo a todos os recursos avançados da plataforma.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q8">
              <AccordionTrigger className="text-sm font-bold">O que é o ProfitRTD Bridge?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                É um programa que roda no seu computador e faz a ponte entre o Profit Pro (Nelogica) e o Opções PRO X via WebSocket. 
                Ele lê os dados de cotações em tempo real do Profit Pro e os envia para o navegador, 
                permitindo que os módulos Tempo Real e Rastreador de Box funcionem com dados ao vivo.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q9">
              <AccordionTrigger className="text-sm font-bold">Preciso do Profit Pro para usar o Tempo Real?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                Sim. Os dados ao vivo são obtidos via o Profit Pro (software da Nelogica). Você precisa ter o Profit Pro instalado, 
                aberto e logado, além do ProfitRTD Bridge rodando. Sem esses componentes, os módulos de tempo real não funcionam.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q10">
              <AccordionTrigger className="text-sm font-bold">O que significa "120% do CDI" no Rastreador de Box?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                Significa que o Box Spread rende 120% do que o CDI renderia no mesmo período. Na prática, se o CDI do período 
                é 0,90%, o box renderia 0,90% × 1,20 = 1,08%. Quanto maior o percentual acima de 100%, mais atrativo é o box em relação à renda fixa.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q11">
              <AccordionTrigger className="text-sm font-bold">O que é o Rastreador de Collar?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                O Rastreador de Collar monitora combinações de proteção de carteira (Ação + Put comprada + Call vendida) em tempo real. 
                Ele calcula automaticamente o piso de proteção (floor), o teto de ganho (cap) e o custo líquido da proteção, 
                ajudando você a encontrar collars de custo zero ou baixo custo para proteger suas posições.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q12">
              <AccordionTrigger className="text-sm font-bold">O que são as Gregas (Greeks) no gráfico de Payoff?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                As Gregas são medidas de sensibilidade da opção. No tooltip do gráfico de payoff, você vê: 
                <strong className="text-foreground"> Delta</strong> (sensibilidade ao preço), 
                <strong className="text-foreground"> Gamma</strong> (aceleração do delta), 
                <strong className="text-foreground"> Theta</strong> (decaimento temporal diário) e 
                <strong className="text-foreground"> Vega</strong> (sensibilidade à volatilidade). 
                Esses valores ajudam a entender o comportamento dinâmico da estrutura.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q13">
              <AccordionTrigger className="text-sm font-bold">Como funciona o Diversificador de Estratégias?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                O Diversificador permite criar planos de alocação do seu patrimônio entre diferentes estratégias de opções. 
                Defina o patrimônio total, crie estratégias com percentuais, níveis de risco e alavancagem. 
                O sistema calcula automaticamente o valor alocado e o saldo livre, ajudando a manter disciplina na gestão de risco.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q14">
              <AccordionTrigger className="text-sm font-bold">Posso usar o app no celular?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                Sim! O Opções PRO X é um PWA (Progressive Web App) — você pode instalar no celular clicando em 
                "Adicionar à Tela Inicial" no navegador. Funciona em Android e iOS. 
                O layout é totalmente responsivo e otimizado para telas menores. As funcionalidades de Tempo Real e Bridge 
                requerem que o Bridge esteja rodando no computador, mas análises salvas podem ser consultadas offline.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q15">
              <AccordionTrigger className="text-sm font-bold">A ferramenta funciona com quais corretoras?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                O simulador de análise funciona com prints de qualquer corretora — basta fazer upload da imagem. 
                Os módulos de Tempo Real e Rastreador de Box/Collar dependem especificamente do Profit Pro (Nelogica), 
                que é usado por corretoras como XP, Clear, Rico, Inter, BTG e outras que oferecem a plataforma.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q16">
              <AccordionTrigger className="text-sm font-bold">O que é o módulo Ticker Opções B3?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                É um banco de dados com mais de 99.000 opções listadas na B3. Você pode pesquisar por ticker, 
                filtrar por família, vencimento e tipo (Call/Put), identificar pares Call+Put automaticamente e 
                enviar tickers selecionados diretamente para o Tempo Real ou Rastreador de Box. 
                Também identifica oportunidades de Box Spread comparando pares de mesmo strike.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q17">
              <AccordionTrigger className="text-sm font-bold">O que é a Calculadora CDI x Opções?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                É uma ferramenta independente que compara o retorno de operações de opções com o CDI do mesmo período. 
                Informe o capital, a data de vencimento e o lucro esperado da sua estrutura para descobrir quantos % do CDI 
                ela equivale. Inclui cálculo automático de IR (tabela regressiva para CDI e 15% para opções) e gráfico de barras comparativo. 
                Acesse pelo menu em "CDI x Opções".
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </FeatureSection>

        {/* Aviso Legal */}
        <div className="p-4 rounded-xl bg-muted/30 border border-border/50 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Aviso Legal</span>
          </div>
          <p className="text-xs text-muted-foreground max-w-2xl mx-auto">
            O Opções PRO X é uma ferramenta de simulação e análise educacional baseada nas regras da B3. 
            Não constitui recomendação de investimento. Os resultados são simulados e podem não refletir condições reais de mercado. 
            Verifique com sua corretora antes de operar.
          </p>
        </div>
      </main>
    </div>
  );
}
