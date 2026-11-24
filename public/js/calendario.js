// ============================================
// DONA BENTA — js/calendario.js
// Troca um <input type="date"> por um botão que abre um calendário no estilo do
// painel (o calendário nativo não aceita CSS). O input continua no DOM, escondido:
// value ("AAAA-MM-DD"), disabled e o evento "change" funcionam como antes.
// Depois de mudar input.disabled por código, chame input._sincronizarData().
// ============================================

function estilizarData(input) {
  if (!input || input.dataset.estilizado) return;
  input.dataset.estilizado = '1';
  input.classList.add('cdd-oculto');
  input.tabIndex = -1;

  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const pad = n => String(n).padStart(2, '0');
  const iso = (a, m, d) => `${a}-${pad(m + 1)}-${pad(d)}`;
  const hojeIso = () => { const h = new Date(); return iso(h.getFullYear(), h.getMonth(), h.getDate()); };
  const analisar = (v) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
    return m ? { a: +m[1], m: +m[2] - 1, d: +m[3] } : null;
  };

  const wrap = document.createElement('div');
  wrap.className = 'cal';
  wrap.innerHTML = `
    <button type="button" class="cal-btn" aria-haspopup="dialog" aria-expanded="false" aria-label="${escapeHtml(input.getAttribute('aria-label') || 'Escolher data')}">
      <span class="cal-valor"></span>
      <span class="material-symbols-outlined" aria-hidden="true">calendar_month</span>
    </button>
    <div class="cal-pop" role="dialog" aria-label="Calendário">
      <div class="cal-topo">
        <button type="button" class="cal-nav" data-nav="-1" aria-label="Mês anterior"><span class="material-symbols-outlined" aria-hidden="true">chevron_left</span></button>
        <strong class="cal-titulo" aria-live="polite"></strong>
        <button type="button" class="cal-nav" data-nav="1" aria-label="Próximo mês"><span class="material-symbols-outlined" aria-hidden="true">chevron_right</span></button>
      </div>
      <div class="cal-semana" aria-hidden="true"><span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span></div>
      <div class="cal-dias"></div>
      <div class="cal-rodape"><button type="button" class="cal-hoje">Hoje</button></div>
    </div>`;
  input.insertAdjacentElement('afterend', wrap);

  const btn = wrap.querySelector('.cal-btn');
  const valor = wrap.querySelector('.cal-valor');
  const titulo = wrap.querySelector('.cal-titulo');
  const grade = wrap.querySelector('.cal-dias');
  let vis = analisar(input.value) || analisar(hojeIso()); // mês exibido

  const texto = () => {
    const d = analisar(input.value);
    return d ? `${pad(d.d)}/${pad(d.m + 1)}/${d.a}` : 'Escolher data';
  };
  const sincronizar = () => {
    valor.textContent = texto();
    btn.disabled = input.disabled;
    wrap.classList.toggle('desativado', input.disabled);
  };
  const fechar = () => { wrap.classList.remove('aberto', 'para-cima', 'alinha-direita'); btn.setAttribute('aria-expanded', 'false'); };

  const desenhar = () => {
    titulo.textContent = `${MESES[vis.m]} de ${vis.a}`;
    const primeiro = new Date(vis.a, vis.m, 1).getDay();
    const total = new Date(vis.a, vis.m + 1, 0).getDate();
    const anterior = new Date(vis.a, vis.m, 0).getDate();
    const sel = input.value, hoje = hojeIso();
    let html = '';
    for (let i = 0; i < 42; i++) {
      const n = i - primeiro + 1;
      let a = vis.a, m = vis.m, d = n, fora = false;
      if (n < 1) { fora = true; d = anterior + n; m = vis.m - 1; if (m < 0) { m = 11; a--; } }
      else if (n > total) { fora = true; d = n - total; m = vis.m + 1; if (m > 11) { m = 0; a++; } }
      const v = iso(a, m, d);
      html += `<button type="button" class="cal-dia${fora ? ' fora' : ''}${v === hoje ? ' hoje' : ''}${v === sel ? ' sel' : ''}" data-v="${v}" ${v === sel ? 'aria-pressed="true"' : ''}>${d}</button>`;
    }
    grade.innerHTML = html;
  };

  const escolher = (v) => {
    if (input.value !== v) {
      input.value = v;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    sincronizar();
    fechar();
    btn.focus();
  };

  btn.addEventListener('click', () => {
    const abrir = !wrap.classList.contains('aberto');
    document.querySelectorAll('.cal.aberto').forEach(c => { if (c !== wrap) c.classList.remove('aberto'); });
    if (abrir) {
      vis = analisar(input.value) || analisar(hojeIso());
      desenhar();
      const r = btn.getBoundingClientRect();
      wrap.classList.toggle('alinha-direita', r.left + 300 > window.innerWidth);
      wrap.classList.toggle('para-cima', window.innerHeight - r.bottom < 340 && r.top > 340);
    }
    wrap.classList.toggle('aberto', abrir);
    btn.setAttribute('aria-expanded', String(abrir));
  });

  wrap.querySelectorAll('.cal-nav').forEach(b => b.addEventListener('click', () => {
    vis = { a: vis.a, m: vis.m + Number(b.dataset.nav), d: 1 };
    if (vis.m < 0) { vis.m = 11; vis.a--; } else if (vis.m > 11) { vis.m = 0; vis.a++; }
    desenhar();
  }));
  grade.addEventListener('click', (e) => {
    const dia = e.target.closest('.cal-dia');
    if (dia) escolher(dia.dataset.v);
  });
  wrap.querySelector('.cal-hoje').addEventListener('click', () => escolher(hojeIso()));
  wrap.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && wrap.classList.contains('aberto')) { e.stopPropagation(); fechar(); btn.focus(); }
  });
  document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) fechar(); });

  input._sincronizarData = sincronizar;
  sincronizar();
}

window.estilizarData = estilizarData;
