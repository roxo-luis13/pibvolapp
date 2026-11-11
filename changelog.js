// ===== NOVIDADES DO APP (aviso de atualização) =====
// Toda vez que uma atualização for publicada (merge no main), adicione uma entrada NOVA
// no TOPO do array abaixo, com um id único (ex: a data + um apelido curto) e uma lista
// curta do que mudou. Quem já tinha o app aberto vê um aviso rápido na próxima vez que
// entrar, uma única vez por pessoa (controlado via localStorage, por aparelho).
const NOVIDADES = [
  {
    id: '2026-11-11-aviso-novidades',
    titulo: 'Novidades do app',
    itens: [
      'A partir de agora, quando o app receber uma atualização importante, você vai ver um aviso rápido como este, explicando o que mudou.',
    ],
  },
];

function verificarNovidades() {
  if (!currentProfile || !NOVIDADES.length) return;
  const ultima = NOVIDADES[0];
  let vistas = [];
  try { vistas = JSON.parse(localStorage.getItem('igreja_novidades_vistas') || '[]'); } catch (e) {}
  if (vistas.includes(ultima.id)) return;
  mostrarNovidade(ultima);
}

function mostrarNovidade(nov) {
  document.getElementById('novidade-titulo').textContent = nov.titulo;
  document.getElementById('novidade-lista').innerHTML = nov.itens.map(i => `<li>${i}</li>`).join('');
  document.getElementById('modal-novidade').dataset.id = nov.id;
  openModal('modal-novidade');
}

function fecharNovidade() {
  const id = document.getElementById('modal-novidade').dataset.id;
  let vistas = [];
  try { vistas = JSON.parse(localStorage.getItem('igreja_novidades_vistas') || '[]'); } catch (e) {}
  if (id && !vistas.includes(id)) {
    vistas.push(id);
    // Mantém só os últimos 30 ids vistos, sem acumular pra sempre no localStorage
    vistas = vistas.slice(-30);
    try { localStorage.setItem('igreja_novidades_vistas', JSON.stringify(vistas)); } catch (e) {}
  }
  closeModal('modal-novidade');
}
