// ===== NAVEGAÇÃO =====
// ===== NAVEGAÇÃO =====
function navigate(sec, extra) {
  // Salvar seção atual para restaurar no refresh
  try { localStorage.setItem('igreja_last_section', sec); } catch(e) {}
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  const el = document.getElementById('section-' + sec);
  if (el) el.classList.add('active');
  const titles = {dashboard:'Dashboard',calendario:'Calendário',ministerios:'Ministérios',voluntarios:'Voluntários',eventos:'Eventos',niveis:'Níveis de acesso',perfil:'Meu perfil','ministerio-detalhe':'Detalhes do ministério'};
  document.getElementById('page-title').textContent = titles[sec] || '';
  const acts = document.getElementById('topbar-actions'); acts.innerHTML = '';
  const nav = getNivelAtivo();
  const isAdmin = nivelIsAdmin(nav);
  const isLiderOuAdmin = nivelIsLiderOuAdmin(nav);
  if (perm(nav,'pode_criar_ministerios') && sec==='ministerios') acts.innerHTML = `
    <button class="btn" onclick="openModalGrupo()"><i class="ti ti-folder-plus"></i>Novo grupo</button>
    <button class="btn primary" onclick="openModalMin()"><i class="ti ti-plus"></i>Novo ministério</button>`;
  if (nivelPodeGerenciarVoluntarios(nav) && sec==='voluntarios') acts.innerHTML = `<button class="btn primary" onclick="openModal('modal-vol')"><i class="ti ti-user-plus"></i>Novo voluntário</button>`;
  if (nivelPodeGerenciarEventos(nav) && sec==='eventos') acts.innerHTML = `<button class="btn primary" onclick="openModal('modal-ev')"><i class="ti ti-plus"></i>Novo evento</button>`;
  if (nivelPodeVerNiveis(nav) && sec==='niveis') acts.innerHTML = `<button class="btn primary" onclick="openModalNivel()"><i class="ti ti-plus"></i>Novo nível</button>`;
  const renders = {dashboard:renderDashboard,calendario:renderCalendario,ministerios:renderMinisterios,voluntarios:renderVoluntarios,eventos:renderEventos,niveis:renderNiveis,perfil:renderPerfil};
  if (renders[sec]) renders[sec]();
  if (sec==='ministerio-detalhe' && extra) renderDetalhe(extra);
}
