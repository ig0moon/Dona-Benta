// ============================================
// DONA BENTA — js/produto.js
// Página de detalhe de um produto (produto.html?id=...)
// ============================================

const PRODUTOS_MODELO = [
  { id: 'mod-1', nome: 'Bolo de Chocolate com Ganache Belga', descricao: 'Massa fofa de cacau nobre recheada e coberta com autêntica ganache meio amargo.', preco: 89.90, categoria: 'Bolos', imagem_url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&q=80', disponivel: true },
  { id: 'mod-2', nome: 'Pão Artesanal de Fermentação Natural (Levain)', descricao: 'Casca dourada e crocante com miolo alveolado em fermentação lenta de 36 horas.', preco: 22.00, categoria: 'Pães', imagem_url: 'https://images.unsplash.com/photo-1585478259715-876a6a81fc08?w=600&q=80', disponivel: true },
  { id: 'mod-3', nome: 'Caixa de Brigadeiros Gourmet (12 un)', descricao: 'Seleção artesanal com brigadeiro tradicional belga, ninho com nutella e pistache.', preco: 45.00, categoria: 'Doces', imagem_url: 'https://images.unsplash.com/photo-1548907040-4baa419dea28?w=600&q=80', disponivel: true },
  { id: 'mod-4', nome: 'Torta de Frango com Catupiry Artesanal', descricao: 'Massa podre tradicional que derrete na boca com recheio cremoso e peito de frango desfiado.', preco: 68.00, categoria: 'Salgados', imagem_url: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600&q=80', disponivel: true },
  { id: 'mod-5', nome: 'Croissants Amanteigados Tradicionais', descricao: 'Folhados com manteiga pura de primeira linha, dourados por fora e macios por dentro.', preco: 38.00, categoria: 'Pães', imagem_url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&q=80', disponivel: true },
  { id: 'mod-6', nome: 'Torta Holandesa Cremosa', descricao: 'Base crocante de biscoitos com creme aveludado de baunilha e cobertura de chocolate puro.', preco: 62.00, categoria: 'Tortas', imagem_url: 'https://images.unsplash.com/photo-1519340333755-56e9c1d04579?w=600&q=80', disponivel: true },
  { id: 'mod-7', nome: 'Empadão Rústico de Palmito', descricao: 'Recheio cremoso de palmito selecionado, azeitonas e temperos verdes caseiros.', preco: 58.00, categoria: 'Salgados', imagem_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&q=80', disponivel: false },
  { id: 'mod-8', nome: 'Bolo Caseiro de Cenoura com Chocolate', descricao: 'Receita clássica de vó com calda quente e crocante de brigadeiro.', preco: 55.00, categoria: 'Bolos', imagem_url: 'https://images.unsplash.com/photo-1621303837174-89787a7d4729?w=600&q=80', disponivel: true }
];

async function carregarProduto() {
  const area = document.getElementById('areaProduto');
  if (!area) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    window.location.href = 'catalogo.html';
    return;
  }

  try {
    let produto = null;

    try {
      const { data, error } = await db
        .from('produtos')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) produto = data;
    } catch (e) {
      console.warn('Busca no Supabase falhou, tentando modelo local:', e);
    }

    if (!produto && typeof PRODUTOS_MODELO !== 'undefined') {
      produto = PRODUTOS_MODELO.find(p => String(p.id) === String(id)) || null;
    }

    if (!produto) {
      area.innerHTML = `
        <div class="cartao vazio">
          <span class="material-symbols-outlined vazio-icone">search_off</span>
          <h3>Produto não encontrado</h3>
          <p>Ele pode ter sido removido ou está temporariamente indisponível.</p>
          <a href="catalogo.html" class="btn btn-primario">
            <span class="material-symbols-outlined">storefront</span> Ver outros produtos
          </a>
        </div>`;
      return;
    }

    document.title = `${produto.nome || 'Produto'} — Dona Benta`;

    const disponivel = produto.disponivel !== false;

    area.innerHTML = `
      <div class="produto-detalhe">
        <div class="produto-detalhe-imagem">
          <img src="${escapeHtml(produto.imagem_url || 'img/HeaderDonaBenta.png')}" alt="${escapeHtml(produto.nome)}" onerror="this.src='img/HeaderDonaBenta.png'">
        </div>
        <div class="produto-detalhe-conteudo">
          ${produto.categoria ? `<span class="produto-detalhe-categoria">${escapeHtml(produto.categoria)}</span>` : ''}
          <h1>${escapeHtml(produto.nome)}</h1>
          <p class="produto-detalhe-preco">${formatarPreco(produto.preco)}</p>

          ${!disponivel ? `<span class="produto-nao-disponivel">Esgotado no momento</span>` : ''}

          <p class="produto-detalhe-descricao">${escapeHtml(produto.descricao || produto.descricao_curta || 'Receita tradicional preparada artesanalmente com ingredientes frescos e selecionados na cozinha da Dona Benta.')}</p>

          <div class="produto-detalhe-compra">
            <div class="produto-detalhe-qtd">
              <button id="qtdMenos" aria-label="Diminuir quantidade">−</button>
              <span id="qtdValor">1</span>
              <button id="qtdMais" aria-label="Aumentar quantidade">+</button>
            </div>

            <button class="btn btn-primario" id="btnAdicionar" ${!disponivel ? 'disabled' : ''}>
              <span class="material-symbols-outlined">add_shopping_cart</span>
              ${disponivel ? 'Adicionar ao carrinho' : 'Produto indisponível'}
            </button>
          </div>

          <div class="produto-detalhe-destaques">
            <div class="produto-destaque-item">
              <span class="material-symbols-outlined">schedule</span>
              <span>Preparo fresco sob encomenda</span>
            </div>
            <div class="produto-destaque-item">
              <span class="material-symbols-outlined">verified</span>
              <span>100% artesanal</span>
            </div>
          </div>
        </div>
      </div>
    `;

    let quantidade = 1;
    const qtdValor = document.getElementById('qtdValor');

    document.getElementById('qtdMenos').addEventListener('click', () => {
      if (quantidade > 1) {
        quantidade--;
        qtdValor.textContent = quantidade;
      }
    });

    document.getElementById('qtdMais').addEventListener('click', () => {
      if (quantidade < 99) {
        quantidade++;
        qtdValor.textContent = quantidade;
      }
    });

    document.getElementById('btnAdicionar').addEventListener('click', () => {
      if (!disponivel) return;
      adicionarAoCarrinho(produto, quantidade);
    });
  } catch (err) {
    console.error('Erro ao carregar detalhes do produto:', err);
    area.innerHTML = `
      <div class="cartao vazio">
        <span class="material-symbols-outlined">error</span>
        <h3>Erro ao carregar produto</h3>
        <p>Por favor, tente novamente mais tarde.</p>
      </div>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  carregarProduto();
});