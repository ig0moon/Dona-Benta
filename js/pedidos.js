// ============================================
// DONA BENTA — js/pedidos.js
// Agendamento, Checkout e Confirmação de Pedidos
// ============================================

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const HORARIOS_PADRAO = ['09:00', '11:00', '14:00', '16:00', '17:30', '19:00'];

let mesAtual = new Date().getMonth();
let anoAtual = new Date().getFullYear();
let dataSelecionada = null;
let horarioSelecionado = null;
let tipoEntrega = 'retirada';
let horariosOcupados = {};

async function iniciarCheckout() {
  const carrinho = typeof lerCarrinho === 'function' ? lerCarrinho() : [];
  const layout = document.getElementById('checkoutLayout');
  if (!layout) return;

  if (carrinho.length === 0) {
    layout.innerHTML = `
      <div class="vazio" style="grid-column: 1/-1;">
        <span class="material-symbols-outlined vazio-icone">shopping_bag</span>
        <h3>Seu carrinho está vazio</h3>
        <p>Adicione produtos artesanais antes de agendar seu pedido.</p>
        <a href="catalogo.html" class="btn btn-primario">
          <span class="material-symbols-outlined">storefront</span> Ver catálogo
        </a>
      </div>
    `;
    return;
  }

  const usuario = await usuarioAtual();
  if (!usuario) {
    layout.innerHTML = `
      <div class="vazio" style="grid-column: 1/-1;">
        <span class="material-symbols-outlined">lock</span>
        <h3>Entre na sua conta para continuar</h3>
        <p>Você precisa estar logado para agendar e confirmar seu pedido.</p>
        <a href="login.html" class="btn btn-primario" style="margin-top:16px;">
          <span class="material-symbols-outlined">login</span> Entrar / Cadastrar
        </a>
      </div>
    `;
    return;
  }

  await carregarHorariosOcupados();
  renderizarCheckout();
}

async function carregarHorariosOcupados() {
  try {
    const { data, error } = await db
      .from('pedidos')
      .select('data_agendada, horario_agendado')
      .neq('status', 'cancelado');

    if (!error && data) {
      horariosOcupados = {};
      data.forEach(p => {
        if (!p.data_agendada || !p.horario_agendado) return;
        if (!horariosOcupados[p.data_agendada]) horariosOcupados[p.data_agendada] = [];
        horariosOcupados[p.data_agendada].push(p.horario_agendado);
      });
    }
  } catch (e) {
    console.warn('Não foi possível carregar horários ocupados:', e);
  }
}

function renderizarCheckout() {
  const layout = document.getElementById('checkoutLayout');
  if (!layout) return;

  const carrinho = lerCarrinho();
  const total = totalCarrinho();

  layout.innerHTML = `
    <div class="checkout-principal">
      <div class="cartao" style="margin-bottom: 20px;">
        <h3 style="margin-bottom: 16px;">Tipo de entrega</h3>
        <div class="tipo-entrega-opcoes">
          <div class="opcao-entrega selecionada" id="opcaoRetirada" role="button" tabindex="0">
            <span class="material-symbols-outlined">storefront</span>
            <h4>Retirar na loja</h4>
            <p style="font-size:0.8rem; color:var(--marrom-claro); margin-top:4px;">Sem taxa adicional</p>
          </div>
          <div class="opcao-entrega" id="opcaoEntrega" role="button" tabindex="0">
            <span class="material-symbols-outlined">local_shipping</span>
            <h4>Entrega no endereço</h4>
            <p style="font-size:0.8rem; color:var(--marrom-claro); margin-top:4px;">Em Ponta Grossa e região</p>
          </div>
        </div>
        <div class="campo" id="campoEndereco" style="display:none;">
          <label for="enderecoEntrega">Endereço completo de entrega *</label>
          <input type="text" id="enderecoEntrega" placeholder="Rua, número, bairro, complemento" maxlength="200">
        </div>
      </div>

      <div class="cartao calendario-cartao">
        <h3 style="margin-bottom: 16px;">Escolha a data da encomenda</h3>
        <div class="calendario-cabecalho">
          <button id="mesAnterior" class="btn-calendario-nav" aria-label="Mês anterior"><span class="material-symbols-outlined">chevron_left</span></button>
          <span class="calendario-mes" id="calendarioMes"></span>
          <button id="mesProximo" class="btn-calendario-nav" aria-label="Próximo mês"><span class="material-symbols-outlined">chevron_right</span></button>
        </div>
        <div class="calendario-grade-dias">
          ${DIAS_SEMANA.map(d => `<span>${d}</span>`).join('')}
        </div>
        <div class="calendario-grade-datas" id="calendarioDatas"></div>
      </div>

      <div class="cartao" id="cartaoHorarios" style="display:none; margin-bottom: 20px;">
        <h3 style="margin-bottom: 4px;">Escolha o horário</h3>
        <p style="font-size: 0.88rem; color: var(--marrom-claro); margin-bottom: 12px;" id="dataEscolhidaTexto"></p>
        <div class="horarios-grade" id="horariosGrade"></div>
      </div>

      <div class="cartao">
        <h3 style="margin-bottom: 16px;">Observações do pedido</h3>
        <div class="campo" style="margin-bottom: 0;">
          <textarea id="observacoesPedido" rows="3" placeholder="Algum detalhe especial? (ex: sem açúcar, mensagem na embalagem, etc.)" maxlength="300"></textarea>
        </div>
      </div>
    </div>

    <aside class="checkout-resumo-container">
      <div class="cartao resumo-cartao">
        <h3 style="margin-bottom: 16px;">Resumo do pedido</h3>
        <div class="resumo-itens-lista">
          ${carrinho.map(item => `
            <div class="resumo-item-mini">
              <span>${Number(item.quantidade) || 1}x ${escapeHtml(item.nome)}</span>
              <span>${formatarPreco(item.preco * item.quantidade)}</span>
            </div>
          `).join('')}
        </div>
        <div class="resumo-linha total">
          <span>Total</span>
          <span>${formatarPreco(total)}</span>
        </div>

        <div class="campo" style="margin-top: 18px;">
          <label for="formaPagamento">Forma de pagamento</label>
          <select id="formaPagamento">
            <option value="Pix">Pix (Chave informada no WhatsApp)</option>
            <option value="Cartão">Cartão (Débito / Crédito)</option>
            <option value="Dinheiro">Dinheiro na entrega/retirada</option>
          </select>
        </div>

        <button class="btn btn-primario btn-bloco" id="btnConfirmarPedido" style="margin-top: 14px;">
          <span class="material-symbols-outlined">task_alt</span>
          Confirmar pedido
        </button>
      </div>
    </aside>
  `;

  document.getElementById('opcaoRetirada').addEventListener('click', () => selecionarTipoEntrega('retirada'));
  document.getElementById('opcaoEntrega').addEventListener('click', () => selecionarTipoEntrega('entrega'));
  document.getElementById('mesAnterior').addEventListener('click', () => mudarMes(-1));
  document.getElementById('mesProximo').addEventListener('click', () => mudarMes(1));
  document.getElementById('btnConfirmarPedido').addEventListener('click', confirmarPedido);

  renderizarCalendario();
}

function selecionarTipoEntrega(tipo) {
  tipoEntrega = tipo;
  const optRetirada = document.getElementById('opcaoRetirada');
  const optEntrega = document.getElementById('opcaoEntrega');
  const campoEnd = document.getElementById('campoEndereco');

  if (optRetirada) optRetirada.classList.toggle('selecionada', tipo === 'retirada');
  if (optEntrega) optEntrega.classList.toggle('selecionada', tipo === 'entrega');
  if (campoEnd) campoEnd.style.display = tipo === 'entrega' ? 'block' : 'none';
}

function mudarMes(delta) {
  mesAtual += delta;
  if (mesAtual < 0) { mesAtual = 11; anoAtual--; }
  if (mesAtual > 11) { mesAtual = 0; anoAtual++; }
  renderizarCalendario();
}

function renderizarCalendario() {
  const mesLabel = document.getElementById('calendarioMes');
  if (!mesLabel) return;
  mesLabel.textContent = `${MESES[mesAtual]} de ${anoAtual}`;

  const primeiroDia = new Date(anoAtual, mesAtual, 1).getDay();
  const diasNoMes = new Date(anoAtual, mesAtual + 1, 0).getDate();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  let html = '';
  for (let i = 0; i < primeiroDia; i++) {
    html += `<div class="data-celula vazia"></div>`;
  }

  for (let dia = 1; dia <= diasNoMes; dia++) {
    const dataObj = new Date(anoAtual, mesAtual, dia);
    const dataStr = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    const passada = dataObj < hoje;
    const domingo = dataObj.getDay() === 0;
    const selecionada = dataStr === dataSelecionada;

    if (passada || domingo) {
      html += `<div class="data-celula passada" title="${domingo ? 'Fechado aos domingos' : 'Data passada'}">${dia}</div>`;
    } else {
      html += `<div class="data-celula ${selecionada ? 'selecionada' : ''}" data-data="${dataStr}">${dia}</div>`;
    }
  }

  const containerDatas = document.getElementById('calendarioDatas');
  if (containerDatas) {
    containerDatas.innerHTML = html;
    containerDatas.querySelectorAll('.data-celula[data-data]').forEach(cel => {
      cel.addEventListener('click', () => selecionarData(cel.dataset.data));
    });
  }
}

function selecionarData(dataStr) {
  dataSelecionada = dataStr;
  horarioSelecionado = null;
  renderizarCalendario();

  const cartaoHorarios = document.getElementById('cartaoHorarios');
  if (!cartaoHorarios) return;
  cartaoHorarios.style.display = 'block';

  const [ano, mes, dia] = dataStr.split('-');
  document.getElementById('dataEscolhidaTexto').textContent = `Horários disponíveis para ${dia}/${mes}/${ano}:`;

  const ocupados = horariosOcupados[dataStr] || [];
  document.getElementById('horariosGrade').innerHTML = HORARIOS_PADRAO.map(h => {
    const indisponivel = ocupados.includes(h);
    return `
      <button class="horario-btn ${indisponivel ? 'indisponivel' : ''}" data-horario="${h}" ${indisponivel ? 'disabled' : ''}>
        ${h} ${indisponivel ? '(Esgotado)' : ''}
      </button>
    `;
  }).join('');

  document.querySelectorAll('.horario-btn:not(:disabled)').forEach(btn => {
    btn.addEventListener('click', () => {
      horarioSelecionado = btn.dataset.horario;
      document.querySelectorAll('.horario-btn').forEach(b => b.classList.remove('selecionado'));
      btn.classList.add('selecionado');
    });
  });

  cartaoHorarios.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function confirmarPedido() {
  if (!dataSelecionada) {
    mostrarToast('Por favor, escolha uma data para a encomenda.', 'alerta');
    return;
  }
  if (!horarioSelecionado) {
    mostrarToast('Por favor, selecione um horário para a encomenda.', 'alerta');
    return;
  }

  const tipoEntregaAtual = tipoEntrega;
  const enderecoInput = document.getElementById('enderecoEntrega');
  const endereco = enderecoInput?.value?.trim() || '';

  if (tipoEntregaAtual === 'entrega' && !endereco) {
    mostrarToast('Informe o endereço completo para a entrega.', 'alerta');
    enderecoInput?.focus();
    return;
  }

  const btn = document.getElementById('btnConfirmarPedido');
  btn.disabled = true;
  btn.innerHTML = '<span class="material-symbols-outlined spin">autorenew</span> Registrando...';

  const carrinho = lerCarrinho();
  const total = totalCarrinho();
  const observacoes = document.getElementById('observacoesPedido')?.value?.trim() || '';
  const formaPagamento = document.getElementById('formaPagamento')?.value || 'Pix';
  const usuario = await usuarioAtual();
  const perfil = await perfilAtual();

  // Calcula o próximo número de pedido sequencial (DB-01, DB-02, DB-03...)
  let proximoNumeroPedido = 'DB-01';
  try {
    const { count, error: errCount } = await db
      .from('pedidos')
      .select('id', { count: 'exact', head: true });
    if (!errCount && typeof count === 'number') {
      const proximo = count + 1;
      proximoNumeroPedido = `DB-${String(proximo).padStart(2, '0')}`;
    }
  } catch (e) {
    console.warn('Não foi possível obter contagem de pedidos:', e);
  }

  const novoPedido = {
    cliente_id: usuario.id,
    valor_total: total,
    status: 'aguardando_confirmacao',
    tipo_entrega: tipoEntregaAtual,
    endereco_entrega: tipoEntregaAtual === 'entrega' ? endereco : null,
    data_agendada: dataSelecionada,
    horario_agendado: horarioSelecionado,
    observacoes: observacoes || null,
    forma_pagamento: formaPagamento,
    numero_pedido: proximoNumeroPedido
  };

  let { data: pedidoCriado, error: erroPedido } = await db
    .from('pedidos')
    .insert(novoPedido)
    .select()
    .single();

  // Fallback seguro: se a coluna numero_pedido ainda não foi criada no banco Supabase
  if (erroPedido && (erroPedido.message?.includes('numero_pedido') || erroPedido.code === '42703')) {
    const pedidoSemColuna = { ...novoPedido };
    delete pedidoSemColuna.numero_pedido;
    const retry = await db.from('pedidos').insert(pedidoSemColuna).select().single();
    pedidoCriado = retry.data;
    erroPedido = retry.error;
  }

  if (erroPedido) {
    console.error('Erro ao registrar pedido:', erroPedido);
    mostrarToast('Erro ao registrar pedido: ' + erroPedido.message, 'erro');
    btn.disabled = false;
    btn.textContent = 'Confirmar pedido';
    return;
  }

  if (pedidoCriado && !pedidoCriado.numero_pedido) {
    pedidoCriado.numero_pedido = proximoNumeroPedido;
  }

  const itensParaInserir = carrinho.map(i => ({
    pedido_id: pedidoCriado.id,
    produto_id: i.id,
    nome: i.nome,
    preco: Number(i.preco) || 0,
    quantidade: Number(i.quantidade) || 1
  }));

  const { error: erroItens } = await db.from('itens_pedido').insert(itensParaInserir);
  if (erroItens) {
    console.error('Erro ao salvar itens do pedido:', erroItens);
    mostrarToast('Pedido salvo com observações, mas houve falha nos itens.', 'alerta');
  }

  pedidoCriado.itens = carrinho;
  exibirRecibo(pedidoCriado, perfil);
  btn.disabled = false;
  btn.textContent = 'Confirmar pedido';
}

function exibirRecibo(pedido, perfil) {
  const nomeCliente = perfil?.nome || 'Cliente';
  const numeroRecibo = pedido.numero_pedido || (pedido.id ? `DB-${String(pedido.id).slice(0, 4).toUpperCase()}` : 'DB-01');
  const itensFormatados = pedido.itens.map(i => `${i.quantidade}x ${i.nome}`).join(', ');

  const reciboConteudo = document.getElementById('reciboConteudo');
  if (reciboConteudo) {
    reciboConteudo.innerHTML = `
      <div class="recibo-linha-detalhe"><span>Nº do pedido</span><span style="font-weight:700; color:var(--marrom);">${escapeHtml(numeroRecibo)}</span></div>
      <div class="recibo-linha-detalhe"><span>Cliente</span><span>${escapeHtml(nomeCliente)}</span></div>
      <div class="recibo-linha-detalhe"><span>Itens</span><span>${escapeHtml(itensFormatados)}</span></div>
      <div class="recibo-linha-detalhe"><span>Modalidade</span><span>${pedido.tipo_entrega === 'entrega' ? 'Entrega em domicílio' : 'Retirada na loja'}</span></div>
      ${pedido.endereco_entrega ? `<div class="recibo-linha-detalhe"><span>Endereço</span><span>${escapeHtml(pedido.endereco_entrega)}</span></div>` : ''}
      <div class="recibo-linha-detalhe"><span>Data da encomenda</span><span>${escapeHtml(formatarData(pedido.data_agendada))}</span></div>
      <div class="recibo-linha-detalhe"><span>Horário agendado</span><span>${escapeHtml(pedido.horario_agendado || '')}</span></div>
      <div class="recibo-linha-detalhe"><span>Forma de pagamento</span><span>${escapeHtml(pedido.forma_pagamento || '')}</span></div>
      <div class="recibo-linha-detalhe" style="font-weight:700;"><span>Total</span><span style="color:var(--dourado-escuro); font-size:1.1rem;">${formatarPreco(pedido.valor_total)}</span></div>
    `;
  }

  // Montagem limpa e segura da mensagem do WhatsApp (evita caracteres corrompidos no WhatsApp Web/Desktop)
  const totalFormatado = formatarPreco(pedido.valor_total).replace(/[\u00A0\u202F]/g, ' ');
  const linhasTexto = [
    `Olá! Gostaria de confirmar meu pedido *${numeroRecibo}* na Dona Benta:`,
    '',
    ...pedido.itens.map(i => `- ${i.quantidade}x ${i.nome}`),
    '',
    `*Data:* ${formatarData(pedido.data_agendada)} às ${pedido.horario_agendado}`,
    `*Entrega:* ${pedido.tipo_entrega === 'entrega' ? pedido.endereco_entrega : 'Retirada na loja'}`,
    `*Total:* ${totalFormatado}`,
    `*Pagamento:* ${pedido.forma_pagamento}`
  ];

  if (pedido.observacoes) {
    linhasTexto.push(`*Obs:* ${pedido.observacoes}`);
  }

  const mensagemCodificada = encodeURIComponent(linhasTexto.join('\n'));
  const btnWhatsapp = document.getElementById('btnWhatsapp');
  if (btnWhatsapp) {
    btnWhatsapp.href = `https://api.whatsapp.com/send?phone=${NUMERO_WHATSAPP}&text=${mensagemCodificada}`;
  }

  if (typeof limparCarrinho === 'function') {
    limparCarrinho();
  }

  const overlay = document.getElementById('reciboOverlay');
  if (overlay) overlay.classList.add('aberto');
}

document.addEventListener('DOMContentLoaded', () => {
  iniciarCheckout();
});