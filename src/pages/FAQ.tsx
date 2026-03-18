import Header from '@/components/Header';
import { ProfessionalHeader, ProfessionalCard } from '@/components/ProfessionalLayout';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { 
  BookOpen, Upload, BarChart3, History, Briefcase, TrendingUp, 
  Zap, Target, ArrowRight, CheckCircle2, AlertTriangle, HelpCircle,
  Camera, Brain, PieChart, Calculator, Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
              <Badge variant="outline" className="text-[9px] border-primary/30 text-primary font-bold uppercase tracking-widest">
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
        <ProfessionalHeader 
          title="Manual do Usuário" 
          subtitle="Guia completo para dominar o Opções PRO X — da simulação ao controle do portfólio"
        />

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
                  <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </FeatureSection>

        {/* Como Criar uma Análise */}
        <FeatureSection icon={Upload} title="Como Criar uma Análise" badge="Passo a Passo">
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

        {/* Comparação com CDI */}
        <FeatureSection icon={TrendingUp} title="Comparação com CDI" badge="Recurso PRO">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              A comparação com CDI é um dos recursos mais poderosos do Opções PRO X. Ela permite avaliar se a sua estratégia 
              de opções supera o rendimento do CDI (Certificado de Depósito Interbancário), que é a taxa de referência 
              para investimentos de renda fixa no Brasil.
            </p>
            
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
                  <span><strong className="text-foreground">Dias até o Vencimento:</strong> Utiliza os dias úteis até o vencimento da opção para projetar o retorno proporcional do CDI.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                  <span><strong className="text-foreground">Eficiência CDI:</strong> Mostra o percentual do CDI que a sua estratégia entrega. Exemplo: se a eficiência é 180%, significa que sua operação rende 1,8x mais que o CDI no mesmo período.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                  <span><strong className="text-foreground">Gráfico Comparativo:</strong> No gráfico de payoff, uma linha horizontal representa o retorno do CDI, permitindo visualizar em quais cenários de preço a sua estratégia supera ou fica abaixo da renda fixa.</span>
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

        {/* Aba Histórico */}
        <FeatureSection icon={History} title="Aba Histórico" badge="Gestão">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              A aba <strong className="text-foreground">Histórico</strong> é o centro de controle das suas análises. 
              Todas as operações salvas aparecem aqui, organizadas por status (Ativas e Encerradas) com filtros por mês e ano.
            </p>

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
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                <span>Visualize todas as operações encerradas em um só lugar</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                <span>Acompanhe datas de criação e encerramento de cada trade</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                <span>Acesse os detalhes completos clicando em qualquer operação</span>
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
          <p className="text-sm text-muted-foreground leading-relaxed">
            O módulo <strong className="text-foreground">Diversificador</strong> permite criar planos de alocação para distribuir 
            seu patrimônio entre diferentes estratégias de opções. Defina percentuais, frequências, nível de risco e alavancagem 
            para cada estratégia, mantendo um controle disciplinado da sua exposição ao mercado.
          </p>
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
                Por exemplo, 150% de eficiência CDI significa que sua operação rende 1,5 vezes mais que o CDI. 
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
                análise de IA, comparação com CDI, diversificador de estratégias e acesso a todos os recursos avançados da plataforma.
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
          <p className="text-[10px] text-muted-foreground max-w-2xl mx-auto">
            O Opções PRO X é uma ferramenta de simulação e análise educacional baseada nas regras da B3. 
            Não constitui recomendação de investimento. Os resultados são simulados e podem não refletir condições reais de mercado. 
            Verifique com sua corretora antes de operar.
          </p>
        </div>
      </main>
    </div>
  );
}
