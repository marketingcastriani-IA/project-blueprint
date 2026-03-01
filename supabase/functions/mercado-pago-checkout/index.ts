import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { userId, email } = await req.json()
    const MP_ACCESS_TOKEN = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN")

    if (!MP_ACCESS_TOKEN) throw new Error("Token do Mercado Pago não configurado")

    console.log(`[mercado-pago] Criando preferência para ${email}`)

    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            title: "OpçõesX - Plano PRO Mensal",
            quantity: 1,
            unit_price: 97.00,
            currency_id: "BRL"
          }
        ],
        payer: { email },
        back_urls: {
          success: "https://opcoesx.lovable.app/settings?payment=success",
          failure: "https://opcoesx.lovable.app/settings?payment=failure",
          pending: "https://opcoesx.lovable.app/settings?payment=pending"
        },
        auto_return: "approved",
        external_reference: userId,
        notification_url: "https://daiyrwxcsqvbbntzjdzy.supabase.co/functions/v1/mercado-pago-webhook"
      }),
    })

    const data = await response.json()
    return new Response(JSON.stringify({ init_point: data.init_point }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})