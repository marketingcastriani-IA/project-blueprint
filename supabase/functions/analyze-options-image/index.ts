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
    
    if (!imageDataUrl) {
      console.log("[analyze-options-image] Nenhuma imagem fornecida");
      return new Response(JSON.stringify({ error: "Nenhuma imagem fornecida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")
    if (!LOVABLE_API_KEY) {
      console.error("[analyze-options-image] LOVABLE_API_KEY não configurada");
      return new Response(JSON.stringify({ error: "Configuração do servidor incompleta" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    console.log("[analyze-options-image] Enviando imagem para análise (gemini-3-flash)...")

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { 
            role: "system", 
            content: "Você é um assistente especializado em extrair dados de operações financeiras da B3. Extraia as pernas da operação. Retorne APENAS um JSON com a chave 'legs'. Cada item deve ter: side ('buy' ou 'sell'), option_type ('call', 'put' ou 'stock'), asset (ticker), strike (número), price (número), quantity (número)." 
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia os dados desta imagem de corretora/home broker. Retorne somente JSON." },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error(`[analyze-options-image] Erro na API de IA: ${response.status}`, errorData)
      return new Response(JSON.stringify({ error: `Erro na IA: ${response.status}` }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const result = await response.json()
    let content = result.choices?.[0]?.message?.content

    if (!content) {
      console.error("[analyze-options-image] Resposta da IA vazia")
      return new Response(JSON.stringify({ error: "A IA não conseguiu processar a imagem" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Limpeza de Markdown caso a IA ignore o response_format
    content = content.replace(/```json\n?/, '').replace(/\n?```/, '').trim();

    try {
      const parsed = JSON.parse(content);
      console.log("[analyze-options-image] Sucesso ao processar imagem");
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (parseError) {
      console.error("[analyze-options-image] Erro ao parsear JSON da IA:", content);
      return new Response(JSON.stringify({ error: "Resposta da IA em formato inválido" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

  } catch (e: any) {
    console.error("[analyze-options-image] Erro inesperado:", e.message)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})