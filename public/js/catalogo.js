// ============================================
// DONA BENTA — js/catalogo.js
// Lista de produtos: busca rápida, filtro por categoria e cards
// ============================================

let TODOS_PRODUTOS = [];
let categoriaAtiva = 'todos';
let termoBusca = '';
let erroCarregamentoCatalogo = false;

// Normaliza texto removendo acentos e deixando em minúsculas
function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Compara categoria do produto com o filtro ativo tolerando plurais e acentos
function bateCategoria(catProduto, catFiltro) {
  if (!catFiltro || catFiltro === 'todos') return true;
  const p = normalizar(catProduto);
  const f = normalizar(catFiltro);

  if (p === f) return true;
  if (p.includes(f) || f.includes(p)) return true;

  // Casos específicos comuns em português
  if (f === 'paes' && (p === 'pao' || p.startsWith('pa'))) return true;
  if (f === 'bolos' && (p === 'bolo' || p.startsWith('bol'))) return true;
  if (f === 'doces' && (p === 'doce' || p.startsWith('doc'))) return true;
  if (f === 'salgados' && (p === 'salgado' || p.startsWith('salg'))) return true;
  if (f === 'tortas' && (p === 'torta' || p.startsWith('tort'))) return true;

  return false;
}

async function carregarCatalogo() {
  const area = document.getElementById('areaCatalogo');
  if (!area) return;

  // Servidor lento (ou acordando, no plano gratuito do Render): avisa em vez de dar erro.
  const avisoDemora = setTimeout(() => {
    area.innerHTML = `
      <div class="spinner"></div>
      <p style="text-align:center; color:var(--marrom-claro);">Estamos buscando as delícias do forno, só mais um instante…</p>`;
  }, 4000);

  try {
    const consultaPromise = db
      .from('produtos')
      .select('*')
      .order('criado_em', { ascending: false });

    // Limite generoso: o banco fica em outra região e o servidor pode estar acordando.
    // (Antes era 3 s, o que mostrava erro com o banco funcionando normalmente.)
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 45000)
    );

    const { data, error } = await Promise.race([consultaPromise, timeoutPromise]);

    if (error) {
      throw new Error(error.message || 'Falha ao carregar os produtos do TiDB.');
    }
    TODOS_PRODUTOS = Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('Não foi possível carregar o catálogo do TiDB:', err.message || err);
    TODOS_PRODUTOS = [];
    erroCarregamentoCatalogo = true;
  } finally {
    clearTimeout(avisoDemora);
  }

  // Categoria via parâmetro de URL (?categoria=bolos)
  const params = new URLSearchParams(window.location.search);
  const catUrl = params.get('categoria');
  if (catUrl) {
    categoriaAtiva = catUrl.toLowerCase().trim();
    document.querySelectorAll('.filtro-btn').forEach(b => {
      b.classList.toggle('ativo', b.dataset.categoria === categoriaAtiva);
    });
  }

  renderizarCatalogo();
}

function renderizarCatalogo() {
  const area = document.getElementById('areaCatalogo');
  if (!area) return;

  if (erroCarregamentoCatalogo) {
    area.innerHTML = `
      <div class="vazio cartao">
        <span class="material-symbols-outlined">database_off</span>
        <h3>Não foi possível carregar os produtos</h3>
        <p>Nossa vitrine demorou para responder. Tente novamente em instantes.</p>
        <button type="button" class="btn btn-primario" onclick="window.location.reload()">Tentar novamente</button>
      </div>
    `;
    return;
  }

  let lista = TODOS_PRODUTOS;

  // Filtro de categoria
  if (categoriaAtiva !== 'todos') {
    lista = lista.filter(p => bateCategoria(p.categoria, categoriaAtiva));
  }

  // Filtro de busca textual
  if (termoBusca.trim()) {
    const termo = normalizar(termoBusca);
    lista = lista.filter(p =>
      normalizar(p.nome).includes(termo) ||
      normalizar(p.descricao).includes(termo) ||
      normalizar(p.categoria).includes(termo)
    );
  }

  if (lista.length === 0) {
    area.innerHTML = `
      <div class="vazio cartao">
        <span class="material-symbols-outlined">search_off</span>
        <h3>Nenhum produto encontrado</h3>
        <p>Não encontramos delícias para o filtro atual. Tente buscar por outro termo ou selecione "Todos".</p>
      </div>
    `;
    return;
  }

  area.innerHTML = `<div class="catalogo-grade">${lista.map((p, i) => cartaoProdutoHtml(p, i)).join('')}</div>`;
  ligarBotoesAdicionar(area, TODOS_PRODUTOS);
}

// Configuração dos botões de filtro de categoria
function configurarFiltros() {
  const container = document.getElementById('filtros');
  if (!container) return;

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.filtro-btn');
    if (!btn) return;

    categoriaAtiva = btn.dataset.categoria || 'todos';
    container.querySelectorAll('.filtro-btn').forEach(b => {
      b.classList.toggle('ativo', b === btn);
    });

    renderizarCatalogo();
  });
}

// Configuração do campo de busca textual
function configurarBusca() {
  const campo = document.getElementById('campoBusca');
  if (!campo) return;

  campo.addEventListener('input', (e) => {
    termoBusca = e.target.value;
    renderizarCatalogo();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  configurarFiltros();
  configurarBusca();
  carregarCatalogo();
});