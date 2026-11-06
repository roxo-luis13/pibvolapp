// ===== PEQUENOS GRUPOS - área pública (sem login) =====
const PGPUB_DIAS = ['Todos','Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const PGPUB_CENTRO = { lat: -22.9099, lng: -47.0626 }; // Campinas/SP

let pgsPublicos = [];
let pgPublicoDiaAtivo = 'Todos';
let pgPublicoMap = null, pgPublicoMarkers = null, pgPublicoCarregado = false;

async function abrirAreaPgPublica() {
  montarChipsDia();
  const empty = document.getElementById('pgpub-empty');
  try {
    pgsPublicos = (await sb('pequenos_grupos?select=*&ativo=eq.true&order=nome')) || [];
  } catch (e) {
    console.error('Falha ao carregar Pequenos Grupos:', e);
    pgsPublicos = [];
  }
  pgPublicoCarregado = true;
  empty.style.display = pgsPublicos.length ? 'none' : 'flex';
  renderPgsPublico();
}

function montarChipsDia() {
  const el = document.getElementById('pgpub-dia-chips');
  if (el.childElementCount) return; // já montado
  el.innerHTML = PGPUB_DIAS.map(d => `<button type="button" class="pgpub-chip${d==='Todos'?' active':''}" data-dia="${d}">${d}</button>`).join('');
  el.querySelectorAll('.pgpub-chip').forEach(btn => {
    btn.onclick = () => { pgPublicoDiaAtivo = btn.dataset.dia; renderPgsPublico(); };
  });
}

function pgPublicoSetView(view) {
  document.getElementById('pgpub-btn-mapa').classList.toggle('active', view === 'mapa');
  document.getElementById('pgpub-btn-lista').classList.toggle('active', view === 'lista');
  document.getElementById('pgpub-mapview').style.display = view === 'mapa' ? 'block' : 'none';
  document.getElementById('pgpub-listview').style.display = view === 'lista' ? 'grid' : 'none';
  if (view === 'mapa' && pgPublicoMap) setTimeout(() => pgPublicoMap.invalidateSize(), 50);
}

function pgPublicoBadgeTexto(v) { return v === 'aberto' ? 'Vagas abertas' : v === 'quase' ? 'Quase lotado' : 'Lotado'; }
function pgPublicoCorVaga(v) { return v === 'aberto' ? '#2F7DE1' : v === 'quase' ? '#FFC93C' : '#E4362B'; }

function renderPgsPublico() {
  if (!pgPublicoCarregado) return;
  const el = document.getElementById('pgpub-dia-chips');
  el.querySelectorAll('.pgpub-chip').forEach(c => c.classList.toggle('active', c.dataset.dia === pgPublicoDiaAtivo));

  const filtrados = pgsPublicos.filter(p => pgPublicoDiaAtivo === 'Todos' || p.dia_semana === pgPublicoDiaAtivo);

  try { renderPgPublicoMapa(filtrados); } catch (e) { console.error('Falha ao renderizar o mapa dos PGs:', e); }
  renderPgPublicoLista(filtrados);
}

function renderPgPublicoMapa(lista) {
  if (!pgPublicoMap) {
    pgPublicoMap = L.map('pgpub-mapview').setView([PGPUB_CENTRO.lat, PGPUB_CENTRO.lng], 12);
    // Base simplificada (sem detalhe de ruas) + camada só com os nomes (bairro/cidade) por cima -
    // dá uma noção da região e do bairro, sem virar um mapa detalhado o suficiente pra apontar
    // exatamente onde é.
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri', maxZoom: 16
    }).addTo(pgPublicoMap);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 16
    }).addTo(pgPublicoMap);
    pgPublicoMarkers = L.layerGroup().addTo(pgPublicoMap);
  }
  pgPublicoMarkers.clearLayers();

  lista.forEach(p => {
    if (p.lat == null || p.lng == null) return;
    const cor = pgPublicoCorVaga(p.vaga);
    const marker = L.marker([p.lat, p.lng], {
      icon: L.divIcon({
        className: '',
        html: `<div class="pgpub-pin-wrap"><div class="pgpub-pin-dot" style="background:${cor}"></div><div class="pgpub-pin-label" style="background:${cor}">${p.nome}</div></div>`,
        iconSize: [1, 1], iconAnchor: [0, 0]
      })
    }).addTo(pgPublicoMarkers);
    marker.on('click', () => abrirDetalhePg(p.id));
  });

  setTimeout(() => pgPublicoMap.invalidateSize(), 50);
}

function renderPgPublicoLista(lista) {
  const el = document.getElementById('pgpub-listview');
  if (!lista.length) { el.innerHTML = '<p style="font-size:13px;color:var(--pg-muted-2);text-align:center;padding:20px">Nenhum PG encontrado para esse dia.</p>'; return; }
  el.innerHTML = lista.map(p => `
    <div class="pgpub-card" onclick="abrirDetalhePg('${p.id}')">
      <div>
        <h3>${p.nome}</h3>
        <p>${p.bairro || '—'} · ${p.dia_semana || '—'}${p.horario ? ' às ' + p.horario.slice(0,5) : ''}${p.tema ? ' · ' + p.tema : ''}</p>
      </div>
      <span class="pgpub-badge ${p.vaga}">${pgPublicoBadgeTexto(p.vaga)}</span>
    </div>`).join('');
}

function abrirDetalhePg(id) {
  const p = pgsPublicos.find(x => x.id === id);
  if (!p) return;
  document.getElementById('pgpub-d-tema').textContent = p.tema || 'Pequeno Grupo';
  document.getElementById('pgpub-d-nome').textContent = p.nome;
  document.getElementById('pgpub-d-host').textContent = p.anfitriao ? 'Recebe: ' + p.anfitriao : '';
  document.getElementById('pgpub-d-bairro').textContent = p.bairro || 'Bairro não informado';
  document.getElementById('pgpub-d-horario').textContent = (p.dia_semana || '—') + (p.horario ? ' às ' + p.horario.slice(0,5) : '');
  document.getElementById('pgpub-d-freq').textContent = p.frequencia || 'Semanal';
  document.getElementById('pgpub-d-part').textContent = (p.participantes || 0) + ' pessoas';
  document.getElementById('pgpub-d-vaga').textContent = pgPublicoBadgeTexto(p.vaga);
  document.getElementById('pgpub-d-desc').textContent = p.descricao || 'Sem descrição.';
  const cta = document.getElementById('pgpub-d-cta');
  const numero = (p.whatsapp || '').replace(/\D/g, '');
  if (numero) {
    cta.href = 'https://wa.me/' + numero + '?text=' + encodeURIComponent('Olá! Tenho interesse em participar do PG "' + p.nome + '"');
    cta.style.display = 'block';
  } else {
    cta.style.display = 'none';
  }
  document.getElementById('pgpub-overlay').classList.add('show');
  document.getElementById('pgpub-detail').classList.add('show');
}

function fecharDetalhePg() {
  document.getElementById('pgpub-overlay').classList.remove('show');
  document.getElementById('pgpub-detail').classList.remove('show');
}
