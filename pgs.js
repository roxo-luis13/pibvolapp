// ===== PEQUENOS GRUPOS (PGs) - administração =====
const PG_CENTRO_PADRAO = { lat: -22.9099, lng: -47.0626 }; // Campinas/SP

function badgeVagaClasse(v) { return v === 'aberto' ? 'success' : v === 'quase' ? 'warning' : 'danger'; }
function badgeVagaTexto(v) { return v === 'aberto' ? 'Aberto' : v === 'quase' ? 'Quase lotado' : 'Lotado'; }

function renderPgs() {
  const tbody = document.getElementById('pgs-tbody');
  if (!tbody) return;
  const canEdit = perm(getNivelAtivo(), 'pode_editar_pgs') || perm(getNivelAtivo(), 'pode_criar_pgs');
  const canExcluir = perm(getNivelAtivo(), 'pode_excluir_pgs');
  document.getElementById('pgs-empty').style.display = pgs.length ? 'none' : 'block';
  document.getElementById('pgs-count').textContent = pgs.length ? `${pgs.length} PG(s)` : '';

  tbody.innerHTML = pgs.map(p => {
    const btns = `<div style="display:flex;gap:4px">
      ${canEdit ? `<button class="btn sm" onclick="editPg('${p.id}')"><i class="ti ti-edit"></i></button>` : ''}
      ${canExcluir ? `<button class="btn sm danger" onclick="deletePg('${p.id}')"><i class="ti ti-trash"></i></button>` : ''}
    </div>`;
    return `<tr>
      <td>${p.nome}</td>
      <td>${p.dia_semana || '—'}${p.horario ? ' às ' + p.horario.slice(0,5) : ''}</td>
      <td>${p.bairro || '—'}</td>
      <td>${p.tema || '—'}</td>
      <td><span class="badge ${badgeVagaClasse(p.vaga)}">${badgeVagaTexto(p.vaga)}</span></td>
      <td>${p.ativo ? '<i class="ti ti-check" style="color:var(--success-text)"></i>' : '<i class="ti ti-x" style="color:var(--text-tertiary)"></i>'}</td>
      <td>${btns}</td>
    </tr>`;
  }).join('');
}

// ===== MODAL CRIAR/EDITAR =====
let pgPickerMap = null, pgPickerMarker = null;

function initPgPickerMap(lat, lng) {
  const el = document.getElementById('pg-mapa-picker');
  if (!el) return;
  const centro = (lat && lng) ? [lat, lng] : [PG_CENTRO_PADRAO.lat, PG_CENTRO_PADRAO.lng];

  if (!pgPickerMap) {
    pgPickerMap = L.map('pg-mapa-picker').setView(centro, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors', maxZoom: 19
    }).addTo(pgPickerMap);
    pgPickerMap.on('click', e => colocarPgMarker(e.latlng.lat, e.latlng.lng));
  } else {
    pgPickerMap.setView(centro, 13);
  }

  if (pgPickerMarker) { pgPickerMap.removeLayer(pgPickerMarker); pgPickerMarker = null; }
  if (lat && lng) colocarPgMarker(lat, lng);
  else { document.getElementById('pg-lat').value = ''; document.getElementById('pg-lng').value = ''; }

  setTimeout(() => pgPickerMap.invalidateSize(), 80);
}

function colocarPgMarker(lat, lng) {
  if (pgPickerMarker) pgPickerMap.removeLayer(pgPickerMarker);
  pgPickerMarker = L.marker([lat, lng], { draggable: true }).addTo(pgPickerMap);
  pgPickerMarker.on('dragend', () => {
    const pos = pgPickerMarker.getLatLng();
    document.getElementById('pg-lat').value = pos.lat;
    document.getElementById('pg-lng').value = pos.lng;
  });
  document.getElementById('pg-lat').value = lat;
  document.getElementById('pg-lng').value = lng;
}

function openModalPg() {
  document.getElementById('modal-pg-title').textContent = 'Criar Pequeno Grupo';
  document.getElementById('pg-edit-id').value = '';
  ['pg-nome','pg-anfitriao','pg-bairro','pg-tema','pg-desc','pg-whatsapp','pg-participantes'].forEach(f => document.getElementById(f).value = '');
  document.getElementById('pg-dia').value = 'Ter';
  document.getElementById('pg-horario').value = '20:00';
  document.getElementById('pg-frequencia').value = 'Semanal';
  document.getElementById('pg-vaga').value = 'aberto';
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
  document.getElementById('pg-dia').value = p.dia_semana || 'Ter';
  document.getElementById('pg-horario').value = (p.horario || '20:00').slice(0,5);
  document.getElementById('pg-frequencia').value = p.frequencia || 'Semanal';
  document.getElementById('pg-tema').value = p.tema || '';
  document.getElementById('pg-desc').value = p.descricao || '';
  document.getElementById('pg-whatsapp').value = p.whatsapp || '';
  document.getElementById('pg-participantes').value = p.participantes || '';
  document.getElementById('pg-vaga').value = p.vaga || 'aberto';
  openModal('modal-pg', true);
  setTimeout(() => initPgPickerMap(p.lat, p.lng), 50);
}

async function savePg() {
  const nome = document.getElementById('pg-nome').value.trim();
  if (!nome) { alert('O nome do PG é obrigatório.'); return; }
  const lat = document.getElementById('pg-lat').value;
  const lng = document.getElementById('pg-lng').value;
  if (!lat || !lng) { alert('Marque o local aproximado do PG no mapa.'); return; }

  const dados = {
    nome,
    anfitriao: document.getElementById('pg-anfitriao').value.trim(),
    bairro: document.getElementById('pg-bairro').value.trim(),
    dia_semana: document.getElementById('pg-dia').value,
    horario: document.getElementById('pg-horario').value,
    frequencia: document.getElementById('pg-frequencia').value,
    tema: document.getElementById('pg-tema').value.trim(),
    descricao: document.getElementById('pg-desc').value.trim(),
    whatsapp: document.getElementById('pg-whatsapp').value.trim(),
    participantes: parseInt(document.getElementById('pg-participantes').value) || 0,
    vaga: document.getElementById('pg-vaga').value,
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
