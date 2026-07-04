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

  const canManage = nivelPodeGerenciarVoluntarios(getNivelAtivo());
  const tbody = document.getElementById('vol-tbody');

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-tertiary)"><i class="ti ti-search" style="font-size:20px;display:block;margin-bottom:8px"></i>Nenhum voluntário encontrado</td></tr>`;
    return;
  }

  // Desktop table
  tbody.innerHTML = lista.map(v => {
    const mins = (v.ministerios||[]).map(id=>{const m=ministerios.find(m=>m.id===id);return m?`<span class="tag ${m.cor}">${m.nome}</span>`:''}).join('');
    const btns = canManage ? `<div style="display:flex;gap:4px"><button class="btn sm" onclick="editVoluntario('${v.id}')"><i class="ti ti-edit"></i></button>${v.id!==currentProfile.id?`<button class="btn sm danger" onclick="deleteVol('${v.id}')"><i class="ti ti-trash"></i></button>`:''}</div>` : '';
    return `<tr><td><div style="display:flex;align-items:center;gap:8px"><div class="avatar ${getNivelClass(v.nivel)}" style="width:28px;height:28px;font-size:10px">${ini(v.nome)}</div>${v.nome}</div></td><td style="color:var(--text-secondary)">${v.email}</td><td style="color:var(--text-secondary)">${v.tel||'—'}</td><td>${mins||'—'}</td><td><span class="badge ${getNivelClass(v.nivel)}">${getNivelLabel(v.nivel)}</span></td><td>${btns}</td></tr>`;
  }).join('');

  // Mobile cards
  const mobileCards = document.getElementById('vol-cards-mobile');
  if (mobileCards) {
    mobileCards.innerHTML = lista.map(v => {
      const mins = (v.ministerios||[]).map(id=>{const m=ministerios.find(m=>m.id===id);return m?`<span class="tag ${m.cor}">${m.nome}</span>`:''}).join('');
      const nivelLabel = getNivelLabel(v.nivel);
      const nivelClass = getNivelClass(v.nivel);
      const btns = canManage ? `<div style="display:flex;gap:6px;margin-top:8px">
        <button class="btn sm" onclick="editVoluntario('${v.id}')"><i class="ti ti-edit"></i>Editar</button>
        ${v.id!==currentProfile.id?`<button class="btn sm danger" onclick="deleteVol('${v.id}')"><i class="ti ti-trash"></i>Remover</button>`:''}
      </div>` : '';
      return `<div class="vol-card">
        <div class="avatar ${nivelClass}" style="width:42px;height:42px;font-size:14px;flex-shrink:0">${ini(v.nome)}</div>
        <div class="vol-card-info">
          <div class="vol-card-nome">${v.nome}${v.id===currentProfile.id?' <span style="font-size:10px;color:var(--purple-text)">(você)</span>':''}</div>
          <div class="vol-card-email">${v.email}</div>
          <div class="vol-card-tags">
            <span class="badge ${nivelClass}" style="margin-right:4px">${nivelLabel}</span>
            ${mins}
          </div>
          ${v.tel?`<div style="font-size:12px;color:var(--text-secondary);margin-top:3px"><i class="ti ti-phone" style="font-size:11px"></i> ${v.tel}</div>`:''}
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

async function deleteVol(id) {
  if (id===currentProfile.id) { alert('Você não pode remover seu próprio cadastro.'); return; }
  if (!confirm('Remover voluntário?')) return;
  await sb(`voluntarios?id=eq.${id}`,{method:'DELETE'});
  voluntarios = voluntarios.filter(v=>v.id!==id);
  renderVoluntarios(); renderDashboard();
}
