import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const body = await req.json()
    console.log("[mercado-pago-webhook] Notificação recebida:", body)

    const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN")
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let userId = null;
    let isApproved = false;

    // Caso 1: Pagamento avulso (Preference)
    if (body.type === 'payment') {
      const paymentId = body.data?.id
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { "Authorization": `Bearer ${MP_ACCESS_TOKEN}` }
      })
      const payment = await response.json()

      if (payment.status === 'approved') {
        userId = payment.external_reference
        isApproved = true
      }
    }

    // Caso 2: Assinatura Recorrente (Preapproval)
    if (body.type === 'subscription_preapproval' || body.action?.includes('preapproval')) {
      const preapprovalId = body.data?.id || body.id
      const response = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
        headers: { "Authorization": `Bearer ${MP_ACCESS_TOKEN}` }
      })
      const subscription = await response.json()

      if (subscription.status === 'authorized') {
        userId = subscription.external_reference
        isApproved = true
      }
    }

    if (isApproved && userId) {
      console.log(`[mercado-pago-webhook] Liberando acesso PRO para: ${userId}`)

      // 1. Atualizar acesso no banco
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000);
      
      await supabaseAdmin
        .from('user_access')
        .update({ 
          plan_type: 'pro', 
          status: 'approved',
          purchased_at: now.toISOString(),
          expires_at: expiresAt.toISOString()
        } as any)
        .eq('user_id', userId)

      // 2. Buscar dados do perfil para o e-mail
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('email, display_name')
        .eq('user_id', userId)
        .single()

      if (profile?.email) {
        console.log(`[mercado-pago-webhook] ENVIANDO E-MAIL DE BOAS-VINDAS PARA: ${profile.email}`);
        
        /* 
           LOGICA DE ENVIO DE E-MAIL (Exemplo com Resend ou similar):
           await fetch('https://api.resend.com/emails', {
             method: 'POST',
             headers: { 'Authorization': 'Bearer YOUR_API_KEY', 'Content-Type': 'application/json' },
             body: JSON.stringify({
               from: 'OpçõesX <contato@opcoesx.com.br>',
               to: profile.email,
               subject: 'Bem-vindo ao OPÇÕES PRO X!',
               html: `<h1>Olá ${profile.display_name || 'Investidor'}!</h1><p>Seu acesso PRO foi liberado...</p>`
             })
           })
        */
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  } catch (e: any) {
    console.error("[mercado-pago-webhook] Erro:", e.message)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})