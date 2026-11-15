import { jwtVerify } from "npm:jose@5";
import { createClient } from "npm:@supabase/supabase-js@2";
import { responderSuporte } from "./suporte.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const JWT_SECRET = Deno.env.get("APP_JWT_SECRET") ?? "";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const GROQ_MODEL = Deno.env.get("GROQ_MODEL") || "openai/gpt-oss-120b";
// Modelo reserva: usado quando o modelo principal estoura o limite de tokens por minuto
// (TPM) da Groq, que no plano gratuito é bem apertado (ex: 8000 TPM no gpt-oss-120b).
const GROQ_MODEL_FALLBACK = Deno.env.get("GROQ_MODEL_FALLBACK") || "openai/gpt-oss-20b";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Locais válidos pro campo "locais" de um evento (um evento pode ter vários ao mesmo tempo).
const LOCAIS: Record<string, string> = {
  salao_principal: "Salão Principal",
  multiuso: "Multiuso",
  quadra: "Quadra",
  cozinha: "Cozinha",
  recepcao: "Recepção",
  espaco_1a_kids: "Espaço 1ªkids",
  estacionamento: "Estacionamento",
};

// Cache em memória (por instância "quente" da function) do modelo de reposição já
// resolvido, para não bater na lista de modelos da Groq a cada pergunta.
let modeloResolvidoCache: string | null = null;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}
function addDiasISO(iso: string, dias: number) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

// Normaliza texto pra comparação tolerante (sem acento, minúsculo, sem espaço nas pontas)
function normalizar(s: string): string {
  return (s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim();
}

// Extrai o tempo de espera sugerido pela Groq na mensagem de rate limit
// (ex: "Please try again in 5.7s"), com um teto curto pra não segurar a resposta demais.
function esperaSugeridaMs(msg: string | undefined): number {
  const m = /try again in ([\d.]+)s/i.exec(msg || "");
  const segundos = m ? parseFloat(m[1]) : 2.5;
  return Math.min(Math.max(segundos, 0.5), 6) * 1000;
}

// Chamada simples (sem ferramentas) usada pelo modo suporte, com a mesma estratégia de
// reserva do modo normal: estourou o limite por minuto -> tenta o modelo reserva -> espera e
// tenta de novo no principal.
async function chamarGroqSimples(messages: any[]) {
  async function chamar(modelo: string) {
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "authorization": `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({ model: modelo, max_tokens: 1400, temperature: 0.2, reasoning_effort: "low", messages }),
    });
    const data = await resp.json().catch(() => ({}));
    return { ok: resp.ok, data };
  }
  const principal = modeloResolvidoCache || GROQ_MODEL;
  let r = await chamar(principal);
  if (!r.ok && r.data?.error?.code === "rate_limit_exceeded" && GROQ_MODEL_FALLBACK !== principal) {
    r = await chamar(GROQ_MODEL_FALLBACK);
  }
  if (!r.ok && r.data?.error?.code === "rate_limit_exceeded") {
    await new Promise((res) => setTimeout(res, esperaSugeridaMs(r.data?.error?.message)));
    r = await chamar(principal);
  }
  if (!r.ok && r.data?.error?.code === "model_not_found" && GROQ_MODEL_FALLBACK !== principal) {
    r = await chamar(GROQ_MODEL_FALLBACK);
  }
  return r;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não suportado." }, 405);
  if (!JWT_SECRET) return json({ error: "Servidor não configurado." }, 500);
  if (!GROQ_API_KEY) {
    return json({ error: "O assistente ainda não foi ativado. Peça ao administrador para configurar a chave de IA." }, 503);
  }

  // Autenticação: mesmo token assinado pela Edge Function de login (HS256, sub = id do voluntário)
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  let uid: string;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
    if (!payload.sub) throw new Error("token sem sub");
    uid = payload.sub;
  } catch {
    return json({ error: "Sessão inválida. Faça login novamente." }, 401);
  }

  const body = await req.json().catch(() => ({}));
  const pergunta = String(body?.pergunta || "").trim();
  if (!pergunta) return json({ error: "Envie uma pergunta." }, 400);
  if (pergunta.length > 600) return json({ error: "Pergunta muito longa. Tente ser mais direto." }, 400);

  // Histórico da conversa (mandado pelo cliente), só texto puro — sem o CONTEXTO embutido
  // de perguntas anteriores, pra não repetir o JSON várias vezes no prompt. Janela um pouco
  // maior que antes pra suportar diálogos de várias etapas (ex: juntando info pra um evento).
  const historicoBruto = Array.isArray(body?.historico) ? body.historico : [];
  const historico = historicoBruto
    .filter((h: any) => h && (h.role === "user" || h.role === "assistant") && typeof h.texto === "string")
    .slice(-12)
    .map((h: any) => ({ role: h.role, content: String(h.texto).slice(0, 1000) }));

  // Modo suporte técnico ("Voluntário IA"): base de problemas/soluções + roteiros, sem ações.
  if (body?.modo === "suporte") {
    try {
      const r = await responderSuporte({ supabase, pergunta, historico, chamarModelo: chamarGroqSimples });
      return json(r.body, r.status);
    } catch (e) {
      console.error(e);
      return json({ error: "Erro ao consultar o Voluntário IA. Tente novamente em instantes." }, 502);
    }
  }

  const hoje = hojeISO();

  const [euRes, todosRes, minsRes, niveisRes, eventosRes, presencaRes] = await Promise.all([
    supabase.from("voluntarios").select("id,nome,nivel,ministerios").eq("id", uid).maybeSingle(),
    supabase.from("voluntarios").select("id,nome,ministerios"),
    supabase.from("ministerios").select("id,nome,lider_id"),
    supabase.from("niveis_acesso").select("nome,pode_ver_todos_ministerios,pode_criar_eventos,pode_editar_eventos"),
    supabase
      .from("eventos")
      .select("id,nome,data,data_inicio,data_fim,hora,local,locais,live,som,ministerios,inscritos,convites,presencial,youtube")
      .gte("data_inicio", addDiasISO(hoje, -21))
      .lte("data_inicio", addDiasISO(hoje, 60))
      .order("data_inicio", { ascending: true })
      .limit(80),
    // Janela bem mais larga só pra estatística de presença (médias/totais por período),
    // já que perguntas tipo "média de presença em tal mês" podem cair fora da janela acima.
    // Usada só para calcular o resumo mensal (compacto) — o detalhe evento-a-evento mandado
    // pra IA é recortado bem mais curto logo abaixo, pra não estourar o limite de tokens da Groq.
    supabase
      .from("eventos")
      .select("nome,data,data_inicio,presencial,youtube")
      .or("presencial.not.is.null,youtube.not.is.null")
      .gte("data_inicio", addDiasISO(hoje, -365))
      .lte("data_inicio", hoje)
      .order("data_inicio", { ascending: true })
      .limit(400),
  ]);

  const eu = euRes.data;
  if (!eu) return json({ error: "Perfil não encontrado." }, 404);
  const todosVoluntarios = todosRes.data || [];
  const ministerios = minsRes.data || [];
  const niveis = niveisRes.data || [];
  const eventos = eventosRes.data || [];
  const presencaRows = presencaRes.data || [];

  // Locais efetivos de um evento: usa "locais" (array) se tiver, senão cai pro campo
  // antigo "local" (texto único), pra eventos criados antes dessa mudança.
  function locaisDoEvento(ev: any): string[] {
    if (ev.locais && ev.locais.length) return ev.locais;
    return ev.local ? [ev.local] : [];
  }

  const NIVEL_VE_TUDO_DEFAULT: Record<string, boolean> = {
    admin: true, pastor: true, lider: false, lider_de_banda: false, voluntario: false,
  };
  const NIVEL_GERENCIA_EVENTOS_DEFAULT: Record<string, boolean> = {
    admin: true, pastor: true, lider: true, lider_de_banda: true, voluntario: false,
  };
  const permRow = niveis.find((n) => n.nome === eu.nivel);
  const podeVerTudo = permRow ? !!permRow.pode_ver_todos_ministerios : !!NIVEL_VE_TUDO_DEFAULT[eu.nivel];
  // Mesmo grupo que já pode criar/editar evento na tela normal — usado tanto pra oferecer
  // as ações de evento quanto pra oferecer o envio de alerta (líder só alerta o próprio time,
  // verificado de novo dentro da RPC enviar_alerta_voluntario).
  const podeGerenciarEventos = permRow
    ? !!(permRow.pode_criar_eventos || permRow.pode_editar_eventos)
    : !!NIVEL_GERENCIA_EVENTOS_DEFAULT[eu.nivel];

  const nomeDe = (id: string) => todosVoluntarios.find((v) => v.id === id)?.nome || "Alguém";
  const minNome = (id: string) => ministerios.find((m) => m.id === id)?.nome || id;

  const meusMinIds: string[] = eu.ministerios || [];
  const minsQueLidero = ministerios.filter((m) => m.lider_id === uid).map((m) => m.id);
  const minsRelevantes = new Set([...meusMinIds, ...minsQueLidero]);

  function statusDoUsuarioNoEvento(ev: any): string | null {
    const insc = (ev.inscritos || []).find((i: any) => i.volId === uid);
    if (insc) return "confirmado" + (insc.minId ? ` no ministério ${minNome(insc.minId)}` : "");
    const conv = (ev.convites || []).find((c: any) => c.volId === uid);
    if (conv) return conv.status === "pendente" ? "convidado, ainda não respondeu" : conv.status;
    return null;
  }

  function resumoEquipe(ev: any, minIdsFiltro: string[] | null) {
    const confirmados = (ev.inscritos || [])
      .filter((i: any) => !minIdsFiltro || minIdsFiltro.includes(i.minId))
      .map((i: any) => nomeDe(i.volId));
    const pendentes = (ev.convites || [])
      .filter((c: any) => c.status === "pendente" && (!minIdsFiltro || minIdsFiltro.includes(c.minId)))
      .map((c: any) => nomeDe(c.volId));
    return { confirmados, pendentes };
  }

  const eventosCtx = eventos
    .filter((ev) => {
      if (podeVerTudo) return true;
      const tocaMeuMin = (ev.ministerios || []).some((m: string) => minsRelevantes.has(m));
      const souConvidado =
        (ev.inscritos || []).some((i: any) => i.volId === uid) || (ev.convites || []).some((c: any) => c.volId === uid);
      return tocaMeuMin || souConvidado;
    })
    .map((ev) => {
      const passado = (ev.data_inicio || ev.data) < hoje;
      const eq = resumoEquipe(ev, podeVerTudo ? null : [...minsRelevantes]);
      return {
        nome: ev.nome,
        data: ev.data_inicio || ev.data,
        hora: ev.hora,
        locais: locaisDoEvento(ev).map((l) => LOCAIS[l] || l),
        ministerios: (ev.ministerios || []).map(minNome),
        live: !!ev.live,
        som: !!ev.som,
        meu_status: statusDoUsuarioNoEvento(ev),
        confirmados: eq.confirmados,
        pendentes: eq.pendentes,
        presenca_presencial: passado ? ev.presencial ?? null : null,
        presenca_youtube: passado ? ev.youtube ?? null : null,
      };
    });

  const ministeriosCtx = (podeVerTudo ? ministerios : ministerios.filter((m) => minsRelevantes.has(m.id))).map((m) => ({
    nome: m.nome,
    lider: m.lider_id ? nomeDe(m.lider_id) : null,
    qtd_voluntarios: todosVoluntarios.filter((v) => (v.ministerios || []).includes(m.id)).length,
  }));

  // Estatística de presença: resumo por mês (compacto, cobre até 1 ano) sempre calculado
  // a partir de TODOS os registros buscados, mesmo que o detalhe evento-a-evento mandado
  // pra IA seja recortado a uma janela recente (ver JANELA_DETALHE_DIAS abaixo).
  const presencaDetalhada = presencaRows.map((ev) => ({
    data: ev.data_inicio || ev.data,
    nome: ev.nome,
    presencial: ev.presencial ?? null,
    youtube: ev.youtube ?? null,
  }));

  const media = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);
  const porMes = new Map<string, { presencial: number[]; youtube: number[] }>();
  for (const ev of presencaDetalhada) {
    const mes = ev.data.slice(0, 7);
    if (!porMes.has(mes)) porMes.set(mes, { presencial: [], youtube: [] });
    const bucket = porMes.get(mes)!;
    if (ev.presencial != null) bucket.presencial.push(ev.presencial);
    if (ev.youtube != null) bucket.youtube.push(ev.youtube);
  }
  const presencaPorMes = [...porMes.entries()].sort().map(([mes, v]) => ({
    mes,
    eventos_com_dados: Math.max(v.presencial.length, v.youtube.length),
    media_presencial: media(v.presencial),
    media_youtube: media(v.youtube),
    total_presencial: v.presencial.length ? v.presencial.reduce((a, b) => a + b, 0) : null,
    total_youtube: v.youtube.length ? v.youtube.reduce((a, b) => a + b, 0) : null,
  }));

  // Só o detalhe evento-a-evento dos últimos ~90 dias vai pra IA (pra períodos customizados
  // tipo "últimas 3 semanas"). Mandar 1 ano inteiro linha-a-linha estourava a cota de tokens
  // por minuto da Groq (TPM) e derrubava as respostas — inclusive as de acompanhamento.
  const JANELA_DETALHE_DIAS = 90;
  const presencaRecente = presencaDetalhada.filter((ev) => ev.data >= addDiasISO(hoje, -JANELA_DETALHE_DIAS));

  // Pessoas que esse usuário pode alertar/convidar pelo chat (mesmo escopo aplicado de novo,
  // de verdade, dentro da RPC enviar_alerta_voluntario e do resolvedor de convite abaixo —
  // isso aqui é só pra IA saber quem sugerir/reconhecer).
  const pessoasParaAlerta = podeGerenciarEventos
    ? todosVoluntarios
        .filter((v) => v.id !== uid && (podeVerTudo || (v.ministerios || []).some((m: string) => minsQueLidero.includes(m))))
        .map((v) => v.nome)
    : [];

  const contexto: Record<string, unknown> = {
    hoje,
    usuario: { nome: eu.nome, ministerios: meusMinIds.map(minNome) },
    ministerios: ministeriosCtx,
    eventos: eventosCtx,
    locais_disponiveis: Object.values(LOCAIS),
    presenca_resumo_por_mes: presencaPorMes,
    presenca_por_evento_recente: presencaRecente,
  };
  if (podeVerTudo) contexto.total_voluntarios = todosVoluntarios.length;
  if (podeGerenciarEventos) contexto.pessoas_para_alerta = pessoasParaAlerta;

  // Texto das regras de ação encurtado pra gastar menos tokens por pergunta — cada
  // ferramenta/descrição extra conta no limite de tokens/min da Groq.
  const systemPrompt =
    "Você é o assistente do app de voluntários de uma igreja. Responda SOMENTE com base no CONTEXTO JSON fornecido " +
    "na mensagem do usuário e no histórico da conversa — nunca invente dados que não estejam lá. Se a resposta não " +
    "estiver no contexto, diga educadamente que não tem essa informação disponível. Para perguntas sobre presença " +
    "(médias, totais, comparações em um período), use 'presenca_resumo_por_mes' (cobre até 12 meses, use quando o " +
    "período pedido bater com um ou mais meses inteiros), ou calcule a partir de 'presenca_por_evento_recente' " +
    "(eventos dos últimos ~90 dias, evento por evento) para períodos personalizados recentes — filtre pela data e " +
    "calcule a média/soma você mesmo. Se pedirem um período customizado mais antigo que 90 dias, use apenas o " +
    "resumo mensal disponível para estimar, e avise que o detalhe exato desse período não está disponível. " +
    "Leve em conta as perguntas e respostas anteriores da conversa para entender perguntas de acompanhamento " +
    "(ex: 'e no mês passado?'), inclusive em pedidos de várias etapas. Responda em português do Brasil, de forma " +
    "direta e breve (no máximo 3-4 frases). Não mencione a palavra 'contexto' nem mostre JSON na resposta. " +
    "Se perguntarem sobre problema técnico de som, transmissão ou multimídia, diga que o 'Voluntário IA' da aba " +
    "Suporte técnico é quem ajuda com isso.\n\n" +
    (podeGerenciarEventos ?
      "Você também pode PROPOR ações com as ferramentas disponíveis (criar evento, editar evento, convidar " +
      "voluntários pra um evento, enviar alerta) — só chame quando já tiver todas as infos; senão pergunte, uma de " +
      "cada vez. Criar evento exige nome, data e horário; banda é obrigatória, use 'A Definir' se não souberem. Um " +
      "evento pode usar mais de um local ao mesmo tempo — 'locais' é sempre uma lista, mesmo com um só valor; use " +
      "nomes exatos de 'locais_disponiveis'. Pra editar ou convidar voluntários, use nome e data EXATOS do evento no " +
      "CONTEXTO; se houver mais de um parecido, pergunte qual. Pra convidar um MINISTÉRIO INTEIRO, chame a ferramenta " +
      "só com ministerio_nome — o sistema já sabe quem são os integrantes, NUNCA pergunte ao usuário quem é do " +
      "ministério. Use 'nomes' só quando ele pedir pessoas específicas, fora de um ministério inteiro. Alerta: " +
      "destinatário tem que estar em 'pessoas_para_alerta'. Você só PROPÕE — nunca diga que já fez algo; quem " +
      "confirma a ação é a pessoa, num cartão na tela."
      : "Esse usuário não tem permissão pra criar/editar evento nem mandar alerta pelo chat. Se pedir, diga rapidamente " +
      "que só um admin ou líder pode fazer isso.");

  const userMessage = `CONTEXTO:\n${JSON.stringify(contexto)}\n\nPERGUNTA: ${pergunta}`;

  const LOCAIS_IDS = Object.keys(LOCAIS);

  const tools: any[] = [];
  if (podeGerenciarEventos) {
    tools.push({
      type: "function",
      function: {
        name: "propor_criar_evento",
        description: "Propõe criar um evento novo. Só chame com nome, data e horário já confirmados.",
        parameters: {
          type: "object",
          properties: {
            nome: { type: "string" },
            data_inicio: { type: "string", description: "YYYY-MM-DD" },
            data_fim: { type: "string", description: "YYYY-MM-DD, só se durar mais de 1 dia" },
            hora_inicio: { type: "string", description: "HH:MM" },
            hora_fim: { type: "string", description: "HH:MM" },
            locais: { type: "array", items: { type: "string", enum: LOCAIS_IDS }, description: "um ou mais locais; vazio/omitido se não foi dito" },
            live: { type: "boolean" },
            som: { type: "boolean" },
            banda: { type: "string", description: "ou 'A Definir'" },
            descricao: { type: "string" },
          },
          required: ["nome", "data_inicio", "hora_inicio", "hora_fim", "banda"],
        },
      },
    });
    tools.push({
      type: "function",
      function: {
        name: "propor_editar_evento",
        description: "Propõe editar um evento existente (no CONTEXTO). Só preencha os campos que mudam.",
        parameters: {
          type: "object",
          properties: {
            evento_nome_atual: { type: "string", description: "nome exato, como no CONTEXTO" },
            evento_data_atual: { type: "string", description: "YYYY-MM-DD, como no CONTEXTO" },
            nome: { type: "string" },
            data_inicio: { type: "string" },
            data_fim: { type: "string" },
            hora_inicio: { type: "string" },
            hora_fim: { type: "string" },
            locais: { type: "array", items: { type: "string", enum: LOCAIS_IDS }, description: "substitui os locais atuais do evento por esta lista" },
            live: { type: "boolean" },
            som: { type: "boolean" },
            banda: { type: "string" },
            descricao: { type: "string" },
          },
          required: ["evento_nome_atual", "evento_data_atual"],
        },
      },
    });
    tools.push({
      type: "function",
      function: {
        name: "propor_convidar_voluntarios",
        description: "Propõe convidar voluntários pra um evento existente (no CONTEXTO). Pra convidar um ministério inteiro, informe SOMENTE ministerio_nome — o sistema já sabe os integrantes automaticamente, não precisa perguntar os nomes. Use 'nomes' só pra pessoas específicas.",
        parameters: {
          type: "object",
          properties: {
            evento_nome_atual: { type: "string", description: "nome exato, como no CONTEXTO" },
            evento_data_atual: { type: "string", description: "YYYY-MM-DD, como no CONTEXTO" },
            ministerio_nome: { type: "string", description: "nome exato de um ministério no CONTEXTO — convida automaticamente TODOS os integrantes dele" },
            nomes: { type: "array", items: { type: "string" }, description: "nomes específicos a convidar (sem ser um ministério inteiro)" },
          },
          required: ["evento_nome_atual", "evento_data_atual"],
        },
      },
    });
    tools.push({
      type: "function",
      function: {
        name: "propor_alerta",
        description: "Propõe enviar um alerta pra uma pessoa específica, da lista pessoas_para_alerta.",
        parameters: {
          type: "object",
          properties: {
            destinatario_nome: { type: "string" },
            mensagem: { type: "string" },
          },
          required: ["destinatario_nome", "mensagem"],
        },
      },
    });
  }

  async function chamarGroq(modelo: string) {
    const reqBody: Record<string, unknown> = {
      model: modelo,
      // Os modelos disponíveis (gpt-oss, qwen3) são "raciocinadores": gastam parte do
      // limite de tokens pensando antes de escrever a resposta final. Precisa de folga
      // e de esforço de raciocínio baixo pra sobrar espaço pra resposta em si.
      max_tokens: 1400,
      temperature: 0.3,
      reasoning_effort: "low",
      messages: [
        { role: "system", content: systemPrompt },
        ...historico,
        { role: "user", content: userMessage },
      ],
    };
    if (tools.length) { reqBody.tools = tools; reqBody.tool_choice = "auto"; }
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "authorization": `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify(reqBody),
    });
    const data = await resp.json();
    return { ok: resp.ok, data };
  }

  // Modelos que existem na conta mas não servem para chat de texto simples
  // (agentes com ferramentas, classificadores de segurança, áudio, etc.)
  function naoEhChatGeral(id: string): boolean {
    const bloqueados = ["compound", "guard", "safeguard", "whisper", "tts", "moderation", "embed", "vision", "prompt-guard"];
    const idMin = id.toLowerCase();
    return bloqueados.some((b) => idMin.includes(b));
  }

  // Escolhe um modelo de reposição caso GROQ_MODEL tenha sido descontinuado/renomeado
  // (a Groq muda a lista de modelos disponíveis de tempos em tempos).
  async function escolherModeloDisponivel(): Promise<string | null> {
    try {
      const resp = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { authorization: `Bearer ${GROQ_API_KEY}` },
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      const ids: string[] = (data?.data || []).map((m: any) => m.id).filter(Boolean);
      console.error("Modelos Groq disponíveis nesta conta:", ids.join(", "));
      const preferencia = [
        "llama-3.3-70b-versatile",
        "llama-3.1-70b-versatile",
        "llama-3.1-8b-instant",
        "llama3-70b-8192",
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
        "qwen/qwen3-32b",
        "moonshotai/kimi-k2-instruct",
        "gemma2-9b-it",
      ];
      const preferido = preferencia.find((p) => ids.includes(p));
      if (preferido) return preferido;
      const candidatos = ids.filter((id) => !naoEhChatGeral(id));
      return candidatos[0] || ids[0] || null;
    } catch {
      return null;
    }
  }

  // ===== Resolução das ações propostas pela IA (nunca confia em id vindo do modelo —
  // sempre resolve nome -> id comparando contra as listas já carregadas no servidor) =====

  function formatarDataBR(iso: string): string {
    const d = new Date(iso + "T12:00:00");
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-BR");
  }

  function encontrarEvento(nomeAtual: string, dataAtual: string) {
    const nomeAlvo = normalizar(nomeAtual || "");
    const dataAlvo = String(dataAtual || "").trim();
    if (!nomeAlvo || !dataAlvo) return { erro: "Preciso saber qual evento (nome e data)." };
    const candidatos = eventos.filter((ev: any) =>
      normalizar(ev.nome) === nomeAlvo && (ev.data_inicio || ev.data) === dataAlvo
    );
    if (candidatos.length === 0) return { erro: `Não encontrei nenhum evento "${nomeAtual}" em ${formatarDataBR(dataAlvo)}.` };
    if (candidatos.length > 1) return { erro: `Encontrei mais de um evento "${nomeAtual}" em ${formatarDataBR(dataAlvo)}. Pode especificar melhor?` };
    return { ev: candidatos[0], dataAlvo };
  }

  function resolverCriarEvento(args: any) {
    const nome = String(args?.nome || "").trim();
    const data_inicio = String(args?.data_inicio || "").trim();
    const hora_inicio = String(args?.hora_inicio || "").trim();
    const hora_fim = String(args?.hora_fim || "").trim();
    const banda = String(args?.banda || "").trim();
    if (!nome || !data_inicio || !hora_inicio || !hora_fim || !banda) {
      return { erro: "Preciso do nome, data, horário de início/fim e da formação da banda (pode ser 'A Definir') pra criar o evento." };
    }
    const locaisValidos: string[] = Array.isArray(args?.locais) ? args.locais.filter((l: any) => LOCAIS_IDS.includes(l)) : [];
    const dados = {
      nome, data_inicio,
      data_fim: args?.data_fim ? String(args.data_fim).trim() : null,
      hora_inicio, hora_fim,
      locais: locaisValidos,
      live: !!args?.live, som: !!args?.som,
      banda,
      descricao: args?.descricao ? String(args.descricao).trim() : "",
    };
    const resumo = `Vou criar o evento "${dados.nome}" em ${formatarDataBR(dados.data_inicio)}` +
      (dados.data_fim ? ` até ${formatarDataBR(dados.data_fim)}` : "") +
      `, das ${dados.hora_inicio} às ${dados.hora_fim}` +
      (locaisValidos.length ? `, em ${locaisValidos.map((l) => LOCAIS[l]).join(" + ")}` : "") +
      `. Banda: ${dados.banda}.` + (dados.live ? " Com transmissão ao vivo." : "") + (dados.som ? " Com uso de som." : "") +
      " Posso confirmar a criação?";
    return { acao: { tipo: "criar_evento", dados }, resposta: resumo };
  }

  function resolverEditarEvento(args: any) {
    const achado = encontrarEvento(args?.evento_nome_atual, args?.evento_data_atual);
    if (achado.erro) return { erro: achado.erro };
    const { ev, dataAlvo } = achado;
    const dados: Record<string, unknown> = { evento_id: ev.id };
    const mudancas: string[] = [];
    if (args?.nome && args.nome.trim() && args.nome.trim() !== ev.nome) { dados.nome = args.nome.trim(); mudancas.push(`nome para "${dados.nome}"`); }
    if (args?.data_inicio) { dados.data_inicio = String(args.data_inicio).trim(); mudancas.push(`data de início para ${formatarDataBR(dados.data_inicio as string)}`); }
    if (args?.data_fim !== undefined && args.data_fim !== null && String(args.data_fim).trim()) { dados.data_fim = String(args.data_fim).trim(); mudancas.push(`data de término para ${formatarDataBR(dados.data_fim as string)}`); }
    if (args?.hora_inicio) { dados.hora_inicio = String(args.hora_inicio).trim(); mudancas.push(`horário de início para ${dados.hora_inicio}`); }
    if (args?.hora_fim) { dados.hora_fim = String(args.hora_fim).trim(); mudancas.push(`horário de término para ${dados.hora_fim}`); }
    if (Array.isArray(args?.locais)) {
      const locaisValidos = args.locais.filter((l: any) => LOCAIS_IDS.includes(l));
      dados.locais = locaisValidos;
      mudancas.push(locaisValidos.length ? `locais para ${locaisValidos.map((l: string) => LOCAIS[l]).join(" + ")}` : "remover todos os locais");
    }
    if (typeof args?.live === "boolean") { dados.live = args.live; mudancas.push(args.live ? "ativar transmissão ao vivo" : "desativar transmissão ao vivo"); }
    if (typeof args?.som === "boolean") { dados.som = args.som; mudancas.push(args.som ? "ativar uso de som" : "desativar uso de som"); }
    if (args?.banda && args.banda.trim()) { dados.banda = args.banda.trim(); mudancas.push(`banda para "${dados.banda}"`); }
    if (args?.descricao !== undefined && String(args.descricao).trim()) { dados.descricao = String(args.descricao).trim(); mudancas.push("a programação"); }
    if (!mudancas.length) {
      return { erro: `O que você quer mudar no evento "${ev.nome}" (${formatarDataBR(dataAlvo)})?` };
    }
    const resumo = `Vou atualizar o evento "${ev.nome}" (${formatarDataBR(dataAlvo)}): ${mudancas.join(", ")}. Posso confirmar?`;
    return { acao: { tipo: "editar_evento", dados }, resposta: resumo };
  }

  function resolverConvidarVoluntarios(args: any) {
    const achado = encontrarEvento(args?.evento_nome_atual, args?.evento_data_atual);
    if (achado.erro) return { erro: achado.erro };
    const { ev, dataAlvo } = achado;

    const minNomeArg = String(args?.ministerio_nome || "").trim();
    const nomesArg: string[] = Array.isArray(args?.nomes) ? args.nomes.filter((n: any) => typeof n === "string" && n.trim()) : [];
    if (!minNomeArg && !nomesArg.length) {
      return { erro: "Preciso saber quem convidar: um ministério inteiro ou nomes específicos." };
    }

    // Mesmo pool de pessoas que esse usuário pode alertar/escalar: admin/pastor veem todo
    // mundo; líder/líder de banda só quem está nos ministérios dele.
    const poolPermitido = podeVerTudo
      ? todosVoluntarios
      : todosVoluntarios.filter((v) => (v.ministerios || []).some((m: string) => minsRelevantes.has(m)));

    let ministerioAlvoId: string | null = null;
    const alvos = new Map<string, { volId: string; nome: string; minId: string | null }>();

    if (minNomeArg) {
      const minNorm = normalizar(minNomeArg);
      const minObj = ministerios.find((m) => normalizar(m.nome) === minNorm);
      if (!minObj) return { erro: `Não encontrei o ministério "${minNomeArg}".` };
      if (!podeVerTudo && !minsRelevantes.has(minObj.id)) {
        return { erro: `Você não pode convidar em nome do ministério "${minNomeArg}".` };
      }
      ministerioAlvoId = minObj.id;
      for (const v of poolPermitido) {
        if ((v.ministerios || []).includes(minObj.id)) alvos.set(v.id, { volId: v.id, nome: v.nome, minId: minObj.id });
      }
      if (!alvos.size) return { erro: `Não encontrei voluntários no ministério "${minNomeArg}".` };
    }

    const naoEncontrados: string[] = [];
    for (const nomeBruto of nomesArg) {
      const alvoNorm = normalizar(nomeBruto);
      const achadoVol = poolPermitido.find((v) => normalizar(v.nome) === alvoNorm);
      if (!achadoVol) { naoEncontrados.push(nomeBruto); continue; }
      if (!alvos.has(achadoVol.id)) {
        const minsDoVol = (achadoVol.ministerios || []).filter((m: string) => podeVerTudo || minsRelevantes.has(m));
        alvos.set(achadoVol.id, { volId: achadoVol.id, nome: achadoVol.nome, minId: minsDoVol.length === 1 ? minsDoVol[0] : null });
      }
    }

    if (!alvos.size) {
      return { erro: `Não encontrei ninguém pra convidar${naoEncontrados.length ? ` (não achei: ${naoEncontrados.join(", ")})` : ""}.` };
    }

    const jaConvidados = new Set((ev.convites || []).map((c: any) => c.volId));
    const todosAlvos = [...alvos.values()];
    const novos = todosAlvos.filter((c) => !jaConvidados.has(c.volId));
    const jaEstavam = todosAlvos.filter((c) => jaConvidados.has(c.volId));

    if (!novos.length) {
      return { erro: `${todosAlvos.map((c) => c.nome).join(", ")} já está(ão) convidado(s) pra esse evento.` };
    }

    let resumo = `Vou convidar ${novos.map((c) => c.nome).join(", ")} pro evento "${ev.nome}" (${formatarDataBR(dataAlvo)}).`;
    if (jaEstavam.length) resumo += ` (${jaEstavam.map((c) => c.nome).join(", ")} já estava(m) convidado(s), vou pular.)`;
    if (naoEncontrados.length) resumo += ` Não encontrei: ${naoEncontrados.join(", ")}.`;
    resumo += " Posso confirmar?";

    return {
      acao: {
        tipo: "convidar_voluntarios",
        dados: {
          evento_id: ev.id,
          convidados: novos.map(({ volId, nome, minId }) => ({ volId, nome, minId })),
          ministerio_a_adicionar: ministerioAlvoId,
        },
      },
      resposta: resumo,
    };
  }

  function resolverAlerta(args: any) {
    const mensagem = String(args?.mensagem || "").trim();
    const nomeAlvo = normalizar(args?.destinatario_nome || "");
    if (!nomeAlvo || !mensagem) {
      return { erro: "Preciso do nome de quem vai receber o alerta e da mensagem." };
    }
    if (!podeGerenciarEventos) {
      return { erro: "Você não tem permissão para enviar alertas." };
    }
    const candidatos = todosVoluntarios.filter((v) => {
      if (v.id === uid) return false;
      if (normalizar(v.nome) !== nomeAlvo) return false;
      return podeVerTudo || (v.ministerios || []).some((m: string) => minsQueLidero.includes(m));
    });
    if (candidatos.length === 0) {
      return { erro: `Não encontrei "${args.destinatario_nome}" entre as pessoas que você pode alertar.` };
    }
    if (candidatos.length > 1) {
      return { erro: `Encontrei mais de uma pessoa chamada "${args.destinatario_nome}". Pode especificar melhor (ex: sobrenome)?` };
    }
    const dest = candidatos[0];
    const resumo = `Vou enviar esse alerta pra ${dest.nome}: "${mensagem}". Posso confirmar?`;
    return { acao: { tipo: "alerta", dados: { destinatario_id: dest.id, destinatario_nome: dest.nome, mensagem } }, resposta: resumo };
  }

  function resolverAcao(nome: string, argsStr: string) {
    let args: any = {};
    try { args = JSON.parse(argsStr || "{}"); } catch { /* ignora args malformados */ }
    if (nome === "propor_criar_evento") return resolverCriarEvento(args);
    if (nome === "propor_editar_evento") return resolverEditarEvento(args);
    if (nome === "propor_convidar_voluntarios") return resolverConvidarVoluntarios(args);
    if (nome === "propor_alerta") return resolverAlerta(args);
    return { erro: "Ação desconhecida." };
  }

  try {
    const modeloPrincipal = modeloResolvidoCache || GROQ_MODEL;
    let { ok, data } = await chamarGroq(modeloPrincipal);

    if (!ok && data?.error?.code === "model_not_found") {
      const alternativo = await escolherModeloDisponivel();
      if (alternativo && alternativo !== modeloPrincipal) {
        console.error(`Modelo ${modeloPrincipal} indisponível, tentando ${alternativo}`);
        ({ ok, data } = await chamarGroq(alternativo));
        if (ok) modeloResolvidoCache = alternativo;
      }
    }

    // Limite de tokens por minuto estourado: tenta uma vez com o modelo reserva, sem
    // fixar essa troca pra sempre (a cota do modelo principal libera de novo em instantes).
    if (!ok && data?.error?.code === "rate_limit_exceeded" && GROQ_MODEL_FALLBACK !== modeloPrincipal) {
      console.error(`Modelo ${modeloPrincipal} com limite de tokens/min atingido, tentando ${GROQ_MODEL_FALLBACK}`);
      ({ ok, data } = await chamarGroq(GROQ_MODEL_FALLBACK));
    }

    // Se AINDA estiver com rate limit (os dois modelos ocupados ao mesmo tempo, ex: testes
    // em sequência rápida), espera o tempo que a própria Groq sugeriu e tenta mais uma vez
    // no modelo principal, em vez de já devolver erro pro usuário.
    if (!ok && data?.error?.code === "rate_limit_exceeded") {
      const espera = esperaSugeridaMs(data?.error?.message);
      console.error(`Ainda com limite de tokens/min atingido, esperando ${espera}ms e tentando de novo`);
      await new Promise((r) => setTimeout(r, espera));
      ({ ok, data } = await chamarGroq(modeloPrincipal));
    }

    if (!ok) {
      console.error("Erro Groq:", data);
      const mensagemErro = data?.error?.code === "rate_limit_exceeded"
        ? "O assistente está sendo bastante usado agora. Espera uns segundos e tenta de novo."
        : "Erro ao consultar o assistente. Tente novamente em instantes.";
      return json({ error: mensagemErro }, 502);
    }

    const msg = data?.choices?.[0]?.message;
    const toolCall = msg?.tool_calls?.[0];
    if (toolCall?.function?.name) {
      const resolvido = resolverAcao(toolCall.function.name, toolCall.function.arguments);
      if (resolvido.erro) return json({ resposta: resolvido.erro });
      return json({ resposta: resolvido.resposta, acao: resolvido.acao });
    }

    const resposta = msg?.content?.trim();
    if (!resposta) {
      console.error("Resposta vazia da Groq:", JSON.stringify(data));
      return json({ resposta: "Não consegui gerar uma resposta. Tente perguntar de novo." });
    }
    return json({ resposta });
  } catch (e) {
    console.error(e);
    return json({ error: "Erro ao consultar o assistente. Tente novamente em instantes." }, 502);
  }
});
