// ===== PEQUENOS GRUPOS - área pública (sem login) =====
const PGPUB_DIAS = ['Todos','Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const PGPUB_CENTRO = { lat: -22.9099, lng: -47.0626 }; // Campinas/SP

let pgsPublicos = [];
let pgPublicoDiaAtivo = 'Todos';
let pgPublicoMap = null, pgPublicoMarkers = null, pgPublicoCarregado = false;
let pgPublicoMinhaLoc = null, pgPublicoMeuMarker = null;

// Quem já está logado (ex: usou o atalho "Pequenos Grupos" no menu, sem precisar sair da conta)
// volta pro app; só quem chegou pela tela inicial (sem sessão) volta pra lá.
function voltarDaAreaPg() {
  showScreen(currentProfile ? 'app' : 'gate');
}

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
  renderPgsPublico(true);
}

function montarChipsDia() {
  const el = document.getElementById('pgpub-dia-chips');
  if (el.childElementCount) return; // já montado
  el.innerHTML = PGPUB_DIAS.map(d => `<button type="button" class="pgpub-chip${d==='Todos'?' active':''}" data-dia="${d}">${d}</button>`).join('');
  el.querySelectorAll('.pgpub-chip').forEach(btn => {
    btn.onclick = () => { pgPublicoDiaAtivo = btn.dataset.dia; renderPgsPublico(true); };
  });
}

function pgPublicoSetView(view) {
  document.getElementById('pgpub-btn-mapa').classList.toggle('active', view === 'mapa');
  document.getElementById('pgpub-btn-lista').classList.toggle('active', view === 'lista');
  document.getElementById('pgpub-mapview').style.display = view === 'mapa' ? 'block' : 'none';
  document.getElementById('pgpub-listview').style.display = view === 'lista' ? 'grid' : 'none';
  if (view === 'mapa' && pgPublicoMap) setTimeout(() => {
    pgPublicoMap.invalidateSize();
    // Se o filtro mudou enquanto a lista estava aberta, enquadra agora que o mapa tem tamanho
    if (!pgPublicoMapaAjustado) { pgPublicoEnquadrarTodos(); pgPublicoDesenharMarcadores(); }
  }, 50);
}


function pgPublicoDistanciaKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pgPublicoStatusBusca(msg, classe) {
  const el = document.getElementById('pgpub-busca-status');
  el.textContent = msg;
  el.className = 'pgpub-busca-status' + (classe ? ' ' + classe : '');
}

// Busca client-side e temporária: o endereço digitado só vira coordenadas pra desenhar um
// pino de comparação no mapa; nada disso é salvo em lugar nenhum, some ao sair da página.
async function buscarMeuEnderecoPg() {
  const input = document.getElementById('pgpub-busca-input');
  const valor = input.value.trim();
  if (!valor) { pgPublicoStatusBusca('', ''); return; }

  pgPublicoStatusBusca('Procurando...', '');
  try {
    const query = pgCompletarQueryEstadoSP(valor);
    const { lat, lng, nome } = await pgGeocodificarEndereco(query);
    pgPublicoMinhaLoc = { lat, lng };

    if (pgPublicoMeuMarker) pgPublicoMap.removeLayer(pgPublicoMeuMarker);
    pgPublicoMeuMarker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: '',
        html: '<div class="pgpub-meu-pin"><div class="pgpub-meu-dot"></div><div class="pgpub-meu-label">Você está aqui</div></div>',
        iconSize: [1, 1], iconAnchor: [0, 0]
      }),
      zIndexOffset: 1000
    }).addTo(pgPublicoMap);
    pgPublicoMapaAjustado = true; // o mapa fica centrado no endereço buscado, não reenquadra
    pgPublicoMap.setView([lat, lng], 13);
    pgPublicoSetView('mapa');

    document.getElementById('pgpub-busca-limpar').style.display = 'flex';
    pgPublicoStatusBusca('📍 ' + nome, 'ok');
    renderPgsPublico();
  } catch (e) {
    pgPublicoStatusBusca('Não encontramos esse endereço. Tente outro bairro ou CEP.', 'erro');
  }
}

function limparMinhaLocalizacaoPg() {
  pgPublicoMinhaLoc = null;
  if (pgPublicoMeuMarker && pgPublicoMap) { pgPublicoMap.removeLayer(pgPublicoMeuMarker); pgPublicoMeuMarker = null; }
  document.getElementById('pgpub-busca-input').value = '';
  document.getElementById('pgpub-busca-limpar').style.display = 'none';
  pgPublicoStatusBusca('', '');
  renderPgsPublico();
}

function renderPgsPublico(enquadrar) {
  if (!pgPublicoCarregado) return;
  const el = document.getElementById('pgpub-dia-chips');
  el.querySelectorAll('.pgpub-chip').forEach(c => c.classList.toggle('active', c.dataset.dia === pgPublicoDiaAtivo));

  const filtrados = pgsPublicos.filter(p => pgPublicoDiaAtivo === 'Todos' || p.dia_semana === pgPublicoDiaAtivo);

  try { renderPgPublicoMapa(filtrados, enquadrar); } catch (e) { console.error('Falha ao renderizar o mapa dos PGs:', e); }
  renderPgPublicoLista(filtrados);
}

// Medidas da etiqueta de nome (precisam bater com .pgpub-pin-label / .pgpub-pin-stack no CSS)
const PGPUB_LABEL_FONTE = '700 11px "Work Sans", sans-serif';
const PGPUB_LABEL_ALTURA = 19;     // altura de uma etiqueta
const PGPUB_LABEL_GAP = 3;         // espaço entre etiquetas empilhadas
const PGPUB_LABEL_PADX = 18;       // padding horizontal somado (9px de cada lado)
const PGPUB_LABEL_OFFSET_Y = 10;   // a pilha começa logo abaixo do ponto
const PGPUB_LABEL_FOLGA = 4;       // distância mínima entre duas pilhas

let pgPublicoListaMapa = [];
let pgPublicoMapaAjustado = false;
let pgPublicoCanvasMedida = null;

function pgPublicoLarguraTexto(txt) {
  if (!pgPublicoCanvasMedida) pgPublicoCanvasMedida = document.createElement('canvas').getContext('2d');
  pgPublicoCanvasMedida.font = PGPUB_LABEL_FONTE;
  // +6px de margem caso a fonte web ainda não tenha carregado na hora da medida
  return pgPublicoCanvasMedida.measureText(txt).width + PGPUB_LABEL_PADX + 6;
}

// Lados onde a pilha de nomes pode ficar em relação ao ponto, em ordem de preferência
const PGPUB_LADOS = ['baixo', 'cima', 'direita', 'esquerda'];

// Caixa (em pixels de tela) ocupada pela pilha de nomes de um grupo, num dos lados do ponto
function pgPublicoCaixaGrupo(g, lado) {
  const w = Math.max(...g.itens.map(i => i.largura));
  const h = g.itens.length * PGPUB_LABEL_ALTURA + (g.itens.length - 1) * PGPUB_LABEL_GAP;
  const o = PGPUB_LABEL_OFFSET_Y;
  if (lado === 'cima')     return { left: g.x - w / 2, right: g.x + w / 2, top: g.y - o - h, bottom: g.y - o };
  if (lado === 'direita')  return { left: g.x + o, right: g.x + o + w, top: g.y - h / 2, bottom: g.y + h / 2 };
  if (lado === 'esquerda') return { left: g.x - o - w, right: g.x - o, top: g.y - h / 2, bottom: g.y + h / 2 };
  return { left: g.x - w / 2, right: g.x + w / 2, top: g.y + o, bottom: g.y + o + h };
}

function pgPublicoCaixasColidem(a, b) {
  const f = PGPUB_LABEL_FOLGA;
  return a.left < b.right + f && b.left < a.right + f && a.top < b.bottom + f && b.top < a.bottom + f;
}

// Monta as pilhas de nomes do zoom atual sem nenhuma sobreposição:
// 1) PGs no mesmo lugar já começam juntos, numa pilha só, com os nomes em sequência;
// 2) cada pilha tenta ficar abaixo, acima, à direita ou à esquerda do seu ponto, de preferência
//    sem cobrir o ponto de outro PG;
// 3) se não couber em lado nenhum, junta com a pilha vizinha mais próxima e recomeça.
function pgPublicoAgruparEtiquetas(lista) {
  let grupos = [];
  lista.forEach(p => {
    const pt = pgPublicoMap.latLngToLayerPoint([p.lat, p.lng]);
    const item = { p, largura: pgPublicoLarguraTexto(p.nome), x: pt.x, y: pt.y };
    const mesmoLugar = grupos.find(g => Math.abs(g.x - pt.x) < 3 && Math.abs(g.y - pt.y) < 3);
    if (mesmoLugar) mesmoLugar.itens.push(item);
    else grupos.push({ x: pt.x, y: pt.y, itens: [item] });
  });
  const pontos = grupos.map(g => ({ x: g.x, y: g.y, g }));

  for (;;) {
    const ordem = [...grupos].sort((a, b) => b.itens.length - a.itens.length || a.y - b.y);
    const colocados = [];
    let semLugar = null;
    for (const g of ordem) {
      const livreDeNomes = PGPUB_LADOS.filter(l => colocados.every(c => !pgPublicoCaixasColidem(pgPublicoCaixaGrupo(g, l), c.caixa)));
      const livreDePontos = livreDeNomes.filter(l => {
        const cx = pgPublicoCaixaGrupo(g, l);
        return pontos.every(pt => pt.g === g || g.itens.some(i => i.x === pt.x && i.y === pt.y) ||
          !pgPublicoCaixasColidem(cx, { left: pt.x - 6, right: pt.x + 6, top: pt.y - 6, bottom: pt.y + 6 }));
      });
      const lado = livreDePontos[0] || livreDeNomes[0];
      if (!lado) { semLugar = g; break; }
      g.lado = lado;
      colocados.push({ g, caixa: pgPublicoCaixaGrupo(g, lado) });
    }
    if (!semLugar) break;

    // Junta com a pilha já colocada mais próxima (a nova pilha fica no meio das duas)
    let alvo = null, menor = Infinity;
    colocados.forEach(c => {
      const d = Math.hypot(c.g.x - semLugar.x, c.g.y - semLugar.y);
      if (d < menor) { menor = d; alvo = c.g; }
    });
    const na = alvo.itens.length, nb = semLugar.itens.length;
    const junto = { x: (alvo.x * na + semLugar.x * nb) / (na + nb), y: (alvo.y * na + semLugar.y * nb) / (na + nb), itens: [...alvo.itens, ...semLugar.itens] };
    grupos = grupos.filter(g => g !== alvo && g !== semLugar).concat(junto);
  }
  grupos.forEach(g => g.itens.sort((a, b) => a.p.nome.localeCompare(b.p.nome, 'pt-BR')));
  return grupos;
}

function pgPublicoDesenharMarcadores() {
  if (!pgPublicoMap) return;
  pgPublicoMarkers.clearLayers();
  const lista = pgPublicoListaMapa;

  // Ponto de cada PG na sua posição real
  lista.forEach(p => {
    L.marker([p.lat, p.lng], {
      icon: L.divIcon({ className: '', html: '<div class="pgpub-pin-dot"></div>', iconSize: [1, 1], iconAnchor: [0, 0] })
    }).on('click', () => abrirDetalhePg(p.id)).addTo(pgPublicoMarkers);
  });

  // Uma pilha de nomes por grupo, no lado escolhido do ponto (ou do centro, se juntou vizinhos)
  pgPublicoAgruparEtiquetas(lista).forEach(g => {
    const pos = pgPublicoMap.layerPointToLatLng([g.x, g.y]);
    const nomes = g.itens.map(i => `<div class="pgpub-pin-label" data-pg="${i.p.id}">${i.p.nome}</div>`).join('');
    L.marker(pos, {
      icon: L.divIcon({ className: '', html: `<div class="pgpub-pin-stack ${g.lado}">${nomes}</div>`, iconSize: [1, 1], iconAnchor: [0, 0] }),
      zIndexOffset: 500
    }).on('click', e => {
      const alvo = e.originalEvent && e.originalEvent.target.closest('[data-pg]');
      if (alvo) abrirDetalhePg(alvo.dataset.pg);
    }).addTo(pgPublicoMarkers);
  });
}

// Enquadra o mapa pra mostrar todos os PGs de uma vez
function pgPublicoEnquadrarTodos() {
  const lista = pgPublicoListaMapa;
  if (!pgPublicoMap || !lista.length) return;
  // Mapa escondido (vista de lista): sem tamanho não dá pra enquadrar; faz ao voltar pro mapa
  if (!document.getElementById('pgpub-mapview').offsetHeight) { pgPublicoMapaAjustado = false; return; }
  pgPublicoMap.invalidateSize();
  if (lista.length === 1) {
    pgPublicoMap.setView([lista[0].lat, lista[0].lng], 14);
  } else {
    // Mais folga embaixo/dos lados por causa das etiquetas, que ficam abaixo do ponto
    // Folga nas bordas pros nomes (que ficam ao lado do ponto) e, embaixo, pro aviso de
    // "pontos aproximados", que fica por cima do mapa
    const aviso = document.querySelector('#pgpub-mapview .pgpub-map-caption');
    const folgaAviso = aviso ? aviso.offsetHeight + 24 : 40;
    pgPublicoMap.fitBounds(L.latLngBounds(lista.map(p => [p.lat, p.lng])), {
      paddingTopLeft: [80, 40], paddingBottomRight: [80, Math.max(60, folgaAviso + 30)], maxZoom: 15
    });
  }
}

function renderPgPublicoMapa(lista, enquadrar) {
  if (!pgPublicoMap) {
    pgPublicoMap = L.map('pgpub-mapview').setView([PGPUB_CENTRO.lat, PGPUB_CENTRO.lng], 12);
    // Base simplificada (sem detalhe de ruas) + camada só com os nomes (bairro/cidade) por cima -
    // dá uma noção da região e do bairro, sem virar um mapa detalhado o suficiente pra apontar
    // exatamente onde é.
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri', maxZoom: 16
    }).addTo(pgPublicoMap);
    const camadaRotulos = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 16
    }).addTo(pgPublicoMap);
    pgPublicoMarkers = L.layerGroup().addTo(pgPublicoMap);

    // Rótulos do próprio mapa (rua/bairro) ajudam na visão geral, mas de perto eles colidem
    // com a tarja de nome de cada PG. Some com eles quando o zoom aproxima o suficiente pra
    // mostrar rótulo de rua - nesse ponto a tarja do PG já é a informação que importa.
    const ZOOM_LIMITE_ROTULOS_MAPA = 14;
    pgPublicoMap.on('zoomend', () => {
      const dentroDoLimite = pgPublicoMap.getZoom() <= ZOOM_LIMITE_ROTULOS_MAPA;
      if (dentroDoLimite && !pgPublicoMap.hasLayer(camadaRotulos)) camadaRotulos.addTo(pgPublicoMap);
      if (!dentroDoLimite && pgPublicoMap.hasLayer(camadaRotulos)) pgPublicoMap.removeLayer(camadaRotulos);
      // A distância entre os pontos na tela muda com o zoom: refaz as pilhas de nomes
      pgPublicoDesenharMarcadores();
    });
    // Quando a fonte das etiquetas terminar de carregar, mede de novo (largura muda um pouco)
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => pgPublicoDesenharMarcadores());
  }

  pgPublicoListaMapa = lista.filter(p => p.lat != null && p.lng != null);
  // Na primeira abertura e a cada troca de filtro de dia, enquadra todos os PGs visíveis
  if (enquadrar || !pgPublicoMapaAjustado) {
    pgPublicoMapaAjustado = true;
    pgPublicoEnquadrarTodos();
  }
  pgPublicoDesenharMarcadores();

  setTimeout(() => pgPublicoMap.invalidateSize(), 50);
}

function renderPgPublicoLista(lista) {
  const el = document.getElementById('pgpub-listview');
  if (!lista.length) { el.innerHTML = '<p style="font-size:13px;color:var(--pg-muted-2);text-align:center;padding:20px">Nenhum PG encontrado para esse dia.</p>'; return; }

  let itens = lista;
  if (pgPublicoMinhaLoc) {
    itens = lista.map(p => ({
      ...p,
      _dist: (p.lat != null && p.lng != null) ? pgPublicoDistanciaKm(pgPublicoMinhaLoc.lat, pgPublicoMinhaLoc.lng, p.lat, p.lng) : null
    })).sort((a, b) => (a._dist ?? Infinity) - (b._dist ?? Infinity));
  }

  el.innerHTML = itens.map(p => `
    <div class="pgpub-card" onclick="abrirDetalhePg('${p.id}')">
      <div>
        <h3>${p.nome}</h3>
        <p>${p.bairro || '—'} · ${p.dia_semana || '—'}${p.horario ? ' às ' + p.horario.slice(0,5) : ''}${p.tema ? ' · ' + p.tema : ''}${p._dist != null ? ' · ~' + p._dist.toFixed(1) + 'km de você' : ''}</p>
      </div>
      <i class="ti ti-chevron-right" style="color:var(--pg-muted);font-size:18px;flex-shrink:0"></i>
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
