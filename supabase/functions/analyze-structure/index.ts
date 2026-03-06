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

    console.log("[analyze-structure] Iniciando análise da estrutura...")
    console.log("[analyze-structure] Metrics recebidas:", JSON.stringify(metrics))

    const isDebit = (metrics.montageTotal || metrics.netCost || 0) > 0
    const costLabel = isDebit ? "Custo da montagem (DÉBITO)" : "Crédito líquido recebido"
    const costValue = Math.abs(metrics.montageTotal || metrics.netCost || 0)

    // Pre-calculate scenario hints for the AI
    const strikes = legs.filter((l: any) => l.option_type !== 'stock').map((l: any) => l.strike).sort((a: number, b: number) => a - b)
    const minStrike = strikes[0] || 0
    const maxStrike = strikes[strikes.length - 1] || 0
    const stockLeg = legs.find((l: any) => l.option_type === 'stock')
    const stockPrice = stockLeg?.price || 0

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
            content: `Você é um analista sênior de derivativos da B3. Retorne um JSON preciso.

## REGRA ABSOLUTA: metrics é VERDADE — NÃO recalcule maxGain, maxLoss, breakevens.
Use os valores de metrics diretamente.

## TERMINOLOGIA:
- montageTotal > 0 → "Custo da montagem" ou "Débito líquido". NUNCA diga "crédito" quando é débito.
- montageTotal < 0 → "Crédito líquido recebido".

## CENÁRIOS — DETALHE CADA CENÁRIO COM 3-5 FRASES:
Para cada cenário (up/flat/down), explique:
1. O que acontece com CADA PERNA da estrutura (exercida ou expira sem valor)
2. O resultado financeiro de cada perna em R$
3. O resultado TOTAL líquido em R$ (já descontando o custo/crédito da montagem)

### COMO CALCULAR CADA CENÁRIO NO VENCIMENTO:
- Para cada opção, calcule: valor intrínseco = max(0, preço_cenário - strike) para CALL ou max(0, strike - preço_cenário) para PUT
- Multiplique pelo lado: compra = +1, venda = -1
- Multiplique pela quantidade
- Some o resultado da ação (se houver): (preço_cenário - preço_compra) × quantidade × lado
- Subtraia o custo da montagem (ou some o crédito)

### IMPORTANTE PARA CENÁRIOS:
- "Se SUBIR" = ativo VAI ACIMA do maior strike. Calcule o payoff com preço ACIMA de ${maxStrike}.
- "Se LATERAL" = ativo fica ENTRE os strikes ou próximo ao breakeven. Use preço ≈ ${metrics.realBreakeven || ((minStrike + maxStrike) / 2)}.
- "Se CAIR" = ativo VAI ABAIXO do menor strike. Calcule o payoff com preço ABAIXO de ${minStrike}.
- Os valores de cada cenário DEVEM ser coerentes com o gráfico de payoff.
- O lucro máximo (metrics.maxGain = ${typeof metrics.maxGain === 'string' ? metrics.maxGain : 'R$ ' + (metrics.maxGain || 0).toFixed(2)}) ocorre no cenário onde o payoff é máximo.
- O prejuízo máximo (metrics.maxLoss = R$ ${(metrics.maxLoss || 0).toFixed(2)}) ocorre no cenário onde o payoff é mínimo.

## COERÊNCIA OBRIGATÓRIA:
- isRiskFree=true → risk_level="Baixo", ZERO menção a prejuízo em cenários e cons.
- maxLoss >= 0 → ZERO cenários com prejuízo.
- O valor de CADA cenário deve ser DIFERENTE (up ≠ flat ≠ down) a menos que a estrutura assim determine.
- NUNCA coloque o lucro máximo no cenário errado.

## PROS/CONS: máximo 3 itens cada, frase objetiva.

Retorne APENAS este JSON (sem markdown):
{
  "verdict": "Compra Forte" | "Atrativo" | "Neutro" | "Evitar" | "Perigoso",
  "score": number (0-10),
  "risk_level": "Baixo" | "Moderado" | "Alto" | "Crítico",
  "cdi_comparison": "frase comparando retorno vs CDI",
  "strategy_explanation": "2-3 frases explicando como as pernas interagem",
  "scenarios": {
    "up": "3-5 frases detalhando cada perna e resultado total em R$",
    "flat": "3-5 frases detalhando cada perna e resultado total em R$",
    "down": "3-5 frases detalhando cada perna e resultado total em R$"
  },
  "pros": ["max 3 itens"],
  "cons": ["max 3 itens"],
  "summary": "2-3 frases com valores exatos de metrics",
  "probability_success": "Alta" | "Média" | "Baixa"
}`
          },
          { 
            role: "user", 
            content: `Analise esta estrutura. NÃO recalcule maxGain/maxLoss — use metrics como verdade.

ESTRUTURA:
${legs.map((l: any) => `- ${l.side === 'buy' ? 'COMPRA' : 'VENDA'} ${l.quantity}x ${l.option_type === 'stock' ? 'AÇÃO' : l.option_type.toUpperCase()} ${l.asset} | Strike: ${l.strike} | Preço: R$ ${l.price}`).join('\n')}

MÉTRICAS CALCULADAS (VERDADE ABSOLUTA):
- ${costLabel}: R$ ${costValue.toFixed(2)}
- Lucro máximo: ${typeof metrics.maxGain === 'string' ? metrics.maxGain : 'R$ ' + (metrics.maxGain || 0).toFixed(2)}
- Risco máximo: R$ ${Math.abs(metrics.maxLoss || 0).toFixed(2)}${metrics.maxLoss >= 0 ? ' (SEM RISCO)' : ''}
- Risco Zero: ${metrics.isRiskFree ? 'SIM — nenhum cenário pode ter prejuízo' : 'NÃO'}
- Breakeven: R$ ${metrics.realBreakeven || JSON.stringify(metrics.breakevens)}
- Strikes: ${JSON.stringify(strikes)}
${stockLeg ? `- Preço da ação na montagem: R$ ${stockPrice}` : ''}

CDI: ${cdiRate}% a.a. | Dias até vencimento: ${daysToExpiry}

REGRAS PARA CENÁRIOS:
- Detalhe o que acontece com cada perna em cada cenário
- Calcule o resultado de cada perna separadamente e some
- O resultado TOTAL deve bater com o gráfico de payoff
- Se isRiskFree=true, NENHUM cenário pode mostrar prejuízo
- NUNCA diga "crédito" se montageTotal > 0 (é DÉBITO/CUSTO)` 
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[analyze-structure] AI Gateway error:", response.status, errorText)
      throw new Error(`AI Gateway error: ${response.status}`)
    }

    const result = await response.json()
    let content = result.choices[0].message.content
    content = content.replace(/```json\n?/, '').replace(/\n?```/, '').trim()
    
    // Parse and validate against metrics
    let parsed
    try {
      parsed = JSON.parse(content)
    } catch {
      console.error("[analyze-structure] Failed to parse AI response:", content.substring(0, 200))
      return new Response(content, {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Force coherence with programmatic metrics
    if (metrics.isRiskFree && parsed.risk_level !== "Baixo") {
      parsed.risk_level = "Baixo"
      console.log("[analyze-structure] Forçado risk_level para Baixo (isRiskFree=true)")
    }
    if (metrics.isRiskFree && parsed.cons) {
      parsed.cons = parsed.cons.filter((c: string) => 
        !c.toLowerCase().includes('prejuízo') && 
        !c.toLowerCase().includes('perda') &&
        !c.toLowerCase().includes('risco de')
      )
    }
    // Fix "crédito" when it's actually a debit
    if (isDebit) {
      const fixCredit = (text: string) => text.replace(/crédito\s*(líquido|recebido)?/gi, 'custo da montagem')
      if (parsed.summary) parsed.summary = fixCredit(parsed.summary)
      if (parsed.strategy_explanation) parsed.strategy_explanation = fixCredit(parsed.strategy_explanation)
      if (parsed.scenarios) {
        if (parsed.scenarios.up) parsed.scenarios.up = fixCredit(parsed.scenarios.up)
        if (parsed.scenarios.flat) parsed.scenarios.flat = fixCredit(parsed.scenarios.flat)
        if (parsed.scenarios.down) parsed.scenarios.down = fixCredit(parsed.scenarios.down)
      }
    }
    
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (e: any) {
    console.error("[analyze-structure] Error:", e.message)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
