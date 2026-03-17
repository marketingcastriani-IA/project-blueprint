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
    const { legs, currentPnL, cdiReturnSinceEntry, daysSinceEntry, cdiRate } = await req.json()
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")
    
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured")
    }

    console.log("[analyze-exit] Analisando viabilidade de saída...");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Você é um estrategista de derivativos sênior. Sua missão é dizer se o investidor deve ENCERRAR a operação agora ou MANTER.
            Considere o Lucro/Prejuízo atual (PnL) comparado ao que o dinheiro renderia no CDI no mesmo período.
            
            Retorne um JSON:
            {
              "verdict": "ENCERRAR" | "MANTER" | "ALERTA",
              "reasoning": "Explicação técnica curta",
              "efficiency_score": number (0-100, onde 100 é muito eficiente vs CDI),
              "risk_comment": "Comentário sobre o risco residual se mantiver"
            }`
          },
          { 
            role: "user", 
            content: `Dados da operação:
            - Pernas: ${JSON.stringify(legs)}
            - Lucro Atual: R$ ${currentPnL.toFixed(2)}
            - Rendimento CDI no período (${daysSinceEntry} dias úteis): R$ ${cdiReturnSinceEntry.toFixed(2)}
            - Taxa CDI base: ${cdiRate}% a.a.
            
            Vale a pena sair agora?` 
          },
        ],
        response_format: { type: "json_object" }
      }),
    })

    const result = await response.json()
    return new Response(result.choices[0].message.content, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})