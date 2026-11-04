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

  try {
    const consultaPromise = db
      .from('produtos')
      .select('*')
      .order('criado_em', { ascending: false });

    // Limite de 3 segundos para evitar trava de rede
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 3000)
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
        <p>Verifique a conexão do banco TiDB e tente novamente.</p>
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

  area.innerHTML = `
    <div class="catalogo-grade">
      ${lista.map(p => `
        <a href="produto?id=${encodeURIComponent(p.id)}" class="produto-cartao">
          <div class="produto-imagem">
            ${p.disponivel === false ? '<span class="esgotado-tag">Esgotado</span>' : ''}
            <img src="${escapeHtml(p.imagem_url || 'img/HeaderDonaBenta.png')}" alt="${escapeHtml(p.nome)}" loading="lazy" onerror="this.src='img/HeaderDonaBenta.png'">
          </div>
          <div class="produto-info">
            <h3>${escapeHtml(p.nome)}</h3>
            <div class="produto-rodape">
              <span class="produto-preco">${formatarPreco(p.preco)}</span>
              <button class="produto-add" data-add="${escapeHtml(p.id)}" aria-label="Adicionar ${escapeHtml(p.nome)} ao carrinho" title="Adicionar ao carrinho">
                <span class="material-symbols-outlined">add_shopping_cart</span>
              </button>
            </div>
          </div>
        </a>
      `).join('')}
    </div>
  `;

  // Listener para botões de adicionar ao carrinho
  area.querySelectorAll('[data-add]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const idAlvo = String(btn.dataset.add);
      const produto = TODOS_PRODUTOS.find(p => String(p.id) === idAlvo);
      if (!produto) return;

      if (produto.disponivel === false) {
        mostrarToast('Este produto está esgotado no momento.', 'alerta');
        return;
      }

      adicionarAoCarrinho(produto, 1);
    });
  });
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