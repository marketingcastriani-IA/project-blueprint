import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

  // Verify the caller is an admin
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Check admin role
  const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: hasRole } = await serviceClient.rpc('has_role', { _user_id: user.id, _role: 'admin' });
  if (!hasRole) {
    return new Response(JSON.stringify({ error: 'Admin access required' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { to, subject, body, imageDataUrl, attachment } = await req.json();

    const recipients = Array.isArray(to)
      ? to.filter((email: string) => typeof email === 'string' && email.trim().length > 0)
      : (typeof to === 'string' && to.trim().length > 0 ? [to] : []);

    if (!recipients.length || !subject || !body) {
      return new Response(JSON.stringify({ error: 'Missing required fields: to (string|string[]), subject, body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Upload image to Supabase Storage if provided
    let imagePublicUrl = '';
    if (imageDataUrl && imageDataUrl.startsWith('data:')) {
      try {
        const matches = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          const mimeType = matches[1];
          const base64Data = matches[2];
          const ext = mimeType.split('/')[1] || 'png';
          const fileName = `promo-${Date.now()}.${ext}`;

          // Convert base64 to Uint8Array
          const binaryStr = atob(base64Data);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }

          const { error: uploadError } = await serviceClient.storage
            .from('email-images')
            .upload(fileName, bytes.buffer, {
              contentType: mimeType,
              upsert: true,
            });

          if (!uploadError) {
            const { data: publicUrlData } = serviceClient.storage
              .from('email-images')
              .getPublicUrl(fileName);
            imagePublicUrl = publicUrlData.publicUrl;
            console.log('Image uploaded successfully:', imagePublicUrl);
          } else {
            console.error('Image upload error:', uploadError);
          }
        }
      } catch (imgErr) {
        console.error('Error processing image:', imgErr);
      }
    }

    const checkoutUrl = 'https://www.opcoesprox.com.br/settings?upgrade=true';

    const imageHtml = imagePublicUrl
      ? `<tr>
           <td style="padding: 0;">
             <img src="${imagePublicUrl}" alt="Promoção Opções PRO X" style="width: 100%; max-width: 560px; height: auto; display: block; border-radius: 12px; margin: 0 auto;" />
           </td>
         </tr>
         <tr><td style="height: 24px;"></td></tr>`
      : '';

    const htmlBody = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f0f1a; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f0f1a; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
          
          <!-- Header -->
          <tr>
            <td style="text-align: center; padding: 32px 20px 24px;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -0.5px;">
                <span style="color: #a78bfa;">Opções</span>
                <span style="color: #ffffff;"> PRO </span>
                <span style="background: linear-gradient(135deg, #6366f1, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">X</span>
              </h1>
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(145deg, #1a1a2e, #16213e); border-radius: 16px; border: 1px solid rgba(99, 102, 241, 0.2); overflow: hidden;">
                
                <!-- Image -->
                ${imageHtml}

                <!-- Body -->
                <tr>
                  <td style="padding: 28px 32px; color: #e2e8f0; font-size: 15px; line-height: 1.7;">
                    ${body.replace(/\n/g, '<br>')}
                  </td>
                </tr>

                <!-- CTA Button -->
                <tr>
                  <td style="padding: 8px 32px 32px; text-align: center;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                      <tr>
                        <td style="border-radius: 12px; background: linear-gradient(135deg, #6366f1, #8b5cf6, #a78bfa); padding: 2px;">
                          <a href="${checkoutUrl}" style="display: block; padding: 16px 48px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 10px; color: #ffffff; text-decoration: none; font-size: 18px; font-weight: 800; letter-spacing: 0.5px; text-align: center;">
                            🚀 Assinar PRO Agora
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 20px 16px; text-align: center;">
              <p style="margin: 0 0 8px; color: #64748b; font-size: 12px;">
                <a href="https://www.opcoesprox.com.br" style="color: #818cf8; text-decoration: none; font-weight: 600;">opcoesprox.com.br</a>
              </p>
              <p style="margin: 0; color: #475569; font-size: 11px;">
                Opções PRO X — Análise profissional de opções
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const fromEmail = 'Opções PRO X <contato@opcoesprox.com.br>';

    // Build attachments array for Resend
    const attachments: Array<{ filename: string; content: string; content_type?: string }> = [];
    if (attachment && attachment.name && attachment.content) {
      attachments.push({
        filename: attachment.name,
        content: attachment.content,
        ...(attachment.type ? { content_type: attachment.type } : {}),
      });
    }

    const emailPayload: Record<string, unknown> = {
      from: fromEmail,
      to: recipients,
      subject,
      html: htmlBody,
    };
    if (attachments.length > 0) {
      emailPayload.attachments = attachments;
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    const resData = await res.json();

    if (!res.ok) {
      console.error('Resend error:', resData);
      return new Response(JSON.stringify({ error: 'Failed to send email', details: resData }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Admin email sent to ${recipients.length} recipient(s): ${subject}`);
    return new Response(JSON.stringify({ success: true, id: resData.id, recipients: recipients.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('Error sending admin email:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
