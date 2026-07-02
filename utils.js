// ===== UTILITÁRIOS - modais, chips, banda =====
// ===== MODAIS / CHIPS =====
function openModal(id, modoEdicao) {
  if (!modoEdicao) {
    if (id==='modal-vol') {
      document.getElementById('modal-vol-title').textContent='Cadastrar voluntário';
      document.getElementById('vol-edit-id').value='';
      ['vol-nome','vol-email','vol-tel'].forEach(f=>document.getElementById(f).value='');
      atualizarSelectNiveis();
      document.getElementById('vol-nivel').value='voluntario';
      populateChips('vol-ministerios-chips');
    }
    if (id==='modal-ev') {
      document.getElementById('modal-ev-title').textContent='Criar evento';
      document.getElementById('ev-edit-id').value='';
      const hoje = new Date().toISOString().split('T')[0];
      document.getElementById('ev-data-inicio').value=hoje;
      document.getElementById('ev-data-fim').value='';
      ['ev-nome','ev-desc','ev-banda'].forEach(f=>document.getElementById(f).value='');
      document.getElementById('ev-live').checked=false;
      document.getElementById('ev-som').checked=false;
      document.getElementById('ev-local').value='';
      document.getElementById('ev-dias-container').innerHTML='';
      setTimeout(()=>atualizarDiasEvento(), 50);
      populateChips('ev-ministerios-chips');
      renderConvidarLista([]);
    }
  }
  document.getElementById(id).classList.add('open');
}

// ===== BANDA VISIBILITY =====
// ===== BANDA VISIBILITY =====
function podVerBanda() {
  if (nivelIsAdmin(getNivelAtivo())) return true;
  // Verificar se o usuário pertence a um ministério de som/transmissão/multimídia/banda
  const palavrasChave = ['som', 'transmiss', 'multim', 'banda', 'music', 'louvor', 'worship', 'audio', 'áudio', 'mídia', 'media'];
  const meusMinisterios = ministerios.filter(m => (currentProfile.ministerios||[]).includes(m.id));
  return meusMinisterios.some(m => {
    const nome = (m.nome||'').toLowerCase();
    const desc = (m.descricao||'').toLowerCase();
    return palavrasChave.some(p => nome.includes(p) || desc.includes(p));
  });
}


function closeModal(id) { document.getElementById(id).classList.remove('open'); }
