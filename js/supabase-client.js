// ============================================
// DONA BENTA — js/supabase-client.js
// Cliente Supabase + helpers globais
// ============================================

const SUPABASE_URL = 'https://nxigfuivadxjotlqrwux.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_0TIbP0aiCcLnXjM-cRz6pQ_NCQycx5Z';
const BUCKET_PRODUTOS = 'produtos';
const BUCKET_AVATARES = 'fotos-perfil';
const NUMERO_WHATSAPP = '5542999823994';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// Segurança: Sanitização e Prevenção de XSS
// ============================================

function escapeHtml(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Sanitização estrita de URLs para prevenir ataques de pseudo-protocolos perigosos (javascript:, data:, vbscript:)
function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const limpo = url.trim();
  if (/^(javascript|vbscript|data):/i.test(limpo)) {
    console.warn('[SEGURANÇA] URL maliciosa bloqueada:', limpo);
    return 'about:blank';
  }
  return escapeHtml(limpo);
}

window.escapeHtml = escapeHtml;
window.sanitizeUrl = sanitizeUrl;

// ============================================
// Helpers de autenticação
// ============================================

async function usuarioAtual() {
  try {
    const { data: { session } } = await db.auth.getSession();
    return session?.user ?? null;
  } catch (err) {
    console.error('Erro ao verificar sessão:', err);
    return null;
  }
}

async function perfilAtual() {
  const usuario = await usuarioAtual();
  if (!usuario) return null;

  let perfil = {};
  try {
    const consultaPromise = db
      .from('perfis')
      .select('*')
      .eq('id', usuario.id)
      .maybeSingle();

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout de 3s')), 3000)
    );

    const { data, error } = await Promise.race([consultaPromise, timeoutPromise]);
    if (!error && data) {
      perfil = data;
    }
  } catch (err) {
    console.warn('Perfil carregado via fallback local/metadata:', err.message || err);
  }

  // Fallbacks usando metadados seguros do auth
  const meta = usuario.user_metadata || {};
  return {
    id: usuario.id,
    email: usuario.email,
    nome: perfil.nome || meta.nome || 'Cliente',
    telefone: perfil.telefone || meta.telefone || '',
    cep: perfil.cep || '',
    bairro: perfil.bairro || '',
    logradouro: perfil.logradouro || '',
    numero: perfil.numero || '',
    complemento: perfil.complemento || '',
    role: perfil.role || 'cliente',
    avatar_url: perfil.avatar_url || meta.avatar_url || null
  };
}

async function exigirLogin(redirecionarPara = 'login.html') {
  const usuario = await usuarioAtual();
  if (!usuario) {
    window.location.href = redirecionarPara;
    return null;
  }
  return usuario;
}

async function exigirAdmin(redirecionarPara = 'index.html') {
  const perfil = await perfilAtual();
  if (!perfil || perfil.role !== 'admin') {
    window.location.href = redirecionarPara;
    return null;
  }
  return perfil;
}

async function exigirStaff(redirecionarPara = 'index.html') {
  const perfil = await perfilAtual();
  if (!perfil || !['funcionario', 'admin'].includes(perfil.role)) {
    window.location.href = redirecionarPara;
    return null;
  }
  return perfil;
}

// ============================================
// Toast de notificação
// ============================================

function mostrarToast(mensagem, tipo = 'info') {
  const existente = document.querySelector('.toast');
  if (existente) existente.remove();

  const icones = {
    sucesso: 'check_circle',
    erro: 'error',
    info: 'info',
    alerta: 'warning'
  };

  const toast = document.createElement('div');
  toast.className = `toast ${tipo}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');
  toast.innerHTML = `
    <span class="material-symbols-outlined">${icones[tipo] || 'info'}</span>
    <span>${escapeHtml(mensagem)}</span>
  `;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('mostrar'));

  setTimeout(() => {
    toast.classList.remove('mostrar');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ============================================
// Formatação
// ============================================

function formatarPreco(valor) {
  const num = Number(valor) || 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/[\u00A0\u202F]/g, ' ');
}

function formatarData(dataStr) {
  if (!dataStr) return '';
  // Se for YYYY-MM-DD evita problemas de timezone
  if (typeof dataStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
    const [ano, mes, dia] = dataStr.split('-');
    return `${dia}/${mes}/${ano}`;
  }
  const dateObj = new Date(dataStr);
  if (isNaN(dateObj.getTime())) return String(dataStr);
  const dia = String(dateObj.getDate()).padStart(2, '0');
  const mes = String(dateObj.getMonth() + 1).padStart(2, '0');
  const ano = dateObj.getFullYear();
  return `${dia}/${mes}/${ano}`;
}