// ============================================
// DONA BENTA — js/efeitos.js
// Efeitos de interface compartilhados por todas as páginas.
// Inspirados no reactbits.dev (SplitText, BlurText, CountUp, Magnet, Tilt,
// Spotlight, ScrollReveal, ClickSpark) e no transitions.dev (abas deslizantes,
// badge, troca de texto). Tudo respeita "reduzir movimento" do sistema.
// ============================================

const MOVIMENTO_REDUZIDO = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const PONTEIRO_FINO = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

function proximoQuadro(fn) {
  requestAnimationFrame(() => requestAnimationFrame(fn));
}

// SplitText: quebra o título em letras e anima a entrada em sequência
function aplicarSplitText(raiz = document) {
  raiz.querySelectorAll('[data-split]:not([data-split-pronto])').forEach(el => {
    el.setAttribute('data-split-pronto', '');
    el.setAttribute('aria-label', el.textContent.trim().replace(/\s+/g, ' '));
    let indice = 0;

    const quebrar = (no) => {
      if (no.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        no.textContent.split(/(\s+)/).forEach(parte => {
          if (!parte) return;
          if (/^\s+$/.test(parte)) {
            frag.appendChild(document.createTextNode(' '));
            return;
          }
          const palavra = document.createElement('span');
          palavra.className = 'sp-w';
          palavra.setAttribute('aria-hidden', 'true');
          [...parte].forEach(letra => {
            const c = document.createElement('span');
            c.className = 'sp-c';
            c.textContent = letra;
            c.style.transitionDelay = `${indice++ * 26}ms`;
            palavra.appendChild(c);
          });
          frag.appendChild(palavra);
        });
        no.replaceWith(frag);
      } else if (no.nodeType === Node.ELEMENT_NODE) {
        [...no.childNodes].forEach(quebrar);
      }
    };

    [...el.childNodes].forEach(quebrar);
    proximoQuadro(() => el.classList.add('in'));
  });
}

// BlurText: palavras saem do desfoque uma a uma
function aplicarBlurText(raiz = document) {
  raiz.querySelectorAll('[data-blur]:not([data-blur-pronto])').forEach(el => {
    el.setAttribute('data-blur-pronto', '');
    const atraso = Number(el.dataset.blur) || 0;
    const palavras = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    palavras.forEach((p, i) => {
      const s = document.createElement('span');
      s.className = 'bl-w';
      s.textContent = p;
      s.style.transitionDelay = `${atraso + i * 40}ms`;
      el.appendChild(s);
      if (i < palavras.length - 1) el.appendChild(document.createTextNode(' '));
    });
    proximoQuadro(() => el.classList.add('in'));
  });
}

// CountUp: números contam até o valor final quando aparecem na tela
function aplicarCountUp(raiz = document) {
  const contar = (el) => {
    const alvo = Number(el.dataset.contar) || 0;
    const prefixo = el.dataset.prefixo || '';
    const sufixo = el.dataset.sufixo || '';
    if (MOVIMENTO_REDUZIDO) {
      el.textContent = prefixo + alvo.toLocaleString('pt-BR') + sufixo;
      return;
    }
    const inicio = performance.now();
    const duracao = 1600;
    const passo = (agora) => {
      const k = Math.min(1, (agora - inicio) / duracao);
      const suave = 1 - Math.pow(1 - k, 4);
      el.textContent = prefixo + Math.round(alvo * suave).toLocaleString('pt-BR') + sufixo;
      if (k < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  };

  const obs = new IntersectionObserver(entradas => {
    entradas.forEach(e => {
      if (e.isIntersecting) {
        contar(e.target);
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.4 });

  raiz.querySelectorAll('[data-contar]').forEach(el => obs.observe(el));
}

// Reveal: elementos .rv sobem suavemente quando entram na tela
const observadorReveal = new IntersectionObserver(entradas => {
  entradas.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('in');
      observadorReveal.unobserve(e.target);
    }
  });
}, { threshold: 0.12 });

function aplicarReveal(raiz = document) {
  raiz.querySelectorAll('.rv:not(.in)').forEach(el => observadorReveal.observe(el));
}

// ScrollReveal: o texto acende palavra por palavra conforme a rolagem
function aplicarScrollReveal() {
  const blocos = [...document.querySelectorAll('[data-scroll-reveal]')];
  if (!blocos.length) return;

  blocos.forEach(el => {
    const palavras = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    palavras.forEach((p, i) => {
      const s = document.createElement('span');
      s.className = 'sr-w';
      s.textContent = p;
      el.appendChild(s);
      if (i < palavras.length - 1) el.appendChild(document.createTextNode(' '));
    });
  });

  const atualizar = () => {
    blocos.forEach(el => {
      const palavras = el.querySelectorAll('.sr-w');
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const k = MOVIMENTO_REDUZIDO ? 1 : Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.35)));
      const acesas = Math.floor(k * palavras.length);
      palavras.forEach((w, i) => w.classList.toggle('on', i < acesas));
    });
  };

  window.addEventListener('scroll', atualizar, { passive: true });
  window.addEventListener('resize', atualizar);
  atualizar();
}

// Magnet: o botão é puxado levemente pelo cursor
function aplicarMagnet() {
  if (!PONTEIRO_FINO || MOVIMENTO_REDUZIDO) return;
  const alvos = [...document.querySelectorAll('[data-magnet]')];
  if (!alvos.length) return;
  document.addEventListener('mousemove', e => {
    alvos.forEach(el => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      el.style.transform = Math.hypot(dx, dy) < 130 ? `translate(${dx * 0.25}px, ${dy * 0.32}px)` : '';
    });
  }, { passive: true });
}

// TiltedCard: cartão inclina em 3D na direção do cursor
function aplicarTilt() {
  if (!PONTEIRO_FINO || MOVIMENTO_REDUZIDO) return;
  document.querySelectorAll('[data-tilt]').forEach(el => {
    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      el.style.transform = `rotateY(${(x - 0.5) * 14}deg) rotateX(${(0.5 - y) * 12}deg) scale(1.02)`;
      el.style.setProperty('--gx', `${x * 100}%`);
      el.style.setProperty('--gy', `${y * 100}%`);
    });
    el.addEventListener('mouseleave', () => {
      el.style.transform = '';
    });
  });
}

// SpotlightCard: luz que segue o cursor (delegado, funciona em cartões criados depois)
function aplicarSpotlight() {
  if (!PONTEIRO_FINO) return;
  document.addEventListener('mousemove', e => {
    const card = e.target.closest?.('.spotlight, .produto-cartao');
    if (!card) return;
    card.classList.add('spotlight');
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });
}

// ClickSpark: faíscas a cada clique
function aplicarClickSpark() {
  if (MOVIMENTO_REDUZIDO || typeof Element.prototype.animate !== 'function') return;
  document.addEventListener('click', e => {
    if (!e.isTrusted || (e.clientX === 0 && e.clientY === 0)) return;
    for (let i = 0; i < 8; i++) {
      const f = document.createElement('span');
      f.className = 'faisca';
      f.style.left = `${e.clientX}px`;
      f.style.top = `${e.clientY}px`;
      document.body.appendChild(f);
      const ang = i * 45;
      f.animate(
        [
          { transform: `rotate(${ang}deg) translateY(4px) scaleY(1)`, opacity: 1 },
          { transform: `rotate(${ang}deg) translateY(24px) scaleY(0.2)`, opacity: 0 }
        ],
        { duration: 450, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
      ).onfinish = () => f.remove();
    }
  });
}

// Abas com pílula deslizante (transitions.dev · Tabs sliding)
function configurarAbasDeslizantes(container, seletorItem, classeAtivo, classeIndicador) {
  if (!container) return null;
  let ind = container.querySelector(`.${classeIndicador}`);
  if (!ind) {
    ind = document.createElement('span');
    ind.className = classeIndicador;
    ind.setAttribute('aria-hidden', 'true');
    container.prepend(ind);
  }

  const mover = (item, visivel = true) => {
    if (!item) {
      ind.style.opacity = '0';
      return;
    }
    // Posição relativa ao container (offsetLeft falharia com <li> posicionado)
    const rc = container.getBoundingClientRect();
    const ri = item.getBoundingClientRect();
    ind.style.left = `${ri.left - rc.left + container.scrollLeft}px`;
    ind.style.width = `${ri.width}px`;
    ind.style.opacity = visivel ? '1' : '0';
  };

  const ativo = () => container.querySelector(`${seletorItem}.${classeAtivo}`);
  return { mover, ativo, ind };
}

function aplicarNavDeslizante() {
  const lista = document.getElementById('navLinksDesktop');
  if (!lista) return;
  const abas = configurarAbasDeslizantes(lista, 'a', 'ativo', 'nav-pilula');
  const posicionarNoAtivo = () => abas.mover(abas.ativo(), Boolean(abas.ativo()));

  lista.querySelectorAll('a').forEach(a => {
    a.addEventListener('mouseenter', () => abas.mover(a, true));
    a.addEventListener('focus', () => abas.mover(a, true));
  });
  lista.addEventListener('mouseleave', posicionarNoAtivo);

  // Primeira posição sem animação
  abas.ind.style.transition = 'none';
  posicionarNoAtivo();
  proximoQuadro(() => { abas.ind.style.transition = ''; });
  window.addEventListener('resize', posicionarNoAtivo);
  document.fonts?.ready?.then(posicionarNoAtivo);
}

function aplicarFiltrosDeslizantes() {
  const filtros = document.getElementById('filtros');
  if (!filtros) return;
  const abas = configurarAbasDeslizantes(filtros, '.filtro-btn', 'ativo', 'filtro-ind');
  const atualizar = () => abas.mover(abas.ativo(), true);

  abas.ind.style.transition = 'none';
  atualizar();
  proximoQuadro(() => { abas.ind.style.transition = ''; });

  // Acompanha a troca da classe "ativo" feita pelo catalogo.js
  new MutationObserver(atualizar).observe(filtros, { subtree: true, attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', atualizar);
  document.fonts?.ready?.then(atualizar);
}

// Badge do carrinho dá um "pulo" quando o número muda
function aplicarPopBadge() {
  const pular = (el) => {
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  };
  ['carrinhoContagem', 'carrinhoContagemDrawer'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    let ultimo = el.textContent;
    new MutationObserver(() => {
      if (el.textContent !== ultimo && !el.hidden) pular(el);
      ultimo = el.textContent;
    }).observe(el, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  });
}

// Botão "Adicionar" troca para "Na sacola" por alguns segundos
function confirmarBotaoAdicionar(btn) {
  if (!btn) return;
  btn.classList.add('ok');
  clearTimeout(btn._temporizadorOk);
  btn._temporizadorOk = setTimeout(() => btn.classList.remove('ok'), 2200);
}

window.confirmarBotaoAdicionar = confirmarBotaoAdicionar;

// Marcação padrão do botão de adicionar usado nos cartões de produto
function botaoAdicionarHtml(produto, esgotado) {
  const nome = typeof escapeHtml === 'function' ? escapeHtml(produto.nome) : String(produto.nome || '');
  const id = typeof escapeHtml === 'function' ? escapeHtml(produto.id) : String(produto.id || '');
  return `
    <button type="button" class="produto-add" data-add="${id}" aria-label="Adicionar ${nome} ao carrinho" ${esgotado ? 'disabled' : ''}>
      <span class="t t-base">${esgotado ? 'Esgotado' : 'Adicionar'}</span>
      <span class="t t-ok" aria-hidden="true">✓ Na sacola</span>
    </button>`;
}

window.botaoAdicionarHtml = botaoAdicionarHtml;

// Cartão de produto padrão (cardápio e página inicial)
function cartaoProdutoHtml(p, indice = 0) {
  const esgotado = p.disponivel === false;
  const desc = p.descricao_curta || p.descricao || '';
  return `
    <a href="produto?id=${encodeURIComponent(p.id)}" class="produto-cartao entra" style="animation-delay:${Math.min(indice, 12) * 40}ms">
      <div class="produto-imagem">
        ${esgotado ? '<span class="esgotado-tag">Esgotado</span>' : ''}
        <img src="${escapeHtml(p.imagem_url || 'img/HeaderDonaBenta.png')}" alt="${escapeHtml(p.nome)}" loading="lazy" onerror="this.src='img/HeaderDonaBenta.png'">
      </div>
      <div class="produto-info">
        <h3>${escapeHtml(p.nome)}</h3>
        ${desc ? `<p class="produto-desc">${escapeHtml(desc)}</p>` : ''}
        <div class="produto-rodape">
          <span class="produto-preco">${formatarPreco(p.preco)}</span>
          ${botaoAdicionarHtml(p, esgotado)}
        </div>
      </div>
    </a>`;
}

window.cartaoProdutoHtml = cartaoProdutoHtml;

// Liga os botões "Adicionar" de uma área à lista de produtos carregada
function ligarBotoesAdicionar(area, produtos) {
  if (!area) return;
  area.querySelectorAll('[data-add]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const produto = produtos.find(p => String(p.id) === String(btn.dataset.add));
      if (!produto) return;
      if (produto.disponivel === false) {
        mostrarToast('Este produto está esgotado no momento.', 'alerta');
        return;
      }
      adicionarAoCarrinho(produto, 1);
      confirmarBotaoAdicionar(btn);
    });
  });
}

window.ligarBotoesAdicionar = ligarBotoesAdicionar;

// Permite que outras páginas reapliquem os efeitos em conteúdo carregado depois
window.aplicarEfeitos = function (raiz = document) {
  aplicarSplitText(raiz);
  aplicarBlurText(raiz);
  aplicarCountUp(raiz);
  aplicarReveal(raiz);
};

document.addEventListener('DOMContentLoaded', () => {
  // Títulos de páginas internas ganham o SplitText automaticamente
  document.querySelectorAll('.pagina-header h1').forEach(h => {
    if (!h.hasAttribute('data-split')) h.setAttribute('data-split', '');
  });

  window.aplicarEfeitos();
  aplicarScrollReveal();
  aplicarMagnet();
  aplicarTilt();
  aplicarSpotlight();
  aplicarClickSpark();
  aplicarFiltrosDeslizantes();

  // O header é montado pelo layout.js no mesmo evento; espera ele existir
  setTimeout(() => {
    aplicarNavDeslizante();
    aplicarPopBadge();
  }, 0);
});
