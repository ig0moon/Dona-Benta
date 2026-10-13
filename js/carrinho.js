// ============================================
// DONA BENTA — js/carrinho.js
// Carrinho local (localStorage) e renderização
// ============================================

const CHAVE_CARRINHO = 'donaBentaCarrinho';

function lerCarrinho() {
  try {
    const raw = localStorage.getItem(CHAVE_CARRINHO);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Valida estrutura básica
    return parsed.filter(item => item && item.id && Number(item.preco) >= 0 && Number(item.quantidade) > 0);
  } catch {
    return [];
  }
}

function salvarCarrinho(carrinho) {
  try {
    localStorage.setItem(CHAVE_CARRINHO, JSON.stringify(carrinho));
  } catch (e) {
    console.warn('Erro ao salvar no localStorage:', e);
  }
  if (typeof atualizarContagemCarrinho === 'function') {
    atualizarContagemCarrinho();
  }
}

function adicionarAoCarrinho(produto, quantidade = 1) {
  if (!produto || !produto.id) return;
  const qtdAdicionar = Math.max(1, Math.min(99, parseInt(quantidade, 10) || 1));
  const carrinho = lerCarrinho();
  const existente = carrinho.find(item => String(item.id) === String(produto.id));

  if (existente) {
    existente.quantidade = Math.min(99, (existente.quantidade || 1) + qtdAdicionar);
  } else {
    carrinho.push({
      id: produto.id,
      nome: produto.nome || 'Produto',
      preco: Number(produto.preco) || 0,
      imagem_url: produto.imagem_url || '',
      quantidade: qtdAdicionar
    });
  }

  salvarCarrinho(carrinho);
  if (typeof mostrarToast === 'function') {
    mostrarToast(`${produto.nome} adicionado ao carrinho!`, 'sucesso');
  }
}

function removerDoCarrinho(produtoId) {
  const carrinho = lerCarrinho().filter(item => String(item.id) !== String(produtoId));
  salvarCarrinho(carrinho);
}

function atualizarQuantidadeCarrinho(produtoId, quantidade) {
  const carrinho = lerCarrinho();
  const item = carrinho.find(item => String(item.id) === String(produtoId));
  if (!item) return;

  const novaQtd = parseInt(quantidade, 10);
  if (isNaN(novaQtd) || novaQtd <= 0) {
    removerDoCarrinho(produtoId);
    return;
  }

  item.quantidade = Math.min(99, novaQtd);
  salvarCarrinho(carrinho);
}

function limparCarrinho() {
  try {
    localStorage.removeItem(CHAVE_CARRINHO);
  } catch (e) {
    console.warn('Erro ao limpar carrinho:', e);
  }
  if (typeof atualizarContagemCarrinho === 'function') {
    atualizarContagemCarrinho();
  }
}

function totalCarrinho() {
  return lerCarrinho().reduce((soma, item) => soma + (Number(item.preco) || 0) * (Number(item.quantidade) || 0), 0);
}

function quantidadeTotalCarrinho() {
  return lerCarrinho().reduce((soma, item) => soma + (Number(item.quantidade) || 0), 0);
}

// ============================================
// Lógica de Renderização do Carrinho na Tela
// ============================================

function renderizarCarrinho() {
  const layout = document.getElementById('carrinhoLayout');
  if (!layout) return;

  const itens = lerCarrinho();

  if (itens.length === 0) {
    layout.innerHTML = `
      <div class="cartao vazio" style="grid-column: 1 / -1;">
        <span class="material-symbols-outlined vazio-icone">shopping_bag</span>
        <h3>Seu carrinho está vazio</h3>
        <p>Que tal escolher uma de nossas delícias artesanais no catálogo?</p>
        <a href="catalogo.html" class="btn btn-primario">
          <span class="material-symbols-outlined">storefront</span> Ver catálogo
        </a>
      </div>
    `;
    return;
  }

  const total = totalCarrinho();

  layout.innerHTML = `
    <div class="cartao">
      <h3 style="margin-bottom: 12px;">Itens no pedido (${quantidadeTotalCarrinho()})</h3>
      <div class="itens-carrinho-lista">
        ${itens.map(item => `
          <div class="item-carrinho">
            <div class="item-imagem">
              <img src="${escapeHtml(item.imagem_url || 'img/HeaderDonaBenta.png')}" alt="${escapeHtml(item.nome)}" onerror="this.src='img/HeaderDonaBenta.png'">
            </div>
            <div class="item-dados">
              <div class="item-nome">${escapeHtml(item.nome)}</div>
              <div class="item-preco-unit">${formatarPreco(item.preco)} / unid.</div>
            </div>
            <div class="item-quantidade">
              <button data-menos="${escapeHtml(item.id)}" aria-label="Diminuir quantidade">
                <span class="material-symbols-outlined" style="font-size:18px;">remove</span>
              </button>
              <span>${Number(item.quantidade) || 1}</span>
              <button data-mais="${escapeHtml(item.id)}" aria-label="Aumentar quantidade">
                <span class="material-symbols-outlined" style="font-size:18px;">add</span>
              </button>
            </div>
            <button class="item-remover" data-remover="${escapeHtml(item.id)}" aria-label="Remover ${escapeHtml(item.nome)} do carrinho" title="Remover item">
              <span class="material-symbols-outlined">delete</span>
            </button>
          </div>
        `).join('')}
      </div>
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

  layout.querySelectorAll('[data-mais]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.mais;
      const item = itens.find(i => String(i.id) === String(id));
      if (item) {
        atualizarQuantidadeCarrinho(item.id, item.quantidade + 1);
        renderizarCarrinho();
      }
    });
  });

  layout.querySelectorAll('[data-menos]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.menos;
      const item = itens.find(i => String(i.id) === String(id));
      if (item) {
        atualizarQuantidadeCarrinho(item.id, item.quantidade - 1);
        renderizarCarrinho();
      }
    });
  });

  layout.querySelectorAll('[data-remover]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.remover;
      const item = itens.find(i => String(i.id) === String(id));
      if (item) {
        removerDoCarrinho(item.id);
        renderizarCarrinho();
        if (typeof mostrarToast === 'function') mostrarToast('Item removido do carrinho', 'info');
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  renderizarCarrinho();
});