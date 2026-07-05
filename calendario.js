// ===== CALENDÁRIO =====
// ===== CALENDÁRIO =====
function renderCalendario() {
  document.getElementById('cal-month-title').textContent = MESES[calMonth] + ' ' + calYear;
  document.getElementById('btn-inscricao').style.display = selectedEvento ? 'inline-flex' : 'none';
  const grid = document.getElementById('cal-grid');
  const firstDay = new Date(calYear,calMonth,1).getDay();
  const daysInMonth = new Date(calYear,calMonth+1,0).getDate();
  const today = new Date();
  const isMobile = window.innerWidth <= 768;
  let html = '';

  for (let i=0;i<firstDay;i++) {
    html += `<div class="cal-day other-month"><div class="day-num">${new Date(calYear,calMonth,0-firstDay+i+1).getDate()}</div></div>`;
  }

  for (let d=1;d<=daysInMonth;d++) {
    const isToday = today.getFullYear()===calYear&&today.getMonth()===calMonth&&today.getDate()===d;
    const ds = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const devs = eventos.filter(e=>{
      const ini = e.data_inicio||e.data;
      const fim = e.data_fim||ini;
      return ds >= ini && ds <= fim;
    });

    let evHtml = '';
    if (isMobile) {
      // Mobile: mostrar pontos coloridos por ministério (max 3)
      if (devs.length > 0) {
        const dots = devs.slice(0,3).map(e=>{
          const m = ministerios.find(m=>(e.ministerios||[]).includes(m.id));
          const c = m ? m.cor : 'purple';
          return `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--${c}-text);flex-shrink:0"></span>`;
        }).join('');
        const extra = devs.length > 3 ? `<span style="font-size:8px;color:var(--text-tertiary)">+${devs.length-3}</span>` : '';
        evHtml = `<div style="display:flex;flex-wrap:wrap;gap:2px;align-items:center;margin-top:2px">${dots}${extra}</div>`;
      }
    } else {
      // Desktop: mostrar nome do evento
      evHtml = devs.map(e=>{
        const ini = e.data_inicio||e.data;
        const fim = e.data_fim||ini;
        const isFirst = ds===ini, isLast = ds===fim, isMulti = ini!==fim;
        const m = ministerios.find(m=>(e.ministerios||[]).includes(m.id));
        const c = m ? m.cor : 'purple';
        const label = isMulti ? (isFirst?'▶ ':isLast?'⏹ ':'▬ ')+e.nome : (e.live?'📡 ':'')+e.nome;
        return `<div class="cal-event" style="background:var(--${c}-bg);color:var(--${c}-text)" onclick="event.stopPropagation();showEventDetail('${e.id}')">${label}</div>`;
      }).join('');
    }

    // Selected day highlight
    const isSelected = selectedEvento && (selectedEvento.data_inicio||selectedEvento.data) <= ds && (selectedEvento.data_fim||selectedEvento.data_inicio||selectedEvento.data) >= ds;
    html += `<div class="cal-day${isToday?' today':''}${isSelected?' selected-day':''}" onclick="clicouDia('${ds}')" style="cursor:pointer"><div class="day-num">${d}</div>${evHtml}</div>`;
  }
  grid.innerHTML = html;
}

function clicouDia(ds) {
  const devs = eventos.filter(e => {
    const ini = e.data_inicio||e.data;
    const fim = e.data_fim||ini;
    return ds >= ini && ds <= fim;
  });
  const d = new Date(ds+'T12:00:00');
  const label = d.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'});
  const labelCap = label.charAt(0).toUpperCase()+label.slice(1);
  const detalhe = document.getElementById('cal-event-detail');

  if (devs.length === 0) {
    selectedEvento = null;
    document.getElementById('btn-inscricao').style.display = 'none';
    detalhe.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;color:var(--text-tertiary)">
        <i class="ti ti-calendar-off" style="font-size:24px;flex-shrink:0"></i>
        <div>
          <p style="font-size:13px;font-weight:500;color:var(--text-secondary)">Nenhum evento programado</p>
          <p style="font-size:12px;color:var(--text-tertiary)">${labelCap}</p>
        </div>
      </div>`;
    renderCalendario();
    return;
  }

  // Mobile: mostrar lista de eventos do dia para escolher
  if (window.innerWidth <= 768 && devs.length > 1) {
    selectedEvento = null;
    document.getElementById('btn-inscricao').style.display = 'none';
    detalhe.innerHTML = `
      <p style="font-size:12px;font-weight:500;color:var(--text-secondary);margin-bottom:10px;text-transform:uppercase;letter-spacing:.3px">${labelCap} · ${devs.length} eventos</p>
      ${devs.map(e=>{
        const m = ministerios.find(m=>(e.ministerios||[]).includes(m.id));
        const c = m ? m.cor : 'purple';
        const inscrito = (e.inscritos||[]).some(i=>i.volId===currentProfile.id);
        const hora = e.dias_horarios?.[ds]?.inicio || e.hora || '';
        return `<div style="display:flex;align-items:center;gap:10px;padding:12px;border-radius:var(--radius);border:0.5px solid var(--border);margin-bottom:8px;background:var(--bg-secondary)">
          <div style="width:8px;height:8px;border-radius:50%;background:var(--${c}-text);flex-shrink:0"></div>
          <div onclick="showEventDetail('${e.id}')" style="flex:1;min-width:0;cursor:pointer">
            <p style="font-size:14px;font-weight:500">${e.nome}</p>
            <p style="font-size:12px;color:var(--text-secondary)">${hora}${inscrito?' · <span style="color:var(--success-text)">✓ Inscrito</span>':''}</p>
          </div>
          ${perm(getNivelAtivo(),'pode_editar_eventos')?`<button class="btn sm" onclick="editEvento('${e.id}')" style="flex-shrink:0"><i class="ti ti-edit"></i></button>`:'<i class="ti ti-chevron-right" style="color:var(--text-tertiary);font-size:14px;flex-shrink:0"></i>'}
        </div>`;
      }).join('')}`;
    renderCalendario();
    return;
  }

  // 1 evento ou desktop: mostrar direto
  showEventDetail(devs[0].id);
  renderCalendario();
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
    <div style="background:var(--bg-secondary);border-radius:var(--radius);padding:12px">${buildVolsPorMin(ev)}</div>
    ${perm(getNivelAtivo(),'pode_editar_eventos') ? `
    <div style="display:flex;gap:8px;margin-top:12px;padding-top:12px;border-top:0.5px solid var(--border)">
      <button class="btn primary sm" onclick="editEvento('${ev.id}');closeModal && closeModal();" style="flex:1;justify-content:center">
        <i class="ti ti-edit"></i>Editar evento
      </button>
      ${perm(getNivelAtivo(),'pode_excluir_eventos') ? `<button class="btn sm danger" onclick="if(confirm('Excluir este evento?'))deleteEv('${ev.id}')">
        <i class="ti ti-trash"></i>
      </button>` : ''}
    </div>` : ''}`;
}

function changeMonth(d) {
  calMonth += d;
  if (calMonth<0){calMonth=11;calYear--;} if (calMonth>11){calMonth=0;calYear++;}
  selectedEvento = null; renderCalendario();
  document.getElementById('cal-event-detail').innerHTML='<p style="color:var(--text-secondary);font-size:13px">Clique em um evento para ver os detalhes.</p>';
  document.getElementById('btn-inscricao').style.display='none';
  if (calView === 'agenda') renderAgenda();
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


// ===== VISTA AGENDA MOBILE =====
let calView = 'grade'; // 'grade' | 'agenda'

function setCalView(view) {
  calView = view;
  const grade = document.getElementById('cal-grid');
  const header = document.querySelector('.cal-header-days');
  const agendaView = document.getElementById('cal-agenda-view');
  const btnGrade = document.getElementById('btn-view-grade');
  const btnAgenda = document.getElementById('btn-view-agenda');

  if (view === 'agenda') {
    if (grade) grade.style.display = 'none';
    if (header) header.style.display = 'none';
    if (agendaView) agendaView.style.display = 'block';
    if (btnGrade) btnGrade.classList.remove('active');
    if (btnAgenda) btnAgenda.classList.add('active');
    renderAgenda();
  } else {
    if (grade) grade.style.display = '';
    if (header) header.style.display = '';
    if (agendaView) agendaView.style.display = 'none';
    if (btnGrade) btnGrade.classList.add('active');
    if (btnAgenda) btnAgenda.classList.remove('active');
  }
}

function renderAgenda() {
  const lista = document.getElementById('cal-agenda-list');
  if (!lista) return;

  // Pegar eventos do mês atual + próximos 2 meses
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const limite = new Date(calYear, calMonth + 2, 0); // fim do mês seguinte

  const mesInicio = `${calYear}-${String(calMonth+1).padStart(2,'0')}-01`;
  const mesFim = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${new Date(calYear,calMonth+1,0).getDate()}`;

  // Eventos que tocam este mês
  const evsMes = eventos.filter(e => {
    const ini = e.data_inicio || e.data;
    const fim = e.data_fim || ini;
    return ini <= mesFim && fim >= mesInicio;
  }).sort((a,b) => (a.data_inicio||a.data).localeCompare(b.data_inicio||b.data));

  if (!evsMes.length) {
    lista.innerHTML = `<div class="empty" style="padding:32px"><i class="ti ti-calendar-off"></i>Nenhum evento neste mês</div>`;
    return;
  }

  lista.innerHTML = evsMes.map(e => {
    const ini = e.data_inicio || e.data;
    const fim = e.data_fim || ini;
    const d = new Date(ini+'T12:00:00');
    const isHoje = ini === hoje.toISOString().split('T')[0];
    const isMulti = ini !== fim;
    const dFimLabel = isMulti ? ` – ${new Date(fim+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}` : '';
    const hora = e.dias_horarios?.[ini]?.inicio || e.hora || '';
    const mins = (e.ministerios||[]).map(id => {
      const m = ministerios.find(m=>m.id===id);
      return m ? `<span class="agenda-min-pill" style="background:var(--${m.cor}-bg);color:var(--${m.cor}-text)">${m.nome}</span>` : '';
    }).join('');
    const inscrito = (e.inscritos||[]).some(i=>i.volId===currentProfile.id);
    const badges = [
      e.live ? `<span style="font-size:10px;background:var(--coral-bg);color:var(--coral-text);padding:1px 6px;border-radius:3px">LIVE</span>` : '',
      e.som ? `<span style="font-size:10px;background:var(--blue-bg);color:var(--blue-text);padding:1px 6px;border-radius:3px">SOM</span>` : '',
      inscrito ? `<span style="font-size:10px;background:var(--success-bg);color:var(--success-text);padding:1px 6px;border-radius:3px">✓ Inscrito</span>` : '',
    ].filter(Boolean).join('');

    return `<div class="agenda-item" onclick="showEventDetail('${e.id}');document.getElementById('cal-event-detail').scrollIntoView({behavior:'smooth'})">
      <div class="agenda-date-badge ${isHoje?'today-badge':''}">
        <span class="ag-day">${d.getDate()}</span>
        <span class="ag-weekday">${d.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','')}</span>
      </div>
      <div style="flex:1;min-width:0">
        <div class="agenda-nome">${e.nome}</div>
        <div class="agenda-meta">
          <span>${d.toLocaleDateString('pt-BR',{month:'short'})}${dFimLabel}</span>
          ${hora ? `<span>· ${hora}</span>` : ''}
          ${e.local ? `<span>· ${LOCAIS[e.local]||e.local}</span>` : ''}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px">${mins}${badges}</div>
      </div>
      <i class="ti ti-chevron-right" style="color:var(--text-tertiary);flex-shrink:0;margin-top:4px;font-size:14px"></i>
    </div>`;
  }).join('');
}