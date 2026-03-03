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

            ## REGRAS CRÍTICAS DE CÁLCULO (SIGA À RISCA):

            1. **CUSTO DA MONTAGEM**: Some TODOS os prêmios pagos (buy) e subtraia os prêmios recebidos (sell).
               - Se side="buy", o investidor PAGA o prêmio (price × quantity) → débito
               - Se side="sell", o investidor RECEBE o prêmio (price × quantity) → crédito
               - Custo líquido = total pago - total recebido. Se negativo, é CRÉDITO LÍQUIDO (dinheiro no bolso).

            2. **RISCO ZERO**: Se o crédito recebido ≥ todas as obrigações possíveis no vencimento, o risco é ZERO.
               - Exemplo: Venda de Call strike 100 + Compra de Call strike 102, crédito de R$3,00 → spread de R$2,00, crédito > spread = RISCO ZERO.
               - Exemplo: Call Spread de Crédito onde crédito ≥ diferença entre strikes = RISCO ZERO.
               - NUNCA diga que há risco/prejuízo quando o crédito líquido cobre 100% da exposição máxima.

            3. **LUCRO E PREJUÍZO MÁXIMO**:
               - Para spreads: exposição máxima = diferença entre strikes × quantidade.
               - Lucro máximo de crédito = crédito líquido recebido (quando todas as opções viram pó).
               - Prejuízo máximo = exposição máxima - crédito recebido. SE negativo ou zero = SEM PREJUÍZO.
               - Para compras a seco: prejuízo máximo = prêmio pago. Lucro = ilimitado (call) ou até strike (put).

            4. **BREAKEVEN**: Calcule o ponto exato onde lucro = 0.
               - Call Spread Crédito: breakeven = strike vendido + crédito recebido por unidade.
               - Put Spread Crédito: breakeven = strike vendido - crédito recebido por unidade.
               - Para estruturas sem risco, pode não haver breakeven de prejuízo.

            5. **CENÁRIOS**: Descreva o que acontece com valores reais em R$.
               - Se ativo sobe MUITO acima dos strikes → o que acontece?
               - Se ativo fica entre os strikes → qual o resultado em R$?
               - Se ativo cai abaixo dos strikes → qual o resultado em R$?

            6. **VALIDAÇÃO FINAL**: Antes de retornar, VERIFIQUE:
               - Se disse "prejuízo" ou "risco", confirme que realmente existe cenário de perda.
               - Se o crédito líquido > exposição máxima, risk_level DEVE ser "Baixo" e NÃO pode haver "cons" sobre prejuízo.
               - NUNCA invente riscos que não existem matematicamente.

            Retorne APENAS este JSON:
            {
              "verdict": "Compra Forte" | "Atrativo" | "Neutro" | "Evitar" | "Perigoso",
              "score": number (0-10),
              "risk_level": "Baixo" | "Moderado" | "Alto" | "Crítico",
              "cdi_comparison": "string comparando retorno vs CDI",
              "strategy_explanation": "string explicando como as pernas interagem",
              "scenarios": {
                "up": "cenário com valores em R$",
                "flat": "cenário com valores em R$",
                "down": "cenário com valores em R$"
              },
              "pros": ["string"],
              "cons": ["string"],
              "summary": "resumo executivo preciso",
              "probability_success": "Alta" | "Média" | "Baixa"
            }`
          },
          { 
            role: "user", 
            content: `Analise esta estrutura com PRECISÃO MATEMÁTICA. Calcule os valores reais antes de classificar risco.

Dados: ${JSON.stringify({ legs, metrics, cdiRate, daysToExpiry })}

IMPORTANTE: Use os dados de "metrics" como referência (maxGain, maxLoss, breakevens, netCost) mas RECALCULE você mesmo para validar. Se metrics.maxLoss for 0 ou positivo, a estrutura é sem risco — respeite isso.` 
          },
        ],
        response_format: { type: "json_object" }
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