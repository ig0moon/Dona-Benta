// ============================================
// DONA BENTA — js/relatorio-financeiro.js
// Relatório financeiro do painel: prévia no modal (responsiva) e PDF em A4.
//
// O PDF não imprime mais a página do painel: é montado um documento próprio,
// aberto numa aba nova, com o diálogo de impressão do navegador ("Salvar como PDF").
// Antes o window.print() imprimia o modal com rolagem interna e o PDF saía cortado.
// ============================================

const RF_ROTULOS_STATUS = { todos: 'Todos os pagamentos', pago: 'Somente pagos', pendente: 'Somente pendentes' };
const RF_ROTULOS_METODO = { todos: 'Todos os métodos', pix: 'Somente Pix', cartao: 'Somente cartão' };

function rfEhPix(p) {
  return (p.forma_pagamento || '').toLowerCase().includes('pix');
}

function rfEhCartao(p) {
  return (p.forma_pagamento || '').toLowerCase().includes('cart');
}

function rfSoma(lista) {
  return lista.reduce((s, p) => s + (Number(p.valor_total) || 0), 0);
}

function rfData(p) {
  const d = new Date(p.criado_em || p.created_at || '');
  return isNaN(d.getTime()) ? null : d;
}

function rfNumero(p) {
  if (p.numero_pedido) return p.numero_pedido;
  return p.id ? `#${String(p.id).slice(0, 6).toUpperCase()}` : '—';
}

function rfAgendamento(p) {
  if (!p.data_agendada) return '—';
  return `${formatarData(p.data_agendada)}${p.horario_agendado ? ' · ' + p.horario_agendado : ''}`;
}

// Junta tudo o que a prévia e o PDF mostram, a partir dos pedidos e dos filtros da tela.
function montarDadosRelatorio(pedidos, filtros = {}) {
  let lista = Array.isArray(pedidos) ? [...pedidos] : [];

  if (filtros.filtroStatus === 'pago') lista = lista.filter(p => pedidoPago(p));
  else if (filtros.filtroStatus === 'pendente') lista = lista.filter(p => !pedidoPago(p));

  if (filtros.filtroMetodo === 'pix') lista = lista.filter(rfEhPix);
  else if (filtros.filtroMetodo === 'cartao') lista = lista.filter(rfEhCartao);

  const termo = (filtros.termo || '').trim().toLowerCase();
  if (termo) {
    lista = lista.filter(p =>
      (p.numero_pedido || '').toLowerCase().includes(termo) ||
      (p.perfis?.nome || '').toLowerCase().includes(termo) ||
      (p.perfis?.telefone || '').toLowerCase().includes(termo)
    );
  }

  // Mais recentes primeiro
  lista.sort((a, b) => (rfData(b)?.getTime() || 0) - (rfData(a)?.getTime() || 0));

  const pagos = lista.filter(p => pedidoPago(p));
  const pendentes = lista.filter(p => !pedidoPago(p));
  const datas = lista.map(rfData).filter(Boolean).sort((a, b) => a - b);
  const fmtDia = d => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const filtrosTexto = [
    RF_ROTULOS_STATUS[filtros.filtroStatus] || RF_ROTULOS_STATUS.todos,
    RF_ROTULOS_METODO[filtros.filtroMetodo] || RF_ROTULOS_METODO.todos,
  ];
  if (termo) filtrosTexto.push(`Busca: "${filtros.termo.trim()}"`);

  const agora = new Date();
  return {
    lista,
    pagos,
    pendentes,
    totalRecebido: rfSoma(pagos),
    totalPix: rfSoma(pagos.filter(rfEhPix)),
    qtdPix: pagos.filter(rfEhPix).length,
    totalCartao: rfSoma(pagos.filter(rfEhCartao)),
    qtdCartao: pagos.filter(rfEhCartao).length,
    totalPendente: rfSoma(pendentes),
    ticketMedio: pagos.length ? rfSoma(pagos) / pagos.length : 0,
    periodo: datas.length
      ? (fmtDia(datas[0]) === fmtDia(datas[datas.length - 1]) ? fmtDia(datas[0]) : `${fmtDia(datas[0])} a ${fmtDia(datas[datas.length - 1])}`)
      : 'Sem pedidos no filtro',
    filtrosTexto,
    emissao: `${fmtDia(agora)} às ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
    arquivo: `Relatorio-financeiro-Dona-Benta-${agora.toISOString().slice(0, 10)}`,
  };
}

// ---------- Prévia no modal ----------

function injetarModalRelatorioFinanceiro() {
  if (document.getElementById('modalRelatorioFinanceiro')) return;

  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay" id="modalRelatorioFinanceiro" role="dialog" aria-modal="true" aria-labelledby="rfTitulo">
      <div class="modal-cartao rf-modal">
        <div class="modal-cabecalho rf-cabecalho">
          <div>
            <h3 id="rfTitulo">Relatório financeiro</h3>
            <p id="rfSubtitulo"></p>
          </div>
          <button class="modal-fechar" id="fecharModalRelatorio" aria-label="Fechar"><span class="material-symbols-outlined">close</span></button>
        </div>
        <div class="rf-corpo" id="conteudoRelatorioFinanceiro"></div>
        <div class="rf-rodape">
          <button type="button" class="btn btn-outline" id="btnFecharModalRelatorioAcao">Fechar</button>
          <button type="button" class="btn btn-primario" id="btnImprimirRelatorioAcao">
            <span class="material-symbols-outlined" aria-hidden="true">picture_as_pdf</span>
            Baixar PDF
          </button>
        </div>
      </div>
    </div>
  `);

  const modal = document.getElementById('modalRelatorioFinanceiro');
  const fechar = () => modal.classList.remove('aberto');
  document.getElementById('fecharModalRelatorio').addEventListener('click', fechar);
  document.getElementById('btnFecharModalRelatorioAcao').addEventListener('click', fechar);
  document.getElementById('btnImprimirRelatorioAcao').addEventListener('click', () => {
    if (modal._dadosRelatorio) gerarPdfRelatorio(modal._dadosRelatorio);
  });
  modal.addEventListener('click', (e) => { if (e.target === modal) fechar(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });
}

function abrirRelatorioFinanceiroElaborado(filtros = {}) {
  injetarModalRelatorioFinanceiro();
  const modal = document.getElementById('modalRelatorioFinanceiro');
  const corpo = document.getElementById('conteudoRelatorioFinanceiro');
  const d = montarDadosRelatorio(typeof PEDIDOS_ADMIN !== 'undefined' ? PEDIDOS_ADMIN : [], filtros);
  modal._dadosRelatorio = d;

  document.getElementById('rfSubtitulo').textContent =
    `${d.periodo} · ${d.lista.length} ${d.lista.length === 1 ? 'pedido' : 'pedidos'}`;

  const kpi = (valor, rotulo, classe = '') => `
    <div class="rf-kpi ${classe}">
      <span class="rf-kpi-valor">${formatarPreco(valor)}</span>
      <span class="rf-kpi-rotulo">${escapeHtml(rotulo)}</span>
    </div>`;

  corpo.innerHTML = `
    <div class="rf-filtros">${d.filtrosTexto.map(f => `<span>${escapeHtml(f)}</span>`).join('')}</div>

    <div class="rf-kpis">
      ${kpi(d.totalRecebido, `Recebido · ${d.pagos.length} ${d.pagos.length === 1 ? 'pedido' : 'pedidos'}`, 'rf-kpi-destaque')}
      ${kpi(d.totalPendente, `Aguardando · ${d.pendentes.length}`, 'rf-kpi-pendente')}
      ${kpi(d.totalPix, `Pix · ${d.qtdPix}`)}
      ${kpi(d.totalCartao, `Cartão · ${d.qtdCartao}`)}
      ${kpi(d.ticketMedio, 'Ticket médio')}
    </div>

    ${d.lista.length === 0 ? `
      <div class="vazio"><h3>Nenhum pedido neste filtro</h3><p>Ajuste os filtros da tela e gere o relatório de novo.</p></div>
    ` : `
      <table class="rf-tabela">
        <thead>
          <tr><th>Pedido</th><th>Data</th><th>Cliente</th><th>Forma</th><th>Status</th><th class="rf-num">Valor</th></tr>
        </thead>
        <tbody>
          ${d.lista.map(p => {
            const data = rfData(p);
            const pago = pedidoPago(p);
            return `
              <tr>
                <td data-rotulo="Pedido"><strong>${escapeHtml(rfNumero(p))}</strong></td>
                <td data-rotulo="Data">${escapeHtml(data ? formatarDataHora(data.toISOString()) : '—')}</td>
                <td data-rotulo="Cliente"><span>${escapeHtml(p.perfis?.nome || 'Cliente')}<small>${escapeHtml(p.perfis?.telefone || '')}</small></span></td>
                <td data-rotulo="Forma">${escapeHtml(p.forma_pagamento || '—')} · ${p.tipo_entrega === 'entrega' ? 'Entrega' : 'Retirada'}</td>
                <td data-rotulo="Status"><span class="rf-status ${pago ? 'pago' : 'pendente'}">${pago ? 'Pago' : 'Pendente'}</span></td>
                <td data-rotulo="Valor" class="rf-num"><strong>${formatarPreco(p.valor_total)}</strong></td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    `}
  `;

  corpo.scrollTop = 0;
  modal.classList.add('aberto');
  logoRelatorio(); // já prepara o logo do PDF enquanto a prévia está aberta
}

// ---------- PDF (documento A4 próprio) ----------

// Logo reduzido e embutido (data URL): o PNG original tem ~800 KB e, numa aba montada por
// script, nem sempre termina de carregar antes da impressão. Embutido, sai sempre e o PDF fica leve.
let rfLogoPromessa = null;
function logoRelatorio() {
  if (rfLogoPromessa) return rfLogoPromessa;
  rfLogoPromessa = new Promise(resolve => {
    const base = window.BASE_URL || `${window.location.origin}/`;
    const img = new Image();
    const limite = setTimeout(() => resolve(''), 4000);
    img.onload = () => {
      clearTimeout(limite);
      try {
        const altura = 96; // ~2x a altura exibida no PDF, para sair nítido
        const canvas = document.createElement('canvas');
        canvas.height = altura;
        canvas.width = Math.round(img.naturalWidth * (altura / img.naturalHeight));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        resolve('');
      }
    };
    img.onerror = () => { clearTimeout(limite); resolve(''); };
    img.src = `${base}img/HeaderDonaBenta.png`;
  });
  return rfLogoPromessa;
}

function htmlDocumentoRelatorio(d, logo = '') {
  const linhas = d.lista.map(p => {
    const data = rfData(p);
    const pago = pedidoPago(p);
    return `
      <tr>
        <td class="mono">${escapeHtml(rfNumero(p))}</td>
        <td>${escapeHtml(data ? formatarDataHora(data.toISOString()) : '—')}</td>
        <td>${escapeHtml(rfAgendamento(p))}</td>
        <td><strong>${escapeHtml(p.perfis?.nome || 'Cliente')}</strong><br><span class="sub">${escapeHtml(p.perfis?.telefone || '')}</span></td>
        <td>${p.tipo_entrega === 'entrega' ? 'Entrega' : 'Retirada'}</td>
        <td>${escapeHtml(p.forma_pagamento || '—')}</td>
        <td><span class="st ${pago ? 'pago' : 'pend'}">${pago ? 'Pago' : 'Pendente'}</span></td>
        <td class="num">${formatarPreco(p.valor_total)}</td>
      </tr>`;
  }).join('');

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(d.arquivo)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Inter:wght@400;500;600;700&display=swap">
<style>
  @page {
    size: A4;
    margin: 14mm 12mm 18mm;
    @bottom-left { content: "Dona Benta · Relatório financeiro · emitido em ${d.emissao}"; font: 8px Inter, sans-serif; color: #8a7a6d; }
    @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 8px Inter, sans-serif; color: #8a7a6d; }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Inter, system-ui, sans-serif; color: #1a0e08; font-size: 10px; line-height: 1.45; background: #e9e3da; }
  .folha { background: #fff; width: 210mm; min-height: 297mm; margin: 72px auto 32px; padding: 14mm 12mm; box-shadow: 0 2px 18px rgba(0,0,0,.12); }
  .topo { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; padding-bottom: 14px; border-bottom: 2px solid #1a0e08; }
  .topo img { height: 34px; width: auto; display: block; margin-bottom: 8px; }
  .topo .empresa { font-size: 9px; color: #5b4637; }
  .topo .marca { font-family: Fraunces, Georgia, serif; font-weight: 600; font-size: 20px; color: #6b4226; margin-bottom: 6px; }
  .topo .titulo { text-align: right; }
  .topo h1 { font-family: Fraunces, Georgia, serif; font-weight: 600; font-size: 22px; letter-spacing: -.01em; line-height: 1.1; }
  .topo .meta { font-size: 9px; color: #5b4637; margin-top: 6px; }
  .topo .meta b { color: #1a0e08; font-weight: 600; }
  .filtros { margin: 12px 0 14px; font-size: 9px; color: #5b4637; }
  .filtros span { display: inline-block; border: 1px solid #e3d8cb; border-radius: 99px; padding: 2px 8px; margin-right: 4px; }
  .kpis { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr 1fr; border: 1px solid #e3d8cb; border-radius: 8px; overflow: hidden; margin-bottom: 18px; }
  .kpi { padding: 10px 12px; border-right: 1px solid #e3d8cb; }
  .kpi:last-child { border-right: 0; }
  .kpi .v { display: block; font-family: Fraunces, Georgia, serif; font-weight: 600; font-size: 15px; white-space: nowrap; }
  .kpi .r { display: block; font-size: 8.5px; color: #6d5544; margin-top: 2px; }
  .kpi.destaque { background: #f8f4ee; }
  .kpi.destaque .v { font-size: 18px; color: #2b6e43; }
  .kpi.pend .v { color: #a5402f; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  tfoot { display: table-row-group; }
  tr { page-break-inside: avoid; break-inside: avoid; }
  th { text-align: left; font-size: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: #6d5544; padding: 7px 6px; border-bottom: 1.5px solid #1a0e08; }
  td { padding: 7px 6px; border-bottom: 1px solid #eee5da; vertical-align: top; }
  tbody tr:nth-child(even) td { background: #fbf8f4; }
  .mono { font-weight: 600; white-space: nowrap; }
  .sub { color: #8a7a6d; font-size: 8.5px; }
  .num { text-align: right; white-space: nowrap; font-weight: 600; }
  .st { display: inline-block; font-size: 8px; font-weight: 600; padding: 1px 7px; border-radius: 99px; white-space: nowrap; }
  .st.pago { background: #e3f1e7; color: #2b6e43; }
  .st.pend { background: #f8e4df; color: #a5402f; }
  tfoot td { border-bottom: 0; padding-top: 9px; font-size: 10px; }
  tfoot tr.total td { border-top: 1.5px solid #1a0e08; font-weight: 700; }
  .vazio { padding: 28px; text-align: center; color: #6d5544; border: 1px dashed #e3d8cb; border-radius: 8px; }
  .assinaturas { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 46px; page-break-inside: avoid; break-inside: avoid; }
  .assinaturas div { border-top: 1px solid #1a0e08; padding-top: 5px; font-size: 9px; color: #5b4637; text-align: center; }
  .nota { margin-top: 18px; font-size: 8.5px; color: #8a7a6d; }
  .barra { position: fixed; top: 0; left: 0; right: 0; display: flex; gap: 8px; justify-content: center; align-items: center; padding: 12px; background: #1a0e08; z-index: 10; }
  .barra button { font: 600 14px Inter, sans-serif; border: 0; border-radius: 99px; padding: 10px 18px; cursor: pointer; }
  .barra .pri { background: #f2a65a; color: #1a0e08; }
  .barra .sec { background: transparent; color: #f8f4ee; border: 1px solid #f8f4ee; }
  /* Tela pequena: a folha A4 inteira é reduzida para caber (como num leitor de PDF),
     em vez de vazar para os lados. O tamanho real só importa na impressão. */
  .palco { overflow: hidden; }
  .folha.reduzida { margin: 0; transform-origin: top left; }
  @media print {
    body { background: #fff; }
    .barra { display: none; }
    .palco { height: auto !important; overflow: visible; margin: 0 !important; }
    .folha, .folha.reduzida { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; transform: none !important; }
  }
</style>
</head>
<body>
  <div class="barra">
    <button class="pri" id="rfSalvar">Salvar em PDF</button>
    <button class="sec" id="rfFechar">Fechar</button>
  </div>
  <div class="palco">
  <main class="folha">
    <header class="topo">
      <div>
        ${logo ? `<img src="${logo}" alt="Dona Benta">` : '<div class="marca">Dona Benta</div>'}
        <div class="empresa">Rua Padre Anacleto, 1168 · Nova Rússia · Ponta Grossa/PR<br>(42) 99982-3994 · contato@donabenta.com.br</div>
      </div>
      <div class="titulo">
        <h1>Relatório financeiro</h1>
        <div class="meta"><b>Período:</b> ${escapeHtml(d.periodo)}<br><b>Emissão:</b> ${escapeHtml(d.emissao)} · <b>${d.lista.length}</b> ${d.lista.length === 1 ? 'pedido' : 'pedidos'}</div>
      </div>
    </header>

    <div class="filtros">Filtros: ${d.filtrosTexto.map(f => `<span>${escapeHtml(f)}</span>`).join('')}</div>

    <section class="kpis">
      <div class="kpi destaque"><span class="v">${formatarPreco(d.totalRecebido)}</span><span class="r">Recebido · ${d.pagos.length} ${d.pagos.length === 1 ? 'pedido' : 'pedidos'}</span></div>
      <div class="kpi"><span class="v">${formatarPreco(d.totalPix)}</span><span class="r">Pix · ${d.qtdPix}</span></div>
      <div class="kpi"><span class="v">${formatarPreco(d.totalCartao)}</span><span class="r">Cartão · ${d.qtdCartao}</span></div>
      <div class="kpi pend"><span class="v">${formatarPreco(d.totalPendente)}</span><span class="r">Aguardando · ${d.pendentes.length}</span></div>
      <div class="kpi"><span class="v">${formatarPreco(d.ticketMedio)}</span><span class="r">Ticket médio</span></div>
    </section>

    ${d.lista.length === 0 ? '<div class="vazio">Nenhum pedido encontrado com os filtros aplicados.</div>' : `
    <table>
      <thead>
        <tr><th>Pedido</th><th>Data</th><th>Agendado</th><th>Cliente</th><th>Modalidade</th><th>Forma</th><th>Status</th><th class="num">Valor</th></tr>
      </thead>
      <tbody>${linhas}</tbody>
      <tfoot>
        <tr><td colspan="7">Recebido (${d.pagos.length})</td><td class="num">${formatarPreco(d.totalRecebido)}</td></tr>
        <tr><td colspan="7">Aguardando pagamento (${d.pendentes.length})</td><td class="num">${formatarPreco(d.totalPendente)}</td></tr>
        <tr class="total"><td colspan="7">Total dos pedidos listados</td><td class="num">${formatarPreco(d.totalRecebido + d.totalPendente)}</td></tr>
      </tfoot>
    </table>`}

    <section class="assinaturas">
      <div>Responsável pelo caixa</div>
      <div>Conferido por</div>
    </section>
    <p class="nota">Documento gerado pelo painel da Dona Benta para conferência interna. Valores de pedidos pagos consideram a confirmação registrada no sistema.</p>
  </main>
  </div>
</body>
</html>`;
}

// Prepara a aba do relatório a partir do painel (mesma origem): reduz a folha A4 para caber
// em telas estreitas, liga os botões e abre a impressão. Feito daqui, e não por um script
// embutido no documento, porque em alguns navegadores esse script não rodava na aba.
function prepararAbaRelatorio(aba) {
  const doc = aba.document;

  const ajustar = () => {
    const palco = doc.querySelector('.palco');
    const folha = doc.querySelector('.folha');
    if (!palco || !folha) return;
    folha.classList.remove('reduzida');
    folha.style.transform = '';
    palco.style.height = '';
    palco.style.margin = '';
    const largura = folha.offsetWidth;
    const disponivel = doc.documentElement.clientWidth - 16;
    if (!largura || largura <= disponivel) return;
    const escala = disponivel / largura;
    folha.classList.add('reduzida');
    folha.style.transform = `scale(${escala})`;
    palco.style.margin = '72px 8px 24px';
    palco.style.height = `${Math.ceil(folha.offsetHeight * escala)}px`;
  };

  doc.getElementById('rfSalvar')?.addEventListener('click', () => aba.print());
  doc.getElementById('rfFechar')?.addEventListener('click', () => aba.close());

  // A aba recém-aberta só tem a largura final da tela depois de instantes.
  aba.addEventListener('resize', ajustar);
  aba.visualViewport?.addEventListener('resize', ajustar);
  ajustar();
  [100, 400, 1000].forEach(t => aba.setTimeout(ajustar, t));

  let impresso = false;
  const imprimir = () => {
    if (impresso) return;
    impresso = true;
    ajustar();
    aba.setTimeout(() => aba.print(), 300);
  };
  (doc.fonts?.ready || Promise.resolve()).then(() => aba.setTimeout(imprimir, 200));
  aba.setTimeout(imprimir, 2500); // garantia, caso as fontes demorem
}

async function gerarPdfRelatorio(d) {
  // Aba nova: funciona no computador e no celular (Android e iPhone mostram "Salvar como PDF").
  // Abre já no clique (senão o navegador bloqueia como pop-up) e é preenchida quando o logo fica pronto.
  const aba = window.open('', '_blank');
  if (aba) {
    aba.document.write('<!doctype html><title>Gerando relatório…</title><p style="font:16px system-ui,sans-serif;padding:32px;color:#4b382b">Gerando o relatório…</p>');
    aba.document.close();
  }
  const html = htmlDocumentoRelatorio(d, await logoRelatorio());

  if (aba) {
    aba.document.open();
    aba.document.write(html);
    aba.document.close();
    prepararAbaRelatorio(aba);
    return;
  }

  // Bloqueador de pop-up: imprime por um iframe escondido na própria página.
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed; right:0; bottom:0; width:0; height:0; border:0;';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open();
  // No iframe a impressão é disparada daqui, sem a barra de botões.
  doc.write(html.replace('<div class="barra">', '<div class="barra" style="display:none">'));
  doc.close();
  let impresso = false;
  const imprimir = () => {
    if (impresso) return;
    impresso = true;
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => iframe.remove(), 60000);
  };
  // Espera fontes e logo; o load de documento escrito por script nem sempre dispara, então há um limite.
  iframe.contentWindow.addEventListener('load', () => (doc.fonts?.ready || Promise.resolve()).then(imprimir));
  setTimeout(imprimir, 1500);
  if (typeof mostrarToast === 'function') {
    mostrarToast('Permita pop-ups deste site para abrir o relatório numa aba própria.', 'info');
  }
}

window.abrirRelatorioFinanceiroElaborado = abrirRelatorioFinanceiroElaborado;
window.gerarPdfRelatorio = gerarPdfRelatorio;
