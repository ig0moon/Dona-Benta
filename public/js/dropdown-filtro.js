// ============================================
// DONA BENTA — js/dropdown-filtro.js
// Troca um <select> por um dropdown no mesmo estilo do status do pedido (a lista do
// select nativo não aceita CSS). O <select> continua no DOM, escondido: o código que
// lê select.value ou escuta "change" segue funcionando sem mudança.
// ============================================

function estilizarSelect(select) {
  if (!select || select.dataset.estilizado) return;
  select.dataset.estilizado = '1';
  select.classList.add('cdd-oculto');
  select.tabIndex = -1;

  const opcoes = [...select.options];
  const wrap = document.createElement('div');
  wrap.className = 'cdd';
  wrap.innerHTML = `
    <button type="button" class="cdd-btn" aria-haspopup="listbox" aria-expanded="false" aria-label="${escapeHtml(select.getAttribute('aria-label') || '')}">
      <span class="cdd-atual"></span>
      <span class="material-symbols-outlined cdd-seta" aria-hidden="true">expand_more</span>
    </button>
    <ul class="cdd-lista" role="listbox">
      ${opcoes.map(o => `<li role="option" tabindex="-1" data-valor="${escapeHtml(o.value)}"><span>${escapeHtml(o.textContent)}</span><span class="material-symbols-outlined cdd-check" aria-hidden="true">check</span></li>`).join('')}
    </ul>`;
  select.insertAdjacentElement('afterend', wrap);

  const btn = wrap.querySelector('.cdd-btn');
  const atual = wrap.querySelector('.cdd-atual');
  const itens = [...wrap.querySelectorAll('[role=option]')];

  const sincronizar = () => {
    const sel = select.options[select.selectedIndex];
    atual.textContent = sel ? sel.textContent : '';
    itens.forEach(li => li.setAttribute('aria-selected', String(li.dataset.valor === select.value)));
  };
  const fechar = () => { wrap.classList.remove('aberto', 'para-cima'); btn.setAttribute('aria-expanded', 'false'); };

  btn.addEventListener('click', () => {
    const abrir = !wrap.classList.contains('aberto');
    document.querySelectorAll('.cdd.aberto').forEach(d => { if (d !== wrap) d.classList.remove('aberto'); });
    if (abrir) {
      const r = btn.getBoundingClientRect();
      wrap.classList.toggle('para-cima', window.innerHeight - r.bottom < 150 && r.top > 150);
    }
    wrap.classList.toggle('aberto', abrir);
    btn.setAttribute('aria-expanded', String(abrir));
  });

  itens.forEach(li => {
    const escolher = () => {
      if (select.value !== li.dataset.valor) {
        select.value = li.dataset.valor;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      sincronizar();
      fechar();
      btn.focus();
    };
    li.addEventListener('click', escolher);
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); escolher(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); li.nextElementSibling?.focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); li.previousElementSibling?.focus(); }
    });
  });

  btn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && !wrap.classList.contains('aberto')) { e.preventDefault(); btn.click(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      (itens.find(li => li.getAttribute('aria-selected') === 'true') || itens[0])?.focus();
    }
  });
  wrap.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && wrap.classList.contains('aberto')) { e.stopPropagation(); fechar(); btn.focus(); }
  });
  document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) fechar(); });

  select._cddSincronizar = sincronizar; // para quando o valor for trocado por código
  sincronizar();
}

window.estilizarSelect = estilizarSelect;
