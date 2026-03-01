import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error("Não autorizado")

    // Buscar preço configurado
    const { data: settings } = await supabaseClient
      .from('site_settings')
      .select('value')
      .eq('id', 'pro_plan')
      .single()
    
    const price = settings?.value?.price || 19.90
    const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") // Definir no painel do Supabase

    console.log(`[mercado-pago-checkout] Criando preferência para ${user.email} no valor de R$ ${price}`)

    // Criar Preferência no Mercado Pago
    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            title: "OpçõesX - Plano PRO (Mensal)",
            unit_price: price,
            quantity: 1,
            currency_id: "BRL"
          }
        ],
        payer: {
          email: user.email
        },
        external_reference: user.id, // ID do usuário para identificar no webhook
        back_urls: {
          success: `${req.headers.get('origin')}/settings?payment=success`,
          failure: `${req.headers.get('origin')}/settings?payment=failure`,
          pending: `${req.headers.get('origin')}/settings?payment=pending`
        },
        auto_return: "approved",
        notification_url: `https://daiyrwxcsqvbbntzjdzy.supabase.co/functions/v1/mercado-pago-webhook`
      })
    })

    const preference = await response.json()
    
    return new Response(JSON.stringify({ url: preference.init_point }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  } catch (e: any) {
    console.error("[mercado-pago-checkout] Erro:", e.message)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})