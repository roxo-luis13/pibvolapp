// ===== NOTIFICAÇÕES =====
// ===== NOTIFICAÇÕES =====
function atualizarBadgeNotif() {
  const pendentes = notificacoes.filter(n=>!n.lida).length;
  const badge = document.getElementById('notif-badge');
  if (badge) badge.style.display = pendentes>0 ? 'block' : 'none';
}

function toggleNotificacoes() {
  const panel = document.getElementById('notif-panel');
  if (panel.style.display==='none'||!panel.style.display) {
    panel.style.display='block'; renderNotificacoes();
    setTimeout(()=>document.addEventListener('click',fecharNotifOutside),10);
  } else { panel.style.display='none'; document.removeEventListener('click',fecharNotifOutside); }
}

function fecharNotifOutside(e) {
  const panel=document.getElementById('notif-panel'); const btn=document.getElementById('notif-btn');
  if (!panel.contains(e.target)&&!btn.contains(e.target)) { panel.style.display='none'; document.removeEventListener('click',fecharNotifOutside); }
}

function renderNotificacoes() {
  const lista = document.getElementById('notif-lista');
  if (!notificacoes.length) { lista.innerHTML='<p style="font-size:13px;color:var(--text-secondary);padding:20px;text-align:center">Nenhuma notificação</p>'; return; }
  lista.innerHTML = notificacoes.map(n => {
    const ev = eventos.find(e=>e.id===n.ev_id);
    const convite = ev?.convites?.find(c=>c.volId===currentProfile.id);
    const status = convite?.status||'pendente';
    const d = new Date((n.ev_data||'')+'T12:00:00');
    const ds = isNaN(d) ? n.ev_data : d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});
    return `<div style="padding:12px 16px;border-bottom:0.5px solid var(--border);background:${n.lida?'transparent':'var(--purple-bg)'}">
      <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px">
        <div style="width:32px;height:32px;border-radius:50%;background:var(--purple-bg);display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="ti ti-calendar-event" style="color:var(--purple-text);font-size:16px"></i></div>
        <div style="flex:1;min-width:0"><p style="font-size:13px;font-weight:500;margin-bottom:2px">Convite: ${n.ev_nome||'Evento'}</p><p style="font-size:11px;color:var(--text-secondary)">${ds} · ${n.ev_hora||''}</p></div>
      </div>
      ${status==='pendente'?`<div style="display:flex;gap:6px"><button class="btn sm primary" style="flex:1;justify-content:center" onclick="responderConvite('${n.id}','${n.ev_id}','aceito')"><i class="ti ti-check"></i>Aceitar</button><button class="btn sm danger" style="flex:1;justify-content:center" onclick="responderConvite('${n.id}','${n.ev_id}','recusado')"><i class="ti ti-x"></i>Recusar</button></div>`:
       status==='aceito'?`<span style="font-size:12px;color:var(--success-text);font-weight:500"><i class="ti ti-check" style="margin-right:4px"></i>Aceito</span>`:
       `<span style="font-size:12px;color:var(--danger-text);font-weight:500"><i class="ti ti-x" style="margin-right:4px"></i>Recusado</span>`}
    </div>`;
  }).join('');
}

async function responderConvite(notifId, evId, resposta) {
  await sb(`notificacoes?id=eq.${notifId}`,{method:'PATCH',body:JSON.stringify({lida:true})});
  const n = notificacoes.find(n=>n.id===notifId); if (n) n.lida=true;
  const ev = eventos.find(e=>e.id===evId); if (!ev) return;
  const convites = [...(ev.convites||[])];
  const convite = convites.find(c=>c.volId===currentProfile.id);
  if (convite) {
    convite.status = resposta;
    let inscritos = [...(ev.inscritos||[])];
    if (resposta==='aceito') {
      const minsDoEvento = (ev.ministerios||[]).filter(mid=>(currentProfile.ministerios||[]).includes(mid));
      if (minsDoEvento.length>0 && !inscritos.find(i=>i.volId===currentProfile.id)) {
        inscritos.push({volId:currentProfile.id,minId:minsDoEvento[0]});
      }
    } else { inscritos = inscritos.filter(i=>i.volId!==currentProfile.id); }
    await sb(`eventos?id=eq.${evId}`,{method:'PATCH',body:JSON.stringify({convites,inscritos})});
    ev.convites = convites; ev.inscritos = inscritos;
  }
  atualizarBadgeNotif(); renderNotificacoes(); renderDashboard();
}

async function marcarTodasLidas() {
  for (const n of notificacoes.filter(n=>!n.lida)) {
    n.lida = true;
    await sb(`notificacoes?id=eq.${n.id}`,{method:'PATCH',body:JSON.stringify({lida:true})});
  }
  atualizarBadgeNotif(); renderNotificacoes();
}

function renderConvidarLista(convitesAtuais) {
  const container = document.getElementById('ev-convidar-lista');
  if (!container) return;

  // Admin e pastor veem todos; outros veem apenas voluntários dos seus ministérios
  const nivel = getNivelAtivo();
  const verTodos = nivelIsAdmin(nivel) || nivel === 'pastor';
  
  // Ministérios que o usuário lidera
  const meusMinIds = currentProfile.ministerios || [];
  const minQueLidero = ministerios
    .filter(m => m.lider_id === currentProfile.id)
    .map(m => m.id);
  // IDs dos ministérios visíveis: os que lidero + os que participo
  const minsVisiveis = verTodos ? null : [...new Set([...meusMinIds, ...minQueLidero])];

  const lista = voluntarios.filter(v => {
    if (v.id === currentProfile.id) return false;
    if (verTodos) return true;
    // Mostrar apenas voluntários que pertencem aos mesmos ministérios
    return (v.ministerios||[]).some(mid => minsVisiveis.includes(mid));
  });

  if (!lista.length) {
    container.innerHTML = '<p style="font-size:13px;color:var(--text-secondary);padding:12px">Nenhum voluntário disponível nos seus ministérios.</p>';
    return;
  }

  container.innerHTML = lista.map(v => {
    const jaConvidado = convitesAtuais.find(c=>c.volId===v.id);
    const status = jaConvidado?.status||null;
    return `<label style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:var(--radius);cursor:pointer" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
      <input type="checkbox" value="${v.id}" ${jaConvidado?'checked':''} style="width:15px;height:15px;accent-color:#7F77DD;flex-shrink:0">
      <div class="avatar ${v.nivel}" style="width:28px;height:28px;font-size:10px;flex-shrink:0">${ini(v.nome)}</div>
      <div style="flex:1;min-width:0"><p style="font-size:13px;font-weight:500">${v.nome}</p><p style="font-size:11px;color:var(--text-secondary)">${(v.ministerios||[]).map(id=>{const m=ministerios.find(m=>m.id===id);return m?m.nome:''}).filter(Boolean).join(', ')||'Sem ministério'}</p></div>
      ${status?`<span style="font-size:10px;padding:2px 7px;border-radius:4px;font-weight:500;background:${status==='aceito'?'var(--success-bg)':status==='recusado'?'var(--danger-bg)':'var(--warning-bg)'};color:${status==='aceito'?'var(--success-text)':status==='recusado'?'var(--danger-text)':'var(--warning-text)'}">${status==='aceito'?'Aceitou':status==='recusado'?'Recusou':'Pendente'}</span>`:''}
    </label>`;
  }).join('') || '<p style="font-size:13px;color:var(--text-secondary);padding:8px">Nenhum voluntário cadastrado.</p>';
}
