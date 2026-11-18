// ============================================
// DONA BENTA — js/produto.js
// Página de detalhe de um produto (produto.html?id=...)
// ============================================
async function carregarProduto() {
  const area = document.getElementById('areaProduto');
  if (!area) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    window.location.href = 'catalogo';
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
      console.warn('Busca do produto falhou:', e);
    }

    if (!produto) {
      area.innerHTML = `
        <div class="cartao vazio">
          <span class="material-symbols-outlined vazio-icone">search_off</span>
          <h3>Produto não encontrado</h3>
          <p>Ele pode ter sido removido ou está temporariamente indisponível.</p>
          <a href="catalogo" class="btn btn-primario">
            <span class="material-symbols-outlined">storefront</span> Ver outros produtos
          </a>
        </div>`;
      return;
    }

    document.title = `${produto.nome || 'Produto'} — Dona Benta`;

    const disponivel = produtoDisponivel(produto);

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

          <div class="aviso-consumidor" role="note">
            <span class="material-symbols-outlined" aria-hidden="true">info</span>
            <span>
              <strong>Alérgicos:</strong> nossos produtos são feitos em uma cozinha que manipula trigo (glúten), leite, ovos, soja, amendoim e castanhas, e podem conter traços desses ingredientes.
              Em caso de dúvida sobre ingredientes, fale com a gente antes de pedir. Imagem meramente ilustrativa.
            </span>
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