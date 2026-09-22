// ===== LOGS DE ATIVIDADE =====
// ===== LOGS DE ATIVIDADE =====
// Registra uma ação do usuário no log de auditoria. Nunca deve travar a ação
// principal — se o log falhar, só reporta no console e segue o fluxo normal.
async function registrarLog(acao, entidade, entidadeNome, descricao) {
  if (!currentProfile) return;
  try {
    await sb('logs_atividade', {
      method: 'POST',
      prefer: 'return=minimal',
      body: JSON.stringify({
        ator_id: currentProfile.id,
        ator_nome: currentProfile.nome,
        acao,
        entidade,
        entidade_nome: entidadeNome || null,
        descricao
      })
    });
  } catch (e) { console.error('Falha ao registrar log de atividade:', e); }
}

const ICONES_LOG = {
  evento: 'ti-calendar-event',
  ministerio: 'ti-users-group',
  grupo_ministerio: 'ti-folder',
  voluntario: 'ti-user',
  nivel: 'ti-shield-lock',
  convite: 'ti-hand-stop',
  inscricao: 'ti-clipboard-check',
  perfil: 'ti-id',
  sessao: 'ti-login-2',
};

let logsAtividade = [];

async function renderLogs() {
  const container = document.getElementById('logs-lista');
  if (!container) return;
  container.innerHTML = '<div class="empty" style="padding:24px"><span class="spin" style="border-top-color:var(--text-secondary);border-color:rgba(0,0,0,.15)"></span></div>';

  const dataIni = document.getElementById('logs-data-ini')?.value;
  const dataFim = document.getElementById('logs-data-fim')?.value;
  const entidadeFiltro = document.getElementById('logs-entidade')?.value || '';

  let query = 'logs_atividade?select=*&order=criado_em.desc&limit=300';
  if (dataIni) query += `&criado_em=gte.${dataIni}T00:00:00`;
  if (dataFim) query += `&criado_em=lte.${dataFim}T23:59:59`;
  if (entidadeFiltro) query += `&entidade=eq.${entidadeFiltro}`;

  try {
    logsAtividade = (await sb(query)) || [];
  } catch (e) {
    container.innerHTML = `<div class="empty"><i class="ti ti-alert-triangle"></i>Erro ao carregar o log: ${e.message}</div>`;
    return;
  }

  if (!logsAtividade.length) {
    container.innerHTML = '<div class="empty"><i class="ti ti-list-search"></i>Nenhum registro encontrado para esse filtro.</div>';
    return;
  }

  container.innerHTML = logsAtividade.map(buildLinhaLog).join('');
}

function buildLinhaLog(l) {
  const d = new Date(l.criado_em);
  const dataFmt = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const horaFmt = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const icone = ICONES_LOG[l.entidade] || 'ti-file-text';
  return `<div style="display:flex;gap:10px;padding:10px 0;border-bottom:0.5px solid var(--border)">
    <i class="ti ${icone}" style="font-size:15px;color:var(--text-tertiary);flex-shrink:0;margin-top:2px"></i>
    <div style="flex:1;min-width:0">
      <p style="font-size:13px">${l.descricao}</p>
      <p style="font-size:11px;color:var(--text-tertiary);margin-top:2px">${dataFmt} às ${horaFmt}</p>
    </div>
  </div>`;
}
