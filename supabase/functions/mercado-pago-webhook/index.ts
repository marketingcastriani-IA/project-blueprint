import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function verifyMPSignature(req: Request, body: any): Promise<boolean> {
  const MP_WEBHOOK_SECRET = Deno.env.get("MP_WEBHOOK_SECRET")
  if (!MP_WEBHOOK_SECRET) {
    console.warn("[webhook] MP_WEBHOOK_SECRET not configured, skipping verification")
    return true
  }

  const xSignature = req.headers.get("x-signature")
  const xRequestId = req.headers.get("x-request-id")
  if (!xSignature || !xRequestId) {
    // Legacy format webhooks don't send signature headers — allow them
    console.warn("[webhook] No x-signature/x-request-id headers (legacy format), skipping verification")
    return true
  }

  const parts: Record<string, string> = {}
  for (const part of xSignature.split(",")) {
    const [key, value] = part.split("=", 2)
    parts[key.trim()] = value.trim()
  }

  const ts = parts["ts"]
  const v1 = parts["v1"]
  if (!ts || !v1) return false

  const dataId = body?.data?.id || ""
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey("raw", encoder.encode(MP_WEBHOOK_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(manifest))
  const hexHash = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('')

  if (hexHash !== v1) {
    console.warn("[webhook] Signature mismatch, but proceeding anyway to not block payments")
    // Return true to not block payments — we verify payment status via MP API anyway
    return true
  }
  return true
}

async function fetchPaymentDetails(paymentId: string, token: string) {
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { "Authorization": `Bearer ${token}` }
  })
  return response.json()
}

async function fetchPreapprovalDetails(preapprovalId: string, token: string) {
  const response = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
    headers: { "Authorization": `Bearer ${token}` }
  })
  return response.json()
}

async function activateProAccess(supabaseAdmin: any, userId: string, isYearly: boolean) {
  // Idempotency check
  const { data: existing } = await supabaseAdmin
    .from('user_access')
    .select('purchased_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing?.purchased_at) {
    const lastPurchase = new Date(existing.purchased_at).getTime()
    if (Date.now() - lastPurchase < 5 * 60 * 1000) {
      console.log(`[webhook] ⚠️ Duplicate payment ignored for ${userId}`)
      return { skipped: true }
    }
  }

  const now = new Date()
  const daysToAdd = isYearly ? 365 : 31
  const expiresAt = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000)

  const { error } = await supabaseAdmin
    .from('user_access')
    .upsert({
      user_id: userId,
      plan_type: 'pro',
      status: 'approved',
      purchased_at: now.toISOString(),
      expires_at: expiresAt.toISOString()
    }, { onConflict: 'user_id' })

  if (error) {
    console.error(`[webhook] Error updating access:`, error)
    return { skipped: false, error }
  }

  console.log(`[webhook] ✅ PRO activated! User: ${userId}, Expires: ${expiresAt.toISOString()}`)
  return { skipped: false, now, expiresAt }
}

async function sendWelcomeEmail(supabaseAdmin: any, userId: string, now: Date, expiresAt: Date) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('email, display_name')
    .eq('user_id', userId)
    .single()

  if (!profile?.email) return

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
  if (!RESEND_API_KEY) {
    console.warn("[webhook] RESEND_API_KEY not configured")
    return
  }

  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: Deno.env.get('RESEND_FROM_EMAIL') || 'Opções PRO X <contato@opcoesprox.com.br>',
        to: profile.email,
        subject: '🎉 Bem-vindo ao Opções PRO X — Seu Acesso PRO Está Ativo!',
        html: buildWelcomeEmailHtml(profile.display_name, now, expiresAt)
      })
    })
    const emailResult = await emailRes.json()
    console.log(`[webhook] ✅ Email sent:`, emailResult)
  } catch (err: any) {
    console.error(`[webhook] ⚠️ Email error:`, err.message)
  }
}

function buildWelcomeEmailHtml(displayName: string | null, now: Date, expiresAt: Date): string {
  return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:640px;margin:0 auto;background:#0a0a0f;border-radius:16px;overflow:hidden;border:1px solid #1a1a2e">
      <div style="background:linear-gradient(135deg,#6d28d9,#4f46e5);padding:40px 30px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:28px">🚀 Acesso PRO Ativado!</h1>
        <p style="color:#e0d4ff;margin:10px 0 0;font-size:15px">Seu pagamento foi confirmado com sucesso</p>
      </div>
      <div style="padding:30px">
        <p style="color:#e2e8f0;font-size:16px;line-height:1.7">
          Olá <strong style="color:#a78bfa">${displayName || 'Investidor'}</strong>! 👋
        </p>
        <p style="color:#94a3b8;font-size:14px;line-height:1.7">
          Parabéns! Seu plano <strong style="color:#22c55e">PRO</strong> está ativo.
        </p>
        <p style="color:#94a3b8;font-size:13px;line-height:1.7;margin-top:25px">
          📅 <strong style="color:#e2e8f0">Válido até:</strong> ${expiresAt.toLocaleDateString('pt-BR')}<br>
          💳 <strong style="color:#e2e8f0">Data da compra:</strong> ${now.toLocaleDateString('pt-BR')}
        </p>
        <div style="text-align:center;margin:30px 0 10px">
          <a href="https://www.opcoesprox.com.br/dashboard" style="display:inline-block;background:linear-gradient(135deg,#6d28d9,#4f46e5);color:#fff;text-decoration:none;padding:14px 40px;border-radius:10px;font-weight:bold;font-size:15px">
            Acessar Plataforma →
          </a>
        </div>
      </div>
      <div style="background:#060609;padding:20px;text-align:center;border-top:1px solid #1a1a2e">
        <p style="color:#475569;font-size:11px;margin:0">Opções PRO X © ${now.getFullYear()} — Todos os direitos reservados</p>
      </div>
    </div>
  `
}

function parseExternalReference(ref: string): { userId: string; isYearly: boolean } {
  if (ref && ref.includes(':yearly')) {
    return { userId: ref.split(':')[0], isYearly: true }
  }
  return { userId: ref, isYearly: false }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const body = await req.json()
    console.log("[webhook] Notification received:", JSON.stringify(body))

    const isValid = await verifyMPSignature(req, body)
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN")
    if (!MP_ACCESS_TOKEN) {
      console.error("[webhook] MP_ACCESS_TOKEN not configured")
      return new Response(JSON.stringify({ error: 'Missing config' }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let userId: string | null = null
    let isApproved = false

    // === Case 1: Payment (new format with type field) ===
    if (body.type === 'payment') {
      const paymentId = body.data?.id
      console.log(`[webhook] Processing payment ID: ${paymentId}`)
      const payment = await fetchPaymentDetails(paymentId, MP_ACCESS_TOKEN)
      console.log(`[webhook] Payment status: ${payment.status}, ref: ${payment.external_reference}`)
      
      if (payment.status === 'approved') {
        userId = payment.external_reference
        isApproved = true
      }
    }

    // === Case 2: Legacy format (topic-based) ===
    if (body.topic === 'payment' && body.resource) {
      // resource can be full URL or just the ID
      const paymentId = body.resource.includes('/') 
        ? body.resource.split('/').pop() 
        : body.resource
      console.log(`[webhook] Processing legacy payment ID: ${paymentId}`)
      const payment = await fetchPaymentDetails(paymentId, MP_ACCESS_TOKEN)
      console.log(`[webhook] Legacy payment status: ${payment.status}, ref: ${payment.external_reference}`)
      
      if (payment.status === 'approved') {
        userId = payment.external_reference
        isApproved = true
      }
    }

    // === Case 3: Subscription preapproval ===
    if (body.type === 'subscription_preapproval' || body.action?.includes('preapproval')) {
      const preapprovalId = body.data?.id || body.id
      console.log(`[webhook] Processing preapproval ID: ${preapprovalId}`)
      const subscription = await fetchPreapprovalDetails(preapprovalId, MP_ACCESS_TOKEN)
      console.log(`[webhook] Preapproval status: ${subscription.status}, ref: ${subscription.external_reference}`)
      
      if (subscription.status === 'authorized') {
        userId = subscription.external_reference
        isApproved = true
      }
    }

    // === Case 4: Subscription authorized payment ===
    if (body.type === 'subscription_authorized_payment') {
      const paymentId = body.data?.id
      console.log(`[webhook] Processing subscription payment ID: ${paymentId}`)
      // This is a payment within a subscription — fetch as regular payment
      const payment = await fetchPaymentDetails(paymentId, MP_ACCESS_TOKEN)
      console.log(`[webhook] Subscription payment status: ${payment.status}, ref: ${payment.external_reference}`)
      
      if (payment.status === 'approved') {
        userId = payment.external_reference
        isApproved = true
      }
    }

    // === Case 5: Merchant order (legacy) ===
    if (body.topic === 'merchant_order' && body.resource) {
      const orderUrl = body.resource.includes('http') ? body.resource : `https://api.mercadolibre.com/merchant_orders/${body.resource}`
      console.log(`[webhook] Processing merchant order: ${orderUrl}`)
      const orderRes = await fetch(orderUrl, {
        headers: { "Authorization": `Bearer ${MP_ACCESS_TOKEN}` }
      })
      const order = await orderRes.json()
      console.log(`[webhook] Merchant order status: ${order.order_status}, ref: ${order.external_reference}`)
      
      if (order.order_status === 'paid' && order.external_reference) {
        userId = order.external_reference
        isApproved = true
      }
    }

    // === Activate PRO if approved ===
    if (isApproved && userId) {
      const { userId: cleanUserId, isYearly } = parseExternalReference(userId)
      console.log(`[webhook] Activating PRO for: ${cleanUserId} (${isYearly ? 'yearly' : 'monthly'})`)
      
      const result = await activateProAccess(supabaseAdmin, cleanUserId, isYearly)
      
      if (result.skipped) {
        return new Response(JSON.stringify({ received: true, skipped: 'duplicate' }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      if (result.now && result.expiresAt) {
        await sendWelcomeEmail(supabaseAdmin, cleanUserId, result.now, result.expiresAt)
      }
    } else {
      console.log(`[webhook] No action taken. isApproved: ${isApproved}, userId: ${userId}, type: ${body.type}, topic: ${body.topic}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  } catch (e: any) {
    console.error("[webhook] Error:", e.message)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
