// ===== SIDEBAR =====
// ===== SIDEBAR =====
function toggleSidebar() {
  if (isMobile()) { openSidebarMobile(); return; }
  sidebarCollapsed = !sidebarCollapsed;
  document.getElementById('sidebar').classList.toggle('collapsed', sidebarCollapsed);
  document.getElementById('toggle-icon').className = sidebarCollapsed ? 'ti ti-layout-sidebar-left-expand' : 'ti ti-layout-sidebar-left-collapse';
}
function openSidebarMobile() { document.getElementById('sidebar').classList.add('mobile-open'); document.getElementById('sidebar-overlay').classList.add('open'); }
function closeSidebarMobile() { if (isMobile()) { document.getElementById('sidebar').classList.remove('mobile-open'); document.getElementById('sidebar-overlay').classList.remove('open'); } }
function closeSidebar() { document.getElementById('sidebar').classList.remove('mobile-open'); document.getElementById('sidebar-overlay').classList.remove('open'); }
function checkMobileLayout() {
  const btn = document.getElementById('mobile-menu-btn');
  if (isMobile()) { btn.style.display = 'flex'; document.getElementById('sidebar').classList.remove('collapsed'); sidebarCollapsed = false; }
  else { btn.style.display = 'none'; closeSidebar(); }
}
window.addEventListener('resize', checkMobileLayout);

// Swipe para fechar sidebar no mobile
(function() {
  let startX = 0, startY = 0;
  document.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, {passive: true});
  document.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = Math.abs(e.changedTouches[0].clientY - startY);
    const sb = document.getElementById('sidebar');
    if (!sb) return;
    // Swipe para esquerda fecha sidebar
    if (dx < -60 && dy < 80 && sb.classList.contains('mobile-open')) {
      closeSidebar();
    }
    // Swipe para direita abre sidebar (apenas da borda esquerda)
    if (dx > 60 && dy < 80 && startX < 30 && !sb.classList.contains('mobile-open')) {
      if (window.innerWidth <= 768) openSidebarMobile();
    }
  }, {passive: true});
})();

function updateSidebar() {
  document.getElementById('sb-avatar').textContent = ini(currentProfile.nome);
  document.getElementById('sb-avatar').className = 'avatar ' + getNivelClass(currentProfile.nivel);
  document.getElementById('sb-name').textContent = currentProfile.nome;
  document.getElementById('sb-role').textContent = getNivelLabel(currentProfile.nivel);
  const nivel = currentProfile.nivel;
  const isAdmin = nivelIsAdmin(nivel);
  const isLiderOuAdmin = nivelIsLiderOuAdmin(nivel);
  document.getElementById('nav-ministerios').style.display = isLiderOuAdmin ? 'flex' : 'none';
  document.getElementById('nav-voluntarios').style.display = nivelPodeGerenciarVoluntarios(nivel) ? 'flex' : 'none';
  document.getElementById('nav-eventos').style.display = nivelPodeGerenciarEventos(nivel) ? 'flex' : 'none';
  document.getElementById('nav-niveis').style.display = isAdmin ? 'flex' : 'none';
  document.getElementById('admin-section').style.display = isLiderOuAdmin ? 'block' : 'none';
  atualizarBadgeNotif();
}
