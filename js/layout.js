// ============================================
// DONA BENTA — Header e Footer compartilhados
// Injetados em todas as páginas para manter consistência
// ============================================

const LINKS_NAV = [
  { href: 'index.html', label: 'Início' },
  { href: 'catalogo.html', label: 'Catálogo' },
  { href: 'sobre.html', label: 'Sobre' },
  { href: 'faq.html', label: 'FAQ' },
];

function paginaAtual() {
  const caminho = window.location.pathname.split('/').pop() || 'index.html';
  return caminho;
}

function montarHeader() {
  const atual = paginaAtual();
  const header = document.createElement('header');
  header.className = 'header';
  header.innerHTML = `
    <nav class="nav">
      <a href="index.html" class="nav-logo">
        <span class="material-symbols-outlined">bakery_dining</span>
        Dona Benta
      </a>
      <button class="nav-toggle" id="navToggle" aria-label="Abrir menu">
        <span class="material-symbols-outlined">menu</span>
      </button>
      <ul class="nav-links" id="navLinks">
        ${LINKS_NAV.map(l => `<li><a href="${l.href}" class="${l.href === atual ? 'ativo' : ''}">${l.label}</a></li>`).join('')}
      </ul>
      <div class="nav-actions">
        <a href="carrinho.html" class="nav-icon-btn" aria-label="Carrinho" id="linkCarrinho">
          <span class="material-symbols-outlined">shopping_bag</span>
          <span class="cart-badge" id="carrinhoContagem" hidden>0</span>
        </a>
        <a href="conta.html" class="nav-icon-btn" aria-label="Minha conta" id="linkConta">
          <span class="material-symbols-outlined">person</span>
        </a>
      </div>
    </nav>
  `;
  document.body.prepend(header);

  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  toggle.addEventListener('click', () => links.classList.toggle('aberto'));

  atualizarContagemCarrinho();
}

function montarFooter() {
  const footer = document.createElement('footer');
  footer.className = 'footer';
  footer.innerHTML = `
    <div class="footer-conteudo">
      <div>
        <div class="footer-marca">
          <span class="material-symbols-outlined">bakery_dining</span>
          Dona Benta
        </div>
        <p class="footer-desc">Pães, bolos e doces feitos como antigamente, com ingredientes selecionados e todo carinho da nossa cozinha para a sua mesa.</p>
        <div class="footer-social">
          <a href="#" aria-label="Instagram"><span class="material-symbols-outlined">photo_camera</span></a>
          <a href="#" aria-label="Facebook"><span class="material-symbols-outlined">thumb_up</span></a>
          <a href="https://wa.me/5511999999999" aria-label="WhatsApp" target="_blank" rel="noopener"><span class="material-symbols-outlined">chat</span></a>
        </div>
      </div>
      <div class="footer-col">
        <h4>Navegação</h4>
        <ul>
          <li><a href="index.html">Início</a></li>
          <li><a href="catalogo.html">Catálogo</a></li>
          <li><a href="sobre.html">Sobre nós</a></li>
          <li><a href="faq.html">Dúvidas frequentes</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Minha conta</h4>
        <ul>
          <li><a href="login.html">Entrar / Cadastrar</a></li>
          <li><a href="conta.html">Minha conta</a></li>
          <li><a href="pedidos.html">Meus pedidos</a></li>
          <li><a href="carrinho.html">Carrinho</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Contato</h4>
        <ul class="footer-contato">
          <li><span class="material-symbols-outlined">location_on</span> Rua das Palmeiras, 120 — Centro</li>
          <li><span class="material-symbols-outlined">schedule</span> Ter a Sáb, 8h às 19h</li>
          <li><span class="material-symbols-outlined">call</span> (11) 99999-9999</li>
          <li><span class="material-symbols-outlined">mail</span> contato@donabenta.com.br</li>
        </ul>
      </div>
    </div>
    <div class="footer-base">
      © ${new Date().getFullYear()} Dona Benta Confeitaria e Padaria. Todos os direitos reservados.
    </div>
  `;
  document.body.appendChild(footer);
}

function atualizarContagemCarrinho() {
  const carrinho = JSON.parse(localStorage.getItem('donaBentaCarrinho') || '[]');
  const total = carrinho.reduce((soma, item) => soma + item.quantidade, 0);
  const badge = document.getElementById('carrinhoContagem');
  if (!badge) return;
  if (total > 0) {
    badge.textContent = total;
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  montarHeader();
  montarFooter();
});
