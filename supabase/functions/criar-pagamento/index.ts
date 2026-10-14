// ============================================
// DONA BENTA — Supabase Edge Function: criar-pagamento
// Executa no Deno (Serverless no Supabase)
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
    if (!MP_ACCESS_TOKEN) {
      throw new Error('Secret MP_ACCESS_TOKEN não configurada nas variáveis do Supabase');
    }

    const body = await req.json();
    const { tipo, pedido_id, valor, descricao, cliente, cartao } = body;

    // ----------------------------------------------------
    // Caso 1: Pagamento via PIX
    // ----------------------------------------------------
    if (tipo === 'pix') {
      const payerEmail = (cliente?.email && cliente.email.includes('@') && !cliente.email.endsWith('@testuser.com')) 
        ? cliente.email 
        : 'cliente.donabenta@gmail.com';

      let cpfLimpo = (cliente?.cpf || '').replace(/\D/g, '');
      if (cpfLimpo.length !== 11) cpfLimpo = '17286371630';

      const mpPayload = {
        transaction_amount: Number(Number(valor).toFixed(2)),
        description: descricao || `Pedido Dona Benta #${pedido_id || 'DB'}`,
        payment_method_id: 'pix',
        payer: {
          email: payerEmail,
          first_name: cliente?.nome?.split(' ')[0] || 'Cliente',
          last_name: cliente?.nome?.split(' ').slice(1).join(' ') || 'Dona Benta',
          identification: {
            type: 'CPF',
            number: cpfLimpo
          }
        }
      };

      const resp = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `pix-${pedido_id || Date.now()}-${crypto.randomUUID()}`
        },
        body: JSON.stringify(mpPayload)
      });

      const data = await resp.json();
      if (!resp.ok) {
        return new Response(JSON.stringify({ erro: 'Erro no Mercado Pago', detalhes: data }), {
          status: resp.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const pointOfInteraction = data.point_of_interaction?.transaction_data;
      return new Response(JSON.stringify({
        sucesso: true,
        pagamento_id: data.id,
        status: data.status,
        status_detalhe: data.status_detail,
        valor: data.transaction_amount,
        pix_copia_cola: pointOfInteraction?.qr_code,
        qr_code_base64: pointOfInteraction?.qr_code_base64 ? `data:image/png;base64,${pointOfInteraction.qr_code_base64}` : null,
        expiracao: data.date_of_expiration
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ----------------------------------------------------
    // Caso 2: Pagamento via Cartão de Crédito
    // ----------------------------------------------------
    if (tipo === 'cartao') {
      const { token, issuer_id, payment_method_id, installments, payer } = cartao || {};
      if (!token) {
        return new Response(JSON.stringify({ erro: 'Token do cartão ausente' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const mpPayload = {
        token,
        issuer_id: issuer_id ? String(issuer_id) : undefined,
        payment_method_id,
        transaction_amount: Number(Number(valor).toFixed(2)),
        installments: Number(installments) || 1,
        description: descricao || `Pedido Dona Benta #${pedido_id || 'DB'}`,
        payer: {
          email: payer?.email || 'cliente.donabenta@gmail.com',
          identification: payer?.identification
        }
      };

      const resp = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `card-${pedido_id || Date.now()}-${crypto.randomUUID()}`
        },
        body: JSON.stringify(mpPayload)
      });

      const data = await resp.json();
      const aprovado = data.status === 'approved';

      return new Response(JSON.stringify({
        sucesso: aprovado,
        pagamento_id: data.id,
        status: data.status,
        status_detalhe: data.status_detail
      }), {
        status: resp.ok ? 200 : resp.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ erro: 'Tipo de pagamento não especificado (pix ou cartao)' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ erro: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
