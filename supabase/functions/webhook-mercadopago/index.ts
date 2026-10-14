// ============================================
// DONA BENTA — Supabase Edge Function: webhook-mercadopago
// Recebe notificações de pagamento do Mercado Pago
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));

    const paymentId = body?.data?.id || url.searchParams.get('data.id') || url.searchParams.get('id');

    if (paymentId && MP_ACCESS_TOKEN) {
      const resp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` }
      });

      if (resp.ok) {
        const payment = await resp.json();
        console.log(`[Webhook] Pagamento ${paymentId}: ${payment.status}`);

        if (payment.status === 'approved' && payment.external_reference) {
          await supabaseAdmin
            .from('pedidos')
            .update({ status: 'confirmado', pago: true })
            .eq('id', payment.external_reference);
        }
      }
    }

    return new Response(JSON.stringify({ recebido: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ erro: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
