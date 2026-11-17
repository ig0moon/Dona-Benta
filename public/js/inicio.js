// ============================================
// DONA BENTA — js/inicio.js
// Página inicial: produto em destaque (cartão 3D), faixa rolante
// com nomes dos produtos e grade dos favoritos da casa.
// ============================================

const NOMES_FAIXA_PADRAO = [
  'Pão de fermentação natural',
  'Bolo de cenoura',
  'Brigadeiro',
  'Torta de limão',
  'Pão de queijo',
  'Sonho de creme',
  'Broa de milho',
  'Rosca de coco'
];

const ROTULOS_CATEGORIA = { bolos: 'Bolo', paes: 'Pão', doces: 'Doce', salgados: 'Salgado', tortas: 'Torta' };

function rotuloCategoria(cat) {
  return ROTULOS_CATEGORIA[String(cat || '').toLowerCase()] || 'Artesanal';
}

function montarFaixa(nomes) {
  const trilho = document.getElementById('faixaLoop');
  if (!trilho) return;
  const lista = nomes.length >= 4 ? nomes : NOMES_FAIXA_PADRAO;
  // Duplicada para o loop emendar sem salto
  trilho.innerHTML = [...lista, ...lista].map(n => `<span>${escapeHtml(n)}</span>`).join('');
}

let temporizadorDestaque = null;

function mostrarDestaque(p) {
  const card = document.getElementById('destaqueCard');
  const img = document.getElementById('destaqueImagem');
  const etiqueta = document.getElementById('destaqueEtiqueta');
  if (!card || !img || !etiqueta) return;

  img.classList.add('trocando');
  etiqueta.classList.add('trocando');

  setTimeout(() => {
    const novaImg = p.imagem_url || 'img/HeaderDonaBenta.png';
    img.onerror = () => { img.onerror = null; img.src = 'img/HeaderDonaBenta.png'; };
    img.src = novaImg;
    img.alt = p.nome || 'Produto em destaque';
    card.href = `produto?id=${encodeURIComponent(p.id)}`;
    card.setAttribute('aria-label', `Ver ${p.nome}`);
    document.getElementById('destaqueNome').textContent = p.nome || '';
    document.getElementById('destaqueCategoria').textContent = p.descricao_curta || rotuloCategoria(p.categoria);
    document.getElementById('destaquePreco').textContent = formatarPreco(p.preco);
    img.classList.remove('trocando');
    etiqueta.classList.remove('trocando');
  }, 260);
}

function iniciarDestaques(produtos) {
  if (!produtos.length) return;
  let atual = 0;
  mostrarDestaque(produtos[0]);
  if (produtos.length < 2 || MOVIMENTO_REDUZIDO) return;

  const card = document.getElementById('destaqueCard');
  const avancar = () => {
    atual = (atual + 1) % produtos.length;
    mostrarDestaque(produtos[atual]);
  };
  const iniciar = () => {
    clearInterval(temporizadorDestaque);
    temporizadorDestaque = setInterval(avancar, 5000);
  };
  card?.addEventListener('mouseenter', () => clearInterval(temporizadorDestaque));
  card?.addEventListener('mouseleave', iniciar);
  iniciar();
}

function montarFavoritos(produtos) {
  const grade = document.getElementById('destaquesGrade');
  if (!grade) return;
  if (!produtos.length) {
    grade.innerHTML = `
      <div class="vazio cartao">
        <h3>Em breve, novidades do forno</h3>
        <p>Enquanto isso, veja tudo o que já está no cardápio.</p>
        <a href="catalogo" class="btn btn-primario">Ver o cardápio</a>
      </div>`;
    return;
  }
  grade.innerHTML = produtos.map((p, i) => cartaoProdutoHtml(p, i)).join('');
  ligarBotoesAdicionar(grade, produtos);
}

async function carregarInicio() {
  try {
    const { data, error } = await db
      .from('produtos')
      .select('*')
      .eq('destaque', true)
      .eq('disponivel', true)
      .eq('ativo', true)
      .limit(8);

    if (error) {
      throw new Error(error.message || 'Falha ao carregar destaques do TiDB.');
    }

    const produtos = Array.isArray(data) ? data : [];
    iniciarDestaques(produtos);
    montarFavoritos(produtos);
    montarFaixa(produtos.map(p => p.nome).filter(Boolean));
  } catch (e) {
    console.error('Não foi possível carregar os destaques do TiDB:', e);
    montarFaixa([]);
    const grade = document.getElementById('destaquesGrade');
    if (grade) {
      grade.innerHTML = `
        <div class="vazio cartao">
          <h3>Não foi possível carregar os produtos</h3>
          <p>Tente novamente em instantes.</p>
          <button type="button" class="btn btn-primario" onclick="window.location.reload()">Tentar novamente</button>
        </div>`;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  montarFaixa([]);
  carregarInicio();
});
