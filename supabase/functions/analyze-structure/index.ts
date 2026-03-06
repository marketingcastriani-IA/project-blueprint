import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { legs, metrics, cdiRate, daysToExpiry } = await req.json()
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")
    
    if (!LOVABLE_API_KEY) {
      console.error("[analyze-structure] LOVABLE_API_KEY não configurada")
      throw new Error("LOVABLE_API_KEY is not configured")
    }

    console.log("[analyze-structure] Iniciando análise profunda da estrutura...")

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um analista sênior de derivativos e estrategista quantitativo da B3.
            Sua tarefa é analisar a estrutura de opções enviada e retornar um JSON PRECISO.

            ## REGRA ABSOLUTA: USE OS DADOS DE "metrics" COMO VERDADE
            Os valores em "metrics" (maxGain, maxLoss, breakevens, netCost, isRiskFree, strategyLabel, montageTotal, realBreakeven) foram calculados programaticamente com precisão matemática.
            Você NÃO DEVE recalcular nem contradizer esses valores. USE-OS diretamente na sua análise.

            ## INSTRUÇÕES PARA CENÁRIOS (use valores reais em R$):
            Para cada cenário, calcule o resultado EXATO no vencimento considerando:
            - O custo/crédito da montagem (metrics.netCost ou metrics.montageTotal)
            - O exercício ou não de cada opção no cenário
            - O resultado da ação (se houver) = (preço no cenário - preço de compra) × quantidade

            ### Como calcular cada cenário:
            1. **Se ativo SOBE** (acima do maior strike): Determine quais opções são exercidas, calcule o valor intrínseco de cada uma, some com o resultado da ação e o crédito/débito da montagem.
            2. **Se ativo fica LATERAL** (entre os strikes ou próximo ao preço de entrada): Mesma lógica, verificando quais opções ficam ITM/OTM.
            3. **Se ativo CAI** (abaixo do menor strike): Mesma lógica.

            ## COERÊNCIA OBRIGATÓRIA:
            - Se metrics.isRiskFree === true, NÃO pode haver cenário com prejuízo. risk_level DEVE ser "Baixo".
            - Se metrics.maxLoss >= 0, NÃO mencione prejuízo em nenhum cenário nem em "cons".
            - Se metrics.maxLoss < 0, o prejuízo máximo é EXATAMENTE |metrics.maxLoss| reais — não invente outro valor.
            - O lucro máximo é EXATAMENTE metrics.maxGain (ou "Ilimitado" se for string).
            - O breakeven é EXATAMENTE metrics.realBreakeven ou metrics.breakevens.
            - NUNCA contradiga os números de metrics nos cenários ou no summary.

            Retorne APENAS este JSON (sem markdown):
            {
              "verdict": "Compra Forte" | "Atrativo" | "Neutro" | "Evitar" | "Perigoso",
              "score": number (0-10),
              "risk_level": "Baixo" | "Moderado" | "Alto" | "Crítico",
              "cdi_comparison": "string comparando retorno vs CDI",
              "strategy_explanation": "string explicando como as pernas interagem",
              "scenarios": {
                "up": "cenário detalhado com cálculos em R$",
                "flat": "cenário detalhado com cálculos em R$",
                "down": "cenário detalhado com cálculos em R$"
              },
              "pros": ["string"],
              "cons": ["string"],
              "summary": "resumo executivo usando EXATAMENTE os valores de metrics",
              "probability_success": "Alta" | "Média" | "Baixa"
            }`
          },
          { 
            role: "user", 
            content: `Analise esta estrutura com PRECISÃO MATEMÁTICA. Calcule os valores reais antes de classificar risco.

Dados: ${JSON.stringify({ legs, metrics, cdiRate, daysToExpiry })}

Os valores em "metrics" são VERDADE ABSOLUTA calculada programaticamente. NÃO recalcule — use-os diretamente nos cenários e no resumo.

CHECKLIST antes de responder:
1. Lucro máximo nos cenários = metrics.maxGain? ✓
2. Prejuízo máximo = metrics.maxLoss? Se >= 0, ZERO cenários com prejuízo? ✓  
3. metrics.isRiskFree=true → risk_level="Baixo", nenhum "cons" sobre prejuízo? ✓
4. Breakeven bate com metrics.realBreakeven ou metrics.breakevens? ✓
5. Nenhum valor inventado que contradiz metrics? ✓` 
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`AI Gateway error: ${response.status}`)
    }

    const result = await response.json()
    let content = result.choices[0].message.content
    content = content.replace(/```json\n?/, '').replace(/\n?```/, '').trim()
    
    return new Response(content, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})