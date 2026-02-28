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
    const { imageDataUrl } = await req.json()
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")
    
    if (!LOVABLE_API_KEY) {
      console.error("[analyze-options-image] LOVABLE_API_KEY não configurada")
      throw new Error("LOVABLE_API_KEY is not configured")
    }

    console.log("[analyze-options-image] Processando imagem para OCR...")

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
            content: "Extraia dados de opções da B3 da imagem. Retorne APENAS um JSON com a chave 'legs'. Cada perna: side (buy/sell), option_type (call/put/stock), asset (ticker), strike (number), price (number), quantity (number)." 
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia as pernas desta operação." },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" }
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[analyze-options-image] Erro no Gateway: ${response.status}`, errorText)
      throw new Error(`AI Gateway error: ${response.status}`)
    }

    const result = await response.json()
    let content = result.choices[0].message.content
    content = content.replace(/```json\n?/, '').replace(/\n?```/, '').trim()
    
    const data = JSON.parse(content)
    console.log(`[analyze-options-image] OCR concluído: ${data.legs?.length || 0} pernas`)

    return new Response(JSON.stringify({ legs: data.legs || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (e: any) {
    console.error("[analyze-options-image] Erro crítico:", e.message)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})