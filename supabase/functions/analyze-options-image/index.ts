import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }
    const { imageDataUrl } = await req.json()
    
    if (!imageDataUrl) {
      console.log("[analyze-options-image] Nenhuma imagem fornecida");
      return new Response(JSON.stringify({ error: "Nenhuma imagem fornecida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")
    if (!OPENAI_API_KEY) {
      console.error("[analyze-options-image] OPENAI_API_KEY não configurada");
      return new Response(JSON.stringify({ error: "Configuração do servidor incompleta" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    console.log("[analyze-options-image] Enviando imagem para análise via OpenAI gpt-4o...")

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0,
        messages: [
          {
            role: "system",
            content: `Você é um especialista em ler telas de home broker e boletas de opções da B3 e extrair a estrutura da operação com precisão absoluta.

Retorne APENAS um JSON no formato { "legs": [ ... ] }. Cada perna tem:
- side: "buy" (compra) ou "sell" (venda)
- option_type: "call", "put" ou "stock" (ação à vista)
- asset: ticker exatamente como aparece (ex.: PETR4, PETRT427)
- strike: número (use 0 para ações à vista)
- price: número POSITIVO (prêmio da opção ou preço da ação)
- quantity: número inteiro POSITIVO

COMO IDENTIFICAR O LADO (side) — este é o ponto MAIS crítico, NUNCA inverta:
- "C", "Compra", "Comprado", "Buy", sinal "+", ou célula de COMPRA → side = "buy".
- "V", "Venda", "Vendido", "Sell", sinal "-", ou célula de VENDA → side = "sell".
- Localize a coluna "Lado"/"C/V"/"Operação" e leia o rótulo de CADA linha individualmente. Um "V" isolado numa célula é VENDA; um "C" é COMPRA. Não deduza pela ordem das linhas nem pelo tipo da opção — confie no rótulo explícito do lado daquela linha.

COMO IDENTIFICAR option_type:
- Rótulo "Call"/"CALL" → "call"; "Put"/"PUT" → "put".
- Ação à vista (ticker de 5 caracteres tipo PETR4/VALE3, sem strike, tipo "Ativo"/"Ação"/"-") → "stock".
- Validação pela letra do ticker de opção da B3 (a letra após o radical): Call usa A–L (A=jan … L=dez); Put usa M–X (M=jan … X=dez). Ex.: PETRT427 → "T" = Put; PETRH429 → "H" = Call. Se o rótulo visível da coluna Tipo conflitar com a letra do ticker, priorize o rótulo explícito, mas mantenha o asset exatamente como está escrito.

REGRAS GERAIS:
- Extraia TODAS as pernas visíveis, na mesma ordem em que aparecem.
- price e quantity são SEMPRE positivos — o sinal de compra/venda vai em "side", nunca no preço.
- Converta vírgula decimal para ponto (1,47 → 1.47).
- strike de ação = 0.
- Não invente pernas ausentes. Se um campo estiver ilegível, use o valor mais provável pelo restante da linha.`
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia todas as pernas desta imagem de corretora/home broker, lendo o LADO (compra/venda) de cada linha com atenção. Retorne somente o JSON { legs: [...] }." },
              { type: "image_url", image_url: { url: imageDataUrl, detail: "high" } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error(`[analyze-options-image] Erro na OpenAI: ${response.status}`, errorData)
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit da OpenAI. Aguarde e tente novamente." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }
      if (response.status === 401) {
        return new Response(JSON.stringify({ error: "Chave da OpenAI inválida ou expirada." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }
      
      return new Response(JSON.stringify({ error: `Erro na OpenAI: ${response.status}` }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const result = await response.json()
    let content = result.choices?.[0]?.message?.content

    if (!content) {
      console.error("[analyze-options-image] Resposta da OpenAI vazia")
      return new Response(JSON.stringify({ error: "A IA não conseguiu processar a imagem" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Limpeza de Markdown caso a IA retorne com backticks
    content = content.replace(/```json\n?/, '').replace(/\n?```/, '').trim();

    try {
      const parsed = JSON.parse(content);
      console.log("[analyze-options-image] Sucesso ao processar imagem via OpenAI");
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (parseError) {
      console.error("[analyze-options-image] Erro ao parsear JSON da OpenAI:", content);
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
