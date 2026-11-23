// ============================================
// DONA BENTA — js/relatorio-entrega.js
// Aba "Entregas" do painel: escolhe os pedidos a entregar no dia e imprime
// um romaneio em formato de cupom (impressora térmica de 80mm ou 58mm).
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
        <label class="ent-campo">
          <span>Dia da entrega</span>
          <input type="date" id="entData" value="${reHoje()}">
        </label>
        <label class="ent-campo ent-campo-check">
          <input type="checkbox" id="entTodasDatas"> Todas as datas
        </label>
        <select id="entLargura" class="admin-select-filtro" aria-label="Largura do papel">
          <option value="80">Papel 80mm</option>
          <option value="58">Papel 58mm</option>
        </select>
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
  const todasDatas = document.getElementById('entTodasDatas');
  const marcarTodos = document.getElementById('entMarcarTodos');
  const lista = document.getElementById('entLista');

  try {
    const salva = localStorage.getItem('db_largura_cupom');
    if (salva) document.getElementById('entLargura').value = salva;
  } catch (e) { /* sem armazenamento local */ }

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
    const largura = document.getElementById('entLargura').value;
    try { localStorage.setItem('db_largura_cupom', largura); } catch (e) { /* sem armazenamento local */ }
    imprimirCupomEntrega(selecionados, {
      largura,
      dia: todasDatas.checked ? null : inputData.value,
    });
  });

  renderLista();
}

function htmlCupomEntrega(pedidos, { largura = '80', dia = null } = {}) {
  const papel = largura === '58' ? 58 : 80;
  const util = papel === 58 ? 48 : 72; // área imprimível típica
  const agora = new Date();
  const emitido = `${formatarData(agora)} ${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;

  const blocos = pedidos.map((p, i) => `
    <div class="ped">
      <div class="topo"><span>${i + 1}. ${escapeHtml(reNumero(p))}</span><span>${escapeHtml(p.horario_agendado || '')}</span></div>
      ${dia ? '' : `<div>${escapeHtml(formatarData(p.data_agendada) || 'Sem data')}</div>`}
      <div class="nome">${escapeHtml(p.perfis?.nome || 'Cliente')}</div>
      ${p.perfis?.telefone ? `<div>Tel: ${escapeHtml(p.perfis.telefone)}</div>` : ''}
      <div class="end">${escapeHtml(p.endereco_entrega || 'Endereço não informado')}</div>
      ${p.observacoes ? `<div class="obs">Obs: ${escapeHtml(p.observacoes)}</div>` : ''}
      <div class="ass">Recebido: ______________________</div>
    </div>
  `).join('');

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Romaneio de entrega</title>
<style>
  @page { size: ${papel}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; }
  body { width: ${util}mm; margin: 0 auto; padding: 2mm 0 6mm;
         font: ${papel === 58 ? '11px' : '12px'}/1.3 "Courier New", Courier, monospace; }
  .cab { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 2mm; margin-bottom: 2mm; }
  .cab b { font-size: 1.25em; display: block; }
  .ped { border-bottom: 1px dashed #000; padding: 2mm 0; page-break-inside: avoid; break-inside: avoid; }
  .topo { display: flex; justify-content: space-between; font-weight: bold; }
  .nome { font-weight: bold; font-size: 1.15em; margin-top: 1mm; text-transform: uppercase; }
  .end { margin-top: 1mm; word-wrap: break-word; overflow-wrap: anywhere; }
  .obs { margin-top: 1mm; font-style: italic; overflow-wrap: anywhere; }
  .ass { margin-top: 3mm; }
  .rod { text-align: center; margin-top: 2mm; }
  .barra { display: flex; gap: 8px; justify-content: center; padding: 10px 0 14px; font-family: system-ui, sans-serif; }
  .barra button { font: 600 15px system-ui, sans-serif; padding: 10px 18px; border-radius: 999px; border: 1px solid #000; background: #fff; color: #000; }
  .barra button.pri { background: #000; color: #fff; }
  @media screen { body { width: auto; max-width: ${util}mm; padding: 0 12px 24px; } }
  @media print { .barra { display: none; } }
</style></head>
<body>
  <div class="barra"><button type="button" class="pri" id="reImprimir">Imprimir</button><button type="button" id="reFechar">Fechar</button></div>
  <div class="cab">
    <b>DONA BENTA</b>
    ROMANEIO DE ENTREGA<br>
    ${dia ? `Dia ${escapeHtml(formatarData(dia))}<br>` : ''}
    ${pedidos.length} ${pedidos.length === 1 ? 'pedido' : 'pedidos'}
  </div>
  ${blocos}
  <div class="rod">Emitido em ${escapeHtml(emitido)}</div>
</body></html>`;
}

// Abre o cupom numa aba própria e imprime de lá. Imprimir por iframe escondido não serve:
// no iPhone/Safari o diálogo imprime a página do painel inteira em vez do iframe.
function imprimirCupomEntrega(pedidos, opcoes) {
  const html = htmlCupomEntrega(pedidos, opcoes);
  const aba = window.open('', '_blank'); // precisa ser no clique, senão vira pop-up bloqueado
  if (aba) {
    aba.document.open();
    aba.document.write(html);
    aba.document.close();
    aba.document.getElementById('reImprimir')?.addEventListener('click', () => aba.print());
    aba.document.getElementById('reFechar')?.addEventListener('click', () => aba.close());
    aba.setTimeout(() => { aba.focus(); aba.print(); }, 400);
    return;
  }

  // Pop-up bloqueado: tenta pelo iframe (funciona no computador).
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed; right:0; bottom:0; width:0; height:0; border:0;';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => iframe.remove(), 60000);
  }, 250);
  mostrarToast('Permita pop-ups deste site para imprimir o romaneio no celular.', 'info');
}

window.renderizarEntregasAdmin = renderizarEntregasAdmin;
