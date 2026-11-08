// ===== PEDIDO PÚBLICO PARA SER VOLUNTÁRIO (tela inicial, sem login) =====
let pedvolMinisteriosCarregados = false;
let pedvolServe = false;

async function abrirPedidoVoluntario() {
  document.getElementById('pedvol-form').style.display = 'block';
  document.getElementById('pedvol-sucesso').style.display = 'none';
  document.getElementById('btn-pedvol-enviar').style.display = '';
  document.getElementById('btn-pedvol-cancelar').textContent = 'Cancelar';
  document.getElementById('pedvol-error').style.display = 'none';
  ['pedvol-nome','pedvol-email','pedvol-tel','pedvol-outro'].forEach(id => document.getElementById(id).value = '');
  pedvolSetServe(false);

  if (!pedvolMinisteriosCarregados) {
    try {
      const lista = (await sb('ministerios?select=id,nome&order=nome')) || [];
      const sel = document.getElementById('pedvol-ministerio');
      sel.innerHTML = '<option value="">Selecione...</option>' +
        lista.map(m => `<option value="${m.id}">${m.nome}</option>`).join('') +
        '<option value="outros">Outro / não sei o nome</option>';
      pedvolMinisteriosCarregados = true;
    } catch (e) { console.error('Falha ao carregar ministérios:', e); }
  }
  openModal('modal-pedido-vol');
}

function pedvolSetServe(serve) {
  pedvolServe = serve;
  document.getElementById('pedvol-serve-sim').classList.toggle('selected', serve);
  document.getElementById('pedvol-serve-nao').classList.toggle('selected', !serve);
  document.getElementById('pedvol-min-wrap').style.display = serve ? '' : 'none';
  if (!serve) {
    document.getElementById('pedvol-ministerio').value = '';
    document.getElementById('pedvol-outro-wrap').style.display = 'none';
    document.getElementById('pedvol-outro').value = '';
  }
}

function pedvolToggleOutro() {
  const outros = document.getElementById('pedvol-ministerio').value === 'outros';
  document.getElementById('pedvol-outro-wrap').style.display = outros ? '' : 'none';
}

function pedvolErro(msg) {
  const el = document.getElementById('pedvol-error');
  el.textContent = msg;
  el.style.display = 'block';
}

async function enviarPedidoVoluntario() {
  const nome = document.getElementById('pedvol-nome').value.trim();
  const email = document.getElementById('pedvol-email').value.trim().toLowerCase();
  const tel = document.getElementById('pedvol-tel').value.trim();
  document.getElementById('pedvol-error').style.display = 'none';

  if (!nome || !email || !tel) { pedvolErro('Preencha nome, email e celular.'); return; }
  if (!/^\S+@\S+\.\S+$/.test(email)) { pedvolErro('Digite um email válido.'); return; }

  const minSel = document.getElementById('pedvol-ministerio').value;
  const outro = document.getElementById('pedvol-outro').value.trim();
  if (pedvolServe && !minSel) { pedvolErro('Selecione o ministério em que você já serve.'); return; }
  if (pedvolServe && minSel === 'outros' && !outro) { pedvolErro('Diga qual é o ministério.'); return; }

  const dados = {
    nome, email, telefone: tel,
    ja_serve: pedvolServe,
    ministerio_id: (pedvolServe && minSel !== 'outros') ? minSel : null,
    ministerio_outro: (pedvolServe && minSel === 'outros') ? outro : null,
  };

  const btn = document.getElementById('btn-pedvol-enviar');
  btn.innerHTML = '<span class="spin"></span> Enviando...'; btn.disabled = true;
  try {
    await sb('pedidos_voluntario', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(dados) });
    document.getElementById('pedvol-form').style.display = 'none';
    document.getElementById('pedvol-sucesso').style.display = 'block';
    document.getElementById('btn-pedvol-enviar').style.display = 'none';
    document.getElementById('btn-pedvol-cancelar').textContent = 'Fechar';
  } catch (e) {
    pedvolErro('Erro ao enviar: ' + e.message);
  }
  btn.innerHTML = 'Enviar pedido'; btn.disabled = false;
}

// ===== APROVAÇÃO DOS PEDIDOS (admin, pastor ou líder do ministério escolhido) =====
function renderPedidosVoluntario() {
  const container = document.getElementById('pedvol-lista');
  if (!container) return;
  const lista = pedidosVoluntario.filter(p => p.status === 'pendente').sort((a,b) => new Date(b.criado_em) - new Date(a.criado_em));
  const count = document.getElementById('pedvol-count');
  if (count) count.textContent = lista.length ? `${lista.length} pedido(s) pendente(s)` : '';

  if (!lista.length) {
    container.innerHTML = '<div class="empty" style="padding:28px"><i class="ti ti-user-check"></i>Nenhum pedido pendente.</div>';
    return;
  }

  container.innerHTML = lista.map(p => {
    const min = p.ministerio_id ? ministerios.find(m => m.id === p.ministerio_id) : null;
    const minTexto = !p.ja_serve ? 'Ainda não serve em nenhum ministério' : (min ? min.nome : (p.ministerio_outro || 'Outro'));
    const d = new Date(p.criado_em);
    const dataFmt = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `<div class="card" style="margin-bottom:10px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div style="min-width:0">
          <p style="font-size:14px;font-weight:500">${p.nome}</p>
          <p style="font-size:12px;color:var(--text-secondary);margin-top:2px">${p.email} · ${p.telefone || '—'}</p>
          <p style="font-size:12px;color:var(--text-secondary);margin-top:2px"><i class="ti ti-users-group" style="font-size:12px;margin-right:3px"></i>${minTexto}</p>
          <p style="font-size:11px;color:var(--text-tertiary);margin-top:4px">Pedido em ${dataFmt}</p>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button class="btn sm primary" onclick="aprovarPedidoVoluntario('${p.id}')"><i class="ti ti-check"></i>Aprovar</button>
          <button class="btn sm danger" onclick="rejeitarPedidoVoluntario('${p.id}')"><i class="ti ti-x"></i>Recusar</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

async function aprovarPedidoVoluntario(id) {
  const p = pedidosVoluntario.find(p => p.id === id); if (!p) return;
  if (!confirm(`Aprovar o pedido de ${p.nome} e criar o acesso dele ao app?`)) return;
  try {
    const novo = await sb('rpc/aprovar_pedido_voluntario', { method: 'POST', body: JSON.stringify({ p_pedido_id: id }) });
    p.status = 'aprovado';
    if (novo) voluntarios.push({ ...novo, ministerios: novo.ministerios || [] });
    registrarLog('aprovar', 'pedido_voluntario', p.nome, `${currentProfile.nome} aprovou o pedido de voluntário de ${p.nome}`);
    renderPedidosVoluntario();
    renderDashboard();
    alert(`Pedido aprovado! Avise ${p.nome} que o acesso já está liberado:\n\nEmail: ${p.email}\nSenha temporária: 123456\n\nNo primeiro acesso, ela vai precisar trocar essa senha.`);
  } catch (e) {
    alert('Erro ao aprovar: ' + e.message);
  }
}

async function rejeitarPedidoVoluntario(id) {
  const p = pedidosVoluntario.find(p => p.id === id); if (!p) return;
  if (!confirm(`Recusar o pedido de ${p.nome}?`)) return;
  try {
    await sb('rpc/rejeitar_pedido_voluntario', { method: 'POST', body: JSON.stringify({ p_pedido_id: id }) });
    p.status = 'rejeitado';
    registrarLog('recusar', 'pedido_voluntario', p.nome, `${currentProfile.nome} recusou o pedido de voluntário de ${p.nome}`);
    renderPedidosVoluntario();
  } catch (e) {
    alert('Erro ao recusar: ' + e.message);
  }
}
