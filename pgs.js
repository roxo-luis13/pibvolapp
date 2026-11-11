// ===== PEQUENOS GRUPOS (PGs) - administração =====
const PG_CENTRO_PADRAO = { lat: -22.9099, lng: -47.0626 }; // Campinas/SP


function renderPgs() {
  const tbody = document.getElementById('pgs-tbody');
  if (!tbody) return;
  const canEdit = perm(getNivelAtivo(), 'pode_editar_pgs') || perm(getNivelAtivo(), 'pode_criar_pgs');
  const canExcluir = perm(getNivelAtivo(), 'pode_excluir_pgs');
  document.getElementById('pgs-empty').style.display = pgs.length ? 'none' : 'block';
  document.getElementById('pgs-count').textContent = pgs.length ? `${pgs.length} PG(s)` : '';

  tbody.innerHTML = pgs.map(p => {
    const btns = `<div style="display:flex;gap:4px">
      ${canEdit ? `<button class="btn sm" onclick="event.stopPropagation();editPg('${p.id}')"><i class="ti ti-edit"></i></button>` : ''}
      ${canExcluir ? `<button class="btn sm danger" onclick="event.stopPropagation();deletePg('${p.id}')"><i class="ti ti-trash"></i></button>` : ''}
    </div>`;
    return `<tr class="pg-admin-clicavel" onclick="abrirDetalhePgAdmin('${p.id}')" title="Ver detalhes e pessoas do PG">
      <td>${p.nome}</td>
      <td>${p.dia_semana || '—'}${p.horario ? ' às ' + p.horario.slice(0,5) : ''}</td>
      <td>${p.bairro || '—'}</td>
      <td>${p.tema || '—'}</td>
      <td>${p.ativo ? '<i class="ti ti-check" style="color:var(--success-text)"></i>' : '<i class="ti ti-x" style="color:var(--text-tertiary)"></i>'}</td>
      <td>${btns}</td>
    </tr>`;
  }).join('');

  const cardsMobile = document.getElementById('pgs-cards-mobile');
  if (cardsMobile) {
    cardsMobile.innerHTML = pgs.map(p => `
      <div class="pg-admin-card pg-admin-clicavel" onclick="abrirDetalhePgAdmin('${p.id}')">
        <div class="pg-admin-card-top">
          <div class="pg-admin-card-nome">${p.nome}</div>
        </div>
        <div class="pg-admin-card-meta">${p.dia_semana || '—'}${p.horario ? ' às ' + p.horario.slice(0,5) : ''} · ${p.bairro || '—'}${p.tema ? ' · ' + p.tema : ''} · ${p.ativo ? 'Ativo' : 'Inativo'}</div>
        <div class="pg-admin-card-footer">
          <span style="font-size:12px;color:var(--text-secondary)"><i class="ti ti-eye"></i> Ver detalhes</span>
          <div style="display:flex;gap:6px">
            ${canEdit ? `<button class="btn sm" onclick="event.stopPropagation();editPg('${p.id}')"><i class="ti ti-edit"></i>Editar</button>` : ''}
            ${canExcluir ? `<button class="btn sm danger" onclick="event.stopPropagation();deletePg('${p.id}')"><i class="ti ti-trash"></i>Excluir</button>` : ''}
          </div>
        </div>
      </div>`).join('');
  }
}

// ===== MODAL CRIAR/EDITAR - localização aproximada (círculo de 5km) =====
const PG_RAIO_METROS = 5000;
let pgPickerMap = null, pgPickerCirculo = null;

function initPgPickerMap(lat, lng) {
  const el = document.getElementById('pg-mapa-picker');
  if (!el) return;
  const centro = (lat && lng) ? [lat, lng] : [PG_CENTRO_PADRAO.lat, PG_CENTRO_PADRAO.lng];

  if (!pgPickerMap) {
    pgPickerMap = L.map('pg-mapa-picker', { scrollWheelZoom: false }).setView(centro, 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors', maxZoom: 19
    }).addTo(pgPickerMap);
  } else {
    pgPickerMap.setView(centro, 12);
  }

  if (pgPickerCirculo) { pgPickerMap.removeLayer(pgPickerCirculo); pgPickerCirculo = null; }
  if (lat && lng) desenharCirculoPg(lat, lng);

  setTimeout(() => pgPickerMap.invalidateSize(), 80);
}

function desenharCirculoPg(lat, lng) {
  if (pgPickerCirculo) pgPickerMap.removeLayer(pgPickerCirculo);
  pgPickerCirculo = L.circle([lat, lng], {
    radius: PG_RAIO_METROS, color: '#7F77DD', weight: 1.5, fillColor: '#7F77DD', fillOpacity: 0.15
  }).addTo(pgPickerMap);
  pgPickerMap.fitBounds(pgPickerCirculo.getBounds(), { padding: [10, 10] });
  document.getElementById('pg-lat').value = lat;
  document.getElementById('pg-lng').value = lng;
}

function pgDefinirStatusLocal(msg, classe) {
  const el = document.getElementById('pg-local-status');
  if (!el) return;
  el.textContent = msg;
  el.className = 'pg-local-status' + (classe ? ' ' + classe : '');
}

async function pgGeocodificarPorCep(cep) {
  const limpo = cep.replace(/\D/g, '');
  if (limpo.length !== 8) throw new Error('CEP inválido.');
  const resp = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
  const data = await resp.json();
  if (!resp.ok || data.erro) throw new Error('CEP não encontrado.');
  if (!document.getElementById('pg-bairro').value.trim() && data.bairro) {
    document.getElementById('pg-bairro').value = data.bairro;
  }
  return `${data.bairro || ''}, ${data.localidade} - ${data.uf}, Brasil`;
}

async function pgGeocodificarEndereco(query) {
  const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`);
  const data = await resp.json();
  if (!resp.ok || !data || !data.length) throw new Error('Não encontramos esse endereço.');
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), nome: data[0].display_name };
}

// Completa o texto digitado com "SP, Brasil" quando a pessoa não informou isso, pra buscar
// em qualquer cidade do estado (não só Campinas) - sem sobrescrever se ela já informou o estado/país.
function pgCompletarQueryEstadoSP(valor) {
  const low = valor.toLowerCase();
  if (low.includes('brasil') || low.includes('brazil')) return valor;
  return `${valor}, SP, Brasil`;
}

let pgModoLocal = 'bairro';

function pgSetModoLocal(modo) {
  pgModoLocal = modo;
  document.getElementById('pg-modo-bairro').classList.toggle('selected', modo === 'bairro');
  document.getElementById('pg-modo-cep').classList.toggle('selected', modo === 'cep');
  document.getElementById('pg-bairro-wrap').style.display = modo === 'bairro' ? '' : 'none';
  document.getElementById('pg-cep-wrap').style.display = modo === 'cep' ? '' : 'none';
  localizarPg();
}

function limparCirculoPg() {
  if (pgPickerCirculo && pgPickerMap) { pgPickerMap.removeLayer(pgPickerCirculo); pgPickerCirculo = null; }
  document.getElementById('pg-lat').value = '';
  document.getElementById('pg-lng').value = '';
}

async function localizarPg() {
  const valor = pgModoLocal === 'cep'
    ? document.getElementById('pg-cep').value.trim()
    : document.getElementById('pg-bairro').value.trim();
  if (!valor) { pgDefinirStatusLocal('', ''); limparCirculoPg(); return; }

  pgDefinirStatusLocal('Localizando...', '');
  try {
    const query = pgModoLocal === 'cep'
      ? await pgGeocodificarPorCep(valor)
      : pgCompletarQueryEstadoSP(valor);
    const { lat, lng, nome } = await pgGeocodificarEndereco(query);
    desenharCirculoPg(lat, lng);
    pgDefinirStatusLocal('📍 ' + nome, 'ok');
  } catch (e) {
    limparCirculoPg();
    pgDefinirStatusLocal('Não foi possível localizar: ' + e.message, 'erro');
  }
}

function openModalPg() {
  document.getElementById('modal-pg-title').textContent = 'Criar Pequeno Grupo';
  document.getElementById('pg-edit-id').value = '';
  ['pg-nome','pg-anfitriao','pg-bairro','pg-cep','pg-tema','pg-desc','pg-whatsapp'].forEach(f => document.getElementById(f).value = '');
  document.getElementById('pg-dia').value = 'Ter';
  document.getElementById('pg-horario').value = '20:00';
  document.getElementById('pg-frequencia').value = 'Semanal';
  pgDefinirStatusLocal('', '');
  pgSetModoLocal('bairro');
  pgPreencherPastores(null);
  pgSetDestinoContato('lider');
  openModal('modal-pg');
  setTimeout(() => initPgPickerMap(null, null), 50);
}

function editPg(id) {
  const p = pgs.find(x => x.id === id);
  if (!p) return;
  document.getElementById('modal-pg-title').textContent = 'Editar Pequeno Grupo';
  document.getElementById('pg-edit-id').value = p.id;
  document.getElementById('pg-nome').value = p.nome || '';
  document.getElementById('pg-anfitriao').value = p.anfitriao || '';
  document.getElementById('pg-bairro').value = p.bairro || '';
  document.getElementById('pg-cep').value = p.cep || '';
  document.getElementById('pg-dia').value = p.dia_semana || 'Ter';
  document.getElementById('pg-horario').value = (p.horario || '20:00').slice(0,5);
  document.getElementById('pg-frequencia').value = p.frequencia || 'Semanal';
  document.getElementById('pg-tema').value = p.tema || '';
  document.getElementById('pg-desc').value = p.descricao || '';
  document.getElementById('pg-whatsapp').value = p.whatsapp || '';
  pgPreencherPastores(p.pastor_id);
  pgSetDestinoContato(p.contato_destino === 'pastor' ? 'pastor' : 'lider');
  pgModoLocal = p.cep ? 'cep' : 'bairro';
  document.getElementById('pg-modo-bairro').classList.toggle('selected', pgModoLocal === 'bairro');
  document.getElementById('pg-modo-cep').classList.toggle('selected', pgModoLocal === 'cep');
  document.getElementById('pg-bairro-wrap').style.display = pgModoLocal === 'bairro' ? '' : 'none';
  document.getElementById('pg-cep-wrap').style.display = pgModoLocal === 'cep' ? '' : 'none';
  pgDefinirStatusLocal(p.lat && p.lng ? '📍 Localização já definida' : '', p.lat && p.lng ? 'ok' : '');
  closeModal('modal-pg-detalhe');
  openModal('modal-pg', true);
  setTimeout(() => initPgPickerMap(p.lat, p.lng), 50);
}

// ===== Quem recebe a mensagem de "Quero participar": líder do PG ou pastor responsável =====
let pgDestinoContato = 'lider';

function pgSetDestinoContato(destino) {
  pgDestinoContato = destino;
  document.getElementById('pg-destino-lider').classList.toggle('selected', destino === 'lider');
  document.getElementById('pg-destino-pastor').classList.toggle('selected', destino === 'pastor');
  document.getElementById('pg-destino-lider-wrap').style.display = destino === 'lider' ? '' : 'none';
  document.getElementById('pg-destino-pastor-wrap').style.display = destino === 'pastor' ? '' : 'none';
  pgAvisoPastorSemTel();
}

// Só pessoas cadastradas no app com acesso de pastor
function pgPastores() {
  return voluntarios.filter(v => v.nivel === 'pastor').sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

function pgPreencherPastores(selecionadoId) {
  const sel = document.getElementById('pg-pastor');
  const pastores = pgPastores();
  sel.innerHTML = '<option value="">Selecione o pastor...</option>' +
    pastores.map(v => `<option value="${v.id}">${v.nome}</option>`).join('');
  sel.value = pastores.some(v => v.id === selecionadoId) ? selecionadoId : '';
}

function pgTelValido(tel) {
  const n = (tel || '').replace(/\D/g, '');
  return n.length >= 10;
}

function pgAvisoPastorSemTel() {
  const aviso = document.getElementById('pg-pastor-aviso');
  const v = voluntarios.find(x => x.id === document.getElementById('pg-pastor').value);
  const semTel = pgDestinoContato === 'pastor' && v && !pgTelValido(v.tel);
  aviso.textContent = semTel ? `${v.nome} não tem celular cadastrado no app — o botão "Quero participar" não vai aparecer até o celular ser preenchido no cadastro dele.` : '';
  aviso.style.display = semTel ? 'block' : 'none';
}

// ===== Detalhes do PG (gerência): informações + pessoas do grupo =====
function abrirDetalhePgAdmin(id) {
  const p = pgs.find(x => x.id === id);
  if (!p) return;
  const canEdit = perm(getNivelAtivo(), 'pode_editar_pgs') || perm(getNivelAtivo(), 'pode_criar_pgs');
  const pastor = p.pastor_id ? voluntarios.find(v => v.id === p.pastor_id) : null;
  const contato = p.contato_destino === 'pastor'
    ? `Pastor responsável: ${pastor ? pastor.nome : '—'}${pastor && !pgTelValido(pastor.tel) ? ' (sem celular cadastrado)' : ''}`
    : `Líder do PG${p.whatsapp ? ' · ' + p.whatsapp : ' (sem WhatsApp cadastrado)'}`;
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const linha = (icone, titulo, valor) => valor ? `<div class="pgdet-row"><i class="ti ${icone}"></i><div><span>${titulo}</span><br>${esc(valor)}</div></div>` : '';

  document.getElementById('pgdet-nome').textContent = p.nome;
  document.getElementById('pgdet-sub').textContent = (p.tema ? p.tema + ' · ' : '') + (p.ativo ? 'Ativo' : 'Inativo');
  document.getElementById('pgdet-info').innerHTML =
    linha('ti-home', 'Anfitrião(s)', p.anfitriao) +
    linha('ti-clock', 'Quando', `${p.dia_semana || '—'}${p.horario ? ' às ' + p.horario.slice(0,5) : ''} · ${p.frequencia || 'Semanal'}`) +
    linha('ti-map-pin', 'Local', [p.bairro, p.cep].filter(Boolean).join(' · ') || '—') +
    linha('ti-brand-whatsapp', 'Mensagem de quem quer participar vai para', contato) +
    linha('ti-notes', 'Descrição', p.descricao);

  document.getElementById('pg-pessoa-add').style.display = canEdit ? '' : 'none';
  document.getElementById('pg-pessoa-nome').value = '';
  const btnEditar = document.getElementById('pgdet-btn-editar');
  btnEditar.style.display = canEdit ? '' : 'none';
  btnEditar.onclick = () => editPg(id);

  pgPessoasPgId = id;
  pgPessoasPodeEditar = canEdit;
  pgPessoasAtual = [];
  document.getElementById('pg-pessoas-lista').innerHTML = '<p class="pg-pessoas-vazio">Carregando...</p>';
  document.getElementById('pgdet-pessoas-count').textContent = '';
  openModal('modal-pg-detalhe');
  carregarPessoasPg(id);
}

// ===== Lista de pessoas do grupo (só nomes, sem cadastro) =====
let pgPessoasPodeEditar = false;
let pgPessoasAtual = [];
let pgPessoasPgId = null;

async function carregarPessoasPg(pgId) {
  try {
    pgPessoasAtual = (await sb(`pg_participantes?pg_id=eq.${pgId}&select=*&order=nome`)) || [];
  } catch (e) {
    console.error('Falha ao carregar pessoas do PG:', e);
    pgPessoasAtual = [];
  }
  renderPessoasPg();
}

function renderPessoasPg() {
  const el = document.getElementById('pg-pessoas-lista');
  if (!el) return;
  document.getElementById('pgdet-pessoas-count').textContent = pgPessoasAtual.length ? `(${pgPessoasAtual.length})` : '';
  if (!pgPessoasAtual.length) {
    el.innerHTML = '<p class="pg-pessoas-vazio">Nenhuma pessoa na lista ainda.</p>';
    return;
  }
  el.innerHTML = pgPessoasAtual.map(p => `
    <div class="pg-pessoa-chip">
      <span>${p.nome}</span>
      ${pgPessoasPodeEditar ? `<button type="button" onclick="removerPessoaPg('${p.id}')" title="Remover"><i class="ti ti-x"></i></button>` : ''}
    </div>`).join('');
}

async function adicionarPessoaPg() {
  const input = document.getElementById('pg-pessoa-nome');
  const nome = input.value.trim();
  if (!nome || !pgPessoasPgId) return;
  try {
    const rows = await sb('pg_participantes', { method: 'POST', body: JSON.stringify({ pg_id: pgPessoasPgId, nome }) });
    if (rows && rows[0]) pgPessoasAtual.push(rows[0]);
    pgPessoasAtual.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    input.value = '';
    renderPessoasPg();
  } catch (e) {
    alert('Não foi possível adicionar: ' + e.message);
  }
  input.focus();
}

async function removerPessoaPg(id) {
  try {
    await sb(`pg_participantes?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
    pgPessoasAtual = pgPessoasAtual.filter(p => p.id !== id);
    renderPessoasPg();
  } catch (e) {
    alert('Não foi possível remover: ' + e.message);
  }
}

async function savePg() {
  const nome = document.getElementById('pg-nome').value.trim();
  if (!nome) { alert('O nome do PG é obrigatório.'); return; }
  const lat = document.getElementById('pg-lat').value;
  const lng = document.getElementById('pg-lng').value;
  if (!lat || !lng) { alert('Informe o bairro ou o CEP e aguarde localizar no mapa antes de salvar.'); return; }
  const pastorId = document.getElementById('pg-pastor').value;
  if (pgDestinoContato === 'pastor' && !pastorId) { alert('Escolha o pastor responsável que vai receber as mensagens.'); return; }

  const dados = {
    nome,
    anfitriao: document.getElementById('pg-anfitriao').value.trim(),
    bairro: document.getElementById('pg-bairro').value.trim(),
    cep: document.getElementById('pg-cep').value.trim(),
    dia_semana: document.getElementById('pg-dia').value,
    horario: document.getElementById('pg-horario').value,
    frequencia: document.getElementById('pg-frequencia').value,
    tema: document.getElementById('pg-tema').value.trim(),
    descricao: document.getElementById('pg-desc').value.trim(),
    whatsapp: document.getElementById('pg-whatsapp').value.trim(),
    contato_destino: pgDestinoContato,
    pastor_id: pgDestinoContato === 'pastor' ? pastorId : null,
    lat: parseFloat(lat),
    lng: parseFloat(lng),
  };

  const editId = document.getElementById('pg-edit-id').value;
  const btn = document.getElementById('btn-save-pg');
  btn.disabled = true;
  try {
    if (editId) {
      await sb(`pequenos_grupos?id=eq.${editId}`, { method: 'PATCH', body: JSON.stringify(dados) });
      const p = pgs.find(x => x.id === editId); if (p) Object.assign(p, dados);
      registrarLog('editar', 'pg', nome, `${currentProfile.nome} editou o Pequeno Grupo "${nome}"`);
    } else {
      dados.ativo = true;
      dados.criado_por = currentProfile.id;
      const rows = await sb('pequenos_grupos', { method: 'POST', body: JSON.stringify(dados) });
      if (rows && rows[0]) pgs.push(rows[0]);
      registrarLog('criar', 'pg', nome, `${currentProfile.nome} criou o Pequeno Grupo "${nome}"`);
    }
    closeModal('modal-pg');
    renderPgs();
  } catch (e) {
    alert('Erro ao salvar: ' + e.message);
  }
  btn.disabled = false;
}

async function deletePg(id) {
  const p = pgs.find(x => x.id === id);
  if (!p) return;
  if (!confirm(`Excluir o Pequeno Grupo "${p.nome}"? Ele deixará de aparecer na área pública.`)) return;
  try {
    await sb(`pequenos_grupos?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
    registrarLog('excluir', 'pg', p.nome, `${currentProfile.nome} excluiu o Pequeno Grupo "${p.nome}"`);
    pgs = pgs.filter(x => x.id !== id);
    renderPgs();
  } catch (e) {
    alert('Erro ao excluir: ' + e.message);
  }
}
