// ===== AUTENTICAÇÃO =====
let pendingLoginEmail = null, pendingSenhaHash = null; // guardam o email/hash usados no login enquanto o primeiro acesso não é concluído
// ===== INIT =====
async function init() {
  const saved = localStorage.getItem('igreja_session');
  if (saved) {
    try {
      const s = JSON.parse(saved);
      if (s?.user?.id) {
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
  ativarNotificacoesPush();
  // Restaurar última seção visitada
  let lastSec = 'dashboard';
  try {
    const saved = localStorage.getItem('igreja_last_section');
    if (saved && saved !== 'ministerio-detalhe') lastSec = saved;
  } catch(e) {}
  navigate(lastSec);
}

async function loadAllData() {
  const [m, v, e, n, niv, g] = await Promise.all([
    sb('ministerios?select=*&order=nome'),
    sb('voluntarios?select=*&order=nome'),
    sb('eventos?select=*&order=data'),
    sb(`notificacoes?vol_id=eq.${currentProfile.id}&select=*&order=criado_em.desc`),
    sb('niveis_acesso?select=*&order=nome'),
    sb('grupos_ministerios?select=*&order=nome')
  ]);
  ministerios = (m||[]).map(r => ({...r, ministerios: r.ministerios || [], inscritos: [], convites: []}));
  voluntarios = (v||[]).map(r => ({...r, ministerios: r.ministerios || []}));
  eventos = (e||[]).map(r => ({...r, ministerios: r.ministerios||[], inscritos: r.inscritos||[], convites: r.convites||[]}));
  notificacoes = (n||[]);
  niveisAcesso = (niv||[]);
  gruposMinisterios = (g||[]);
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
    // Verificar credenciais via Edge Function (emite um token assinado para as próximas requisições)
    const hash = await sha256(senha);
    const resp = await fetch(`${SUPA_URL}/functions/v1/login`, {
      method: 'POST',
      headers: { 'apikey': SUPA_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha_hash: hash })
    });
    const data = await resp.json();
    if (!resp.ok) {
      err.textContent = data.error || 'Email ou senha incorretos.'; err.style.display = 'block';
      btn.innerHTML = '<i class="ti ti-login"></i>Entrar'; btn.disabled = false; return;
    }
    if (data.primeiro_acesso) {
      pendingLoginEmail = email; pendingSenhaHash = hash;
      showFirstAccess();
      btn.innerHTML = '<i class="ti ti-login"></i>Entrar'; btn.disabled = false; return;
    }
    session = { access_token: data.token, user: { id: data.profile.id } };
    localStorage.setItem('igreja_session', JSON.stringify(session));
    currentProfile = data.profile;
    await loadAllData();
    showScreen('app');
    updateSidebar();
    checkMobileLayout();
    ativarNotificacoesPush();
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
  if (!pendingLoginEmail || !pendingSenhaHash) {
    mostraErroPrimeiroAcesso('Sessão expirada, faça login novamente.');
    voltarParaLogin();
    return;
  }

  const btn = document.getElementById('btn-first-access');
  if (btn) { btn.innerHTML = '<span class="spin"></span> Salvando...'; btn.disabled = true; }

  try {
    const novaSenhaHash = await sha256(nova);

    const resp = await fetch(`${SUPA_URL}/functions/v1/login`, {
      method: 'POST',
      headers: { 'apikey': SUPA_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: pendingLoginEmail, senha_hash: pendingSenhaHash, novaSenha_hash: novaSenhaHash })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Erro ao salvar senha.');

    session = { access_token: data.token, user: { id: data.profile.id } };
    localStorage.setItem('igreja_session', JSON.stringify(session));
    currentProfile = data.profile;
    pendingLoginEmail = null; pendingSenhaHash = null;

    await loadAllData();

    document.getElementById('first-access-form').style.display = 'none';
    document.getElementById('first-notice').style.display = 'none';
    document.getElementById('login-form-area').style.display = 'block';
    showScreen('app');
    updateSidebar();
    checkMobileLayout();
    ativarNotificacoesPush();
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
  pendingLoginEmail = null; pendingSenhaHash = null;
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

// ===== ESQUECI MINHA SENHA =====
function abrirEsqueciSenha() {
  document.getElementById('esqueci-email').value = document.getElementById('login-email').value || '';
  document.getElementById('esqueci-step-email').style.display = 'block';
  document.getElementById('esqueci-step-ok').style.display = 'none';
  document.getElementById('esqueci-error').style.display = 'none';
  const btn = document.getElementById('btn-esqueci-enviar');
  btn.innerHTML = '<i class="ti ti-key"></i>Gerar nova senha'; btn.disabled = false;
  openModal('modal-esqueci-senha');
}

async function gerarSenhaTemp() {
  const email = document.getElementById('esqueci-email').value.trim().toLowerCase();
  const errEl = document.getElementById('esqueci-error');
  errEl.style.display = 'none';
  if (!email) { errEl.textContent = 'Digite seu email.'; errEl.style.display = 'block'; return; }
  const btn = document.getElementById('btn-esqueci-enviar');
  btn.innerHTML = '<span class="spin"></span> Verificando...'; btn.disabled = true;
  try {
    const resp = await fetch(`${SUPA_URL}/functions/v1/forgot-password`, {
      method: 'POST',
      headers: { 'apikey': SUPA_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await resp.json();
    if (!resp.ok) {
      errEl.textContent = data.error || 'Erro ao gerar nova senha.';
      errEl.style.display = 'block';
      btn.innerHTML = '<i class="ti ti-key"></i>Gerar nova senha'; btn.disabled = false;
      return;
    }
    document.getElementById('esqueci-senha-temp').textContent = data.senhaTemp;
    document.getElementById('esqueci-step-email').style.display = 'none';
    document.getElementById('esqueci-step-ok').style.display = 'block';
  } catch(e) {
    errEl.textContent = 'Erro: ' + e.message;
    errEl.style.display = 'block';
    btn.innerHTML = '<i class="ti ti-key"></i>Gerar nova senha'; btn.disabled = false;
  }
}

async function copiarSenhaTemp() {
  const senha = document.getElementById('esqueci-senha-temp').textContent;
  try {
    await navigator.clipboard.writeText(senha);
    const btn = event.target.closest('button');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="ti ti-check"></i>Copiado!';
    setTimeout(() => btn.innerHTML = orig, 2000);
  } catch(e) { alert('Senha: ' + senha); }
}
