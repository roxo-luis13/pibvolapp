// ===== ASSISTENTE (IA) =====
// ===== ASSISTENTE (IA) =====
// Responde perguntas com base apenas nos dados que o usuário já tem acesso no app
// (o filtro por permissão é feito na Edge Function, com o mesmo token de sessão do app).

function abrirAssistente() {
  const painel = document.getElementById('assistente-painel');
  const fab = document.getElementById('assistente-fab');
  if (!painel || !fab) return;
  painel.style.display = 'flex';
  fab.classList.add('open');
  fab.innerHTML = '<i class="ti ti-x"></i>';
  setTimeout(() => document.getElementById('assistente-input')?.focus(), 50);
}

function fecharAssistente() {
  const painel = document.getElementById('assistente-painel');
  const fab = document.getElementById('assistente-fab');
  if (!painel || !fab) return;
  painel.style.display = 'none';
  fab.classList.remove('open');
  fab.innerHTML = '<i class="ti ti-robot"></i>';
}

function toggleAssistente() {
  const painel = document.getElementById('assistente-painel');
  if (!painel) return;
  if (painel.style.display === 'flex') fecharAssistente();
  else abrirAssistente();
}

function assistenteAddMsg(texto, tipo) {
  const wrap = document.getElementById('assistente-mensagens');
  if (!wrap) return null;
  const div = document.createElement('div');
  div.className = 'assistente-msg ' + tipo;
  div.textContent = texto;
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
  return div;
}

async function enviarPerguntaAssistente() {
  const input = document.getElementById('assistente-input');
  const btn = document.getElementById('assistente-btn-enviar');
  if (!input || !btn) return;
  const pergunta = input.value.trim();
  if (!pergunta || input.disabled) return;

  input.value = '';
  input.disabled = true; btn.disabled = true;
  assistenteAddMsg(pergunta, 'user');
  const loadingEl = assistenteAddMsg('Pensando...', 'loading');

  try {
    const resp = await fetch(`${SUPA_URL}/functions/v1/assistente-ia`, {
      method: 'POST',
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': 'Bearer ' + (session?.access_token || SUPA_KEY),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ pergunta })
    });
    const data = await resp.json().catch(() => ({}));
    if (loadingEl) loadingEl.remove();
    if (!resp.ok) {
      assistenteAddMsg(data.error || 'Não consegui responder agora. Tente novamente.', 'erro');
    } else {
      assistenteAddMsg(data.resposta || 'Não consegui gerar uma resposta.', 'bot');
    }
  } catch (e) {
    if (loadingEl) loadingEl.remove();
    assistenteAddMsg('Erro de conexão. Verifique sua internet e tente de novo.', 'erro');
  }

  input.disabled = false; btn.disabled = false; input.focus();
}
