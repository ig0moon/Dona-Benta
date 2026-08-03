// ============================================
// DONA BENTA — Configuração do Supabase
// ============================================
// Substitua pela URL e chave anônima do seu projeto Supabase
// (Configurações do projeto > API)

const SUPABASE_URL = 'https://SEU-PROJETO.supabase.co';
const SUPABASE_ANON_KEY = 'SUA-CHAVE-ANONIMA-AQUI';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// Estrutura de tabelas esperada no Supabase
// ============================================
//
// produtos
//   id (uuid, pk, default gen_random_uuid())
//   nome (text)
//   descricao (text)
//   descricao_curta (text)
//   preco (numeric)
//   categoria (text) — ex: 'bolos', 'doces', 'salgados', 'paes', 'tortas'
//   imagem_url (text)
//   destaque (boolean, default false) — usado no carrossel da index
//   disponivel (boolean, default true)
//   estoque (integer, default 0)
//   criado_em (timestamptz, default now())
//
// perfis
//   id (uuid, pk, references auth.users)
//   nome (text)
//   telefone (text)
//   cep (text)
//   bairro (text)
//   logradouro (text)
//   numero (text)
//   complemento (text)
//   role (text, default 'cliente') — 'cliente' | 'admin'
//   criado_em (timestamptz, default now())
//
// pedidos
//   id (uuid, pk, default gen_random_uuid())
//   cliente_id (uuid, references perfis.id)
//   itens (jsonb) — [{ produto_id, nome, preco, quantidade }]
//   valor_total (numeric)
//   status (text, default 'aguardando_confirmacao')
//        'aguardando_confirmacao' | 'confirmado' | 'em_preparo' | 'pronto' | 'entregue' | 'cancelado'
//   tipo_entrega (text) — 'retirada' | 'entrega'
//   endereco_entrega (text, nullable)
//   data_agendada (date)
//   horario_agendado (text)
//   observacoes (text, nullable)
//   forma_pagamento (text)
//   criado_em (timestamptz, default now())
//
// horarios_disponiveis (opcional, ou calcular no client a partir de pedidos)
//   data (date)
//   horario (text)
//   capacidade (integer, default 3)

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
  const [ano, mes, dia] = dataStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

const NUMERO_WHATSAPP = '5511999999999'; // substitua pelo número real, com DDI+DDD
