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

    // O Mercado Pago envia notificações de diferentes tipos. Focamos em 'payment'
    if (body.type === 'payment' || body.action === 'payment.created' || body.action === 'payment.updated') {
      const paymentId = body.data?.id || body.resource?.split('/').pop()
      const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN")

      // Consultar detalhes do pagamento
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { "Authorization": `Bearer ${MP_ACCESS_TOKEN}` }
      })
      const payment = await response.json()

      if (payment.status === 'approved') {
        const userId = payment.external_reference
        console.log(`[mercado-pago-webhook] Pagamento aprovado para usuário: ${userId}`)

        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Usar service role para bypass RLS
        )

        // Atualizar acesso do usuário
        const { error } = await supabaseAdmin
          .from('user_access')
          .update({ 
            plan_type: 'pro', 
            status: 'approved',
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // +30 dias
          } as any)
          .eq('user_id', userId)

        if (error) throw error
        console.log(`[mercado-pago-webhook] Plano PRO liberado com sucesso!`)
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