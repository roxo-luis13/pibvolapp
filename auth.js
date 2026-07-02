// ===== AUTENTICAÇÃO =====
// ===== INIT =====
async function init() {
  // Verificar sessão salva
  const saved = localStorage.getItem('igreja_session');
  if (saved) {
    try {
      const s = JSON.parse(saved);
      // Verificar se token ainda é válido
      const res = await fetch(SUPA_URL + '/auth/v1/user', {
        headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + s.access_token }
      });
      if (res.ok) {
        session = s;
        await loadProfile(s.user.id);
        return;
      }
    } catch(e) {}
    localStorage.removeItem('igreja_session');
  }
  showScreen('login');
}

async function loadProfile(userId) {
  const rows = await sb(`voluntarios?id=eq.${userId}&select=*`);
  if (!rows || !rows.length) { showScreen('login'); return; }
  currentProfile = rows[0];
  if (currentProfile.primeiro_acesso) {
    showFirstAccess();
    return;
  }
  await loadAllData();
  showScreen('app');
  updateSidebar();
  checkMobileLayout();
  navigate('dashboard');
}

async function loadAllData() {
  const [m, v, e, n, niv] = await Promise.all([
    sb('ministerios?select=*&order=nome'),
    sb('voluntarios?select=*&order=nome'),
    sb('eventos?select=*&order=data'),
    sb(`notificacoes?vol_id=eq.${currentProfile.id}&select=*&order=criado_em.desc`),
    sb('niveis_acesso?select=*&order=nome')
  ]);
  ministerios = (m||[]).map(r => ({...r, ministerios: r.ministerios || [], inscritos: [], convites: []}));
  voluntarios = (v||[]).map(r => ({...r, ministerios: r.ministerios || []}));
  eventos = (e||[]).map(r => ({...r, ministerios: r.ministerios||[], inscritos: r.inscritos||[], convites: r.convites||[]}));
  notificacoes = (n||[]);
  niveisAcesso = (niv||[]);
  atualizarBadgeNotif();
  atualizarSelectNiveis();
}

function showFirstAccess() {
  showScreen('login');
  document.getElementById('login-form-area').style.display = 'none';
  document.getElementById('first-access-form').style.display = 'block';
  document.getElementById('first-notice').style.display = 'block';
  document.getElementById('nova-senha').value = '';
  document.getElementById('conf-senha').value = '';
  const errEl = document.getElementById('first-access-error');
  if (errEl) errEl.style.display = 'none';
  const btn = document.getElementById('btn-first-access');
  if (btn) { btn.innerHTML = '<i class="ti ti-check"></i>Definir senha e entrar'; btn.disabled = false; }
}

// ===== LOGIN =====
async function doLogin() {
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const senha = document.getElementById('login-senha').value;
  const err = document.getElementById('login-error');
  err.style.display = 'none';
  if (!email || !senha) { err.textContent = 'Preencha email e senha.'; err.style.display = 'block'; return; }
  const btn = document.getElementById('btn-login');
  btn.innerHTML = '<span class="spin"></span> Entrando...'; btn.disabled = true;
  try {
    // Verificar nas credenciais do sistema (senha hash SHA-256)
    const hash = await sha256(senha);
    const rows = await sb(`voluntarios?email=eq.${encodeURIComponent(email)}&senha_hash=eq.${hash}&select=*`);
    if (!rows || !rows.length) {
      err.textContent = 'Email ou senha incorretos.'; err.style.display = 'block';
      btn.innerHTML = '<i class="ti ti-login"></i>Entrar'; btn.disabled = false; return;
    }
    // Criar sessão simples (sem OAuth)
    session = { access_token: SUPA_KEY, user: { id: rows[0].id } };
    localStorage.setItem('igreja_session', JSON.stringify(session));
    currentProfile = rows[0];
    if (currentProfile.primeiro_acesso) { showFirstAccess(); btn.innerHTML = '<i class="ti ti-login"></i>Entrar'; btn.disabled = false; return; }
    await loadAllData();
    showScreen('app');
    updateSidebar();
    checkMobileLayout();
    navigate('dashboard');
  } catch(e) {
    err.textContent = 'Erro ao entrar: ' + e.message; err.style.display = 'block';
  }
  btn.innerHTML = '<i class="ti ti-login"></i>Entrar'; btn.disabled = false;
}

async function saveNewPassword() {
  const nova = document.getElementById('nova-senha').value;
  const conf = document.getElementById('conf-senha').value;
  const errEl = document.getElementById('first-access-error');
  if (errEl) errEl.style.display = 'none';

  if (nova.length < 6) {
    mostraErroPrimeiroAcesso('A senha deve ter pelo menos 6 caracteres.');
    return;
  }
  if (nova !== conf) {
    mostraErroPrimeiroAcesso('As senhas não coincidem. Tente novamente.');
    return;
  }

  const btn = document.getElementById('btn-first-access');
  if (btn) { btn.innerHTML = '<span class="spin"></span> Salvando...'; btn.disabled = true; }

  try {
    const hash = await sha256(nova);

    // Tentar PATCH direto via fetch com a anon key
    const res = await fetch(`${SUPA_URL}/rest/v1/voluntarios?id=eq.${currentProfile.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': 'Bearer ' + SUPA_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ senha_hash: hash, primeiro_acesso: false })
    });

    if (!res.ok) {
      const errData = await res.json().catch(()=>({}));
      throw new Error(errData.message || errData.hint || `Erro HTTP ${res.status}`);
    }

    // Sucesso - atualizar estado local
    currentProfile.senha_hash = hash;
    currentProfile.primeiro_acesso = false;
    session = { access_token: SUPA_KEY, user: { id: currentProfile.id } };
    localStorage.setItem('igreja_session', JSON.stringify(session));

    await loadAllData();

    document.getElementById('first-access-form').style.display = 'none';
    document.getElementById('first-notice').style.display = 'none';
    document.getElementById('login-form-area').style.display = 'block';
    showScreen('app');
    updateSidebar();
    checkMobileLayout();
    navigate('dashboard');

  } catch(e) {
    mostraErroPrimeiroAcesso('Erro ao salvar senha: ' + e.message);
    if (btn) { btn.innerHTML = '<i class="ti ti-check"></i>Definir senha e entrar'; btn.disabled = false; }
  }
}

function mostraErroPrimeiroAcesso(msg) {
  const errEl = document.getElementById('first-access-error');
  if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
  else { alert(msg); }
}

function voltarParaLogin() {
  currentProfile = null;
  document.getElementById('first-access-form').style.display = 'none';
  document.getElementById('first-notice').style.display = 'none';
  document.getElementById('login-form-area').style.display = 'block';
  document.getElementById('login-error').style.display = 'none';
  document.getElementById('login-senha').value = '';
  const btn = document.getElementById('btn-login');
  btn.innerHTML = '<i class="ti ti-login"></i>Entrar'; btn.disabled = false;
}

function doLogout() {
  session = null; currentProfile = null;
  localStorage.removeItem('igreja_session');
  document.getElementById('sidebar').classList.remove('mobile-open','collapsed');
  document.getElementById('sidebar-overlay').classList.remove('open');
  sidebarCollapsed = false;
  document.getElementById('toggle-icon').className = 'ti ti-layout-sidebar-left-collapse';
  document.getElementById('login-form-area').style.display = 'block';
  document.getElementById('first-access-form').style.display = 'none';
  document.getElementById('first-notice').style.display = 'none';
  document.getElementById('login-error').style.display = 'none';
  const faErr = document.getElementById('first-access-error');
  if (faErr) faErr.style.display = 'none';
  document.getElementById('login-email').value = '';
  document.getElementById('login-senha').value = '';
  const btn = document.getElementById('btn-login');
  btn.innerHTML = '<i class="ti ti-login"></i>Entrar'; btn.disabled = false;
  showScreen('login');
}

// SHA-256 simples para senhas
async function sha256(msg) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
