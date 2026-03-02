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

    // Lógica robusta para capturar a URL base do site
    const originHeader = req.headers.get('origin') || req.headers.get('referer') || 'https://opcoesx.com.br';
    let baseUrl = 'https://opcoesx.com.br';
    
    try {
      const url = new URL(originHeader);
      baseUrl = `${url.protocol}//${url.host}`;
    } catch (e) {
      console.warn("[mercado-pago-checkout] Falha ao processar origin, usando fallback");
    }

    const backUrl = `${baseUrl}/settings?payment=success`;
    console.log(`[mercado-pago-checkout] URL de retorno configurada: ${backUrl}`);

    // Busca preço atualizado ou usa padrão
    let price = 19.90
    try {
      const { data: settings } = await supabaseClient
        .from('site_settings')
        .select('value')
        .eq('id', 'pro_plan')
        .maybeSingle()
      
      if (settings?.value?.price) {
        price = Number(settings.value.price);
      }
    } catch (e) {
      console.log("[mercado-pago-checkout] Usando preço padrão de R$ 19.90");
    }

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
          transaction_amount: price,
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
      console.error("[mercado-pago-checkout] Erro retornado pelo Mercado Pago:", result);
      return new Response(JSON.stringify({ 
        error: `Erro no Mercado Pago: ${result.message || "Erro na criação da assinatura."}`,
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