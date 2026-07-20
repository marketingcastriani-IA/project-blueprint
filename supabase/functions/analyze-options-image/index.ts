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
            content: `Você lê telas de home broker / boletas de opções da B3 e extrai a estrutura com precisão absoluta. Trabalhe em DUAS etapas e devolva um único JSON.

ETAPA 1 — TRANSCRIÇÃO LITERAL (campo "linhas_lidas"):
Para CADA linha da tabela de pernas, transcreva exatamente o que está escrito em cada coluna, sem interpretar:
{ "lado_texto": "<letra ou palavra na coluna Lado, ex: C ou V>", "callput_texto": "<Put/Call/Ativo/->", "ticker": "<...>", "strike_texto": "<...>", "preco_texto": "<...>", "qtd_texto": "<...>" }

REGRA ABSOLUTA PARA A COLUNA "LADO":
- A coluna "Lado" (também chamada "C/V" ou "Operação") contém UMA LETRA por linha, dentro de um selo/quadrado colorido.
- Letra "C" = COMPRA. Letra "V" = VENDA. SEMPRE.
- IGNORE A COR do selo. As cores mudam de corretora para corretora e enganam: um "C" pode estar em selo laranja, amarelo, azul ou cinza — continua sendo COMPRA. Um "V" pode estar em selo verde ou vermelho — continua sendo VENDA. Leia a LETRA, nunca a cor.
- NÃO confunda a coluna "Lado" (C/V) com a coluna "Call/Put" (tipo da opção). São colunas diferentes.
- NÃO deduza o lado pelo tipo da opção, pela ordem das linhas, nem pelo nome da estratégia exibido no topo (ex.: "Colar", "Trava de Alta"). Use SOMENTE a letra da coluna Lado daquela linha.

ETAPA 2 — CONVERSÃO (campo "legs"):
Converta cada linha lida em uma perna:
- side: "buy" se lado_texto começa com "C" (Compra); "sell" se começa com "V" (Venda).
- option_type: "call" se Call; "put" se Put; "stock" se for ação à vista ("Ativo"/"Ação"/"-" e ticker de 5 caracteres tipo PETR4/VALE3).
- asset: o ticker exatamente como escrito.
- strike: número (0 para ação).
- price: número POSITIVO (o sinal de compra/venda vai só em "side", nunca no preço).
- quantity: inteiro POSITIVO.
- Converta vírgula decimal para ponto (1,67 → 1.67).

VALIDAÇÃO EXTRA (não sobrepõe o rótulo, só confere): na B3 a letra após o radical do ticker de opção indica o tipo — Call usa A–L, Put usa M–X (ex.: PETRT427 → "T" = Put; PETRH429 → "H" = Call).

Formato final: { "linhas_lidas": [ ... ], "legs": [ ... ] }. Extraia TODAS as pernas, na ordem em que aparecem. Não invente linhas ausentes.`
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Leia esta boleta. Primeiro transcreva a coluna LADO (a letra C ou V de cada linha, ignorando a cor do selo), depois monte as pernas. Retorne o JSON { linhas_lidas: [...], legs: [...] }." },
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
