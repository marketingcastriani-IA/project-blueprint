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
