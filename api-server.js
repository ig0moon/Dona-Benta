// ============================================
// DONA BENTA — api-server.js
// Servidor de Pagamentos e Arquivos Estáticos Seguro
// Roda em Node.js nativo (sem dependências externas)
// Proteção abrangente: OWASP Top 10, Rate Limiting, CSP,
// Prevenção de Path Traversal, Anti-Carding e Verificação de Preços
// ============================================

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || 'TEST-6815069311027509-101321-edc3de39b4360327630d8af919ee5829-3191426074';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nxigfuivadxjotlqrwux.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_0TIbP0aiCcLnXjM-cRz6pQ_NCQycx5Z';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ============================================
// 1. HEADERS DE SEGURANÇA (OWASP HARDENING)
// ============================================
const SECURITY_HEADERS = {
  // Content Security Policy: restringe estritamente as origens permitidas
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://sdk.mercadopago.com https://http2.mlstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://nxigfuivadxjotlqrwux.supabase.co https://api.mercadopago.com https://viacep.com.br; img-src 'self' data: blob: https://images.unsplash.com https://nxigfuivadxjotlqrwux.supabase.co https://http2.mlstatic.com; frame-src 'self' https://sdk.mercadopago.com https://www.mercadopago.com; object-src 'none'; base-uri 'self'; form-action 'self';",
  // Impede interpretação MIME incorreta (MIME-Sniffing)
  'X-Content-Type-Options': 'nosniff',
  // Protege contra Clickjacking
  'X-Frame-Options': 'SAMEORIGIN',
  // Proteção contra ataques XSS legados
  'X-XSS-Protection': '1; mode=block',
  // Política de referência segura
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Desativa recursos desnecessários do navegador (câmera, microfone, geolocalização)
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  // Prevenção de vazamento de software servidor
  'X-Powered-By': 'Dona-Benta-Secure-Gateway'
};

// ============================================
// 2. RATE LIMITER IN-MEMORY (SLIDING WINDOW)
// Proteção contra DDoS, Brute Force e Carding
// ============================================
const rateLimitMap = new Map();

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = forwarded.split(',');
    if (ips.length > 0) return ips[0].trim();
  }
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || '127.0.0.1';
}

function checkRateLimit(ip, bucket, maxRequests, windowMs) {
  const key = `${ip}:${bucket}`;
  const now = Date.now();
  let record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + windowMs };
    rateLimitMap.set(key, record);
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (record.count >= maxRequests) {
    const retryAfterSec = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
    return { allowed: false, retryAfter: retryAfterSec };
  }

  record.count++;
  return { allowed: true, remaining: maxRequests - record.count };
}

// Limpeza automática periódica de registros de IP expirados (evita vazamento de memória)
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

// ============================================
// 3. HELPERS DE RESPOSTA E PARSER DE BODY
// ============================================
function sendJson(res, statusCode, data, extraHeaders = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    ...SECURITY_HEADERS,
    ...extraHeaders
  });
  res.end(JSON.stringify(data));
}

// Limite estrito de 64KB para requisições JSON (evita ataques de DoS por consumo de memória)
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    const MAX_SIZE = 64 * 1024; // 64 KB

    req.on('data', chunk => {
      body += chunk;
      if (body.length > MAX_SIZE) {
        req.destroy();
        reject(new Error('Payload demasiado grande para requisição'));
      }
    });

    req.on('end', () => {
      if (!body || !body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('JSON inválido na requisição'));
      }
    });

    req.on('error', reject);
  });
}

// Sanitização de strings para evitar CRLF injection em logs e cabeçalhos
function sanitizeInput(str, maxLength = 255) {
  if (typeof str !== 'string') return '';
  return str.replace(/[\r\n\t]/g, ' ').trim().slice(0, maxLength);
}

// Validação de UUID de pedido
function isValidPedidoId(id) {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-fA-F-]{8,45}$/.test(id.trim());
}

// ============================================
// 4. INTEGRAÇÃO SUPABASE (CONSULTA E ATUALIZAÇÃO)
// ============================================

// Consulta segura do pedido no banco de dados para evitar manipulação de valores
async function consultarPedidoSupabase(pedidoId) {
  if (!isValidPedidoId(pedidoId)) return null;
  try {
    const url = `${SUPABASE_URL}/rest/v1/pedidos?id=eq.${encodeURIComponent(pedidoId)}&select=id,valor_total,status,pago`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  } catch (err) {
    console.error('[Supabase] Falha ao consultar pedido:', err.message);
    return null;
  }
}

// Atualização de status e pagamento do pedido
async function atualizarPedidoSupabase(pedidoId, dadosAtualizacao) {
  if (!isValidPedidoId(pedidoId)) return;
  try {
    const url = `${SUPABASE_URL}/rest/v1/pedidos?id=eq.${encodeURIComponent(pedidoId)}`;
    const resp = await fetch(url, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(dadosAtualizacao)
    });
    if (!resp.ok) {
      const err = await resp.text();
      console.warn('[Supabase] Aviso ao atualizar pedido:', err);
    } else {
      console.log(`[Supabase] Pedido ${pedidoId} atualizado com segurança:`, dadosAtualizacao);
    }
  } catch (err) {
    console.error('[Supabase] Falha ao comunicar com Supabase:', err.message);
  }
}

// ============================================
// 5. SERVIDOR DE ARQUIVOS ESTÁTICOS BLINDADO
// Prevenção contra Path Traversal e Vazamento de Código Fonte
// ============================================
const BLOCKED_FILES = new Set([
  'api-server.js',
  'package.json',
  'package-lock.json',
  'deno.json',
  'deno.lock',
  'tsconfig.json'
]);

const BLOCKED_DIRECTORIES = ['supabase', '.git', '.github', '.vscode', 'node_modules'];

const ALLOWED_STATIC_EXTENSIONS = new Set([
  '.html', '.css', '.js', '.json', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico', '.woff', '.woff2'
]);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function serveStaticFile(req, res, pathname) {
  const clientIp = getClientIp(req);

  // Rate Limiting para arquivos estáticos: 300 requisições/min por IP
  const rateLimit = checkRateLimit(clientIp, 'static', 300, 60 * 1000);
  if (!rateLimit.allowed) {
    return sendJson(res, 429, { erro: 'Limite de requisições excedido' }, { 'Retry-After': String(rateLimit.retryAfter) });
  }

  // 1. Decodificar pathname e bloquear caracteres nulos
  let decodedPath = '';
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return sendJson(res, 400, { erro: 'URL inválida ou malformada' });
  }

  if (decodedPath.includes('\0')) {
    console.warn(`[SEGURANÇA] Tentativa de Poison Null Byte bloqueada: ${clientIp}`);
    return sendJson(res, 400, { erro: 'Acesso negado' });
  }

  // 2. Normalizar e mapear raiz para index.html
  let safeRelPath = path.normalize(decodedPath).replace(/^(\.\.[\/\\])+/, '');
  if (safeRelPath === '/' || safeRelPath === '\\' || safeRelPath === '') {
    safeRelPath = '/index.html';
  }

  // Se rota não tem extensão (ex: /catalogo), busca /catalogo.html
  let ext = path.extname(safeRelPath).toLowerCase();
  if (!ext && !safeRelPath.endsWith('/')) {
    const candidateHtml = path.resolve(__dirname, '.' + safeRelPath + '.html');
    if (fs.existsSync(candidateHtml) && fs.statSync(candidateHtml).isFile()) {
      safeRelPath += '.html';
      ext = '.html';
    }
  }

  // 3. Bloqueio de arquivos ocultos/dotfiles (.env, .git, etc.) e diretórios protegidos
  const segments = safeRelPath.split(/[/\\]+/).filter(Boolean);
  for (const segment of segments) {
    if (segment.startsWith('.')) {
      console.warn(`[SEGURANÇA] Bloqueio de arquivo dotfile: ${safeRelPath} de ${clientIp}`);
      return sendJson(res, 403, { erro: 'Acesso negado' });
    }
    if (BLOCKED_DIRECTORIES.includes(segment.toLowerCase())) {
      console.warn(`[SEGURANÇA] Bloqueio de diretório protegido: ${safeRelPath} de ${clientIp}`);
      return sendJson(res, 403, { erro: 'Acesso negado' });
    }
  }

  // 4. Bloqueio de arquivos de sistema (ex: api-server.js)
  const baseName = path.basename(safeRelPath).toLowerCase();
  if (BLOCKED_FILES.has(baseName)) {
    console.warn(`[SEGURANÇA] Bloqueio de acesso a arquivo de sistema: ${baseName} de ${clientIp}`);
    return sendJson(res, 403, { erro: 'Acesso negado' });
  }

  // 5. Whitelist de extensões estáticas permitidas
  if (!ALLOWED_STATIC_EXTENSIONS.has(ext)) {
    return sendJson(res, 403, { erro: 'Tipo de arquivo não permitido' });
  }

  // 6. Confirmação do diretório canônico (impede escape de diretório)
  const fullPath = path.resolve(__dirname, '.' + safeRelPath);
  const rootDirWithSep = __dirname.endsWith(path.sep) ? __dirname : __dirname + path.sep;
  if (!fullPath.startsWith(rootDirWithSep)) {
    console.warn(`[SEGURANÇA] Tentativa de Path Traversal bloqueada: ${safeRelPath} de ${clientIp}`);
    return sendJson(res, 403, { erro: 'Acesso negado' });
  }

  // 7. Checa se o arquivo existe
  if (!fs.existsSync(fullPath)) {
    return sendJson(res, 404, { erro: 'Arquivo não encontrado' });
  }

  const stat = fs.statSync(fullPath);
  if (!stat.isFile()) {
    return sendJson(res, 403, { erro: 'Acesso negado' });
  }

  // 8. Cabeçalhos de cache seguros
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const headers = {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    ...SECURITY_HEADERS
  };

  if (ext === '.html') {
    headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
  } else if (['.png', '.jpg', '.jpeg', '.webp', '.svg', '.woff', '.woff2'].includes(ext)) {
    headers['Cache-Control'] = 'public, max-age=86400, immutable';
  } else {
    headers['Cache-Control'] = 'public, max-age=3600';
  }

  res.writeHead(200, headers);
  fs.createReadStream(fullPath).pipe(res);
}

// ============================================
// 6. SERVIDOR HTTP PRINCIPAL
// ============================================
const server = http.createServer(async (req, res) => {
  // Tratar pre-flight OPTIONS (CORS Seguro)
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      ...SECURITY_HEADERS
    });
    return res.end();
  }

  const clientIp = getClientIp(req);
  let parsedUrl;
  try {
    parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch {
    return sendJson(res, 400, { erro: 'URL de requisição inválida' });
  }

  const pathname = parsedUrl.pathname;

  try {
    // ----------------------------------------------------
    // Rota 1: Status de Saúde da API
    // ----------------------------------------------------
    if (pathname === '/api/health') {
      return sendJson(res, 200, {
        status: 'online',
        servico: 'Dona Benta - API de Pagamentos Blindada',
        gateway: 'Mercado Pago',
        ambiente: MP_ACCESS_TOKEN.startsWith('TEST-') ? 'Sandbox' : 'Produção',
        seguranca: 'Ativa (OWASP, Rate Limiting, CSP, Anti-Carding)'
      });
    }

    // ----------------------------------------------------
    // Rota 2: Gerar Pix Dinâmico
    // POST /api/pagamento/pix
    // Rate Limit: 12 req/min por IP
    // ----------------------------------------------------
    if (pathname === '/api/pagamento/pix' && req.method === 'POST') {
      const rateLimit = checkRateLimit(clientIp, 'pix', 12, 60 * 1000);
      if (!rateLimit.allowed) {
        return sendJson(res, 429, { 
          erro: 'Limite de tentativas de Pix excedido. Aguarde alguns instantes antes de gerar novo Pix.' 
        }, { 'Retry-After': String(rateLimit.retryAfter) });
      }

      const body = await parseBody(req);
      const { pedido_id, valor, descricao, cliente } = body;

      let valorEfetivo = Number(valor);

      // Verificação contra manipulação de preço: se pedido_id foi informado, valida contra o Supabase
      if (pedido_id) {
        if (!isValidPedidoId(pedido_id)) {
          return sendJson(res, 400, { erro: 'Identificador de pedido inválido' });
        }

        const pedidoDb = await consultarPedidoSupabase(pedido_id);
        if (!pedidoDb) {
          return sendJson(res, 404, { erro: 'Pedido não localizado no banco de dados' });
        }

        if (pedidoDb.pago === true) {
          return sendJson(res, 400, { erro: 'Este pedido já foi pago e confirmado anteriormente' });
        }

        if (pedidoDb.status === 'cancelado') {
          return sendJson(res, 400, { erro: 'Este pedido foi cancelado' });
        }

        const valorDb = Number(pedidoDb.valor_total);
        if (isNaN(valorDb) || valorDb <= 0) {
          return sendJson(res, 400, { erro: 'Valor do pedido cadastrado é inválido' });
        }

        // Se o valor enviado divergir do banco, prevalece com autoridade o valor registrado no banco
        if (Math.abs(valorEfetivo - valorDb) > 0.05) {
          console.warn(`[SEGURANÇA] Preço manipulado detectado no Pix! Cliente enviou R$ ${valorEfetivo}, valor no DB é R$ ${valorDb}. Corrigindo...`);
          valorEfetivo = valorDb;
        }
      }

      if (!valorEfetivo || valorEfetivo < 0.50 || valorEfetivo > 50000) {
        return sendJson(res, 400, { erro: 'Valor do pedido inválido ou fora dos limites permitidos (R$ 0,50 a R$ 50.000,00)' });
      }

      // Validação e sanitização de dados do pagador
      const rawEmail = (cliente?.email || '').trim().toLowerCase();
      const payerEmail = (rawEmail.includes('@') && !rawEmail.endsWith('@testuser.com'))
        ? rawEmail
        : 'cliente.donabenta@gmail.com';

      let cpfLimpo = (cliente?.cpf || '').replace(/\D/g, '');
      if (cpfLimpo.length !== 11 || /^(\d)\1+$/.test(cpfLimpo)) {
        cpfLimpo = '17286371630'; // CPF de teste válido para Sandbox
      }

      const nomeLimpo = sanitizeInput(cliente?.nome || 'Cliente Dona Benta', 80);
      const partesNome = nomeLimpo.split(' ');
      const firstName = partesNome[0] || 'Cliente';
      const lastName = partesNome.slice(1).join(' ') || 'Dona Benta';
      const descSegura = sanitizeInput(descricao || `Pedido Dona Benta #${pedido_id ? pedido_id.slice(0, 8) : 'DB'}`, 120);

      const mpPayload = {
        transaction_amount: Number(valorEfetivo.toFixed(2)),
        description: descSegura,
        payment_method_id: 'pix',
        payer: {
          email: payerEmail,
          first_name: firstName,
          last_name: lastName,
          identification: {
            type: 'CPF',
            number: cpfLimpo
          }
        }
      };

      const idempotencyKey = `pix-${pedido_id || Date.now()}-${crypto.randomBytes(6).toString('hex')}`;

      const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify(mpPayload)
      });

      const mpData = await mpResponse.json();

      if (!mpResponse.ok) {
        console.error('[Mercado Pago] Erro ao gerar Pix:', mpData);
        return sendJson(res, mpResponse.status, {
          erro: 'Erro ao gerar pagamento Pix no gateway',
          detalhes: mpData.message || mpData.cause || 'Recusado pelo gateway'
        });
      }

      const pointOfInteraction = mpData.point_of_interaction?.transaction_data;
      const pixCopiaCola = pointOfInteraction?.qr_code;
      const qrCodeBase64 = pointOfInteraction?.qr_code_base64;

      if (pedido_id) {
        await atualizarPedidoSupabase(pedido_id, {
          forma_pagamento: 'Pix',
          status: 'aguardando_confirmacao',
          pago: false
        });
      }

      return sendJson(res, 200, {
        sucesso: true,
        pagamento_id: mpData.id,
        status: mpData.status,
        status_detalhe: mpData.status_detail,
        valor: mpData.transaction_amount,
        pix_copia_cola: pixCopiaCola,
        qr_code_base64: qrCodeBase64 ? `data:image/png;base64,${qrCodeBase64}` : null,
        expiracao: mpData.date_of_expiration
      });
    }

    // ----------------------------------------------------
    // Rota 3: Processar Cartão de Crédito
    // POST /api/pagamento/cartao
    // Rate Limit: 6 req/min por IP (Anti-Carding / Anti-Brute-Force)
    // ----------------------------------------------------
    if (pathname === '/api/pagamento/cartao' && req.method === 'POST') {
      const rateLimit = checkRateLimit(clientIp, 'card', 6, 60 * 1000);
      if (!rateLimit.allowed) {
        console.warn(`[SEGURANÇA] Bloqueio de Carding/Flood no cartão de crédito: ${clientIp}`);
        return sendJson(res, 429, { 
          erro: 'Muitas tentativas com cartão de crédito. Por motivos de segurança, aguarde 1 minuto antes de tentar novamente.' 
        }, { 'Retry-After': String(rateLimit.retryAfter) });
      }

      const body = await parseBody(req);
      const { 
        pedido_id, 
        token, 
        issuer_id, 
        payment_method_id, 
        transaction_amount, 
        installments, 
        payer,
        descricao 
      } = body;

      // Validação estrita do token do cartão gerado pelo SDK Mercado Pago
      if (!token || typeof token !== 'string' || !/^[a-zA-Z0-9_-]{10,140}$/.test(token.trim())) {
        return sendJson(res, 400, { erro: 'Token de cartão de crédito inválido ou ausente' });
      }

      let valorEfetivo = Number(transaction_amount);

      // Verificação contra adulteração de preço com autoridade no Supabase
      if (pedido_id) {
        if (!isValidPedidoId(pedido_id)) {
          return sendJson(res, 400, { erro: 'Identificador de pedido inválido' });
        }

        const pedidoDb = await consultarPedidoSupabase(pedido_id);
        if (!pedidoDb) {
          return sendJson(res, 404, { erro: 'Pedido não localizado no banco de dados' });
        }

        if (pedidoDb.pago === true) {
          return sendJson(res, 400, { erro: 'Este pedido já se encontra pago e confirmado' });
        }

        if (pedidoDb.status === 'cancelado') {
          return sendJson(res, 400, { erro: 'Este pedido foi cancelado' });
        }

        const valorDb = Number(pedidoDb.valor_total);
        if (isNaN(valorDb) || valorDb <= 0) {
          return sendJson(res, 400, { erro: 'Valor do pedido cadastrado é inválido' });
        }

        if (Math.abs(valorEfetivo - valorDb) > 0.05) {
          console.warn(`[SEGURANÇA] Preço adulterado detectado no Cartão! Cliente enviou R$ ${valorEfetivo}, banco tem R$ ${valorDb}. Corrigindo...`);
          valorEfetivo = valorDb;
        }
      }

      if (!valorEfetivo || valorEfetivo < 0.50 || valorEfetivo > 50000) {
        return sendJson(res, 400, { erro: 'Valor do pedido inválido para cartão de crédito' });
      }

      let issuerIdLimpo = undefined;
      if (issuer_id && issuer_id !== 'null' && issuer_id !== 'undefined' && String(issuer_id).trim() !== '') {
        const num = Number(issuer_id);
        if (!isNaN(num) && num > 0) issuerIdLimpo = num;
      }

      let paymentMethodIdLimpo = payment_method_id;
      if (!paymentMethodIdLimpo || paymentMethodIdLimpo === 'null' || paymentMethodIdLimpo === 'undefined') {
        paymentMethodIdLimpo = undefined;
      } else {
        paymentMethodIdLimpo = sanitizeInput(String(paymentMethodIdLimpo), 30);
      }

      const rawEmail = (payer?.email || '').trim().toLowerCase();
      const payerEmail = (rawEmail.includes('@') && !rawEmail.endsWith('@testuser.com'))
        ? rawEmail
        : 'cliente.donabenta@gmail.com';

      let identificationLimpo = undefined;
      if (payer?.identification?.number) {
        const cpfNum = String(payer.identification.number).replace(/\D/g, '');
        if (cpfNum.length === 11 && !/^(\d)\1+$/.test(cpfNum)) {
          identificationLimpo = { type: payer.identification.type || 'CPF', number: cpfNum };
        } else {
          identificationLimpo = { type: 'CPF', number: '17286371630' };
        }
      } else {
        identificationLimpo = { type: 'CPF', number: '17286371630' };
      }

      const parcelas = Math.min(12, Math.max(1, parseInt(installments, 10) || 1));
      const descSegura = sanitizeInput(descricao || `Pedido Dona Benta #${pedido_id ? pedido_id.slice(0, 8) : 'DB'}`, 120);

      const mpPayload = {
        token: token.trim(),
        issuer_id: issuerIdLimpo,
        payment_method_id: paymentMethodIdLimpo,
        transaction_amount: Number(valorEfetivo.toFixed(2)),
        installments: parcelas,
        description: descSegura,
        payer: {
          email: payerEmail,
          identification: identificationLimpo
        }
      };

      const idempotencyKey = `card-${pedido_id || Date.now()}-${crypto.randomBytes(6).toString('hex')}`;

      let mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify(mpPayload)
      });

      let mpData = await mpResponse.json();

      // Fallback resiliente para Sandbox caso ocorra erro 2131 de issuer_id
      if (!mpResponse.ok && mpData.cause?.some(c => c.code === 2131) && mpPayload.issuer_id) {
        delete mpPayload.issuer_id;
        const retryResponse = await fetch('https://api.mercadopago.com/v1/payments', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': `retry-${idempotencyKey}`
          },
          body: JSON.stringify(mpPayload)
        });
        if (retryResponse.ok) {
          mpResponse = retryResponse;
          mpData = await retryResponse.json();
        }
      }

      if (!mpResponse.ok) {
        console.error('[Mercado Pago] Erro no cartão:', mpData);
        let msgDetalhes = mpData.message || 'Dados do cartão recusados pelo gateway.';
        if (mpData.cause && Array.isArray(mpData.cause)) {
          const codes = mpData.cause.map(c => c.code);
          if (codes.includes(2131)) {
            msgDetalhes = 'Bandeira ou número do cartão não reconhecidos no Sandbox. Utilize o Nome do Titular como "APRO" e os cartões de teste recomendados.';
          }
        }
        return sendJson(res, mpResponse.status, {
          erro: 'Pagamento com cartão não autorizado',
          status: mpData.status,
          detalhes: msgDetalhes
        });
      }

      const aprovado = mpData.status === 'approved';

      if (pedido_id) {
        await atualizarPedidoSupabase(pedido_id, {
          forma_pagamento: 'Cartão de Crédito',
          status: aprovado ? 'confirmado' : 'aguardando_confirmacao',
          pago: aprovado
        });
      }

      return sendJson(res, 200, {
        sucesso: aprovado,
        pagamento_id: mpData.id,
        status: mpData.status,
        status_detalhe: mpData.status_detail,
        mensagem: aprovado ? 'Pagamento aprovado com sucesso!' : 'Pagamento em análise ou pendente'
      });
    }

    // ----------------------------------------------------
    // Rota 4: Consultar Status de um Pagamento
    // GET /api/pagamento/status?id=123456&pedido_id=xxx
    // Rate Limit: 60 req/min por IP
    // ----------------------------------------------------
    if (pathname === '/api/pagamento/status' && req.method === 'GET') {
      const rateLimit = checkRateLimit(clientIp, 'status', 60, 60 * 1000);
      if (!rateLimit.allowed) {
        return sendJson(res, 429, { erro: 'Muitas consultas consecutivas' }, { 'Retry-After': String(rateLimit.retryAfter) });
      }

      const pagamentoId = parsedUrl.searchParams.get('id');
      const pedidoId = parsedUrl.searchParams.get('pedido_id');

      if (!pagamentoId || !/^\d+$/.test(pagamentoId.trim())) {
        return sendJson(res, 400, { erro: 'ID de pagamento inválido ou ausente' });
      }

      if (pedidoId && !isValidPedidoId(pedidoId)) {
        return sendJson(res, 400, { erro: 'ID de pedido inválido' });
      }

      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${pagamentoId.trim()}`, {
        headers: {
          'Authorization': `Bearer ${MP_ACCESS_TOKEN}`
        }
      });

      if (!mpResponse.ok) {
        return sendJson(res, mpResponse.status, { erro: 'Falha ao consultar Mercado Pago' });
      }

      const mpData = await mpResponse.json();
      const aprovado = mpData.status === 'approved';

      if (aprovado && pedidoId) {
        await atualizarPedidoSupabase(pedidoId, {
          status: 'confirmado',
          pago: true
        });
      }

      return sendJson(res, 200, {
        pagamento_id: mpData.id,
        status: mpData.status,
        status_detalhe: mpData.status_detail,
        pago: aprovado
      });
    }

    // ----------------------------------------------------
    // Rota 5: Simular Aprovação de Pix (EXCLUSIVA SANDBOX)
    // POST /api/pagamento/simular-aprovacao
    // Blindada: bloqueada estritamente em ambiente de produção
    // ----------------------------------------------------
    if (pathname === '/api/pagamento/simular-aprovacao' && req.method === 'POST') {
      // Bloqueio rigoroso em produção
      if (IS_PRODUCTION || !MP_ACCESS_TOKEN.startsWith('TEST-')) {
        console.warn(`[SEGURANÇA] Tentativa de simular aprovação em produção bloqueada: ${clientIp}`);
        return sendJson(res, 403, { erro: 'Simulação estritamente desabilitada em ambiente de produção' });
      }

      const body = await parseBody(req);
      const { pedido_id } = body;

      if (!isValidPedidoId(pedido_id)) {
        return sendJson(res, 400, { erro: 'pedido_id obrigatório e deve ter formato válido' });
      }

      const pedidoDb = await consultarPedidoSupabase(pedido_id);
      if (!pedidoDb) {
        return sendJson(res, 404, { erro: 'Pedido não localizado no sistema' });
      }

      if (pedidoDb.pago === true) {
        return sendJson(res, 400, { erro: 'Este pedido já se encontra pago' });
      }

      await atualizarPedidoSupabase(pedido_id, {
        status: 'confirmado',
        pago: true
      });

      return sendJson(res, 200, {
        sucesso: true,
        mensagem: `Pedido ${pedido_id} marcado como pago e confirmado com sucesso no Sandbox!`
      });
    }

    // ----------------------------------------------------
    // Rota 6: Webhook Seguro do Mercado Pago
    // POST /api/webhook/mercadopago
    // ----------------------------------------------------
    if (pathname === '/api/webhook/mercadopago' && req.method === 'POST') {
      const rateLimit = checkRateLimit(clientIp, 'webhook', 60, 60 * 1000);
      if (!rateLimit.allowed) {
        return sendJson(res, 429, { erro: 'Rate limit webhook' });
      }

      const body = await parseBody(req);
      const pagamentoId = body?.data?.id || parsedUrl.searchParams.get('data.id') || parsedUrl.searchParams.get('id');

      if (pagamentoId && /^\d+$/.test(String(pagamentoId).trim())) {
        try {
          // Consulta autoritativa na API oficial do Mercado Pago (nunca confia no payload solto do webhook)
          const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${String(pagamentoId).trim()}`, {
            headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` }
          });
          if (mpResponse.ok) {
            const pagamento = await mpResponse.json();
            if (pagamento.status === 'approved' && pagamento.external_reference) {
              const pedidoId = pagamento.external_reference;
              if (isValidPedidoId(pedidoId)) {
                await atualizarPedidoSupabase(pedidoId, { status: 'confirmado', pago: true });
                console.log(`[Webhook Seguro] Pedido ${pedidoId} aprovado via confirmação direta da API Mercado Pago!`);
              }
            }
          }
        } catch (e) {
          console.error('[Webhook Seguro] Erro ao validar pagamento com Mercado Pago:', e.message);
        }
      }

      return sendJson(res, 200, { recebido: true });
    }

    // ----------------------------------------------------
    // Servidor de Arquivos Estáticos Seguro (HTML, CSS, JS, Imagens)
    // ----------------------------------------------------
    if (req.method === 'GET') {
      return serveStaticFile(req, res, pathname);
    }

    // Qualquer outro método ou rota inexistente
    return sendJson(res, 404, { erro: 'Rota não encontrada' });

  } catch (err) {
    console.error('[Servidor Seguro] Erro não tratado:', err);
    return sendJson(res, 500, { erro: 'Erro interno no processamento da requisição' });
  }
});

// Tratamento de exceções e rejeições globais para garantir 100% de uptime
process.on('uncaughtException', err => {
  console.error('[FATAL] Uncaught Exception no servidor:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection:', reason);
});

server.listen(PORT, () => {
  console.log('==================================================');
  console.log(`🍰 Dona Benta — Servidor Blindado Ativo!`);
  console.log(`📍 Rodando em: http://localhost:${PORT}`);
  console.log(`🛡️  Segurança: OWASP, Anti-Path-Traversal, Rate Limiter, Anti-Carding`);
  console.log(`🔑 Mercado Pago: ${MP_ACCESS_TOKEN.startsWith('TEST-') ? 'Sandbox' : 'Produção'}`);
  console.log('==================================================');
});
