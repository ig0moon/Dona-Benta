// ============================================
// DONA BENTA — js/carrossel-index.js
// Carrossel da Página Inicial e Destaques
// ============================================

const PRODUTOS_MODELO_PADRAO = [
  {
    id: 'modelo-1',
    nome: 'Bolo de Chocolate com Ganache Belga',
    descricao_curta: 'Camadas fofinhas de chocolate belga com ganache cremosa e raspas de cacau nobre. Perfeito para comemorações.',
    preco: 89.90,
    categoria: 'bolos',
    imagem_url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=900&q=80'
  },
  {
    id: 'modelo-2',
    nome: 'Pão Artesanal de Fermentação Natural',
    descricao_curta: 'Casca crocante e miolo macio, fermentado lentamente por 24 horas com levain natural. Assado em forno de pedra.',
    preco: 22.00,
    categoria: 'paes',
    imagem_url: 'https://images.unsplash.com/photo-1585478259715-876a6a81fc08?w=900&q=80'
  },
  {
    id: 'modelo-3',
    nome: 'Caixa de Brigadeiros Gourmet (12 un)',
    descricao_curta: 'Doze brigadeiros artesanais em quatro sabores: tradicional belga, pistache, ninho com nutella e maracujá.',
    preco: 45.00,
    categoria: 'doces',
    imagem_url: 'https://images.unsplash.com/photo-1548907040-4baa419dea28?w=900&q=80'
  },
  {
    id: 'modelo-4',
    nome: 'Torta de Frango com Catupiry Artesanal',
    descricao_curta: 'Massa amanteigada recheada com frango desfiado e catupiry cremoso. Serve até 8 pessoas, ideal para a família.',
    preco: 68.00,
    categoria: 'salgados',
    imagem_url: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=900&q=80'
  },
  {
    id: 'modelo-5',
    nome: 'Croissants Amanteigados Tradicionais',
    descricao_curta: 'Folhados com manteiga francesa, dourados por fora e macios por dentro. Vendidos em caixa com 6 unidades.',
    preco: 38.00,
    categoria: 'paes',
    imagem_url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=900&q=80'
  }
];

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
  let produtos = (typeof PRODUTOS_MODELO !== 'undefined' && PRODUTOS_MODELO?.length) ? PRODUTOS_MODELO : PRODUTOS_MODELO_PADRAO;

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