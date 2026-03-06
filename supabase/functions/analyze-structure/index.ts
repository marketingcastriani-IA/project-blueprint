import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Calculate exact payoff at a given price for a set of legs
function calculatePayoffAtPrice(legs: any[], price: number): number {
  let total = 0
  for (const leg of legs) {
    const qty = leg.quantity || 100
    const side = leg.side === 'buy' ? 1 : -1

    if (leg.option_type === 'stock') {
      total += (price - leg.price) * qty * side
    } else if (leg.option_type === 'call') {
      const intrinsic = Math.max(0, price - leg.strike)
      total += (intrinsic - leg.price) * qty * side
    } else if (leg.option_type === 'put') {
      const intrinsic = Math.max(0, leg.strike - price)
      total += (intrinsic - leg.price) * qty * side
    }
  }
  return Math.round(total * 100) / 100
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

    const isDebit = (metrics.montageTotal || metrics.netCost || 0) > 0
    const costLabel = isDebit ? "Custo da montagem (DÉBITO)" : "Crédito líquido recebido"
    const costValue = Math.abs(metrics.montageTotal || metrics.netCost || 0)
    const strategyName = metrics.strategyLabel || 'Estrutura de Opções'

    // Pre-calculate scenario payoffs
    const strikes = legs.filter((l: any) => l.option_type !== 'stock').map((l: any) => l.strike).sort((a: number, b: number) => a - b)
    const minStrike = strikes[0] || 0
    const maxStrike = strikes[strikes.length - 1] || 0
    const stockLeg = legs.find((l: any) => l.option_type === 'stock')
    const stockPrice = stockLeg?.price || 0
    const breakeven = metrics.realBreakeven || (Array.isArray(metrics.breakevens) ? metrics.breakevens[0] : metrics.breakevens) || 0

    // Pre-calculate CDI comparison
    const montageTotal = Math.abs(metrics.montageTotal || metrics.netCost || 0)
    const maxGainNum = typeof metrics.maxGain === 'number' ? metrics.maxGain : 0
    const roiStructure = montageTotal > 0 ? (maxGainNum / montageTotal) * 100 : 0
    const cdiReturnValue = metrics.cdiReturn || 0
    const roiCdi = montageTotal > 0 ? (cdiReturnValue / montageTotal) * 100 : 0
    const cdiEfficiency = roiCdi > 0 ? Math.round((roiStructure / roiCdi) * 100) : 0
    const cdiComparisonText = cdiEfficiency > 100 
      ? `A estrutura rende ${cdiEfficiency}% do CDI, SUPERANDO o CDI em ${(cdiEfficiency - 100)}%.`
      : cdiEfficiency === 100
        ? `A estrutura empata com o CDI no período.`
        : `A estrutura rende ${cdiEfficiency}% do CDI, ficando ABAIXO do CDI em ${(100 - cdiEfficiency)}%.`

    // Calculate EXACT payoffs at specific prices
    const priceUp = maxStrike + 3
    const priceFlat = breakeven
    const priceDown = minStrike - 3

    const payoffUp = calculatePayoffAtPrice(legs, priceUp)
    const payoffFlat = calculatePayoffAtPrice(legs, priceFlat)
    const payoffDown = calculatePayoffAtPrice(legs, priceDown)

    // Per-leg breakdown for each scenario
    function legBreakdown(legs: any[], price: number): string {
      const parts: string[] = []
      for (const leg of legs) {
        const qty = leg.quantity || 100
        const side = leg.side === 'buy' ? 1 : -1
        const sideLabel = leg.side === 'buy' ? 'COMPRA' : 'VENDA'
        let result = 0
        let detail = ''

        if (leg.option_type === 'stock') {
          result = (price - leg.price) * qty * side
          detail = `${sideLabel} AÇÃO ${leg.asset}: (${price.toFixed(2)} - ${leg.price.toFixed(2)}) × ${qty} = R$ ${result.toFixed(2)}`
        } else if (leg.option_type === 'call') {
          const intrinsic = Math.max(0, price - leg.strike)
          result = (intrinsic - leg.price) * qty * side
          const exercida = intrinsic > 0 ? 'EXERCIDA' : 'expira sem valor'
          detail = `${sideLabel} CALL ${leg.asset} strike ${leg.strike}: ${exercida}, resultado = R$ ${result.toFixed(2)}`
        } else if (leg.option_type === 'put') {
          const intrinsic = Math.max(0, leg.strike - price)
          result = (intrinsic - leg.price) * qty * side
          const exercida = intrinsic > 0 ? 'EXERCIDA' : 'expira sem valor'
          detail = `${sideLabel} PUT ${leg.asset} strike ${leg.strike}: ${exercida}, resultado = R$ ${result.toFixed(2)}`
        }
        parts.push(detail)
      }
      return parts.join(' | ')
    }

    const breakdownUp = legBreakdown(legs, priceUp)
    const breakdownFlat = legBreakdown(legs, priceFlat)
    const breakdownDown = legBreakdown(legs, priceDown)

    console.log(`[analyze-structure] Payoffs calculados: UP(${priceUp})=${payoffUp}, FLAT(${priceFlat})=${payoffFlat}, DOWN(${priceDown})=${payoffDown}`)

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

## REGRA ABSOLUTA: TODOS os valores numéricos foram pré-calculados. NÃO recalcule NADA.
Use os valores EXATOS fornecidos para cada cenário e para as métricas.

## TERMINOLOGIA:
- montageTotal > 0 → "Custo da montagem". NUNCA diga "crédito" quando é débito.
- montageTotal < 0 → "Crédito líquido recebido".

## CENÁRIOS: Use os PAYOFFS PRÉ-CALCULADOS fornecidos.
Para cada cenário, descreva em 3-4 frases:
1. O preço de referência do cenário
2. O que acontece com cada perna (use o breakdown fornecido)
3. O resultado TOTAL EXATO (use o payoff pré-calculado, NÃO invente outro)

## COERÊNCIA:
- isRiskFree=true → risk_level="Baixo", ZERO menção a prejuízo.
- Use EXATAMENTE os payoffs pré-calculados nos cenários.
- PROS/CONS: máximo 3 itens cada, frases curtas.

Retorne APENAS JSON (sem markdown):
{
  "verdict": "Compra Forte" | "Atrativo" | "Neutro" | "Evitar" | "Perigoso",
  "score": number (0-10),
  "risk_level": "Baixo" | "Moderado" | "Alto" | "Crítico",
  "cdi_comparison": "use a comparação CDI pré-calculada fornecida",
  "strategy_explanation": "2-3 frases sobre a estratégia, COMECE com o nome da estratégia",
  "scenarios": {
    "up": "3-4 frases com o payoff EXATO pré-calculado",
    "flat": "3-4 frases com o payoff EXATO pré-calculado",
    "down": "3-4 frases com o payoff EXATO pré-calculado"
  },
  "pros": ["max 3"],
  "cons": ["max 3"],
  "summary": "COMECE com 'Estratégia: [NOME].' Depois 2-3 frases com valores exatos incluindo comparação CDI",
  "probability_success": "Alta" | "Média" | "Baixa"
}`
          },
          { 
            role: "user", 
            content: `Analise esta estrutura. TODOS OS PAYOFFS FORAM PRÉ-CALCULADOS — use-os EXATAMENTE.

NOME DA ESTRATÉGIA: ${strategyName}

ESTRUTURA:
${legs.map((l: any) => `- ${l.side === 'buy' ? 'COMPRA' : 'VENDA'} ${l.quantity}x ${l.option_type === 'stock' ? 'AÇÃO' : l.option_type.toUpperCase()} ${l.asset} | Strike: ${l.strike} | Preço: R$ ${l.price}`).join('\n')}

MÉTRICAS (VERDADE ABSOLUTA):
- ${costLabel}: R$ ${costValue.toFixed(2)}
- Lucro máximo: ${typeof metrics.maxGain === 'string' ? metrics.maxGain : 'R$ ' + (metrics.maxGain || 0).toFixed(2)}
- Lucro mínimo garantido: R$ ${Math.min(payoffUp, payoffFlat, payoffDown).toFixed(2)}
- Risco máximo: R$ ${Math.abs(metrics.maxLoss || 0).toFixed(2)}${metrics.maxLoss >= 0 ? ' (SEM RISCO — RISCO ZERO)' : ''}
- Breakeven: R$ ${breakeven}
- Risco Zero: ${metrics.isRiskFree ? 'SIM' : 'NÃO'}

═══════ COMPARAÇÃO CDI PRÉ-CALCULADA (VERDADE ABSOLUTA) ═══════
- ROI da estrutura: ${roiStructure.toFixed(2)}%
- ROI do CDI: ${roiCdi.toFixed(2)}%
- Eficiência vs CDI: ${cdiEfficiency}%
- Veredicto CDI: ${cdiComparisonText}
⚠️ USE EXATAMENTE este veredicto no campo "cdi_comparison". NÃO invente outro.

═══════ CENÁRIOS PRÉ-CALCULADOS (USE ESTES VALORES EXATOS) ═══════

📈 SE SUBIR (ativo a R$ ${priceUp.toFixed(2)}):
Breakdown: ${breakdownUp}
>>> RESULTADO TOTAL: R$ ${payoffUp.toFixed(2)} <<<

📊 SE LATERAL (ativo a R$ ${priceFlat.toFixed(2)} = breakeven):
Breakdown: ${breakdownFlat}
>>> RESULTADO TOTAL: R$ ${payoffFlat.toFixed(2)} <<<

📉 SE CAIR (ativo a R$ ${priceDown.toFixed(2)}):
Breakdown: ${breakdownDown}
>>> RESULTADO TOTAL: R$ ${payoffDown.toFixed(2)} <<<

REGRAS ABSOLUTAS:
- O "summary" DEVE começar com "Estratégia: ${strategyName}."
- O "cdi_comparison" DEVE usar o veredicto CDI pré-calculado acima
- O resultado do cenário UP deve ser EXATAMENTE R$ ${payoffUp.toFixed(2)}
- O resultado do cenário FLAT deve ser EXATAMENTE R$ ${payoffFlat.toFixed(2)}
- O resultado do cenário DOWN deve ser EXATAMENTE R$ ${payoffDown.toFixed(2)}
- NUNCA invente valores diferentes dos pré-calculados
- Se isRiskFree=true e algum payoff < 0, algo está errado mas ainda assim use o valor calculado
- NUNCA diga "crédito" se montageTotal > 0
- Se eficiência CDI < 100%, NUNCA diga que supera o CDI`
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
    
    let parsed
    try {
      parsed = JSON.parse(content)
    } catch {
      console.error("[analyze-structure] Failed to parse AI response:", content.substring(0, 200))
      return new Response(content, {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Force coherence
    if (metrics.isRiskFree && parsed.risk_level !== "Baixo") {
      parsed.risk_level = "Baixo"
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
