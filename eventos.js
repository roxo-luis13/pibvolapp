// ===== EVENTOS =====
// ===== EVENTOS =====

function buildEvRow(e) {
  const nav = getNivelAtivo();
  const podeCriar = perm(nav,'pode_criar_eventos');
  const podeEditar = perm(nav,'pode_editar_eventos');
  const podeExcluir = perm(nav,'pode_excluir_eventos');
  const dIni = new Date((e.data_inicio||e.data)+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});
  const dFim = e.data_fim && e.data_fim!==(e.data_inicio||e.data) ? ' — '+new Date(e.data_fim+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}) : '';
  const badges = [
    e.live?'<span style="font-size:10px;background:var(--coral-bg);color:var(--coral-text);padding:1px 5px;border-radius:3px">LIVE</span>':'',
    e.som?'<span style="font-size:10px;background:var(--blue-bg);color:var(--blue-text);padding:1px 5px;border-radius:3px">SOM</span>':''
  ].filter(Boolean).join(' ')||'—';
  const mins = (e.ministerios||[]).map(id=>{const m=ministerios.find(m=>m.id===id);return m?`<span class="tag ${m.cor}">${m.nome}</span>`:''}).join('');
  const btns = (podeEditar||podeExcluir) ? `<div style="display:flex;gap:4px">
    ${podeEditar?`<button class="btn sm" onclick="editEvento('${e.id}')"><i class="ti ti-edit"></i></button>`:''}
    ${podeExcluir?`<button class="btn sm danger" onclick="deleteEv('${e.id}')"><i class="ti ti-trash"></i></button>`:''}
  </div>` : '';
  return `<tr>
    <td style="font-weight:500">${e.nome}</td>
    <td style="color:var(--text-secondary);white-space:nowrap">${dIni}${dFim}</td>
    <td>${badges}</td>
    <td style="color:var(--text-secondary)">${e.local?LOCAIS[e.local]||e.local:'—'}</td>
    <td>${mins}</td>
    <td>${(e.inscritos||[]).length}</td>
    <td>${btns}</td>
  </tr>`;
}


function buildEvCard(e) {
  const nav = getNivelAtivo();
  const podeEditar = perm(nav,'pode_editar_eventos');
  const podeCriar = perm(nav,'pode_criar_eventos');
  const ini = e.data_inicio||e.data;
  const fim = e.data_fim||ini;
  const dIni = new Date(ini+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short'});
  const dFim = fim!==ini ? ' – '+new Date(fim+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}) : '';
  const hora = e.dias_horarios?.[ini]?.inicio || e.hora || '';
  const mins = (e.ministerios||[]).map(id=>{const m=ministerios.find(m=>m.id===id);return m?`<span class="tag ${m.cor}">${m.nome}</span>`:''}).join('');
  const inscrito = (e.inscritos||[]).some(i=>i.volId===currentProfile.id);
  const badges = [
    e.live?`<span style="font-size:10px;background:var(--coral-bg);color:var(--coral-text);padding:1px 6px;border-radius:3px">LIVE</span>`:'',
    e.som?`<span style="font-size:10px;background:var(--blue-bg);color:var(--blue-text);padding:1px 6px;border-radius:3px">SOM</span>`:'',
    e.local?`<span style="font-size:10px;background:var(--bg-secondary);color:var(--text-secondary);padding:1px 6px;border-radius:3px">${LOCAIS[e.local]||e.local}</span>`:'',
    inscrito?`<span style="font-size:10px;background:var(--success-bg);color:var(--success-text);padding:1px 6px;border-radius:3px">✓ Inscrito</span>`:'',
  ].filter(Boolean).join('');
  const btns = (podeEditar||podeCriar) ? `<div style="display:flex;gap:6px">
    ${podeEditar?`<button class="btn sm" onclick="editEvento('${e.id}')"><i class="ti ti-edit"></i>Editar</button>`:''}
    ${podeCriar?`<button class="btn sm danger" onclick="deleteEv('${e.id}')"><i class="ti ti-trash"></i></button>`:''}
  </div>` : '';
  return `<div class="ev-card">
    <div class="ev-card-nome">${e.nome}</div>
    <div class="ev-card-meta">
      <span><i class="ti ti-calendar" style="font-size:12px;margin-right:3px"></i>${dIni}${dFim}</span>
      ${hora?`<span><i class="ti ti-clock" style="font-size:12px;margin-right:3px"></i>${hora}</span>`:''}
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">${badges}</div>
    <div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:10px">${mins}</div>
    <div class="ev-card-footer">
      <span style="font-size:12px;color:var(--text-secondary)"><i class="ti ti-users" style="font-size:12px"></i> ${(e.inscritos||[]).length} inscritos</span>
      ${btns}
    </div>
  </div>`;
}

function toggleSecaoEv(tipo) {
  const body = document.getElementById('ev-'+tipo+'-body');
  const icon = document.getElementById('ev-'+tipo+'-icon');
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  icon.style.transform = isOpen ? '' : 'rotate(180deg)';
}

function renderEventos() {
  const now = new Date();
  const mesAtual = now.getMonth();
  const anoAtual = now.getFullYear();
  const passados = [], doMes = [], futuros = [];
  eventos.sort((a,b)=>new Date(a.data_inicio||a.data)-new Date(b.data_inicio||b.data)).forEach(e => {
    const dataRef = new Date((e.data_inicio||e.data)+'T12:00:00');
    const mes = dataRef.getMonth(), ano = dataRef.getFullYear();
    if (ano < anoAtual || (ano === anoAtual && mes < mesAtual)) passados.push(e);
    else if (ano === anoAtual && mes === mesAtual) doMes.push(e);
    else futuros.push(e);
  });

  // Mês atual
  const mesTitulo = 'Eventos de ' + new Date(anoAtual, mesAtual, 1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
  document.getElementById('ev-mes-titulo').textContent = mesTitulo.charAt(0).toUpperCase()+mesTitulo.slice(1);
  document.getElementById('ev-mes-count').textContent = doMes.length + ' evento(s)';
  const tbMes = document.getElementById('ev-tbody-mes');
  const emptyMes = document.getElementById('ev-mes-empty');
  if (doMes.length) {
    tbMes.innerHTML = doMes.map(e=>buildEvRow(e)).join('');
    tbMes.closest('.table-wrap').style.display='';
    emptyMes.style.display='none';
  } else {
    tbMes.innerHTML='';
    tbMes.closest('.table-wrap').style.display='none';
    emptyMes.style.display='block';
  }
  const _cardsMes = document.getElementById('ev-cards-mes');
  if (_cardsMes) _cardsMes.innerHTML = doMes.map(e=>buildEvCard(e)).join('');
  const _cardsMes1 = document.getElementById('ev-cards-mes');
  if (_cardsMes) _cardsMes.innerHTML = doMes.length ? doMes.map(e=>buildEvCard(e)).join('') : '';

  // Passados (revertidos - mais recente primeiro)
  document.getElementById('ev-passados-count').textContent = passados.length + ' evento(s)';
  document.getElementById('ev-passados-card').style.display = passados.length ? '' : 'none';
  const passRev = [...passados].reverse();
  document.getElementById('ev-tbody-passados').innerHTML = passRev.map(e=>buildEvRow(e)).join('');
  const _cardsPass = document.getElementById('ev-cards-passados');
  if (_cardsPass) _cardsPass.innerHTML = passRev.map(e=>buildEvCard(e)).join('');

  // Futuros
  document.getElementById('ev-futuros-count').textContent = futuros.length + ' evento(s)';
  document.getElementById('ev-futuros-card').style.display = futuros.length ? '' : 'none';
  document.getElementById('ev-tbody-futuros').innerHTML = futuros.map(e=>buildEvRow(e)).join('');
  const _cardsFut = document.getElementById('ev-cards-futuros');
  if (_cardsFut) _cardsFut.innerHTML = futuros.map(e=>buildEvCard(e)).join('');
}

function editEvento(id) {
  const e = eventos.find(e=>e.id===id); if (!e) return;
  document.getElementById('modal-ev-title').textContent = 'Editar evento';
  document.getElementById('ev-edit-id').value = id;
  document.getElementById('ev-nome').value = e.nome;
  document.getElementById('ev-data-inicio').value = e.data_inicio||e.data||'';
  document.getElementById('ev-data-fim').value = e.data_fim||'';
  document.getElementById('ev-desc').value = e.descricao||'';
  document.getElementById('ev-banda').value = e.banda||'';
  document.getElementById('ev-live').checked = !!e.live;
  document.getElementById('ev-som').checked = !!e.som;
  document.getElementById('ev-local').value = e.local||'';
  atualizarDiasEvento();
  // Restore saved day schedules

  populateChips('ev-ministerios-chips');
  document.querySelectorAll('#ev-ministerios-chips .chip').forEach(c=>{if((e.ministerios||[]).includes(c.dataset.id))c.classList.add('selected');});
  renderConvidarLista(e.convites||[]);
  document.getElementById('modal-ev').classList.add('open');
  setTimeout(()=>{
    atualizarDiasEvento();
    // Restaurar horários salvos
    if (e.dias_horarios) {
      Object.entries(e.dias_horarios).forEach(([dt,h]) => {
        const ini = document.getElementById('hora-ini-'+dt);
        const fim = document.getElementById('hora-fim-'+dt);
        if (ini) ini.value = h.inicio||'';
        if (fim) fim.value = h.fim||'';
      });
    }
  }, 60);
}

async function saveEvento() {
  const nome = document.getElementById('ev-nome').value.trim();
  const data_inicio = document.getElementById('ev-data-inicio').value;
  const data_fim = document.getElementById('ev-data-fim').value;
  const banda = document.getElementById('ev-banda').value.trim();
  if (!nome||!data_inicio) { alert('Nome e data de início são obrigatórios.'); return; }
  if (!banda) { alert('A formação da banda é obrigatória.'); return; }
  // Se o container de dias estiver vazio, renderizar agora
  if (!document.getElementById('ev-dias-container').children.length) {
    atualizarDiasEvento();
  }
  // Coletar horários por dia
  const dias_horarios = {};
  document.querySelectorAll('[data-dia-input]').forEach(el => {
    const dt = el.dataset.diaInput;
    if (!dias_horarios[dt]) dias_horarios[dt] = {};
    if (el.id.startsWith('hora-ini-')) dias_horarios[dt].inicio = el.value;
    if (el.id.startsWith('hora-fim-')) dias_horarios[dt].fim = el.value;
  });
  // Use first day time as main hora (backward compat)
  const hora = dias_horarios[data_inicio]?.inicio || '09:00';
  const editId = document.getElementById('ev-edit-id').value;
  const mins = getChips('ev-ministerios-chips');
  const convidadosNovos = [...document.querySelectorAll('#ev-convidar-lista input:checked')].map(c=>c.value);
  const btn = document.getElementById('btn-save-ev');
  btn.innerHTML = '<span class="spin"></span>'; btn.disabled = true;
  try {
    if (editId) {
      const e = eventos.find(e=>e.id===editId);
      const convites = [...(e.convites||[])];
      const novosConvites = convidadosNovos.filter(vid=>!convites.find(c=>c.volId===vid)).map(vid=>({volId:vid,status:'pendente'}));
      convites.push(...novosConvites);
      const dados = {nome,data:data_inicio,data_inicio,data_fim:data_fim||null,hora,dias_horarios,descricao:document.getElementById('ev-desc').value.trim(),banda,live:document.getElementById('ev-live').checked,som:document.getElementById('ev-som').checked,local:document.getElementById('ev-local').value,ministerios:mins,convites};
      await sb(`eventos?id=eq.${editId}`,{method:'PATCH',body:JSON.stringify(dados)});
      if (e) Object.assign(e,dados);
      // Criar notificações
      // Convites novos
      for (const c of novosConvites) {
        await sb('notificacoes',{method:'POST',prefer:'return=minimal',body:JSON.stringify({vol_id:c.volId,tipo:'convite',ev_id:editId,ev_nome:nome,ev_data:data_inicio,ev_hora:hora,mensagem:'Você foi convidado para servir neste evento.'})});
      }
      // Notificar inscritos que o evento foi editado
      for (const insc of (e.inscritos||[])) {
        if (insc.volId === currentProfile.id) continue;
        await sb('notificacoes',{method:'POST',prefer:'return=minimal',body:JSON.stringify({vol_id:insc.volId,tipo:'update_evento',ev_id:editId,ev_nome:nome,ev_data:data_inicio,ev_hora:hora,mensagem:'O evento foi atualizado. Verifique os novos detalhes.'})});
      }
      // Notificar líderes de ministérios novos adicionados
      const minsNovos = mins.filter(id => !(e.ministerios||[]).includes(id));
      for (const minId of minsNovos) {
        const m = ministerios.find(m => m.id === minId);
        if (m && m.lider_id && m.lider_id !== currentProfile.id) {
          await sb('notificacoes',{method:'POST',prefer:'return=minimal',body:JSON.stringify({vol_id:m.lider_id,tipo:'lider_evento',ev_id:editId,ev_nome:nome,ev_data:data_inicio,ev_hora:hora,mensagem:'Seu ministério foi adicionado a este evento. Mobilize sua equipe.'})});
        }
      }
    } else {
      const convites = convidadosNovos.map(vid=>({volId:vid,status:'pendente'}));
      const dados = {nome,data:data_inicio,data_inicio,data_fim:data_fim||null,hora,dias_horarios,descricao:document.getElementById('ev-desc').value.trim(),banda,live:document.getElementById('ev-live').checked,som:document.getElementById('ev-som').checked,local:document.getElementById('ev-local').value,ministerios:mins,inscritos:[],convites};
      const rows = await sb('eventos',{method:'POST',body:JSON.stringify(dados)});
      if (rows && rows[0]) {
        const novoEv = {...rows[0],ministerios:mins,inscritos:[],convites};
        eventos.push(novoEv);
        // Convites
      for (const c of convites) {
          await sb('notificacoes',{method:'POST',prefer:'return=minimal',body:JSON.stringify({vol_id:c.volId,tipo:'convite',ev_id:rows[0].id,ev_nome:nome,ev_data:data_inicio,ev_hora:hora,mensagem:'Você foi convidado para servir neste evento.'})});
        }
        // Notificar líderes dos ministérios vinculados
        for (const minId of mins) {
          const m = ministerios.find(m => m.id === minId);
          if (m && m.lider_id && m.lider_id !== currentProfile.id) {
            await sb('notificacoes',{method:'POST',prefer:'return=minimal',body:JSON.stringify({vol_id:m.lider_id,tipo:'lider_evento',ev_id:rows[0].id,ev_nome:nome,ev_data:data_inicio,ev_hora:hora,mensagem:'Seu ministério foi adicionado a este evento. Mobilize sua equipe.'})});
          }
        }
      }
    }
    closeModal('modal-ev'); renderEventos(); renderDashboard(); renderCalendario();
  } catch(e) { alert('Erro ao salvar: '+e.message); }
  btn.innerHTML = 'Salvar'; btn.disabled = false;
}

async function deleteEv(id) {
  if (!confirm('Remover evento?')) return;
  await sb(`eventos?id=eq.${id}`,{method:'DELETE'});
  eventos = eventos.filter(e=>e.id!==id);
  renderEventos(); renderDashboard();
}

// ===== DIAS DO EVENTO =====
// ===== DIAS DO EVENTO =====
const LOCAIS = {salao_principal:'Salão Principal', multiuso:'Multiuso', quadra:'Quadra'};

function atualizarDiasEvento() {
  const inicioEl = document.getElementById('ev-data-inicio');
  const fimEl = document.getElementById('ev-data-fim');
  const container = document.getElementById('ev-dias-container');
  if (!inicioEl || !fimEl || !container) return;
  const inicio = inicioEl.value;
  const fim = fimEl.value;
  if (!inicio) { container.innerHTML=''; return; }

  // Preserve existing values
  const existentes = {};
  container.querySelectorAll('[data-dia-input]').forEach(el => {
    const dt = el.dataset.diaInput;
    if (!existentes[dt]) existentes[dt] = {};
    if (el.id.startsWith('hora-ini-')) existentes[dt].inicio = el.value;
    if (el.id.startsWith('hora-fim-')) existentes[dt].fim = el.value;
  });

  const dias = [];
  const d = new Date(inicio + 'T12:00:00');
  const dFim = fim ? new Date(fim + 'T12:00:00') : new Date(inicio + 'T12:00:00');
  if (dFim < d) { container.innerHTML = '<p style="font-size:12px;color:var(--danger-text);padding:6px 0">A data de término não pode ser anterior à data de início.</p>'; return; }
  while (d <= dFim) { dias.push(d.toISOString().split('T')[0]); d.setDate(d.getDate()+1); }

  if (dias.length === 1) {
    const dt = dias[0];
    container.innerHTML = `<div class="grid-2" style="gap:12px;margin-top:10px">
      <div class="form-group" style="margin-bottom:0"><label>Horário de início</label><input type="time" id="hora-ini-${dt}" data-dia-input="${dt}" value="${existentes[dt]?.inicio||'09:00'}"></div>
      <div class="form-group" style="margin-bottom:0"><label>Horário de término</label><input type="time" id="hora-fim-${dt}" data-dia-input="${dt}" value="${existentes[dt]?.fim||'12:00'}"></div>
    </div>`;
  } else {
    const rows = dias.map(dt => {
      const label = new Date(dt+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short'});
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:0.5px solid var(--border)">
        <span style="font-size:12px;font-weight:500;min-width:90px;color:var(--text-secondary)">${label}</span>
        <input type="time" id="hora-ini-${dt}" data-dia-input="${dt}" value="${existentes[dt]?.inicio||'09:00'}" style="flex:1;padding:6px 10px;border:0.5px solid var(--border-md);border-radius:var(--radius);font-size:13px;background:var(--bg-primary);color:var(--text-primary)">
        <span style="font-size:12px;color:var(--text-tertiary)">até</span>
        <input type="time" id="hora-fim-${dt}" data-dia-input="${dt}" value="${existentes[dt]?.fim||'22:00'}" style="flex:1;padding:6px 10px;border:0.5px solid var(--border-md);border-radius:var(--radius);font-size:13px;background:var(--bg-primary);color:var(--text-primary)">
      </div>`;
    }).join('');
    container.innerHTML = `<div style="margin-top:10px;background:var(--bg-secondary);border-radius:var(--radius);padding:10px 14px">
      <p style="font-size:11px;font-weight:500;color:var(--text-secondary);margin-bottom:6px;text-transform:uppercase;letter-spacing:.3px">Horários por dia (${dias.length} dias)</p>
      ${rows}
    </div>`;
  }
}

function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function populateChips(cId) {
  document.getElementById(cId).innerHTML = ministerios.map(m=>`<div class="chip" data-id="${m.id}" onclick="this.classList.toggle('selected')">${ICONES[m.icone]} ${m.nome}</div>`).join('');
}
function getChips(cId) { return [...document.querySelectorAll(`#${cId} .chip.selected`)].map(c=>c.dataset.id); }

document.querySelectorAll('.modal-backdrop').forEach(m=>{m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open');});});
document.getElementById('login-email').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});
document.getElementById('login-senha').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});

// Iniciar
init();
