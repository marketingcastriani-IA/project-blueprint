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
    const { imageDataUrl } = await req.json()
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")
    
    if (!LOVABLE_API_KEY) {
      console.error("[analyze-options-image] LOVABLE_API_KEY not found")
      throw new Error("LOVABLE_API_KEY is not configured")
    }

    if (!imageDataUrl) {
      return new Response(JSON.stringify({ legs: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    console.log("[analyze-options-image] Processing image...")

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
            content: "Você é um especialista em extração de dados de opções da B3. Extraia as pernas da imagem e retorne APENAS um JSON com a chave 'legs'. Cada perna deve ter: side (buy/sell), option_type (call/put/stock), asset (ticker), strike (number), price (number), quantity (number)." 
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia as pernas desta operação estruturada." },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" }
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[analyze-options-image] AI Gateway error: ${response.status}`, errorText)
      throw new Error(`AI Gateway error: ${response.status}`)
    }

    const result = await response.json()
    const content = JSON.parse(result.choices[0].message.content)
    
    console.log(`[analyze-options-image] Successfully extracted ${content.legs?.length || 0} legs`)

    return new Response(JSON.stringify({ legs: content.legs || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (e: any) {
    console.error("[analyze-options-image] Error:", e.message)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})