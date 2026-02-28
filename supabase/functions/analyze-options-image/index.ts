import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type RawLeg = {
  side?: string;
  option_type?: string;
  asset?: string;
  strike?: number | string;
  price?: number | string;
  quantity?: number | string;
};

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const normalized = value.replace(/R\$|BRL|\s/g, "").replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const normalizeSide = (value?: string, optionType?: string) => {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (raw === "C" || raw === "COMPRA" || raw === "BUY" || raw === "B") return "buy";
  if (raw === "V" || raw === "VENDA" || raw === "SELL" || raw === "S") return "sell";
  if (optionType === "stock") return "buy";
  return null;
};

const normalizeOptionType = (value?: string, asset?: string) => {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  
  if (raw === "CALL" || raw === "C") return "call";
  if (raw === "PUT" || raw === "P") return "put";
  if (raw === "STOCK" || raw === "AÇÃO" || raw === "ACAO" || raw === "ATIVO" || raw === "BASE" || raw === "-" || raw === "") {
    return "stock";
  }
  
  if ((!raw || raw === "-") && asset) {
    const assetUpper = asset.toUpperCase();
    if (assetUpper.length >= 6) {
      const monthLetter = assetUpper[4];
      if (/[A-L]/.test(monthLetter)) return "call";
      if (/[M-X]/.test(monthLetter)) return "put";
    }
    if (assetUpper.length <= 5) return "stock";
  }
  
  return null;
};

const validateAsset = (asset?: string): string | null => {
  if (!asset) return null;
  const cleaned = asset.trim().toUpperCase();
  if (/^[A-Z]{3,6}[A-Z0-9]{1,4}$/.test(cleaned) && cleaned.length >= 4 && cleaned.length <= 10) {
    return cleaned;
  }
  return null;
};

const normalizeLegs = (legs: RawLeg[] | undefined) => {
  if (!Array.isArray(legs)) return [];

  return legs
    .map((leg, idx) => {
      const asset = validateAsset(leg.asset);
      if (!asset) {
        console.warn(`Leg ${idx}: Asset inválido ou vazio:`, leg.asset);
        return null;
      }

      const optionType = normalizeOptionType(leg.option_type, asset);
      if (!optionType) {
        console.warn(`Leg ${idx}: Tipo de opção não reconhecido:`, leg.option_type);
        return null;
      }

      const side = normalizeSide(leg.side, optionType);
      if (!side) {
        console.warn(`Leg ${idx}: Lado (Compra/Venda) não reconhecido:`, leg.side);
        return null;
      }

      const strikeRaw = toNumber(leg.strike);
      const priceRaw = toNumber(leg.price);

      let strike = strikeRaw;
      let price = priceRaw;

      if (optionType === "stock") {
        let assetPrice = 0;
        if (priceRaw > 0) assetPrice = priceRaw;
        else if (strikeRaw > 0) assetPrice = strikeRaw;
        
        if (assetPrice > 0 && (assetPrice < 0.01 || assetPrice > 10000)) {
          console.error(`Leg ${idx}: Preço de ativo fora do intervalo: ${assetPrice}`);
          return null;
        }

        strike = assetPrice > 0 ? assetPrice : 0;
        price = assetPrice > 0 ? assetPrice : 0;
      } else {
        if (strike <= 0) {
          console.warn(`Leg ${idx}: Strike inválido (${strikeRaw})`);
          return null;
        }
        if (price < 0) {
          console.warn(`Leg ${idx}: Prêmio inválido (${priceRaw})`);
          return null;
        }
      }

      const rawQty = Math.max(1, Math.round(toNumber(leg.quantity) || 100));
      const quantity = Math.abs(rawQty);

      return {
        side,
        option_type: optionType,
        asset,
        strike: Number(strike.toFixed(2)),
        price: Number(price.toFixed(2)),
        quantity,
      };
    })
    .filter(Boolean);
};

const SYSTEM_PROMPT = `Você é um especialista em leitura de screenshots de plataformas brasileiras de opções (Clear, XP, BTG, Profit Pro, Rico, Inter, etc).

MISSÃO: Extrair TODAS as pernas (legs) de uma operação estruturada de opções.

Cada LINHA da tabela = UMA perna. Extraia TODAS.

## CAMPOS:
- **side**: "C"/"Compra" → "buy", "V"/"Venda" → "sell". Verde/Azul=buy, Vermelho=sell
- **option_type**: ticker 5+ chars com letra na 5ª posição = opção (A-L=call, M-X=put). Ticker 4-5 chars = "stock"
- **asset**: copie EXATAMENTE como aparece
- **strike**: preço de exercício (opções) ou preço atual (stock). NUNCA zero para stock!
- **price**: prêmio (opções) ou 0 (stock)
- **quantity**: geralmente 100

## EXEMPLO:
| C | PETR4 | - | 39.55 | 100 | → side=buy, option_type=stock, asset=PETR4, strike=39.55, price=0, quantity=100
| C | - | PETRP396 | 39.65 | 1.50 | 100 | → side=buy, option_type=put, asset=PETRP396, strike=39.65, price=1.50, quantity=100
| V | - | Call | PETRD399 | 39.90 | 1.93 | 100 | → side=sell, option_type=call, asset=PETRD399, strike=39.90, price=1.93, quantity=100

REGRA CRÍTICA: Número de pernas = número de linhas na tabela.`;

const USER_PROMPT = "Extraia TODAS as pernas desta operação estruturada. Leia cada linha da tabela com máxima atenção. Retorne os dados estruturados.";

async function callAI(apiKey: string, imageUrl: string, useToolCalls: boolean): Promise<{ legs?: RawLeg[]; total_rows_in_image?: number } | null> {
  const body: any = {
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: useToolCalls ? USER_PROMPT : USER_PROMPT + '\n\nResponda SOMENTE com JSON no formato: {"legs": [...], "total_rows_in_image": N}. Cada leg: {"side":"buy"|"sell","option_type":"call"|"put"|"stock","asset":"TICKER","strike":NUMBER,"price":NUMBER,"quantity":NUMBER}' },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
  };

  if (useToolCalls) {
    body.tools = [
      {
        type: "function",
        function: {
          name: "extract_legs",
          description: "Extrai todas as pernas de uma operação estruturada de opções",
          parameters: {
            type: "object",
            properties: {
              legs: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    side: { type: "string", enum: ["buy", "sell"] },
                    option_type: { type: "string", enum: ["call", "put", "stock"] },
                    asset: { type: "string" },
                    strike: { type: "number" },
                    price: { type: "number" },
                    quantity: { type: "number" },
                  },
                  required: ["side", "option_type", "asset", "strike", "price", "quantity"],
                },
              },
              total_rows_in_image: { type: "number" },
            },
            required: ["legs", "total_rows_in_image"],
          },
        },
      },
    ];
    body.tool_choice = { type: "function", function: { name: "extract_legs" } };
  }

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const status = response.status;
    const text = await response.text();
    console.error(`AI gateway error (${status}):`, text);
    if (status === 429 || status === 402) throw { status, message: text };
    throw new Error(`AI gateway error: ${status}`);
  }

  const result = await response.json();
  const msg = result.choices?.[0]?.message;
  
  console.log("AI attempt debug:", JSON.stringify({
    useToolCalls,
    hasToolCalls: !!msg?.tool_calls,
    toolCallsCount: msg?.tool_calls?.length,
    contentType: typeof msg?.content,
    contentLength: typeof msg?.content === "string" ? msg.content.length : -1,
    contentPreview: typeof msg?.content === "string" ? msg.content.substring(0, 300) : "non-string",
    finishReason: result.choices?.[0]?.finish_reason,
  }));

  // Try tool_calls
  if (msg?.tool_calls?.[0]?.function?.arguments) {
    try {
      const args = msg.tool_calls[0].function.arguments;
      const parsed = typeof args === "string" ? JSON.parse(args) : args;
      if (parsed?.legs?.length > 0) {
        console.log("✓ Extracted from tool_calls:", parsed.legs.length, "legs");
        return parsed;
      }
    } catch (e) { console.warn("Failed to parse tool_calls:", e); }
  }

  // Try text content
  let textContent = "";
  if (typeof msg?.content === "string") {
    textContent = msg.content;
  } else if (Array.isArray(msg?.content)) {
    textContent = msg.content.filter((p: any) => p.type === "text").map((p: any) => p.text).join("\n");
  }

  if (textContent) {
    // Try to find JSON with legs array
    const jsonMatch = textContent.match(/\{[\s\S]*?"legs"\s*:\s*\[[\s\S]*?\][\s\S]*?\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed?.legs?.length > 0) {
          console.log("✓ Extracted from text content:", parsed.legs.length, "legs");
          return parsed;
        }
      } catch { 
        // Try cleaning markdown code blocks
        const cleaned = textContent.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
        const match2 = cleaned.match(/\{[\s\S]*?"legs"\s*:\s*\[[\s\S]*?\][\s\S]*?\}/);
        if (match2) {
          try {
            const parsed = JSON.parse(match2[0]);
            if (parsed?.legs?.length > 0) {
              console.log("✓ Extracted from cleaned text:", parsed.legs.length, "legs");
              return parsed;
            }
          } catch { console.warn("Failed all JSON parsing attempts"); }
        }
      }
    }
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageDataUrl, image } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const resolvedImage = typeof imageDataUrl === "string" && imageDataUrl.startsWith("data:image/")
      ? imageDataUrl
      : typeof image === "string"
        ? `data:image/png;base64,${image}`
        : null;

    if (!resolvedImage) {
      return new Response(JSON.stringify({ legs: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Starting OCR, image size:", Math.round(resolvedImage.length / 1024), "KB");

    // Attempt 1: tool_calls with gemini-2.5-flash
    let parsedResult = await callAI(LOVABLE_API_KEY, resolvedImage, true);

    // Attempt 2: if tool_calls failed, try plain JSON response
    if (!parsedResult?.legs?.length) {
      console.log("Tool calls attempt failed, retrying with plain JSON...");
      parsedResult = await callAI(LOVABLE_API_KEY, resolvedImage, false);
    }

    const normalized = normalizeLegs(parsedResult?.legs);

    console.log("OCR Final Result:", JSON.stringify({
      rawLegs: parsedResult?.legs?.length ?? 0,
      normalized: normalized.length,
      imageRows: parsedResult?.total_rows_in_image,
    }));

    if (normalized.length !== parsedResult?.total_rows_in_image) {
      console.warn(`Mismatch: ${normalized.length} normalized vs ${parsedResult?.total_rows_in_image} image rows.`);
    }

    return new Response(JSON.stringify({ legs: normalized }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("analyze-options-image error:", e);
    if (e?.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (e?.status === 402) {
      return new Response(JSON.stringify({ error: "Payment required." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
