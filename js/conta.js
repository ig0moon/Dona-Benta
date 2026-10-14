// ============================================
// DONA BENTA — js/conta.js
// Minha Conta, Perfil, Upload de Foto e Painel Admin
// ============================================

const STATUS_INFO = {
  aguardando_confirmacao: { rotulo: 'Aguardando', classe: 'badge-alerta', icone: 'hourglass_empty' },
  confirmado: { rotulo: 'Confirmado', classe: 'badge-info', icone: 'check_circle' },
  em_preparo: { rotulo: 'Em preparo', classe: 'badge-info', icone: 'skillet' },
  pronto: { rotulo: 'Pronto', classe: 'badge-sucesso', icone: 'inventory' },
  entregue: { rotulo: 'Entregue', classe: 'badge-sucesso', icone: 'done_all' },
  cancelado: { rotulo: 'Cancelado', classe: 'badge-erro', icone: 'cancel' },
};

let PRODUTOS_ADMIN = [];
let PEDIDOS_ADMIN = [];

// ============================================
// ============================================
// Função Principal: Carregar Conta
// ============================================
async function carregarConta() {
  try {
    const usuario = await exigirLogin('login.html');
    if (!usuario) return;

    const perfil = await perfilAtual();
    const layout = document.getElementById('contaLayout');
    if (!layout) return;

    const nome = perfil?.nome || 'Cliente';
    const inicial = nome.charAt(0).toUpperCase() || 'U';
    const avatarUrl = perfil?.avatar_url || null;

    layout.className = 'conta-layout';
    layout.innerHTML = `
      <aside class="conta-sidebar cartao">
        <div class="conta-perfil-topo">
          <div class="conta-avatar-wrapper" id="avatarWrapper">
            <div class="conta-avatar" id="contaAvatarPreview" aria-label="Foto de perfil">
              <span class="avatar-inicial" id="avatarInicial">${escapeHtml(inicial)}</span>
              <div class="avatar-loading" id="avatarLoading" hidden>
                <span class="material-symbols-outlined spin">autorenew</span>
              </div>
            </div>
            <label for="inputFotoPerfil" class="btn-avatar-upload" title="Alterar foto de perfil" aria-label="Alterar foto de perfil">
              <span class="material-symbols-outlined">photo_camera</span>
            </label>
            <input type="file" id="inputFotoPerfil" accept="image/png, image/jpeg, image/webp" style="display:none;">
          </div>

          <div class="perfil-info-text">
            <h3 class="perfil-nome">${escapeHtml(nome)}</h3>
            <p class="perfil-email">${escapeHtml(usuario.email || '')}</p>
            ${perfil?.role === 'admin' ? '<div class="perfil-role-wrap"><span class="badge badge-alerta">Administrador</span></div>' : ''}
            <div class="avatar-acoes" id="avatarAcoes"></div>
          </div>
        </div>

        <nav class="conta-menu" id="menuNavegacao" aria-label="Menu da conta">
          <a href="#" data-rota="perfil" class="ativo"><span class="material-symbols-outlined">person</span> Meus dados</a>
          <a href="#" data-rota="pedidos"><span class="material-symbols-outlined">receipt_long</span> Meus pedidos</a>
          ${perfil?.role === 'admin' ? '<a href="#" data-rota="admin"><span class="material-symbols-outlined">admin_panel_settings</span> Painel Admin</a>' : ''}
          <a href="#" id="btnSair" class="sair"><span class="material-symbols-outlined">logout</span> Sair</a>
        </nav>
      </aside>

      <main class="conta-conteudo" id="areaConteudo">
        <div class="cartao"><div class="spinner"></div></div>
      </main>
    `;

    // Tenta carregar foto com limite estrito de 3 segundos
    verificarECarregarAvatar(avatarUrl, nome, inicial, usuario, perfil);

    // Configura upload de foto de perfil
    configurarUploadFotoPerfil(usuario, perfil);

    // Navegação entre abas
    const linksMenu = document.querySelectorAll('#menuNavegacao a[data-rota]');
    linksMenu.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        linksMenu.forEach(l => l.classList.remove('ativo'));
        link.classList.add('ativo');
        carregarSecao(link.dataset.rota, usuario, perfil);
      });
    });

    // Logout seguro
    document.getElementById('btnSair').addEventListener('click', async (e) => {
      e.preventDefault();
      await db.auth.signOut();
      mostrarToast('Você saiu da conta', 'info');
      setTimeout(() => { window.location.href = 'index.html'; }, 300);
    });

    // Injeta o modal de admin apenas se for admin
    if (perfil?.role === 'admin') {
      injetarModalAdminGlobal();
    }

    // Roteamento inicial por URL (?aba=pedidos)
    const urlParams = new URLSearchParams(window.location.search);
    const abaInicial = urlParams.get('aba') || 'perfil';
    const linkAtivo = document.querySelector(`#menuNavegacao a[data-rota="${abaInicial}"]`);
    if (linkAtivo) {
      linksMenu.forEach(l => l.classList.remove('ativo'));
      linkAtivo.classList.add('ativo');
    }

    carregarSecao(abaInicial, usuario, perfil);
  } catch (err) {
    console.error('Erro ao inicializar página de conta:', err);
    const layout = document.getElementById('contaLayout');
    if (layout) {
      layout.innerHTML = `
        <div class="cartao vazio" style="grid-column: 1/-1;">
          <span class="material-symbols-outlined vazio-icone" style="color:var(--erro);">error</span>
          <h3>Não foi possível carregar os dados da conta</h3>
          <p>${escapeHtml(err.message || 'Erro ao comunicar com o servidor.')}</p>
          <button type="button" class="btn btn-primario" onclick="window.location.reload();" style="margin-top:14px;">
            <span class="material-symbols-outlined">refresh</span> Tentar novamente
          </button>
        </div>
      `;
    }
  }
}

// ============================================
// VISUALIZADOR DE FOTO DE PERFIL (LIGHTBOX COM BLUR)
// ============================================
function abrirVisualizadorFotoPerfil(avatarUrl, nome) {
  if (!avatarUrl || typeof avatarUrl !== 'string' || !avatarUrl.trim()) return;

  let modal = document.getElementById('avatarLightbox');
  if (!modal) {
    const markup = `
      <div class="avatar-lightbox" id="avatarLightbox" aria-hidden="true" role="dialog" aria-modal="true" aria-label="Visualizador de foto de perfil">
        <div class="avatar-lightbox-backdrop" id="avatarLightboxBackdrop" title="Clique para fechar"></div>
        <div class="avatar-lightbox-conteudo">
          <button type="button" class="avatar-lightbox-fechar" id="btnFecharAvatarLightbox" aria-label="Fechar visualização" title="Fechar (Esc)">
            <span class="material-symbols-outlined">close</span>
          </button>
          <div class="avatar-lightbox-moldura">
            <img src="" alt="Foto de perfil em tamanho maior" id="avatarLightboxImg" class="avatar-lightbox-img">
          </div>
          <div class="avatar-lightbox-info">
            <h3 id="avatarLightboxNome" class="avatar-lightbox-nome"></h3>
            <span class="avatar-lightbox-sub">Foto de perfil</span>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', markup);
    modal = document.getElementById('avatarLightbox');

    const fechar = () => {
      if (!modal) return;
      modal.classList.remove('aberto');
      modal.setAttribute('aria-hidden', 'true');
    };

    document.getElementById('btnFecharAvatarLightbox')?.addEventListener('click', fechar);
    document.getElementById('avatarLightboxBackdrop')?.addEventListener('click', fechar);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('aberto')) {
        fechar();
      }
    });
  }

  const imgEl = document.getElementById('avatarLightboxImg');
  const nomeEl = document.getElementById('avatarLightboxNome');

  if (imgEl) imgEl.src = avatarUrl;
  if (nomeEl) nomeEl.textContent = nome || 'Foto de Perfil';

  modal.classList.add('aberto');
  modal.setAttribute('aria-hidden', 'false');
}

function configurarCliqueVisualizadorAvatar(preview, avatarUrl, nome) {
  if (!preview) return;
  if (!avatarUrl) {
    preview.onclick = null;
    preview.classList.remove('clicavel');
    preview.removeAttribute('title');
    return;
  }

  preview.classList.add('clicavel');
  preview.title = 'Clique para ampliar a foto de perfil';

  preview.onclick = (e) => {
    // Evita abrir se o clique foi diretamente no botão da câmera de upload
    if (e.target.closest('#inputFotoPerfil') || e.target.closest('.btn-avatar-upload')) return;
    const imgAtual = preview.querySelector('#avatarImg');
    const urlFinal = imgAtual?.src || avatarUrl;
    abrirVisualizadorFotoPerfil(urlFinal, nome);
  };
}

// ============================================
// CORTADOR DE FOTOS QUADRADO (1:1) INTERATIVO
// Permite ao usuário arrastar, dar zoom e girar a foto
// ============================================
function abrirModalCortadorFoto({ arquivo, onConfirmar, onCancelar, titulo = 'Ajustar e Cortar Foto' }) {
  if (!arquivo) return;

  let modal = document.getElementById('modalCortadorFoto');
  if (!modal) {
    const markup = `
      <div class="cropper-modal-overlay" id="modalCortadorFoto" aria-hidden="true" role="dialog" aria-modal="true">
        <div class="cropper-modal-cartao">
          <div class="cropper-modal-topo">
            <div>
              <h3 class="cropper-modal-titulo" id="cropperTitulo">${escapeHtml(titulo)}</h3>
              <p class="cropper-modal-sub">Arraste a foto e use o zoom para enquadrar no padrão quadrado (1:1)</p>
            </div>
            <button type="button" class="cropper-fechar" id="btnFecharCropper" aria-label="Fechar" title="Fechar (Esc)">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div class="cropper-area-container">
            <div class="cropper-viewbox" id="cropperViewbox" title="Arraste para reposicionar a foto">
              <canvas id="cropperCanvas" class="cropper-canvas" width="300" height="300"></canvas>
              <div class="cropper-grade-guia"></div>
            </div>
          </div>
          <div class="cropper-controles">
            <div class="cropper-controle-zoom">
              <button type="button" class="cropper-btn-acao" id="btnZoomMenos" title="Diminuir zoom" aria-label="Diminuir zoom">
                <span class="material-symbols-outlined">remove</span>
              </button>
              <input type="range" class="cropper-slider" id="cropperZoomSlider" min="1" max="3" step="0.01" value="1" aria-label="Controle de zoom da foto">
              <button type="button" class="cropper-btn-acao" id="btnZoomMais" title="Aumentar zoom" aria-label="Aumentar zoom">
                <span class="material-symbols-outlined">add</span>
              </button>
            </div>
            <div class="cropper-acoes-rapidas">
              <button type="button" class="cropper-btn-ferramenta" id="btnGirarFoto">
                <span class="material-symbols-outlined">rotate_right</span>
                <span>Girar 90°</span>
              </button>
              <button type="button" class="cropper-btn-ferramenta" id="btnCentralizarFoto">
                <span class="material-symbols-outlined">filter_center_focus</span>
                <span>Centralizar</span>
              </button>
            </div>
          </div>
          <div class="cropper-modal-rodape">
            <button type="button" class="btn btn-outline" id="btnCancelarCropper">Cancelar</button>
            <button type="button" class="btn btn-primario" id="btnConfirmarCropper">
              <span class="material-symbols-outlined">check</span>
              <span>Confirmar e Cortar</span>
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', markup);
    modal = document.getElementById('modalCortadorFoto');
  }

  const canvas = document.getElementById('cropperCanvas');
  const ctx = canvas.getContext('2d');
  const zoomSlider = document.getElementById('cropperZoomSlider');
  const btnZoomMais = document.getElementById('btnZoomMais');
  const btnZoomMenos = document.getElementById('btnZoomMenos');
  const btnGirar = document.getElementById('btnGirarFoto');
  const btnCentralizar = document.getElementById('btnCentralizarFoto');
  const btnConfirmar = document.getElementById('btnConfirmarCropper');
  const btnCancelar = document.getElementById('btnCancelarCropper');
  const btnFechar = document.getElementById('btnFecharCropper');
  const tituloEl = document.getElementById('cropperTitulo');

  if (tituloEl) tituloEl.textContent = titulo;

  const leitor = new FileReader();
  leitor.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      let rotacao = 0;
      let zoom = 1.0;
      let panX = 0;
      let panY = 0;
      let baseScale = 1.0;

      const calcularBaseScale = () => {
        const effW = (rotacao % 180 === 0) ? img.width : img.height;
        const effH = (rotacao % 180 === 0) ? img.height : img.width;
        baseScale = Math.max(300 / effW, 300 / effH);
      };

      const limitarLimites = () => {
        const effW = (rotacao % 180 === 0) ? img.width : img.height;
        const effH = (rotacao % 180 === 0) ? img.height : img.width;
        const totalW = effW * (baseScale * zoom);
        const totalH = effH * (baseScale * zoom);
        const maxPanX = Math.max(0, (totalW - 300) / 2);
        const maxPanY = Math.max(0, (totalH - 300) / 2);
        panX = Math.max(-maxPanX, Math.min(maxPanX, panX));
        panY = Math.max(-maxPanY, Math.min(maxPanY, panY));
      };

      const desenhar = () => {
        ctx.clearRect(0, 0, 300, 300);
        ctx.save();
        ctx.translate(150 + panX, 150 + panY);
        ctx.rotate((rotacao * Math.PI) / 180);
        const drawW = img.width * (baseScale * zoom);
        const drawH = img.height * (baseScale * zoom);
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
      };

      calcularBaseScale();
      zoomSlider.value = '1';
      desenhar();

      // Drag / Pan com Pointer Events
      let arrastando = false;
      let startX = 0, startY = 0;
      let initialPanX = 0, initialPanY = 0;

      canvas.onpointerdown = (ev) => {
        arrastando = true;
        canvas.setPointerCapture(ev.pointerId);
        startX = ev.clientX;
        startY = ev.clientY;
        initialPanX = panX;
        initialPanY = panY;
      };

      canvas.onpointermove = (ev) => {
        if (!arrastando) return;
        panX = initialPanX + (ev.clientX - startX);
        panY = initialPanY + (ev.clientY - startY);
        limitarLimites();
        desenhar();
      };

      canvas.onpointerup = canvas.onpointercancel = () => {
        arrastando = false;
      };

      // Zoom via slider
      zoomSlider.oninput = () => {
        zoom = parseFloat(zoomSlider.value) || 1;
        limitarLimites();
        desenhar();
      };

      // Zoom via botões +/-
      btnZoomMais.onclick = () => {
        zoom = Math.min(3, zoom + 0.15);
        zoomSlider.value = zoom.toString();
        limitarLimites();
        desenhar();
      };

      btnZoomMenos.onclick = () => {
        zoom = Math.max(1, zoom - 0.15);
        zoomSlider.value = zoom.toString();
        limitarLimites();
        desenhar();
      };

      // Zoom via Scroll Wheel
      canvas.onwheel = (ev) => {
        ev.preventDefault();
        const delta = ev.deltaY < 0 ? 0.08 : -0.08;
        zoom = Math.max(1, Math.min(3, zoom + delta));
        zoomSlider.value = zoom.toString();
        limitarLimites();
        desenhar();
      };

      // Girar 90 graus
      btnGirar.onclick = () => {
        rotacao = (rotacao + 90) % 360;
        calcularBaseScale();
        limitarLimites();
        desenhar();
      };

      // Centralizar
      btnCentralizar.onclick = () => {
        panX = 0;
        panY = 0;
        zoom = 1;
        zoomSlider.value = '1';
        desenhar();
      };

      const fecharModal = () => {
        modal.classList.remove('aberto');
        modal.setAttribute('aria-hidden', 'true');
        canvas.onpointerdown = null;
        canvas.onpointermove = null;
        canvas.onpointerup = null;
        canvas.onwheel = null;
      };

      btnCancelar.onclick = () => {
        fecharModal();
        if (typeof onCancelar === 'function') onCancelar();
      };

      btnFechar.onclick = () => {
        fecharModal();
        if (typeof onCancelar === 'function') onCancelar();
      };

      // Confirmar corte e exportar Canvas 1:1 de alta fidelidade
      btnConfirmar.onclick = () => {
        const tamanhoExportacao = Math.min(1000, Math.max(600, Math.min(img.width, img.height)));
        const outCanvas = document.createElement('canvas');
        outCanvas.width = tamanhoExportacao;
        outCanvas.height = tamanhoExportacao;
        const outCtx = outCanvas.getContext('2d');
        outCtx.imageSmoothingQuality = 'high';

        const fator = tamanhoExportacao / 300;
        outCtx.translate(tamanhoExportacao / 2 + panX * fator, tamanhoExportacao / 2 + panY * fator);
        outCtx.rotate((rotacao * Math.PI) / 180);
        const finalW = img.width * (baseScale * zoom) * fator;
        const finalH = img.height * (baseScale * zoom) * fator;
        outCtx.drawImage(img, -finalW / 2, -finalH / 2, finalW, finalH);

        outCanvas.toBlob((blob) => {
          if (!blob) {
            mostrarToast('Erro ao processar corte da foto.', 'erro');
            return;
          }
          const nomeOriginal = (arquivo.name || 'foto').replace(/\.[^/.]+$/, '');
          const arquivoRecortado = new File([blob], `${nomeOriginal}_quadrado.jpg`, { type: 'image/jpeg' });
          const previewUrl = outCanvas.toDataURL('image/jpeg', 0.92);
          fecharModal();
          if (typeof onConfirmar === 'function') onConfirmar(arquivoRecortado, previewUrl);
        }, 'image/jpeg', 0.92);
      };

      modal.classList.add('aberto');
      modal.setAttribute('aria-hidden', 'false');
    };
    img.src = e.target.result;
  };
  leitor.readAsDataURL(arquivo);
}

// ============================================
// CARREGAMENTO SEGURO DA FOTO (3s MÁXIMO)
// ============================================
function verificarECarregarAvatar(avatarUrl, nome, inicial, usuario, perfil) {
  const preview = document.getElementById('contaAvatarPreview');
  const acoesContainer = document.getElementById('avatarAcoes');
  const loading = document.getElementById('avatarLoading');
  if (!preview) return;

  // Garante monograma com inicial limpo imediatamente
  preview.innerHTML = `<span class="avatar-inicial" id="avatarInicial">${escapeHtml(inicial)}</span>`;
  configurarCliqueVisualizadorAvatar(preview, null, null);
  if (acoesContainer) acoesContainer.innerHTML = '';

  // Se não há url definida, deixa sem foto
  if (!avatarUrl || typeof avatarUrl !== 'string' || !avatarUrl.trim()) {
    if (loading) loading.hidden = true;
    return;
  }

  // Mostra indicador de carregamento discreto por até 3 segundos
  if (loading) {
    loading.hidden = false;
    preview.appendChild(loading);
  }

  let finalizado = false;
  const imgTeste = new Image();

  const desistirSemFoto = () => {
    if (finalizado) return;
    finalizado = true;
    imgTeste.onload = null;
    imgTeste.onerror = null;
    imgTeste.src = '';
    if (loading) loading.hidden = true;
    preview.innerHTML = `<span class="avatar-inicial" id="avatarInicial">${escapeHtml(inicial)}</span>`;
    configurarCliqueVisualizadorAvatar(preview, null, null);
    if (acoesContainer) acoesContainer.innerHTML = '';
    if (typeof aplicarAvatarAoBotaoConta === 'function') aplicarAvatarAoBotaoConta(null);
  };

  // Timeout estrito de 3 segundos
  const timerLimite = setTimeout(() => {
    console.warn('Foto de perfil não respondeu em 3 segundos. Exibindo monograma padrão.');
    desistirSemFoto();
  }, 3000);

  imgTeste.onload = () => {
    if (finalizado) return;
    finalizado = true;
    clearTimeout(timerLimite);
    if (loading) loading.hidden = true;
    preview.innerHTML = `<img src="${escapeHtml(avatarUrl)}" alt="Foto de ${escapeHtml(nome)}" class="avatar-img" id="avatarImg">`;
    configurarCliqueVisualizadorAvatar(preview, avatarUrl, nome);
    if (typeof aplicarAvatarAoBotaoConta === 'function') aplicarAvatarAoBotaoConta(avatarUrl);
    if (acoesContainer) {
      acoesContainer.innerHTML = `
        <button type="button" id="btnRemoverFoto" class="btn-remover-foto" title="Remover foto de perfil" aria-label="Remover foto de perfil">
          <span class="material-symbols-outlined">delete</span>
          <span>Remover foto</span>
        </button>
      `;
      configurarBotaoRemoverFoto(usuario, perfil);
    }
  };

  imgTeste.onerror = () => {
    clearTimeout(timerLimite);
    desistirSemFoto();
  };

  imgTeste.src = avatarUrl;
}

// ============================================
// UPLOAD E GERENCIAMENTO DE FOTO DE PERFIL COM RECORTE QUADRADO
// ============================================
function configurarUploadFotoPerfil(usuario, perfil) {
  const input = document.getElementById('inputFotoPerfil');
  const preview = document.getElementById('contaAvatarPreview');
  const loading = document.getElementById('avatarLoading');
  const acoesContainer = document.getElementById('avatarAcoes');

  if (!input) return;

  input.addEventListener('change', async (e) => {
    const arquivoOriginal = e.target.files?.[0];
    if (!arquivoOriginal) return;

    // 1. Validações de segurança do arquivo
    const formatosValidos = ['image/jpeg', 'image/png', 'image/webp'];
    if (!formatosValidos.includes(arquivoOriginal.type)) {
      mostrarToast('Por favor, selecione uma imagem nos formatos JPG, PNG ou WEBP.', 'erro');
      input.value = '';
      return;
    }

    const TAMANHO_MAX_BYTES = 12 * 1024 * 1024; // Até 12MB antes do recorte
    if (arquivoOriginal.size > TAMANHO_MAX_BYTES) {
      mostrarToast('A foto selecionada deve ter no máximo 12MB.', 'erro');
      input.value = '';
      return;
    }

    // Abre o cortador de foto interativo quadrado (1:1)
    abrirModalCortadorFoto({
      arquivo: arquivoOriginal,
      titulo: 'Ajustar Foto de Perfil',
      onCancelar: () => {
        input.value = '';
      },
      onConfirmar: async (arquivoRecortado) => {
        try {
          if (loading) {
            loading.hidden = false;
            preview.appendChild(loading);
          }
          mostrarToast('Enviando foto de perfil...', 'info');

          const nomeLimpo = `avatar_${Date.now()}.jpg`;
          const bucketDestino = typeof BUCKET_AVATARES !== 'undefined' ? BUCKET_AVATARES : 'fotos-perfil';
          const caminhoStorage = `${usuario.id}/${nomeLimpo}`;

          // 2. Upload para o storage da imagem já recortada quadrada
          let { data: uploadData, error: uploadError } = await db.storage
            .from(bucketDestino)
            .upload(caminhoStorage, arquivoRecortado, {
              cacheControl: '3600',
              upsert: true
            });

          // Fallback automático caso o bucket exclusivo 'fotos-perfil' não exista ainda
          let bucketUsado = bucketDestino;
          if (uploadError && uploadError.message?.toLowerCase().includes('bucket not found')) {
            console.warn(`Bucket ${bucketDestino} não encontrado, tentando fallback no bucket produtos...`);
            bucketUsado = typeof BUCKET_PRODUTOS !== 'undefined' ? BUCKET_PRODUTOS : 'produtos';
            const caminhoFallback = `avatars/${usuario.id}/${nomeLimpo}`;
            const resFallback = await db.storage
              .from(bucketUsado)
              .upload(caminhoFallback, arquivoRecortado, { cacheControl: '3600', upsert: true });
            uploadData = resFallback.data;
            uploadError = resFallback.error;
          }

          if (uploadError) {
            console.error('Erro no upload de avatar:', uploadError);
            mostrarToast('Erro ao enviar foto: ' + uploadError.message, 'erro');
            if (loading) loading.hidden = true;
            input.value = '';
            return;
          }

          // 3. Obter URL pública
          const caminhoFinal = bucketUsado === bucketDestino ? caminhoStorage : `avatars/${usuario.id}/${nomeLimpo}`;
          const { data: urlData } = db.storage
            .from(bucketUsado)
            .getPublicUrl(caminhoFinal);

          const novaUrl = urlData?.publicUrl;
          if (!novaUrl) {
            throw new Error('Não foi possível obter o link público da foto');
          }

          // 4. Salva nos metadados do Auth
          await db.auth.updateUser({
            data: { avatar_url: novaUrl }
          });

          // 5. Tenta salvar na tabela perfis
          try {
            await db.from('perfis').update({ avatar_url: novaUrl }).eq('id', usuario.id);
          } catch (errDb) {
            console.warn('Coluna avatar_url não presente na tabela perfis (salvo no auth metadata):', errDb);
          }

          // 6. Atualiza o estado em memória e a interface
          perfil.avatar_url = novaUrl;
          preview.innerHTML = `<img src="${escapeHtml(novaUrl)}" alt="Foto de perfil" class="avatar-img" id="avatarImg">`;
          configurarCliqueVisualizadorAvatar(preview, novaUrl, perfil.nome || usuario.email);
          if (loading) loading.hidden = true;
          if (typeof aplicarAvatarAoBotaoConta === 'function') aplicarAvatarAoBotaoConta(novaUrl);

          // Adiciona botão de remover
          if (acoesContainer) {
            acoesContainer.innerHTML = `
              <button type="button" id="btnRemoverFoto" class="btn-remover-foto" title="Remover foto de perfil" aria-label="Remover foto de perfil">
                <span class="material-symbols-outlined">delete</span>
                <span>Remover foto</span>
              </button>
            `;
            configurarBotaoRemoverFoto(usuario, perfil);
          }

          mostrarToast('Foto de perfil atualizada com sucesso!', 'sucesso');
        } catch (errGeral) {
          console.error('Erro no upload da foto:', errGeral);
          mostrarToast('Ocorreu um erro ao atualizar a foto de perfil.', 'erro');
          if (loading) loading.hidden = true;
        } finally {
          input.value = '';
        }
      }
    });
  });

  configurarBotaoRemoverFoto(usuario, perfil);
}

function configurarBotaoRemoverFoto(usuario, perfil) {
  const btnRemover = document.getElementById('btnRemoverFoto');
  const preview = document.getElementById('contaAvatarPreview');
  const loading = document.getElementById('avatarLoading');
  const acoesContainer = document.getElementById('avatarAcoes');

  if (!btnRemover) return;

  btnRemover.addEventListener('click', async () => {
    if (!confirm('Deseja realmente remover sua foto de perfil?')) return;

    try {
      if (loading) {
        loading.hidden = false;
        preview.appendChild(loading);
      }

      // Remove do user_metadata
      await db.auth.updateUser({
        data: { avatar_url: null }
      });

      // Tenta remover da tabela perfis
      try {
        await db.from('perfis').update({ avatar_url: null }).eq('id', usuario.id);
      } catch (e) {
        console.warn('Erro ao atualizar perfis:', e);
      }

      perfil.avatar_url = null;
      const inicial = (perfil.nome || 'Cliente').charAt(0).toUpperCase() || 'U';

      preview.innerHTML = `<span class="avatar-inicial" id="avatarInicial">${escapeHtml(inicial)}</span>`;
      configurarCliqueVisualizadorAvatar(preview, null, null);
      if (loading) loading.hidden = true;

      if (acoesContainer) acoesContainer.innerHTML = '';
      if (typeof aplicarAvatarAoBotaoConta === 'function') aplicarAvatarAoBotaoConta(null);

      mostrarToast('Foto de perfil removida com sucesso!', 'sucesso');
    } catch (err) {
      console.error('Erro ao remover foto:', err);
      mostrarToast('Erro ao remover foto de perfil.', 'erro');
      if (loading) loading.hidden = true;
    }
  });
}

// ============================================
// Roteador de Seções
// ============================================
async function carregarSecao(rota, usuario, perfil) {
  const area = document.getElementById('areaConteudo');
  if (!area) return;
  area.innerHTML = '<div class="cartao"><div class="spinner"></div></div>';

  if (rota === 'perfil') renderizarPerfil(area, usuario, perfil);
  else if (rota === 'pedidos') renderizarMeusPedidos(area, usuario);
  else if (rota === 'admin') renderizarPainelAdmin(area, perfil);
}

// =========================================================
// SEÇÃO: MEUS DADOS (PERFIL)
// =========================================================
function renderizarPerfil(area, usuario, perfil) {
  area.innerHTML = `
    <div class="cartao">
      <div class="secao-cabecalho" style="margin-bottom: 20px;">
        <h3>Meus dados</h3>
        <p style="color: var(--marrom-claro); font-size: 0.9rem;">Atualize suas informações para entrega e contato.</p>
      </div>
      <form id="formPerfil">
        <div class="campo-linha">
          <div class="campo">
            <label for="nomePerfil">Nome completo</label>
            <input type="text" id="nomePerfil" value="${escapeHtml(perfil?.nome || '')}" required maxlength="100">
          </div>
          <div class="campo">
            <label for="telefonePerfil">Telefone / WhatsApp</label>
            <input type="tel" id="telefonePerfil" value="${escapeHtml(perfil?.telefone || '')}" placeholder="(00) 00000-0000" required maxlength="20">
          </div>
        </div>
        <div class="campo">
          <label for="emailPerfil">E-mail da conta</label>
          <input type="email" id="emailPerfil" value="${escapeHtml(usuario.email)}" disabled>
        </div>
        <div class="campo-linha">
          <div class="campo">
            <label for="cepPerfil">CEP</label>
            <input type="text" id="cepPerfil" value="${escapeHtml(perfil?.cep || '')}" placeholder="00000-000" maxlength="10">
          </div>
          <div class="campo">
            <label for="bairroPerfil">Bairro</label>
            <input type="text" id="bairroPerfil" value="${escapeHtml(perfil?.bairro || '')}" maxlength="60">
          </div>
        </div>
        <div class="campo-linha">
          <div class="campo">
            <label for="logradouroPerfil">Rua / Endereço</label>
            <input type="text" id="logradouroPerfil" value="${escapeHtml(perfil?.logradouro || '')}" maxlength="120">
          </div>
          <div class="campo">
            <label for="numeroPerfil">Número</label>
            <input type="text" id="numeroPerfil" value="${escapeHtml(perfil?.numero || '')}" maxlength="20">
          </div>
        </div>
        <div class="campo">
          <label for="complementoPerfil">Complemento (opcional)</label>
          <input type="text" id="complementoPerfil" value="${escapeHtml(perfil?.complemento || '')}" placeholder="Apto, bloco, ponto de referência" maxlength="100">
        </div>
        <button type="submit" class="btn btn-primario" id="btnSalvarPerfil">
          <span class="material-symbols-outlined">save</span> Salvar alterações
        </button>
      </form>
    </div>
  `;

  document.getElementById('formPerfil').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSalvarPerfil');
    btn.disabled = true;

    const dados = {
      nome: document.getElementById('nomePerfil').value.trim(),
      telefone: document.getElementById('telefonePerfil').value.trim(),
      cep: document.getElementById('cepPerfil').value.trim(),
      bairro: document.getElementById('bairroPerfil').value.trim(),
      logradouro: document.getElementById('logradouroPerfil').value.trim(),
      numero: document.getElementById('numeroPerfil').value.trim(),
      complemento: document.getElementById('complementoPerfil').value.trim()
    };

    // Atualiza metadados do auth para persistência segura
    await db.auth.updateUser({
      data: { nome: dados.nome, telefone: dados.telefone }
    });

    const { error } = await db.from('perfis').update(dados).eq('id', usuario.id);
    btn.disabled = false;

    if (error) {
      console.error('Erro ao salvar perfil:', error);
      mostrarToast('Erro ao salvar alterações: ' + error.message, 'erro');
    } else {
      mostrarToast('Dados atualizados com sucesso!', 'sucesso');
      perfil.nome = dados.nome;
      perfil.telefone = dados.telefone;
      const elNome = document.querySelector('.perfil-nome');
      if (elNome) elNome.textContent = dados.nome;
      const elInicial = document.getElementById('avatarInicial');
      if (elInicial) elInicial.textContent = dados.nome.charAt(0).toUpperCase();
    }
  });
}

// =========================================================
// =========================================================
// SEÇÃO: MEUS PEDIDOS & DETALHAMENTO
// =========================================================
let MEUS_PEDIDOS_CACHE = [];

async function renderizarMeusPedidos(area, usuario) {
  let pedidos = [];
  try {
    const { data, error } = await db
      .from('pedidos')
      .select('*, itens_pedido(*)')
      .eq('cliente_id', usuario.id)
      .order('criado_em', { ascending: false });

    if (!error && data) pedidos = data;
  } catch (e) {
    console.warn('Erro ao carregar pedidos:', e);
  }

  MEUS_PEDIDOS_CACHE = pedidos;

  if (pedidos.length === 0) {
    area.innerHTML = `
      <div class="cartao vazio">
        <span class="material-symbols-outlined vazio-icone">receipt_long</span>
        <h3>Você ainda não fez nenhum pedido</h3>
        <p>Explore o catálogo e monte sua encomenda com receitas caseiras.</p>
        <a href="catalogo.html" class="btn btn-primario">
          <span class="material-symbols-outlined">storefront</span> Ver catálogo
        </a>
      </div>
    `;
    return;
  }

  const htmlPedidos = pedidos.map((p, index) => {
    const status = STATUS_INFO[p.status] || STATUS_INFO.aguardando_confirmacao;
    const listaItens = p.itens_pedido || p.itens || [];
    const numero = p.numero_pedido || (p.id ? `DB-${String(pedidos.length - index).padStart(2, '0')}` : 'DB-01');

    return `
      <div class="cartao-meu-pedido" data-pedido-id="${escapeHtml(p.id)}" style="cursor: pointer;">
        <div class="meu-pedido-icone">
          <span class="material-symbols-outlined">${status.icone}</span>
        </div>
        <div class="meu-pedido-detalhes">
          <div class="meu-pedido-cabecalho">
            <span class="meu-pedido-numero">Pedido ${escapeHtml(numero)}</span>
            <span class="badge ${status.classe}">${escapeHtml(status.rotulo)}</span>
            <span class="badge ${p.pago ? 'badge-sucesso' : 'badge-alerta'}" style="font-size:0.75rem;">
              ${p.pago ? '✓ Pago' : '⏳ Pagamento pendente'}
            </span>
          </div>
          <div class="meu-pedido-meta">
            ${escapeHtml(formatarData(p.data_agendada))} às ${escapeHtml(p.horario_agendado || '')} · 
            <strong>${p.tipo_entrega === 'entrega' ? 'Entrega em domicílio' : 'Retirada na loja'}</strong>
          </div>
          <div class="meu-pedido-itens">
            ${listaItens.map(i => `${Number(i.quantidade) || 1}x ${escapeHtml(i.nome || 'Produto')}`).join(', ')}
          </div>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
          <div class="meu-pedido-valor">
            ${formatarPreco(p.valor_total)}
          </div>
          <button type="button" class="btn btn-outline btn-sm btn-ver-detalhes" data-detalhe-id="${escapeHtml(p.id)}" style="padding:6px 14px; font-size:0.82rem; display:inline-flex; align-items:center; gap:5px; border-radius:999px;">
            <span class="material-symbols-outlined" style="font-size:16px;">receipt_long</span>
            Ver detalhes
          </button>
        </div>
      </div>
    `;
  }).join('');

  area.innerHTML = `
    <div class="cartao">
      <div class="secao-cabecalho" style="margin-bottom: 20px;">
        <h3>Histórico de Pedidos (${pedidos.length})</h3>
        <p style="color: var(--marrom-claro); font-size: 0.9rem;">Acompanhe o status e histórico de todas as suas encomendas.</p>
      </div>
      <div class="lista-meus-pedidos">
        ${htmlPedidos}
      </div>
    </div>
  `;

  area.querySelectorAll('.btn-ver-detalhes').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      abrirModalDetalhesPedido(btn.dataset.detalheId);
    });
  });

  area.querySelectorAll('.cartao-meu-pedido').forEach(card => {
    card.addEventListener('click', () => {
      abrirModalDetalhesPedido(card.dataset.pedidoId);
    });
  });
}

// =========================================================
// SEÇÃO: PAINEL ADMINISTRATIVO
// =========================================================
async function renderizarPainelAdmin(area, perfil) {
  if (perfil.role !== 'admin') {
    area.innerHTML = '<div class="cartao"><p>Acesso negado. Esta área é restrita aos administradores.</p></div>';
    return;
  }

  try {
    await Promise.all([
      db.from('produtos').select('*').order('criado_em', { ascending: false }).then(r => PRODUTOS_ADMIN = r.data || []),
      db.from('pedidos').select('*, perfis(nome, telefone), itens_pedido(*)').order('criado_em', { ascending: false }).then(r => PEDIDOS_ADMIN = r.data || [])
    ]);
  } catch (err) {
    console.error('Erro ao carregar dados do admin:', err);
  }

  area.innerHTML = `
    <div class="cartao" style="margin-bottom: 20px; padding: 12px 16px;">
      <div class="admin-tabs" id="adminTabs">
        <button class="btn btn-outline admin-tab-btn ativo" data-tab="visao-geral">Visão geral</button>
        <button class="btn btn-outline admin-tab-btn" data-tab="produtos">Produtos</button>
        <button class="btn btn-outline admin-tab-btn" data-tab="pedidos-admin">Gerenciar Pedidos</button>
        <button class="btn btn-outline admin-tab-btn" data-tab="pagamentos-admin">Histórico Financeiro</button>
      </div>
    </div>
    <div id="adminConteudoSecao"></div>
  `;

  const botoesTab = document.querySelectorAll('#adminTabs .admin-tab-btn');
  botoesTab.forEach(btn => {
    btn.addEventListener('click', () => {
      botoesTab.forEach(b => b.classList.remove('ativo'));
      btn.classList.add('ativo');
      carregarTabAdmin(btn.dataset.tab);
    });
  });

  carregarTabAdmin('visao-geral');
}

function carregarTabAdmin(tab) {
  const areaAdmin = document.getElementById('adminConteudoSecao');
  if (!areaAdmin) return;
  if (tab === 'visao-geral') renderizarVisaoGeralAdmin(areaAdmin);
  else if (tab === 'produtos') renderizarProdutosAdmin(areaAdmin);
  else if (tab === 'pedidos-admin') renderizarPedidosAdmin(areaAdmin);
  else if (tab === 'pagamentos-admin') renderizarPagamentosAdmin(areaAdmin);
}

function renderizarVisaoGeralAdmin(area) {
  const pendentes = PEDIDOS_ADMIN.filter(p => p.status === 'aguardando_confirmacao').length;
  const faturamento = PEDIDOS_ADMIN.filter(p => p.pago === true).reduce((s, p) => s + (Number(p.valor_total) || 0), 0);

  area.innerHTML = `
    <div class="stats-grade" style="margin-bottom: 24px;">
      <div class="cartao stat-cartao">
        <span class="material-symbols-outlined">receipt_long</span>
        <div class="stat-valor">${PEDIDOS_ADMIN.length}</div>
        <div class="stat-rotulo">Pedidos totais</div>
      </div>
      <div class="cartao stat-cartao">
        <span class="material-symbols-outlined">hourglass_empty</span>
        <div class="stat-valor">${pendentes}</div>
        <div class="stat-rotulo">Aguardando confirmação</div>
      </div>
      <div class="cartao stat-cartao">
        <span class="material-symbols-outlined">payments</span>
        <div class="stat-valor">${formatarPreco(faturamento)}</div>
        <div class="stat-rotulo">Faturamento (Pago)</div>
      </div>
      <div class="cartao stat-cartao">
        <span class="material-symbols-outlined">bakery_dining</span>
        <div class="stat-valor">${PRODUTOS_ADMIN.length}</div>
        <div class="stat-rotulo">Produtos cadastrados</div>
      </div>
    </div>

    <div class="cartao">
      <h3 style="margin-bottom:16px;">Últimos pedidos</h3>
      <div class="tabela-scroll">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Data</th>
              <th>Total</th>
              <th>Status</th>
              <th>Pagamento</th>
            </tr>
          </thead>
          <tbody>
            ${PEDIDOS_ADMIN.slice(0, 6).map(p => `
              <tr>
                <td><strong>${escapeHtml(p.perfis?.nome || 'Cliente')}</strong></td>
                <td>${escapeHtml(formatarData(p.data_agendada))}</td>
                <td><strong>${formatarPreco(p.valor_total)}</strong></td>
                <td><span class="badge ${STATUS_INFO[p.status]?.classe || 'badge-info'}">${escapeHtml(STATUS_INFO[p.status]?.rotulo || p.status)}</span></td>
                <td><span class="badge ${p.pago ? 'badge-sucesso' : 'badge-alerta'}">${p.pago ? 'Pago' : 'Pendente'}</span></td>
              </tr>
            `).join('')}
            ${PEDIDOS_ADMIN.length === 0 ? '<tr><td colspan="5" style="text-align:center; padding: 20px;">Nenhum pedido registrado ainda.</td></tr>' : ''}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderizarProdutosAdmin(area) {
  area.innerHTML = `
    <div class="cartao">
      <div class="tabela-topo">
        <h3>Produtos (${PRODUTOS_ADMIN.length})</h3>
        <button class="btn btn-primario" id="btnNovoProduto">
          <span class="material-symbols-outlined">add</span> Novo produto
        </button>
      </div>
      <div class="tabela-scroll">
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Preço</th>
              <th>Estoque</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${PRODUTOS_ADMIN.map(p => `
              <tr>
                <td>
                  <div class="tabela-produto-cel">
                    <img src="${escapeHtml(p.imagem_url || 'img/HeaderDonaBenta.png')}" alt="${escapeHtml(p.nome)}" onerror="this.src='img/HeaderDonaBenta.png'">
                    <div>
                      <strong>${escapeHtml(p.nome)}</strong>
                      <div style="font-size:0.8rem; color:var(--marrom-claro);">${escapeHtml(p.categoria || '')}</div>
                    </div>
                  </div>
                </td>
                <td><strong>${formatarPreco(p.preco)}</strong></td>
                <td>${p.estoque ?? '—'}</td>
                <td><span class="badge ${p.disponivel ? 'badge-sucesso' : 'badge-erro'}">${p.disponivel ? 'Disponível' : 'Indisponível'}</span></td>
                <td>
                  <div class="acoes-tabela">
                    <button class="acao-icone-btn" data-editar="${escapeHtml(p.id)}" title="Editar produto" aria-label="Editar">
                      <span class="material-symbols-outlined">edit</span>
                    </button>
                    <button class="acao-icone-btn excluir" data-excluir="${escapeHtml(p.id)}" title="Excluir produto" aria-label="Excluir">
                      <span class="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
            ${PRODUTOS_ADMIN.length === 0 ? '<tr><td colspan="5" style="text-align:center; padding: 20px;">Nenhum produto cadastrado.</td></tr>' : ''}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('btnNovoProduto').addEventListener('click', () => abrirModalProduto());
  area.querySelectorAll('[data-editar]').forEach(btn => btn.addEventListener('click', () => abrirModalProduto(btn.dataset.editar)));
  area.querySelectorAll('[data-excluir]').forEach(btn => btn.addEventListener('click', () => excluirProduto(btn.dataset.excluir)));
}

function renderizarPedidosAdmin(area) {
  area.innerHTML = `
    <div class="cartao">
      <div class="tabela-topo">
        <h3>Gerenciar Pedidos (${PEDIDOS_ADMIN.length})</h3>
      </div>
      <div class="tabela-scroll">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Agendamento</th>
              <th>Status do Pedido</th>
              <th>Pagamento</th>
              <th style="text-align:center;">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${PEDIDOS_ADMIN.map((p, idx) => {
              const numSeq = p.numero_pedido || (p.id ? `DB-${String(PEDIDOS_ADMIN.length - idx).padStart(2, '0')}` : 'DB-01');
              return `
              <tr>
                <td>
                  <span class="badge" style="font-size:0.72rem; background:var(--creme-escuro); color:var(--marrom); margin-bottom:4px; display:inline-block; font-weight:700;">${escapeHtml(numSeq)}</span><br>
                  <strong>${escapeHtml(p.perfis?.nome || 'Cliente')}</strong><br>
                  <span style="color:var(--marrom-claro); font-size:0.82rem;">${escapeHtml(p.perfis?.telefone || 'Sem telefone')}</span>
                </td>
                <td>
                  ${escapeHtml(formatarData(p.data_agendada))}<br>
                  <span style="color:var(--marrom-claro); font-size:0.82rem;">${escapeHtml(p.horario_agendado || '')} (${p.tipo_entrega === 'entrega' ? 'Entrega' : 'Retirada'})</span>
                </td>
                <td style="position: relative;">
                  ${(() => {
                    const statusInfo = STATUS_INFO[p.status] || STATUS_INFO.aguardando_confirmacao;
                    return `
                    <div class="custom-status-dropdown" data-pedido="${escapeHtml(p.id)}">
                      <button type="button" class="custom-status-trigger badge ${statusInfo.classe}" aria-haspopup="listbox" aria-expanded="false" aria-label="Status do pedido: ${escapeHtml(statusInfo.rotulo)}">
                        <span class="material-symbols-outlined status-icone">${escapeHtml(statusInfo.icone || 'circle')}</span>
                        <span class="status-texto">${escapeHtml(statusInfo.rotulo)}</span>
                        <span class="material-symbols-outlined status-chevron">expand_more</span>
                      </button>
                      <div class="custom-status-menu" role="listbox">
                        ${Object.entries(STATUS_INFO).map(([valor, info]) => {
                          const ehAtiva = p.status === valor || (!p.status && valor === 'aguardando_confirmacao');
                          return `
                          <div class="custom-status-opcao ${ehAtiva ? 'selecionada' : ''}" data-valor="${valor}" role="option" aria-selected="${ehAtiva}">
                            <span class="status-opcao-badge badge ${info.classe}">
                              <span class="material-symbols-outlined">${escapeHtml(info.icone || 'circle')}</span>
                            </span>
                            <span class="status-opcao-texto">${escapeHtml(info.rotulo)}</span>
                            ${ehAtiva ? '<span class="material-symbols-outlined status-check">check</span>' : ''}
                          </div>
                        `;
                        }).join('')}
                      </div>
                    </div>
                    `;
                  })()}
                </td>
                <td>
                  <button class="badge btn-pagamento ${p.pago ? 'badge-sucesso' : 'badge-alerta'}" data-pedido="${escapeHtml(p.id)}" data-pago="${Boolean(p.pago)}" title="Clique para alternar status do pagamento" style="cursor:pointer; border:none;">
                    ${p.pago ? 'Pago' : 'Pendente'}
                  </button>
                </td>
                <td style="text-align:center;">
                  <button type="button" class="btn btn-outline btn-sm btn-ver-detalhes-admin-pedidos" data-pedido="${escapeHtml(p.id)}" title="Ver detalhes completos do pedido" style="padding:5px 10px; font-size:0.78rem; display:inline-flex; align-items:center; gap:4px;">
                    <span class="material-symbols-outlined" style="font-size:15px;">receipt_long</span>
                    Detalhes
                  </button>
                </td>
              </tr>
            `;
            }).join('')}
            ${PEDIDOS_ADMIN.length === 0 ? '<tr><td colspan="5" style="text-align:center; padding: 20px;">Nenhum pedido encontrado.</td></tr>' : ''}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Listener para dropdown customizado de status do pedido
  area.querySelectorAll('.custom-status-dropdown').forEach(dropdown => {
    const trigger = dropdown.querySelector('.custom-status-trigger');
    const menu = dropdown.querySelector('.custom-status-menu');
    const pedidoId = dropdown.dataset.pedido;

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const estaAberto = dropdown.classList.contains('aberto');

      // Fecha outros dropdowns abertos
      document.querySelectorAll('.custom-status-dropdown.aberto').forEach(d => {
        if (d !== dropdown) {
          d.classList.remove('aberto');
          d.querySelector('.custom-status-trigger')?.setAttribute('aria-expanded', 'false');
          d.closest('tr')?.classList.remove('linha-com-dropdown-aberto');
        }
      });

      if (!estaAberto) {
        // Verifica se há espaço suficiente abaixo da linha
        const rect = trigger.getBoundingClientRect();
        const espacoAbaixo = window.innerHeight - rect.bottom;
        if (espacoAbaixo < 240) {
          menu.classList.add('abrir-para-cima');
        } else {
          menu.classList.remove('abrir-para-cima');
        }

        dropdown.classList.add('aberto');
        trigger.setAttribute('aria-expanded', 'true');
        dropdown.closest('tr')?.classList.add('linha-com-dropdown-aberto');
      } else {
        dropdown.classList.remove('aberto');
        trigger.setAttribute('aria-expanded', 'false');
        dropdown.closest('tr')?.classList.remove('linha-com-dropdown-aberto');
      }
    });

    // Clique nas opções do dropdown
    menu.querySelectorAll('.custom-status-opcao').forEach(opcao => {
      opcao.addEventListener('click', async (e) => {
        e.stopPropagation();
        const novoValor = opcao.dataset.valor;
        const pedido = PEDIDOS_ADMIN.find(p => p.id === pedidoId);
        const valorAntigo = pedido ? pedido.status : null;

        // Fecha o menu
        dropdown.classList.remove('aberto');
        trigger.setAttribute('aria-expanded', 'false');
        dropdown.closest('tr')?.classList.remove('linha-com-dropdown-aberto');

        if (novoValor === valorAntigo) return;

        const infoNovo = STATUS_INFO[novoValor];
        if (!infoNovo) return;

        // Feedback de carregamento no trigger
        const iconeEl = trigger.querySelector('.status-icone');
        const textoEl = trigger.querySelector('.status-texto');
        const iconeOriginal = iconeEl.textContent;
        const textoOriginal = textoEl.textContent;

        trigger.classList.add('salvando');
        iconeEl.textContent = 'autorenew';
        iconeEl.classList.add('spin');

        const { error } = await db.from('pedidos').update({ status: novoValor }).eq('id', pedidoId);

        trigger.classList.remove('salvando');
        iconeEl.classList.remove('spin');

        if (error) {
          iconeEl.textContent = iconeOriginal;
          textoEl.textContent = textoOriginal;
          mostrarToast('Erro ao atualizar status: ' + error.message, 'erro');
        } else {
          // Atualiza dados locais
          if (pedido) pedido.status = novoValor;

          // Atualiza classes e conteúdo visual do trigger
          Object.values(STATUS_INFO).forEach(s => trigger.classList.remove(s.classe));
          trigger.classList.add(infoNovo.classe);
          iconeEl.textContent = infoNovo.icone || 'circle';
          textoEl.textContent = infoNovo.rotulo;
          trigger.setAttribute('aria-label', `Status do pedido: ${infoNovo.rotulo}`);

          // Atualiza os checks nas opções do menu
          menu.querySelectorAll('.custom-status-opcao').forEach(op => {
            const ehSelecionada = op.dataset.valor === novoValor;
            op.classList.toggle('selecionada', ehSelecionada);
            op.setAttribute('aria-selected', ehSelecionada);
            const check = op.querySelector('.status-check');
            if (ehSelecionada && !check) {
              op.insertAdjacentHTML('beforeend', '<span class="material-symbols-outlined status-check">check</span>');
            } else if (!ehSelecionada && check) {
              check.remove();
            }
          });

          mostrarToast('Status do pedido atualizado!', 'sucesso');
        }
      });
    });
  });

  // Fechar dropdowns ao clicar fora ou tecla Escape
  if (!window._fecharStatusDropdownsRegistrado) {
    window._fecharStatusDropdownsRegistrado = true;
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.custom-status-dropdown')) {
        document.querySelectorAll('.custom-status-dropdown.aberto').forEach(d => {
          d.classList.remove('aberto');
          d.querySelector('.custom-status-trigger')?.setAttribute('aria-expanded', 'false');
          d.closest('tr')?.classList.remove('linha-com-dropdown-aberto');
        });
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.custom-status-dropdown.aberto').forEach(d => {
          d.classList.remove('aberto');
          d.querySelector('.custom-status-trigger')?.setAttribute('aria-expanded', 'false');
          d.closest('tr')?.classList.remove('linha-com-dropdown-aberto');
        });
      }
    });
  }

  // Botão de alteração de pagamento
  const botoesPagamento = area.querySelectorAll('.btn-pagamento');
  botoesPagamento.forEach(btn => {
    btn.addEventListener('click', async () => {
      const pedidoId = btn.dataset.pedido;
      const estadoAtualPago = btn.dataset.pago === 'true';
      const novoEstadoPago = !estadoAtualPago;

      btn.style.opacity = '0.5';
      btn.disabled = true;

      const { error } = await db.from('pedidos').update({ pago: novoEstadoPago }).eq('id', pedidoId);
      if (error) {
        mostrarToast('Erro ao atualizar pagamento', 'erro');
        btn.style.opacity = '1';
        btn.disabled = false;
      } else {
        mostrarToast(novoEstadoPago ? 'Pedido marcado como Pago!' : 'Pedido marcado como Pendente!', 'sucesso');
        const pedido = PEDIDOS_ADMIN.find(p => p.id === pedidoId);
        if (pedido) pedido.pago = novoEstadoPago;

        btn.dataset.pago = String(novoEstadoPago);
        btn.className = `badge btn-pagamento ${novoEstadoPago ? 'badge-sucesso' : 'badge-alerta'}`;
        btn.textContent = novoEstadoPago ? 'Pago' : 'Pendente';
        btn.style.opacity = '1';
        btn.disabled = false;
      }
    });
  });

  // Listener para botões de detalhes do pedido no gerenciador
  area.querySelectorAll('.btn-ver-detalhes-admin-pedidos').forEach(btn => {
    btn.addEventListener('click', () => abrirModalDetalhesPedido(btn.dataset.pedido));
  });
}

// =========================================================
// SEÇÃO: HISTÓRICO DE COMPRAS E PAGAMENTOS (PAINEL ADMIN)
// =========================================================
function renderizarPagamentosAdmin(area) {
  const pixSvg = window.ICONE_PIX_SVG || '<span class="material-symbols-outlined">qr_code_2</span>';
  const whatsSvg = window.ICONE_WHATSAPP_SVG || '<span class="material-symbols-outlined">chat</span>';

  // Cálculo de KPIs
  const pagos = PEDIDOS_ADMIN.filter(p => p.pago === true);
  const totalFaturado = pagos.reduce((s, p) => s + (Number(p.valor_total) || 0), 0);

  const pagosPix = pagos.filter(p => (p.forma_pagamento || '').toLowerCase().includes('pix'));
  const totalPix = pagosPix.reduce((s, p) => s + (Number(p.valor_total) || 0), 0);

  const pagosCartao = pagos.filter(p => (p.forma_pagamento || '').toLowerCase().includes('cart'));
  const totalCartao = pagosCartao.reduce((s, p) => s + (Number(p.valor_total) || 0), 0);

  const pendentes = PEDIDOS_ADMIN.filter(p => !p.pago);
  const totalPendente = pendentes.reduce((s, p) => s + (Number(p.valor_total) || 0), 0);

  area.innerHTML = `
    <!-- KPIs Financeiros -->
    <div class="stats-grade" style="margin-bottom: 24px;">
      <div class="cartao stat-cartao">
        <span class="material-symbols-outlined" style="color:var(--sucesso);">payments</span>
        <div class="stat-valor" id="kpiTotalFaturado">${formatarPreco(totalFaturado)}</div>
        <div class="stat-rotulo" id="kpiRotuloFaturado">Faturamento Pago (${pagos.length} vendas)</div>
      </div>
      <div class="cartao stat-cartao">
        <span style="display:inline-flex; align-items:center; width:26px; height:26px; color:#00a650;">${pixSvg}</span>
        <div class="stat-valor" id="kpiTotalPix">${formatarPreco(totalPix)}</div>
        <div class="stat-rotulo" id="kpiRotuloPix">Recebido via Pix (${pagosPix.length})</div>
      </div>
      <div class="cartao stat-cartao">
        <span class="material-symbols-outlined" style="color:var(--dourado-escuro);">credit_card</span>
        <div class="stat-valor" id="kpiTotalCartao">${formatarPreco(totalCartao)}</div>
        <div class="stat-rotulo" id="kpiRotuloCartao">Recebido via Cartão (${pagosCartao.length})</div>
      </div>
      <div class="cartao stat-cartao">
        <span class="material-symbols-outlined" style="color:var(--alerta);">hourglass_top</span>
        <div class="stat-valor" id="kpiTotalPendente">${formatarPreco(totalPendente)}</div>
        <div class="stat-rotulo" id="kpiRotuloPendente">Aguardando Pagamento (${pendentes.length})</div>
      </div>
    </div>

    <!-- Tabela do Histórico Financeiro -->
    <div class="cartao">
      <div class="tabela-topo" style="margin-bottom: 16px;">
        <div>
          <h3>Histórico de Compras e Pagamentos (${PEDIDOS_ADMIN.length})</h3>
          <p style="color:var(--marrom-claro); font-size:0.88rem; margin:4px 0 0;">Relatório consolidado de transações, faturamento e conferência financeira.</p>
        </div>
        <button class="btn btn-outline btn-sm" id="btnImprimirFinanceiro" style="display:inline-flex; align-items:center; gap:6px;">
          <span class="material-symbols-outlined" style="font-size:18px;">receipt_long</span>
          Gerar Relatório Completo
        </button>
      </div>

      <!-- Barra de Filtros Interativa -->
      <div class="admin-filtros-barra">
        <input type="text" id="filtroTextoFinanceiro" class="campo-busca-admin" placeholder="Buscar por cliente, telefone ou nº do pedido (DB-XX)...">
        <select id="filtroStatusPagamento" class="admin-select-filtro">
          <option value="todos">Todos os pagamentos</option>
          <option value="pago">Somente Pagos</option>
          <option value="pendente">Somente Pendentes</option>
        </select>
        <select id="filtroMetodoPagamento" class="admin-select-filtro">
          <option value="todos">Todos os métodos</option>
          <option value="pix">Pix</option>
          <option value="cartao">Cartão de Crédito</option>
        </select>
      </div>

      <div class="tabela-scroll">
        <table>
          <thead>
            <tr>
              <th>Pedido & Data</th>
              <th>Cliente</th>
              <th>Valor Total</th>
              <th>Forma</th>
              <th>Status Pagamento</th>
              <th>Status Encomenda</th>
              <th style="text-align:center;">Ações</th>
            </tr>
          </thead>
          <tbody id="tbodyFinanceiro"></tbody>
        </table>
      </div>
    </div>
  `;

  function atualizarKPIsFinanceiro() {
    const pagosAtual = PEDIDOS_ADMIN.filter(p => p.pago === true);
    const totalFaturadoAtual = pagosAtual.reduce((s, p) => s + (Number(p.valor_total) || 0), 0);
    const pagosPixAtual = pagosAtual.filter(p => (p.forma_pagamento || '').toLowerCase().includes('pix'));
    const totalPixAtual = pagosPixAtual.reduce((s, p) => s + (Number(p.valor_total) || 0), 0);
    const pagosCartaoAtual = pagosAtual.filter(p => (p.forma_pagamento || '').toLowerCase().includes('cart'));
    const totalCartaoAtual = pagosCartaoAtual.reduce((s, p) => s + (Number(p.valor_total) || 0), 0);
    const pendentesAtual = PEDIDOS_ADMIN.filter(p => !p.pago);
    const totalPendenteAtual = pendentesAtual.reduce((s, p) => s + (Number(p.valor_total) || 0), 0);

    const elFat = document.getElementById('kpiTotalFaturado');
    if (elFat) elFat.textContent = formatarPreco(totalFaturadoAtual);
    const elRotFat = document.getElementById('kpiRotuloFaturado');
    if (elRotFat) elRotFat.textContent = `Faturamento Pago (${pagosAtual.length} vendas)`;

    const elPix = document.getElementById('kpiTotalPix');
    if (elPix) elPix.textContent = formatarPreco(totalPixAtual);
    const elRotPix = document.getElementById('kpiRotuloPix');
    if (elRotPix) elRotPix.textContent = `Recebido via Pix (${pagosPixAtual.length})`;

    const elCart = document.getElementById('kpiTotalCartao');
    if (elCart) elCart.textContent = formatarPreco(totalCartaoAtual);
    const elRotCart = document.getElementById('kpiRotuloCartao');
    if (elRotCart) elRotCart.textContent = `Recebido via Cartão (${pagosCartaoAtual.length})`;

    const elPend = document.getElementById('kpiTotalPendente');
    if (elPend) elPend.textContent = formatarPreco(totalPendenteAtual);
    const elRotPend = document.getElementById('kpiRotuloPendente');
    if (elRotPend) elRotPend.textContent = `Aguardando Pagamento (${pendentesAtual.length})`;
  }

  function renderLinhasFinanceiro() {
    const termo = (document.getElementById('filtroTextoFinanceiro')?.value || '').toLowerCase().trim();
    const filtroStatus = document.getElementById('filtroStatusPagamento')?.value || 'todos';
    const filtroMetodo = document.getElementById('filtroMetodoPagamento')?.value || 'todos';
    const tbody = document.getElementById('tbodyFinanceiro');
    if (!tbody) return;

    let lista = PEDIDOS_ADMIN;

    if (filtroStatus === 'pago') lista = lista.filter(p => p.pago === true);
    else if (filtroStatus === 'pendente') lista = lista.filter(p => !p.pago);

    if (filtroMetodo === 'pix') lista = lista.filter(p => (p.forma_pagamento || '').toLowerCase().includes('pix'));
    else if (filtroMetodo === 'cartao') lista = lista.filter(p => (p.forma_pagamento || '').toLowerCase().includes('cart'));

    if (termo) {
      lista = lista.filter(p => {
        const num = (p.numero_pedido || '').toLowerCase();
        const nome = (p.perfis?.nome || '').toLowerCase();
        const tel = (p.perfis?.telefone || '').toLowerCase();
        return num.includes(termo) || nome.includes(termo) || tel.includes(termo);
      });
    }

    if (lista.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 24px; color:var(--marrom-claro);">Nenhum pagamento ou compra encontrada para os filtros selecionados.</td></tr>';
      return;
    }

    tbody.innerHTML = lista.map((p, idx) => {
      const numSeq = p.numero_pedido || (p.id ? `DB-${String(PEDIDOS_ADMIN.length - idx).padStart(2, '0')}` : 'DB-01');
      const ehPix = (p.forma_pagamento || '').toLowerCase().includes('pix');
      const dataCriacao = p.criado_em ? formatarDataHora(p.criado_em) : `${formatarData(p.data_agendada)} às ${p.horario_agendado || ''}`;
      const statusInfo = STATUS_INFO[p.status] || STATUS_INFO.aguardando_confirmacao;
      const telLimpo = (p.perfis?.telefone || '').replace(/\D/g, '');

      return `
        <tr id="linhaFinanceiro-${escapeHtml(p.id)}">
          <td>
            <span class="badge" style="background:var(--creme-escuro); color:var(--marrom); font-weight:700; font-size:0.75rem;">${escapeHtml(numSeq)}</span><br>
            <span style="font-size:0.78rem; color:var(--marrom-claro);">${escapeHtml(dataCriacao)}</span>
          </td>
          <td>
            <strong>${escapeHtml(p.perfis?.nome || 'Cliente')}</strong><br>
            <span style="font-size:0.8rem; color:var(--marrom-claro);">${escapeHtml(p.perfis?.telefone || 'Sem telefone')}</span>
          </td>
          <td>
            <strong style="font-size:0.95rem; color:var(--dourado-escuro); font-family:var(--fonte-display);">${formatarPreco(p.valor_total)}</strong>
          </td>
          <td>
            <span class="badge" style="background:rgba(107, 66, 38, 0.08); color:var(--marrom); display:inline-flex; align-items:center; gap:5px; font-size:0.78rem;">
              ${ehPix
                ? `<span style="display:inline-flex; align-items:center; width:15px; height:15px;">${pixSvg}</span>`
                : '<span class="material-symbols-outlined" style="font-size:15px;">credit_card</span>'
              }
              ${escapeHtml(p.forma_pagamento || 'Pix')}
            </span>
          </td>
          <td>
            <button class="badge btn-pagamento-financeiro ${p.pago ? 'badge-sucesso' : 'badge-alerta'}" data-pedido="${escapeHtml(p.id)}" data-pago="${Boolean(p.pago)}" title="Clique para alternar status do pagamento">
              ${p.pago ? 'Pago' : 'Pendente'}
            </button>
          </td>
          <td>
            <span class="badge ${statusInfo.classe}">${escapeHtml(statusInfo.rotulo)}</span>
          </td>
          <td style="text-align:center;">
            <div style="display:inline-flex; gap:6px; align-items:center;">
              <button class="btn btn-outline btn-sm btn-ver-detalhes-financeiro" data-pedido="${escapeHtml(p.id)}" title="Ver detalhamento do pedido" style="padding:5px 10px; font-size:0.78rem; display:inline-flex; align-items:center; gap:4px;">
                <span class="material-symbols-outlined" style="font-size:15px;">receipt_long</span>
                Detalhes
              </button>
              ${telLimpo ? `
                <a href="https://api.whatsapp.com/send?phone=55${telLimpo}&text=Ol%C3%A1%20${encodeURIComponent(p.perfis?.nome || 'Cliente')}!%20Aqui%20%C3%A9%20da%20Dona%20Benta%20sobre%20o%20seu%20pedido%20${encodeURIComponent(numSeq)}." target="_blank" rel="noopener noreferrer" class="acao-icone-btn" title="Conversar no WhatsApp" style="color:#25D366; display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px; border-radius:50%; background:rgba(37,211,102,0.1);">
                  <span style="display:inline-flex; align-items:center; width:17px; height:17px;">${whatsSvg}</span>
                </a>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-ver-detalhes-financeiro').forEach(btn => {
      btn.addEventListener('click', () => abrirModalDetalhesPedido(btn.dataset.pedido));
    });

    tbody.querySelectorAll('.btn-pagamento-financeiro').forEach(btn => {
      btn.addEventListener('click', async () => {
        const pedidoId = btn.dataset.pedido;
        const estadoAtualPago = btn.dataset.pago === 'true';
        const novoEstadoPago = !estadoAtualPago;

        btn.style.opacity = '0.5';
        btn.disabled = true;

        const { error } = await db.from('pedidos').update({ pago: novoEstadoPago }).eq('id', pedidoId);
        if (error) {
          mostrarToast('Erro ao atualizar pagamento', 'erro');
          btn.style.opacity = '1';
          btn.disabled = false;
        } else {
          mostrarToast(novoEstadoPago ? 'Pagamento marcado como Pago!' : 'Pagamento marcado como Pendente!', 'sucesso');
          const pedido = PEDIDOS_ADMIN.find(p => p.id === pedidoId);
          if (pedido) pedido.pago = novoEstadoPago;

          // Atualização direta e suave sem saltos de layout
          btn.dataset.pago = String(novoEstadoPago);
          btn.className = `badge btn-pagamento-financeiro ${novoEstadoPago ? 'badge-sucesso' : 'badge-alerta'}`;
          btn.textContent = novoEstadoPago ? 'Pago' : 'Pendente';
          btn.style.opacity = '1';
          btn.disabled = false;

          atualizarKPIsFinanceiro();
        }
      });
    });
  }

  document.getElementById('filtroTextoFinanceiro')?.addEventListener('input', renderLinhasFinanceiro);
  document.getElementById('filtroStatusPagamento')?.addEventListener('change', renderLinhasFinanceiro);
  document.getElementById('filtroMetodoPagamento')?.addEventListener('change', renderLinhasFinanceiro);
  document.getElementById('btnImprimirFinanceiro')?.addEventListener('click', () => {
    const termo = (document.getElementById('filtroTextoFinanceiro')?.value || '').trim();
    const filtroStatus = document.getElementById('filtroStatusPagamento')?.value || 'todos';
    const filtroMetodo = document.getElementById('filtroMetodoPagamento')?.value || 'todos';
    abrirRelatorioFinanceiroElaborado({ termo, filtroStatus, filtroMetodo });
  });

  renderLinhasFinanceiro();
}

// =========================================================
// RELATÓRIO FINANCEIRO ELABORADO (MODAL & IMPRESSÃO PRECISA)
// =========================================================
function injectarModalRelatorioFinanceiro() {
  if (document.getElementById('modalRelatorioFinanceiro')) return;

  const modalHTML = `
    <div class="modal-overlay" id="modalRelatorioFinanceiro">
      <div class="modal-cartao" style="max-width: 900px; width: 95%; max-height: 90vh; display: flex; flex-direction: column;">
        <div class="modal-cabecalho no-print">
          <div>
            <h3 style="margin:0; font-size:1.25rem; display:flex; align-items:center; gap:8px;">
              <span class="material-symbols-outlined" style="color:var(--dourado-escuro);">receipt_long</span>
              Relatório Contábil & Financeiro
            </h3>
            <span style="font-size:0.82rem; color:var(--marrom-claro);">Visualização executiva para conferência de caixa e prestação de contas.</span>
          </div>
          <button class="modal-fechar" id="fecharModalRelatorio" aria-label="Fechar"><span class="material-symbols-outlined">close</span></button>
        </div>
        <div style="padding: 24px; overflow-y: auto; flex: 1;" id="conteudoRelatorioFinanceiro"></div>
        <div class="modal-rodape no-print" style="padding: 14px 24px; border-top: 1px solid rgba(107, 66, 38, 0.1); display:flex; gap:12px; justify-content:flex-end; background:var(--branco);">
          <button type="button" class="btn btn-primario" id="btnImprimirRelatorioAcao" style="display:inline-flex; align-items:center; gap:6px;">
            <span class="material-symbols-outlined" style="font-size:18px;">print</span>
            Imprimir / Salvar em PDF
          </button>
          <button type="button" class="btn btn-outline" id="btnFecharModalRelatorioAcao">
            Fechar
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  const fechar = () => {
    const modal = document.getElementById('modalRelatorioFinanceiro');
    if (modal) modal.classList.remove('aberto');
  };

  document.getElementById('fecharModalRelatorio')?.addEventListener('click', fechar);
  document.getElementById('btnFecharModalRelatorioAcao')?.addEventListener('click', fechar);
  document.getElementById('btnImprimirRelatorioAcao')?.addEventListener('click', () => window.print());
  document.getElementById('modalRelatorioFinanceiro')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalRelatorioFinanceiro') fechar();
  });
}

function abrirRelatorioFinanceiroElaborado(filtros = {}) {
  injectarModalRelatorioFinanceiro();

  const modal = document.getElementById('modalRelatorioFinanceiro');
  const corpo = document.getElementById('conteudoRelatorioFinanceiro');
  if (!modal || !corpo) return;

  let lista = Array.isArray(PEDIDOS_ADMIN) ? [...PEDIDOS_ADMIN] : [];

  if (filtros.filtroStatus === 'pago') lista = lista.filter(p => p.pago === true);
  else if (filtros.filtroStatus === 'pendente') lista = lista.filter(p => !p.pago);

  if (filtros.filtroMetodo === 'pix') lista = lista.filter(p => (p.forma_pagamento || '').toLowerCase().includes('pix'));
  else if (filtros.filtroMetodo === 'cartao') lista = lista.filter(p => (p.forma_pagamento || '').toLowerCase().includes('cart'));

  if (filtros.termo) {
    lista = lista.filter(p => {
      const num = (p.numero_pedido || '').toLowerCase();
      const nome = (p.perfis?.nome || '').toLowerCase();
      const tel = (p.perfis?.telefone || '').toLowerCase();
      return num.includes(filtros.termo.toLowerCase()) || nome.includes(filtros.termo.toLowerCase()) || tel.includes(filtros.termo.toLowerCase());
    });
  }

  const pagos = lista.filter(p => p.pago === true);
  const totalFaturado = pagos.reduce((s, p) => s + (Number(p.valor_total) || 0), 0);
  const pagosPix = pagos.filter(p => (p.forma_pagamento || '').toLowerCase().includes('pix'));
  const totalPix = pagosPix.reduce((s, p) => s + (Number(p.valor_total) || 0), 0);
  const pagosCartao = pagos.filter(p => (p.forma_pagamento || '').toLowerCase().includes('cart'));
  const totalCartao = pagosCartao.reduce((s, p) => s + (Number(p.valor_total) || 0), 0);
  const pendentes = lista.filter(p => !p.pago);
  const totalPendente = pendentes.reduce((s, p) => s + (Number(p.valor_total) || 0), 0);
  const ticketMedio = pagos.length > 0 ? (totalFaturado / pagos.length) : 0;

  const dataEmissao = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const horaEmissao = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  corpo.innerHTML = `
    <div id="relatorioFinanceiroDocumento" class="relatorio-financeiro-container">
      <!-- Cabeçalho Oficial -->
      <div class="relatorio-cabecalho-bloco">
        <div>
          <h2 class="relatorio-empresa-titulo">Dona Benta — Confeitaria & Padaria Artesanal</h2>
          <p class="relatorio-subtitulo">
            Rua Padre Anacleto, 1168 - Nova Rússia, Ponta Grossa - PR<br>
            Telefone / WhatsApp: (42) 99982-3994 · E-mail: contato@donabenta.com.br
          </p>
        </div>
        <div style="text-align:right;">
          <strong style="display:block; font-size:1rem; color:#6b4226; text-transform:uppercase;">Demonstrativo Financeiro</strong>
          <span style="font-size:0.8rem; color:#666;">Emissão: ${dataEmissao} às ${horaEmissao}</span><br>
          <span style="font-size:0.78rem; color:#888;">Escopo: ${lista.length} lançamentos consolidados</span>
        </div>
      </div>

      <!-- Resumo Executivo -->
      <div class="relatorio-kpis-grade">
        <div class="relatorio-kpi-item">
          <div class="relatorio-kpi-valor" style="color:#2b7c4d;">${formatarPreco(totalFaturado)}</div>
          <div class="relatorio-kpi-rotulo">Faturamento Pago (${pagos.length})</div>
        </div>
        <div class="relatorio-kpi-item">
          <div class="relatorio-kpi-valor" style="color:#00a650;">${formatarPreco(totalPix)}</div>
          <div class="relatorio-kpi-rotulo">Pix Recebido (${pagosPix.length})</div>
        </div>
        <div class="relatorio-kpi-item">
          <div class="relatorio-kpi-valor" style="color:#c57a2b;">${formatarPreco(totalCartao)}</div>
          <div class="relatorio-kpi-rotulo">Cartão Recebido (${pagosCartao.length})</div>
        </div>
        <div class="relatorio-kpi-item">
          <div class="relatorio-kpi-valor" style="color:#c54242;">${formatarPreco(totalPendente)}</div>
          <div class="relatorio-kpi-rotulo">Aguardando Pagamento (${pendentes.length})</div>
        </div>
        <div class="relatorio-kpi-item">
          <div class="relatorio-kpi-valor">${formatarPreco(ticketMedio)}</div>
          <div class="relatorio-kpi-rotulo">Ticket Médio por Venda</div>
        </div>
      </div>

      <!-- Tabela Financeira Analítica -->
      <table class="relatorio-tabela">
        <thead>
          <tr>
            <th>Nº Pedido</th>
            <th>Data / Agendamento</th>
            <th>Cliente & Contato</th>
            <th>Modalidade</th>
            <th>Forma</th>
            <th>Status Pgto</th>
            <th style="text-align:right;">Total (R$)</th>
          </tr>
        </thead>
        <tbody>
          ${lista.length > 0 ? lista.map((p, idx) => {
            const numSeq = p.numero_pedido || (p.id ? `DB-${String(PEDIDOS_ADMIN.length - idx).padStart(2, '0')}` : 'DB-01');
            const dataAgend = p.data_agendada ? `${formatarData(p.data_agendada)} ${p.horario_agendado || ''}` : formatarDataHora(p.criado_em);
            return `
              <tr>
                <td><strong>${escapeHtml(numSeq)}</strong></td>
                <td>${escapeHtml(dataAgend)}</td>
                <td>
                  <strong>${escapeHtml(p.perfis?.nome || 'Cliente')}</strong><br>
                  <span style="font-size:0.76rem; color:#666;">${escapeHtml(p.perfis?.telefone || 'Sem telefone')}</span>
                </td>
                <td>${p.tipo_entrega === 'entrega' ? 'Entrega em domicílio' : 'Retirada na loja'}</td>
                <td>${escapeHtml(p.forma_pagamento || 'Pix')}</td>
                <td>
                  <strong style="color: ${p.pago ? '#2b7c4d' : '#c54242'}; font-size:0.82rem;">
                    ${p.pago ? 'PAGO' : 'PENDENTE'}
                  </strong>
                </td>
                <td style="text-align:right; font-weight:700;">${formatarPreco(p.valor_total)}</td>
              </tr>
            `;
          }).join('') : '<tr><td colspan="7" style="text-align:center; padding:16px;">Nenhum registro encontrado.</td></tr>'}
        </tbody>
      </table>

      <!-- Rodapé de Auditoria e Assinatura -->
      <div class="relatorio-rodape-assinatura">
        <div>
          <span style="display:block; font-weight:600; color:#333;">Dona Benta Sistema de Gestão</span>
          <span>Relatório gerado em ambiente seguro · Conferência interna da confeitaria</span>
        </div>
        <div style="text-align:center; min-width: 250px;">
          <div style="border-top: 1px solid #333; padding-top: 6px; margin-top: 24px;">
            <span>Assinatura do Responsável</span>
          </div>
        </div>
      </div>
    </div>
  `;

  modal.classList.add('aberto');
}

// =========================================================
// MODAL: DETALHAMENTO DO PEDIDO (MEUS PEDIDOS & ADMIN)
// =========================================================
function injectarModalDetalhesPedido() {
  if (document.getElementById('modalDetalhesPedido')) return;

  const modalHTML = `
    <div class="modal-overlay" id="modalDetalhesPedido">
      <div class="modal-cartao modal-detalhes-cartao" style="max-width: 680px; width: 100%; max-height: 88vh; display: flex; flex-direction: column;">
        <div class="modal-cabecalho">
          <div>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px; flex-wrap:wrap;" id="modalDetalhesBadges"></div>
            <h3 id="modalDetalhesTitulo" style="margin:0; font-size:1.25rem;">Detalhes da Encomenda</h3>
          </div>
          <button class="modal-fechar" id="fecharModalDetalhes" aria-label="Fechar"><span class="material-symbols-outlined">close</span></button>
        </div>
        <div class="modal-detalhes-corpo" id="modalDetalhesCorpo"></div>
        <div style="padding: 14px 20px; border-top: 1px solid rgba(107, 66, 38, 0.1); display:flex; gap:10px; justify-content:space-between; flex-wrap:wrap; background:var(--branco);" id="modalDetalhesRodape"></div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  const fechar = () => {
    const modal = document.getElementById('modalDetalhesPedido');
    if (modal) modal.classList.remove('aberto');
  };

  document.getElementById('fecharModalDetalhes')?.addEventListener('click', fechar);
  document.getElementById('modalDetalhesPedido')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalDetalhesPedido') fechar();
  });
}

function abrirModalDetalhesPedido(pedidoId) {
  injectarModalDetalhesPedido();

  const pedido = (typeof PEDIDOS_ADMIN !== 'undefined' ? PEDIDOS_ADMIN.find(p => p.id === pedidoId) : null) ||
                 (typeof MEUS_PEDIDOS_CACHE !== 'undefined' ? MEUS_PEDIDOS_CACHE.find(p => p.id === pedidoId) : null);

  if (!pedido) {
    if (typeof mostrarToast === 'function') mostrarToast('Pedido não localizado', 'alerta');
    return;
  }

  const modal = document.getElementById('modalDetalhesPedido');
  const badgesArea = document.getElementById('modalDetalhesBadges');
  const corpo = document.getElementById('modalDetalhesCorpo');
  const rodape = document.getElementById('modalDetalhesRodape');
  if (!modal || !corpo) return;

  const statusInfo = STATUS_INFO[pedido.status] || STATUS_INFO.aguardando_confirmacao;

  // Cálculo rigoroso do código sequencial do pedido idêntico ao das tabelas
  let numero = pedido.numero_pedido;
  if (!numero) {
    if (typeof PEDIDOS_ADMIN !== 'undefined' && Array.isArray(PEDIDOS_ADMIN)) {
      const idx = PEDIDOS_ADMIN.findIndex(p => p.id === pedido.id);
      if (idx !== -1) {
        numero = `DB-${String(PEDIDOS_ADMIN.length - idx).padStart(2, '0')}`;
      }
    }
    if (!numero && typeof MEUS_PEDIDOS_CACHE !== 'undefined' && Array.isArray(MEUS_PEDIDOS_CACHE)) {
      const idx = MEUS_PEDIDOS_CACHE.findIndex(p => p.id === pedido.id);
      if (idx !== -1) {
        numero = `DB-${String(MEUS_PEDIDOS_CACHE.length - idx).padStart(2, '0')}`;
      }
    }
    if (!numero) {
      numero = 'DB-01';
    }
  }

  const itens = pedido.itens_pedido || pedido.itens || [];
  const telClienteLimpo = (pedido.perfis?.telefone || '').replace(/\D/g, '');
  const telClienteFormatado = pedido.perfis?.telefone || '';
  const pixSvg = window.ICONE_PIX_SVG || '<span class="material-symbols-outlined">qr_code_2</span>';
  const whatsSvg = window.ICONE_WHATSAPP_SVG || '<span class="material-symbols-outlined">chat</span>';

  // Badges sem emojis
  badgesArea.innerHTML = `
    <span class="badge" style="background:var(--creme-escuro); color:var(--marrom); font-weight:700; font-size:0.82rem;">${escapeHtml(numero)}</span>
    <span class="badge ${statusInfo.classe}">${escapeHtml(statusInfo.rotulo)}</span>
    <span class="badge ${pedido.pago ? 'badge-sucesso' : 'badge-alerta'}">${pedido.pago ? 'Pagamento Confirmado' : 'Aguardando Pagamento'}</span>
  `;

  document.getElementById('modalDetalhesTitulo').textContent = `Pedido ${numero}`;

  corpo.innerHTML = `
    <div class="detalhe-secao-bloco">
      <h4 style="font-size:0.95rem; margin-bottom:12px; color:var(--marrom); display:flex; align-items:center; gap:6px;">
        <span class="material-symbols-outlined" style="font-size:18px; color:var(--dourado-escuro);">schedule</span>
        Agendamento & Entrega
      </h4>
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:12px; font-size:0.88rem;">
        <div>
          <span style="color:var(--marrom-claro); display:block; font-size:0.78rem;">Modalidade</span>
          <strong>
            <span class="material-symbols-outlined" style="font-size:16px; vertical-align:middle; margin-right:4px;">${pedido.tipo_entrega === 'entrega' ? 'local_shipping' : 'storefront'}</span>
            ${pedido.tipo_entrega === 'entrega' ? 'Entrega no Endereço' : 'Retirada na Loja'}
          </strong>
        </div>
        <div>
          <span style="color:var(--marrom-claro); display:block; font-size:0.78rem;">Data & Horário</span>
          <strong>${formatarData(pedido.data_agendada)} às ${escapeHtml(pedido.horario_agendado || 'A combinar')}</strong>
        </div>
        ${pedido.tipo_entrega === 'entrega' && pedido.endereco_entrega ? `
          <div style="grid-column: 1 / -1;">
            <span style="color:var(--marrom-claro); display:block; font-size:0.78rem;">Endereço de Entrega</span>
            <strong style="word-break: break-word;">${escapeHtml(pedido.endereco_entrega)}</strong>
          </div>
        ` : `
          <div style="grid-column: 1 / -1;">
            <span style="color:var(--marrom-claro); display:block; font-size:0.78rem;">Local de Retirada</span>
            <strong>Rua Padre Anacleto, 1168 - Nova Rússia, Ponta Grossa - PR</strong>
          </div>
        `}
        ${pedido.perfis?.nome ? `
          <div>
            <span style="color:var(--marrom-claro); display:block; font-size:0.78rem;">Nome do Cliente</span>
            <strong>${escapeHtml(pedido.perfis.nome)}</strong>
          </div>
        ` : ''}
        ${telClienteFormatado ? `
          <div>
            <span style="color:var(--marrom-claro); display:block; font-size:0.78rem;">Telefone do Cliente</span>
            ${telClienteLimpo ? `
              <a href="https://api.whatsapp.com/send?phone=55${telClienteLimpo}&text=Ol%C3%A1%20${encodeURIComponent(pedido.perfis?.nome || 'Cliente')}!%20Aqui%20%C3%A9%20da%20Dona%20Benta%20sobre%20o%20seu%20pedido%20${encodeURIComponent(numero)}." target="_blank" rel="noopener noreferrer" style="color:#25d366; display:inline-flex; align-items:center; gap:5px; text-decoration:none; font-weight:700;">
                <span style="display:inline-flex; align-items:center; width:16px; height:16px;">${whatsSvg}</span>
                ${escapeHtml(telClienteFormatado)}
              </a>
            ` : `<strong>${escapeHtml(telClienteFormatado)}</strong>`}
          </div>
        ` : ''}
        ${pedido.criado_em ? `
          <div>
            <span style="color:var(--marrom-claro); display:block; font-size:0.78rem;">Data do Pedido</span>
            <span>${formatarDataHora(pedido.criado_em)}</span>
          </div>
        ` : ''}
      </div>
    </div>

    ${pedido.observacoes ? `
      <div class="detalhe-observacoes-bloco">
        <h4 style="font-size:0.92rem; margin-bottom:6px; color:var(--marrom); display:flex; align-items:center; gap:6px;">
          <span class="material-symbols-outlined" style="font-size:18px; color:var(--dourado-escuro);">edit_note</span>
          Observações do Pedido
        </h4>
        <p style="font-size:0.88rem; margin:0; color:var(--texto); font-style:italic; line-height:1.45;">
          "${escapeHtml(pedido.observacoes)}"
        </p>
      </div>
    ` : ''}

    <!-- Seção de Itens Totalmente Detalhada & com Rolagem Touch -->
    <div class="detalhe-secao-bloco">
      <h4 style="font-size:0.95rem; margin-bottom:12px; color:var(--marrom); display:flex; align-items:center; gap:6px;">
        <span class="material-symbols-outlined" style="font-size:18px; color:var(--dourado-escuro);">shopping_bag</span>
        Itens do Pedido (${itens.length})
      </h4>
      <div class="detalhe-itens-scroll">
        <table class="detalhe-tabela-itens" style="min-width: 520px;">
          <thead>
            <tr>
              <th style="width: 50px;">Item</th>
              <th>Descrição / Código</th>
              <th style="text-align:center; width: 60px;">Qtd</th>
              <th style="text-align:right; width: 90px;">Unitário</th>
              <th style="text-align:right; width: 100px;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itens.length > 0 ? itens.map(item => {
              const prodCatalogo = typeof PRODUTOS_ADMIN !== 'undefined' ? PRODUTOS_ADMIN.find(pr => pr.id === item.produto_id) : null;
              const foto = item.foto_url || prodCatalogo?.foto_url || null;
              const cat = item.categoria || prodCatalogo?.categoria || '';
              const cod = item.produto_id ? `#${String(item.produto_id).slice(0, 8).toUpperCase()}` : '#ARTESANAL';
              const qtd = Number(item.quantidade) || 1;
              const precoUnit = Number(item.preco) || 0;
              const sub = qtd * precoUnit;

              return `
                <tr>
                  <td style="padding: 8px 10px;">
                    ${foto ? `
                      <img src="${escapeHtml(foto)}" alt="${escapeHtml(item.nome || 'Produto')}" class="detalhe-item-img" onerror="this.onerror=null; this.outerHTML='<div class=\\'detalhe-item-img-placeholder\\'><span class=\\'material-symbols-outlined\\' style=\\'font-size:20px;\\'>bakery_dining</span></div>';">
                    ` : `
                      <div class="detalhe-item-img-placeholder">
                        <span class="material-symbols-outlined" style="font-size:20px;">bakery_dining</span>
                      </div>
                    `}
                  </td>
                  <td style="padding: 8px 10px;">
                    <strong style="color:var(--marrom); font-size:0.92rem;">${escapeHtml(item.nome || 'Produto')}</strong>
                    <div style="display:flex; align-items:center; gap:6px; margin-top:3px; flex-wrap:wrap;">
                      <span style="font-size:0.75rem; color:var(--marrom-claro); font-family:monospace; background:rgba(107, 66, 38, 0.08); padding:1px 5px; border-radius:4px;">${escapeHtml(cod)}</span>
                      ${cat ? `<span style="font-size:0.75rem; color:var(--dourado-escuro); font-weight:600;">${escapeHtml(cat)}</span>` : ''}
                    </div>
                  </td>
                  <td style="text-align:center; padding: 8px 10px; font-weight:600;">${qtd}</td>
                  <td style="text-align:right; padding: 8px 10px; color:var(--marrom-claro); font-size:0.88rem;">${formatarPreco(precoUnit)}</td>
                  <td style="text-align:right; padding: 8px 10px; font-weight:700; color:var(--dourado-escuro); font-size:0.92rem;">${formatarPreco(sub)}</td>
                </tr>
              `;
            }).join('') : '<tr><td colspan="5" style="text-align:center; padding:16px; color:var(--marrom-claro);">Itens sob encomenda artesanal.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <div class="detalhe-total-bloco">
      <div>
        <span style="font-size:0.78rem; color:var(--marrom-claro); display:block;">Forma de Pagamento</span>
        <strong style="font-size:0.95rem; display:flex; align-items:center; gap:6px; color:var(--marrom);">
          ${(pedido.forma_pagamento || '').toLowerCase().includes('pix')
            ? `<span style="display:inline-flex; align-items:center; width:18px; height:18px; color:var(--marrom);">${pixSvg}</span>`
            : '<span class="material-symbols-outlined" style="font-size:18px;">credit_card</span>'
          }
          ${escapeHtml(pedido.forma_pagamento || 'Pix')}
        </strong>
      </div>
      <div style="text-align:right;">
        <span style="font-size:0.78rem; color:var(--marrom-claro); display:block;">Valor Total</span>
        <strong style="font-size:1.35rem; color:var(--dourado-escuro); font-family:var(--fonte-display);">${formatarPreco(pedido.valor_total)}</strong>
      </div>
    </div>
  `;

  // Direcionamento correto do WhatsApp (Admin fala com cliente; Cliente fala com Dona Benta)
  const ehAdmin = typeof PERFIL_USUARIO !== 'undefined' && PERFIL_USUARIO?.role === 'admin';
  const abaAdminAtiva = document.querySelector('.admin-tab-btn.ativo') !== null;
  let linkWhats = '';
  let rotuloWhats = '';

  if (telClienteLimpo && (ehAdmin || abaAdminAtiva)) {
    linkWhats = `https://api.whatsapp.com/send?phone=55${telClienteLimpo}&text=Ol%C3%A1%20${encodeURIComponent(pedido.perfis?.nome || 'Cliente')}!%20Aqui%20%C3%A9%20da%20Dona%20Benta%20sobre%20o%20seu%20pedido%20${encodeURIComponent(numero)}.`;
    rotuloWhats = `Conversar com Cliente no WhatsApp`;
  } else {
    linkWhats = `https://api.whatsapp.com/send?phone=5542999823994&text=Ol%C3%A1!%20Gostaria%20de%20falar%20sobre%20o%20meu%20pedido%20${encodeURIComponent(numero)}%20na%20Dona%20Benta.`;
    rotuloWhats = `Falar com a Dona Benta no WhatsApp`;
  }

  rodape.innerHTML = `
    <a href="${linkWhats}" target="_blank" rel="noopener noreferrer" class="btn btn-whatsapp" style="flex:1; min-width:200px; justify-content:center; display:inline-flex; align-items:center; gap:8px;">
      <span style="display:inline-flex; align-items:center; width:18px; height:18px;">${whatsSvg}</span>
      <span>${rotuloWhats}</span>
    </a>
    <button type="button" class="btn btn-outline" id="btnFecharModalDetalhesBtn" style="min-width:100px;">
      Fechar
    </button>
  `;

  document.getElementById('btnFecharModalDetalhesBtn')?.addEventListener('click', () => {
    modal.classList.remove('aberto');
  });

  modal.classList.add('aberto');
}

// =========================================================
// MODAL DE PRODUTOS (ADMIN) COM VALIDAÇÃO SEGURA DE ARQUIVO E CORTE QUADRADO
// =========================================================
let fotoProdutoRecortada = null;

function injetarModalAdminGlobal() {
  if (document.getElementById('modalProduto')) return;

  const modalHTML = `
    <div class="modal-overlay" id="modalProduto">
      <div class="modal-cartao">
        <div class="modal-cabecalho">
          <h3 id="modalTitulo">Novo produto</h3>
          <button class="modal-fechar" id="fecharModal" aria-label="Fechar"><span class="material-symbols-outlined">close</span></button>
        </div>
        <form id="formProduto">
          <input type="hidden" id="produtoId">
          <div class="campo">
            <label for="produtoNome">Nome do produto</label>
            <input type="text" id="produtoNome" required maxlength="100">
          </div>
          <div class="campo">
            <label for="produtoCategoria">Categoria</label>
            <select id="produtoCategoria" required>
              <option value="bolos">Bolos</option>
              <option value="paes">Pães</option>
              <option value="doces">Doces</option>
              <option value="salgados">Salgados</option>
              <option value="tortas">Tortas</option>
            </select>
          </div>
          <div class="campo-linha">
            <div class="campo">
              <label for="produtoPreco">Preço (R$)</label>
              <input type="number" id="produtoPreco" step="0.01" min="0" required>
            </div>
            <div class="campo">
              <label for="produtoEstoque">Estoque</label>
              <input type="number" id="produtoEstoque" min="0" required>
            </div>
          </div>

          <div class="campo">
            <label for="produtoImagemFile">Foto do Produto (JPG, PNG, WEBP)</label>
            <input type="file" id="produtoImagemFile" accept="image/jpeg, image/png, image/webp">
            <input type="hidden" id="produtoImagemAtual">
            <div id="previewImagemContainer" style="margin-top: 10px; display: none;">
              <img id="previewImagem" src="" style="width: 70px; height: 70px; object-fit: cover; border-radius: 8px; border: 1px solid #ccc;">
              <span style="font-size: 0.8rem; color: var(--marrom-claro); margin-left: 8px; vertical-align: super;">Imagem quadrada cadastrada</span>
            </div>
          </div>

          <div class="campo">
            <label for="produtoDescricaoCurta">Descrição curta</label>
            <textarea id="produtoDescricaoCurta" rows="2" required maxlength="200"></textarea>
          </div>
          <div class="campo">
            <label for="produtoDescricao">Descrição detalhada</label>
            <textarea id="produtoDescricao" rows="3" required maxlength="1000"></textarea>
          </div>
          <div class="campo-linha">
            <div class="campo" style="display:flex; align-items:center; gap:8px;">
              <input type="checkbox" id="produtoDisponivel" checked style="width:auto;">
              <label for="produtoDisponivel" style="margin:0; cursor:pointer;">Disponível no catálogo</label>
            </div>
            <div class="campo" style="display:flex; align-items:center; gap:8px;">
              <input type="checkbox" id="produtoDestaque" style="width:auto;">
              <label for="produtoDestaque" style="margin:0; cursor:pointer;">Destaque na página inicial</label>
            </div>
          </div>
          <button type="submit" class="btn btn-primario btn-bloco" id="btnSalvarProduto" style="margin-top: 15px;">
            Salvar produto
          </button>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // Escuta seleção de foto do produto para abrir o cortador quadrado interativo
  const inputImagemProd = document.getElementById('produtoImagemFile');
  inputImagemProd?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formatosValidos = ['image/jpeg', 'image/png', 'image/webp'];
    if (!formatosValidos.includes(file.type)) {
      mostrarToast('Formato de foto inválido. Use JPG, PNG ou WEBP.', 'erro');
      inputImagemProd.value = '';
      return;
    }

    abrirModalCortadorFoto({
      arquivo: file,
      titulo: 'Ajustar Foto do Produto',
      onCancelar: () => {
        if (!fotoProdutoRecortada) inputImagemProd.value = '';
      },
      onConfirmar: (fileCortado, previewUrl) => {
        fotoProdutoRecortada = fileCortado;
        const previewImg = document.getElementById('previewImagem');
        const previewContainer = document.getElementById('previewImagemContainer');
        if (previewImg && previewContainer) {
          previewImg.src = previewUrl;
          previewContainer.style.display = 'block';
        }
        mostrarToast('Foto enquadrada em padrão quadrado (1:1)!', 'info');
      }
    });
  });

  document.getElementById('fecharModal').addEventListener('click', () => {
    fotoProdutoRecortada = null;
    document.getElementById('modalProduto').classList.remove('aberto');
  });

  document.getElementById('modalProduto').addEventListener('click', (e) => {
    if (e.target.id === 'modalProduto') {
      fotoProdutoRecortada = null;
      document.getElementById('modalProduto').classList.remove('aberto');
    }
  });

  document.getElementById('formProduto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSalvarProduto');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined spin">autorenew</span> Salvando...';

    const id = document.getElementById('produtoId').value;
    const arquivoInput = document.getElementById('produtoImagemFile');
    const arquivo = fotoProdutoRecortada || arquivoInput.files?.[0];
    let imagemUrlFinal = document.getElementById('produtoImagemAtual').value;

    // Upload de imagem com validação de tipo e tamanho
    if (arquivo) {
      const formatosValidos = ['image/jpeg', 'image/png', 'image/webp'];
      if (!formatosValidos.includes(arquivo.type)) {
        mostrarToast('Formato de foto inválido. Use JPG, PNG ou WEBP.', 'erro');
        btn.disabled = false;
        btn.textContent = 'Salvar produto';
        return;
      }
      if (arquivo.size > 8 * 1024 * 1024) {
        mostrarToast('A foto do produto deve ter no máximo 8MB.', 'erro');
        btn.disabled = false;
        btn.textContent = 'Salvar produto';
        return;
      }

      btn.innerHTML = '<span class="material-symbols-outlined spin">autorenew</span> Enviando imagem...';
      const extensao = (arquivo.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const nomeArquivo = `produtos/${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${extensao}`;

      const { data: uploadData, error: uploadError } = await db.storage
        .from(BUCKET_PRODUTOS)
        .upload(nomeArquivo, arquivo, { cacheControl: '3600', upsert: false });

      if (uploadError) {
        mostrarToast('Erro ao subir imagem para o storage: ' + uploadError.message, 'erro');
        btn.disabled = false;
        btn.textContent = 'Salvar produto';
        return;
      }

      const { data: urlData } = db.storage.from(BUCKET_PRODUTOS).getPublicUrl(nomeArquivo);
      imagemUrlFinal = urlData.publicUrl;
    } else if (!id && !imagemUrlFinal) {
      mostrarToast('Por favor, selecione uma foto para o produto.', 'erro');
      btn.disabled = false;
      btn.textContent = 'Salvar produto';
      return;
    }

    const dadosProduto = {
      nome: document.getElementById('produtoNome').value.trim(),
      categoria: document.getElementById('produtoCategoria').value,
      preco: Number(document.getElementById('produtoPreco').value) || 0,
      estoque: Number(document.getElementById('produtoEstoque').value) || 0,
      imagem_url: imagemUrlFinal,
      descricao_curta: document.getElementById('produtoDescricaoCurta').value.trim(),
      descricao: document.getElementById('produtoDescricao').value.trim(),
      disponivel: document.getElementById('produtoDisponivel').checked,
      destaque: document.getElementById('produtoDestaque').checked,
    };

    let erroDb;
    if (id) {
      ({ error: erroDb } = await db.from('produtos').update(dadosProduto).eq('id', id));
    } else {
      ({ error: erroDb } = await db.from('produtos').insert(dadosProduto));
    }

    if (erroDb) {
      mostrarToast('Erro ao salvar no banco de dados: ' + erroDb.message, 'erro');
      btn.disabled = false;
      btn.textContent = 'Salvar produto';
      return;
    }

    mostrarToast(id ? 'Produto atualizado com sucesso!' : 'Produto criado com sucesso!', 'sucesso');
    document.getElementById('modalProduto').classList.remove('aberto');
    fotoProdutoRecortada = null;
    btn.disabled = false;
    btn.textContent = 'Salvar produto';

    await db.from('produtos').select('*').order('criado_em', { ascending: false }).then(r => PRODUTOS_ADMIN = r.data || []);
    renderizarProdutosAdmin(document.getElementById('adminConteudoSecao'));
  });
}

function abrirModalProduto(id = null) {
  const modal = document.getElementById('modalProduto');
  const form = document.getElementById('formProduto');
  form.reset();
  fotoProdutoRecortada = null;

  document.getElementById('produtoImagemFile').value = '';
  const previewContainer = document.getElementById('previewImagemContainer');
  const previewImg = document.getElementById('previewImagem');

  if (id) {
    const produto = PRODUTOS_ADMIN.find(p => p.id === id);
    if (!produto) return;
    document.getElementById('modalTitulo').textContent = 'Editar produto';
    document.getElementById('produtoId').value = produto.id;
    document.getElementById('produtoNome').value = produto.nome;
    document.getElementById('produtoCategoria').value = produto.categoria;
    document.getElementById('produtoPreco').value = produto.preco;
    document.getElementById('produtoEstoque').value = produto.estoque ?? 0;

    document.getElementById('produtoImagemAtual').value = produto.imagem_url || '';
    if (produto.imagem_url) {
      previewImg.src = produto.imagem_url;
      previewContainer.style.display = 'block';
    } else {
      previewContainer.style.display = 'none';
    }

    document.getElementById('produtoDescricaoCurta').value = produto.descricao_curta || '';
    document.getElementById('produtoDescricao').value = produto.descricao || '';
    document.getElementById('produtoDisponivel').checked = produto.disponivel !== false;
    document.getElementById('produtoDestaque').checked = Boolean(produto.destaque);
  } else {
    document.getElementById('modalTitulo').textContent = 'Novo produto';
    document.getElementById('produtoId').value = '';
    document.getElementById('produtoImagemAtual').value = '';
    previewContainer.style.display = 'none';
    document.getElementById('produtoDisponivel').checked = true;
  }

  modal.classList.add('aberto');
}

async function excluirProduto(id) {
  if (!confirm('Tem certeza que deseja excluir este produto do catálogo?')) return;
  const { error } = await db.from('produtos').delete().eq('id', id);
  if (error) {
    mostrarToast('Erro ao excluir: ' + error.message, 'erro');
    return;
  }
  mostrarToast('Produto excluído com sucesso', 'sucesso');
  await db.from('produtos').select('*').order('criado_em', { ascending: false }).then(r => PRODUTOS_ADMIN = r.data || []);
  renderizarProdutosAdmin(document.getElementById('adminConteudoSecao'));
}

// Inicializa a aplicação quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', carregarConta);
} else {
  carregarConta();
}