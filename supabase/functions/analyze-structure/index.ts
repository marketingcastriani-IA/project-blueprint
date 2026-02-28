import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { legs, metrics, cdiRate, daysToExpiry } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const legsDescription = Array.isArray(legs)
      ? legs
          .map((l: any) => {
            const side = l.side === "buy" ? "Compra" : "Venda";
            const type = String(l.option_type).toUpperCase();
            if (l.option_type === "stock") {
              return `${side} ATIVO ${l.asset} @ ${l.price} x${l.quantity}`;
            }
            return `${side} ${type} ${l.asset} Strike ${l.strike} @ ${l.price} x${l.quantity}`;
          })
          .join("\n")
      : "Sem pernas";

    const isCollar = metrics?.strategyType === "Collar";
    const collarInfo = isCollar
      ? `\nESTRATÉGIA DETECTADA: Collar (Financiamento com Proteção)
- Custo de Montagem: R$ ${metrics.montageTotal?.toFixed(2) || "N/A"}
- Breakeven Real: R$ ${metrics.realBreakeven?.toFixed(2) || "N/A"}
- Risco Zero: ${metrics.isRiskFree ? "SIM (Put > Breakeven)" : "NÃO"}`
      : "";

    const cdiInfo = metrics?.cdiReturn
      ? `\n- Retorno CDI no período: R$ ${metrics.cdiReturn.toFixed(2)}`
      : "";
    const efficiencyInfo = metrics?.cdiEfficiency
      ? `\n- Eficiência vs CDI: ${metrics.cdiEfficiency}%`
      : "";

    const prompt = `Analise esta estrutura de opções e dê um veredito objetivo.

PERNAS:
${legsDescription}
${collarInfo}

MÉTRICAS:
- Ganho Máximo: ${metrics.maxGain === "Ilimitado" ? "Ilimitado" : "R$ " + metrics.maxGain}
- Perda Máxima: ${metrics.maxLoss === "Ilimitado" ? "Ilimitado" : "R$ " + metrics.maxLoss}
- Breakevens: ${metrics.breakevens?.length ? metrics.breakevens.map((b: number) => "R$ " + b.toFixed(2)).join(", ") : "N/A"}
- Custo Líquido: R$ ${metrics.netCost}
${cdiRate ? `- CDI: ${cdiRate}% a.a.` : ""}
${daysToExpiry ? `- Dias úteis: ${daysToExpiry}` : ""}${cdiInfo}${efficiencyInfo}

Responda em no máximo 3 linhas: veredito + justificativa.`;

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
            content: "Você é analista quantitativo de opções do mercado brasileiro. Seja extremamente objetivo. Máximo 3 linhas.",
          },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "emit_analysis",
              description: "Retorna análise objetiva para decisão da estrutura",
              parameters: {
                type: "object",
                properties: {
                  verdict: { type: "string", enum: ["vale_a_pena", "nao_vale_a_pena", "depende"] },
                  structure_type: { type: "string" },
                  market_scenario: { type: "string" },
                  risk_return: { type: "string" },
                  cdi_vs_structure: { type: "string" },
                  cdi_efficiency: { type: "number", description: "% do CDI (ex: 166)" },
                  summary: { type: "string" },
                },
                required: ["verdict", "structure_type", "market_scenario", "risk_return", "summary"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "emit_analysis" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const result = await response.json();
    const toolArgs = result.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;

    if (!toolArgs) {
      const fallback = result.choices?.[0]?.message?.content || "Sem sugestão disponível.";
      return new Response(JSON.stringify({ suggestion: fallback }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(toolArgs);
    const verdictLabel =
      parsed.verdict === "vale_a_pena"
        ? "✅ Vale a pena"
        : parsed.verdict === "nao_vale_a_pena"
          ? "⛔ Não vale a pena"
          : "⚖️ Depende";

    const suggestion = [
      verdictLabel,
      isCollar ? `Estratégia: Collar (Financiamento com Proteção)` : `Estrutura: ${parsed.structure_type}`,
      `Cenário: ${parsed.market_scenario}`,
      `Risco/Retorno: ${parsed.risk_return}`,
      parsed.cdi_vs_structure ? `CDI vs Estrutura: ${parsed.cdi_vs_structure}` : null,
      parsed.cdi_efficiency ? `Eficiência: ${parsed.cdi_efficiency}% do CDI` : null,
      `Resumo: ${parsed.summary}`,
    ]
      .filter(Boolean)
      .join("\n");

    return new Response(JSON.stringify({ suggestion }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-structure error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
