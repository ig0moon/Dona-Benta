// ============================================
// DONA BENTA — Header e Footer compartilhados
// Injetados em todas as páginas para manter consistência
// ============================================

const CHAVE_TEMA = 'donaBentaTema';

// Ícones SVG oficiais (Pix e WhatsApp)
const ICONE_PIX_SVG = `<svg class="icone-pix-svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g><path d="M11.917 11.71a2.046 2.046 0 0 1-1.454-.602l-2.1-2.1a.4.4 0 0 0-.551 0l-2.108 2.108a2.044 2.044 0 0 1-1.454.602h-.414l2.66 2.66c.83.83 2.177.83 3.007 0l2.667-2.668h-.253zM4.25 4.282c.55 0 1.066.214 1.454.602l2.108 2.108a.39.39 0 0 0 .552 0l2.1-2.1a2.044 2.044 0 0 1 1.453-.602h.253L9.503 1.623a2.127 2.127 0 0 0-3.007 0l-2.66 2.66h.414z"></path><path d="m14.377 6.496-1.612-1.612a.307.307 0 0 1-.114.023h-.733c-.379 0-.75.154-1.017.422l-2.1 2.1a1.005 1.005 0 0 1-1.425 0L5.268 5.32a1.448 1.448 0 0 0-1.018-.422h-.9a.306.306 0 0 1-.109-.021L1.623 6.496c-.83.83-.83 2.177 0 3.008l1.618 1.618a.305.305 0 0 1 .108-.022h.901c.38 0 .75-.153 1.018-.421L7.375 8.57a1.034 1.034 0 0 1 1.426 0l2.1 2.1c.267.268.638.421 1.017.421h.733c.04 0 .079.01.114.024l1.612-1.612c.83-.83.83-2.178 0-3.008z"></path></g></svg>`;

const ICONE_WHATSAPP_SVG = `<svg class="icone-whatsapp-svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g><path d="M11.42 9.49c-.19-.09-1.1-.54-1.27-.61s-.29-.09-.42.1-.48.6-.59.73-.21.14-.4 0a5.13 5.13 0 0 1-1.49-.92 5.25 5.25 0 0 1-1-1.29c-.11-.18 0-.28.08-.38s.18-.21.28-.32a1.39 1.39 0 0 0 .18-.31.38.38 0 0 0 0-.33c0-.09-.42-1-.58-1.37s-.3-.32-.41-.32h-.4a.72.72 0 0 0-.5.23 2.1 2.1 0 0 0-.65 1.55A3.59 3.59 0 0 0 5 8.2 8.32 8.32 0 0 0 8.19 11c.44.19.78.3 1.05.39a2.53 2.53 0 0 0 1.17.07 1.93 1.93 0 0 0 1.26-.88 1.67 1.67 0 0 0 .11-.88c-.05-.07-.17-.12-.36-.21z"></path><path d="M13.29 2.68A7.36 7.36 0 0 0 8 .5a7.44 7.44 0 0 0-6.41 11.15l-1 3.85 3.94-1a7.4 7.4 0 0 0 3.55.9H8a7.44 7.44 0 0 0 5.29-12.72zM8 14.12a6.12 6.12 0 0 1-3.15-.87l-.22-.13-2.34.61.62-2.28-.14-.23a6.18 6.18 0 0 1 9.6-7.65 6.12 6.12 0 0 1 1.81 4.37A6.19 6.19 0 0 1 8 14.12z"></path></g></svg>`;

window.ICONE_PIX_SVG = ICONE_PIX_SVG;
window.ICONE_WHATSAPP_SVG = ICONE_WHATSAPP_SVG;

// Execução imediata do tema para evitar qualquer piscar de tela (FOUC)
(function initTemaImediato() {
  try {
    const temaSalvo = localStorage.getItem(CHAVE_TEMA);
    if (temaSalvo === 'escuro') {
      document.documentElement.setAttribute('data-tema', 'escuro');
    } else {
      document.documentElement.removeAttribute('data-tema');
    }
  } catch (e) {}
})();

function obterTemaAtual() {
  try {
    return localStorage.getItem(CHAVE_TEMA) || 'claro';
  } catch (e) {
    return 'claro';
  }
}

function sincronizarControlesTema() {
  const isEscuro = obterTemaAtual() === 'escuro';
  document.querySelectorAll('.toggle-tema-input').forEach(input => {
    input.checked = isEscuro;
  });
  document.querySelectorAll('.icone-tema-indicador').forEach(icone => {
    icone.textContent = isEscuro ? 'dark_mode' : 'light_mode';
  });
}

function aplicarTema(tema) {
  const isEscuro = tema === 'escuro';
  if (isEscuro) {
    document.documentElement.setAttribute('data-tema', 'escuro');
  } else {
    document.documentElement.removeAttribute('data-tema');
  }
  try {
    localStorage.setItem(CHAVE_TEMA, isEscuro ? 'escuro' : 'claro');
  } catch (e) {}

  // Atualiza as logos do cabeçalho e do menu gaveta (mobile)
  const logoImgs = document.querySelectorAll('.nav-logo img, .nav-drawer-marca img');
  logoImgs.forEach(img => {
    img.src = isEscuro ? 'img/HeaderDonaBentaBranco.png' : 'img/HeaderDonaBenta.png';
  });

  sincronizarControlesTema();

  try {
    window.dispatchEvent(new CustomEvent('temaAlterado', { detail: { tema } }));
  } catch (e) {}
}

function alternarTema() {
  const atual = obterTemaAtual();
  const novo = atual === 'escuro' ? 'claro' : 'escuro';
  aplicarTema(novo);
  if (typeof mostrarToast === 'function') {
    mostrarToast(novo === 'escuro' ? 'Modo escuro ativado' : 'Modo claro ativado', 'info');
  }
}

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
  const isEscuro = obterTemaAtual() === 'escuro';
  const header = document.createElement('header');
  header.className = 'header';
  header.innerHTML = `
    <nav class="nav">
      <!-- Botão sanduíche à esquerda no mobile -->
      <button class="nav-toggle" id="navToggle" aria-label="Abrir menu de navegação" aria-expanded="false" aria-controls="navDrawer">
        <span class="material-symbols-outlined">menu</span>
      </button>

      <!-- Logo centralizada no mobile / à esquerda no desktop -->
      <a href="index.html" class="nav-logo" aria-label="Página inicial Dona Benta">
        <img src="${isEscuro ? 'img/HeaderDonaBentaBranco.png' : 'img/HeaderDonaBenta.png'}" alt="Dona Benta Padaria & Confeitaria">
      </a>

      <!-- Links de navegação tradicionais para telas grandes (desktop) -->
      <ul class="nav-links-desktop" id="navLinksDesktop">
        ${LINKS_NAV.map(l => `<li><a href="${l.href}" class="${l.href === atual ? 'ativo' : ''}">${l.label}</a></li>`).join('')}
      </ul>

      <!-- Ações à direita (carrinho e conta com dropdown) -->
      <div class="nav-actions">
        <a href="carrinho.html" class="nav-icon-btn" aria-label="Ver carrinho" id="linkCarrinho">
          <span class="material-symbols-outlined">shopping_bag</span>
          <span class="cart-badge" id="carrinhoContagem" hidden>0</span>
        </a>
        <div class="nav-user-wrapper" id="navUserWrapper">
          <a href="login.html" class="nav-icon-btn" aria-label="Entrar ou acessar conta" id="linkConta" title="Entrar / Minha Conta">
            <span class="material-symbols-outlined" id="iconeContaNav">person</span>
          </a>
          <!-- Dropdown do perfil no header -->
          <div class="nav-usuario-dropdown" id="navUsuarioDropdown" aria-hidden="true" role="menu"></div>
        </div>
      </div>
    </nav>
  `;
  document.body.prepend(header);

  // Injetar Overlay e Drawer diretamente no document.body para não ficarem restritos ao contexto do header.
  // Isso permite que o backdrop-filter / blur cubra a tela inteira (site todo) ao abrir o menu lateral.
  const drawerMarkup = `
    <!-- Fundo escurecido com blur cobrindo o site todo -->
    <div class="nav-drawer-overlay" id="navDrawerOverlay" aria-hidden="true"></div>

    <!-- Gaveta Lateral Off-Canvas à Esquerda -->
    <aside class="nav-drawer" id="navDrawer" aria-label="Menu de navegação mobile" aria-hidden="true">
      <div class="nav-drawer-topo">
        <a href="index.html" class="nav-drawer-marca">
          <img src="${isEscuro ? 'img/HeaderDonaBentaBranco.png' : 'img/HeaderDonaBenta.png'}" alt="Dona Benta">
        </a>
        <button class="nav-drawer-fechar" id="navDrawerFechar" aria-label="Fechar menu">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <div class="nav-drawer-corpo">
        <span class="nav-drawer-secao-titulo">Páginas</span>
        <ul class="nav-drawer-links">
          <li>
            <a href="index.html" class="${atual === 'index.html' ? 'ativo' : ''}">
              <span class="material-symbols-outlined">home</span>
              <span>Início</span>
            </a>
          </li>
          <li>
            <a href="catalogo.html" class="${atual === 'catalogo.html' ? 'ativo' : ''}">
              <span class="material-symbols-outlined">storefront</span>
              <span>Catálogo</span>
            </a>
          </li>
          <li>
            <a href="sobre.html" class="${atual === 'sobre.html' ? 'ativo' : ''}">
              <span class="material-symbols-outlined">auto_stories</span>
              <span>Sobre nós</span>
            </a>
          </li>
          <li>
            <a href="faq.html" class="${atual === 'faq.html' ? 'ativo' : ''}">
              <span class="material-symbols-outlined">help</span>
              <span>Dúvidas Frequentes</span>
            </a>
          </li>
        </ul>

        <span class="nav-drawer-secao-titulo">Minha Área</span>
        <ul class="nav-drawer-links">
          <li>
            <a href="carrinho.html" class="${atual === 'carrinho.html' ? 'ativo' : ''}">
              <span class="material-symbols-outlined">shopping_bag</span>
              <span>Meu Carrinho</span>
              <span class="drawer-badge" id="carrinhoContagemDrawer" hidden>0</span>
            </a>
          </li>
          <li id="drawerItemConta">
            <a href="login.html" id="drawerLinkConta" class="${atual === 'login.html' || atual === 'conta.html' ? 'ativo' : ''}">
              <span class="material-symbols-outlined">person</span>
              <span id="drawerTextoConta">Entrar / Cadastrar</span>
            </a>
          </li>
          <li id="drawerItemPedidos" hidden>
            <a href="conta.html?aba=pedidos" class="${atual === 'conta.html' && window.location.search.includes('pedidos') ? 'ativo' : ''}">
              <span class="material-symbols-outlined">receipt_long</span>
              <span>Meus pedidos</span>
            </a>
          </li>
          <li class="nav-drawer-tema-item">
            <div class="nav-drawer-tema-label">
              <span class="material-symbols-outlined icone-tema-indicador" id="iconeTemaDrawer">${isEscuro ? 'dark_mode' : 'light_mode'}</span>
              <span>Modo escuro</span>
            </div>
            <label class="switch-tema" for="toggleTemaDrawer" title="Alternar modo escuro">
              <input type="checkbox" id="toggleTemaDrawer" class="toggle-tema-input" ${isEscuro ? 'checked' : ''} aria-label="Alternar modo escuro">
              <span class="switch-slider"></span>
            </label>
          </li>
        </ul>
      </div>

      <div class="nav-drawer-rodape">
        <a href="https://api.whatsapp.com/send?phone=5542999823994&text=Ol%C3%A1!%20Vim%20pelo%20site%20Dona%20Benta" target="_blank" rel="noopener noreferrer" class="btn-whatsapp-drawer">
          ${ICONE_WHATSAPP_SVG}
          <span>Fale no WhatsApp</span>
        </a>
        <p class="nav-drawer-horario">Seg a Sáb, 8h às 19h</p>
      </div>
    </aside>
  `;
  document.body.insertAdjacentHTML('beforeend', drawerMarkup);

  // Manipuladores de abertura e fechamento da gaveta lateral
  const toggle = document.getElementById('navToggle');
  const drawer = document.getElementById('navDrawer');
  const overlay = document.getElementById('navDrawerOverlay');
  const fecharBtn = document.getElementById('navDrawerFechar');

  const abrirDrawer = () => {
    if (!drawer || !overlay) return;
    drawer.classList.add('aberto');
    overlay.classList.add('aberto');
    drawer.setAttribute('aria-hidden', 'false');
    overlay.setAttribute('aria-hidden', 'false');
    toggle?.setAttribute('aria-expanded', 'true');
    document.body.classList.add('drawer-aberto');
  };

  const fecharDrawer = () => {
    if (!drawer || !overlay) return;
    drawer.classList.remove('aberto');
    overlay.classList.remove('aberto');
    drawer.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('aria-hidden', 'true');
    toggle?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('drawer-aberto');
  };

  toggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (drawer?.classList.contains('aberto')) {
      fecharDrawer();
    } else {
      abrirDrawer();
    }
  });

  fecharBtn?.addEventListener('click', fecharDrawer);
  overlay?.addEventListener('click', fecharDrawer);

  drawer?.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', fecharDrawer);
  });

  // Alternador de tema dentro do Drawer Lateral
  const toggleDrawer = document.getElementById('toggleTemaDrawer');
  toggleDrawer?.addEventListener('change', () => {
    alternarTema();
  });

  // Fechamento com tecla Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (drawer?.classList.contains('aberto')) {
        fecharDrawer();
      }
      const dropdown = document.getElementById('navUsuarioDropdown');
      if (dropdown && dropdown.classList.contains('aberto')) {
        dropdown.classList.remove('aberto');
        dropdown.setAttribute('aria-hidden', 'true');
        document.getElementById('linkConta')?.setAttribute('aria-expanded', 'false');
      }
    }
  });

  // Fechar dropdown de usuário ao clicar fora
  document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('navUserWrapper');
    const dropdown = document.getElementById('navUsuarioDropdown');
    if (dropdown && dropdown.classList.contains('aberto')) {
      if (!wrapper || !wrapper.contains(e.target)) {
        dropdown.classList.remove('aberto');
        dropdown.setAttribute('aria-hidden', 'true');
        document.getElementById('linkConta')?.setAttribute('aria-expanded', 'false');
      }
    }
  });

  atualizarContagemCarrinho();
}

function montarFooter() {
  const footer = document.createElement('footer');
  footer.className = 'footer';
  footer.innerHTML = `
    <div class="footer-conteudo">
      <div>
        <div class="footer-marca">
          Dona Benta
        </div>
        <p class="footer-desc">Pães, bolos e doces feitos como antigamente, com ingredientes selecionados e todo carinho da nossa cozinha para a sua mesa.</p>
        <div class="footer-social">
          <a href="https://www.instagram.com/marisagutock?igsh=MTYyejJ3eXA3MmJjZw==" aria-label="Instagram" target="_blank" rel="noopener noreferrer">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-instagram" viewBox="0 0 16 16">
              <path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.9 3.9 0 0 0-1.417.923A3.9 3.9 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.852.174 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.9 3.9 0 0 0 1.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.299c-.04-.851-.175-1.433-.372-1.941a3.9 3.9 0 0 0-.923-1.417A3.9 3.9 0 0 0 13.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.998 0zm-.717 1.442h.718c2.136 0 2.389.007 3.232.046.78.035 1.204.166 1.486.275.373.145.64.319.92.599s.453.546.598.92c.11.281.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.5 2.5 0 0 1-.599.919c-.28.28-.546.453-.92.598-.28.11-.704.24-1.485.276-.843.038-1.096.047-3.232.047s-2.39-.009-3.233-.047c-.78-.036-1.203-.166-1.485-.276a2.5 2.5 0 0 1-.92-.598 2.5 2.5 0 0 1-.6-.92c-.109-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.233s.008-2.388.046-3.231c.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92s.546-.453.92-.598c.282-.11.705-.24 1.485-.276.738-.034 1.024-.044 2.515-.045zm4.988 1.328a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.92m-4.27 1.122a4.109 4.109 0 1 0 0 8.217 4.109 4.109 0 0 0 0-8.217m0 1.441a2.667 2.667 0 1 1 0 5.334 2.667 2.667 0 0 1 0-5.334"/>
            </svg>
          </a>

          <a href="https://www.facebook.com/share/14dHYmA8xDF/?mibextid=wwXIfr" aria-label="Facebook" target="_blank" rel="noopener noreferrer">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-facebook" viewBox="0 0 16 16">
              <path d="M16 8.049c0-4.446-3.582-8.05-8-8.05C3.58 0-.002 3.603-.002 8.05c0 4.017 2.926 7.347 6.75 7.951v-5.625h-2.03V8.05H6.75V6.275c0-2.017 1.195-3.131 3.022-3.131.876 0 1.791.157 1.791.157v1.98h-1.009c-.993 0-1.303.621-1.303 1.258v1.51h2.218l-.354 2.326H9.25V16c3.824-.604 6.75-3.934 6.75-7.951"/>
            </svg>
          </a>

          <a href="https://api.whatsapp.com/send?phone=5542999823994&text=Ol%C3%A1!%20Vim%20pelo%20site%20Dona%20Benta%20e%20gostaria%20de%20saber%20mais%20sobre." aria-label="WhatsApp" target="_blank" rel="noopener noreferrer">
            ${ICONE_WHATSAPP_SVG}
          </a>
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
      <div class="footer-col" id="footerColConta">
        <h4>Conta</h4>
        <ul id="footerLinksConta">
          <!-- Dinâmico: Entrar/Cadastrar quando deslogado, Minha conta quando logado -->
          <li><a href="login.html">Entrar / Cadastrar</a></li>
          <li><a href="carrinho.html">Carrinho</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Contato</h4>
        <ul class="footer-contato">
          <li><span class="material-symbols-outlined">location_on</span> Rua Padre Anacleto, 1168 - Nova Rússia</li>
          <li><span class="material-symbols-outlined">schedule</span> Seg a Sáb, 8h às 19h</li>
          <li>${ICONE_WHATSAPP_SVG}<a href="https://api.whatsapp.com/send?phone=5542999823994&text=Ol%C3%A1!%20Vim%20pelo%20site%20Dona%20Benta%20e%20gostaria%20de%20saber%20mais%20sobre." target="_blank" rel="noopener noreferrer">(42) 99982-3994</a></li>
          <li><span class="material-symbols-outlined">mail</span> contato@donabenta.com.br</li>
        </ul>
      </div>
    </div>
    <div class="logo-benta-footer">
      <img src="img/LogoDonaBenta.png" alt="Logo Dona Benta">
    </div>
    <div class="footer-base">
      © ${new Date().getFullYear()} Dona Benta Confeitaria e Padaria. Todos os direitos reservados.
    </div>
  `;
  document.body.appendChild(footer);
}

// Aplica a foto de perfil (ou ícone padrão) no botão de conta da Navbar e Gaveta Lateral
function aplicarAvatarAoBotaoConta(avatarUrl) {
  const linkContaNav = document.getElementById('linkConta');
  const drawerLinkConta = document.getElementById('drawerLinkConta');
  const escapar = typeof escapeHtml === 'function' ? escapeHtml : (str => String(str || '').replace(/[&<>"']/g, ''));
  const sanitizarLink = typeof sanitizeUrl === 'function' ? sanitizeUrl : escapar;

  if (linkContaNav) {
    if (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.trim()) {
      const urlSegura = sanitizarLink(avatarUrl.trim());
      linkContaNav.innerHTML = `<img src="${urlSegura}" alt="Minha conta" class="nav-avatar-img" onerror="this.onerror=null; this.parentElement.classList.remove('com-avatar'); this.parentElement.innerHTML='<span class=\\'material-symbols-outlined\\' id=\\'iconeContaNav\\'>person</span>';">`;
      linkContaNav.classList.add('com-avatar');
    } else {
      linkContaNav.innerHTML = `<span class="material-symbols-outlined" id="iconeContaNav">person</span>`;
      linkContaNav.classList.remove('com-avatar');
    }
  }

  if (drawerLinkConta) {
    const drawerTextoConta = document.getElementById('drawerTextoConta');
    const texto = drawerTextoConta ? escapar(drawerTextoConta.textContent) : 'Minha Conta';
    if (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.trim()) {
      const urlSegura = sanitizarLink(avatarUrl.trim());
      drawerLinkConta.innerHTML = `
        <img src="${urlSegura}" alt="Minha conta" class="drawer-avatar-img" onerror="this.onerror=null; this.outerHTML='<span class=\\'material-symbols-outlined\\'>person</span>';">
        <span id="drawerTextoConta">${texto}</span>
      `;
    } else {
      drawerLinkConta.innerHTML = `
        <span class="material-symbols-outlined" id="drawerIconeConta">person</span>
        <span id="drawerTextoConta">${texto}</span>
      `;
    }
  }
}

// Atualiza o estado de autenticação nos elementos do layout (Header, Drawer e Footer)
async function atualizarAuthLayout() {
  const linksContaLista = document.getElementById('footerLinksConta');
  const linkContaNav = document.getElementById('linkConta');
  const dropdown = document.getElementById('navUsuarioDropdown');
  const drawerLinkConta = document.getElementById('drawerLinkConta');
  const drawerTextoConta = document.getElementById('drawerTextoConta');
  const drawerItemPedidos = document.getElementById('drawerItemPedidos');
  const escapar = typeof escapeHtml === 'function' ? escapeHtml : (str => String(str || '').replace(/[&<>"']/g, ''));

  try {
    const usuario = typeof usuarioAtual === 'function' ? await usuarioAtual() : null;

    if (usuario) {
      // Usuário LOGADO
      if (drawerItemPedidos) {
        drawerItemPedidos.hidden = false;
      }

      if (drawerLinkConta && drawerTextoConta) {
        drawerLinkConta.href = 'conta.html';
        drawerTextoConta.textContent = 'Minha Conta';
      }

      // Se o usuário tem foto de perfil, obtém o avatar
      let avatarUrl = usuario?.user_metadata?.avatar_url || null;
      let perfilInfo = null;
      if (typeof perfilAtual === 'function') {
        perfilInfo = await perfilAtual();
        if (!avatarUrl && perfilInfo?.avatar_url) {
          avatarUrl = perfilInfo.avatar_url;
        }
      }
      aplicarAvatarAoBotaoConta(avatarUrl);

      const nomeExibicao = (perfilInfo?.nome || usuario?.user_metadata?.nome || usuario?.email?.split('@')[0] || 'Cliente').trim();
      const emailExibicao = usuario?.email || '';
      const inicial = nomeExibicao.charAt(0).toUpperCase() || 'U';
      const isEscuro = obterTemaAtual() === 'escuro';

      // Dropdown de perfil no header
      if (linkContaNav && dropdown) {
        linkContaNav.href = '#';
        linkContaNav.setAttribute('aria-label', 'Menu da conta');
        linkContaNav.setAttribute('title', 'Minha conta e opções');
        linkContaNav.setAttribute('aria-haspopup', 'true');
        linkContaNav.setAttribute('aria-expanded', 'false');

        linkContaNav.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const aberto = dropdown.classList.toggle('aberto');
          dropdown.setAttribute('aria-hidden', (!aberto).toString());
          linkContaNav.setAttribute('aria-expanded', aberto.toString());
        };

        dropdown.innerHTML = `
          <div class="nav-dropdown-header">
            ${avatarUrl ? `
              <img src="${escapar(avatarUrl)}" alt="Foto de perfil" class="nav-dropdown-avatar" onerror="this.outerHTML='<div class=\\'nav-dropdown-avatar-monograma\\'>${escapar(inicial)}</div>';">
            ` : `
              <div class="nav-dropdown-avatar-monograma">${escapar(inicial)}</div>
            `}
            <div class="nav-dropdown-usuario-info">
              <span class="nav-dropdown-nome">${escapar(nomeExibicao)}</span>
              <span class="nav-dropdown-email">${escapar(emailExibicao)}</span>
            </div>
          </div>

          <div class="nav-dropdown-divisor"></div>

          <ul class="nav-dropdown-menu">
            <li>
              <a href="conta.html" class="nav-dropdown-item">
                <span class="material-symbols-outlined">person</span>
                <span>Minha conta</span>
              </a>
            </li>
            <li>
              <a href="conta.html?aba=pedidos" class="nav-dropdown-item">
                <span class="material-symbols-outlined">receipt_long</span>
                <span>Meus pedidos</span>
              </a>
            </li>
          </ul>

          <div class="nav-dropdown-divisor"></div>

          <div class="nav-dropdown-tema-item">
            <div class="nav-dropdown-tema-label">
              <span class="material-symbols-outlined icone-tema-indicador" id="iconeTemaDropdown">${isEscuro ? 'dark_mode' : 'light_mode'}</span>
              <span>Modo escuro</span>
            </div>
            <label class="switch-tema" for="toggleTemaDropdown" title="Alternar modo escuro">
              <input type="checkbox" id="toggleTemaDropdown" class="toggle-tema-input" ${isEscuro ? 'checked' : ''} aria-label="Alternar modo escuro">
              <span class="switch-slider"></span>
            </label>
          </div>

          <div class="nav-dropdown-divisor"></div>

          <button type="button" class="nav-dropdown-item nav-dropdown-sair" id="btnSairDropdown">
            <span class="material-symbols-outlined">logout</span>
            <span>Sair</span>
          </button>
        `;

        const toggleDropdown = document.getElementById('toggleTemaDropdown');
        toggleDropdown?.addEventListener('change', () => {
          alternarTema();
        });

        const btnSairDrop = document.getElementById('btnSairDropdown');
        btnSairDrop?.addEventListener('click', async (e) => {
          e.preventDefault();
          dropdown.classList.remove('aberto');
          if (typeof db !== 'undefined' && db.auth) {
            await db.auth.signOut();
            if (typeof mostrarToast === 'function') {
              mostrarToast('Você saiu da sua conta', 'info');
            }
            setTimeout(() => {
              window.location.href = 'index.html';
            }, 350);
          }
        });
      }

      if (linksContaLista) {
        linksContaLista.innerHTML = `
          <li><a href="conta.html">Minha conta</a></li>
          <li><a href="conta.html?aba=pedidos">Meus pedidos</a></li>
          <li><a href="carrinho.html">Carrinho</a></li>
          <li><a href="#" id="linkSairFooter" class="footer-link-sair">Sair da conta</a></li>
        `;

        const btnSair = document.getElementById('linkSairFooter');
        if (btnSair) {
          btnSair.addEventListener('click', async (e) => {
            e.preventDefault();
            if (typeof db !== 'undefined' && db.auth) {
              await db.auth.signOut();
              if (typeof mostrarToast === 'function') {
                mostrarToast('Você saiu da sua conta', 'info');
              }
              setTimeout(() => {
                window.location.href = 'index.html';
              }, 400);
            }
          });
        }
      }
    } else {
      // Usuário NÃO LOGADO
      if (drawerItemPedidos) {
        drawerItemPedidos.hidden = true;
      }

      if (linkContaNav) {
        linkContaNav.onclick = null;
        linkContaNav.href = 'login.html';
        linkContaNav.setAttribute('aria-label', 'Entrar ou cadastrar');
        linkContaNav.setAttribute('title', 'Entrar / Cadastrar');
        linkContaNav.removeAttribute('aria-haspopup');
        linkContaNav.removeAttribute('aria-expanded');
      }

      if (dropdown) {
        dropdown.classList.remove('aberto');
        dropdown.setAttribute('aria-hidden', 'true');
        dropdown.innerHTML = '';
      }

      if (drawerLinkConta && drawerTextoConta) {
        drawerLinkConta.href = 'login.html';
        drawerTextoConta.textContent = 'Entrar / Cadastrar';
      }

      aplicarAvatarAoBotaoConta(null);

      if (linksContaLista) {
        linksContaLista.innerHTML = `
          <li><a href="login.html">Entrar / Cadastrar</a></li>
          <li><a href="carrinho.html">Carrinho</a></li>
        `;
      }
    }
  } catch (err) {
    console.warn('Erro ao atualizar auth no layout:', err);
  }
}

function atualizarContagemCarrinho() {
  let total = 0;
  try {
    const raw = localStorage.getItem('donaBentaCarrinho');
    if (raw) {
      const carrinho = JSON.parse(raw);
      if (Array.isArray(carrinho)) {
        total = carrinho.reduce((soma, item) => soma + (Number(item?.quantidade) || 0), 0);
      }
    }
  } catch (e) {
    total = 0;
  }

  const badge = document.getElementById('carrinhoContagem');
  const badgeDrawer = document.getElementById('carrinhoContagemDrawer');

  if (badge) {
    if (total > 0) {
      badge.textContent = total;
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }

  if (badgeDrawer) {
    if (total > 0) {
      badgeDrawer.textContent = total;
      badgeDrawer.hidden = false;
    } else {
      badgeDrawer.hidden = true;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  montarHeader();
  montarFooter();
  atualizarAuthLayout();

  // Escuta mudanças de auth em tempo real no Supabase
  if (typeof db !== 'undefined' && db.auth) {
    db.auth.onAuthStateChange(() => {
      atualizarAuthLayout();
    });
  }
});