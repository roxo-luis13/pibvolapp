// ===== PERFIL =====
// ===== PERFIL =====
function renderPerfil() {
  const av = document.getElementById('perfil-avatar');
  av.textContent = ini(currentProfile.nome);
  av.className = `avatar ${getNivelClass(currentProfile.nivel)}`;
  av.style.cssText = 'width:52px;height:52px;font-size:17px';
  document.getElementById('perfil-nome').textContent = currentProfile.nome;
  const badge = document.getElementById('perfil-badge');
  badge.className = 'badge ' + getNivelClass(currentProfile.nivel);
  badge.textContent = getNivelLabel(currentProfile.nivel);
  document.getElementById('edit-nome').value = currentProfile.nome;
  document.getElementById('edit-tel').value = currentProfile.tel||'';
  document.getElementById('senha-nova').value = '';
  document.getElementById('senha-conf').value = '';
  document.getElementById('senha-msg').style.display = 'none';
  document.getElementById('perfil-msg').style.display = 'none';
  document.getElementById('perfil-ministerios').innerHTML = ministerios.length ? ministerios.map(m => {
    const checked = (currentProfile.ministerios||[]).includes(m.id);
    return `<label style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:0.5px solid var(--border);cursor:pointer">
      <input type="checkbox" value="${m.id}" ${checked?'checked':''} style="width:16px;height:16px;accent-color:#7F77DD;flex-shrink:0">
      <div style="width:32px;height:32px;border-radius:var(--radius);background:var(--${m.cor}-bg);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">${ICONES[m.icone]||'⭐'}</div>
      <div style="flex:1"><p style="font-size:13px;font-weight:500">${m.nome}</p><p style="font-size:11px;color:var(--text-secondary)">${m.descricao||''}</p></div>
      ${checked?`<span class="tag ${m.cor}">Participando</span>`:''}
    </label>`;
  }).join('') : '<p style="font-size:13px;color:var(--text-secondary)">Nenhum ministério cadastrado.</p>';
}

async function savePerfil() {
  const nome = document.getElementById('edit-nome').value.trim();
  if (!nome) { alert('Nome é obrigatório.'); return; }
  const tel = document.getElementById('edit-tel').value.trim();
  await sb(`voluntarios?id=eq.${currentProfile.id}`,{method:'PATCH',body:JSON.stringify({nome,tel})});
  currentProfile.nome = nome; currentProfile.tel = tel;
  const v = voluntarios.find(v=>v.id===currentProfile.id); if (v) { v.nome=nome; v.tel=tel; }
  updateSidebar();
  const msg = document.getElementById('perfil-msg');
  msg.className = 'alert'; msg.style.display='block'; msg.style.background='var(--success-bg)'; msg.style.color='var(--success-text)'; msg.textContent = 'Perfil atualizado com sucesso!';
  setTimeout(()=>msg.style.display='none',3000);
}

async function alterarSenha() {
  const nova = document.getElementById('senha-nova').value;
  const conf = document.getElementById('senha-conf').value;
  const msg = document.getElementById('senha-msg');
  msg.className = 'alert danger'; msg.style.display='block';
  if (nova.length<6) { msg.textContent='Mínimo 6 caracteres.'; return; }
  if (nova!==conf) { msg.textContent='As senhas não coincidem.'; return; }
  try {
    const hash = await sha256(nova);
    const res = await fetch(`${SUPA_URL}/rest/v1/voluntarios?id=eq.${currentProfile.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': 'Bearer ' + SUPA_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ senha_hash: hash })
    });
    if (!res.ok) {
      const errData = await res.json().catch(()=>({}));
      throw new Error(errData.message || `Erro ${res.status}`);
    }
    currentProfile.senha_hash = hash;
    msg.className = 'alert'; msg.style.background='var(--success-bg)'; msg.style.color='var(--success-text)'; msg.textContent='Senha alterada com sucesso!';
    document.getElementById('senha-nova').value = ''; document.getElementById('senha-conf').value = '';
    setTimeout(()=>msg.style.display='none',3000);
  } catch(e) {
    msg.textContent = 'Erro ao alterar senha: ' + e.message;
  }
}

async function saveMinisteriosPerfil() {
  const checked = [...document.querySelectorAll('#perfil-ministerios input:checked')].map(c=>c.value);
  await sb(`voluntarios?id=eq.${currentProfile.id}`,{method:'PATCH',body:JSON.stringify({ministerios:checked})});
  currentProfile.ministerios = checked;
  const v = voluntarios.find(v=>v.id===currentProfile.id); if (v) v.ministerios = checked;
  renderPerfil();
  const btn = document.querySelector('[onclick="saveMinisteriosPerfil()"]');
  if (btn) { const o=btn.innerHTML; btn.innerHTML='<i class="ti ti-check"></i>Salvo!'; btn.disabled=true; setTimeout(()=>{btn.innerHTML=o;btn.disabled=false;},2000); }
}
