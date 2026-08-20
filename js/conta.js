// Constantes e Variáveis Globais para funcionamento dinâmico
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

// Função Principal
async function carregarConta() {
    const usuario = await exigirLogin('login.html');
    if (!usuario) return;

    const perfil = await perfilAtual();
    const layout = document.getElementById('contaLayout');
    if(!layout) return;

    const nome = perfil?.nome || 'Cliente';
    const inicial = nome.charAt(0).toUpperCase();

    // 1. Monta a Estrutura Base (Menu Lateral e Área de Conteúdo)
    layout.style.display = 'grid';
    layout.style.gridTemplateColumns = '1fr';
    layout.style.gap = '20px';
    
    // CSS Inline para Desktop (Sidebar à esquerda, conteúdo à direita)
    if (window.innerWidth > 768) {
        layout.style.gridTemplateColumns = '300px 1fr';
        layout.style.alignItems = 'start';
    }

    layout.innerHTML = `
        <div class="cartao">
            <div class="conta-perfil-topo">
                <div class="conta-avatar">${inicial}</div>
                <h3 style="font-size: 1.1rem;">${nome}</h3>
                <p style="font-size: 0.85rem; color: var(--marrom-claro);">${usuario.email}</p>
            </div>
            <nav class="conta-menu" id="menuNavegacao">
                <a href="#" data-rota="perfil" class="ativo"><span class="material-symbols-outlined">person</span> Meus dados</a>
                <a href="#" data-rota="pedidos"><span class="material-symbols-outlined">receipt_long</span> Meus pedidos</a>
                ${perfil?.role === 'admin' ? '<a href="#" data-rota="admin"><span class="material-symbols-outlined">admin_panel_settings</span> Painel Admin</a>' : ''}
                <a href="#" id="btnSair" class="sair" style="margin-top: 20px;"><span class="material-symbols-outlined">logout</span> Sair da conta</a>
            </nav>
        </div>
        <div id="areaConteudo">
            <!-- O conteúdo dinâmico será injetado aqui -->
            <div class="spinner"></div>
        </div>
    `;

    // 2. Lógica de Navegação (Troca de Abas)
    const linksMenu = document.querySelectorAll('#menuNavegacao a[data-rota]');
    linksMenu.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            // Atualiza classe ativa no menu
            linksMenu.forEach(l => l.classList.remove('ativo'));
            link.classList.add('ativo');
            
            // Carrega a seção correspondente
            carregarSecao(link.dataset.rota, usuario, perfil);
        });
    });

    // Logout
    document.getElementById('btnSair').addEventListener('click', async (e) => {
        e.preventDefault(); 
        await db.auth.signOut(); 
        window.location.href = 'index.html';
    });

    // Garante que o Modal de Admin exista no body (injetado via JS para não sujar o HTML principal)
    injetarModalAdminGlobal();

    // Lê a URL para saber se veio um comando para abrir outra aba (ex: ?aba=pedidos)
    const urlParams = new URLSearchParams(window.location.search);
    const abaInicial = urlParams.get('aba') || 'perfil';

    // Remove a classe 'ativo' de todos e coloca no link correto do menu
    const linkAtivo = document.querySelector(`#menuNavegacao a[data-rota="${abaInicial}"]`);
    if (linkAtivo) {
        document.querySelectorAll('#menuNavegacao a').forEach(l => l.classList.remove('ativo'));
        linkAtivo.classList.add('ativo');
    }

    // Carrega a seção correspondente à URL (ou perfil por padrão)
    carregarSecao(abaInicial, usuario, perfil);
}

// Roteador de Seções
async function carregarSecao(rota, usuario, perfil) {
    const area = document.getElementById('areaConteudo');
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
            <h3 style="margin-bottom: 20px;">Meus dados</h3>
            <form id="formPerfil">
                <div class="campo-linha">
                    <div class="campo"><label>Nome completo</label><input type="text" id="nomePerfil" value="${perfil?.nome || ''}" required></div>
                    <div class="campo"><label>Telefone / WhatsApp</label><input type="tel" id="telefonePerfil" value="${perfil?.telefone || ''}" required></div>
                </div>
                <div class="campo"><label>E-mail</label><input type="email" value="${usuario.email}" disabled></div>
                <div class="campo-linha">
                    <div class="campo"><label>CEP</label><input type="text" id="cepPerfil" value="${perfil?.cep || ''}" placeholder="00000-000"></div>
                    <div class="campo"><label>Bairro</label><input type="text" id="bairroPerfil" value="${perfil?.bairro || ''}"></div>
                </div>
                <div class="campo-linha">
                    <div class="campo"><label>Rua</label><input type="text" id="logradouroPerfil" value="${perfil?.logradouro || ''}"></div>
                    <div class="campo"><label>Número</label><input type="text" id="numeroPerfil" value="${perfil?.numero || ''}"></div>
                </div>
                <div class="campo"><label>Complemento</label><input type="text" id="complementoPerfil" value="${perfil?.complemento || ''}"></div>
                <button type="submit" class="btn btn-primario" id="btnSalvarPerfil"><span class="material-symbols-outlined">save</span> Salvar alterações</button>
            </form>
        </div>
    `;

    document.getElementById('formPerfil').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnSalvarPerfil'); btn.disabled = true;
        const dados = {
            nome: document.getElementById('nomePerfil').value, telefone: document.getElementById('telefonePerfil').value,
            cep: document.getElementById('cepPerfil').value, bairro: document.getElementById('bairroPerfil').value,
            logradouro: document.getElementById('logradouroPerfil').value, numero: document.getElementById('numeroPerfil').value,
            complemento: document.getElementById('complementoPerfil').value
        };
        const { error } = await db.from('perfis').update(dados).eq('id', usuario.id);
        btn.disabled = false;
        if (error) mostrarToast('Erro ao salvar', 'erro'); else mostrarToast('Dados atualizados!', 'sucesso');
    });
}

// =========================================================
// SEÇÃO: MEUS PEDIDOS
// =========================================================
async function renderizarMeusPedidos(area, usuario) {
    let pedidos = [];
    try {
        const { data, error } = await db.from('pedidos').select('*, itens_pedido(*)').eq('cliente_id', usuario.id).order('criado_em', { ascending: false });
        if (!error && data) pedidos = data;
    } catch (e) { console.warn('Erro ao carregar pedidos:', e); }

    if (pedidos.length === 0) {
        area.innerHTML = `
            <div class="cartao" style="text-align: center; padding: 40px;">
                <span class="material-symbols-outlined" style="font-size: 48px; color: var(--marrom-claro);">receipt_long</span>
                <h3>Você ainda não fez nenhum pedido</h3>
                <p style="color: var(--marrom-claro);">Explore o catálogo e faça sua primeira encomenda.</p>
                <a href="catalogo.html" class="btn btn-primario" style="margin-top:16px;">Ver catálogo</a>
            </div>`;
        return;
    }

    const htmlPedidos = pedidos.map(p => {
        const status = STATUS_INFO[p.status] || STATUS_INFO.aguardando_confirmacao;
        const listaItens = p.itens_pedido || p.itens || [];
        return `
            <div style="display: flex; gap: 16px; align-items: center; padding: 16px; border: 1px solid #eee; border-radius: var(--raio-md); margin-bottom: 12px; background: #fafafa;">
                <div style="width: 48px; height: 48px; border-radius: 50%; background: var(--azul-bebe); display: flex; align-items: center; justify-content: center; color: var(--marrom);">
                    <span class="material-symbols-outlined">${status.icone}</span>
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: bold; color: var(--marrom);">Pedido #${p.id.slice(0,8).toUpperCase()}</div>
                    <div style="font-size: 0.85rem; color: var(--marrom-claro);">${formatarData(p.data_agendada)} às ${p.horario_agendado} · ${p.tipo_entrega === 'entrega' ? 'Entrega' : 'Retirada'}</div>
                    <div style="font-size: 0.85rem; color: var(--marrom-claro); margin-top: 4px;">${listaItens.map(i => `${i.quantidade}x ${i.nome}`).join(', ')}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-weight: bold; color: var(--dourado-escuro); font-size: 1.1rem; margin-bottom: 8px;">${formatarPreco(p.valor_total)}</div>
                    <span class="badge ${status.classe}">${status.rotulo}</span>
                </div>
            </div>`;
    }).join('');

    area.innerHTML = `
        <div class="cartao">
            <h3 style="margin-bottom: 20px;">Histórico de Pedidos</h3>
            ${htmlPedidos}
        </div>`;
}

// =========================================================
// SEÇÃO: PAINEL ADMINISTRATIVO
// =========================================================
async function renderizarPainelAdmin(area, perfil) {
    if (perfil.role !== 'admin') {
        area.innerHTML = '<div class="cartao"><p>Acesso negado.</p></div>';
        return;
    }

    // Carrega dados
    await Promise.all([
        db.from('produtos').select('*').order('criado_em', { ascending: false }).then(r => PRODUTOS_ADMIN = r.data || []),
        db.from('pedidos').select('*, perfis(nome, telefone), itens_pedido(*)').order('criado_em', { ascending: false }).then(r => PEDIDOS_ADMIN = r.data || [])
    ]);

    // Estrutura com sub-navegação em formato de abas (Tabs) para encaixar na área da direita
    area.innerHTML = `
        <div class="cartao" style="margin-bottom: 20px; padding: 10px;">
            <div style="display: flex; gap: 10px; overflow-x: auto; padding-bottom: 4px;" id="adminTabs">
                <button class="btn btn-outline ativo" data-tab="visao-geral" style="border: none; background: var(--marrom-claro); color: white;">Visão geral</button>
                <button class="btn btn-outline" data-tab="produtos" style="border: none;">Produtos</button>
                <button class="btn btn-outline" data-tab="pedidos-admin" style="border: none;">Gerenciar Pedidos</button>
            </div>
        </div>
        <div id="adminConteudoSecao"></div>
    `;

    const botoesTab = document.querySelectorAll('#adminTabs button');
    botoesTab.forEach(btn => {
        btn.addEventListener('click', () => {
            botoesTab.forEach(b => { b.style.background = 'transparent'; b.style.color = 'var(--marrom)'; b.classList.remove('ativo'); });
            btn.style.background = 'var(--marrom-claro)'; btn.style.color = 'white'; btn.classList.add('ativo');
            carregarTabAdmin(btn.dataset.tab);
        });
    });

    carregarTabAdmin('visao-geral'); // Inicializa na Visão Geral
}

function carregarTabAdmin(tab) {
    const areaAdmin = document.getElementById('adminConteudoSecao');
    if (tab === 'visao-geral') renderizarVisaoGeralAdmin(areaAdmin);
    if (tab === 'produtos') renderizarProdutosAdmin(areaAdmin);
    if (tab === 'pedidos-admin') renderizarPedidosAdmin(areaAdmin);
}

function renderizarVisaoGeralAdmin(area) {
    const pendentes = PEDIDOS_ADMIN.filter(p => p.status === 'aguardando_confirmacao').length;
    
    // AQUI ESTÁ A MUDANÇA: O faturamento agora soma apenas onde p.pago === true
    const faturamento = PEDIDOS_ADMIN.filter(p => p.pago === true).reduce((s, p) => s + Number(p.valor_total), 0);

    area.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 20px;">
            <div class="cartao stat-cartao"><span class="material-symbols-outlined">receipt_long</span><div class="stat-valor">${PEDIDOS_ADMIN.length}</div><div class="stat-rotulo">Pedidos totais</div></div>
            <div class="cartao stat-cartao"><span class="material-symbols-outlined">hourglass_empty</span><div class="stat-valor">${pendentes}</div><div class="stat-rotulo">Aguardando</div></div>
            <div class="cartao stat-cartao"><span class="material-symbols-outlined">payments</span><div class="stat-valor">${formatarPreco(faturamento)}</div><div class="stat-rotulo">Faturamento (Pago)</div></div>
            <div class="cartao stat-cartao"><span class="material-symbols-outlined">bakery_dining</span><div class="stat-valor">${PRODUTOS_ADMIN.length}</div><div class="stat-rotulo">Produtos</div></div>
        </div>
        <div class="cartao">
            <h3 style="margin-bottom:16px;">Últimos pedidos</h3>
            <div class="tabela-scroll">
                <table>
                    <thead><tr><th>Cliente</th><th>Data</th><th>Total</th><th>Status</th><th>Pagamento</th></tr></thead>
                    <tbody>
                        ${PEDIDOS_ADMIN.slice(0, 5).map(p => `
                            <tr>
                                <td>${p.perfis?.nome || '—'}</td>
                                <td>${formatarData(p.data_agendada)}</td>
                                <td>${formatarPreco(p.valor_total)}</td>
                                <td><span class="badge ${STATUS_INFO[p.status]?.classe || 'badge-info'}">${STATUS_INFO[p.status]?.rotulo || p.status}</span></td>
                                <td><span class="badge ${p.pago ? 'badge-sucesso' : 'badge-alerta'}">${p.pago ? 'Pago' : 'Pendente'}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderizarProdutosAdmin(area) {
    area.innerHTML = `
        <div class="cartao">
            <div class="tabela-topo" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3>Produtos (${PRODUTOS_ADMIN.length})</h3>
                <button class="btn btn-primario" id="btnNovoProduto"><span class="material-symbols-outlined">add</span> Novo</button>
            </div>
            <div class="tabela-scroll">
                <table>
                    <thead><tr><th>Produto</th><th>Preço</th><th>Estoque</th><th>Status</th><th>Ações</th></tr></thead>
                    <tbody>
                        ${PRODUTOS_ADMIN.map(p => `
                            <tr>
                                <td><div class="tabela-produto-cel"><img src="${p.imagem_url}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:4px;"> <span style="margin-left:8px;">${p.nome}</span></div></td>
                                <td>${formatarPreco(p.preco)}</td>
                                <td>${p.estoque ?? '—'}</td>
                                <td><span class="badge ${p.disponivel ? 'badge-sucesso' : 'badge-erro'}">${p.disponivel ? 'Disp.' : 'Indisp.'}</span></td>
                                <td>
                                    <div class="acoes-tabela">
                                        <button class="acao-icone-btn" data-editar="${p.id}" style="border:none;background:none;cursor:pointer;"><span class="material-symbols-outlined">edit</span></button>
                                        <button class="acao-icone-btn excluir" data-excluir="${p.id}" style="border:none;background:none;cursor:pointer;color:red;"><span class="material-symbols-outlined">delete</span></button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
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
            <h3 style="margin-bottom: 20px;">Gerenciar Pedidos (${PEDIDOS_ADMIN.length})</h3>
            <div class="tabela-scroll" style="overflow: visible;">
                <table>
                    <thead><tr><th>Cliente</th><th>Entrega</th><th>Status</th><th>Pagamento</th></tr></thead>
                    <tbody>
                        ${PEDIDOS_ADMIN.map(p => `
                            <tr>
                                <td>${p.perfis?.nome || '—'}<br><span style="color:var(--marrom-claro); font-size:0.8rem;">${p.perfis?.telefone || ''}</span></td>
                                <td>${formatarData(p.data_agendada)}<br>${p.horario_agendado} (${p.tipo_entrega})</td>
                                <td>
                                    <div class="custom-select" data-pedido="${p.id}">
                                        <div class="custom-select-trigger">
                                            <span class="trigger-text">${STATUS_INFO[p.status]?.rotulo || p.status}</span>
                                            <span class="material-symbols-outlined icone-seta">expand_more</span>
                                        </div>
                                        <div class="custom-select-options">
                                            ${Object.entries(STATUS_INFO).map(([valor, info]) => `
                                                <div class="custom-option ${p.status === valor ? 'selecionado' : ''}" data-valor="${valor}">
                                                    ${info.rotulo}
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <button class="badge btn-pagamento ${p.pago ? 'badge-sucesso' : 'badge-alerta'}" data-pedido="${p.id}" data-pago="${p.pago || false}" style="border: none; cursor: pointer; transition: 0.2s;">
                                        ${p.pago ? 'Pago' : 'Pendente'}
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // 1. Lógica do Custom Select (Status de entrega) - Mantido igual
    const selects = area.querySelectorAll('.custom-select');
    selects.forEach(selectBox => {
        const trigger = selectBox.querySelector('.custom-select-trigger');
        const triggerText = selectBox.querySelector('.trigger-text');
        const options = selectBox.querySelectorAll('.custom-option');

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.custom-select').forEach(s => {
                if (s !== selectBox) s.classList.remove('aberto');
            });
            selectBox.classList.toggle('aberto');
        });

        options.forEach(option => {
            option.addEventListener('click', async (e) => {
                e.stopPropagation();
                const novoValor = option.dataset.valor;
                const pedidoId = selectBox.dataset.pedido;

                options.forEach(opt => opt.classList.remove('selecionado'));
                option.classList.add('selecionado');
                
                triggerText.textContent = option.textContent.trim();
                selectBox.classList.remove('aberto');

                const { error } = await db.from('pedidos').update({ status: novoValor }).eq('id', pedidoId);
                
                if (error) {
                    mostrarToast('Erro ao atualizar status', 'erro');
                } else {
                    mostrarToast('Status atualizado', 'sucesso');
                    const pedido = PEDIDOS_ADMIN.find(p => p.id === pedidoId);
                    if (pedido) pedido.status = novoValor;
                }
            });
        });
    });

    document.addEventListener('click', () => {
        document.querySelectorAll('.custom-select').forEach(s => s.classList.remove('aberto'));
    });

    // 2. NOVA Lógica do Botão de Pagamento
    const botoesPagamento = area.querySelectorAll('.btn-pagamento');
    botoesPagamento.forEach(btn => {
        btn.addEventListener('click', async () => {
            const pedidoId = btn.dataset.pedido;
            const estadoAtualPago = btn.dataset.pago === 'true'; // converte string para booleano
            const novoEstadoPago = !estadoAtualPago; // inverte o estado

            // Efeito visual de carregamento
            btn.style.opacity = '0.5';
            btn.disabled = true;

            const { error } = await db.from('pedidos').update({ pago: novoEstadoPago }).eq('id', pedidoId);

            if (error) {
                mostrarToast('Erro ao atualizar pagamento', 'erro');
                btn.style.opacity = '1';
                btn.disabled = false;
            } else {
                mostrarToast(novoEstadoPago ? 'Pedido marcado como Pago!' : 'Pedido marcado como Pendente!', 'sucesso');
                
                // Atualiza a lista local para refletir na visão geral também
                const pedido = PEDIDOS_ADMIN.find(p => p.id === pedidoId);
                if (pedido) pedido.pago = novoEstadoPago;
                
                // Recarrega apenas a tabela para atualizar as cores e botões
                renderizarPedidosAdmin(area);
            }
        });
    });
}

// =========================================================
// MODAL DE PRODUTOS (ADMIN) - MODIFICADO COM UPLOAD
// =========================================================
function injetarModalAdminGlobal() {
    if (document.getElementById('modalProduto')) return; // Evita duplicar
    const modalHTML = `
        <div class="modal-overlay" id="modalProduto">
            <div class="modal-cartao">
                <div class="modal-cabecalho">
                    <h3 id="modalTitulo">Novo produto</h3>
                    <button class="modal-fechar" id="fecharModal"><span class="material-symbols-outlined">close</span></button>
                </div>
                <form id="formProduto" style="max-height: 70vh; overflow-y: auto; padding-right: 5px;">
                    <input type="hidden" id="produtoId">
                    <div class="campo"><label>Nome</label><input type="text" id="produtoNome" required></div>
                    <div class="campo">
                        <label>Categoria</label>
                        <select id="produtoCategoria" required>
                            <option value="bolos">Bolos</option>
                            <option value="paes">Pães</option>
                            <option value="doces">Doces</option>
                            <option value="salgados">Salgados</option>
                            <option value="tortas">Tortas</option>
                        </select>
                    </div>
                    <div class="campo-linha">
                        <div class="campo"><label>Preço (R$)</label><input type="number" id="produtoPreco" step="0.01" min="0" required></div>
                        <div class="campo"><label>Estoque</label><input type="number" id="produtoEstoque" min="0" required></div>
                    </div>
                    
                    <!-- NOVO CAMPO DE IMAGEM -->
                    <div class="campo">
                        <label>Foto do Produto</label>
                        <input type="file" id="produtoImagemFile" accept="image/*">
                        <input type="hidden" id="produtoImagemAtual"> <!-- Guarda a URL se estiver editando -->
                        <div id="previewImagemContainer" style="margin-top: 10px; display: none;">
                            <img id="previewImagem" src="" style="width: 60px; height: 60px; object-fit: cover; border-radius: 6px; border: 1px solid #ccc;">
                            <span style="font-size: 0.8rem; color: var(--marrom-claro); margin-left: 8px; vertical-align: super;">Imagem atual</span>
                        </div>
                    </div>

                    <div class="campo"><label>Desc. curta</label><textarea id="produtoDescricaoCurta" rows="2" required></textarea></div>
                    <div class="campo"><label>Desc. completa</label><textarea id="produtoDescricao" rows="3" required></textarea></div>
                    <div class="campo-linha">
                        <div class="campo" style="display:flex; align-items:center; gap:8px;"><input type="checkbox" id="produtoDisponivel" checked style="width:auto;"><label style="margin:0;">Disponível</label></div>
                        <div class="campo" style="display:flex; align-items:center; gap:8px;"><input type="checkbox" id="produtoDestaque" style="width:auto;"><label style="margin:0;">Destaque</label></div>
                    </div>
                    <button type="submit" class="btn btn-primario btn-bloco" id="btnSalvarProduto" style="margin-top: 15px;">Salvar produto</button>
                </form>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById('fecharModal').addEventListener('click', () => document.getElementById('modalProduto').classList.remove('aberto'));
    
    document.getElementById('formProduto').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnSalvarProduto');
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined" style="animation: spin 1s linear infinite;">autorenew</span> Salvando...';

        const id = document.getElementById('produtoId').value;
        const arquivoInput = document.getElementById('produtoImagemFile');
        const arquivo = arquivoInput.files[0];
        let imagemUrlFinal = document.getElementById('produtoImagemAtual').value; // Inicia com a atual (se houver)

        // LÓGICA DE UPLOAD
        if (arquivo) {
            btn.innerHTML = '<span class="material-symbols-outlined" style="animation: spin 1s linear infinite;">autorenew</span> Subindo imagem...';
            
            const extensao = arquivo.name.split('.').pop();
            const nomeArquivo = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${extensao}`;
            
            const { data: uploadData, error: uploadError } = await db.storage
                .from('produtos')
                .upload(nomeArquivo, arquivo, { cacheControl: '3600', upsert: false });

            if (uploadError) {
                mostrarToast('Erro ao subir imagem para o bucket', 'erro');
                btn.disabled = false;
                btn.textContent = 'Salvar produto';
                return;
            }

            // Pega a URL pública
            const { data: urlData } = db.storage.from('produtos').getPublicUrl(nomeArquivo);
            imagemUrlFinal = urlData.publicUrl;
        } else if (!id) {
            // Se for criação de um NOVO produto e não selecionou foto
            mostrarToast('Por favor, selecione uma foto para o produto.', 'erro');
            btn.disabled = false;
            btn.textContent = 'Salvar produto';
            return;
        }

        // SALVAR NO BANCO
        const dadosProduto = {
            nome: document.getElementById('produtoNome').value, 
            categoria: document.getElementById('produtoCategoria').value,
            preco: Number(document.getElementById('produtoPreco').value), 
            estoque: Number(document.getElementById('produtoEstoque').value),
            imagem_url: imagemUrlFinal, 
            descricao_curta: document.getElementById('produtoDescricaoCurta').value,
            descricao: document.getElementById('produtoDescricao').value, 
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
            mostrarToast('Erro ao salvar no banco de dados', 'erro'); 
            btn.disabled = false;
            btn.textContent = 'Salvar produto';
            return; 
        }
        
        mostrarToast(id ? 'Produto atualizado!' : 'Produto criado com sucesso!', 'sucesso');
        document.getElementById('modalProduto').classList.remove('aberto');
        
        // Restaura o botão e recarrega a tabela
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
    
    // Reseta campo de arquivo e container de preview
    document.getElementById('produtoImagemFile').value = '';
    const previewContainer = document.getElementById('previewImagemContainer');
    const previewImg = document.getElementById('previewImagem');

    if (id) {
        const produto = PRODUTOS_ADMIN.find(p => p.id === id);
        document.getElementById('modalTitulo').textContent = 'Editar produto';
        document.getElementById('produtoId').value = produto.id;
        document.getElementById('produtoNome').value = produto.nome;
        document.getElementById('produtoCategoria').value = produto.categoria;
        document.getElementById('produtoPreco').value = produto.preco;
        document.getElementById('produtoEstoque').value = produto.estoque ?? 0;
        
        // Exibe o preview da imagem existente
        document.getElementById('produtoImagemAtual').value = produto.imagem_url;
        previewImg.src = produto.imagem_url;
        previewContainer.style.display = 'block';

        document.getElementById('produtoDescricaoCurta').value = produto.descricao_curta || '';
        document.getElementById('produtoDescricao').value = produto.descricao || '';
        document.getElementById('produtoDisponivel').checked = produto.disponivel !== false;
        document.getElementById('produtoDestaque').checked = !!produto.destaque;
    } else {
        document.getElementById('modalTitulo').textContent = 'Novo produto';
        document.getElementById('produtoId').value = '';
        document.getElementById('produtoImagemAtual').value = '';
        previewContainer.style.display = 'none'; // Esconde preview na criação
        document.getElementById('produtoDisponivel').checked = true;
    }
    modal.classList.add('aberto');
}

async function excluirProduto(id) {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;
    const { error } = await db.from('produtos').delete().eq('id', id);
    if (error) { mostrarToast('Erro ao excluir', 'erro'); return; }
    mostrarToast('Produto excluído', 'sucesso');
    
    await db.from('produtos').select('*').order('criado_em', { ascending: false }).then(r => PRODUTOS_ADMIN = r.data || []);
    renderizarProdutosAdmin(document.getElementById('adminConteudoSecao'));
}

// Inicia o app
carregarConta();