// Same-origin application client. Credentials and access tokens stay on the server.
const BACKEND_API_URL = new URL('api/', window.BASE_URL || `${window.location.origin}/`);
const BUCKET_PRODUTOS = 'produtos';
const BUCKET_AVATARES = 'fotos-perfil';
const NUMERO_WHATSAPP = '5542999823994';

async function requestBackend(path, options = {}) {
  try {
    const response = await fetch(new URL(path, BACKEND_API_URL), {
      credentials: 'same-origin',
      ...options
    });
    let body = null;
    if (response.status !== 204) {
      try {
        body = await response.json();
      } catch {
        body = null;
      }
    }
    return { response, body };
  } catch (error) {
    return {
      response: { ok: false, status: 0 },
      body: { error: { message: error.message || 'Falha ao comunicar com o servidor.' } }
    };
  }
}

class BackendQuery {
  constructor(table) {
    this.table = table;
    this.params = new URLSearchParams();
    this.method = 'GET';
    this.payload = null;
    this.singleResult = false;
    this.allowNoRows = false;
    this.promise = null;
  }

  select(columns = '*', options = {}) {
    this.params.set('select', columns);
    if (options.count === 'exact') this.params.set('count', 'exact');
    if (options.head) this.params.set('head', 'true');
    return this;
  }

  eq(column, value) { return this.filter(column, 'eq', value); }
  neq(column, value) { return this.filter(column, 'neq', value); }
  gt(column, value) { return this.filter(column, 'gt', value); }
  gte(column, value) { return this.filter(column, 'gte', value); }
  lt(column, value) { return this.filter(column, 'lt', value); }
  lte(column, value) { return this.filter(column, 'lte', value); }

  in(column, values) {
    const safeValues = (Array.isArray(values) ? values : []).map(value => String(value).replace(/[(),"\\]/g, ''));
    this.params.set(column, `in.(${safeValues.join(',')})`);
    return this;
  }

  order(column, options = {}) {
    const next = `${column}.${options.ascending === false ? 'desc' : 'asc'}`;
    const current = this.params.get('order');
    this.params.set('order', current ? `${current},${next}` : next);
    return this;
  }

  limit(value) {
    this.params.set('limit', String(value));
    return this;
  }

  insert(payload) {
    this.method = 'POST';
    this.payload = payload;
    return this;
  }

  upsert(payload) {
    this.method = 'POST';
    this.payload = payload;
    return this;
  }

  update(payload) {
    this.method = 'PATCH';
    this.payload = payload;
    return this;
  }

  delete() {
    this.method = 'DELETE';
    return this;
  }

  single() {
    this.singleResult = true;
    return this;
  }

  maybeSingle() {
    this.singleResult = true;
    this.allowNoRows = true;
    return this;
  }

  filter(column, operator, value) {
    this.params.set(column, `${operator}.${String(value)}`);
    return this;
  }

  execute() {
    if (this.promise) return this.promise;
    const isHead = this.params.get('head') === 'true';
    this.params.delete('head');
    const path = `data/${encodeURIComponent(this.table)}?${this.params.toString()}`;
    this.promise = requestBackend(path, {
      method: isHead ? 'GET' : this.method,
      headers: { 'Content-Type': 'application/json' },
      body: this.payload === null ? undefined : JSON.stringify(this.payload)
    }).then(({ response, body }) => {
      const error = body?.error || (!response.ok ? { message: `Falha na consulta (${response.status}).` } : null);
      let data = body?.data ?? null;
      if (this.singleResult && Array.isArray(data)) {
        if (data.length === 0 && !this.allowNoRows) {
          return { data: null, error: { message: 'Nenhum registro encontrado.' }, count: body?.count ?? null };
        }
        data = data[0] ?? null;
      }
      return { data, error, count: body?.count ?? null };
    }).catch(error => ({ data: null, error: { message: error.message }, count: null }));
    return this.promise;
  }

  then(resolve, reject) { return this.execute().then(resolve, reject); }
  catch(reject) { return this.execute().catch(reject); }
}

const authListeners = new Set();
function notifyAuth(event, user) {
  for (const listener of authListeners) listener(event, user ? { user } : null);
}

const db = {
  from(table) {
    return new BackendQuery(table);
  },
  auth: {
    async getSession() {
      const { response, body } = await requestBackend('auth/session');
      if (!response.ok) return { data: { session: null }, error: body?.error || { message: 'Falha ao consultar sessão.' } };
      return { data: { session: body?.data?.user ? { user: body.data.user } : null }, error: null };
    },
    async signInWithPassword({ email, password }) {
      const { response, body } = await requestBackend('auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const user = body?.data?.user || null;
      if (response.ok && user) notifyAuth('SIGNED_IN', user);
      return { data: { user, session: user ? { user } : null }, error: body?.error || null };
    },
    async signUp({ email, password, options = {} }) {
      const { response, body } = await requestBackend('auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, data: options.data || {} })
      });
      const user = body?.data?.user || null;
      if (response.ok && user) notifyAuth('SIGNED_IN', user);
      return { data: { user, session: user ? { user } : null }, error: body?.error || null };
    },
    async signOut() {
      const { response, body } = await requestBackend('auth/logout', { method: 'POST' });
      if (response.ok) notifyAuth('SIGNED_OUT', null);
      return { error: body?.error || null };
    },
    async resetPasswordForEmail(email) {
      const { body } = await requestBackend('auth/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, redirectTo: window.location.origin + '/login' })
      });
      return { error: body?.error || null };
    },
    async updateUser({ data }) {
      const { response, body } = await requestBackend('auth/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data })
      });
      const user = body?.data?.user || null;
      if (response.ok && user) notifyAuth('USER_UPDATED', user);
      return { data: { user }, error: body?.error || null };
    },
    onAuthStateChange(callback) {
      authListeners.add(callback);
      this.getSession().then(({ data }) => callback('INITIAL_SESSION', data.session));
      return { data: { subscription: { unsubscribe: () => authListeners.delete(callback) } } };
    }
  },
  storage: {
    from(bucket) {
      return {
        async upload(path, file, options = {}) {
          const form = new FormData();
          form.set('bucket', bucket);
          form.set('path', path);
          form.set('upsert', options.upsert ? 'true' : 'false');
          form.set('file', file, file.name || 'upload');
          const { response, body } = await requestBackend('storage/upload', { method: 'POST', body: form });
          return { data: body?.data || null, error: body?.error || (!response.ok ? { message: 'Falha no upload.' } : null) };
        },
        getPublicUrl(path) {
          const url = new URL('storage/public', BACKEND_API_URL);
          url.searchParams.set('bucket', bucket);
          url.searchParams.set('path', path);
          return { data: { publicUrl: url.href } };
        }
      };
    }
  }
};

window.db = db;

function escapeHtml(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const clean = url.trim();
  if (/^(javascript|vbscript|data):/i.test(clean)) {
    console.warn('[SEGURANÇA] URL maliciosa bloqueada.');
    return 'about:blank';
  }
  return escapeHtml(clean);
}

window.escapeHtml = escapeHtml;
window.sanitizeUrl = sanitizeUrl;

async function usuarioAtual() {
  try {
    const { data: { session } } = await db.auth.getSession();
    return session?.user ?? null;
  } catch (error) {
    console.error('Erro ao verificar sessão:', error);
    return null;
  }
}

async function perfilAtual() {
  const usuario = await usuarioAtual();
  if (!usuario) return null;

  let perfil = {};
  try {
    const { data } = await db.from('perfis').select('*').eq('id', usuario.id).maybeSingle();
    if (data) perfil = data;
  } catch (error) {
    console.warn('Não foi possível carregar o perfil:', error.message || error);
  }

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

async function exigirLogin(redirecionarPara = 'login') {
  const usuario = await usuarioAtual();
  if (!usuario) {
    window.location.href = redirecionarPara;
    return null;
  }
  return usuario;
}

async function exigirAdmin(redirecionarPara = 'home') {
  const perfil = await perfilAtual();
  if (!perfil || perfil.role !== 'admin') {
    window.location.href = redirecionarPara;
    return null;
  }
  return perfil;
}

async function exigirStaff(redirecionarPara = 'home') {
  const perfil = await perfilAtual();
  if (!perfil || !['funcionario', 'admin'].includes(perfil.role)) {
    window.location.href = redirecionarPara;
    return null;
  }
  return perfil;
}

function mostrarToast(mensagem, tipo = 'info') {
  const existente = document.querySelector('.toast');
  if (existente) existente.remove();
  const icones = { sucesso: 'check_circle', erro: 'error', info: 'info', alerta: 'warning' };
  const toast = document.createElement('div');
  toast.className = `toast ${tipo}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');
  toast.innerHTML = `<span class="material-symbols-outlined">${icones[tipo] || 'info'}</span><span>${escapeHtml(mensagem)}</span>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('mostrar'));
  setTimeout(() => {
    toast.classList.remove('mostrar');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function formatarPreco(valor) {
  const num = Number(valor) || 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/[\u00A0\u202F]/g, ' ');
}

function formatarData(dataStr) {
  if (!dataStr) return '';
  if (typeof dataStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
    const [ano, mes, dia] = dataStr.split('-');
    return `${dia}/${mes}/${ano}`;
  }
  const dateObj = new Date(dataStr);
  if (isNaN(dateObj.getTime())) return String(dataStr);
  return `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;
}

function formatarDataHora(dataStr) {
  if (!dataStr) return '';
  const dateObj = new Date(dataStr);
  if (isNaN(dateObj.getTime())) return String(dataStr);
  return `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()} às ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
}
