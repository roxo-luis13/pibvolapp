// ===== SUPORTE TÉCNICO =====
// Seção visível para todos: roteiros de ligar/desligar (som, transmissão, multimídia),
// base de problemas e soluções (com aprovação de líder) e o "Voluntário IA" (assistente
// flutuante em modo suporte — ver assistente.js).
// Quem altera roteiros e aprova registros: admin, pastor e líder (mesma regra da função
// current_pode_gerir_suporte() no banco, que é quem realmente garante isso via RLS).

const SUPORTE_SISTEMAS = {
  som:         { label: 'Som',         artigo: 'o som',          icon: 'ti-device-speaker' },
  transmissao: { label: 'Transmissão', artigo: 'a transmissão',  icon: 'ti-broadcast' },
  multimidia:  { label: 'Multimídia',  artigo: 'a multimídia',   icon: 'ti-device-tv' },
  outro:       { label: 'Outro',       artigo: 'outro sistema',  icon: 'ti-tool' },
};
const SUPORTE_SISTEMAS_ROTEIRO = ['som', 'transmissao', 'multimidia'];
// Etapas de cada roteiro, na ordem em que aparecem
const SUPORTE_TIPOS = {
  ligar:    { label: 'Ligar',            icon: 'ti-power',      vazio: 'para ligar' },
  durante:  { label: 'Durante o culto',  icon: 'ti-player-play', vazio: 'para durante o culto em' },
  desligar: { label: 'Desligar',         icon: 'ti-plug-off',   vazio: 'para desligar' },
};
// Por enquanto só o Salão Principal; a estrutura já aceita outros locais depois.
const SUPORTE_LOCAL_PADRAO = 'salao_principal';

let suporteProcedimentos = [];
let suporteProblemas = [];
let suporteAba = 'sequenciamento';
// Etapa aberta em cada card (null = fechado: só o título e os botões das etapas)
let suporteTipoPorSistema = { som: null, transmissao: null, multimidia: null };
let suporteChecklist = {}; // { 'som-ligar': [0,2,...] } — só na aba atual
let suporteCarregado = false;
let suporteEditorPassos = [];

function podeGerirSuporte() {
  const nivel = getNivelAtivo();
  return ['admin', 'pastor', 'lider'].includes(nivel) || nivelIsAdmin(nivel);
}

function suporteEsc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function suporteNormalizar(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function suporteDataBR(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function carregarSuporte() {
  const [proc, prob] = await Promise.all([
    sb(`suporte_procedimentos?select=*&local=eq.${SUPORTE_LOCAL_PADRAO}`),
    sb('suporte_problemas?select=*&order=criado_em.desc'),
  ]);
  suporteProcedimentos = proc || [];
  suporteProblemas = prob || [];
  suporteCarregado = true;
}

async function renderSuporte() {
  const cont = document.getElementById('suporte-conteudo');
  if (!cont) return;
  if (!suporteCarregado) {
    cont.innerHTML = '<div class="empty" style="padding:24px"><span class="spin" style="border-top-color:var(--text-secondary);border-color:rgba(0,0,0,.15)"></span></div>';
  }
  try {
    await carregarSuporte();
  } catch (e) {
    cont.innerHTML = `<div class="empty"><i class="ti ti-alert-triangle"></i>Erro ao carregar o suporte: ${suporteEsc(e.message)}</div>`;
    return;
  }
  renderSuporteAba();
}

function trocarAbaSuporte(aba) {
  suporteAba = aba;
  renderSuporteAba();
}

function renderSuporteAba() {
  document.querySelectorAll('#suporte-tabs .suporte-tab').forEach(b => b.classList.toggle('active', b.dataset.aba === suporteAba));
  const pendentes = suporteProblemas.filter(p => p.status === 'pendente').length;
  const badge = document.getElementById('suporte-badge-pendentes');
  if (badge) {
    badge.textContent = pendentes;
    badge.style.display = podeGerirSuporte() && pendentes ? 'inline-block' : 'none';
  }
  if (suporteAba === 'problemas') renderSuporteProblemas();
  else renderSuporteSequenciamento();
}

// ===================== SEQUENCIAMENTO =====================

function suporteRoteiro(sistema, tipo) {
  return suporteProcedimentos.find(p => p.sistema === sistema && p.tipo === tipo && p.local === SUPORTE_LOCAL_PADRAO);
}

function renderSuporteSequenciamento() {
  const cont = document.getElementById('suporte-conteudo');
  const gestor = podeGerirSuporte();
  cont.innerHTML = `
    <p class="suporte-local"><i class="ti ti-map-pin"></i>Salão Principal</p>
    <div class="suporte-roteiros">
      ${SUPORTE_SISTEMAS_ROTEIRO.map(sis => {
        const tipo = suporteTipoPorSistema[sis];
        const rot = suporteRoteiro(sis, tipo);
        const passos = rot?.passos || [];
        const chave = `${sis}-${tipo}`;
        const feitos = suporteChecklist[chave] || [];
        const cfg = SUPORTE_SISTEMAS[sis];
        if (!tipo) {
          return `<div class="card suporte-roteiro fechado">
          <div class="suporte-roteiro-head">
            <div class="suporte-sis-titulo"><span class="suporte-sis-icone"><i class="ti ${cfg.icon}"></i></span>${cfg.label}</div>
            <div class="suporte-seg">
              ${Object.entries(SUPORTE_TIPOS).map(([t, tc]) => {
                const n = (suporteRoteiro(sis, t)?.passos || []).length;
                return `<button onclick="suporteTrocarTipo('${sis}','${t}')"><i class="ti ${tc.icon}"></i>${tc.label}${n ? `<span class="suporte-seg-n">${n}</span>` : ''}</button>`;
              }).join('')}
            </div>
          </div>
        </div>`;
        }
        return `<div class="card suporte-roteiro aberto">
          <div class="suporte-roteiro-head">
            <div class="suporte-sis-titulo"><span class="suporte-sis-icone"><i class="ti ${cfg.icon}"></i></span>${cfg.label}</div>
            <div class="suporte-seg">
              ${Object.entries(SUPORTE_TIPOS).map(([t, tc]) => `<button class="${tipo === t ? 'active' : ''}" onclick="suporteTrocarTipo('${sis}','${t}')"><i class="ti ${tc.icon}"></i>${tc.label}</button>`).join('')}
            </div>
            <button class="suporte-fechar" type="button" title="Fechar" onclick="suporteTrocarTipo('${sis}',null)"><i class="ti ti-chevron-up"></i></button>
          </div>
          ${passos.length ? `
            <div class="suporte-progresso"><div style="width:${Math.round(feitos.length / passos.length * 100)}%"></div></div>
            <ol class="suporte-passos">
              ${passos.map((p, i) => `
                <li class="${feitos.includes(i) ? 'feito' : ''}" onclick="suporteMarcarPasso('${chave}',${i})">
                  <span class="suporte-check">${feitos.includes(i) ? '<i class="ti ti-check"></i>' : i + 1}</span>
                  <div style="flex:1;min-width:0">
                    <p>${suporteEsc(p.texto)}</p>
                    ${p.alerta ? `<p class="suporte-alerta"><i class="ti ti-alert-triangle"></i>${suporteEsc(p.alerta)}</p>` : ''}
                    ${p.foto ? `<img class="suporte-passo-foto" src="${suporteEsc(p.foto)}" alt="Foto do passo ${i + 1}" loading="lazy" onclick="event.stopPropagation();suporteAbrirFoto('${suporteEsc(p.foto)}')">` : ''}
                  </div>
                </li>`).join('')}
            </ol>
            <div class="suporte-roteiro-rodape">
              <span>${feitos.length}/${passos.length} concluídos${rot.atualizado_por_nome ? ` · atualizado por ${suporteEsc(rot.atualizado_por_nome)} em ${suporteDataBR(rot.atualizado_em)}` : ''}</span>
              <div style="display:flex;gap:6px">
                ${feitos.length ? `<button class="btn sm" onclick="suporteReiniciarChecklist('${chave}')"><i class="ti ti-refresh"></i>Recomeçar</button>` : ''}
                ${gestor ? `<button class="btn sm" onclick="abrirEditorRoteiro('${sis}','${tipo}')"><i class="ti ti-edit"></i>Editar</button>` : ''}
              </div>
            </div>`
          : `<div class="empty" style="padding:22px 12px;font-size:13px"><i class="ti ti-list-numbers" style="font-size:28px"></i>Nenhum roteiro ${SUPORTE_TIPOS[tipo].vazio} ${cfg.artigo} ainda.
              ${gestor ? `<div style="margin-top:10px"><button class="btn sm primary" onclick="abrirEditorRoteiro('${sis}','${tipo}')"><i class="ti ti-plus"></i>Cadastrar roteiro</button></div>` : ''}</div>`}
        </div>`;
      }).join('')}
    </div>`;
}

function suporteTrocarTipo(sis, tipo) {
  // tocar de novo na etapa que já está aberta fecha o card
  suporteTipoPorSistema[sis] = (tipo && suporteTipoPorSistema[sis] !== tipo) ? tipo : null;
  renderSuporteSequenciamento();
}

function suporteMarcarPasso(chave, i) {
  const lista = suporteChecklist[chave] || [];
  suporteChecklist[chave] = lista.includes(i) ? lista.filter(x => x !== i) : [...lista, i];
  renderSuporteSequenciamento();
}

function suporteReiniciarChecklist(chave) {
  delete suporteChecklist[chave];
  renderSuporteSequenciamento();
}

// ----- Editor de roteiro (admin / pastor / líder) -----

function abrirEditorRoteiro(sis, tipo) {
  if (!podeGerirSuporte()) return;
  const rot = suporteRoteiro(sis, tipo);
  suporteEditorPassos = (rot?.passos || []).map(p => ({ texto: p.texto || '', alerta: p.alerta || '', foto: p.foto || null }));
  if (!suporteEditorPassos.length) suporteEditorPassos.push({ texto: '', alerta: '', foto: null });
  document.getElementById('roteiro-sistema').value = sis;
  document.getElementById('roteiro-tipo').value = tipo;
  document.getElementById('modal-roteiro-title').textContent =
    `${SUPORTE_TIPOS[tipo].label} — ${SUPORTE_SISTEMAS[sis].label} (Salão Principal)`;
  renderEditorPassos();
  openModal('modal-roteiro');
}

function suporteSalvarCamposEditor() {
  document.querySelectorAll('#roteiro-passos .roteiro-passo').forEach((el, i) => {
    if (!suporteEditorPassos[i]) return;
    suporteEditorPassos[i].texto = el.querySelector('textarea').value;
    suporteEditorPassos[i].alerta = el.querySelector('.roteiro-alerta').value;
  });
}

function renderEditorPassos() {
  const cont = document.getElementById('roteiro-passos');
  const n = suporteEditorPassos.length;
  cont.innerHTML = suporteEditorPassos.map((p, i) => `
    <div class="roteiro-passo">
      <div class="roteiro-passo-num">${i + 1}</div>
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px">
        <textarea rows="2" placeholder="O que fazer neste passo (ex: Ligar o estabilizador da mesa de som)">${suporteEsc(p.texto)}</textarea>
        <input type="text" class="roteiro-alerta" placeholder="Alerta opcional (ex: nunca ligar as caixas antes da mesa)" value="${suporteEsc(p.alerta)}">
        <div class="roteiro-foto">
          ${p.enviando ? '<span class="roteiro-foto-status"><span class="spin" style="border-top-color:var(--text-secondary);border-color:rgba(0,0,0,.15)"></span>Enviando foto...</span>'
            : p.foto ? `<img src="${suporteEsc(p.foto)}" alt="Foto do passo ${i + 1}" onclick="suporteAbrirFoto('${suporteEsc(p.foto)}')">
                <button type="button" class="btn sm" onclick="removerFotoPasso(${i})"><i class="ti ti-photo-off"></i>Remover foto</button>`
            : `<label class="btn sm"><i class="ti ti-camera"></i>Adicionar foto<input type="file" accept="image/*" style="display:none" onchange="enviarFotoPasso(${i}, this.files[0])"></label>`}
        </div>
      </div>
      <div class="roteiro-passo-acoes">
        <button type="button" title="Subir" ${i === 0 ? 'disabled' : ''} onclick="moverPassoRoteiro(${i},-1)"><i class="ti ti-chevron-up"></i></button>
        <button type="button" title="Descer" ${i === n - 1 ? 'disabled' : ''} onclick="moverPassoRoteiro(${i},1)"><i class="ti ti-chevron-down"></i></button>
        <button type="button" title="Remover" onclick="removerPassoRoteiro(${i})"><i class="ti ti-trash"></i></button>
      </div>
    </div>`).join('');
}

function adicionarPassoRoteiro() {
  suporteSalvarCamposEditor();
  suporteEditorPassos.push({ texto: '', alerta: '', foto: null });
  renderEditorPassos();
  const tas = document.querySelectorAll('#roteiro-passos textarea');
  tas[tas.length - 1]?.focus();
}

function moverPassoRoteiro(i, d) {
  suporteSalvarCamposEditor();
  const j = i + d;
  if (j < 0 || j >= suporteEditorPassos.length) return;
  [suporteEditorPassos[i], suporteEditorPassos[j]] = [suporteEditorPassos[j], suporteEditorPassos[i]];
  renderEditorPassos();
}

function removerPassoRoteiro(i) {
  suporteSalvarCamposEditor();
  suporteEditorPassos.splice(i, 1);
  renderEditorPassos();
}

async function salvarRoteiro() {
  suporteSalvarCamposEditor();
  const sistema = document.getElementById('roteiro-sistema').value;
  const tipo = document.getElementById('roteiro-tipo').value;
  const passos = suporteEditorPassos
    .map(p => ({ texto: p.texto.trim(), alerta: p.alerta.trim() || null, foto: p.foto || null }))
    .filter(p => p.texto);
  if (suporteEditorPassos.some(p => p.enviando)) return alert('Espere as fotos terminarem de enviar.');
  if (suporteEditorPassos.some(p => p.foto && !p.texto.trim())) return alert('Todo passo com foto precisa de um texto explicando o que fazer.');
  const btn = document.getElementById('roteiro-btn-salvar');
  btn.disabled = true;
  try {
    await sb('suporte_procedimentos?on_conflict=sistema,tipo,local', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=representation',
      body: JSON.stringify({
        sistema, tipo, local: SUPORTE_LOCAL_PADRAO, passos,
        atualizado_por: currentProfile.id, atualizado_por_nome: currentProfile.nome,
        atualizado_em: new Date().toISOString(),
      }),
    });
    delete suporteChecklist[`${sistema}-${tipo}`];
    registrarLog('editar', 'suporte', `Roteiro ${tipo} ${SUPORTE_SISTEMAS[sistema].label}`,
      `${currentProfile.nome} atualizou o roteiro "${SUPORTE_TIPOS[tipo].label}" ${SUPORTE_SISTEMAS[sistema].artigo === 'outro sistema' ? '' : 'd' + SUPORTE_SISTEMAS[sistema].artigo} (Salão Principal) — ${passos.length} passo(s)`);
    closeModal('modal-roteiro');
    await renderSuporte();
  } catch (e) {
    alert('Não foi possível salvar o roteiro: ' + e.message);
  }
  btn.disabled = false;
}

// ===================== PROBLEMAS E SOLUÇÕES =====================

function renderSuporteProblemas() {
  const cont = document.getElementById('suporte-conteudo');
  const busca = document.getElementById('suporte-busca')?.value || '';
  const filtroSis = document.getElementById('suporte-filtro-sis')?.value || '';
  cont.innerHTML = `
    <div class="suporte-toolbar">
      <div class="suporte-busca"><i class="ti ti-search"></i><input id="suporte-busca" type="text" placeholder="Buscar problema (ex: microfone chiando)" value="${suporteEsc(busca)}" oninput="renderSuporteListas()"></div>
      <select id="suporte-filtro-sis" onchange="renderSuporteListas()">
        <option value="">Todos os sistemas</option>
        ${Object.entries(SUPORTE_SISTEMAS).map(([k, v]) => `<option value="${k}" ${filtroSis === k ? 'selected' : ''}>${v.label}</option>`).join('')}
      </select>
      <button class="btn primary" onclick="abrirModalProblema()"><i class="ti ti-plus"></i>Reportar problema</button>
    </div>
    <div id="suporte-listas"></div>`;
  renderSuporteListas();
}

function suporteFiltrar(lista) {
  const busca = suporteNormalizar(document.getElementById('suporte-busca')?.value || '').trim();
  const sis = document.getElementById('suporte-filtro-sis')?.value || '';
  const termos = busca.split(/\s+/).filter(Boolean);
  return lista.filter(p => {
    if (sis && p.sistema !== sis) return false;
    if (!termos.length) return true;
    const alvo = suporteNormalizar(`${p.titulo} ${p.sintoma} ${p.solucao || ''}`);
    return termos.every(t => alvo.includes(t));
  });
}

function renderSuporteListas() {
  const cont = document.getElementById('suporte-listas');
  if (!cont) return;
  const gestor = podeGerirSuporte();
  const pendentes = suporteFiltrar(suporteProblemas.filter(p => p.status === 'pendente'));
  const meus = suporteFiltrar(suporteProblemas.filter(p => p.status !== 'aprovado' && p.autor_id === currentProfile.id));
  const aprovados = suporteFiltrar(suporteProblemas.filter(p => p.status === 'aprovado'))
    .sort((a, b) => (b.uteis?.length || 0) - (a.uteis?.length || 0) || (b.criado_em || '').localeCompare(a.criado_em || ''));

  let html = '';
  if (gestor && pendentes.length) {
    html += `<h4 class="suporte-subtitulo"><i class="ti ti-clock-exclamation"></i>Aguardando aprovação (${pendentes.length})</h4>
      ${pendentes.map(p => cardProblema(p, 'revisao')).join('')}`;
  } else if (!gestor && meus.length) {
    html += `<h4 class="suporte-subtitulo"><i class="ti ti-clock"></i>Seus registros em análise</h4>
      ${meus.map(p => cardProblema(p, 'meu')).join('')}`;
  }
  html += `<h4 class="suporte-subtitulo"><i class="ti ti-book-2"></i>Problemas conhecidos (${aprovados.length})</h4>`;
  html += aprovados.length
    ? aprovados.map(p => cardProblema(p, 'aprovado')).join('')
    : `<div class="empty"><i class="ti ti-mood-empty"></i>${suporteProblemas.some(p => p.status === 'aprovado')
        ? 'Nada encontrado com esse filtro.'
        : 'Ainda não há problemas registrados. Quando algo der errado e alguém resolver, registre aqui — o Voluntário IA aprende com isso.'}</div>`;
  cont.innerHTML = html;
}

function cardProblema(p, modo) {
  const cfg = SUPORTE_SISTEMAS[p.sistema] || SUPORTE_SISTEMAS.outro;
  const gestor = podeGerirSuporte();
  const uteis = p.uteis || [];
  const euAchei = uteis.includes(currentProfile.id);
  let statusBadge = '';
  if (p.status === 'pendente') statusBadge = '<span class="badge" style="background:var(--warning-bg);color:var(--warning-text)">Aguardando aprovação</span>';
  else if (p.status === 'rejeitado') statusBadge = '<span class="badge" style="background:var(--danger-bg);color:var(--danger-text)">Não aprovado</span>';
  if (!p.resolvido) statusBadge += ' <span class="badge" style="background:var(--coral-bg);color:var(--coral-text)">Sem solução ainda</span>';

  let acoes = '';
  if (modo === 'revisao') {
    acoes = `<button class="btn sm primary" onclick="aprovarProblema('${p.id}')"><i class="ti ti-check"></i>Aprovar</button>
      <button class="btn sm" onclick="abrirModalProblema('${p.id}')"><i class="ti ti-edit"></i>Revisar</button>
      <button class="btn sm danger" onclick="rejeitarProblema('${p.id}')"><i class="ti ti-x"></i>Recusar</button>`;
  } else if (modo === 'meu') {
    acoes = p.status === 'pendente' ? `<button class="btn sm" onclick="excluirProblema('${p.id}')"><i class="ti ti-trash"></i>Cancelar envio</button>` : '';
  } else {
    acoes = `<button class="btn sm suporte-util ${euAchei ? 'ativo' : ''}" onclick="alternarUtil('${p.id}')" title="Essa solução me ajudou"><i class="ti ti-thumb-up"></i>${uteis.length ? uteis.length : ''} Me ajudou</button>
      ${gestor ? `<button class="btn sm" onclick="abrirModalProblema('${p.id}')"><i class="ti ti-edit"></i>Editar</button>
      <button class="btn sm danger" onclick="excluirProblema('${p.id}')"><i class="ti ti-trash"></i></button>` : ''}`;
  }

  return `<div class="card suporte-problema">
    <div style="display:flex;align-items:flex-start;gap:10px">
      <span class="suporte-sis-icone"><i class="ti ${cfg.icon}"></i></span>
      <div style="flex:1;min-width:0">
        <p style="font-size:14px;font-weight:500">${suporteEsc(p.titulo)}</p>
        <p style="font-size:11px;color:var(--text-tertiary);margin-top:2px">${cfg.label} · ${suporteEsc(p.autor_nome || 'Alguém')} · ${suporteDataBR(p.criado_em)}</p>
        ${statusBadge ? `<div style="margin-top:6px">${statusBadge}</div>` : ''}
      </div>
    </div>
    <div class="suporte-bloco"><span>O que aconteceu</span><p>${suporteEsc(p.sintoma)}</p></div>
    ${p.resolvido ? `<div class="suporte-bloco solucao"><span>Como resolveu</span><p>${suporteEsc(p.solucao)}</p></div>` : ''}
    ${p.status === 'rejeitado' && p.motivo_rejeicao ? `<div class="suporte-bloco"><span>Motivo</span><p>${suporteEsc(p.motivo_rejeicao)}</p></div>` : ''}
    ${acoes ? `<div class="suporte-acoes">${acoes}</div>` : ''}
  </div>`;
}

// ----- Modal de reportar / revisar problema -----

function abrirModalProblema(id, prefill) {
  const p = id ? suporteProblemas.find(x => x.id === id) : null;
  const dados = p || prefill || {};
  document.getElementById('prob-edit-id').value = p ? p.id : '';
  document.getElementById('prob-sistema').value = dados.sistema || 'som';
  document.getElementById('prob-titulo').value = dados.titulo || '';
  document.getElementById('prob-sintoma').value = dados.sintoma || '';
  document.getElementById('prob-solucao').value = dados.solucao || '';
  const resolvido = dados.resolvido !== false;
  document.getElementById('prob-resolvido-sim').checked = resolvido;
  document.getElementById('prob-resolvido-nao').checked = !resolvido;
  atualizarCampoSolucao();
  const gestor = podeGerirSuporte();
  document.getElementById('modal-prob-title').textContent = p ? (p.status === 'pendente' ? 'Revisar registro' : 'Editar registro') : 'Reportar problema';
  document.getElementById('prob-aviso-aprovacao').style.display = !p && !gestor ? 'block' : 'none';
  const btnAprovar = document.getElementById('prob-btn-aprovar');
  btnAprovar.style.display = p && p.status === 'pendente' && gestor ? '' : 'none';
  openModal('modal-problema');
}

function atualizarCampoSolucao() {
  const sim = document.getElementById('prob-resolvido-sim').checked;
  document.getElementById('prob-solucao-grupo').style.display = sim ? '' : 'none';
}

async function salvarProblema(aprovar) {
  const id = document.getElementById('prob-edit-id').value;
  const sistema = document.getElementById('prob-sistema').value;
  const titulo = document.getElementById('prob-titulo').value.trim();
  const sintoma = document.getElementById('prob-sintoma').value.trim();
  const resolvido = document.getElementById('prob-resolvido-sim').checked;
  const solucao = document.getElementById('prob-solucao').value.trim();
  if (!titulo) return alert('Dê um título curto pro problema.');
  if (!sintoma) return alert('Descreva o que aconteceu.');
  if (resolvido && !solucao) return alert('Conte como resolveu (ou marque que ainda não tem solução).');

  const gestor = podeGerirSuporte();
  const campos = { sistema, titulo, sintoma, resolvido, solucao: resolvido ? solucao : null };
  const aprovacao = { status: 'aprovado', aprovado_por: currentProfile.id, aprovado_por_nome: currentProfile.nome, aprovado_em: new Date().toISOString(), motivo_rejeicao: null };
  const btns = document.querySelectorAll('#modal-problema .modal-footer button');
  btns.forEach(b => b.disabled = true);
  try {
    if (id) {
      if (!gestor) throw new Error('Só líderes podem editar registros.');
      await sb(`suporte_problemas?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(aprovar ? { ...campos, ...aprovacao } : campos) });
      registrarLog(aprovar ? 'aprovar' : 'editar', 'suporte', titulo,
        `${currentProfile.nome} ${aprovar ? 'revisou e aprovou' : 'editou'} o registro de suporte "${titulo}"`);
    } else {
      const novo = {
        ...campos, local: SUPORTE_LOCAL_PADRAO,
        autor_id: currentProfile.id, autor_nome: currentProfile.nome,
        ...(gestor ? aprovacao : { status: 'pendente' }),
      };
      await sb('suporte_problemas', { method: 'POST', body: JSON.stringify(novo) });
      registrarLog('criar', 'suporte', titulo, `${currentProfile.nome} registrou o problema de suporte "${titulo}"${gestor ? '' : ' (aguardando aprovação)'}`);
    }
    closeModal('modal-problema');
    if (!id && !gestor) alert('Obrigado! Seu registro foi enviado e aparece pra todos assim que um líder aprovar.');
    suporteAba = 'problemas';
    if (document.getElementById('section-suporte')?.classList.contains('active')) await renderSuporte();
    else await carregarSuporte().catch(() => {});
  } catch (e) {
    alert('Não foi possível salvar: ' + e.message);
  }
  btns.forEach(b => b.disabled = false);
}

async function aprovarProblema(id) {
  const p = suporteProblemas.find(x => x.id === id);
  if (!p) return;
  try {
    await sb(`suporte_problemas?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({
      status: 'aprovado', aprovado_por: currentProfile.id, aprovado_por_nome: currentProfile.nome,
      aprovado_em: new Date().toISOString(), motivo_rejeicao: null,
    }) });
    registrarLog('aprovar', 'suporte', p.titulo, `${currentProfile.nome} aprovou o registro de suporte "${p.titulo}" (enviado por ${p.autor_nome || 'alguém'})`);
    await renderSuporte();
  } catch (e) { alert('Não foi possível aprovar: ' + e.message); }
}

async function rejeitarProblema(id) {
  const p = suporteProblemas.find(x => x.id === id);
  if (!p) return;
  const motivo = prompt(`Recusar "${p.titulo}"?\nSe quiser, explique o motivo (a pessoa recebe esse aviso):`, '');
  if (motivo === null) return;
  try {
    await sb(`suporte_problemas?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'rejeitado', motivo_rejeicao: motivo.trim() || null }) });
    registrarLog('rejeitar', 'suporte', p.titulo, `${currentProfile.nome} recusou o registro de suporte "${p.titulo}" (enviado por ${p.autor_nome || 'alguém'})`);
    await renderSuporte();
  } catch (e) { alert('Não foi possível recusar: ' + e.message); }
}

async function excluirProblema(id) {
  const p = suporteProblemas.find(x => x.id === id);
  if (!p || !confirm(`Excluir "${p.titulo}"? Isso não pode ser desfeito.`)) return;
  try {
    await sb(`suporte_problemas?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
    registrarLog('excluir', 'suporte', p.titulo, `${currentProfile.nome} excluiu o registro de suporte "${p.titulo}"`);
    await renderSuporte();
  } catch (e) { alert('Não foi possível excluir: ' + e.message); }
}

async function alternarUtil(id, marcar) {
  try {
    const uteis = await sb('rpc/alternar_util_problema', { method: 'POST', body: JSON.stringify({ p_problema_id: id, p_marcar: marcar ?? null }) });
    const p = suporteProblemas.find(x => x.id === id);
    if (p) p.uteis = uteis || [];
    if (document.getElementById('suporte-listas')) renderSuporteListas();
  } catch (e) { if (marcar == null) alert('Não foi possível registrar: ' + e.message); }
}

// Palpite do sistema a partir do texto (só pra pré-preencher o formulário; a pessoa confere)
function suporteChutarSistema(texto) {
  const t = suporteNormalizar(texto);
  if (/(transmiss|live|youtube|stream|obs|camera|câmera|ao vivo)/.test(t)) return 'transmissao';
  if (/(projetor|telao|telão|tela|slide|letra|propresenter|holyrics|tv|hdmi|video)/.test(t)) return 'multimidia';
  if (/(som|mesa|microfone|mic|caixa|retorno|audio|chiado|microfonia|fone|in.?ear)/.test(t)) return 'som';
  return 'outro';
}

// ----- Fotos dos passos (bucket público "suporte-fotos"; só gestores enviam, via RLS) -----

// Reduz a foto no próprio aparelho (máx. 1600px, JPEG) — foto de celular chega a 5-10 MB.
function suporteReduzirImagem(file, maxLado = 1600, qualidade = 0.82) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(b => resolve(b || file), 'image/jpeg', qualidade);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); }; // formato que o navegador não abre (ex: HEIC): envia como está
    img.src = url;
  });
}

async function suporteUploadFoto(file, prefixo) {
  const blob = await suporteReduzirImagem(file);
  const tipo = blob.type || file.type || 'image/jpeg';
  const ext = tipo === 'image/jpeg' ? 'jpg' : (tipo.split('/')[1] || 'jpg');
  const path = `${prefixo}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const res = await fetch(`${SUPA_URL}/storage/v1/object/suporte-fotos/${path}`, {
    method: 'POST',
    headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + (session?.access_token || SUPA_KEY), 'Content-Type': tipo },
    body: blob,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || ('erro ' + res.status));
  }
  return `${SUPA_URL}/storage/v1/object/public/suporte-fotos/${path}`;
}

async function enviarFotoPasso(i, file) {
  if (!file) return;
  suporteSalvarCamposEditor();
  const passo = suporteEditorPassos[i];
  if (!passo) return;
  passo.enviando = true;
  renderEditorPassos();
  try {
    const sis = document.getElementById('roteiro-sistema').value;
    const tipo = document.getElementById('roteiro-tipo').value;
    passo.foto = await suporteUploadFoto(file, `${SUPORTE_LOCAL_PADRAO}/${sis}-${tipo}`);
  } catch (e) {
    alert('Não foi possível enviar a foto: ' + e.message);
  }
  passo.enviando = false;
  suporteSalvarCamposEditor();
  renderEditorPassos();
}

function removerFotoPasso(i) {
  suporteSalvarCamposEditor();
  if (suporteEditorPassos[i]) suporteEditorPassos[i].foto = null;
  renderEditorPassos();
}

function suporteAbrirFoto(url) {
  let box = document.getElementById('suporte-lightbox');
  if (!box) {
    box = document.createElement('div');
    box.id = 'suporte-lightbox';
    box.onclick = () => box.classList.remove('open');
    box.innerHTML = '<img alt="Foto do passo"><button type="button" aria-label="Fechar"><i class="ti ti-x"></i></button>';
    document.body.appendChild(box);
  }
  box.querySelector('img').src = url;
  box.classList.add('open');
}
