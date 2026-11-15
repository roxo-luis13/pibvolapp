// ===== MODO SUPORTE TÉCNICO ("Voluntário IA") =====
// Responde dúvidas de som / transmissão / multimídia usando SOMENTE a base de problemas
// aprovados (tabela suporte_problemas) e os roteiros de ligar/desligar
// (tabela suporte_procedimentos). Se não houver nada parecido, diz que não tem registro
// — o app então pede pro voluntário registrar o problema e a solução quando resolver.

const SISTEMAS: Record<string, string> = {
  som: "Som",
  transmissao: "Transmissão",
  multimidia: "Multimídia",
  outro: "Outro",
};

const LOCAIS_SUPORTE: Record<string, string> = {
  salao_principal: "Salão Principal",
};

type ChamarModelo = (messages: any[]) => Promise<{ ok: boolean; data: any }>;

export async function responderSuporte(opts: {
  supabase: any;
  pergunta: string;
  historico: { role: string; content: string }[];
  chamarModelo: ChamarModelo;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const { supabase, pergunta, historico, chamarModelo } = opts;

  const [probRes, procRes] = await Promise.all([
    supabase
      .from("suporte_problemas")
      .select("id,sistema,local,titulo,sintoma,solucao,resolvido,uteis,criado_em")
      .eq("status", "aprovado")
      .order("criado_em", { ascending: false })
      .limit(300),
    supabase.from("suporte_procedimentos").select("sistema,tipo,local,passos"),
  ]);

  const problemas = probRes.data || [];
  const procedimentos = procRes.data || [];

  // Referências curtas (P1, P2...) em vez de uuid: gasta menos token e o modelo erra menos.
  const refParaId = new Map<string, string>();
  const problemasCtx = problemas
    .sort((a: any, b: any) => (b.uteis?.length || 0) - (a.uteis?.length || 0))
    .map((p: any, i: number) => {
      const ref = `P${i + 1}`;
      refParaId.set(ref, p.id);
      return {
        ref,
        sistema: SISTEMAS[p.sistema] || p.sistema,
        local: LOCAIS_SUPORTE[p.local] || p.local,
        titulo: p.titulo,
        sintoma: String(p.sintoma || "").slice(0, 500),
        solucao: p.resolvido ? String(p.solucao || "").slice(0, 800) : null,
        sem_solucao_conhecida: !p.resolvido,
        confirmacoes_de_que_ajudou: p.uteis?.length || 0,
      };
    });

  const roteirosCtx = procedimentos
    .filter((r: any) => Array.isArray(r.passos) && r.passos.length)
    .map((r: any) => ({
      sistema: SISTEMAS[r.sistema] || r.sistema,
      tipo: r.tipo,
      local: LOCAIS_SUPORTE[r.local] || r.local,
      passos: r.passos.map((s: any, i: number) =>
        `${i + 1}. ${String(s?.texto || "").slice(0, 300)}${s?.alerta ? ` (ATENÇÃO: ${String(s.alerta).slice(0, 200)})` : ""}`
      ),
    }));

  const systemPrompt =
    "Você é o 'Voluntário IA', o suporte técnico de som, transmissão e multimídia de uma igreja. Responda SOMENTE " +
    "com base na BASE fornecida (problemas já resolvidos e aprovados pelos líderes, e roteiros de ligar/desligar). " +
    "NUNCA invente procedimento, botão, configuração ou solução que não esteja na BASE — um palpite errado pode " +
    "danificar equipamento ou derrubar a transmissão no meio do culto.\n" +
    "- Se encontrar um ou mais problemas parecidos, explique a solução em passos curtos e numerados, em português " +
    "do Brasil, e diga de qual registro veio (pelo título). Se houver mais de um caminho, comece pelo que tem mais " +
    "'confirmacoes_de_que_ajudou'.\n" +
    "- Se a pergunta for sobre ligar/desligar um sistema, use o roteiro correspondente.\n" +
    "- Se houver um registro parecido marcado 'sem_solucao_conhecida', avise que o problema já é conhecido mas ainda " +
    "não tem solução registrada.\n" +
    "- Se NÃO houver nada parecido na BASE, diga com sinceridade que ainda não há registro desse problema e que você " +
    "não tem o que sugerir; oriente a chamar o líder/responsável técnico e peça que, quando resolverem, registrem o " +
    "problema e a solução no app pra você aprender. Não dê dicas genéricas nesse caso.\n" +
    "- Se for uma pergunta de acompanhamento, use o histórico da conversa.\n" +
    "Seja direto (no máximo ~8 linhas). Não mencione 'BASE', 'JSON' nem os códigos P1/P2 no texto.\n" +
    "OBRIGATÓRIO: termine a resposta com uma última linha exatamente no formato 'FONTES: P1,P3' com as refs dos " +
    "problemas que você usou, 'FONTES: ROTEIRO' se usou só roteiro, ou 'FONTES: NENHUMA' se não achou nada parecido.";

  const base = { problemas: problemasCtx, roteiros: roteirosCtx };
  const userMessage = `BASE:\n${JSON.stringify(base)}\n\nPERGUNTA: ${pergunta}`;

  const { ok, data } = await chamarModelo([
    { role: "system", content: systemPrompt },
    ...historico,
    { role: "user", content: userMessage },
  ]);

  if (!ok) {
    console.error("Erro Groq (suporte):", data);
    const msg = data?.error?.code === "rate_limit_exceeded"
      ? "O Voluntário IA está sendo bastante usado agora. Espera uns segundos e tenta de novo."
      : "Erro ao consultar o Voluntário IA. Tente novamente em instantes.";
    return { status: 502, body: { error: msg } };
  }

  let texto = String(data?.choices?.[0]?.message?.content || "").trim();
  if (!texto) return { status: 200, body: { resposta: "Não consegui gerar uma resposta. Tente perguntar de novo.", encontrou: false, fontes: [] } };

  // Extrai e remove a linha FONTES: do final
  let fontesBrutas = "";
  const m = /\n?\s*FONTES:\s*([^\n]*)\s*$/i.exec(texto);
  if (m) {
    fontesBrutas = m[1].trim();
    texto = texto.slice(0, m.index).trim();
  }
  const refs = fontesBrutas.toUpperCase().split(/[\s,;]+/).filter((r) => /^P\d+$/.test(r));
  const fontes = [...new Set(refs.map((r) => refParaId.get(r)).filter(Boolean))] as string[];
  const usouRoteiro = /ROTEIRO/i.test(fontesBrutas);
  // Sem a linha FONTES (modelo esqueceu), assume que não achou — o app vai oferecer registrar.
  const encontrou = fontes.length > 0 || usouRoteiro;

  return { status: 200, body: { resposta: texto, encontrou, fontes } };
}
