// ============================================
// DONA BENTA — js/pagamentos.js
// Integração de Pagamentos Mercado Pago (Pix Dinâmico + Cartão)
// ============================================

const MP_PUBLIC_KEY = 'TEST-e8687a34-dc25-4e97-a1de-3e207f5c3d6c';
const API_PAGAMENTOS_URL = 'http://localhost:3001/api';

let pollingInterval = null;
let timerContadorInterval = null;
let mpInstance = null;
let cardBrickController = null;
let metodoPagamentoSelecionado = 'pix'; // 'pix', 'cartao', 'dinheiro'

// Inicializa Mercado Pago SDK v2 se disponível
function obterInstanciaMercadoPago() {
  if (!mpInstance && window.MercadoPago) {
    try {
      mpInstance = new MercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' });
    } catch (e) {
      console.warn('Não foi possível inicializar SDK do Mercado Pago:', e);
    }
  }
  return mpInstance;
}

// ============================================
// Renderização do Seletor de Pagamento
// ============================================
// Função para exibir dicas e botões do Sandbox APENAS para usuários Administradores
async function verificarExibicaoSandbox() {
  try {
    let isAdmin = false;
    if (typeof perfilAtual === 'function') {
      const perfil = await perfilAtual();
      isAdmin = perfil?.role === 'admin';
    }
    const cartaoDica = document.getElementById('cartaoSandboxDica');
    if (cartaoDica) cartaoDica.style.display = isAdmin ? 'block' : 'none';
    const pixDica = document.getElementById('pixSandboxDica');
    if (pixDica) pixDica.style.display = isAdmin ? 'block' : 'none';
  } catch (e) {
    console.warn('Erro ao verificar permissão de admin para sandbox:', e);
  }
}

// ============================================
// Renderização do Seletor de Pagamento
// ============================================
function renderizarSeletorPagamento(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const iconePix = window.ICONE_PIX_SVG || '<span class="material-symbols-outlined pagamento-icone">bolt</span>';

  container.innerHTML = `
    <label style="font-weight:600; font-size:0.92rem; color:var(--marrom);">Forma de pagamento</label>
    
    <div class="opcoes-pagamento-grade" role="radiogroup">
      <div class="opcao-pagamento-card ativa" data-metodo="pix" role="radio" aria-checked="true" tabindex="0">
        <span class="pagamento-badge">Instantâneo</span>
        ${iconePix}
        <span class="pagamento-titulo">Pix</span>
      </div>

      <div class="opcao-pagamento-card" data-metodo="cartao" role="radio" aria-checked="false" tabindex="0">
        <span class="material-symbols-outlined pagamento-icone">credit_card</span>
        <span class="pagamento-titulo">Cartão de Crédito</span>
      </div>

      <div class="opcao-pagamento-card" data-metodo="entrega" role="radio" aria-checked="false" tabindex="0">
        <span class="material-symbols-outlined pagamento-icone">storefront</span>
        <span class="pagamento-titulo">Pagar na Entrega / Retirada</span>
      </div>
    </div>

    <!-- Container dinâmico para Cartão Mercado Pago Brick -->
    <div id="cartaoBrickContainer" style="display:none;" class="cartao-credito-area">
      <!-- Visível apenas para Administrador -->
      <div id="cartaoSandboxDica" class="cartao-sandbox-dica" style="display:none; background: rgba(191, 221, 243, 0.25); border: 1px dashed var(--azul-bebe-escuro); border-radius: var(--raio-sm); padding: 12px; margin-bottom: 14px; font-size: 0.82rem; color: var(--marrom);">
        <div style="font-weight: 700; display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
          <span class="material-symbols-outlined" style="font-size: 18px; color: var(--dourado-escuro);">credit_card</span>
          Cartões de Teste Oficiais (Sandbox Mercado Pago):
        </div>
        <div style="line-height: 1.6; font-size: 0.82rem;">
          • <strong>Visa:</strong> <code>4066 6901 1000 0008</code> (ou <code>4532 1170 8019 2702</code>)<br>
          • <strong>Mastercard:</strong> <code>5480 8328 0103 3311</code><br>
          • <strong>Vencimento:</strong> <code>11/30</code> &nbsp;|&nbsp; <strong>CVV:</strong> <code>123</code><br>
          • <strong>Nome do Titular:</strong> <code>APRO</code> <em>(apenas APRO no Sandbox)</em><br>
          • <strong>CPF:</strong> <code>12345678909</code>
        </div>
      </div>
      <div id="cardPaymentBrick_container"></div>
    </div>
  `;

  // Event Listeners nos cartões de seleção
  container.querySelectorAll('.opcao-pagamento-card').forEach(card => {
    card.addEventListener('click', () => {
      const metodo = card.dataset.metodo;
      selecionarMetodoPagamento(metodo);
    });
  });

  verificarExibicaoSandbox();
}

function selecionarMetodoPagamento(metodo) {
  metodoPagamentoSelecionado = metodo;
  document.querySelectorAll('.opcao-pagamento-card').forEach(c => {
    const ativa = c.dataset.metodo === metodo;
    c.classList.toggle('ativa', ativa);
    c.setAttribute('aria-checked', ativa ? 'true' : 'false');
  });

  const cartaoContainer = document.getElementById('cartaoBrickContainer');
  const btnConfirmar = document.getElementById('btnConfirmarPedido');

  if (metodo === 'cartao') {
    if (cartaoContainer) cartaoContainer.style.display = 'block';
    inicializarCartaoBrick();
    if (btnConfirmar) btnConfirmar.style.display = 'none'; // O Brick tem o próprio botão de pagar
    
    // Alerta o cliente se ainda não tiver escolhido data e horário
    if (typeof window.validarDadosAgendamento === 'function') {
      const cal = document.querySelector('.calendario-grade-datas .selecionada');
      if (!cal && typeof mostrarToast === 'function') {
        mostrarToast('Dica: Selecione a data e o horário no calendário antes de preencher o cartão.', 'info');
      }
    }
  } else {
    if (cartaoContainer) cartaoContainer.style.display = 'none';
    if (btnConfirmar) {
      btnConfirmar.style.display = 'flex';
      const iconePix = window.ICONE_PIX_SVG || '';
      btnConfirmar.innerHTML = metodo === 'pix' 
        ? `${iconePix} Pagar com Pix`
        : '<span class="material-symbols-outlined">task_alt</span> Confirmar Pedido';
    }
  }
}

// ============================================
// Inicializar Mercado Pago Card Brick
// ============================================
async function inicializarCartaoBrick() {
  const mp = obterInstanciaMercadoPago();
  if (!mp) {
    console.warn('Mercado Pago SDK não carregado');
    return;
  }

  const container = document.getElementById('cardPaymentBrick_container');
  if (!container || cardBrickController) return;

  const total = typeof totalCarrinho === 'function' ? totalCarrinho() : 10;
  const usuario = typeof usuarioAtual === 'function' ? await usuarioAtual() : null;

  try {
    const bricksBuilder = mp.bricks();
    const isEscuro = typeof obterTemaAtual === 'function' && obterTemaAtual() === 'escuro';

    cardBrickController = await bricksBuilder.create('cardPayment', 'cardPaymentBrick_container', {
      initialization: {
        amount: Number(total.toFixed(2)),
        payer: {
          email: usuario?.email || 'cliente.donabenta@gmail.com'
        }
      },
      customization: {
        visual: {
          style: {
            theme: isEscuro ? 'dark' : 'default',
            customVariables: isEscuro ? {
              formBackgroundColor: '#2b221b',
              textPrimaryColor: '#f6efe8',
              textSecondaryColor: '#d2c1b1',
              inputBackgroundColor: '#221a14',
              inputBorderWidth: '1px',
              inputFocusedBorderWidth: '2px',
              borderRadiusMedium: '8px',
              baseColor: '#f2a65a',
              baseColorFirstVariant: '#e08e3c',
              baseColorSecondVariant: '#d07d2b',
              buttonTextColor: '#ffffff',
              outlinePrimaryColor: '#f2a65a',
              errorColor: '#e05252'
            } : {
              formBackgroundColor: '#ffffff',
              textPrimaryColor: '#3d3d3d',
              textSecondaryColor: '#8a5a3b',
              inputBackgroundColor: '#ffffff',
              inputBorderWidth: '1px',
              borderRadiusMedium: '8px',
              baseColor: '#6b4226',
              baseColorFirstVariant: '#8a5a3b',
              buttonTextColor: '#ffffff',
              outlinePrimaryColor: '#6b4226'
            }
          }
        },
        paymentMethods: {
          maxInstallments: 3
        }
      },
      callbacks: {
        onReady: () => {
          console.log('[Mercado Pago Brick] Formulário de cartão pronto');
        },
        onSubmit: async (cardFormData) => {
          try {
            await processarPagamentoCartao(cardFormData);
          } catch (err) {
            console.error('[Mercado Pago Brick] Erro de pagamento:', err);
            // Lança o erro para o Brick saber que o pagamento falhou e NÃO mostrar aprovado
            throw err;
          }
        },
        onError: (err) => {
          console.error('[Mercado Pago Brick] Erro:', err);
          if (typeof mostrarToast === 'function') mostrarToast('Erro ao validar cartão', 'erro');
        }
      }
    });
  } catch (err) {
    console.warn('Aviso ao inicializar Brick de cartão:', err);
  }
}

// ============================================
// Processamento do Cartão de Crédito (Atômico)
// ============================================
async function processarPagamentoCartao(cardFormData) {
  // 1. Validação obrigatória de data e horário antes de processar cobrança
  if (typeof window.validarDadosAgendamento === 'function') {
    const valido = window.validarDadosAgendamento();
    if (!valido) {
      throw new Error('Por favor, selecione a data e o horário no calendário antes de pagar.');
    }
  }

  const carrinho = typeof lerCarrinho === 'function' ? lerCarrinho() : [];
  if (carrinho.length === 0) {
    if (typeof mostrarToast === 'function') mostrarToast('Seu carrinho está vazio.', 'alerta');
    throw new Error('Carrinho vazio');
  }

  const usuario = typeof usuarioAtual === 'function' ? await usuarioAtual() : null;
  const perfil = typeof perfilAtual === 'function' ? await perfilAtual() : null;

  if (!usuario) {
    if (typeof mostrarToast === 'function') mostrarToast('Você precisa estar logado para continuar.', 'alerta');
    throw new Error('Usuário não logado');
  }

  // 2. Dispara a cobrança no Mercado Pago PRIMEIRO (NUNCA grava no banco antes de aprovar!)
  const payload = {
    token: cardFormData.token,
    issuer_id: cardFormData.issuer_id,
    payment_method_id: cardFormData.payment_method_id,
    transaction_amount: cardFormData.transaction_amount,
    installments: cardFormData.installments,
    payer: cardFormData.payer,
    descricao: `Pedido Dona Benta`
  };

  let resp, data;
  try {
    resp = await fetch(`${API_PAGAMENTOS_URL}/pagamento/cartao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    data = await resp.json();
  } catch (err) {
    console.error('Falha na comunicação com a API:', err);
    if (typeof mostrarToast === 'function') mostrarToast('Falha ao comunicar com o servidor de pagamentos.', 'erro');
    throw err;
  }

  // Se o pagamento NÃO foi aprovado:
  if (!resp.ok || (!data.sucesso && data.status !== 'approved')) {
    const msgErro = data.detalhes || data.erro || 'Cartão recusado pelo banco emissor.';
    if (typeof mostrarToast === 'function') {
      mostrarToast(msgErro, 'erro');
    }
    // Lança erro para o Brick NÃO aprovar e NADA é gravado no banco
    throw new Error(msgErro);
  }

  // 3. SE E SOMENTE SE O CARTÃO FOI APROVADO: grava o pedido no Supabase já como PAGO
  const pedido = await registrarPedidoNoBanco({
    forma_pagamento: 'Cartão de Crédito',
    pago: true,
    status: 'confirmado'
  });

  if (!pedido) {
    throw new Error('Pagamento aprovado, mas falha ao salvar pedido no banco.');
  }

  if (typeof mostrarToast === 'function') {
    mostrarToast('Pagamento com cartão aprovado! 🎉', 'sucesso');
  }

  exibirSucessoPagamento(pedido, perfil, 'Cartão de Crédito');
  return true;
}

// ============================================
// Processamento do Pix Dinâmico
// ============================================
async function iniciarFluxoPix(pedido, perfil) {
  abrirModalPix();
  mostrarCarregandoPix(true);

  try {
    const payload = {
      pedido_id: pedido.id,
      valor: pedido.valor_total,
      descricao: `Pedido Dona Benta #${pedido.numero_pedido || 'DB'}`,
      cliente: {
        nome: perfil?.nome || 'Cliente',
        email: perfil?.email || (await usuarioAtual())?.email || 'cliente.donabenta@gmail.com',
        cpf: perfil?.cpf || ''
      }
    };

    const resp = await fetch(`${API_PAGAMENTOS_URL}/pagamento/pix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await resp.json();

    if (!resp.ok || !data.sucesso) {
      throw new Error(data.detalhes || data.erro || 'Falha ao gerar Pix');
    }

    renderizarDadosPixNoModal(data, pedido, perfil);
    iniciarPollingPix(data.pagamento_id, pedido, perfil);
    escutarSupabaseRealtime(pedido.id, perfil);

  } catch (err) {
    console.error('Erro ao gerar Pix:', err);

    // Se houve falha ao gerar o Pix na API, remove o pedido pendente do banco para não ficar órfão
    if (pedido?.id && window.db) {
      try {
        await window.db.from('itens_pedido').delete().eq('pedido_id', pedido.id);
        await window.db.from('pedidos').delete().eq('id', pedido.id);
      } catch (e) {
        console.warn('Erro ao limpar pedido não concluído:', e);
      }
    }
    mostrarCarregandoPix(false);
    const corpoConteudo = document.getElementById('pixCorpoConteudo');
    if (corpoConteudo) {
      corpoConteudo.style.display = 'block';
      corpoConteudo.innerHTML = `
        <div style="text-align:center; padding:16px;">
          <span class="material-symbols-outlined" style="font-size:40px; color:var(--erro);">error</span>
          <p style="margin-top:8px; color:var(--erro); font-size:0.9rem;">
            Não foi possível conectar ao servidor de pagamentos.<br>
            <strong>Certifique-se de que o servidor local está rodando:</strong><br>
            <code>node api-server.js</code>
          </p>
          <button class="btn btn-primario" onclick="fecharModalPix()" style="margin-top:14px;">Entendido</button>
        </div>
      `;
    }
  }
}

function abrirModalPix() {
  const overlay = document.getElementById('pixOverlay');
  if (overlay) overlay.style.display = 'flex';
}

function fecharModalPix() {
  const overlay = document.getElementById('pixOverlay');
  if (overlay) overlay.style.display = 'none';
  pararPollingPix();
}

function mostrarCarregandoPix(mostrar) {
  const loading = document.getElementById('pixCorpoCarregando');
  const conteudo = document.getElementById('pixCorpoConteudo');
  const sucesso = document.getElementById('pixCorpoSucesso');

  if (loading) loading.style.display = mostrar ? 'block' : 'none';
  if (conteudo) conteudo.style.display = mostrar ? 'none' : 'block';
  if (sucesso) sucesso.style.display = 'none';
}

function renderizarDadosPixNoModal(data, pedido, perfil) {
  mostrarCarregandoPix(false);
  verificarExibicaoSandbox();

  const pixValorTexto = document.getElementById('pixValorTexto');
  const pixQrCodeImg = document.getElementById('pixQrCodeImg');
  const pixCodigoInput = document.getElementById('pixCodigoInput');
  const btnCopiar = document.getElementById('btnCopiarPix');
  const btnSimular = document.getElementById('btnSimularAprovacaoPix');

  if (pixValorTexto) pixValorTexto.textContent = typeof formatarPreco === 'function' ? formatarPreco(data.valor) : `R$ ${data.valor}`;
  if (pixQrCodeImg) pixQrCodeImg.src = data.qr_code_base64 || '';
  if (pixCodigoInput) pixCodigoInput.value = data.pix_copia_cola || '';

  // Botão Copiar
  if (btnCopiar) {
    btnCopiar.onclick = () => {
      if (pixCodigoInput) {
        navigator.clipboard.writeText(pixCodigoInput.value);
        const originalHtml = btnCopiar.innerHTML;
        btnCopiar.innerHTML = '<span class="material-symbols-outlined">check</span> Copiado!';
        btnCopiar.style.background = 'var(--sucesso)';
        setTimeout(() => {
          btnCopiar.innerHTML = originalHtml;
          btnCopiar.style.background = '';
        }, 2000);
      }
    };
  }

  // Botão Simular Aprovação (Sandbox)
  if (btnSimular) {
    btnSimular.onclick = async () => {
      btnSimular.disabled = true;
      btnSimular.innerHTML = '<span class="spinner" style="width:14px;height:14px;margin-right:6px;"></span> Aprovando...';
      try {
        await fetch(`${API_PAGAMENTOS_URL}/pagamento/simular-aprovacao`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pedido_id: pedido.id })
        });
        confirmarPagamentoSucesso(pedido, perfil);
      } catch (e) {
        console.error(e);
      }
    };
  }

  iniciarTimerPix(15 * 60); // 15 minutos
}

function iniciarTimerPix(segundosTotais) {
  clearInterval(timerContadorInterval);
  let restante = segundosTotais;
  const label = document.getElementById('pixContador');

  timerContadorInterval = setInterval(() => {
    if (restante <= 0) {
      clearInterval(timerContadorInterval);
      if (label) label.textContent = 'Expirado';
      return;
    }
    restante--;
    const m = Math.floor(restante / 60);
    const s = restante % 60;
    if (label) label.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, 1000);
}

// Polling do status a cada 3 segundos
function iniciarPollingPix(pagamentoId, pedido, perfil) {
  pararPollingPix();
  pollingInterval = setInterval(async () => {
    try {
      const resp = await fetch(`${API_PAGAMENTOS_URL}/pagamento/status?id=${pagamentoId}&pedido_id=${pedido.id}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.pago || data.status === 'approved') {
          confirmarPagamentoSucesso(pedido, perfil);
        }
      }
    } catch (e) {
      console.warn('Polling status:', e);
    }
  }, 3000);
}

function pararPollingPix() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  if (timerContadorInterval) {
    clearInterval(timerContadorInterval);
    timerContadorInterval = null;
  }
}

// Escuta em tempo real via Supabase Realtime
function escutarSupabaseRealtime(pedidoId, perfil) {
  if (!window.db) return;
  try {
    db.channel(`pedido-${pedidoId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'pedidos',
        filter: `id=eq.${pedidoId}`
      }, (payload) => {
        if (payload.new && (payload.new.pago === true || payload.new.status === 'confirmado')) {
          confirmarPagamentoSucesso(payload.new, perfil);
        }
      })
      .subscribe();
  } catch (e) {
    console.warn('Realtime Supabase:', e);
  }
}

// Transição visual para tela de sucesso
function confirmarPagamentoSucesso(pedido, perfil) {
  pararPollingPix();

  if (typeof limparCarrinho === 'function') {
    limparCarrinho();
  }

  const conteudo = document.getElementById('pixCorpoConteudo');
  const sucesso = document.getElementById('pixCorpoSucesso');
  const btnZap = document.getElementById('btnWhatsappPixSucesso');

  if (conteudo) conteudo.style.display = 'none';
  if (sucesso) sucesso.style.display = 'block';

  // Configura botão de WhatsApp
  if (btnZap) {
    const numeroRecibo = pedido.numero_pedido || 'DB';
    const totalFormatado = typeof formatarPreco === 'function' ? formatarPreco(pedido.valor_total) : `R$ ${pedido.valor_total}`;
    const msg = encodeURIComponent(`Olá! Realizei o pagamento via Pix do meu pedido *${numeroRecibo}* na Dona Benta!\nTotal: ${totalFormatado}\nStatus: PAGO ✓`);
    btnZap.href = `https://api.whatsapp.com/send?phone=${window.NUMERO_WHATSAPP || '5542999823994'}&text=${msg}`;
  }

  if (typeof mostrarToast === 'function') {
    mostrarToast('Pagamento confirmado com sucesso! 🎉', 'sucesso');
  }
}

function exibirSucessoPagamento(pedido, perfil, metodo) {
  if (typeof limparCarrinho === 'function') limparCarrinho();
  if (typeof exibirRecibo === 'function') {
    pedido.forma_pagamento = metodo;
    exibirRecibo(pedido, perfil);
  }
}

// Reinicializa o Brick caso o usuário alterne o tema com ele aberto
window.addEventListener('temaAlterado', () => {
  if (cardBrickController) {
    try {
      cardBrickController.unmount();
    } catch (e) {}
    cardBrickController = null;
    const cartaoContainer = document.getElementById('cartaoBrickContainer');
    if (cartaoContainer && cartaoContainer.style.display !== 'none') {
      const brickContainer = document.getElementById('cardPaymentBrick_container');
      if (brickContainer) brickContainer.innerHTML = '';
      inicializarCartaoBrick();
    }
  }
});
