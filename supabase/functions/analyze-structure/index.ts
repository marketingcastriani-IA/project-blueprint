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
      throw new Error("LOVABLE_API_KEY is not configured")
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash",
        messages: [
          {
            role: "system",
            content: `Você é um analista sênior de derivativos da B3. Sua tarefa é analisar estruturas de opções e dar um veredito claro.
            Retorne APENAS um JSON com a seguinte estrutura:
            {
              "verdict": "Compra Forte" | "Atrativo" | "Neutro" | "Evitar" | "Perigoso",
              "score": number (0-10),
              "risk_level": "Baixo" | "Moderado" | "Alto" | "Crítico",
              "cdi_comparison": "string curta comparando com CDI",
              "pros": ["ponto positivo 1", "ponto positivo 2"],
              "cons": ["ponto negativo 1", "ponto negativo 2"],
              "summary": "resumo executivo de 2 linhas",
              "probability_success": "Alta" | "Média" | "Baixa"
            }`
          },
          { 
            role: "user", 
            content: `Analise esta estrutura: ${JSON.stringify({ legs, metrics, cdiRate, daysToExpiry })}` 
          },
        ],
        response_format: { type: "json_object" }
      }),
    })

    if (!response.ok) throw new Error(`AI Gateway error: ${response.status}`)
    const result = await response.json()
    const analysis = JSON.parse(result.choices[0].message.content)

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})