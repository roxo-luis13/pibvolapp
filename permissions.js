// ===== SISTEMA DE PERMISSÕES =====
// ===== SISTEMA DE PERMISSÕES =====
// Retorna o objeto de nível do usuário (da tabela niveis_acesso)
// Para níveis padrão sem registro na tabela, usa defaults hardcoded
function getNivelObj(nivel) {
  const n = niveisAcesso.find(n=>n.nome===nivel);
  if (n) return n;
  // Defaults para níveis padrão caso não estejam na tabela
  if (nivel === 'admin') return {
    pode_criar_ministerios:true, pode_editar_ministerios:true, pode_excluir_ministerios:true,
    pode_cadastrar_voluntarios:true, pode_editar_voluntarios:true,
    pode_criar_eventos:true, pode_editar_eventos:true, pode_ver_todos_ministerios:true
  };
  if (nivel === 'lider') return {
    pode_criar_ministerios:false, pode_editar_ministerios:false, pode_excluir_ministerios:false,
    pode_cadastrar_voluntarios:true, pode_editar_voluntarios:true,
    pode_criar_eventos:true, pode_editar_eventos:true, pode_ver_todos_ministerios:false
  };
  // voluntario e qualquer outro: sem permissões extras
  return {
    pode_criar_ministerios:false, pode_editar_ministerios:false, pode_excluir_ministerios:false,
    pode_cadastrar_voluntarios:false, pode_editar_voluntarios:false,
    pode_criar_eventos:false, pode_editar_eventos:false, pode_ver_todos_ministerios:false
  };
}

function perm(nivel, permissao) {
  return !!getNivelObj(nivel)[permissao];
}

function nivelIsAdmin(nivel) {
  const n = getNivelObj(nivel);
  // Admin = pode criar E excluir ministérios E criar eventos
  return n.pode_criar_ministerios && n.pode_excluir_ministerios && n.pode_criar_eventos;
}

function nivelIsLiderOuAdmin(nivel) {
  if (nivelIsAdmin(nivel)) return true;
  const n = getNivelObj(nivel);
  return n.pode_cadastrar_voluntarios || n.pode_editar_voluntarios ||
         n.pode_criar_eventos || n.pode_editar_eventos ||
         n.pode_criar_ministerios || n.pode_editar_ministerios;
}

function nivelPodeGerenciarEventos(nivel) {
  const n = getNivelObj(nivel);
  return n.pode_criar_eventos || n.pode_editar_eventos;
}

function nivelPodeGerenciarMinisterios(nivel) {
  const n = getNivelObj(nivel);
  return n.pode_criar_ministerios || n.pode_editar_ministerios || n.pode_excluir_ministerios;
}

function nivelPodeGerenciarVoluntarios(nivel) {
  const n = getNivelObj(nivel);
  return n.pode_cadastrar_voluntarios || n.pode_editar_voluntarios;
}
function getNivelLabel(nivel) {
  if (nivel === 'admin') return 'Administrador';
  if (nivel === 'lider') return 'Líder';
  if (nivel === 'voluntario') return 'Voluntário';
  const n = niveisAcesso.find(n=>n.nome===nivel);
  if (n) return n.nome.charAt(0).toUpperCase() + n.nome.slice(1).replace(/_/g,' ');
  return nivel;
}
function getNivelClass(nivel) {
  if (nivel === 'admin') return 'admin';
  if (nivel === 'lider') return 'lider';
  return 'voluntario'; // fallback para avatar/badge CSS
}
let ministerios = [], voluntarios = [], eventos = [], notificacoes = [];
let calYear = new Date().getFullYear(), calMonth = new Date().getMonth();
let selectedEvento = null, currentDetalheId = null;
let sidebarCollapsed = false;
let previewNivel = null; // null = normal mode, string = previewing as this nivel
const isMobile = () => window.innerWidth <= 768;
const ini = n => (n||'?').split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();
const canAccess = mId => {
  if (!currentProfile) return false;
  if (perm(getNivelAtivo(), 'pode_ver_todos_ministerios')) return true;
  if (nivelIsAdmin(getNivelAtivo())) return true;
  return (currentProfile.ministerios||[]).includes(mId);
};

function showScreen(s) {
  document.getElementById('loading-screen').style.display = s==='loading'?'flex':'none';
  document.getElementById('login-screen').style.display = s==='login'?'flex':'none';
  document.getElementById('main-app').classList.toggle('visible', s==='app');
}
