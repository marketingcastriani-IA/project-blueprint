import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log("[mercado-pago-checkout] Iniciando...");
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Get user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error("Usuário não autenticado")

    // Get price (with fallback if table doesn't exist)
    let price = 19.90
    try {
      const { data: settings } = await supabaseClient
        .from('site_settings')
        .select('value')
        .eq('id', 'pro_plan')
        .maybeSingle()
      
      if (settings?.value?.price) {
        price = settings.value.price
      }
    } catch (e) {
      console.log("[mercado-pago-checkout] Usando preço padrão (tabela site_settings não encontrada)");
    }

    const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN")
    if (!MP_ACCESS_TOKEN) {
      return new Response(JSON.stringify({ error: "Token do Mercado Pago não configurado no servidor." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Create Preference
    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            title: "OpçõesX - Plano PRO",
            unit_price: Number(price),
            quantity: 1,
            currency_id: "BRL"
          }
        ],
        payer: { email: user.email },
        external_reference: user.id,
        back_urls: {
          success: `${req.headers.get('origin')}/settings?payment=success`,
          failure: `${req.headers.get('origin')}/settings?payment=failure`,
          pending: `${req.headers.get('origin')}/settings?payment=pending`
        },
        auto_return: "approved",
      })
    })

    const result = await mpResponse.json()

    if (!mpResponse.ok) {
      console.error("[mercado-pago-checkout] Erro MP:", result);
      return new Response(JSON.stringify({ error: result.message || "Erro na API do Mercado Pago" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify({ url: result.init_point }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  } catch (e: any) {
    console.error("[mercado-pago-checkout] Erro fatal:", e.message)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})