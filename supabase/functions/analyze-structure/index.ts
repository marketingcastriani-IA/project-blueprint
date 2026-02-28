import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { legs, metrics, cdiRate, daysToExpiry } = await req.json()
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")
    
    if (!LOVABLE_API_KEY) {
      console.error("[analyze-structure] LOVABLE_API_KEY not found")
      throw new Error("LOVABLE_API_KEY is not configured")
    }

    console.log("[analyze-structure] Analyzing structure...")

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "Você é um analista de opções experiente. Analise a estrutura enviada e dê um veredito curto (máximo 3 linhas) sobre se vale a pena comparado ao CDI.",
          },
          { 
            role: "user", 
            content: `Analise: ${JSON.stringify({ legs, metrics, cdiRate, daysToExpiry })}` 
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[analyze-structure] AI Gateway error: ${response.status}`, errorText)
      throw new Error(`AI Gateway error: ${response.status}`)
    }

    const result = await response.json()
    const suggestion = result.choices[0].message.content

    return new Response(JSON.stringify({ suggestion }), {
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