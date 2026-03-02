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
    console.log("[mercado-pago-checkout] Iniciando assinatura recorrente...");
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error("Usuário não autenticado")

    // Determinar a URL base do site para o redirecionamento
    const origin = req.headers.get('origin') || 'https://opcoesx.com.br';
    const backUrl = `${origin}/settings?payment=success`;

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
      console.log("[mercado-pago-checkout] Usando preço padrão");
    }

    const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN")
    if (!MP_ACCESS_TOKEN) {
      return new Response(JSON.stringify({ error: "Token do Mercado Pago não configurado nos Secrets do Supabase." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Criando Assinatura Recorrente (Preapproval)
    const mpResponse = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reason: "OpçõesX - Assinatura Mensal PRO",
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: Number(price),
          currency_id: "BRL"
        },
        payer_email: user.email,
        external_reference: user.id,
        back_url: backUrl,
        status: "pending"
      })
    })

    const result = await mpResponse.json()

    if (!mpResponse.ok) {
      console.error("[mercado-pago-checkout] Erro MP:", result);
      return new Response(JSON.stringify({ error: result.message || "Erro ao criar assinatura no Mercado Pago" }), {
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