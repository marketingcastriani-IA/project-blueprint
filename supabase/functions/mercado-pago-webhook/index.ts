import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function verifyMPSignature(req: Request, body: any): Promise<boolean> {
  const MP_WEBHOOK_SECRET = Deno.env.get("MP_WEBHOOK_SECRET")
  if (!MP_WEBHOOK_SECRET) {
    console.warn("[mercado-pago-webhook] MP_WEBHOOK_SECRET not configured, skipping signature verification")
    return true // graceful fallback if secret not yet configured
  }

  const xSignature = req.headers.get("x-signature")
  const xRequestId = req.headers.get("x-request-id")
  if (!xSignature || !xRequestId) {
    console.error("[mercado-pago-webhook] Missing x-signature or x-request-id headers")
    return false
  }

  // Parse x-signature: "ts=...,v1=..."
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
    console.error("[mercado-pago-webhook] Invalid signature")
    return false
  }
  return true
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const body = await req.json()
    console.log("[mercado-pago-webhook] Notificação recebida:", body)

    // Verify webhook signature
    const isValid = await verifyMPSignature(req, body)
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

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

      // Idempotency check: skip if purchased_at was updated < 5 min ago
      const { data: existing } = await supabaseAdmin
        .from('user_access')
        .select('purchased_at')
        .eq('user_id', userId)
        .maybeSingle()

      if (existing?.purchased_at) {
        const lastPurchase = new Date(existing.purchased_at).getTime()
        if (Date.now() - lastPurchase < 5 * 60 * 1000) {
          console.log(`[mercado-pago-webhook] ⚠️ Pagamento duplicado ignorado para ${userId} (purchased_at < 5min)`)
          return new Response(JSON.stringify({ received: true, skipped: 'duplicate' }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          })
        }
      }

      // 1. Atualizar acesso no banco (upsert para garantir que funcione mesmo sem registro prévio)
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000);
      
      const { error: upsertError } = await supabaseAdmin
        .from('user_access')
        .upsert({ 
          user_id: userId,
          plan_type: 'pro', 
          status: 'approved',
          purchased_at: now.toISOString(),
          expires_at: expiresAt.toISOString()
        }, { onConflict: 'user_id' })

      if (upsertError) {
        console.error(`[mercado-pago-webhook] Erro ao atualizar acesso:`, upsertError);
      } else {
        console.log(`[mercado-pago-webhook] ✅ Acesso PRO ativado com sucesso! Expira em: ${expiresAt.toISOString()}`);
      }

      // 2. Buscar dados do perfil para o e-mail
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('email, display_name')
        .eq('user_id', userId)
        .single()

      if (profile?.email) {
        console.log(`[mercado-pago-webhook] Enviando e-mail de boas-vindas PRO para: ${profile.email}`);
        
        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
        if (RESEND_API_KEY) {
          try {
            const emailRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: 'Opções PRO X <contato@opcoesprox.com.br>',
                to: profile.email,
                subject: '🎉 Bem-vindo ao Opções PRO X — Seu Acesso PRO Está Ativo!',
                html: `
                  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:640px;margin:0 auto;background:#0a0a0f;border-radius:16px;overflow:hidden;border:1px solid #1a1a2e">
                    <div style="background:linear-gradient(135deg,#6d28d9,#4f46e5);padding:40px 30px;text-align:center">
                      <h1 style="color:#fff;margin:0;font-size:28px">🚀 Acesso PRO Ativado!</h1>
                      <p style="color:#e0d4ff;margin:10px 0 0;font-size:15px">Seu pagamento foi confirmado com sucesso</p>
                    </div>
                    <div style="padding:30px">
                      <p style="color:#e2e8f0;font-size:16px;line-height:1.7">
                        Olá <strong style="color:#a78bfa">${profile.display_name || 'Investidor'}</strong>! 👋
                      </p>
                      <p style="color:#94a3b8;font-size:14px;line-height:1.7">
                        Parabéns! Seu plano <strong style="color:#22c55e">PRO</strong> está ativo e você agora tem acesso COMPLETO a todas as funcionalidades profissionais:
                      </p>

                      <div style="background:#111827;border-radius:12px;padding:20px;margin:20px 0;border:1px solid #1e293b">
                        <h3 style="color:#a78bfa;margin:0 0 12px;font-size:15px">📊 Simulador de Estruturas</h3>
                        <ul style="list-style:none;padding:0;margin:0;color:#cbd5e1;font-size:13px;line-height:2">
                          <li>✅ Monte qualquer estrutura (Box, Collar, Trava, Borboleta, etc.)</li>
                          <li>✅ Gráfico de Payoff interativo</li>
                          <li>✅ Simulações ILIMITADAS</li>
                        </ul>
                      </div>

                      <div style="background:#111827;border-radius:12px;padding:20px;margin:20px 0;border:1px solid #1e293b">
                        <h3 style="color:#a78bfa;margin:0 0 12px;font-size:15px">🤖 Análise por IA</h3>
                        <ul style="list-style:none;padding:0;margin:0;color:#cbd5e1;font-size:13px;line-height:2">
                          <li>✅ IA analisa e sugere melhorias na sua estrutura</li>
                          <li>✅ Identifica riscos e oportunidades</li>
                          <li>✅ Uso ILIMITADO</li>
                        </ul>
                      </div>

                      <div style="background:#111827;border-radius:12px;padding:20px;margin:20px 0;border:1px solid #1e293b">
                        <h3 style="color:#a78bfa;margin:0 0 12px;font-size:15px">📷 OCR — Leitura de Imagens</h3>
                        <ul style="list-style:none;padding:0;margin:0;color:#cbd5e1;font-size:13px;line-height:2">
                          <li>✅ Tire foto da tela e a IA monta a estrutura</li>
                          <li>✅ Funciona com qualquer corretora</li>
                        </ul>
                      </div>

                      <div style="background:#111827;border-radius:12px;padding:20px;margin:20px 0;border:1px solid #1e293b">
                        <h3 style="color:#a78bfa;margin:0 0 12px;font-size:15px">🧮 Calculadora CDI x Opções</h3>
                        <ul style="list-style:none;padding:0;margin:0;color:#cbd5e1;font-size:13px;line-height:2">
                          <li>✅ Compare o lucro da operação com o CDI</li>
                          <li>✅ Com/sem IR (tabela regressiva automática)</li>
                        </ul>
                      </div>

                      <div style="background:#111827;border-radius:12px;padding:20px;margin:20px 0;border:1px solid #1e293b">
                        <h3 style="color:#a78bfa;margin:0 0 12px;font-size:15px">📊 Rastreador de Box Spread</h3>
                        <ul style="list-style:none;padding:0;margin:0;color:#cbd5e1;font-size:13px;line-height:2">
                          <li>✅ Monitore Box Spread vs CDI em tempo real</li>
                          <li>✅ Decida manter ou encerrar com dados reais</li>
                        </ul>
                      </div>

                      <div style="background:#111827;border-radius:12px;padding:20px;margin:20px 0;border:1px solid #1e293b">
                        <h3 style="color:#a78bfa;margin:0 0 12px;font-size:15px">🎯 Diversificador + Portfólio</h3>
                        <ul style="list-style:none;padding:0;margin:0;color:#cbd5e1;font-size:13px;line-height:2">
                          <li>✅ Monte portfólio de estratégias equilibrado</li>
                          <li>✅ Histórico completo + Relatórios em PDF</li>
                        </ul>
                      </div>

                      <div style="background:#0c1a2e;border-radius:12px;padding:20px;margin:20px 0;border:1px solid #1e3a5f">
                        <h3 style="color:#f59e0b;margin:0 0 12px;font-size:15px">🔴 Dados ao Vivo (Tempo Real)</h3>
                        <ul style="list-style:none;padding:0;margin:0;color:#cbd5e1;font-size:13px;line-height:2">
                          <li>✅ Preços atualizados em tempo real</li>
                          <li>✅ Visualização profissional</li>
                        </ul>
                        <div style="background:#1a0f00;border:1px solid #f59e0b44;border-radius:8px;padding:12px;margin-top:12px">
                          <p style="color:#fbbf24;font-size:12px;margin:0;line-height:1.6">
                            ⚠️ <strong>IMPORTANTE:</strong> O Tempo Real requer conexão com o <strong>Profit Pro</strong> (Nelogica) via Bridge RTD. 
                            Basta ter o Profit Pro aberto e configurar o Bridge. 
                            Veja o guia: Menu → Manual → Configuração do Bridge
                          </p>
                        </div>
                      </div>

                      <p style="color:#94a3b8;font-size:13px;line-height:1.7;margin-top:25px">
                        📅 <strong style="color:#e2e8f0">Válido até:</strong> ${expiresAt.toLocaleDateString('pt-BR')}<br>
                        💳 <strong style="color:#e2e8f0">Data da compra:</strong> ${now.toLocaleDateString('pt-BR')}
                      </p>

                      <div style="text-align:center;margin:30px 0 10px">
                        <a href="https://www.opcoesprox.com.br/dashboard" style="display:inline-block;background:linear-gradient(135deg,#6d28d9,#4f46e5);color:#fff;text-decoration:none;padding:14px 40px;border-radius:10px;font-weight:bold;font-size:15px">
                          Acessar Plataforma →
                        </a>
                      </div>
                      <div style="text-align:center;margin:10px 0 0">
                        <a href="https://www.opcoesprox.com.br/manual" style="color:#a78bfa;font-size:13px;text-decoration:underline">📖 Ver Manual Completo</a>
                        &nbsp;&nbsp;|&nbsp;&nbsp;
                        <a href="https://www.opcoesprox.com.br/faq" style="color:#a78bfa;font-size:13px;text-decoration:underline">❓ FAQ</a>
                      </div>
                    </div>
                    <div style="background:#060609;padding:20px;text-align:center;border-top:1px solid #1a1a2e">
                      <p style="color:#475569;font-size:11px;margin:0">Opções PRO X © ${now.getFullYear()} — Todos os direitos reservados</p>
                    </div>
                  </div>
                `
              })
            });
            const emailResult = await emailRes.json();
            console.log(`[mercado-pago-webhook] ✅ E-mail enviado:`, emailResult);
          } catch (emailErr: any) {
            console.error(`[mercado-pago-webhook] ⚠️ Erro ao enviar e-mail:`, emailErr.message);
          }
        } else {
          console.warn("[mercado-pago-webhook] RESEND_API_KEY não configurada, e-mail não enviado");
        }
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