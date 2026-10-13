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
// CARREGAMENTO SEGURO DA FOTO (3s MÁXIMO)
// ============================================
function verificarECarregarAvatar(avatarUrl, nome, inicial, usuario, perfil) {
  const preview = document.getElementById('contaAvatarPreview');
  const acoesContainer = document.getElementById('avatarAcoes');
  const loading = document.getElementById('avatarLoading');
  if (!preview) return;

  // Garante monograma com inicial limpo imediatamente
  preview.innerHTML = `<span class="avatar-inicial" id="avatarInicial">${escapeHtml(inicial)}</span>`;
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
// UPLOAD E GERENCIAMENTO DE FOTO DE PERFIL
// ============================================
function configurarUploadFotoPerfil(usuario, perfil) {
  const input = document.getElementById('inputFotoPerfil');
  const preview = document.getElementById('contaAvatarPreview');
  const loading = document.getElementById('avatarLoading');
  const acoesContainer = document.getElementById('avatarAcoes');

  if (!input) return;

  input.addEventListener('change', async (e) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    // 1. Validações de segurança do arquivo
    const formatosValidos = ['image/jpeg', 'image/png', 'image/webp'];
    if (!formatosValidos.includes(arquivo.type)) {
      mostrarToast('Por favor, selecione uma imagem nos formatos JPG, PNG ou WEBP.', 'erro');
      input.value = '';
      return;
    }

    const TAMANHO_MAX_BYTES = 4 * 1024 * 1024; // 4MB
    if (arquivo.size > TAMANHO_MAX_BYTES) {
      mostrarToast('A imagem deve ter no máximo 4MB.', 'erro');
      input.value = '';
      return;
    }

    try {
      if (loading) {
        loading.hidden = false;
        preview.appendChild(loading);
      }
      mostrarToast('Enviando foto de perfil...', 'info');

      const extensao = (arquivo.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const nomeLimpo = `avatar_${Date.now()}.${extensao}`;
      const bucketDestino = typeof BUCKET_AVATARES !== 'undefined' ? BUCKET_AVATARES : 'fotos-perfil';
      const caminhoStorage = `${usuario.id}/${nomeLimpo}`;

      // 2. Upload para o bucket exclusivo 'fotos-perfil'
      let { data: uploadData, error: uploadError } = await db.storage
        .from(bucketDestino)
        .upload(caminhoStorage, arquivo, {
          cacheControl: '3600',
          upsert: true
        });

      // Fallback automático caso o bucket novo ainda não tenha sido criado
      let bucketUsado = bucketDestino;
      if (uploadError && uploadError.message?.toLowerCase().includes('bucket not found')) {
        console.warn(`Bucket ${bucketDestino} não encontrado, tentando fallback no bucket produtos...`);
        bucketUsado = typeof BUCKET_PRODUTOS !== 'undefined' ? BUCKET_PRODUTOS : 'produtos';
        const caminhoFallback = `avatars/${usuario.id}/${nomeLimpo}`;
        const resFallback = await db.storage
          .from(bucketUsado)
          .upload(caminhoFallback, arquivo, { cacheControl: '3600', upsert: true });
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

      // 4. Salva nos metadados do Auth (imediato e sem depender de tabela)
      await db.auth.updateUser({
        data: { avatar_url: novaUrl }
      });

      // 5. Tenta salvar na tabela perfis (se a coluna existir)
      try {
        await db.from('perfis').update({ avatar_url: novaUrl }).eq('id', usuario.id);
      } catch (errDb) {
        console.warn('Coluna avatar_url não presente na tabela perfis (salvo no auth metadata):', errDb);
      }

      // 6. Atualiza o estado em memória e a interface
      perfil.avatar_url = novaUrl;
      preview.innerHTML = `<img src="${escapeHtml(novaUrl)}" alt="Foto de perfil" class="avatar-img" id="avatarImg">`;
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
          <label>E-mail da conta</label>
          <input type="email" value="${escapeHtml(usuario.email)}" disabled style="background:#f4f4f4; cursor:not-allowed;">
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
// SEÇÃO: MEUS PEDIDOS
// =========================================================
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
      <div class="cartao-meu-pedido">
        <div class="meu-pedido-icone">
          <span class="material-symbols-outlined">${status.icone}</span>
        </div>
        <div class="meu-pedido-detalhes">
          <div class="meu-pedido-cabecalho">
            <span class="meu-pedido-numero">Pedido ${escapeHtml(numero)}</span>
            <span class="badge ${status.classe}">${escapeHtml(status.rotulo)}</span>
          </div>
          <div class="meu-pedido-meta">
            ${escapeHtml(formatarData(p.data_agendada))} às ${escapeHtml(p.horario_agendado || '')} · 
            <strong>${p.tipo_entrega === 'entrega' ? 'Entrega' : 'Retirada na loja'}</strong>
          </div>
          <div class="meu-pedido-itens">
            ${listaItens.map(i => `${Number(i.quantidade) || 1}x ${escapeHtml(i.nome || 'Produto')}`).join(', ')}
          </div>
        </div>
        <div class="meu-pedido-valor">
          ${formatarPreco(p.valor_total)}
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
                <td>
                  <select class="admin-status-select" data-pedido="${escapeHtml(p.id)}" aria-label="Status do pedido">
                    ${Object.entries(STATUS_INFO).map(([valor, info]) => `
                      <option value="${valor}" ${p.status === valor ? 'selected' : ''}>${escapeHtml(info.rotulo)}</option>
                    `).join('')}
                  </select>
                </td>
                <td>
                  <button class="badge btn-pagamento ${p.pago ? 'badge-sucesso' : 'badge-alerta'}" data-pedido="${escapeHtml(p.id)}" data-pago="${Boolean(p.pago)}">
                    ${p.pago ? 'Pago' : 'Pendente'}
                  </button>
                </td>
              </tr>
            `;
            }).join('')}
            ${PEDIDOS_ADMIN.length === 0 ? '<tr><td colspan="4" style="text-align:center; padding: 20px;">Nenhum pedido encontrado.</td></tr>' : ''}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Listener para alteração de status do pedido
  area.querySelectorAll('.admin-status-select').forEach(selectEl => {
    selectEl.addEventListener('change', async (e) => {
      const novoValor = e.target.value;
      const pedidoId = selectEl.dataset.pedido;
      selectEl.disabled = true;

      const { error } = await db.from('pedidos').update({ status: novoValor }).eq('id', pedidoId);
      selectEl.disabled = false;

      if (error) {
        mostrarToast('Erro ao atualizar status: ' + error.message, 'erro');
      } else {
        mostrarToast('Status do pedido atualizado!', 'sucesso');
        const pedido = PEDIDOS_ADMIN.find(p => p.id === pedidoId);
        if (pedido) pedido.status = novoValor;
      }
    });
  });

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
        renderizarPedidosAdmin(area);
      }
    });
  });
}

// =========================================================
// MODAL DE PRODUTOS (ADMIN) COM VALIDAÇÃO SEGURA DE ARQUIVO
// =========================================================
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
              <span style="font-size: 0.8rem; color: var(--marrom-claro); margin-left: 8px; vertical-align: super;">Imagem cadastrada</span>
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

  document.getElementById('fecharModal').addEventListener('click', () => {
    document.getElementById('modalProduto').classList.remove('aberto');
  });

  document.getElementById('formProduto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSalvarProduto');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined spin">autorenew</span> Salvando...';

    const id = document.getElementById('produtoId').value;
    const arquivoInput = document.getElementById('produtoImagemFile');
    const arquivo = arquivoInput.files?.[0];
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
      if (arquivo.size > 5 * 1024 * 1024) {
        mostrarToast('A foto do produto deve ter no máximo 5MB.', 'erro');
        btn.disabled = false;
        btn.textContent = 'Salvar produto';
        return;
      }

      btn.innerHTML = '<span class="material-symbols-outlined spin">autorenew</span> Enviando imagem...';
      const extensao = arquivo.name.split('.').pop().toLowerCase() || 'jpg';
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