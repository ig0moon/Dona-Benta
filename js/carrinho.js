// ============================================
// DONA BENTA — js/carrinho.js
// Carrinho local (localStorage) e renderização
// ============================================

const CHAVE_CARRINHO = 'donaBentaCarrinho';

function lerCarrinho() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_CARRINHO)) || [];
  } catch {
    return [];
  }
}

function salvarCarrinho(carrinho) {
  localStorage.setItem(CHAVE_CARRINHO, JSON.stringify(carrinho));
  if (typeof atualizarContagemCarrinho === 'function') {
    atualizarContagemCarrinho();
  }
}

function adicionarAoCarrinho(produto, quantidade = 1) {
  const carrinho = lerCarrinho();
  const existente = carrinho.find(item => item.id === produto.id);
  if (existente) {
    existente.quantidade += quantidade;
  } else {
    carrinho.push({
      id: produto.id,
      nome: produto.nome,
      preco: produto.preco,
      imagem_url: produto.imagem_url,
      quantidade
    });
  }
  salvarCarrinho(carrinho);
  if (typeof mostrarToast === 'function') {
    mostrarToast(`${produto.nome} adicionado ao carrinho!`, 'sucesso');
  }
}

function removerDoCarrinho(produtoId) {
  const carrinho = lerCarrinho().filter(item => item.id !== produtoId);
  salvarCarrinho(carrinho);
}

function atualizarQuantidadeCarrinho(produtoId, quantidade) {
  const carrinho = lerCarrinho();
  const item = carrinho.find(item => item.id === produtoId);
  if (!item) return;
  
  if (quantidade <= 0) {
    removerDoCarrinho(produtoId);
    return;
  }
  
  item.quantidade = quantidade;
  salvarCarrinho(carrinho);
}

function limparCarrinho() {
  localStorage.removeItem(CHAVE_CARRINHO);
  if (typeof atualizarContagemCarrinho === 'function') {
    atualizarContagemCarrinho();
  }
}

function totalCarrinho() {
  return lerCarrinho().reduce((soma, item) => soma + item.preco * item.quantidade, 0);
}

function quantidadeTotalCarrinho() {
  return lerCarrinho().reduce((soma, item) => soma + item.quantidade, 0);
}

// ============================================
// Lógica de Renderização do Carrinho na Tela
// ============================================

function renderizarCarrinho() {
  const layout = document.getElementById('carrinhoLayout');
  
  // Se o elemento não existir (ex: estamos na página catalogo.html), encerra a função.
  if (!layout) return;

  const itens = lerCarrinho();

  if (itens.length === 0) {
    layout.innerHTML = `
      <div class="vazio" style="grid-column: 1 / -1;">
        <span class="material-symbols-outlined">shopping_bag</span>
        <h3>Seu carrinho está vazio</h3>
        <p>Que tal dar uma olhada no nosso catálogo?</p>
        <a href="conta.html" class="btn btn-primario" style="margin-top:16px;">Minha conta</a>
        <a href="catalogo.html" class="btn btn-primario" style="margin-top:16px;">Ver catálogo</a>
      </div>
    `;
    return;
  }

  const total = totalCarrinho();

  layout.innerHTML = `
    <div class="cartao">
      <h3 style="margin-bottom: 8px;">Itens (${quantidadeTotalCarrinho()})</h3>
      ${itens.map(item => `
        <div class="item-carrinho">
          <div class="item-imagem"><img src="${item.imagem_url}" alt="${item.nome}"></div>
          <div>
            <div class="item-nome">${item.nome}</div>
            <div class="item-preco-unit">${formatarPreco(item.preco)} / unid.</div>
          </div>
          <div class="item-quantidade">
            <button data-menos="${item.id}" aria-label="Diminuir"><span class="material-symbols-outlined" style="font-size:18px;">remove</span></button>
            <span>${item.quantidade}</span>
            <button data-mais="${item.id}" aria-label="Aumentar"><span class="material-symbols-outlined" style="font-size:18px;">add</span></button>
          </div>
          <button class="item-remover" data-remover="${item.id}" aria-label="Remover item">
            <span class="material-symbols-outlined">delete</span>
          </button>
        </div>
      `).join('')}
    </div>

    <div class="cartao resumo-cartao">
      <h3 style="margin-bottom: 16px;">Resumo do pedido</h3>
      <div class="resumo-linha">
        <span>Subtotal</span>
        <span>${formatarPreco(total)}</span>
      </div>
      <div class="resumo-linha total">
        <span>Total</span>
        <span>${formatarPreco(total)}</span>
      </div>
      <a href="pedidos.html" class="btn btn-primario btn-bloco" style="margin-top: 20px;">
        <span class="material-symbols-outlined">event_available</span>
        Continuar para agendamento
      </a>
      <a href="catalogo.html" class="btn btn-outline btn-bloco" style="margin-top: 10px;">
        Continuar comprando
      </a>
    </div>
  `;

  // Adiciona os eventos aos botões recém-criados
  layout.querySelectorAll('[data-mais]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.mais;
      const item = itens.find(i => String(i.id) === id); 
      if(item) {
        atualizarQuantidadeCarrinho(item.id, item.quantidade + 1);
        renderizarCarrinho();
      }
    });
  });

  layout.querySelectorAll('[data-menos]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.menos;
      const item = itens.find(i => String(i.id) === id);
      if(item) {
        atualizarQuantidadeCarrinho(item.id, item.quantidade - 1);
        renderizarCarrinho();
      }
    });
  });

  layout.querySelectorAll('[data-remover]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.remover;
      const item = itens.find(i => String(i.id) === id);
      if(item) {
        removerDoCarrinho(item.id);
        renderizarCarrinho();
        if (typeof mostrarToast === 'function') mostrarToast('Item removido do carrinho', 'info');
      }
    });
  });
}

// Inicia a renderização assim que o HTML carregar
document.addEventListener('DOMContentLoaded', () => {
  renderizarCarrinho();
});