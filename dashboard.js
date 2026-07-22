// ===== DASHBOARD =====
// ===== DASHBOARD =====
function renderDashboard() {
  atualizarDataTopbar();
  // Mostrar card de total de voluntários apenas para quem tem permissão
  const totalVolCard = document.getElementById('m-total-vol-card');
  const grid = document.getElementById('dash-metrics-grid');
  if (totalVolCard) {
    const podeVer = nivelPodeVerTotalVoluntarios(getNivelAtivo());
    totalVolCard.style.display = podeVer ? '' : 'none';
    if (podeVer) {
      document.getElementById('m-total-vol').textContent = voluntarios.length;
      grid.style.gridTemplateColumns = 'repeat(4,1fr)';
    } else {
      grid.style.gridTemplateColumns = '';
    }
  }

  // Voluntários nos ministérios em que o usuário atual participa
  const meusMin = (currentProfile.ministerios||[]);
  const volsNosMeusMin = new Set();
  voluntarios.forEach(v => {
    if ((v.ministerios||[]).some(m => meusMin.includes(m))) volsNosMeusMin.add(v.id);
  });
  document.getElementById('m-vol').textContent = volsNosMeusMin.size;

  // Ministérios do usuário vs total da igreja
  const qtdMeusMin = meusMin.filter(id => ministerios.find(m=>m.id===id)).length;
  document.getElementById('m-min').textContent = qtdMeusMin;
  document.getElementById('m-min-total').textContent = ministerios.length;

  // Eventos: quantidade em que o usuário está inscrito vs total da igreja
  const meusEventos = eventos.filter(e=>(e.inscritos||[]).some(i=>i.volId===currentProfile.id));
  document.getElementById('m-ev').textContent = meusEventos.length;
  document.getElementById('m-ev-total').textContent = eventos.length;
  document.getElementById('dash-min-count').textContent = ministerios.length + ' ativos';
  const ml = document.getElementById('dash-ministerios-list');
  const vMin = ministerios.filter(m => canAccess(m.id));
  ml.innerHTML = vMin.length ? vMin.map(m => {
    const vols = voluntarios.filter(v => (v.ministerios||[]).includes(m.id));
    const pct = Math.min(100, Math.round(vols.length/15*100));
    return `<div onclick="navigate('ministerio-detalhe','${m.id}')" style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:0.5px solid var(--border);cursor:pointer;border-radius:var(--radius);margin:0 -4px;padding-left:4px;padding-right:4px;transition:background .15s" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
      <div style="width:32px;height:32px;border-radius:var(--radius);background:var(--${m.cor}-bg);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">${ICONES[m.icone]||'⭐'}</div>
      <div style="flex:1;min-width:0"><p style="font-size:13px;font-weight:500">${m.nome}</p><div class="progress-bar"><div style="width:${pct}%"></div></div></div>
      <span style="font-size:12px;color:var(--text-secondary);white-space:nowrap">${vols.length} vol.</span>
      <i class="ti ti-chevron-right" style="font-size:13px;color:var(--text-tertiary);flex-shrink:0"></i>
    </div>`;
  }).join('') : '<div class="empty"><i class="ti ti-users-group"></i>Nenhum ministério</div>';
  // Próximos eventos - deduplica por id (evento multi-dia aparece uma vez)
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const fimDoMes = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0, 23, 59, 59);
  const evupMap = new Map();
  eventos.forEach(e => {
    const dataRef = new Date((e.data_inicio||e.data)+'T00:00:00');
    const dataFim = new Date((e.data_fim||e.data_inicio||e.data)+'T23:59:59');
    // Apenas eventos deste mês
    if (dataFim >= hoje && dataRef <= fimDoMes && !evupMap.has(e.id)) evupMap.set(e.id, e);
  });
  const evup = [...evupMap.values()].sort((a,b)=>new Date(a.data_inicio||a.data)-new Date(b.data_inicio||b.data)).slice(0,10);
  const el = document.getElementById('dash-eventos-list');
  el.innerHTML = evup.length ? evup.map(e => {
    const ini = e.data_inicio||e.data;
    const fim = e.data_fim||ini;
    const dIni = new Date(ini+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});
    const dFim = fim!==ini ? ' – '+new Date(fim+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}) : '';
    const mins = (e.ministerios||[]).map(id=>{const m=ministerios.find(m=>m.id===id);return m?m.nome:''}).filter(Boolean).join(', ');
    return `<div onclick="abrirDetalheEvDash('${e.id}')" style="display:flex;gap:10px;padding:10px 6px;border-bottom:0.5px solid var(--border);align-items:center;cursor:pointer;border-radius:var(--radius);margin:0 -6px;transition:background .15s" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
      <div style="background:var(--purple-bg);color:var(--purple-text);border-radius:var(--radius);padding:3px 8px;font-size:11px;font-weight:500;white-space:nowrap;flex-shrink:0;text-align:center">${dIni}${dFim}</div>
      <div style="flex:1;min-width:0">
        <p style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e.nome}${e.live?' <span style="font-size:10px;background:var(--coral-bg);color:var(--coral-text);padding:1px 5px;border-radius:3px">LIVE</span>':''}</p>
        <p style="font-size:11px;color:var(--text-secondary)">${e.hora||''}${mins?' · '+mins:''}</p>
      </div>
      <i class="ti ti-chevron-right" style="color:var(--text-tertiary);flex-shrink:0;font-size:14px"></i>
    </div>`;
  }).join('') : '<div class="empty"><i class="ti ti-calendar"></i>Sem eventos próximos</div>';
  const meusEvEl = document.getElementById('dash-meus-eventos');
  const meusEv = eventos.filter(e=>new Date(e.data+'T23:59:59')>=new Date()&&(e.inscritos||[]).some(i=>i.volId===currentProfile.id)).sort((a,b)=>new Date(a.data)-new Date(b.data));
  if (!meusEv.length) {
    meusEvEl.innerHTML = '<div class="empty" style="padding:24px"><i class="ti ti-calendar-off"></i>Você não está escalado em nenhum evento próximo.</div>';
  } else {
    meusEvEl.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">' + meusEv.map(e => {
      const insc = (e.inscritos||[]).find(i=>i.volId===currentProfile.id);
      const min = ministerios.find(m=>m.id===insc?.minId);
      const d = new Date(e.data+'T12:00:00');
      const ds = d.toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short'});
      const hoje = new Date(); hoje.setHours(0,0,0,0);
      const diff = Math.round((new Date(e.data+'T00:00:00')-hoje)/(1000*60*60*24));
      const diffTxt = diff===0?'Hoje':diff===1?'Amanhã':`Em ${diff} dias`;
      const cor = min?min.cor:'purple';
      return `<div onclick="abrirDetalheEvDash('${e.id}')" style="border:0.5px solid var(--border);border-radius:var(--radius);padding:12px;cursor:pointer;background:var(--bg-primary)" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='var(--bg-primary)'">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <span style="font-size:10px;font-weight:500;background:var(--${cor}-bg);color:var(--${cor}-text);padding:2px 8px;border-radius:4px">${min?ICONES[min.icone]+' '+min.nome:'—'}</span>
          <span style="font-size:10px;color:${diff<=1?'var(--coral-text)':'var(--text-tertiary)'};font-weight:500">${diffTxt}</span>
        </div>
        <p style="font-size:13px;font-weight:500;margin-bottom:3px">${e.nome}</p>
        <p style="font-size:11px;color:var(--text-secondary)">${ds} · ${e.hora||''}</p>
      </div>`;
    }).join('') + '</div>';
  }


}

function abrirDetalheEvDash(evId) {
  const ev = eventos.find(e=>e.id===evId); if (!ev) return;
  const insc = (ev.inscritos||[]).find(i=>i.volId===currentProfile.id);
  const min = insc ? ministerios.find(m=>m.id===insc.minId) : null;
  const d = new Date(ev.data+'T12:00:00');
  const ds = d.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const diff = Math.round((new Date(ev.data+'T00:00:00')-hoje)/(1000*60*60*24));
  const diffTxt = diff===0?'Hoje':diff===1?'Amanhã':`Em ${diff} dias`;
  const volsPorMin = buildVolsPorMin(ev);
  document.getElementById('modal-dash-evento-content').innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px">
      <div><h2 style="font-size:16px;font-weight:500;margin-bottom:4px">${ev.nome}${ev.live?' <span style="font-size:10px;background:var(--coral-bg);color:var(--coral-text);padding:2px 7px;border-radius:4px">LIVE</span>':''}</h2><p style="font-size:13px;color:var(--text-secondary)">${ds} · ${ev.hora||''}</p></div>
      <span style="font-size:11px;font-weight:500;padding:4px 10px;border-radius:var(--radius);background:${diff<=1?'var(--coral-bg)':'var(--purple-bg)'};color:${diff<=1?'var(--coral-text)':'var(--purple-text)'};white-space:nowrap;margin-left:10px">${diffTxt}</span>
    </div>
    ${ev.descricao?`<div style="margin-bottom:14px">
      <p style="font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px"><i class="ti ti-list-details" style="font-size:11px;margin-right:4px"></i>PROGRAMAÇÃO</p>
      <p style="font-size:13px;color:var(--text-secondary);white-space:pre-wrap">${ev.descricao}</p>
    </div>`:''}
    ${ev.arquivo_url ? buildArquivoHtml(ev.arquivo_url, ev.arquivo_nome, ev.arquivo_tipo) : ''}
    ${ev.banda?`<div style="background:var(--amber-bg);border-radius:var(--radius);padding:10px 12px;margin-bottom:14px"><p style="font-size:11px;font-weight:500;color:var(--amber-text);margin-bottom:3px"><i class="ti ti-music"></i> FORMAÇÃO DA BANDA</p><p style="font-size:13px;white-space:pre-wrap">${ev.banda}</p></div>`:''}
    ${min?`<div style="background:var(--success-bg);color:var(--success-text);border-radius:var(--radius);padding:10px 14px;font-size:13px;margin-bottom:14px"><i class="ti ti-check" style="margin-right:6px"></i>Você servirá no ministério <strong>${min.nome}</strong></div>`:''}
    <p style="font-size:12px;font-weight:500;color:var(--text-secondary);margin-bottom:10px;text-transform:uppercase;letter-spacing:.3px">Equipe confirmada</p>
    ${volsPorMin}`;
  document.getElementById('modal-dash-evento').dataset.evId = evId;
  openModal('modal-dash-evento');
}

function irParaCalendario() {
  const evId = document.getElementById('modal-dash-evento').dataset.evId;
  const ev = eventos.find(e=>e.id===evId);
  if (ev) { const d = new Date(ev.data+'T12:00:00'); calYear = d.getFullYear(); calMonth = d.getMonth(); selectedEvento = ev; }
  closeModal('modal-dash-evento'); navigate('calendario');
  setTimeout(() => showEventDetail(evId), 100);
}

function buildVolsPorMin(ev) {
  return (ev.ministerios||[]).map(mid => {
    const m = ministerios.find(m=>m.id===mid); if (!m) return '';
    const inscritos = (ev.inscritos||[]).filter(i=>i.minId===mid);
    // Pendentes: convidados que ainda não responderam ou aceitaram mas não estão em inscritos
    const pendentes = (ev.convites||[]).filter(c => {
      if (c.status !== 'pendente') return false;
      const v = voluntarios.find(v=>v.id===c.volId);
      if (!v) return false;
      // Verificar se o voluntário pertence a este ministério
      return (v.ministerios||[]).includes(mid);
    });
    const rows = inscritos.map(i => {
      const v = voluntarios.find(v=>v.id===i.volId);
      return v ? `<div style="display:flex;align-items:center;gap:8px;padding:5px 0">
        <div class="avatar ${getNivelClass(v.nivel)}" style="width:24px;height:24px;font-size:9px;flex-shrink:0">${ini(v.nome)}</div>
        <span style="font-size:12px;flex:1">${v.nome}${v.id===currentProfile.id?' <strong>(você)</strong>':''}</span>
        <span style="font-size:10px;background:var(--success-bg);color:var(--success-text);padding:1px 6px;border-radius:3px">✓ Confirmado</span>
      </div>` : '';
    }).join('');
    const rowsPend = pendentes.map(c => {
      const v = voluntarios.find(v=>v.id===c.volId);
      return v ? `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;opacity:.7">
        <div class="avatar voluntario" style="width:24px;height:24px;font-size:9px;flex-shrink:0">${ini(v.nome)}</div>
        <span style="font-size:12px;flex:1">${v.nome}</span>
        <span style="font-size:10px;background:var(--warning-bg);color:var(--warning-text);padding:1px 6px;border-radius:3px">⏳ Pendente</span>
      </div>` : '';
    }).join('');
    const totalLabel = `${inscritos.length} confirmado(s)${pendentes.length>0?' · '+pendentes.length+' pendente(s)':''}`;
    return `<div style="margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:6px;background:var(--bg-secondary);border-radius:var(--radius);padding:7px 10px;margin-bottom:4px">
        <span>${ICONES[m.icone]||'⭐'}</span>
        <span style="font-size:12px;font-weight:500;color:var(--${m.cor}-text)">${m.nome}</span>
        <span style="font-size:11px;color:var(--text-tertiary);margin-left:auto">${totalLabel}</span>
      </div>
      ${rows||''}${rowsPend||''}
      ${!rows&&!rowsPend?'<p style="font-size:11px;color:var(--text-tertiary);padding-left:4px">Nenhum inscrito</p>':''}
    </div>`;
  }).join('');
}


// ===== DATA NA TOPBAR =====
function atualizarDataTopbar() {
  const el = document.getElementById('topbar-date');
  if (!el) return;
  el.textContent = new Date().toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'});
}
