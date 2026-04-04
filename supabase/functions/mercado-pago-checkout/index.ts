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
    console.log("[mercado-pago-checkout] Iniciando processo de checkout...");

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      console.error("[mercado-pago-checkout] Erro de autenticação:", userError);
      throw new Error("Usuário não autenticado");
    }

    // Parse body for plan_period
    let planPeriod: 'monthly' | 'yearly' = 'monthly';
    try {
      const body = await req.json();
      if (body?.plan_period === 'yearly') planPeriod = 'yearly';
    } catch (_) {
      // no body = monthly
    }

    const PRODUCTION_URL = 'https://www.opcoesprox.com.br';
    const backUrl = `${PRODUCTION_URL}/settings?payment=success`;
    console.log(`[mercado-pago-checkout] URL de retorno: ${backUrl}, período: ${planPeriod}`);

    // Busca preço atualizado ou usa padrão
    let monthlyPrice = 14.90
    try {
      const { data: settings } = await supabaseClient
        .from('site_settings')
        .select('value')
        .eq('id', 'pro_plan')
        .maybeSingle()
      
      if (settings?.value?.price) {
        monthlyPrice = Number(settings.value.price);
      }
    } catch (e) {
      console.log("[mercado-pago-checkout] Usando preço padrão");
    }

    // Calcular preço final
    const price = planPeriod === 'yearly'
      ? Math.round(monthlyPrice * 12 * 0.8 * 100) / 100
      : monthlyPrice;

    const itemTitle = planPeriod === 'yearly'
      ? 'Opções PRO X - Plano Anual'
      : 'Opções PRO X - Plano Mensal';

    const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN")
    if (!MP_ACCESS_TOKEN) {
      console.error("[mercado-pago-checkout] ERRO: MP_ACCESS_TOKEN não configurado.");
      return new Response(JSON.stringify({ 
        error: "Configuração incompleta: O administrador precisa configurar o MP_ACCESS_TOKEN no painel do Supabase." 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // external_reference encodes period: "userId:yearly" or just "userId"
    const externalRef = planPeriod === 'yearly' ? `${user.id}:yearly` : user.id;

    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            title: itemTitle,
            quantity: 1,
            unit_price: price,
            currency_id: "BRL",
          }
        ],
        payer: {
          email: user.email,
        },
        payment_methods: {
          excluded_payment_types: [
            { id: "ticket" }
          ],
          installments: 1
        },
        external_reference: externalRef,
        back_urls: {
          success: `${PRODUCTION_URL}/settings?payment=success`,
          failure: `${PRODUCTION_URL}/settings?payment=failure`,
          pending: `${PRODUCTION_URL}/settings?payment=pending`,
        },
        auto_return: "approved",
        statement_descriptor: "OPCOES PRO X",
      })
    })

    const result = await mpResponse.json()

    if (!mpResponse.ok) {
      console.error("[mercado-pago-checkout] Erro retornado pelo Mercado Pago:", result);
      return new Response(JSON.stringify({ 
        error: `Erro no Mercado Pago: ${result.message || "Erro na criação do checkout."}`,
        details: result
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    console.log("[mercado-pago-checkout] Checkout gerado com sucesso:", result.init_point);
    return new Response(JSON.stringify({ url: result.init_point }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  } catch (e: any) {
    console.error("[mercado-pago-checkout] Erro inesperado:", e.message)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
