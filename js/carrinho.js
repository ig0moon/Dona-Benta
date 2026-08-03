// ============================================
// DONA BENTA — Lógica do carrinho (localStorage)
// ============================================

function lerCarrinho() {
  return JSON.parse(localStorage.getItem('donaBentaCarrinho') || '[]');
}

function salvarCarrinho(carrinho) {
  localStorage.setItem('donaBentaCarrinho', JSON.stringify(carrinho));
  atualizarContagemCarrinho();
}

function adicionarAoCarrinho(produto, quantidade = 1) {
  const carrinho = lerCarrinho();
  const existente = carrinho.find(item => item.produto_id === produto.id);

  if (existente) {
    existente.quantidade += quantidade;
  } else {
    carrinho.push({
      produto_id: produto.id,
      nome: produto.nome,
      preco: produto.preco,
      imagem_url: produto.imagem_url,
      quantidade
    });
  }

  salvarCarrinho(carrinho);
  mostrarToast(`${produto.nome} adicionado ao carrinho`, 'sucesso');
}

function removerDoCarrinho(produtoId) {
  const carrinho = lerCarrinho().filter(item => item.produto_id !== produtoId);
  salvarCarrinho(carrinho);
}

function alterarQuantidade(produtoId, novaQuantidade) {
  const carrinho = lerCarrinho();
  const item = carrinho.find(i => i.produto_id === produtoId);
  if (!item) return;

  if (novaQuantidade <= 0) {
    removerDoCarrinho(produtoId);
    return;
  }

  item.quantidade = novaQuantidade;
  salvarCarrinho(carrinho);
}

function limparCarrinho() {
  localStorage.removeItem('donaBentaCarrinho');
  atualizarContagemCarrinho();
}

function totalCarrinho() {
  return lerCarrinho().reduce((soma, item) => soma + (item.preco * item.quantidade), 0);
}
