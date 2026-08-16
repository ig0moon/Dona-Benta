// ============================================
// DONA BENTA — js/supabase-client.js
// Cliente Supabase + helpers globais
// ============================================

const SUPABASE_URL = 'https://nxigfuivadxjotlqrwux.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_0TIbP0aiCcLnXjM-cRz6pQ_NCQycx5Z';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// Helpers de autenticação
// ============================================

async function usuarioAtual() {
  const { data: { session } } = await db.auth.getSession();
  return session?.user ?? null;
}

async function perfilAtual() {
  const usuario = await usuarioAtual();
  if (!usuario) return null;
  const { data, error } = await db
    .from('perfis')
    .select('*')
    .eq('id', usuario.id)
    .single();
  if (error) {
    console.error('Erro ao buscar perfil:', error);
    return null;
  }
  return data;
}

async function exigirLogin(redirecionarPara = 'login.html') {
  const usuario = await usuarioAtual();
  if (!usuario) {
    window.location.href = redirecionarPara;
    return null;
  }
  return usuario;
}

async function exigirAdmin() {
  const perfil = await perfilAtual();
  if (!perfil || perfil.role !== 'admin') {
    window.location.href = 'index.html';
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
    info: 'info'
  };

  const toast = document.createElement('div');
  toast.className = `toast ${tipo}`;
  toast.innerHTML = `
    <span class="material-symbols-outlined">${icones[tipo] || 'info'}</span>
    <span>${mensagem}</span>
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
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(dataStr) {
  if(!dataStr) return '';
  const dateObj = new Date(dataStr);
  const dia = String(dateObj.getDate()).padStart(2, '0');
  const mes = String(dateObj.getMonth() + 1).padStart(2, '0');
  const ano = dateObj.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

const NUMERO_WHATSAPP = '5542999823994';