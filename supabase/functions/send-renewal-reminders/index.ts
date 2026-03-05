import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Find users expiring in exactly 5 days (or less, up to 5 days)
    const now = new Date();
    const fiveDaysFromNow = new Date(now);
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
    fiveDaysFromNow.setHours(23, 59, 59, 999);

    const { data: expiringUsers, error: queryError } = await supabase
      .from('user_access')
      .select('user_id, expires_at, plan_type')
      .eq('status', 'approved')
      .not('expires_at', 'is', null)
      .lte('expires_at', fiveDaysFromNow.toISOString())
      .gte('expires_at', now.toISOString());

    if (queryError) throw queryError;

    if (!expiringUsers || expiringUsers.length === 0) {
      return new Response(JSON.stringify({ message: 'No expiring users found', sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get profiles for these users
    const userIds = expiringUsers.map((u: any) => u.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, email, display_name')
      .in('user_id', userIds);

    const profileMap: Record<string, any> = {};
    profiles?.forEach((p: any) => { profileMap[p.user_id] = p; });

    let sentCount = 0;
    const errors: string[] = [];

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (let i = 0; i < expiringUsers.length; i++) {
      const user = expiringUsers[i];
      // Rate limit: max 2 requests/second
      if (i > 0) await delay(600);
      const profile = profileMap[user.user_id];
      if (!profile?.email) continue;

      const expiryDate = new Date(user.expires_at).toLocaleDateString('pt-BR');
      const daysLeft = Math.ceil((new Date(user.expires_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const name = profile.display_name || profile.email.split('@')[0];

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #f0f0f0;">
            <h1 style="color: #1a1a2e; margin: 0;">Opções PRO X</h1>
          </div>
          
          <div style="padding: 30px 0;">
            <h2 style="color: #e94560;">⚠️ Sua assinatura vence em ${daysLeft} dia${daysLeft > 1 ? 's' : ''}!</h2>
            
            <p>Olá <strong>${name}</strong>,</p>
            
            <p>Sua assinatura do <strong>Opções PRO X</strong> vence em <strong>${expiryDate}</strong>.</p>
            
            <p>Renove agora para continuar com acesso total:</p>
            
            <ul style="line-height: 2;">
              <li>✅ Simulações ilimitadas</li>
              <li>✅ Relatórios de IA avançados</li>
              <li>✅ OCR para leitura automática de notas</li>
              <li>✅ Portfólio e histórico completos</li>
            </ul>
            
            <div style="text-align: center; padding: 20px 0;">
              <a href="https://www.opcoesprox.com.br/settings" 
                 style="background-color: #e94560; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                RENOVAR AGORA
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">Não perca acesso às suas ferramentas de análise de opções!</p>
          </div>
          
          <div style="border-top: 2px solid #f0f0f0; padding-top: 20px; text-align: center; color: #999; font-size: 12px;">
            <p>Opções PRO X - Análise profissional de opções</p>
            <p>Este é um email automático. Não responda a este email.</p>
          </div>
        </div>
      `;

      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: Deno.env.get('RESEND_FROM_EMAIL') || 'Opções PRO X <onboarding@resend.dev>',
            to: [profile.email],
            subject: `⚠️ Sua assinatura vence em ${daysLeft} dia${daysLeft > 1 ? 's' : ''} - Renove agora!`,
            html: htmlBody,
          }),
        });

        const resData = await res.json();
        if (!res.ok) {
          errors.push(`Failed for ${profile.email}: ${JSON.stringify(resData)}`);
        } else {
          sentCount++;
        }
      } catch (emailErr: any) {
        errors.push(`Error for ${profile.email}: ${emailErr.message}`);
      }
    }

    console.log(`Renewal reminders: ${sentCount} sent, ${errors.length} errors`);
    if (errors.length > 0) console.error('Errors:', errors);

    return new Response(JSON.stringify({ 
      sent: sentCount, 
      total: expiringUsers.length,
      errors: errors.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('Error in renewal reminders:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
