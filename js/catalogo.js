// ============================================
// DONA BENTA — js/catalogo.js
// Lista de produtos: busca rápida, filtro por categoria e cards
// ============================================

const PRODUTOS_MODELO = [
  {
    id: 'mod-1',
    nome: 'Bolo de Chocolate com Ganache Belga',
    descricao: 'Massa fofa de cacau nobre recheada e coberta com autêntica ganache meio amargo.',
    preco: 89.90,
    categoria: 'bolos',
    imagem_url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&q=80',
    disponivel: true
  },
  {
    id: 'mod-2',
    nome: 'Pão Artesanal de Fermentação Natural (Levain)',
    descricao: 'Casca dourada e crocante com miolo alveolado em fermentação lenta de 36 horas.',
    preco: 22.00,
    categoria: 'paes',
    imagem_url: 'https://images.unsplash.com/photo-1585478259715-876a6a81fc08?w=600&q=80',
    disponivel: true
  },
  {
    id: 'mod-3',
    nome: 'Caixa de Brigadeiros Gourmet (12 un)',
    descricao: 'Seleção artesanal com brigadeiro tradicional belga, ninho com nutella e pistache.',
    preco: 45.00,
    categoria: 'doces',
    imagem_url: 'https://images.unsplash.com/photo-1548907040-4baa419dea28?w=600&q=80',
    disponivel: true
  },
  {
    id: 'mod-4',
    nome: 'Torta de Frango com Catupiry Artesanal',
    descricao: 'Massa podre tradicional que derrete na boca com recheio cremoso e peito de frango desfiado.',
    preco: 68.00,
    categoria: 'salgados',
    imagem_url: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600&q=80',
    disponivel: true
  },
  {
    id: 'mod-5',
    nome: 'Croissants Amanteigados Tradicionais',
    descricao: 'Folhados com manteiga pura de primeira linha, dourados por fora e macios por dentro.',
    preco: 38.00,
    categoria: 'paes',
    imagem_url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&q=80',
    disponivel: true
  },
  {
    id: 'mod-6',
    nome: 'Torta Holandesa Cremosa',
    descricao: 'Base crocante de biscoitos com creme aveludado de baunilha e cobertura de chocolate puro.',
    preco: 62.00,
    categoria: 'tortas',
    imagem_url: 'https://images.unsplash.com/photo-1519340333755-56e9c1d04579?w=600&q=80',
    disponivel: true
  },
  {
    id: 'mod-7',
    nome: 'Empadão Rústico de Palmito',
    descricao: 'Recheio cremoso de palmito selecionado, azeitonas e temperos verdes caseiros.',
    preco: 58.00,
    categoria: 'salgados',
    imagem_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&q=80',
    disponivel: false
  },
  {
    id: 'mod-8',
    nome: 'Bolo Caseiro de Cenoura com Chocolate',
    descricao: 'Receita clássica de vó com calda quente e crocante de brigadeiro.',
    preco: 55.00,
    categoria: 'bolos',
    imagem_url: 'https://images.unsplash.com/photo-1621303837174-89787a7d4729?w=600&q=80',
    disponivel: true
  }
];

let TODOS_PRODUTOS = [];
let categoriaAtiva = 'todos';
let termoBusca = '';

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

    if (!error && Array.isArray(data) && data.length > 0) {
      TODOS_PRODUTOS = data;
    } else {
      console.info('Carregando catálogo com produtos de vitrine Dona Benta.');
      TODOS_PRODUTOS = PRODUTOS_MODELO;
    }
  } catch (err) {
    console.warn('Usando vitrine padrão (banco vazio ou indisponível):', err.message || err);
    TODOS_PRODUTOS = PRODUTOS_MODELO;
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
        <a href="produto.html?id=${encodeURIComponent(p.id)}" class="produto-cartao">
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