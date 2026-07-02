// ===== PRÉ-VISUALIZAÇÃO E NÍVEIS DE ACESSO =====
// ===== PRÉ-VISUALIZAÇÃO DE NÍVEL =====
function preVisualizarNivel(nomeNivel) {
  previewNivel = nomeNivel;
  const n = niveisAcesso.find(n=>n.nome===nomeNivel);
  const label = n ? (n.nome.charAt(0).toUpperCase()+n.nome.slice(1)) : nomeNivel;
  // Show banner
  const banner = document.getElementById('preview-banner');
  banner.style.display = 'flex';
  document.getElementById('preview-label').textContent = label;
  // Update sidebar to reflect preview nivel
  updateSidebarPreview();
  // Navigate to dashboard in preview mode
  navigate('dashboard');
}

function sairPreVisualizacao() {
  previewNivel = null;
  document.getElementById('preview-banner').style.display = 'none';
  updateSidebar();
  navigate('niveis');
}

// Returns the nivel to use for permission checks (preview or real)
function getNivelAtivo() {
  return previewNivel || currentProfile.nivel;
}

function updateSidebarPreview() {
  const nivel = previewNivel;
  const isAdmin = nivelIsAdmin(nivel);
  const isLiderOuAdmin = nivelIsLiderOuAdmin(nivel);
  const nObj = niveisAcesso.find(n=>n.nome===nivel);
  const label = nObj ? (nObj.nome.charAt(0).toUpperCase()+nObj.nome.slice(1)) : nivel;
  document.getElementById('sb-name').textContent = currentProfile.nome + ' (como ' + label + ')';
  document.getElementById('sb-role').textContent = '👁 Pré-visualização';
  document.getElementById('sb-avatar').style.background = 'var(--purple-bg)';
  document.getElementById('sb-avatar').style.color = 'var(--purple-text)';
  const navMin = document.getElementById('nav-ministerios');
  const navVol = document.getElementById('nav-voluntarios');
  const navEv = document.getElementById('nav-eventos');
  const navNiv = document.getElementById('nav-niveis');
  const adminSec = document.getElementById('admin-section');
  if (navMin) navMin.style.display = isLiderOuAdmin ? 'flex' : 'none';
  if (navVol) navVol.style.display = nivelPodeGerenciarVoluntarios(nivel) ? 'flex' : 'none';
  if (navEv) navEv.style.display = nivelPodeGerenciarEventos(nivel) ? 'flex' : 'none';
  if (navNiv) navNiv.style.display = 'none';
  if (adminSec) adminSec.style.display = isLiderOuAdmin ? 'block' : 'none';
}

const NIVEL_PADRAO = ['admin','lider','voluntario'];
const PERMS = [
  {id:'pode_criar_ministerios', label:'Criar ministérios'},
  {id:'pode_editar_ministerios', label:'Editar ministérios'},
  {id:'pode_excluir_ministerios', label:'Excluir ministérios'},
  {id:'pode_cadastrar_voluntarios', label:'Cadastrar voluntários'},
  {id:'pode_editar_voluntarios', label:'Editar/remover voluntários'},
  {id:'pode_criar_eventos', label:'Criar eventos'},
  {id:'pode_editar_eventos', label:'Editar/excluir eventos'},
  {id:'pode_ver_todos_ministerios', label:'Ver todos os ministérios'},
];

function getPerm(nivel, permId) {
  const n = niveisAcesso.find(n=>n.nome===nivel);
  if (n) return !!n[permId];
  // Fallback se niveisAcesso ainda não carregou
  if (nivel==='admin') return true;
  if (nivel==='lider') return ['pode_cadastrar_voluntarios','pode_editar_voluntarios'].includes(permId);
  return false;
}

function renderNiveis() {
  const grid = document.getElementById('niveis-grid');
  if (!niveisAcesso.length) { grid.innerHTML='<div class="empty" style="grid-column:1/-1"><i class="ti ti-shield-lock"></i>Nenhum nível cadastrado</div>'; return; }
  const COLORS = {admin:'amber',lider:'blue',voluntario:'green'};
  grid.innerHTML = '';
  niveisAcesso.forEach(n => {
    const isPadrao = NIVEL_PADRAO.includes(n.nome);
    const cor = COLORS[n.nome] || 'purple';
    const permsAtivas = PERMS.filter(p=>n[p.id]);
    const div = document.createElement('div');
    div.className = 'card';
    div.style.cssText = 'display:flex;flex-direction:column;gap:10px';
    let html = `<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
      <div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <i class="ti ti-shield-lock" style="font-size:20px;color:var(--${cor}-text)"></i>
          <h3 style="font-size:15px;font-weight:500">${n.nome.charAt(0).toUpperCase()+n.nome.slice(1)}</h3>
          ${isPadrao?'<span style="font-size:10px;background:var(--bg-secondary);color:var(--text-tertiary);padding:2px 7px;border-radius:4px">Padrão</span>':''}
        </div>
        <p style="font-size:12px;color:var(--text-secondary)">${n.descricao||'Sem descrição'}</p>
      </div>
      <div style="display:flex;gap:4px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end">
        <button class="btn sm" onclick="preVisualizarNivel('${n.nome}')" style="background:var(--purple-bg);color:var(--purple-text);border-color:var(--purple-text)"><i class="ti ti-eye"></i>Pré-visualizar</button>
        <button class="btn sm" onclick="editNivel('${n.id}')"><i class="ti ti-edit"></i>Editar</button>
        ${!isPadrao?`<button class="btn sm danger" onclick="deleteNivel('${n.id}')"><i class="ti ti-trash"></i>Excluir</button>`:''}
      </div>
    </div>`;
    html += `<div style="border-top:0.5px solid var(--border);padding-top:10px">
      <p style="font-size:11px;font-weight:500;color:var(--text-secondary);margin-bottom:6px;text-transform:uppercase;letter-spacing:.3px">Permissões (${permsAtivas.length}/${PERMS.length})</p>
      <div style="display:flex;flex-wrap:wrap;gap:4px">`;
    PERMS.forEach(p => {
      const ativo = !!n[p.id];
      html += `<span style="font-size:11px;padding:3px 8px;border-radius:var(--radius);font-weight:500;background:${ativo?'var(--success-bg)':'var(--bg-secondary)'};color:${ativo?'var(--success-text)':'var(--text-tertiary)'}">
        ${ativo?'✓':'✗'} ${p.label}</span>`;
    });
    html += '</div></div>';
    div.innerHTML = html;
    grid.appendChild(div);
  });
}

function openModalNivel() {
  document.getElementById('modal-nivel-title').textContent = 'Criar nível de acesso';
  document.getElementById('nivel-edit-id').value = '';
  document.getElementById('nivel-nome').value = '';
  document.getElementById('nivel-nome').disabled = false;
  document.getElementById('nivel-desc').value = '';
  ['p-criar-min','p-editar-min','p-excluir-min','p-cadastrar-vol','p-editar-vol','p-criar-ev','p-editar-ev','p-ver-min'].forEach(id=>{
    document.getElementById(id).checked = false;
  });
  openModal('modal-nivel');
}

function editNivel(id) {
  const n = niveisAcesso.find(n=>n.id===id); if (!n) return;
  const isPadrao = NIVEL_PADRAO.includes(n.nome);
  document.getElementById('modal-nivel-title').textContent = 'Editar nível: ' + n.nome.charAt(0).toUpperCase() + n.nome.slice(1);
  document.getElementById('nivel-edit-id').value = id;
  document.getElementById('nivel-nome').value = n.nome;
  document.getElementById('nivel-nome').disabled = isPadrao;
  document.getElementById('nivel-nome').title = isPadrao ? 'O nome dos níveis padrão não pode ser alterado' : '';
  document.getElementById('nivel-desc').value = n.descricao||'';
  document.getElementById('p-criar-min').checked = !!n.pode_criar_ministerios;
  document.getElementById('p-editar-min').checked = !!n.pode_editar_ministerios;
  document.getElementById('p-excluir-min').checked = !!n.pode_excluir_ministerios;
  document.getElementById('p-cadastrar-vol').checked = !!n.pode_cadastrar_voluntarios;
  document.getElementById('p-editar-vol').checked = !!n.pode_editar_voluntarios;
  document.getElementById('p-criar-ev').checked = !!n.pode_criar_eventos;
  document.getElementById('p-editar-ev').checked = !!n.pode_editar_eventos;
  document.getElementById('p-ver-min').checked = !!n.pode_ver_todos_ministerios;
  openModal('modal-nivel', true);
}

async function saveNivel() {
  const nome = document.getElementById('nivel-nome').value.trim().toLowerCase().replace(/\s+/g,'_');
  if (!nome) { alert('Nome é obrigatório.'); return; }
  const dados = {
    nome,
    descricao: document.getElementById('nivel-desc').value.trim(),
    pode_criar_ministerios: document.getElementById('p-criar-min').checked,
    pode_editar_ministerios: document.getElementById('p-editar-min').checked,
    pode_excluir_ministerios: document.getElementById('p-excluir-min').checked,
    pode_cadastrar_voluntarios: document.getElementById('p-cadastrar-vol').checked,
    pode_editar_voluntarios: document.getElementById('p-editar-vol').checked,
    pode_criar_eventos: document.getElementById('p-criar-ev').checked,
    pode_editar_eventos: document.getElementById('p-editar-ev').checked,
    pode_ver_todos_ministerios: document.getElementById('p-ver-min').checked,
  };
  const editId = document.getElementById('nivel-edit-id').value;
  try {
    if (editId) {
      await sb(`niveis_acesso?id=eq.${editId}`, {method:'PATCH', body:JSON.stringify(dados)});
      const n = niveisAcesso.find(n=>n.id===editId); if (n) Object.assign(n,dados);
    } else {
      const rows = await sb('niveis_acesso', {method:'POST', body:JSON.stringify(dados)});
      if (rows && rows[0]) niveisAcesso.push(rows[0]);
    }
    closeModal('modal-nivel');
    renderNiveis();
    // Update vol-nivel select
    atualizarSelectNiveis();
  } catch(e) { alert('Erro: '+e.message); }
}

async function deleteNivel(id) {
  const n = niveisAcesso.find(n=>n.id===id);
  if (!n) { alert('Nível não encontrado. Recarregue a página.'); return; }
  if (NIVEL_PADRAO.includes(n.nome)) {
    alert(`O nível "${n.nome}" é um nível padrão do sistema e não pode ser excluído.

Você pode editar as permissões dele, mas não excluí-lo.`);
    return;
  }
  // Verificar se há voluntários usando este nível
  const emUso = voluntarios.filter(v=>v.nivel===n.nome);
  let msg = `Excluir o nível "${n.nome}"?`;
  if (emUso.length > 0) {
    msg += `

Atenção: ${emUso.length} voluntário(s) usam este nível. Eles serão alterados para "voluntario".`;
  }
  if (!confirm(msg)) return;
  try {
    await sb(`niveis_acesso?id=eq.${id}`, {method:'DELETE', prefer:'return=minimal'});
    // Se havia voluntários com este nível, atualizar para voluntario
    for (const v of emUso) {
      await sb(`voluntarios?id=eq.${v.id}`, {method:'PATCH', body:JSON.stringify({nivel:'voluntario'})});
      v.nivel = 'voluntario';
    }
    niveisAcesso = niveisAcesso.filter(x=>x.id!==id);
    renderNiveis();
    atualizarSelectNiveis();
    if (emUso.length > 0) renderVoluntarios();
  } catch(e) {
    alert('Erro ao excluir: ' + e.message);
  }
}

function atualizarSelectNiveis() {
  const sel = document.getElementById('vol-nivel');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = niveisAcesso.map(n=>`<option value="${n.nome}">${n.nome.charAt(0).toUpperCase()+n.nome.slice(1).replace(/_/g,' ')}</option>`).join('');
  if (current) sel.value = current;
}
