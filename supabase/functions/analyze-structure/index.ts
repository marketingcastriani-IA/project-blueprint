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
            Sua tarefa é analisar a estrutura de opções enviada e retornar um JSON detalhado para um investidor profissional.
            
            Estrutura do JSON esperada:
            {
              "verdict": "Compra Forte" | "Atrativo" | "Neutro" | "Evitar" | "Perigoso",
              "score": number (0-10),
              "risk_level": "Baixo" | "Moderado" | "Alto" | "Crítico",
              "cdi_comparison": "Explicação curta da eficiência vs CDI",
              "strategy_explanation": "Explicação técnica de como as pernas interagem entre si",
              "scenarios": {
                "up": "O que acontece se o ativo subir (lucro máximo, delta, etc)",
                "flat": "O que acontece se o ativo ficar parado (theta decay, breakeven)",
                "down": "O que acontece se o ativo cair (proteção, prejuízo máximo)"
              },
              "pros": ["string"],
              "cons": ["string"],
              "summary": "Resumo executivo da operação",
              "probability_success": "Alta" | "Média" | "Baixa"
            }`
          },
          { 
            role: "user", 
            content: `Analise esta estrutura financeira: ${JSON.stringify({ legs, metrics, cdiRate, daysToExpiry })}. 
            Seja técnico, preciso e use terminologia de mercado (B3).` 
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