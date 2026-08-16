// ============================================
// DONA BENTA — js/carrinho.js
// Carrinho local (localStorage) — usado em catalogo.html, produto.html, carrinho.html
// Usa a mesma chave e o mesmo badge geridos por layout.js
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
  mostrarToast(`${produto.nome} adicionado ao carrinho!`, 'sucesso');
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