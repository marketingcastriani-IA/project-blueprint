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

    const isDebit = metrics.montageTotal > 0 || metrics.netCost > 0
    const costLabel = isDebit ? "Custo da montagem (débito)" : "Crédito líquido recebido"

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
            content: `Você é um analista sênior de derivativos da B3. Retorne um JSON preciso e CONCISO.

## REGRA ABSOLUTA: metrics é VERDADE — NÃO recalcule nada.
Use os valores de metrics diretamente: maxGain, maxLoss, breakevens, netCost, isRiskFree, montageTotal, realBreakeven.

## TERMINOLOGIA:
- montageTotal > 0 → "Custo da montagem" ou "Débito líquido". NUNCA diga "crédito" quando é débito.
- montageTotal < 0 → "Crédito líquido recebido".

## CENÁRIOS: MÁXIMO 2 FRASES CURTAS cada, com resultado em R$.
Exemplo: "Lucro de R$ 66,00. Call exercida, put expira sem valor."

## COERÊNCIA:
- isRiskFree=true → risk_level="Baixo", ZERO menção a prejuízo em cenários e cons.
- maxLoss >= 0 → ZERO cenários com prejuízo.
- Lucro máximo = metrics.maxGain. Prejuízo máximo = metrics.maxLoss.
- Breakeven = metrics.realBreakeven ou metrics.breakevens.

## PROS/CONS: máximo 3 itens cada, frase curta.

Retorne APENAS este JSON (sem markdown):
{
  "verdict": "Compra Forte" | "Atrativo" | "Neutro" | "Evitar" | "Perigoso",
  "score": number (0-10),
  "risk_level": "Baixo" | "Moderado" | "Alto" | "Crítico",
  "cdi_comparison": "frase curta vs CDI",
  "strategy_explanation": "max 2 frases sobre a estratégia",
  "scenarios": {
    "up": "max 2 frases com R$",
    "flat": "max 2 frases com R$",
    "down": "max 2 frases com R$"
  },
  "pros": ["max 3 curtos"],
  "cons": ["max 3 curtos"],
  "summary": "2 frases com valores exatos de metrics",
  "probability_success": "Alta" | "Média" | "Baixa"
}`
          },
          { 
            role: "user", 
            content: `Analise esta estrutura. NÃO recalcule — use metrics como verdade.

${costLabel}: R$ ${Math.abs(metrics.montageTotal || metrics.netCost || 0).toFixed(2)}
Lucro máximo: ${typeof metrics.maxGain === 'string' ? metrics.maxGain : 'R$ ' + (metrics.maxGain || 0).toFixed(2)}
Risco máximo: ${typeof metrics.maxLoss === 'string' ? metrics.maxLoss : 'R$ ' + Math.abs(metrics.maxLoss || 0).toFixed(2)}
Risco Zero: ${metrics.isRiskFree ? 'SIM' : 'NÃO'}
Breakeven: ${JSON.stringify(metrics.realBreakeven || metrics.breakevens)}

Dados completos: ${JSON.stringify({ legs, metrics, cdiRate, daysToExpiry })}

REGRAS: cenários MAX 2 frases. Pros/Cons MAX 3 itens. Se isRiskFree=true, risk_level="Baixo" sem prejuízo. NUNCA diga "crédito" se montageTotal > 0.` 
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
    
    // Parse and validate against metrics
    let parsed
    try {
      parsed = JSON.parse(content)
    } catch {
      return new Response(content, {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Force coherence with programmatic metrics
    if (metrics.isRiskFree && parsed.risk_level !== "Baixo") {
      parsed.risk_level = "Baixo"
    }
    if (metrics.isRiskFree && parsed.cons) {
      parsed.cons = parsed.cons.filter((c: string) => 
        !c.toLowerCase().includes('prejuízo') && 
        !c.toLowerCase().includes('perda') &&
        !c.toLowerCase().includes('risco')
      )
    }
    
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
