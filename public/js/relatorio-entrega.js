// ============================================
// DONA BENTA — js/relatorio-entrega.js
// Aba "Entregas" do painel: escolhe os pedidos a entregar no dia e imprime
// um romaneio (prévia em modal) em formato de cupom (impressora térmica de 80mm ou 58mm).
// Só aparecem pedidos de entrega em domicílio que ainda não foram entregues
// (nem cancelados).
// ============================================

function reHoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function reDia(p) {
  return String(p.data_agendada || '').slice(0, 10);
}

function reNumero(p) {
  if (p.numero_pedido) return p.numero_pedido;
  return p.id ? `#${String(p.id).slice(0, 6).toUpperCase()}` : '—';
}

function rePendentesDeEntrega() {
  return PEDIDOS_ADMIN.filter(p =>
    p.tipo_entrega === 'entrega' && p.status !== 'entregue' && p.status !== 'cancelado'
  );
}

function renderizarEntregasAdmin(area) {
  area.innerHTML = `
    <div class="cartao">
      <div class="fin-topo">
        <h3>Relatório de entrega</h3>
        <span class="fin-contagem" id="entContagem"></span>
      </div>
      <p style="color: var(--marrom-claro); font-size: 0.9rem; margin-bottom: 12px;">
        Marque os pedidos que saem para entrega e imprima o romaneio na impressora de cupom.
        Pedidos já entregues ou cancelados não aparecem.
      </p>
      <div class="fin-filtros ent-filtros">
        <div class="ent-campo">
          <span>Dia da entrega</span>
          <input type="date" id="entData" value="${reHoje()}">
        </div>
        <label class="ent-campo ent-campo-check">
          <input type="checkbox" id="entTodasDatas"> Todas as datas
        </label>
        <button type="button" class="btn btn-primario fin-relatorio" id="btnImprimirEntrega">
          <span class="material-symbols-outlined" aria-hidden="true">print</span>
          Imprimir selecionados
        </button>
      </div>
      <label class="ent-selecionar-todos">
        <input type="checkbox" id="entMarcarTodos"> Selecionar todos
      </label>
      <div id="entLista" class="ent-lista"></div>
    </div>
  `;

  const inputData = document.getElementById('entData');
  estilizarData(inputData);
  const todasDatas = document.getElementById('entTodasDatas');
  const marcarTodos = document.getElementById('entMarcarTodos');
  const lista = document.getElementById('entLista');

  const visiveis = () => {
    const dia = inputData.value;
    return rePendentesDeEntrega()
      .filter(p => todasDatas.checked || reDia(p) === dia)
      .sort((a, b) =>
        reDia(a).localeCompare(reDia(b)) ||
        String(a.horario_agendado || '').localeCompare(String(b.horario_agendado || ''))
      );
  };

  const atualizarContagem = () => {
    const total = lista.querySelectorAll('input[type=checkbox]').length;
    const marcados = lista.querySelectorAll('input[type=checkbox]:checked').length;
    document.getElementById('entContagem').textContent = `${marcados} de ${total} selecionados`;
    marcarTodos.checked = total > 0 && marcados === total;
    marcarTodos.indeterminate = marcados > 0 && marcados < total;
  };

  const renderLista = () => {
    inputData.disabled = todasDatas.checked;
    inputData._sincronizarData?.();
    const pedidos = visiveis();
    if (!pedidos.length) {
      lista.innerHTML = '<p class="ent-vazio">Nenhum pedido de entrega pendente para este dia.</p>';
    } else {
      lista.innerHTML = pedidos.map(p => `
        <label class="ent-item">
          <input type="checkbox" value="${escapeHtml(p.id)}" checked>
          <span class="ent-info">
            <span class="ent-linha1">
              <strong>${escapeHtml(p.perfis?.nome || 'Cliente')}</strong>
              <span class="badge ${STATUS_INFO[p.status]?.classe || 'badge-info'}">${escapeHtml(STATUS_INFO[p.status]?.rotulo || p.status || '')}</span>
            </span>
            <span class="ent-endereco">${escapeHtml(p.endereco_entrega || 'Endereço não informado')}</span>
            <span class="ent-meta">${escapeHtml(reNumero(p))} · ${escapeHtml(formatarData(p.data_agendada) || 'sem data')}${p.horario_agendado ? ' · ' + escapeHtml(p.horario_agendado) : ''}</span>
          </span>
        </label>
      `).join('');
    }
    lista.querySelectorAll('input[type=checkbox]').forEach(c => c.addEventListener('change', atualizarContagem));
    atualizarContagem();
  };

  inputData.addEventListener('change', renderLista);
  todasDatas.addEventListener('change', renderLista);
  marcarTodos.addEventListener('change', () => {
    lista.querySelectorAll('input[type=checkbox]').forEach(c => { c.checked = marcarTodos.checked; });
    atualizarContagem();
  });

  document.getElementById('btnImprimirEntrega').addEventListener('click', () => {
    const ids = new Set([...lista.querySelectorAll('input[type=checkbox]:checked')].map(c => c.value));
    const selecionados = visiveis().filter(p => ids.has(String(p.id)));
    if (!selecionados.length) {
      mostrarToast('Selecione pelo menos um pedido.', 'info');
      return;
    }
    abrirModalCupomEntrega(selecionados, { dia: todasDatas.checked ? null : inputData.value });
  });

  renderLista();
}

function htmlCupomEntrega(pedidos, { dia = null } = {}) {
  const agora = new Date();
  const emitido = `${formatarData(agora)} ${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;

  const blocos = pedidos.map((p, i) => `
    <div class="cupom-ped">
      <div class="cupom-topo"><span>${i + 1}. ${escapeHtml(reNumero(p))}</span><span>${escapeHtml(p.horario_agendado || '')}</span></div>
      ${dia ? '' : `<div>${escapeHtml(formatarData(p.data_agendada) || 'Sem data')}</div>`}
      <div class="cupom-nome">${escapeHtml(p.perfis?.nome || 'Cliente')}</div>
      ${p.perfis?.telefone ? `<div>Tel: ${escapeHtml(p.perfis.telefone)}</div>` : ''}
      <div class="cupom-end">${escapeHtml(p.endereco_entrega || 'Endereço não informado')}</div>
      ${p.observacoes ? `<div class="cupom-obs">Obs: ${escapeHtml(p.observacoes)}</div>` : ''}
      <div class="cupom-ass">Recebido: ______________________</div>
    </div>
  `).join('');

  return `
    <div class="cupom-cab">
      <b>DONA BENTA</b>
      ROMANEIO DE ENTREGA<br>
      ${dia ? `Dia ${escapeHtml(formatarData(dia))}<br>` : ''}
      ${pedidos.length} ${pedidos.length === 1 ? 'pedido' : 'pedidos'}
    </div>
    ${blocos}
    <div class="cupom-rod">Emitido em ${escapeHtml(emitido)}</div>`;
}

function injetarModalCupomEntrega() {
  if (document.getElementById('modalCupomEntrega')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay" id="modalCupomEntrega" role="dialog" aria-modal="true" aria-labelledby="cupomTitulo">
      <div class="modal-cartao cupom-modal">
        <div class="modal-cabecalho cupom-modal-cab">
          <h3 id="cupomTitulo">Romaneio de entrega</h3>
          <button class="modal-fechar" id="cupomX" aria-label="Fechar"><span class="material-symbols-outlined">close</span></button>
        </div>
        <div class="cupom-opcoes">
          <span>Tamanho do papel</span>
          <select id="cupomLargura" class="admin-select-filtro" aria-label="Tamanho do papel">
            <option value="80">Papel 80mm</option>
            <option value="58">Papel 58mm</option>
          </select>
        </div>
        <div class="cupom-previa"><div class="cupom-papel" id="cupomPapel"></div></div>
        <div class="rf-rodape cupom-rodape">
          <button type="button" class="btn btn-outline" id="cupomFechar">Fechar</button>
          <button type="button" class="btn btn-primario" id="cupomImprimir">
            <span class="material-symbols-outlined" aria-hidden="true">print</span>
            Imprimir
          </button>
        </div>
      </div>
    </div>
  `);

  const modal = document.getElementById('modalCupomEntrega');
  const fechar = () => modal.classList.remove('aberto');
  document.getElementById('cupomX').addEventListener('click', fechar);
  document.getElementById('cupomFechar').addEventListener('click', fechar);
  modal.addEventListener('click', (e) => { if (e.target === modal) fechar(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });

  const selLargura = document.getElementById('cupomLargura');
  estilizarSelect(selLargura);
  selLargura.addEventListener('change', () => {
    aplicarLarguraCupom(selLargura.value);
    try { localStorage.setItem('db_largura_cupom', selLargura.value); } catch (err) { /* sem armazenamento local */ }
  });

  // Imprime a própria página mostrando só o cupom (CSS @media print em tema.css).
  // Funciona também no celular, onde imprimir por iframe/aba falha.
  document.getElementById('cupomImprimir').addEventListener('click', () => {
    const papel = document.getElementById('cupomLargura').value === '58' ? 58 : 80;
    // @page não pode ficar dentro de @media (o navegador ignora e cai no A4):
    // vai solto, numa <style> que só existe durante a impressão.
    const estilo = document.createElement('style');
    estilo.id = 'cupomPageStyle';
    // Chrome não aceita altura "auto" no @page (volta para A4): usa a altura real do cupom.
    const altura = Math.max(40, Math.ceil(document.getElementById('cupomPapel').offsetHeight * 25.4 / 96) + 4);
    estilo.textContent = `@page { size: ${papel}mm ${altura}mm; margin: 0; }`;
    document.head.appendChild(estilo);
    document.body.classList.add('imprimindo-cupom');
    window.addEventListener('afterprint', () => {
      document.body.classList.remove('imprimindo-cupom');
      estilo.remove();
    }, { once: true });
    window.print();
  });
}

function aplicarLarguraCupom(largura) {
  const papel = largura === '58' ? 58 : 80;
  const papelEl = document.getElementById('cupomPapel');
  papelEl.classList.toggle('cupom-58', papel === 58);
  papelEl.classList.toggle('cupom-80', papel === 80);
  document.getElementById('cupomLargura').value = String(papel);
  document.getElementById('cupomLargura')._cddSincronizar?.();
}

function abrirModalCupomEntrega(pedidos, opcoes) {
  injetarModalCupomEntrega();
  document.getElementById('cupomPapel').innerHTML = htmlCupomEntrega(pedidos, opcoes);
  let largura = '80';
  try { largura = localStorage.getItem('db_largura_cupom') || '80'; } catch (e) { /* sem armazenamento local */ }
  aplicarLarguraCupom(largura);
  document.getElementById('modalCupomEntrega').classList.add('aberto');
}


