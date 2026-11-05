// ============================================
// DONA BENTA — js/pagamentos.js
// Integração de Pagamentos Mercado Pago (Pix Dinâmico + Cartão)
// ============================================

const API_PAGAMENTOS_URL = new URL('api/', window.BASE_URL || `${window.location.origin}/`).href.replace(/\/$/, '');
let configuracaoGateway = null;

let pollingInterval = null;
let timerContadorInterval = null;
let metodoPagamentoSelecionado = 'pix'; // 'pix', 'cartao', 'entrega'

// Validação matemática de CPF
function validarCPF(cpf) {
  if (!cpf || typeof cpf !== 'string') return false;
  const limpo = cpf.replace(/\D/g, '');
  if (limpo.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(limpo)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(limpo.charAt(i), 10) * (10 - i);
  }
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(limpo.charAt(9), 10)) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(limpo.charAt(i), 10) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(limpo.charAt(10), 10)) return false;

  return true;
}

// Busca apenas o modo de operação; chaves de pagamento nunca são enviadas ao navegador.
async function obterConfiguracaoGateway() {
  if (configuracaoGateway) return configuracaoGateway;
  const response = await fetch(`${API_PAGAMENTOS_URL}/config`, { credentials: 'same-origin' });
  if (!response.ok) {
    throw new Error('Não foi possível consultar a configuração de pagamentos.');
  }
  configuracaoGateway = await response.json();
  return configuracaoGateway;
}

// ============================================
// Painel Seguro de Sandbox (Visível estritamente para Administrador logado em Teste)
// ============================================
async function verificarExibicaoSandbox() {
  try {
    const config = await obterConfiguracaoGateway();
    const isProducao = config?.ambiente === 'producao';

    if (isProducao) {
      document.querySelectorAll('.cartao-sandbox-dica, .pix-sandbox-dica').forEach(el => el.remove());
      return;
    }

    let isAdmin = false;
    if (typeof perfilAtual === 'function') {
      const perfil = await perfilAtual();
      isAdmin = perfil?.role === 'admin';
    }

    if (!isAdmin) {
      document.querySelectorAll('.cartao-sandbox-dica, .pix-sandbox-dica').forEach(el => el.remove());
      return;
    }

    // Se for admin em Sandbox, injeta dinamicamente o botão de simular aprovação se ainda não existir
    const pixCorpoConteudo = document.getElementById('pixCorpoConteudo');
    if (pixCorpoConteudo && !document.getElementById('pixSandboxDica')) {
      const sandboxPix = document.createElement('div');
      sandboxPix.id = 'pixSandboxDica';
      sandboxPix.className = 'pix-sandbox-dica';
      sandboxPix.innerHTML = `
        <small>💡 <strong>Ambiente Sandbox (Modo Teste):</strong></small>
        <button id="btnSimularAprovacaoPix" class="btn btn-outline" type="button" style="margin-top:8px; width:100%; font-size:0.85rem;">
          <span class="material-symbols-outlined" style="font-size:16px;">verified</span>
          Simular Pagamento Aprovado
        </button>
      `;
      pixCorpoConteudo.appendChild(sandboxPix);

      const btnSimular = document.getElementById('btnSimularAprovacaoPix');
      if (btnSimular && window._pedidoAtualPix) {
        btnSimular.onclick = async () => {
          btnSimular.disabled = true;
          btnSimular.innerHTML = '<span class="spinner" style="width:14px;height:14px;margin-right:6px;"></span> Aprovando...';
          try {
            const resp = await fetch(`${API_PAGAMENTOS_URL}/pagamento/simular-aprovacao`, {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pedido_id: window._pedidoAtualPix.id })
            });
            if (resp.ok) {
              confirmarPagamentoSucesso(window._pedidoAtualPix, window._perfilAtualPix);
            } else {
              const errData = await resp.json();
              if (typeof mostrarToast === 'function') mostrarToast(errData.erro || 'Falha na simulação', 'erro');
              btnSimular.disabled = false;
              btnSimular.innerHTML = '<span class="material-symbols-outlined">verified</span> Simular Pagamento Aprovado';
            }
          } catch (e) {
            console.error(e);
            btnSimular.disabled = false;
          }
        };
      }
    }
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

    <div id="cartaoBrickContainer" style="display:none;" class="cartao-credito-area">
      <p>Ao continuar, você será redirecionado ao ambiente seguro do Mercado Pago para concluir o pagamento.</p>
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
    if (btnConfirmar) {
      btnConfirmar.style.display = 'flex';
      btnConfirmar.innerHTML = '<span class="material-symbols-outlined">credit_card</span> Continuar para o pagamento';
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
async function iniciarFluxoCartao() {
  if (typeof window.validarDadosAgendamento === 'function' && !window.validarDadosAgendamento()) return;
  if (!lerCarrinho().length) {
    mostrarToast('Seu carrinho está vazio.', 'alerta');
    return;
  }

  const usuario = await usuarioAtual();
  if (!usuario) {
    mostrarToast('Você precisa estar logado para continuar.', 'alerta');
    return;
  }

  const button = document.getElementById('btnConfirmarPedido');
  if (button) {
    button.disabled = true;
    button.innerHTML = '<span class="material-symbols-outlined spin">autorenew</span> Preparando pagamento...';
  }

  let pedido = null;
  try {
    pedido = await registrarPedidoNoBanco({
      forma_pagamento: 'Cartão de Crédito',
      status: 'aguardando_confirmacao',
      pago: false
    });
    if (!pedido) throw new Error('Não foi possível registrar o pedido.');

    const response = await fetch(`${API_PAGAMENTOS_URL}/pagamento/cartao`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pedido_id: pedido.id, email: usuario.email })
    });
    const data = await response.json();
    if (!response.ok || !data.sucesso || !data.checkout_url) {
      throw new Error(data.detalhes || data.erro || 'Não foi possível iniciar o pagamento.');
    }

    const checkoutUrl = new URL(data.checkout_url);
    if (checkoutUrl.protocol !== 'https:' || !/(^|\.)mercadopago\.com(\.br)?$/i.test(checkoutUrl.hostname)) {
      throw new Error('O servidor retornou um endereço de pagamento inválido.');
    }
    window.location.assign(checkoutUrl.href);
  } catch (error) {
    console.error('Falha ao iniciar checkout do cartão:', error);
    if (pedido?.id && window.db) {
      try {
        const { error: erroItens } = await window.db.from('itens_pedido').delete().eq('pedido_id', pedido.id);
        if (erroItens) console.error('Não foi possível remover itens do checkout não iniciado:', erroItens);
        const { error: erroPedido } = await window.db.from('pedidos').delete().eq('id', pedido.id);
        if (erroPedido) console.error('Não foi possível remover o pedido do checkout não iniciado:', erroPedido);
      } catch (cleanupError) {
        console.error('Falha ao remover pedido do checkout não iniciado:', cleanupError);
      }
    }
    mostrarToast(error.message || 'Falha ao comunicar com o servidor de pagamentos.', 'erro');
    if (button) {
      button.disabled = false;
      button.innerHTML = '<span class="material-symbols-outlined">credit_card</span> Continuar para o pagamento';
    }
  }
}
window.iniciarFluxoCartao = iniciarFluxoCartao;
// Processamento do Pix Dinâmico
// ============================================
async function iniciarFluxoPix(pedido, perfil) {
  window._pedidoAtualPix = pedido;
  window._perfilAtualPix = perfil;
  abrirModalPix();

  // Em produção, CPF é obrigatório para emissão de Pix pelo Banco Central e Mercado Pago
  let config;
  try {
    config = await obterConfiguracaoGateway();
  } catch (error) {
    mostrarCarregandoPix(false);
    mostrarToast(error.message || 'Não foi possível iniciar o pagamento.', 'erro');
    return;
  }
  const isProducao = config?.ambiente === 'producao';
  let cpfAtual = (perfil?.cpf || '').replace(/\D/g, '');

  if (isProducao && !validarCPF(cpfAtual)) {
    mostrarCarregandoPix(false);
    const corpoConteudo = document.getElementById('pixCorpoConteudo');
    if (corpoConteudo) {
      corpoConteudo.style.display = 'block';
      corpoConteudo.innerHTML = `
        <div style="padding: 18px 12px; text-align: center;">
          <span class="material-symbols-outlined" style="font-size:38px; color:var(--marrom);">badge</span>
          <h4 style="margin: 8px 0 6px; font-size:1.15rem; color:var(--marrom);">Informe seu CPF</h4>
          <p style="font-size: 0.85rem; color: var(--marrom-claro); margin-bottom: 16px; line-height: 1.4;">
            O Banco Central e o Mercado Pago exigem um CPF válido para emitir o QR Code Pix.
          </p>
          <div class="campo" style="max-width: 280px; margin: 0 auto 14px;">
            <input type="text" id="inputCpfPixModal" placeholder="000.000.000-00" maxlength="14" style="text-align: center; font-size: 1.05rem; font-weight: 600; letter-spacing: 1px;">
            <small id="erroCpfPixModal" style="color:var(--erro); font-size: 0.8rem; display: none; margin-top: 6px;">CPF inválido. Digite os 11 dígitos.</small>
          </div>
          <button id="btnConfirmarCpfPixModal" class="btn btn-primario" style="min-width: 190px;">Continuar com Pix</button>
        </div>
      `;

      const inputCpf = document.getElementById('inputCpfPixModal');
      const btnCpf = document.getElementById('btnConfirmarCpfPixModal');
      const erroCpf = document.getElementById('erroCpfPixModal');

      if (inputCpf) {
        inputCpf.focus();
        inputCpf.addEventListener('input', (e) => {
          let v = e.target.value.replace(/\D/g, '');
          if (v.length > 11) v = v.slice(0, 11);
          if (v.length > 9) v = v.replace(/^(\d{3})(\d{3})(\d{3})(\d{1,2})$/, '$1.$2.$3-$4');
          else if (v.length > 6) v = v.replace(/^(\d{3})(\d{3})(\d{1,3})$/, '$1.$2.$3');
          else if (v.length > 3) v = v.replace(/^(\d{3})(\d{1,3})$/, '$1.$2');
          e.target.value = v;
        });
      }

      if (btnCpf) {
        btnCpf.addEventListener('click', async () => {
          const valLimpo = (inputCpf?.value || '').replace(/\D/g, '');
          if (!validarCPF(valLimpo)) {
            if (erroCpf) erroCpf.style.display = 'block';
            return;
          }
          if (erroCpf) erroCpf.style.display = 'none';
          if (!perfil) perfil = {};
          perfil.cpf = valLimpo;
          iniciarFluxoPix(pedido, perfil);
        });
      }
      return;
    }
  }

  mostrarCarregandoPix(true);

  try {
    const usuario = typeof usuarioAtual === 'function' ? await usuarioAtual() : null;
    const emailPagador = (perfil?.email || usuario?.email || '').trim().toLowerCase();

    const payload = {
      pedido_id: pedido.id,
      valor: pedido.valor_total,
      descricao: `Pedido Dona Benta #${pedido.numero_pedido || 'DB'}`,
      cliente: {
        nome: perfil?.nome || 'Cliente',
        email: emailPagador || (isProducao ? '' : 'cliente.donabenta@gmail.com'),
        cpf: perfil?.cpf || ''
      }
    };

    const resp = await fetch(`${API_PAGAMENTOS_URL}/pagamento/pix`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await resp.json();

    if (!resp.ok || !data.sucesso) {
      throw new Error(data.detalhes || data.erro || 'Falha ao gerar Pix');
    }

    if (data.pago === true && data.status === 'approved') {
      confirmarPagamentoSucesso(pedido, perfil);
      return;
    }

    renderizarDadosPixNoModal(data, pedido, perfil);
    iniciarPollingPix(data.pagamento_id, pedido, perfil);

  } catch (err) {
    console.error('Erro ao gerar Pix:', err);

    mostrarCarregandoPix(false);
    const corpoConteudo = document.getElementById('pixCorpoConteudo');
    if (corpoConteudo) {
      corpoConteudo.style.display = 'block';
      corpoConteudo.innerHTML = `
        <div style="text-align:center; padding:16px;">
          <span class="material-symbols-outlined" style="font-size:40px; color:var(--erro);">error</span>
          <p style="margin-top:8px; color:var(--erro); font-size:0.9rem;">
            ${typeof escapeHtml === 'function' ? escapeHtml(err.message) : err.message}<br>
            <small style="color:var(--marrom-claro); display:block; margin-top:4px;">Se persistir, verifique a conexão do servidor de pagamentos.</small>
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
      const resp = await fetch(`${API_PAGAMENTOS_URL}/pagamento/status?id=${encodeURIComponent(pagamentoId)}&pedido_id=${encodeURIComponent(pedido.id)}`, {
        credentials: 'same-origin'
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.pago === true && data.status === 'approved') {
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
