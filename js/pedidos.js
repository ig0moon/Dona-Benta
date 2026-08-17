const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const DIAS_SEMANA = ['D','S','T','Q','Q','S','S'];
const HORARIOS_PADRAO = ['09:00','11:00','14:00','16:00','17:30','19:00']; // Novos horários

let mesAtual = new Date().getMonth();
let anoAtual = new Date().getFullYear();
let dataSelecionada = null;
let horarioSelecionado = null;
let tipoEntrega = 'retirada';
let horariosOcupados = {};

async function iniciarCheckout() {
  const carrinho = lerCarrinho();
  const layout = document.getElementById('checkoutLayout');

  if (carrinho.length === 0) {
    layout.innerHTML = `
      <div class="vazio" style="grid-column: 1/-1;">
        <span class="material-symbols-outlined">shopping_bag</span>
        <h3>Seu carrinho está vazio</h3>
        <p>Adicione produtos antes de agendar um pedido.</p>
        <a href="catalogo.html" class="btn btn-primario" style="margin-top:16px;">Ver catálogo</a>
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
        <p>Você precisa estar logado para agendar um pedido.</p>
        <a href="login.html" class="btn btn-primario" style="margin-top:16px;">Entrar / Cadastrar</a>
      </div>
    `;
    return;
  }

  await carregarHorariosOcupados();
  renderizarCheckout();
}

async function carregarHorariosOcupados() {
  try {
    const { data, error } = await db.from('pedidos').select('data_agendada, horario_agendado').neq('status', 'cancelado');
    if (!error && data) {
      data.forEach(p => {
        if (!horariosOcupados[p.data_agendada]) horariosOcupados[p.data_agendada] = [];
        horariosOcupados[p.data_agendada].push(p.horario_agendado);
      });
    }
  } catch (e) {
    console.warn('Não foi possível carregar horários ocupados (Supabase ainda não configurado).');
  }
}

function renderizarCheckout() {
  const layout = document.getElementById('checkoutLayout');
  const carrinho = lerCarrinho();
  const total = totalCarrinho();

  layout.innerHTML = `
    <div>
      <div class="cartao" style="margin-bottom: 20px;">
        <h3 style="margin-bottom: 16px;">Tipo de entrega</h3>
        <div class="tipo-entrega-opcoes">
          <div class="opcao-entrega selecionada" id="opcaoRetirada">
            <span class="material-symbols-outlined">storefront</span>
            <h4>Retirar na loja</h4>
          </div>
          <div class="opcao-entrega" id="opcaoEntrega">
            <span class="material-symbols-outlined">local_shipping</span>
            <h4>Entrega no endereço</h4>
          </div>
        </div>
        <div class="campo" id="campoEndereco" style="display:none;">
          <label for="enderecoEntrega">Endereço completo</label>
          <input type="text" id="enderecoEntrega" placeholder="Rua, número, bairro, complemento">
        </div>
      </div>

      <div class="cartao calendario-cartao">
        <h3 style="margin-bottom: 16px;">Escolha a data</h3>
        <div class="calendario-cabecalho">
          <button id="mesAnterior" aria-label="Mês anterior"><span class="material-symbols-outlined">chevron_left</span></button>
          <span class="calendario-mes" id="calendarioMes"></span>
          <button id="mesProximo" aria-label="Próximo mês"><span class="material-symbols-outlined">chevron_right</span></button>
        </div>
        <div class="calendario-grade-dias">
          ${DIAS_SEMANA.map(d => `<span>${d}</span>`).join('')}
        </div>
        <div class="calendario-grade-datas" id="calendarioDatas"></div>
      </div>

      <div class="cartao" id="cartaoHorarios" style="display:none;">
        <h3 style="margin-bottom: 4px;">Escolha o horário</h3>
        <p style="font-size: 0.85rem; color: var(--marrom-claro);" id="dataEscolhidaTexto"></p>
        <div class="horarios-grade" id="horariosGrade"></div>
      </div>

      <div class="cartao" style="margin-top: 20px;">
        <h3 style="margin-bottom: 16px;">Observações</h3>
        <div class="campo" style="margin-bottom: 0;">
          <textarea id="observacoesPedido" rows="3" placeholder="Alguma observação sobre o pedido? (ex: sem açúcar, mensagem no bolo, etc.)"></textarea>
        </div>
      </div>
    </div>

    <div class="cartao" style="position: sticky; top: 100px;">
      <h3 style="margin-bottom: 16px;">Resumo do pedido</h3>
      ${carrinho.map(item => `
        <div class="resumo-item-mini">
          <span>${item.quantidade}x ${item.nome}</span>
          <span>${formatarPreco(item.preco * item.quantidade)}</span>
        </div>
      `).join('')}
      <div class="resumo-linha total">
        <span>Total</span>
        <span>${formatarPreco(total)}</span>
      </div>

      <div class="campo" style="margin-top: 18px;">
        <label for="formaPagamento">Forma de pagamento</label>
        <select id="formaPagamento">
          <option value="pix">Pix</option>
          <option value="cartao">Cartão (na entrega/retirada)</option>
          <option value="dinheiro">Dinheiro</option>
        </select>
      </div>

      <button class="btn btn-primario btn-bloco" id="btnConfirmarPedido" style="margin-top: 12px;">
        <span class="material-symbols-outlined">task_alt</span>
        Confirmar pedido
      </button>
    </div>
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
  document.getElementById('opcaoRetirada').classList.toggle('selecionada', tipo === 'retirada');
  document.getElementById('opcaoEntrega').classList.toggle('selecionada', tipo === 'entrega');
  document.getElementById('campoEndereco').style.display = tipo === 'entrega' ? 'block' : 'none';
}

function mudarMes(delta) {
  mesAtual += delta;
  if (mesAtual < 0) { mesAtual = 11; anoAtual--; }
  if (mesAtual > 11) { mesAtual = 0; anoAtual++; }
  renderizarCalendario();
}

function renderizarCalendario() {
  document.getElementById('calendarioMes').textContent = `${MESES[mesAtual]} de ${anoAtual}`;

  const primeiroDia = new Date(anoAtual, mesAtual, 1).getDay();
  const diasNoMes = new Date(anoAtual, mesAtual + 1, 0).getDate();
  const hoje = new Date();
  hoje.setHours(0,0,0,0);

  let html = '';
  for (let i = 0; i < primeiroDia; i++) {
    html += `<div class="data-celula vazia"></div>`;
  }

  for (let dia = 1; dia <= diasNoMes; dia++) {
    const dataObj = new Date(anoAtual, mesAtual, dia);
    const dataStr = `${anoAtual}-${String(mesAtual+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
    const passada = dataObj < hoje;
    const domingo = dataObj.getDay() === 0;
    const selecionada = dataStr === dataSelecionada;

    if (passada || domingo) {
      html += `<div class="data-celula passada">${dia}</div>`;
    } else {
      html += `<div class="data-celula ${selecionada ? 'selecionada' : ''}" data-data="${dataStr}">${dia}</div>`;
    }
  }

  document.getElementById('calendarioDatas').innerHTML = html;

  document.querySelectorAll('.data-celula[data-data]').forEach(cel => {
    cel.addEventListener('click', () => selecionarData(cel.dataset.data));
  });
}

function selecionarData(dataStr) {
  dataSelecionada = dataStr;
  horarioSelecionado = null;
  renderizarCalendario();

  const cartaoHorarios = document.getElementById('cartaoHorarios');
  cartaoHorarios.style.display = 'block';
  
  // CORREÇÃO DO DIA ANTERIOR (Fuso Horário)
  // Quebramos a string "2024-08-17" e montamos visualmente para "17/08/2024"
  const [ano, mes, dia] = dataStr.split('-');
  document.getElementById('dataEscolhidaTexto').textContent = `Horários disponíveis para ${dia}/${mes}/${ano}`;

  const ocupados = horariosOcupados[dataStr] || [];
  document.getElementById('horariosGrade').innerHTML = HORARIOS_PADRAO.map(h => {
    
    // CORREÇÃO DO BLOQUEIO DINÂMICO: Se o horário 'h' já estiver na lista de ocupados, bloqueia.
    const indisponivel = ocupados.includes(h); 
    
    return `<button class="horario-btn" data-horario="${h}" ${indisponivel ? 'disabled' : ''}>
              ${h} ${indisponivel ? '(Esgotado)' : ''}
            </button>`;
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
  if (!dataSelecionada) { mostrarToast('Escolha uma data para o pedido', 'erro'); return; }
  if (!horarioSelecionado) { mostrarToast('Escolha um horário para o pedido', 'erro'); return; }

  const tipoEntregaAtual = tipoEntrega;
  const endereco = document.getElementById('enderecoEntrega')?.value || '';
  if (tipoEntregaAtual === 'entrega' && !endereco.trim()) {
    mostrarToast('Informe o endereço de entrega', 'erro');
    return;
  }

  const btn = document.getElementById('btnConfirmarPedido');
  btn.disabled = true;

  const carrinho = lerCarrinho();
  const total = totalCarrinho();
  const observacoes = document.getElementById('observacoesPedido').value;
  const formaPagamento = document.getElementById('formaPagamento').value;
  const usuario = await usuarioAtual();
  const perfil = await perfilAtual();

  // 1. Insere apenas os dados principais na tabela 'pedidos' (sem a coluna 'itens')
  const novoPedido = {
    cliente_id: usuario.id,
    valor_total: total,
    status: 'aguardando_confirmacao',
    tipo_entrega: tipoEntregaAtual,
    endereco_entrega: tipoEntregaAtual === 'entrega' ? endereco : null,
    data_agendada: dataSelecionada,
    horario_agendado: horarioSelecionado,
    observacoes,
    forma_pagamento: formaPagamento
  };

  const { data: pedidoCriado, error: erroPedido } = await db.from('pedidos').insert(novoPedido).select().single();

  if (erroPedido) {
    console.error('Erro ao criar pedido:', erroPedido);
    mostrarToast('Erro ao registrar pedido: ' + erroPedido.message, 'erro');
    btn.disabled = false;
    return;
  }

  // 2. Insere os itens na tabela relacional 'itens_pedido' usando o id gerado do pedido
  const itensParaInserir = carrinho.map(i => ({
    pedido_id: pedidoCriado.id,
    produto_id: i.id,
    nome: i.nome,
    preco: i.preco,
    quantidade: i.quantidade
  }));

  const { error: erroItens } = await db.from('itens_pedido').insert(itensParaInserir);

  if (erroItens) {
    console.error('Erro ao salvar itens do pedido:', erroItens);
    mostrarToast('Erro ao salvar os itens do pedido.', 'erro');
    btn.disabled = false;
    return;
  }

  // Anexa os itens ao objeto para exibir no recibo visualmente
  pedidoCriado.itens = carrinho;

  exibirRecibo(pedidoCriado, perfil);
  btn.disabled = false;
}

function exibirRecibo(pedido, perfil) {
  const nomeCliente = perfil?.nome || 'Cliente';
  const numeroRecibo = pedido.id.slice(0, 8).toUpperCase();

  document.getElementById('reciboConteudo').innerHTML = `
    <div class="recibo-linha-detalhe"><span>Nº do pedido</span><span>#${numeroRecibo}</span></div>
    <div class="recibo-linha-detalhe"><span>Cliente</span><span>${nomeCliente}</span></div>
    <div class="recibo-linha-detalhe"><span>Itens</span><span>${pedido.itens.map(i => `${i.quantidade}x ${i.nome}`).join(', ')}</span></div>
    <div class="recibo-linha-detalhe"><span>Tipo</span><span>${pedido.tipo_entrega === 'entrega' ? 'Entrega' : 'Retirada na loja'}</span></div>
    ${pedido.endereco_entrega ? `<div class="recibo-linha-detalhe"><span>Endereço</span><span>${pedido.endereco_entrega}</span></div>` : ''}
    <div class="recibo-linha-detalhe"><span>Data</span><span>${formatarData(pedido.data_agendada)}</span></div>
    <div class="recibo-linha-detalhe"><span>Horário</span><span>${pedido.horario_agendado}</span></div>
    <div class="recibo-linha-detalhe"><span>Pagamento</span><span>${pedido.forma_pagamento}</span></div>
    <div class="recibo-linha-detalhe"><span>Total</span><span>${formatarPreco(pedido.valor_total)}</span></div>
  `;

  const mensagem = `Olá! Gostaria de confirmar meu pedido *#${numeroRecibo}* na Dona Benta:%0A%0A` +
    pedido.itens.map(i => `• ${i.quantidade}x ${i.nome}`).join('%0A') +
    `%0A%0A📅 Data: ${formatarData(pedido.data_agendada)} às ${pedido.horario_agendado}%0A` +
    `📦 ${pedido.tipo_entrega === 'entrega' ? 'Entrega: ' + pedido.endereco_entrega : 'Retirada na loja'}%0A` +
    `💰 Total: ${formatarPreco(pedido.valor_total)}%0A` +
    `💳 Pagamento: ${pedido.forma_pagamento}`;

  document.getElementById('btnWhatsapp').href = `https://wa.me/${NUMERO_WHATSAPP}?text=${mensagem}`;

  limparCarrinho();
  document.getElementById('reciboOverlay').classList.add('aberto');
}

iniciarCheckout();