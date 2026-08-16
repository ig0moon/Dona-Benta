// ============================================
// DONA BENTA — js/catalogo.js
// Lista de produtos: busca, filtro por categoria, grid
// ============================================

let TODOS_PRODUTOS = [];
let categoriaAtiva = 'todos';
let termoBusca = '';

async function carregarCatalogo() {
  const area = document.getElementById('areaCatalogo');

  const { data, error } = await db
    .from('produtos')
    .select('*')
    .order('criado_em', { ascending: false });

  if (error) {
    area.innerHTML = `
      <div class="vazio">
        <span class="material-symbols-outlined">error</span>
        <h3>Não foi possível carregar o catálogo</h3>
        <p>Tente novamente em instantes.</p>
      </div>`;
    console.error(error);
    return;
  }

  TODOS_PRODUTOS = data || [];

  // Categoria via URL (?categoria=bolos)
  const params = new URLSearchParams(window.location.search);
  const catUrl = params.get('categoria');
  if (catUrl) {
    categoriaAtiva = catUrl;
    document.querySelectorAll('.filtro-btn').forEach(b => {
      b.classList.toggle('ativo', b.dataset.categoria === catUrl);
    });
  }

  renderizarCatalogo();
}

function renderizarCatalogo() {
  const area = document.getElementById('areaCatalogo');
  let lista = TODOS_PRODUTOS;

  if (categoriaAtiva !== 'todos') {
    lista = lista.filter(p => p.categoria === categoriaAtiva);
  }
  if (termoBusca.trim()) {
    lista = lista.filter(p => p.nome.toLowerCase().includes(termoBusca.toLowerCase()));
  }

  if (lista.length === 0) {
    area.innerHTML = `
      <div class="vazio">
        <span class="material-symbols-outlined">search_off</span>
        <h3>Nenhum produto encontrado</h3>
        <p>Tente outra busca ou categoria.</p>
      </div>
    `;
    return;
  }

  area.innerHTML = `
    <div class="catalogo-grade">
      ${lista.map(p => `
        <a href="produto.html?id=${p.id}" class="produto-cartao">
          <div class="produto-imagem">
            ${p.disponivel === false ? '<span class="esgotado-tag">Esgotado</span>' : ''}
            <img src="${p.imagem_url}" alt="${p.nome}" loading="lazy">
          </div>
          <div class="produto-info">
            <h3>${p.nome}</h3>
            <div class="produto-rodape">
              <span class="produto-preco">${formatarPreco(p.preco)}</span>
              <span class="produto-add" data-add="${p.id}" aria-label="Adicionar ao carrinho">
                <span class="material-symbols-outlined">add_shopping_cart</span>
              </span>
            </div>
          </div>
        </a>
      `).join('')}
    </div>
  `;

  document.querySelectorAll('[data-add]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const produto = TODOS_PRODUTOS.find(p => p.id === btn.dataset.add);
      if (produto.disponivel === false) {
        mostrarToast('Este produto está esgotado no momento', 'erro');
        return;
      }
      adicionarAoCarrinho(produto, 1);
    });
  });
}

document.getElementById('filtros').addEventListener('click', (e) => {
  const btn = e.target.closest('.filtro-btn');
  if (!btn) return;
  categoriaAtiva = btn.dataset.categoria;
  document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('ativo'));
  btn.classList.add('ativo');
  renderizarCatalogo();
});

document.getElementById('campoBusca').addEventListener('input', (e) => {
  termoBusca = e.target.value;
  renderizarCatalogo();
});

carregarCatalogo();