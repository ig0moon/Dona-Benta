// ============================================
// Carrossel
// ============================================
let slideAtual = 0;
let temporizadorCarrossel = null;

function montarCarrossel(produtos) {
  const trilho = document.getElementById('carrosselTrilho');
  const pontosContainer = document.getElementById('carrosselPontos');

  trilho.innerHTML = produtos.map(p => `
    <div class="carrossel-slide">
      <div class="slide-imagem">
        <img src="${p.imagem_url}" alt="${p.nome}" loading="lazy">
      </div>
      <div class="slide-info">
        <span class="eyebrow">${rotuloCategoria(p.categoria)}</span>
        <h2>${p.nome}</h2>
        <p>${p.descricao_curta}</p>
        <div class="slide-preco">${formatarPreco(p.preco)}</div>
        <div>
          <a href="produto.html?id=${p.id}" class="btn btn-primario">
            <span class="material-symbols-outlined">visibility</span>
            Ver produto
          </a>
        </div>
      </div>
    </div>
  `).join('');

  pontosContainer.innerHTML = produtos.map((_, i) =>
    `<button class="ponto ${i === 0 ? 'ativo' : ''}" data-indice="${i}" aria-label="Ir para slide ${i + 1}"></button>`
  ).join('');

  document.querySelectorAll('.ponto').forEach(ponto => {
    ponto.addEventListener('click', () => {
      irParaSlide(Number(ponto.dataset.indice));
      reiniciarAutoplay();
    });
  });

  iniciarAutoplay(produtos.length);
}

function irParaSlide(indice) {
  const trilho = document.getElementById('carrosselTrilho');
  const totalSlides = trilho.children.length;
  slideAtual = (indice + totalSlides) % totalSlides;
  trilho.style.transform = `translateX(-${slideAtual * 100}%)`;

  document.querySelectorAll('.ponto').forEach((p, i) => {
    p.classList.toggle('ativo', i === slideAtual);
  });
}

function iniciarAutoplay(totalSlides) {
  temporizadorCarrossel = setInterval(() => {
    irParaSlide(slideAtual + 1);
  }, 5000);
}

function reiniciarAutoplay() {
  clearInterval(temporizadorCarrossel);
  iniciarAutoplay();
}

document.getElementById('setaDireita').addEventListener('click', () => {
  irParaSlide(slideAtual + 1);
  reiniciarAutoplay();
});
document.getElementById('setaEsquerda').addEventListener('click', () => {
  irParaSlide(slideAtual - 1);
  reiniciarAutoplay();
});

function rotuloCategoria(cat) {
  const rotulos = { bolos: 'Bolo', paes: 'Pão', doces: 'Doce', salgados: 'Salgado', tortas: 'Torta' };
  return rotulos[cat] || 'Produto';
}

// ============================================
// Grade de destaques
// ============================================
function montarDestaques(produtos) {
  const grade = document.getElementById('destaquesGrade');
  grade.innerHTML = produtos.map(p => `
    <a href="produto.html?id=${p.id}" class="produto-cartao">
      <div class="produto-imagem">
        <img src="${p.imagem_url}" alt="${p.nome}" loading="lazy">
      </div>
      <div class="produto-info">
        <h3>${p.nome}</h3>
        <div class="produto-preco">${formatarPreco(p.preco)}</div>
      </div>
    </a>
  `).join('');
}

// ============================================
// Carregamento de dados (Supabase com fallback para modelo)
// ============================================
async function carregarProdutosIndex() {
  let produtos = PRODUTOS_MODELO;

  try {
    const { data, error } = await db
      .from('produtos')
      .select('*')
      .eq('destaque', true)
      .eq('disponivel', true)
      .limit(5);

    if (!error && data && data.length > 0) {
      produtos = data;
    }
  } catch (e) {
    console.warn('Usando produtos de modelo (Supabase ainda não configurado).');
  }

  montarCarrossel(produtos);
  montarDestaques(produtos);
}

carregarProdutosIndex();