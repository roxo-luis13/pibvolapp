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
  assistenteContainer()?.scrollTo?.(0, 1e6);
  setTimeout(() => document.getElementById('assistente-input')?.focus(), 50);
}

function fecharAssistente() {
  const painel = document.getElementById('assistente-painel');
  const fab = document.getElementById('assistente-fab');
  if (!painel || !fab) return;
  painel.style.display = 'none';
  fab.classList.remove('open');
  fab.innerHTML = assistenteFabConteudo();
}

// ===== MODO DO ASSISTENTE =====
// 'geral'  = assistente normal (eventos, escalas, ações)
// 'suporte' = "Voluntário IA" — usado na seção Suporte técnico: consulta a base de problemas
//             e roteiros. Cada modo tem sua própria conversa (histórico e mensagens).
let modoAssistente = 'geral';
let historicoSuporte = [];

function assistenteFabConteudo() {
  return modoAssistente === 'suporte'
    ? '<i class="ti ti-robot"></i><span class="assistente-fab-label">Voluntário IA</span>'
    : '<i class="ti ti-robot"></i>';
}

function assistenteContainer() {
  return document.getElementById(modoAssistente === 'suporte' ? 'assistente-mensagens-suporte' : 'assistente-mensagens');
}

function setModoAssistente(modo) {
  if (modo !== 'suporte') modo = 'geral';
  const mudou = modo !== modoAssistente;
  modoAssistente = modo;
  const fab = document.getElementById('assistente-fab');
  const painel = document.getElementById('assistente-painel');
  if (!fab || !painel) return;
  const suporte = modo === 'suporte';
  fab.classList.toggle('suporte', suporte);
  painel.classList.toggle('suporte', suporte);
  fab.title = suporte ? 'Pergunte ao Voluntário IA' : 'Pergunte ao assistente';
  if (!fab.classList.contains('open')) fab.innerHTML = assistenteFabConteudo();
  document.getElementById('assistente-titulo').textContent = suporte ? 'Voluntário IA · Suporte técnico' : 'Assistente';
  document.getElementById('assistente-mensagens').style.display = suporte ? 'none' : 'flex';
  document.getElementById('assistente-mensagens-suporte').style.display = suporte ? 'flex' : 'none';
  const input = document.getElementById('assistente-input');
  if (input) input.placeholder = suporte ? 'Descreva o problema (ex: microfone 2 sem som)' : 'Pergunte algo...';
  if (mudou && suporte) {
    // chama atenção pro botão quando entra na aba de suporte
    fab.classList.remove('pulsar'); void fab.offsetWidth; fab.classList.add('pulsar');
  }
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
  const wrap = assistenteContainer();
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
  const wrap = assistenteContainer();
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
  const locais = Array.isArray(dados.locais) ? dados.locais : [];
  for (const loc of locais) {
    const conflito = eventoConflitante([loc], horariosDoObjeto(dias_horarios), null);
    if (conflito) throw new Error(`O local "${LOCAIS[loc]||loc}" já está reservado para "${conflito.nome}" nesse dia/horário.`);
  }
  const payload = {
    nome: dados.nome, data: dados.data_inicio, data_inicio: dados.data_inicio, data_fim: dados.data_fim || null,
    hora: dados.hora_inicio, dias_horarios, descricao: dados.descricao || '', banda: dados.banda, responsavel: null,
    live: !!dados.live, som: !!dados.som, locais,
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

  const locaisFinal = 'locais' in dados ? dados.locais : eventoLocaisEfetivos(ev);
  if (precisaReconstruirDias || 'locais' in dados) {
    for (const loc of locaisFinal) {
      const conflito = eventoConflitante([loc], horariosDoObjeto(dias_horarios), ev.id);
      if (conflito) throw new Error(`O local "${LOCAIS[loc]||loc}" já está reservado para "${conflito.nome}" nesse dia/horário.`);
    }
  }

  const patch = {};
  if ('nome' in dados) patch.nome = dados.nome;
  if ('data_inicio' in dados) { patch.data = dados.data_inicio; patch.data_inicio = dados.data_inicio; }
  if ('data_fim' in dados) patch.data_fim = dados.data_fim || null;
  if (precisaReconstruirDias) { patch.dias_horarios = dias_horarios; patch.hora = mesclado.hora_inicio; }
  if ('locais' in dados) patch.locais = dados.locais;
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

  if (modoAssistente === 'suporte') return enviarPerguntaSuporte(pergunta, input, btn);

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

// ===== VOLUNTÁRIO IA (modo suporte) =====
// Perguntas feitas desde o último "deu certo / não resolveu" — viram o "o que aconteceu"
// sugerido quando a pessoa vai registrar o problema.
let suportePerguntasAbertas = [];
let suporteFeedbackSeq = 0;
let suporteFeedbacks = {};

async function enviarPerguntaSuporte(pergunta, input, btn) {
  input.value = '';
  input.disabled = true; btn.disabled = true;
  assistenteAddMsg(pergunta, 'user');
  suportePerguntasAbertas.push(pergunta);
  const loadingEl = assistenteAddMsg('Procurando nos problemas já resolvidos...', 'loading');
  try {
    const resp = await fetch(`${SUPA_URL}/functions/v1/assistente-ia`, {
      method: 'POST',
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': 'Bearer ' + (session?.access_token || SUPA_KEY),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ pergunta, modo: 'suporte', historico: historicoSuporte.slice(-12) })
    });
    const data = await resp.json().catch(() => ({}));
    if (loadingEl) loadingEl.remove();
    if (!resp.ok) {
      assistenteAddMsg(data.error || 'Não consegui responder agora. Tente novamente.', 'erro');
    } else {
      const resposta = data.resposta || 'Não consegui gerar uma resposta.';
      assistenteAddMsg(resposta, 'bot');
      assistenteRenderFeedbackSuporte(!!data.encontrou, Array.isArray(data.fontes) ? data.fontes : []);
      historicoSuporte.push({ role: 'user', texto: pergunta }, { role: 'assistant', texto: resposta });
      if (historicoSuporte.length > 30) historicoSuporte = historicoSuporte.slice(-30);
    }
  } catch (e) {
    if (loadingEl) loadingEl.remove();
    assistenteAddMsg('Erro de conexão. Verifique sua internet e tente de novo.', 'erro');
  }
  input.disabled = false; btn.disabled = false; input.focus();
}

function assistenteRenderFeedbackSuporte(encontrou, fontes) {
  const wrap = assistenteContainer();
  if (!wrap) return;
  // Só o feedback mais recente fica ativo
  wrap.querySelectorAll('.assistente-feedback').forEach(el => el.remove());
  const id = 'suporte-fb-' + (++suporteFeedbackSeq);
  suporteFeedbacks = { [id]: { encontrou, fontes } };
  const div = document.createElement('div');
  div.className = 'assistente-feedback';
  div.id = id;
  div.innerHTML = `
    <p>${encontrou ? 'Funcionou?' : 'Quando conseguir resolver, me conta:'}</p>
    <div style="display:flex;gap:6px">
      <button class="btn sm primary" onclick="suporteFeedback('${id}',true)"><i class="ti ti-check"></i>Deu certo</button>
      <button class="btn sm" onclick="suporteFeedback('${id}',false)"><i class="ti ti-x"></i>Não resolveu</button>
    </div>`;
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
}

function suporteSintomaSugerido() {
  return suportePerguntasAbertas.join('\n').slice(0, 1500);
}

function suporteBotaoRegistrar(texto, resolvido) {
  const wrap = assistenteContainer();
  if (!wrap) return;
  const div = document.createElement('div');
  div.className = 'assistente-msg bot';
  div.style.whiteSpace = 'normal';
  div.innerHTML = `<p style="margin-bottom:8px;white-space:pre-wrap">${assistenteEscapeHtml(texto)}</p>` +
    `<button class="btn sm primary" style="width:100%;justify-content:center" onclick="suporteAbrirRegistroDoChat(${resolvido})">` +
    `<i class="ti ti-clipboard-plus"></i>${resolvido ? 'Registrar problema e solução' : 'Registrar problema'}</button>`;
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
}

function suporteAbrirRegistroDoChat(resolvido) {
  const sintoma = suporteSintomaSugerido();
  fecharAssistente(); // a conversa fica guardada; o painel só sai da frente do formulário
  abrirModalProblema(null, {
    sistema: typeof suporteChutarSistema === 'function' ? suporteChutarSistema(sintoma) : 'som',
    titulo: (suportePerguntasAbertas[0] || '').slice(0, 80),
    sintoma,
    resolvido,
  });
  suportePerguntasAbertas = [];
}

async function suporteFeedback(id, deuCerto) {
  const fb = suporteFeedbacks[id];
  document.getElementById(id)?.remove();
  if (!fb) return;
  delete suporteFeedbacks[id];
  assistenteAddMsg(deuCerto ? 'Deu certo!' : 'Não resolveu.', 'user');
  historicoSuporte.push({ role: 'user', texto: deuCerto ? '(o voluntário disse que deu certo)' : '(o voluntário disse que não resolveu)' });

  if (deuCerto && fb.encontrou) {
    for (const pid of fb.fontes) await alternarUtil(pid, true);
    assistenteAddMsg('Que bom! 🙌 Marquei que essa solução ajudou — assim ela aparece primeiro para os próximos.', 'bot');
    suportePerguntasAbertas = [];
  } else if (deuCerto) {
    suporteBotaoRegistrar('Que ótimo! 🙌 Como esse problema ainda não estava registrado, me ensina: registre o que aconteceu e como vocês resolveram. Depois que um líder aprovar, eu passo a saber responder.', true);
  } else {
    suporteBotaoRegistrar('Poxa. 😕 Chame o líder ou o responsável técnico para ajudar. Se quiser, registre o problema agora (mesmo sem solução) para os líderes ficarem sabendo — e quando resolverem, atualizem com a solução.', false);
  }
}
