// ===== NOTIFICAÇÕES =====
// ===== NOTIFICAÇÕES =====

// ===== PUSH NOTIFICATIONS (Web Push real - funciona com o app fechado) =====
const VAPID_PUBLIC_KEY = 'BKKOIKl1wdxsn6KfWYrM08KAqeAnL0KlHwELSpdiD982ScXrsT-kukZIaXEoluOg9UgaT7kLybcU6unC_sifPp0';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

async function ativarNotificacoesPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !currentProfile) return;
  try {
    const reg = await navigator.serviceWorker.register('sw.js');
    let permissao = Notification.permission;
    if (permissao === 'default') permissao = await Notification.requestPermission();
    if (permissao !== 'granted') return;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    const json = sub.toJSON();
    await sb('push_subscriptions?on_conflict=endpoint', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: JSON.stringify({ vol_id: currentProfile.id, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth })
    });
  } catch (e) { console.error('Falha ao ativar notificações push:', e); }
}

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
    const d = new Date((n.ev_data||'')+'T12:00:00');
    const ds = isNaN(d) ? n.ev_data : d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});
    const tipo = n.tipo || 'convite';
    const cfg = {
      convite:      {icon:'ti-calendar-event', bg:'var(--purple-bg)', color:'var(--purple-text)', titulo:'Convite'},
      lider_evento: {icon:'ti-bell-ringing',   bg:'var(--amber-bg)',  color:'var(--amber-text)',  titulo:'Mobilize sua equipe'},
      update_evento:{icon:'ti-refresh',         bg:'var(--blue-bg)',   color:'var(--blue-text)',   titulo:'Evento atualizado'},
      voluntario_confirmado:{icon:'ti-user-check', bg:'var(--success-bg)', color:'var(--success-text)', titulo:'Confirmação de escala'},
      lembrete_resposta_2sem:{icon:'ti-clock-exclamation', bg:'var(--amber-bg)', color:'var(--amber-text)', titulo:'Responda ao convite'},
      lembrete_resposta_1sem:{icon:'ti-clock-exclamation', bg:'var(--amber-bg)', color:'var(--amber-text)', titulo:'Responda ao convite'},
      lembrete_2dias:{icon:'ti-calendar-time', bg:'var(--blue-bg)', color:'var(--blue-text)', titulo:'Evento em breve'},
      lembrete_30min:{icon:'ti-alarm', bg:'var(--coral-bg)', color:'var(--coral-text)', titulo:'Começa em 30 minutos'},
    }[tipo] || {icon:'ti-bell', bg:'var(--purple-bg)', color:'var(--purple-text)', titulo:'Notificação'};

    let acoes = '';
    if (tipo === 'convite' || tipo === 'lembrete_resposta_2sem' || tipo === 'lembrete_resposta_1sem') {
      const convite = ev?.convites?.find(c=>c.volId===currentProfile.id);
      const status = convite?.status||'pendente';
      acoes = status==='pendente'
        ? `<div style="display:flex;gap:6px;margin-top:8px">
            <button class="btn sm primary" style="flex:1;justify-content:center" onclick="responderConvite('${n.id}','${n.ev_id}','aceito')"><i class="ti ti-check"></i>Aceitar</button>
            <button class="btn sm danger" style="flex:1;justify-content:center" onclick="responderConvite('${n.id}','${n.ev_id}','recusado')"><i class="ti ti-x"></i>Recusar</button>
           </div>`
        : status==='aceito'
          ? `<span style="font-size:12px;color:var(--success-text);font-weight:500"><i class="ti ti-check" style="margin-right:4px"></i>Confirmado</span>`
          : `<span style="font-size:12px;color:var(--danger-text);font-weight:500"><i class="ti ti-x" style="margin-right:4px"></i>Recusado</span>`;
    } else {
      acoes = `<button class="btn sm" style="margin-top:6px" onclick="abrirDetalheEvDash('${n.ev_id}');marcarLida('${n.id}')"><i class="ti ti-eye"></i>Ver evento</button>`;
    }

    return `<div style="padding:12px 16px;border-bottom:0.5px solid var(--border);background:${n.lida?'transparent':'var(--bg-secondary)'}" onclick="marcarLida('${n.id}')">
      <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:4px">
        <div style="width:34px;height:34px;border-radius:50%;background:${cfg.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="ti ${cfg.icon}" style="color:${cfg.color};font-size:16px"></i>
        </div>
        <div style="flex:1;min-width:0">
          <p style="font-size:13px;font-weight:500;margin-bottom:2px">${cfg.titulo}: ${n.ev_nome||'Evento'}</p>
          <p style="font-size:11px;color:var(--text-secondary)">${ds}${n.ev_hora?' · '+n.ev_hora:''}</p>
          ${n.mensagem?`<p style="font-size:12px;color:var(--text-secondary);margin-top:3px;font-style:italic">${n.mensagem}</p>`:''}
        </div>
        ${!n.lida?`<div style="width:8px;height:8px;border-radius:50%;background:var(--coral-text);flex-shrink:0;margin-top:4px"></div>`:''}
      </div>
      ${acoes}
    </div>`;
  }).join('');
}

async function notificarLiderConfirmacao(ev, minId) {
  const m = ministerios.find(m => m.id === minId);
  if (!m || !m.lider_id || m.lider_id === currentProfile.id) return;
  try {
    await sb('notificacoes',{method:'POST',prefer:'return=minimal',body:JSON.stringify({
      vol_id: m.lider_id,
      tipo: 'voluntario_confirmado',
      ev_id: ev.id,
      ev_nome: ev.nome,
      ev_data: ev.data_inicio||ev.data,
      ev_hora: ev.hora,
      mensagem: `${currentProfile.nome} confirmou presença no ministério ${m.nome}.`
    })});
  } catch(e) {}
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
    let precisaEscolherEquipe = false;
    if (resposta==='aceito') {
      const minsDoEvento = (ev.ministerios||[]).filter(mid=>(currentProfile.ministerios||[]).includes(mid));
      if (!inscritos.find(i=>i.volId===currentProfile.id)) {
        if (minsDoEvento.length===1) {
          inscritos.push({volId:currentProfile.id,minId:minsDoEvento[0]});
          await notificarLiderConfirmacao(ev, minsDoEvento[0]);
        } else if (minsDoEvento.length>1) {
          precisaEscolherEquipe = true; // pertence a mais de uma equipe do evento — não escolher por ele
        } else {
          // Chamado avulso: não pertence a nenhum dos ministérios convocados deste evento
          inscritos.push({volId:currentProfile.id,minId:null});
        }
      }
    } else { inscritos = inscritos.filter(i=>i.volId!==currentProfile.id); }
    await sb(`eventos?id=eq.${evId}`,{method:'PATCH',body:JSON.stringify({convites,inscritos})});
    ev.convites = convites; ev.inscritos = inscritos;
    if (precisaEscolherEquipe) {
      alert('Você faz parte de mais de uma equipe neste evento. Abra o evento no Calendário para escolher em qual equipe vai servir.');
    }
  }
  atualizarTodasAsViews();
}

async function marcarLida(notifId) {
  const n = notificacoes.find(n=>n.id===notifId);
  if (!n || n.lida) return;
  n.lida = true;
  await sb(`notificacoes?id=eq.${notifId}`,{method:'PATCH',body:JSON.stringify({lida:true})});
  atualizarBadgeNotif();
  renderNotificacoes();
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

  const nivel = getNivelAtivo();
  const verTodos = nivelIsAdmin(nivel) || nivel === 'pastor';
  const meusMinIds = currentProfile.ministerios || [];
  const minQueLidero = ministerios.filter(m => m.lider_id === currentProfile.id).map(m => m.id);
  const minsVisiveis = verTodos ? null : [...new Set([...meusMinIds, ...minQueLidero])];

  let lista = voluntarios.filter(v => {
    if (v.id === currentProfile.id) return false;
    if (verTodos) return true;
    return (v.ministerios||[]).some(mid => minsVisiveis.includes(mid));
  });

  if (!lista.length) {
    container.innerHTML = '<p style="font-size:13px;color:var(--text-secondary);padding:12px">Nenhum voluntário disponível nos seus ministérios.</p>';
    return;
  }

  // Ordenar: minha equipe primeiro, depois alfabético
  const minhaEquipe = new Set([...meusMinIds, ...minQueLidero]);
  const ehDaEquipe = v => (v.ministerios||[]).some(mid => minhaEquipe.has(mid));
  lista.sort((a, b) => {
    const ae = ehDaEquipe(a), be = ehDaEquipe(b);
    if (ae && !be) return -1;
    if (!ae && be) return 1;
    return a.nome.localeCompare(b.nome, 'pt');
  });

  const temEquipe = lista.some(ehDaEquipe);
  const temOutros = lista.some(v => !ehDaEquipe(v));
  let separadorColocado = false;

  const cardVol = (v) => {
    const jaConvidado = convitesAtuais.find(c=>c.volId===v.id);
    const status = jaConvidado?.status||null;
    return `<label style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:var(--radius);cursor:pointer" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
      <input type="checkbox" value="${v.id}" ${jaConvidado?'checked':''} style="width:15px;height:15px;accent-color:#7F77DD;flex-shrink:0">
      <div class="avatar ${v.nivel}" style="width:28px;height:28px;font-size:10px;flex-shrink:0">${ini(v.nome)}</div>
      <div style="flex:1;min-width:0"><p style="font-size:13px;font-weight:500">${v.nome}</p><p style="font-size:11px;color:var(--text-secondary)">${(v.ministerios||[]).map(id=>{const m=ministerios.find(m=>m.id===id);return m?m.nome:''}).filter(Boolean).join(', ')||'Sem ministério'}</p></div>
      ${status?`<span style="font-size:10px;padding:2px 7px;border-radius:4px;font-weight:500;background:${status==='aceito'?'var(--success-bg)':status==='recusado'?'var(--danger-bg)':'var(--warning-bg)'};color:${status==='aceito'?'var(--success-text)':status==='recusado'?'var(--danger-text)':'var(--warning-text)'}">${status==='aceito'?'Aceitou':status==='recusado'?'Recusou':'Pendente'}</span>`:''}
    </label>`
  };

  let html = '';
  if (temEquipe) html += '<p style="font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.3px;padding:6px 8px">Minha equipe</p>';
  lista.forEach(v => {
    if (!separadorColocado && temEquipe && temOutros && !ehDaEquipe(v)) {
      html += '<p style="font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.3px;padding:6px 8px;margin-top:4px;border-top:0.5px solid var(--border)">Outros voluntários</p>';
      separadorColocado = true;
    }
    html += cardVol(v);
  });
  container.innerHTML = html;
}

