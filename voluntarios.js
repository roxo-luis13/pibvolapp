// ===== VOLUNTÁRIOS =====
// ===== VOLUNTÁRIOS =====
function renderVoluntarios() {
  // Atualizar selects de filtro
  const selMin = document.getElementById('vol-filtro-min');
  const selNivel = document.getElementById('vol-filtro-nivel');
  if (selMin) {
    const curMin = selMin.value;
    selMin.innerHTML = '<option value="">Todos os ministérios</option>' +
      ministerios.map(m=>`<option value="${m.id}">${m.nome}</option>`).join('');
    selMin.value = curMin;
  }
  if (selNivel) {
    const curNivel = selNivel.value;
    selNivel.innerHTML = '<option value="">Todos os níveis</option>' +
      [...new Set(voluntarios.map(v=>v.nivel))].map(n=>`<option value="${n}">${getNivelLabel(n)}</option>`).join('');
    selNivel.value = curNivel;
  }

  const busca = (document.getElementById('vol-busca')?.value||'').toLowerCase();
  const filtroMin = document.getElementById('vol-filtro-min')?.value||'';
  const filtroNivel = document.getElementById('vol-filtro-nivel')?.value||'';
  const ordem = document.getElementById('vol-ordem')?.value||'nome';

  let lista = voluntarios.filter(v => {
    const textoOk = !busca || v.nome.toLowerCase().includes(busca) || (v.email||'').toLowerCase().includes(busca) || (v.tel||'').includes(busca);
    const minOk = !filtroMin || (v.ministerios||[]).includes(filtroMin);
    const nivelOk = !filtroNivel || v.nivel === filtroNivel;
    return textoOk && minOk && nivelOk;
  });

  lista.sort((a,b) => {
    if (ordem==='nome-desc') return b.nome.localeCompare(a.nome,'pt');
    if (ordem==='nivel') return (a.nivel||'').localeCompare(b.nivel||'','pt');
    if (ordem==='ministerios') return ((b.ministerios||[]).length) - ((a.ministerios||[]).length);
    return a.nome.localeCompare(b.nome,'pt');
  });

  const canEdit = perm(getNivelAtivo(),'pode_editar_voluntarios');
  const canRemove = perm(getNivelAtivo(),'pode_remover_voluntarios');
  const tbody = document.getElementById('vol-tbody');

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--text-tertiary)"><i class="ti ti-search" style="font-size:20px;display:block;margin-bottom:8px"></i>Nenhum voluntário encontrado</td></tr>`;
    return;
  }

  const hoje = new Date();
  const mesIni = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const mesFim = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0, 23, 59, 59);

  // Desktop table
  tbody.innerHTML = lista.map(v => {
    const mins = (v.ministerios||[]).map(id=>{const m=ministerios.find(m=>m.id===id);return m?`<span class="tag ${m.cor}">${m.nome}</span>`:''}).join('');
    const assid = calcularAssiduidade(v.id, mesIni, mesFim);
    const btns = `<div style="display:flex;gap:4px"><button class="btn sm" title="Ver escala" onclick="verEscalaVoluntario('${v.id}')"><i class="ti ti-calendar-stats"></i></button><button class="btn sm" title="Assiduidade" onclick="verAssiduidadeVoluntario('${v.id}')"><i class="ti ti-heart-handshake"></i></button>${canEdit?`<button class="btn sm" onclick="editVoluntario('${v.id}')"><i class="ti ti-edit"></i></button>`:''} ${canRemove&&v.id!==currentProfile.id?`<button class="btn sm danger" onclick="deleteVol('${v.id}')"><i class="ti ti-trash"></i></button>`:''}</div>`;
    return `<tr><td><div style="display:flex;align-items:center;gap:8px"><div class="avatar ${getNivelClass(v.nivel)}" style="width:28px;height:28px;font-size:10px">${ini(v.nome)}</div>${v.nome}</div></td><td>${mins||'—'}</td><td>${renderAssiduidadeMini(assid)}</td><td>${btns}</td></tr>`;
  }).join('');

  // Mobile cards
  const mobileCards = document.getElementById('vol-cards-mobile');
  if (mobileCards) {
    mobileCards.innerHTML = lista.map(v => {
      const mins = (v.ministerios||[]).map(id=>{const m=ministerios.find(m=>m.id===id);return m?`<span class="tag ${m.cor}">${m.nome}</span>`:''}).join('');
      const nivelClass = getNivelClass(v.nivel);
      const assid = calcularAssiduidade(v.id, mesIni, mesFim);
      const btns = `<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
        <button class="btn sm" onclick="verEscalaVoluntario('${v.id}')"><i class="ti ti-calendar-stats"></i>Escala</button>
        <button class="btn sm" onclick="verAssiduidadeVoluntario('${v.id}')"><i class="ti ti-heart-handshake"></i>Assiduidade</button>
        ${canEdit?`<button class="btn sm" onclick="editVoluntario('${v.id}')"><i class="ti ti-edit"></i>Editar</button>`:''}
        ${canRemove&&v.id!==currentProfile.id?`<button class="btn sm danger" onclick="deleteVol('${v.id}')"><i class="ti ti-trash"></i>Remover</button>`:''}
      </div>`;
      return `<div class="vol-card">
        <div class="avatar ${nivelClass}" style="width:42px;height:42px;font-size:14px;flex-shrink:0">${ini(v.nome)}</div>
        <div class="vol-card-info">
          <div class="vol-card-nome">${v.nome}${v.id===currentProfile.id?' <span style="font-size:10px;color:var(--purple-text)">(você)</span>':''}</div>
          <div class="vol-card-tags">${mins}</div>
          <div style="margin-top:6px">${renderAssiduidadeMini(assid)}</div>
          ${btns}
        </div>
      </div>`;
    }).join('');
  }

  // Contador
  const countEl = document.getElementById('vol-count');
  if (countEl) countEl.textContent = lista.length === voluntarios.length ? `${lista.length} voluntário(s)` : `${lista.length} de ${voluntarios.length} voluntário(s)`;
}

function editVoluntario(id) {
  const v = voluntarios.find(v=>v.id===id); if (!v) return;
  document.getElementById('modal-vol-title').textContent = 'Editar voluntário';
  document.getElementById('vol-edit-id').value = id;
  document.getElementById('vol-nome').value = v.nome;
  document.getElementById('vol-email').value = v.email;
  document.getElementById('vol-tel').value = v.tel||'';
  document.getElementById('vol-nivel').value = v.nivel;
  populateChips('vol-ministerios-chips');
  document.querySelectorAll('#vol-ministerios-chips .chip').forEach(c=>{if((v.ministerios||[]).includes(c.dataset.id))c.classList.add('selected');});
  document.getElementById('modal-vol').classList.add('open');
}

async function saveVoluntario() {
  const nome = document.getElementById('vol-nome').value.trim();
  const email = document.getElementById('vol-email').value.trim().toLowerCase();
  if (!nome||!email) { alert('Nome e email são obrigatórios.'); return; }
  const editId = document.getElementById('vol-edit-id').value;
  const nivel = document.getElementById('vol-nivel').value;
  const tel = document.getElementById('vol-tel').value.trim();
  const mins = getChips('vol-ministerios-chips');
  const btn = document.getElementById('btn-save-vol');
  btn.innerHTML = '<span class="spin"></span>'; btn.disabled = true;
  try {
    if (editId) {
      const dados = {nome,email,tel,nivel,ministerios:mins};
      await sb(`voluntarios?id=eq.${editId}`,{method:'PATCH',body:JSON.stringify(dados)});
      const v = voluntarios.find(v=>v.id===editId); if (v) Object.assign(v,dados);
      if (editId===currentProfile.id) { Object.assign(currentProfile,dados); updateSidebar(); }
    } else {
      const dup = voluntarios.find(v=>v.email===email);
      if (dup) { alert('Já existe um voluntário com este email.'); btn.innerHTML='Salvar'; btn.disabled=false; return; }
      const hash = await sha256('123456');
      const dados = {nome,email,tel,nivel,ministerios:mins,senha_hash:hash,primeiro_acesso:true};
      const rows = await sb('voluntarios',{method:'POST',body:JSON.stringify(dados)});
      if (rows && rows[0]) voluntarios.push(rows[0]);
    }
    closeModal('modal-vol'); renderVoluntarios(); renderDashboard();
  } catch(e) { alert('Erro: '+e.message); }
  btn.innerHTML = 'Salvar'; btn.disabled = false;
}

function verEscalaVoluntario(id) {
  const v = voluntarios.find(v=>v.id===id); if (!v) return;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const meusEventos = eventos.filter(e => {
    const fim = new Date((e.data_fim||e.data_inicio||e.data)+'T23:59:59');
    return fim >= hoje && (e.inscritos||[]).some(i=>i.volId===id);
  }).sort((a,b)=>new Date(a.data_inicio||a.data)-new Date(b.data_inicio||b.data));

  const porMes = new Map();
  meusEventos.forEach(e => {
    const d = new Date((e.data_inicio||e.data)+'T12:00:00');
    const chave = d.getFullYear()+'-'+d.getMonth();
    if (!porMes.has(chave)) porMes.set(chave, {ano:d.getFullYear(), mes:d.getMonth(), eventos:[]});
    porMes.get(chave).eventos.push(e);
  });

  document.getElementById('modal-vol-escala-title').textContent = `Escala de ${v.nome}`;
  document.getElementById('modal-vol-escala-content').innerHTML = meusEventos.length ? [...porMes.values()].map(g => {
    const linhas = g.eventos.map(e => {
      const d = new Date((e.data_inicio||e.data)+'T12:00:00');
      const ds = d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});
      const insc = (e.inscritos||[]).find(i=>i.volId===id);
      const min = ministerios.find(m=>m.id===insc?.minId);
      return `<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:0.5px solid var(--border)">
        <span style="font-size:11px;color:var(--text-tertiary);width:52px;flex-shrink:0">${ds}</span>
        <span style="font-size:13px;flex:1">${e.nome}</span>
        ${min?`<span class="tag ${min.cor}" style="flex-shrink:0">${ICONES[min.icone]||'⭐'} ${min.nome}</span>`:''}
      </div>`;
    }).join('');
    return `<div style="margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:.3px;color:var(--text-secondary)">${MESES[g.mes]} ${g.ano}</span>
        <span style="background:var(--purple-bg);color:var(--purple-text);border-radius:var(--radius);padding:2px 8px;font-size:11px;font-weight:500">${g.eventos.length}x</span>
      </div>
      ${linhas}
    </div>`;
  }).join('') : '<div class="empty" style="padding:24px"><i class="ti ti-calendar-off"></i>Nenhum evento futuro para este voluntário.</div>';
  openModal('modal-vol-escala');
}

// Conta, dentro de um período, quantos convites o voluntário recebeu e como respondeu
function calcularAssiduidade(volId, dataIni, dataFim) {
  let aceito = 0, recusado = 0, pendente = 0;
  eventos.forEach(e => {
    const d = new Date((e.data_inicio||e.data)+'T00:00:00');
    if (d < dataIni || d > dataFim) return;
    const c = (e.convites||[]).find(c=>c.volId===volId);
    if (!c) return;
    if (c.status==='aceito') aceito++;
    else if (c.status==='recusado') recusado++;
    else pendente++;
  });
  return {chamado: aceito+recusado+pendente, aceito, recusado, pendente};
}

function renderAssiduidadeMini(a) {
  if (!a.chamado) return '<span style="font-size:11px;color:var(--text-tertiary)">Sem chamados</span>';
  return `<div style="display:flex;gap:4px;flex-wrap:wrap">
    <span title="Chamado(s)" style="font-size:10px;font-weight:500;background:var(--bg-tertiary);color:var(--text-secondary);padding:1px 6px;border-radius:3px">${a.chamado} chamado${a.chamado===1?'':'s'}</span>
    <span title="Aceitou" style="font-size:10px;font-weight:500;background:var(--success-bg);color:var(--success-text);padding:1px 6px;border-radius:3px">${a.aceito} aceito${a.aceito===1?'':'s'}</span>
    <span title="Recusou" style="font-size:10px;font-weight:500;background:var(--danger-bg);color:var(--danger-text);padding:1px 6px;border-radius:3px">${a.recusado} recusado${a.recusado===1?'':'s'}</span>
    <span title="Não respondeu" style="font-size:10px;font-weight:500;background:var(--warning-bg);color:var(--warning-text);padding:1px 6px;border-radius:3px">${a.pendente} pendente${a.pendente===1?'':'s'}</span>
  </div>`;
}

function verAssiduidadeVoluntario(id) {
  const v = voluntarios.find(v=>v.id===id); if (!v) return;
  document.getElementById('modal-vol-assid-title').textContent = `Assiduidade de ${v.nome}`;
  document.getElementById('modal-vol-assiduidade').dataset.volId = id;
  const hoje = new Date();
  const mesIni = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const mesFim = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0);
  document.getElementById('assid-data-ini').value = mesIni.toISOString().split('T')[0];
  document.getElementById('assid-data-fim').value = mesFim.toISOString().split('T')[0];
  openModal('modal-vol-assiduidade');
  atualizarAssiduidadePeriodo();
}

function atualizarAssiduidadePeriodo() {
  const id = document.getElementById('modal-vol-assiduidade').dataset.volId;
  const iniStr = document.getElementById('assid-data-ini').value;
  const fimStr = document.getElementById('assid-data-fim').value;
  const content = document.getElementById('modal-vol-assid-content');
  if (!id || !iniStr || !fimStr) { content.innerHTML = ''; return; }
  const dataIni = new Date(iniStr+'T00:00:00');
  const dataFim = new Date(fimStr+'T23:59:59');
  if (dataIni > dataFim) { content.innerHTML = '<p style="font-size:12px;color:var(--danger-text)">A data de início não pode ser depois da data de fim.</p>'; return; }
  const a = calcularAssiduidade(id, dataIni, dataFim);
  content.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px">
      <div style="background:var(--bg-tertiary);border-radius:var(--radius);padding:14px;text-align:center">
        <h3 style="font-size:22px;font-weight:600;color:var(--text-primary)">${a.chamado}</h3>
        <p style="font-size:11px;color:var(--text-secondary);margin-top:2px">Chamado(s)</p>
      </div>
      <div style="background:var(--success-bg);border-radius:var(--radius);padding:14px;text-align:center">
        <h3 style="font-size:22px;font-weight:600;color:var(--success-text)">${a.aceito}</h3>
        <p style="font-size:11px;color:var(--success-text);margin-top:2px">Aceito(s)</p>
      </div>
      <div style="background:var(--danger-bg);border-radius:var(--radius);padding:14px;text-align:center">
        <h3 style="font-size:22px;font-weight:600;color:var(--danger-text)">${a.recusado}</h3>
        <p style="font-size:11px;color:var(--danger-text);margin-top:2px">Recusado(s)</p>
      </div>
      <div style="background:var(--warning-bg);border-radius:var(--radius);padding:14px;text-align:center">
        <h3 style="font-size:22px;font-weight:600;color:var(--warning-text)">${a.pendente}</h3>
        <p style="font-size:11px;color:var(--warning-text);margin-top:2px">Não respondido(s)</p>
      </div>
    </div>`;
}

async function deleteVol(id) {
  if (id===currentProfile.id) { alert('Você não pode remover seu próprio cadastro.'); return; }
  if (!confirm('Remover voluntário?')) return;
  await sb(`voluntarios?id=eq.${id}`,{method:'DELETE'});
  voluntarios = voluntarios.filter(v=>v.id!==id);
  renderVoluntarios(); renderDashboard();
}
