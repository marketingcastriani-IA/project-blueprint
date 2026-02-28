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

    console.log("[analyze-structure] Iniciando análise da estrutura...", { legsCount: legs.length })

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Você é um analista sênior de derivativos da B3. Analise a estrutura de opções e retorne APENAS um JSON válido.
            Estrutura do JSON:
            {
              "verdict": "Compra Forte" | "Atrativo" | "Neutro" | "Evitar" | "Perigoso",
              "score": number (0-10),
              "risk_level": "Baixo" | "Moderado" | "Alto" | "Crítico",
              "cdi_comparison": "string curta",
              "pros": ["string"],
              "cons": ["string"],
              "summary": "string",
              "probability_success": "Alta" | "Média" | "Baixa"
            }`
          },
          { 
            role: "user", 
            content: `Analise: ${JSON.stringify({ legs, metrics, cdiRate, daysToExpiry })}` 
          },
        ],
        response_format: { type: "json_object" }
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[analyze-structure] Erro no Gateway de IA: ${response.status}`, errorText)
      throw new Error(`AI Gateway error: ${response.status}`)
    }

    const result = await response.json()
    let content = result.choices[0].message.content
    
    // Limpeza básica caso a IA retorne markdown
    content = content.replace(/```json\n?/, '').replace(/\n?```/, '').trim()
    
    const analysis = JSON.parse(content)
    console.log("[analyze-structure] Análise concluída com sucesso")

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (e: any) {
    console.error("[analyze-structure] Erro crítico:", e.message)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})