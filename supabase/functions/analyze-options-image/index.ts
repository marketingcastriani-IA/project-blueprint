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

    console.log("[analyze-options-image] Iniciando OCR avançado de imagem B3...")

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
            content: `Você é um especialista em leitura de notas de corretagem e telas de home broker da B3 (Brasil).
            Sua tarefa é extrair as pernas de uma operação de opções ou ativos.
            
            REGRAS DE EXTRAÇÃO:
            1. Identifique o Ticker (ex: PETR4, VALEC385).
            2. Identifique o Lado: 'buy' (compra, C, +) ou 'sell' (venda, V, -).
            3. Identifique o Tipo: 'call', 'put' ou 'stock' (se for o ativo principal).
            4. Identifique o Strike: Se for opção, extraia o valor numérico. Se for 'stock', o strike é 0.
            5. Identifique o Preço: O preço médio ou preço de execução.
            6. Identifique a Quantidade: Valor inteiro positivo.

            Retorne APENAS um JSON puro no formato:
            {
              "legs": [
                { "side": "buy"|"sell", "option_type": "call"|"put"|"stock", "asset": "TICKER", "strike": number, "price": number, "quantity": number }
              ]
            }` 
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia os dados desta operação financeira da B3. Ignore cabeçalhos e foque na tabela de ativos/opções." },
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
      throw new Error(`Erro na comunicação com a IA: ${response.status}`)
    }

    const result = await response.json()
    let content = result.choices[0].message.content
    
    // Limpeza rigorosa de markdown ou textos extras
    content = content.replace(/```json\n?/, '').replace(/\n?```/, '').trim()
    
    const data = JSON.parse(content)
    console.log(`[analyze-options-image] OCR concluído com sucesso. Pernas detectadas: ${data.legs?.length || 0}`)

    return new Response(JSON.stringify({ legs: data.legs || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (e: any) {
    console.error("[analyze-options-image] Erro crítico no processamento:", e.message)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})