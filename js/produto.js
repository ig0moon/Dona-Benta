// ============================================
// DONA BENTA — js/produto.js
// Página de detalhe de um produto (produto.html?id=...)
// ============================================

async function carregarProduto() {
  const area = document.getElementById('areaProduto');
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    window.location.href = 'catalogo.html';
    return;
  }

  const { data: produto, error } = await db
    .from('produtos')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !produto) {
    area.innerHTML = `
      <div class="vazio">
        <span class="material-symbols-outlined">search_off</span>
        <h3>Produto não encontrado</h3>
        <p>Ele pode ter sido removido do catálogo.</p>
      </div>`;
    return;
  }

  document.title = `${produto.nome} — Dona Benta`;

  area.innerHTML = `
    <div class="produto-detalhe">
      <div class="produto-detalhe-imagem">
        <img src="${produto.imagem_url}" alt="${produto.nome}">
      </div>
      <div class="produto-detalhe-conteudo">
        ${produto.categoria ? `<span class="produto-detalhe-categoria">${produto.categoria}</span>` : ''}
        <h1>${produto.nome}</h1>
        <p class="produto-detalhe-preco">${formatarPreco(produto.preco)}</p>

        ${produto.disponivel === false
          ? `<span class="produto-nao-disponivel">Esgotado no momento</span>`
          : ''}

        <p class="produto-detalhe-descricao">${produto.descricao || produto.descricao_curta || 'Sem descrição disponível para este produto.'}</p>

        <div class="produto-detalhe-qtd">
          <button id="qtdMenos" aria-label="Diminuir quantidade">−</button>
          <span id="qtdValor">1</span>
          <button id="qtdMais" aria-label="Aumentar quantidade">+</button>
        </div>

        <button class="btn btn-primario btn-bloco" id="btnAdicionar" ${produto.disponivel === false ? 'disabled' : ''}>
          <span class="material-symbols-outlined">add_shopping_cart</span>
          Adicionar ao carrinho
        </button>
      </div>
    </div>
  `;

  let quantidade = 1;
  const qtdValor = document.getElementById('qtdValor');

  document.getElementById('qtdMenos').addEventListener('click', () => {
    if (quantidade > 1) { quantidade--; qtdValor.textContent = quantidade; }
  });
  document.getElementById('qtdMais').addEventListener('click', () => {
    quantidade++; qtdValor.textContent = quantidade;
  });
  document.getElementById('btnAdicionar').addEventListener('click', () => {
    adicionarAoCarrinho(produto, quantidade);
  });
}

carregarProduto();