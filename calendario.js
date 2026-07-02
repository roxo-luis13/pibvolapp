// ===== CALENDÁRIO =====
// ===== CALENDÁRIO =====
function renderCalendario() {
  document.getElementById('cal-month-title').textContent = MESES[calMonth] + ' ' + calYear;
  document.getElementById('btn-inscricao').style.display = selectedEvento ? 'inline-flex' : 'none';
  const grid = document.getElementById('cal-grid');
  const firstDay = new Date(calYear,calMonth,1).getDay();
  const daysInMonth = new Date(calYear,calMonth+1,0).getDate();
  const today = new Date();
  let html = '';
  for (let i=0;i<firstDay;i++) { const pd=new Date(calYear,calMonth,0-firstDay+i+1); html+=`<div class="cal-day other-month"><div class="day-num">${pd.getDate()}</div></div>`; }
  for (let d=1;d<=daysInMonth;d++) {
    const isToday = today.getFullYear()===calYear&&today.getMonth()===calMonth&&today.getDate()===d;
    const ds = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    // Mostrar evento se ds está dentro do período data_inicio até data_fim
    const devs = eventos.filter(e=>{
      const ini = e.data_inicio || e.data;
      const fim = e.data_fim || ini;
      return ds >= ini && ds <= fim;
    });
    const evHtml = devs.map(e=>{
      const ini = e.data_inicio || e.data;
      const fim = e.data_fim || ini;
      const isFirst = ds === ini;
      const isLast = ds === fim;
      const isMulti = ini !== fim;
      const m = ministerios.find(m=>(e.ministerios||[]).includes(m.id));
      const c = m ? m.cor : 'purple';
      // Indicador visual: primeiro dia, dia intermediário ou último dia
      const label = isMulti
        ? (isFirst ? '▶ ' : isLast ? '⏹ ' : '▬ ') + e.nome
        : (e.live ? '📡 ' : '') + e.nome;
      return `<div class="cal-event" style="background:var(--${c}-bg);color:var(--${c}-text);${isMulti&&!isFirst?'border-left:none;border-radius:0 3px 3px 0;':''}" onclick="showEventDetail('${e.id}')">${label}</div>`;
    }).join('');
    html += `<div class="cal-day${isToday?' today':''}" onclick="clicouDia('${ds}')" style="cursor:pointer"><div class="day-num">${d}</div>${evHtml}</div>`;
  }
  grid.innerHTML = html;
}

function clicouDia(ds) {
  // Se clicou num dia com eventos, não faz nada (o clique no evento já trata)
  // Se clicou num dia sem eventos, mostra mensagem
  const devs = eventos.filter(e => {
    const ini = e.data_inicio || e.data;
    const fim = e.data_fim || ini;
    return ds >= ini && ds <= fim;
  });
  if (devs.length > 0) return; // tem eventos, ignora clique no dia
  const d = new Date(ds + 'T12:00:00');
  const label = d.toLocaleDateString('pt-BR', {weekday:'long', day:'2-digit', month:'long'});
  document.getElementById('btn-inscricao').style.display = 'none';
  selectedEvento = null;
  document.getElementById('cal-event-detail').innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;color:var(--text-tertiary)">
      <i class="ti ti-calendar-off" style="font-size:24px;flex-shrink:0"></i>
      <div>
        <p style="font-size:13px;font-weight:500;color:var(--text-secondary)">Nenhum evento programado</p>
        <p style="font-size:12px;color:var(--text-tertiary)">${label.charAt(0).toUpperCase()+label.slice(1)}</p>
      </div>
    </div>`;
}

const isInscrito = ev => (ev.inscritos||[]).some(i=>i.volId===currentProfile.id);
const getMinInscrito = ev => (ev.inscritos||[]).find(i=>i.volId===currentProfile.id)?.minId||null;

function showEventDetail(evId) {
  const ev = eventos.find(e=>e.id===evId); if (!ev) return;
  selectedEvento = ev;
  const userCanJoin = nivelIsAdmin(getNivelAtivo()) || (ev.ministerios||[]).some(mid=>(currentProfile.ministerios||[]).includes(mid));
  document.getElementById('btn-inscricao').style.display = userCanJoin ? 'inline-flex' : 'none';
  const d = new Date(ev.data+'T12:00:00');
  const ds = d.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'});
  const inscrito = isInscrito(ev);
  const minInscritoObj = inscrito ? ministerios.find(m=>m.id===getMinInscrito(ev)) : null;
  const minsTag = (ev.ministerios||[]).map(id=>{const m=ministerios.find(m=>m.id===id);return m?`<span class="tag ${m.cor}">${ICONES[m.icone]} ${m.nome}</span>`:''}).join('');
  // Build date/time display
  const dataIni = ev.data_inicio||ev.data;
  const dataFim = ev.data_fim;
  let dataDisplay = '';
  if (dataFim && dataFim !== dataIni) {
    const di = new Date(dataIni+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});
    const df = new Date(dataFim+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'});
    dataDisplay = `${di} a ${df}`;
  } else {
    dataDisplay = ds;
  }
  // Build horários multi-day
  let horarioDisplay = '';
  if (ev.dias_horarios && Object.keys(ev.dias_horarios).length > 1) {
    horarioDisplay = Object.entries(ev.dias_horarios).map(([dt,h]) => {
      const d2 = new Date(dt+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short'});
      return `<div style="font-size:12px;color:var(--text-secondary)">${d2}: ${h.inicio||''}${h.fim?' até '+h.fim:''}</div>`;
    }).join('');
    horarioDisplay = `<div style="margin-top:4px">${horarioDisplay}</div>`;
  } else if (ev.dias_horarios && ev.data_inicio) {
    const h = ev.dias_horarios[ev.data_inicio]||{};
    horarioDisplay = `<p style="font-size:13px;color:var(--text-secondary)">${h.inicio||ev.hora||''}${h.fim?' até '+h.fim:''}</p>`;
  } else {
    horarioDisplay = `<p style="font-size:13px;color:var(--text-secondary)">${ev.hora||''}</p>`;
  }
  const badges = [
    ev.live?'<span style="font-size:10px;background:var(--coral-bg);color:var(--coral-text);padding:2px 7px;border-radius:4px"><i class="ti ti-radio" style="font-size:10px"></i> LIVE</span>':'',
    ev.som?'<span style="font-size:10px;background:var(--blue-bg);color:var(--blue-text);padding:2px 7px;border-radius:4px"><i class="ti ti-volume" style="font-size:10px"></i> SOM</span>':'',
    ev.local?`<span style="font-size:10px;background:var(--bg-secondary);color:var(--text-secondary);padding:2px 7px;border-radius:4px"><i class="ti ti-map-pin" style="font-size:10px"></i> ${LOCAIS[ev.local]||ev.local}</span>`:'',
  ].filter(Boolean).join(' ');
  document.getElementById('cal-event-detail').innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px">
      <div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;flex-wrap:wrap"><h3 style="font-size:15px;font-weight:500">${ev.nome}</h3>${badges}</div>
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:2px">${dataDisplay}</p>
        ${horarioDisplay}
      </div>
      ${inscrito?`<span class="badge voluntario" style="white-space:nowrap">✓ ${minInscritoObj?minInscritoObj.nome:'Inscrito'}</span>`:''}
    </div>
    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:10px;white-space:pre-wrap">${ev.descricao||''}</p>
    ${ev.banda&&podVerBanda()?`<div style="background:var(--amber-bg);border-radius:var(--radius);padding:10px 12px;margin-bottom:10px"><p style="font-size:11px;font-weight:500;color:var(--amber-text);margin-bottom:3px"><i class="ti ti-music"></i> FORMAÇÃO DA BANDA</p><p style="font-size:13px;white-space:pre-wrap">${ev.banda}</p></div>`:''}
    <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:12px">${minsTag}</div>
    <div style="background:var(--bg-secondary);border-radius:var(--radius);padding:12px">${buildVolsPorMin(ev)}</div>`;
}

function changeMonth(d) {
  calMonth += d;
  if (calMonth<0){calMonth=11;calYear--;} if (calMonth>11){calMonth=0;calYear++;}
  selectedEvento = null; renderCalendario();
  document.getElementById('cal-event-detail').innerHTML='<p style="color:var(--text-secondary);font-size:13px">Clique em um evento para ver os detalhes.</p>';
  document.getElementById('btn-inscricao').style.display='none';
}

function openInscricao() {
  if (!selectedEvento) return;
  const ev = selectedEvento;
  const inscrito = isInscrito(ev);
  const minInscrito = getMinInscrito(ev);
  document.getElementById('inscricao-titulo').textContent = ev.nome;
  const d = new Date(ev.data+'T12:00:00');
  document.getElementById('inscricao-info').textContent = d.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'}) + ' às ' + (ev.hora||'');
  const statusEl = document.getElementById('inscricao-meu-status');
  if (inscrito) {
    const m = ministerios.find(m=>m.id===minInscrito);
    statusEl.style.display='block';
    statusEl.innerHTML=`<div style="background:var(--success-bg);color:var(--success-text);border-radius:var(--radius);padding:10px 14px;font-size:13px"><i class="ti ti-check" style="margin-right:6px"></i>Você está inscrito para servir no ministério <strong>${m?m.nome:'—'}</strong></div>`;
  } else { statusEl.style.display='none'; }
  const formEl = document.getElementById('inscricao-form-min');
  const sel = document.getElementById('inscricao-min-select');
  const minsDisponiveis = (ev.ministerios||[]).filter(mid=>(currentProfile.ministerios||[]).includes(mid));
  if (!inscrito && minsDisponiveis.length>0) {
    formEl.style.display='block';
    sel.innerHTML = minsDisponiveis.map(mid=>{const m=ministerios.find(m=>m.id===mid);return m?`<option value="${mid}">${ICONES[m.icone]} ${m.nome}</option>`:''}).join('');
  } else { formEl.style.display='none'; }
  const lista = document.getElementById('inscricao-lista');
  lista.innerHTML = buildVolsPorMin(ev) || '<p style="font-size:13px;color:var(--text-secondary)">Nenhum ministério neste evento.</p>';
  const btn = document.getElementById('btn-toggle-inscricao');
  if (inscrito) { btn.style.display='inline-flex';btn.textContent='Cancelar inscrição';btn.className='btn danger'; }
  else if (minsDisponiveis.length>0) { btn.style.display='inline-flex';btn.textContent='Confirmar inscrição';btn.className='btn primary'; }
  else { btn.style.display='none'; }
  openModal('modal-inscricao');
}

async function toggleInscricao() {
  if (!selectedEvento) return;
  const ev = selectedEvento;
  let inscritos = [...(ev.inscritos||[])];
  if (isInscrito(ev)) {
    inscritos = inscritos.filter(i=>i.volId!==currentProfile.id);
  } else {
    const minId = document.getElementById('inscricao-min-select').value;
    if (!minId) { alert('Selecione um ministério.'); return; }
    inscritos.push({volId:currentProfile.id,minId});
  }
  await sb(`eventos?id=eq.${ev.id}`, {method:'PATCH',body:JSON.stringify({inscritos})});
  ev.inscritos = inscritos;
  closeModal('modal-inscricao');
  showEventDetail(ev.id);
  renderCalendario();
}
