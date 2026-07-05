// ===== MINISTÉRIOS =====
// ===== MINISTÉRIOS =====
function renderMinisterios() {
  const busca = (document.getElementById('min-busca')?.value||'').toLowerCase();
  const filtroAcesso = document.getElementById('min-filtro-acesso')?.value||'';
  const ordem = document.getElementById('min-ordem')?.value||'nome';

  let lista = ministerios.filter(m => {
    if (busca && !m.nome.toLowerCase().includes(busca) && !(m.descricao||'').toLowerCase().includes(busca)) return false;
    if (filtroAcesso === 'meus' && !canAccess(m.id)) return false;
    if (filtroAcesso === 'outros' && canAccess(m.id)) return false;
    return true;
  });

  lista = lista.sort((a,b) => {
    if (ordem === 'nome') return a.nome.localeCompare(b.nome,'pt-BR');
    if (ordem === 'nome-desc') return b.nome.localeCompare(a.nome,'pt-BR');
    if (ordem === 'vols') {
      const va = voluntarios.filter(v=>(v.ministerios||[]).includes(a.id)).length;
      const vb = voluntarios.filter(v=>(v.ministerios||[]).includes(b.id)).length;
      return vb - va;
    }
    return 0;
  });

  const grid = document.getElementById('ministerios-grid');
  if (!lista.length) {
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><i class="ti ti-search"></i>Nenhum ministério encontrado</div>';
    return;
  }
  const isAdmin = nivelIsAdmin(getNivelAtivo());
  const podeCriarMin = perm(getNivelAtivo(),'pode_criar_ministerios');
  grid.innerHTML = '';
  lista.forEach(m => {
    const locked = !canAccess(m.id);
    const vols = voluntarios.filter(v=>(v.ministerios||[]).includes(m.id));
    const lider = voluntarios.find(v=>v.id===m.lider_id);
    const div = document.createElement('div');
    div.className = 'ministry-card' + (locked?' locked':'');
    div.style.cssText = 'display:flex;flex-direction:column';
    let html = `<div class="icon" style="background:var(--${m.cor}-bg)">${locked?`<i class="ti ti-lock" style="font-size:18px;color:var(--${m.cor}-text)"></i>`:ICONES[m.icone]||'⭐'}</div>`;
    html += `<h3>${m.nome}</h3><p style="flex:1;margin-bottom:8px">${m.descricao||''}</p>`;
    if (lider) html += `<p style="font-size:11px;color:var(--text-secondary);margin-bottom:8px"><i class="ti ti-crown" style="font-size:11px;margin-right:3px"></i>Líder: ${lider.nome}</p>`;
    html += `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><span style="font-size:12px;color:var(--text-secondary)">${vols.length} voluntário(s)</span>${locked?'<span class="tag" style="background:var(--bg-secondary);color:var(--text-tertiary)">Sem acesso</span>':`<span class="tag ${m.cor}">Aberto</span>`}</div>`;
    if (!locked) html += `<button class="btn sm" style="width:100%;justify-content:center;margin-bottom:6px" data-open="${m.id}"><i class="ti ti-eye"></i>Ver ministério</button>`;
    const minBtns = [];
    if (podEditarMinisterio(m.id)) minBtns.push(`<button class="btn sm" style="flex:1;justify-content:center" data-edit="${m.id}"><i class="ti ti-edit"></i>Editar</button>`);
    if (podExcluirMinisterio(m.id)) minBtns.push(`<button class="btn sm danger" style="flex:1;justify-content:center" data-del="${m.id}"><i class="ti ti-trash"></i>Excluir</button>`);
    if (minBtns.length) html += `<div style="display:flex;gap:4px">${minBtns.join('')}</div>`;
    div.innerHTML = html;
    grid.appendChild(div);
    const ob = div.querySelector('[data-open]'); if (ob) ob.addEventListener('click',()=>openDetalhe(ob.dataset.open));
    const eb = div.querySelector('[data-edit]'); if (eb) eb.addEventListener('click',()=>editMinisterio(eb.dataset.edit));
    const db2 = div.querySelector('[data-del]'); if (db2) db2.addEventListener('click',()=>deleteMinisterio(db2.dataset.del));
  });
}

function openDetalhe(id) { navigate('ministerio-detalhe', id); }

function renderDetalhe(id) {
  currentDetalheId = id;
  const m = ministerios.find(m=>m.id===id); if (!m) return;
  const isAdmin = nivelIsAdmin(getNivelAtivo());
  const isLiderOuAdmin = nivelIsLiderOuAdmin(getNivelAtivo());
  document.getElementById('detalhe-nome').textContent = m.nome;
  const detBtns = [];
  if (podEditarMinisterio(id)) detBtns.push(`<button class="btn sm" onclick="editMinisterio('${id}')"><i class="ti ti-edit"></i>Editar</button>`);
  if (podExcluirMinisterio(id)) detBtns.push(`<button class="btn sm danger" onclick="deleteMinisterio('${id}',true)"><i class="ti ti-trash"></i>Excluir</button>`);
  document.getElementById('detalhe-admin-btns').innerHTML = detBtns.length ? `<div style="display:flex;gap:6px">${detBtns.join('')}</div>` : '';
  const lider = voluntarios.find(v=>v.id===m.lider_id);
  const liderBar = document.getElementById('detalhe-lider-bar');
  if (lider) { liderBar.style.display='block'; document.getElementById('detalhe-lider-nome').textContent=lider.nome; }
  else { liderBar.style.display='none'; }
  document.getElementById('detalhe-add-vol-btn').innerHTML = isLiderOuAdmin ? `<button class="btn sm primary" onclick="openAddVolMin('${id}')"><i class="ti ti-user-plus"></i>Adicionar</button>` : '';
  const vols = voluntarios.filter(v=>(v.ministerios||[]).includes(id));
  document.getElementById('detalhe-vols').innerHTML = vols.length ? vols.map(v=>`
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:0.5px solid var(--border)">
      <div class="avatar ${getNivelClass(v.nivel)}" style="width:36px;height:36px;font-size:12px;flex-shrink:0">${ini(v.nome)}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:6px"><p style="font-size:13px;font-weight:500">${v.nome}</p>${m.lider_id===v.id?'<span style="font-size:10px;background:var(--amber-bg);color:var(--amber-text);padding:1px 6px;border-radius:4px">Líder</span>':''}</div>
        <p style="font-size:11px;color:var(--text-secondary)">${v.email} · ${v.tel||'sem telefone'}</p>
      </div>
      ${isLiderOuAdmin?`<button class="btn sm danger" onclick="removeVolFromMin('${v.id}','${id}')"><i class="ti ti-x"></i></button>`:''}
    </div>`).join('') : '<p style="font-size:13px;color:var(--text-secondary);padding:8px 0">Nenhum voluntário.</p>';
  const evs = eventos.filter(e=>(e.ministerios||[]).includes(id));
  document.getElementById('detalhe-eventos').innerHTML = evs.length ? evs.map(e=>{
    const d = new Date(e.data+'T12:00:00');
    const ds = d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});
    return `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:0.5px solid var(--border);align-items:center"><span style="background:var(--purple-bg);color:var(--purple-text);border-radius:4px;padding:2px 8px;font-size:11px;white-space:nowrap;flex-shrink:0">${ds}</span><div><p style="font-size:13px;font-weight:500">${e.nome}</p><p style="font-size:11px;color:var(--text-secondary)">${e.hora||''} · ${(e.inscritos||[]).length} inscritos</p></div></div>`;
  }).join('') : '<p style="font-size:13px;color:var(--text-secondary)">Nenhum evento.</p>';
}

async function removeVolFromMin(volId, minId) {
  if (!confirm('Remover este voluntário do ministério?')) return;
  const v = voluntarios.find(v=>v.id===volId); if (!v) return;
  const mins = (v.ministerios||[]).filter(x=>x!==minId);
  await sb(`voluntarios?id=eq.${volId}`, {method:'PATCH',body:JSON.stringify({ministerios:mins})});
  v.ministerios = mins;
  renderDetalhe(minId);
}

function openAddVolMin(minId) {
  const jaEsta = voluntarios.filter(v=>(v.ministerios||[]).includes(minId)).map(v=>v.id);
  const disponiveis = voluntarios.filter(v=>!jaEsta.includes(v.id));
  const lista = document.getElementById('add-vol-min-lista');
  lista.dataset.minId = minId;
  lista.innerHTML = disponiveis.length ? disponiveis.map(v=>`
    <label style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:var(--radius);cursor:pointer;border:0.5px solid var(--border);margin-bottom:6px">
      <input type="checkbox" value="${v.id}" style="width:16px;height:16px;accent-color:#7F77DD">
      <div class="avatar ${v.nivel}" style="width:30px;height:30px;font-size:10px;flex-shrink:0">${ini(v.nome)}</div>
      <div><p style="font-size:13px;font-weight:500">${v.nome}</p><p style="font-size:11px;color:var(--text-secondary)">${v.email}</p></div>
    </label>`).join('') : '<p style="font-size:13px;color:var(--text-secondary)">Todos os voluntários já estão neste ministério.</p>';
  openModal('modal-add-vol-min');
}

async function saveAddVolMin() {
  const minId = document.getElementById('add-vol-min-lista').dataset.minId;
  const checked = [...document.querySelectorAll('#add-vol-min-lista input:checked')].map(c=>c.value);
  for (const vid of checked) {
    const v = voluntarios.find(v=>v.id===vid);
    if (v && !(v.ministerios||[]).includes(minId)) {
      const mins = [...(v.ministerios||[]),minId];
      await sb(`voluntarios?id=eq.${vid}`,{method:'PATCH',body:JSON.stringify({ministerios:mins})});
      v.ministerios = mins;
    }
  }
  closeModal('modal-add-vol-min');
  renderDetalhe(minId);
}

function openModalMin() {
  document.getElementById('modal-min-title').textContent = 'Criar ministério';
  document.getElementById('min-edit-id').value = '';
  document.getElementById('min-nome').value = '';
  document.getElementById('min-desc').value = '';
  document.getElementById('min-icone').value = 'ti-music';
  document.getElementById('min-cor').value = 'purple';
  populateLiderSelect(null);
  openModal('modal-min');
}

function populateLiderSelect(selectedId) {
  document.getElementById('min-lider').innerHTML = '<option value="">— Sem líder —</option>' +
    voluntarios.map(v=>`<option value="${v.id}"${v.id===selectedId?' selected':''}>${v.nome}</option>`).join('');
}

function editMinisterio(id) {
  const m = ministerios.find(m=>m.id===id); if (!m) return;
  document.getElementById('modal-min-title').textContent = 'Editar ministério';
  document.getElementById('min-edit-id').value = id;
  document.getElementById('min-nome').value = m.nome;
  document.getElementById('min-desc').value = m.descricao||'';
  document.getElementById('min-icone').value = m.icone;
  document.getElementById('min-cor').value = m.cor;
  populateLiderSelect(m.lider_id||null);
  openModal('modal-min', true);
}

async function saveMinisterio() {
  const nome = document.getElementById('min-nome').value.trim();
  if (!nome) { alert('Nome é obrigatório.'); return; }
  const dados = {nome, descricao:document.getElementById('min-desc').value.trim(), icone:document.getElementById('min-icone').value, cor:document.getElementById('min-cor').value, lider_id:document.getElementById('min-lider').value||null};
  const editId = document.getElementById('min-edit-id').value;
  if (editId) {
    await sb(`ministerios?id=eq.${editId}`,{method:'PATCH',body:JSON.stringify(dados)});
    const m = ministerios.find(m=>m.id===editId); if (m) Object.assign(m,dados);
  } else {
    const rows = await sb('ministerios',{method:'POST',body:JSON.stringify(dados)});
    if (rows && rows[0]) ministerios.push({...rows[0],ministerios:[],inscritos:[],convites:[]});
  }
  closeModal('modal-min'); renderMinisterios(); renderDashboard();
}

async function deleteMinisterio(id, goBack) {
  const m = ministerios.find(m=>m.id===id); if (!m) return;
  if (!confirm(`Excluir o ministério "${m.nome}"?\nAs vinculações serão removidas.`)) return;
  await sb(`ministerios?id=eq.${id}`,{method:'DELETE'});
  ministerios = ministerios.filter(x=>x.id!==id);
  for (const v of voluntarios.filter(v=>(v.ministerios||[]).includes(id))) {
    const mins = v.ministerios.filter(x=>x!==id);
    await sb(`voluntarios?id=eq.${v.id}`,{method:'PATCH',body:JSON.stringify({ministerios:mins})});
    v.ministerios = mins;
  }
  if (goBack) navigate('ministerios'); else renderMinisterios();
  renderDashboard();
}

// ===== NÍVEIS DE ACESSO =====
