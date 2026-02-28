import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageDataUrl, image } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const resolvedImage = imageDataUrl || (image ? `data:image/png;base64,${image}` : null);

    if (!resolvedImage) {
      return new Response(JSON.stringify({ legs: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash",
        messages: [
          { 
            role: "system", 
            content: "Você é um especialista em extração de dados de opções da B3. Extraia as pernas da imagem e retorne APENAS um JSON com a chave 'legs'. Cada perna deve ter: side (buy/sell), option_type (call/put/stock), asset (ticker), strike (number), price (number), quantity (number)." 
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia as pernas desta operação estruturada." },
              { type: "image_url", image_url: { url: resolvedImage } },
            ],
          },
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) throw new Error(`AI Gateway error: ${response.status}`);
    const result = await response.json();
    const content = JSON.parse(result.choices[0].message.content);

    return new Response(JSON.stringify({ legs: content.legs || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});