// ===== ASSISTENTE (IA) =====
// ===== ASSISTENTE (IA) =====
// Responde perguntas com base apenas nos dados que o usuário já tem acesso no app
// (o filtro por permissão é feito na Edge Function, com o mesmo token de sessão do app).

function abrirAssistente() {
  const painel = document.getElementById('assistente-painel');
  const fab = document.getElementById('assistente-fab');
  if (!painel || !fab) return;
  painel.style.display = 'flex';
  fab.classList.add('open');
  fab.innerHTML = '<i class="ti ti-x"></i>';
  setTimeout(() => document.getElementById('assistente-input')?.focus(), 50);
}

function fecharAssistente() {
  const painel = document.getElementById('assistente-painel');
  const fab = document.getElementById('assistente-fab');
  if (!painel || !fab) return;
  painel.style.display = 'none';
  fab.classList.remove('open');
  fab.innerHTML = '<i class="ti ti-robot"></i>';
}

function toggleAssistente() {
  const painel = document.getElementById('assistente-painel');
  if (!painel) return;
  if (painel.style.display === 'flex') fecharAssistente();
  else abrirAssistente();
}

// Histórico da conversa (só texto, sem o contexto/JSON embutido), pra IA conseguir
// entender perguntas de acompanhamento tipo "e no mês passado?", inclusive em pedidos
// de várias etapas (ex: criar um evento aos poucos). Vive só na aba atual.
let historicoAssistente = [];

function assistenteAddMsg(texto, tipo) {
  const wrap = document.getElementById('assistente-mensagens');
  if (!wrap) return null;
  const div = document.createElement('div');
  div.className = 'assistente-msg ' + tipo;
  div.textContent = texto;
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
  return div;
}

function assistenteEscapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

// Ações que a IA propôs e ainda não foram confirmadas/canceladas nesta aba.
let acoesPendentesAssistente = {};
let acaoAssistenteSeq = 0;

function assistenteRenderCartaoAcao(resposta, acao) {
  const wrap = document.getElementById('assistente-mensagens');
  if (!wrap) return;
  const id = 'assistente-acao-' + (++acaoAssistenteSeq);
  acoesPendentesAssistente[id] = acao;
  const div = document.createElement('div');
  div.className = 'assistente-msg bot';
  div.id = id;
  div.innerHTML = `
    <p style="margin-bottom:10px;white-space:pre-wrap">${assistenteEscapeHtml(resposta)}</p>
    <div style="display:flex;gap:8px">
      <button class="btn sm primary" style="flex:1;justify-content:center" onclick="assistenteConfirmarAcao('${id}')"><i class="ti ti-check"></i>Confirmar</button>
      <button class="btn sm" style="flex:1;justify-content:center" onclick="assistenteCancelarAcao('${id}')"><i class="ti ti-x"></i>Cancelar</button>
    </div>`;
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
}

function assistenteFecharCartao(id, textoFinal) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = `<p style="white-space:pre-wrap">${assistenteEscapeHtml(textoFinal)}</p>`;
}

async function assistenteConfirmarAcao(id) {
  const acao = acoesPendentesAssistente[id];
  if (!acao) return;
  delete acoesPendentesAssistente[id];
  const el = document.getElementById(id);
  const botoes = el?.querySelector('div');
  if (botoes) botoes.innerHTML = '<span class="spin"></span>';
  try {
    if (acao.tipo === 'criar_evento') await assistenteCriarEvento(acao.dados);
    else if (acao.tipo === 'editar_evento') await assistenteEditarEvento(acao.dados);
    else if (acao.tipo === 'convidar_voluntarios') await assistenteConvidarVoluntarios(acao.dados);
    else if (acao.tipo === 'alerta') await assistenteEnviarAlerta(acao.dados);
    else throw new Error('Tipo de ação desconhecido.');
    assistenteFecharCartao(id, '✅ Feito!');
    historicoAssistente.push({ role: 'assistant', texto: '(ação confirmada e executada pelo usuário)' });
  } catch (e) {
    assistenteFecharCartao(id, '❌ Não consegui concluir: ' + e.message);
    historicoAssistente.push({ role: 'assistant', texto: '(a ação falhou: ' + e.message + ')' });
  }
}

function assistenteCancelarAcao(id) {
  if (!acoesPendentesAssistente[id]) return;
  delete acoesPendentesAssistente[id];
  assistenteFecharCartao(id, 'Ação cancelada.');
  historicoAssistente.push({ role: 'assistant', texto: '(ação cancelada pelo usuário)' });
}

// ===== Execução das ações (só rodam depois do usuário clicar "Confirmar" acima;
// usam a sessão normal do usuário, então RLS e log de atividade ficam em nome dele) =====

function assistenteDiasHorarios(data_inicio, data_fim, hora_inicio, hora_fim) {
  const dias = {};
  if (!data_fim || data_fim === data_inicio) {
    dias[data_inicio] = { inicio: hora_inicio, fim: hora_fim };
    return dias;
  }
  let d = new Date(data_inicio + 'T12:00:00');
  const fim = new Date(data_fim + 'T12:00:00');
  while (d <= fim) {
    dias[d.toISOString().slice(0, 10)] = { inicio: hora_inicio, fim: hora_fim };
    d.setDate(d.getDate() + 1);
  }
  return dias;
}

async function assistenteCriarEvento(dados) {
  if (!perm(getNivelAtivo(), 'pode_criar_eventos')) throw new Error('Você não tem permissão pra criar eventos.');
  const dias_horarios = assistenteDiasHorarios(dados.data_inicio, dados.data_fim, dados.hora_inicio, dados.hora_fim);
  const conflito = eventoConflitante(dados.local, horariosDoObjeto(dias_horarios), null);
  if (conflito) throw new Error(`O local escolhido já está reservado para "${conflito.nome}" nesse dia/horário.`);
  const payload = {
    nome: dados.nome, data: dados.data_inicio, data_inicio: dados.data_inicio, data_fim: dados.data_fim || null,
    hora: dados.hora_inicio, dias_horarios, descricao: dados.descricao || '', banda: dados.banda, responsavel: null,
    live: !!dados.live, som: !!dados.som, local: dados.local || null,
    ministerios: [], inscritos: [], convites: [], arquivo_url: null, arquivo_nome: null, arquivo_tipo: null
  };
  const rows = await sb('eventos', { method: 'POST', body: JSON.stringify(payload) });
  if (rows && rows[0]) {
    eventos.push({ ...rows[0], ministerios: [], inscritos: [], convites: [] });
    registrarLog('criar', 'evento', dados.nome, `${currentProfile.nome} criou o evento "${dados.nome}" via assistente de IA`);
    atualizarTodasAsViews();
  }
}

async function assistenteEditarEvento(dados) {
  if (!perm(getNivelAtivo(), 'pode_editar_eventos')) throw new Error('Você não tem permissão pra editar eventos.');
  const ev = eventos.find(e => e.id === dados.evento_id);
  if (!ev) throw new Error('Não encontrei esse evento (talvez tenha sido alterado). Tente de novo.');

  const dataAtual = ev.data_inicio || ev.data;
  const atual = {
    data_inicio: dataAtual,
    data_fim: ev.data_fim || null,
    hora_inicio: ev.dias_horarios?.[dataAtual]?.inicio || ev.hora || '09:00',
    hora_fim: ev.dias_horarios?.[dataAtual]?.fim || '23:59',
  };
  const mesclado = { ...atual, ...dados };
  const precisaReconstruirDias = ['data_inicio', 'data_fim', 'hora_inicio', 'hora_fim'].some(k => k in dados);
  const dias_horarios = precisaReconstruirDias
    ? assistenteDiasHorarios(mesclado.data_inicio, mesclado.data_fim, mesclado.hora_inicio, mesclado.hora_fim)
    : ev.dias_horarios;

  if (precisaReconstruirDias) {
    const localFinal = 'local' in dados ? dados.local : ev.local;
    const conflito = eventoConflitante(localFinal, horariosDoObjeto(dias_horarios), ev.id);
    if (conflito) throw new Error(`O local escolhido já está reservado para "${conflito.nome}" nesse dia/horário.`);
  }

  const patch = {};
  if ('nome' in dados) patch.nome = dados.nome;
  if ('data_inicio' in dados) { patch.data = dados.data_inicio; patch.data_inicio = dados.data_inicio; }
  if ('data_fim' in dados) patch.data_fim = dados.data_fim || null;
  if (precisaReconstruirDias) { patch.dias_horarios = dias_horarios; patch.hora = mesclado.hora_inicio; }
  if ('local' in dados) patch.local = dados.local;
  if ('live' in dados) patch.live = dados.live;
  if ('som' in dados) patch.som = dados.som;
  if ('banda' in dados) patch.banda = dados.banda;
  if ('descricao' in dados) patch.descricao = dados.descricao;

  await sb(`eventos?id=eq.${ev.id}`, { method: 'PATCH', body: JSON.stringify(patch) });
  Object.assign(ev, patch);
  registrarLog('editar', 'evento', ev.nome, `${currentProfile.nome} editou o evento "${ev.nome}" via assistente de IA`);
  atualizarTodasAsViews();
}

async function assistenteConvidarVoluntarios(dados) {
  if (!perm(getNivelAtivo(), 'pode_editar_eventos')) throw new Error('Você não tem permissão pra convidar voluntários.');
  const ev = eventos.find(e => e.id === dados.evento_id);
  if (!ev) throw new Error('Não encontrei esse evento (talvez tenha sido alterado). Tente de novo.');

  const jaConvidadosIds = new Set((ev.convites || []).map(c => c.volId));
  const novos = (dados.convidados || []).filter(c => !jaConvidadosIds.has(c.volId));
  if (!novos.length) return; // todo mundo já estava convidado — nada a fazer

  const convites = [...(ev.convites || []), ...novos.map(c => ({ volId: c.volId, status: 'pendente', minId: c.minId || null }))];
  const ministeriosEv = [...(ev.ministerios || [])];
  if (dados.ministerio_a_adicionar && !ministeriosEv.includes(dados.ministerio_a_adicionar)) {
    ministeriosEv.push(dados.ministerio_a_adicionar);
  }

  await sb(`eventos?id=eq.${ev.id}`, { method: 'PATCH', body: JSON.stringify({ convites, ministerios: ministeriosEv }) });
  ev.convites = convites; ev.ministerios = ministeriosEv;

  for (const c of novos) {
    await sb('notificacoes', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({
      vol_id: c.volId, tipo: 'convite', ev_id: ev.id, ev_nome: ev.nome,
      ev_data: ev.data_inicio || ev.data, ev_hora: ev.hora, mensagem: 'Você foi convidado para servir neste evento.'
    }) });
  }

  registrarLog('editar', 'evento', ev.nome, `${currentProfile.nome} convidou ${novos.map(c => c.nome).join(', ')} pro evento "${ev.nome}" via assistente de IA`);
  atualizarTodasAsViews();
}

async function assistenteEnviarAlerta(dados) {
  if (!nivelPodeGerenciarEventos(getNivelAtivo())) throw new Error('Você não tem permissão pra enviar alertas.');
  await sb('rpc/enviar_alerta_voluntario', { method: 'POST', body: JSON.stringify({ p_destinatario_id: dados.destinatario_id, p_mensagem: dados.mensagem }) });
  registrarLog('enviar', 'alerta', dados.destinatario_nome, `${currentProfile.nome} enviou um alerta pra ${dados.destinatario_nome} via assistente de IA: "${dados.mensagem}"`);
}

async function enviarPerguntaAssistente() {
  const input = document.getElementById('assistente-input');
  const btn = document.getElementById('assistente-btn-enviar');
  if (!input || !btn) return;
  const pergunta = input.value.trim();
  if (!pergunta || input.disabled) return;

  input.value = '';
  input.disabled = true; btn.disabled = true;
  assistenteAddMsg(pergunta, 'user');
  const loadingEl = assistenteAddMsg('Pensando...', 'loading');

  try {
    const resp = await fetch(`${SUPA_URL}/functions/v1/assistente-ia`, {
      method: 'POST',
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': 'Bearer ' + (session?.access_token || SUPA_KEY),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ pergunta, historico: historicoAssistente.slice(-12) })
    });
    const data = await resp.json().catch(() => ({}));
    if (loadingEl) loadingEl.remove();
    if (!resp.ok) {
      assistenteAddMsg(data.error || 'Não consegui responder agora. Tente novamente.', 'erro');
    } else {
      const resposta = data.resposta || 'Não consegui gerar uma resposta.';
      if (data.acao) {
        assistenteRenderCartaoAcao(resposta, data.acao);
      } else {
        assistenteAddMsg(resposta, 'bot');
      }
      historicoAssistente.push({ role: 'user', texto: pergunta }, { role: 'assistant', texto: resposta });
      if (historicoAssistente.length > 30) historicoAssistente = historicoAssistente.slice(-30);
    }
  } catch (e) {
    if (loadingEl) loadingEl.remove();
    assistenteAddMsg('Erro de conexão. Verifique sua internet e tente de novo.', 'erro');
  }

  input.disabled = false; btn.disabled = false; input.focus();
}
