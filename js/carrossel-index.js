// ============================================
// DONA BENTA — js/carrossel-index.js
// Carrossel da Página Inicial e Destaques
// ============================================

let slideAtual = 0;
let temporizadorCarrossel = null;

function rotuloCategoria(cat) {
  const rotulos = { bolos: 'Bolo', paes: 'Pão', doces: 'Doce', salgados: 'Salgado', tortas: 'Torta' };
  return rotulos[cat] || 'Artesanal';
}

function montarCarrossel(produtos) {
  const trilho = document.getElementById('carrosselTrilho');
  const pontosContainer = document.getElementById('carrosselPontos');
  if (!trilho || !pontosContainer || !produtos || produtos.length === 0) return;

  trilho.innerHTML = produtos.map(p => `
    <div class="carrossel-slide">
      <div class="slide-imagem">
        <img src="${escapeHtml(p.imagem_url || 'img/HeaderDonaBenta.png')}" alt="${escapeHtml(p.nome)}" loading="lazy" onerror="this.src='img/HeaderDonaBenta.png'">
      </div>
      <div class="slide-info">
        <span class="eyebrow">${escapeHtml(rotuloCategoria(p.categoria))}</span>
        <h2>${escapeHtml(p.nome)}</h2>
        <p>${escapeHtml(p.descricao_curta || '')}</p>
        <div class="slide-preco">${formatarPreco(p.preco)}</div>
        <div>
          <a href="produto.html?id=${encodeURIComponent(p.id)}" class="btn btn-primario">
            <span class="material-symbols-outlined">visibility</span>
            Ver produto
          </a>
        </div>
      </div>
    </div>
  `).join('');

  pontosContainer.innerHTML = produtos.map((_, i) =>
    `<button class="ponto ${i === 0 ? 'ativo' : ''}" data-indice="${i}" aria-label="Ir para o slide ${i + 1}"></button>`
  ).join('');

  document.querySelectorAll('.ponto').forEach(ponto => {
    ponto.addEventListener('click', () => {
      irParaSlide(Number(ponto.dataset.indice));
      reiniciarAutoplay();
    });
  });

  iniciarAutoplay();
}

function irParaSlide(indice) {
  const trilho = document.getElementById('carrosselTrilho');
  if (!trilho || !trilho.children.length) return;
  const totalSlides = trilho.children.length;
  slideAtual = (indice + totalSlides) % totalSlides;
  trilho.style.transform = `translateX(-${slideAtual * 100}%)`;

  document.querySelectorAll('.ponto').forEach((p, i) => {
    p.classList.toggle('ativo', i === slideAtual);
  });
}

function iniciarAutoplay() {
  clearInterval(temporizadorCarrossel);
  temporizadorCarrossel = setInterval(() => {
    irParaSlide(slideAtual + 1);
  }, 5000);
}

function reiniciarAutoplay() {
  clearInterval(temporizadorCarrossel);
  iniciarAutoplay();
}

document.getElementById('setaDireita')?.addEventListener('click', () => {
  irParaSlide(slideAtual + 1);
  reiniciarAutoplay();
});

document.getElementById('setaEsquerda')?.addEventListener('click', () => {
  irParaSlide(slideAtual - 1);
  reiniciarAutoplay();
});

function montarDestaques(produtos) {
  const grade = document.getElementById('destaquesGrade');
  if (!grade || !produtos || produtos.length === 0) return;

  grade.innerHTML = produtos.map(p => `
    <a href="produto.html?id=${encodeURIComponent(p.id)}" class="produto-cartao">
      <div class="produto-imagem">
        <img src="${escapeHtml(p.imagem_url || 'img/HeaderDonaBenta.png')}" alt="${escapeHtml(p.nome)}" loading="lazy" onerror="this.src='img/HeaderDonaBenta.png'">
      </div>
      <div class="produto-info">
        <h3>${escapeHtml(p.nome)}</h3>
        <div class="produto-preco">${formatarPreco(p.preco)}</div>
      </div>
    </a>
  `).join('');
}

async function carregarProdutosIndex() {
  let produtos = typeof PRODUTOS_MODELO !== 'undefined' ? PRODUTOS_MODELO : [];

  try {
    const { data, error } = await db
      .from('produtos')
      .select('*')
      .eq('destaque', true)
      .eq('disponivel', true)
      .limit(6);

    if (!error && data && data.length > 0) {
      produtos = data;
    }
  } catch (e) {
    console.warn('Carregando produtos com fallback.', e);
  }

  montarCarrossel(produtos);
  montarDestaques(produtos);
}

document.addEventListener('DOMContentLoaded', () => {
  carregarProdutosIndex();
});