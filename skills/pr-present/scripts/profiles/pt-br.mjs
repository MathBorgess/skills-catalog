// Brazilian Portuguese language profile for ste-lint.
//
// Grammar rules follow the principles of ABNT NBR ISO 24495-1 (relevant,
// findable, understandable, usable) and the plain-language style page of the
// Senado Federal. Both are paraphrased: the standard is a paid document and
// is never copied. The word list is our own.
// Senado page: https://www12.senado.leg.br/manualdecomunicacao/estilos/palavras-mais-simples
//
// A rule is an error only when its false-positive rate on ordinary technical
// prose is low. Heuristic rules are warnings.
//
// Shape: { id, grammar: [{ rule, severity, message, test(sentence, ctx) }], lexicon: [{ avoid, use, note? }] }.
// test() returns null, a sample string, { sample, message }, or an array of those.
// ctx = { lang, narration, glossaryTerms: Set<lowercase term>, state: {} }.

export const id = "pt-br";

const WORD = "\\p{L}\\p{N}_";
const wordRe = (source, flags = "giu") => new RegExp(`(?<![${WORD}])(?:${source})(?![${WORD}])`, flags);
const toSet = (text) => new Set(text.trim().split(/\s+/));

// ---------------------------------------------------------------------------
// Voz passiva analítica: a form of "ser", up to two adverbs, a participle.
// ---------------------------------------------------------------------------

const SER =
  "ser|sou|és|é|somos|são|era|eras|éramos|eram|fui|foi|fomos|foram|fora|serei|será|seremos|serão|seria|seriam|seja|sejam|fosse|fossem|for|forem|sido|sendo";
const GAP =
  "(?:\\s+(?:não|nunca|sempre|também|já|ainda|apenas|só|somente|então|depois|antes|\\p{L}+mente)){0,2}";
const PASSIVE = new RegExp(`(?<![${WORD}])(?:${SER})${GAP}\\s+(?=(\\p{L}+)(?![${WORD}]))`, "giu");
const AGENT = new RegExp(`^\\s+(?:por|pelo|pela|pelos|pelas)\\s+\\p{L}+`, "iu");

const IRREGULAR = toSet(`
  feito feita feitos feitas dito dita ditos ditas escrito escrita escritos escritas visto vista vistos vistas
  posto posta postos postas aberto aberta abertos abertas coberto coberta cobertos cobertas descoberto descoberta
  pago paga pagos pagas aceito aceita aceitos aceitas entregue entregues eleito eleita eleitos eleitas
  expresso expressa expressos expressas impresso impressa impressos impressas preso presa presos presas
  suspenso suspensa suspensos suspensas composto composta compostos compostas proposto proposta propostos
  propostas disposto disposta dispostos dispostas exposto exposta expostos expostas previsto prevista
  previstos previstas refeito refeita refeitos refeitas desfeito desfeita desfeitos desfeitas
  lido lida lidos lidas tido tida tidos tidas
`);

// Nouns and adjectives that end in -ado/-ido but are not passive participles.
const NOT_PARTICIPLE = toSet(`
  estado estados lado lados dado dados pedido pedidos sentido sentidos resultado resultados significado
  significados ruído ruídos partido partidos tecido tecidos vestido vestidos cuidado cuidados passado
  passados advogado advogada delegado delegada soldado deputado deputada mercado mercados cansado cansada
  obrigado obrigada
`);

function isParticiple(word) {
  const w = word.toLowerCase();
  if (NOT_PARTICIPLE.has(w)) return false;
  if (IRREGULAR.has(w)) return true;
  return /^\p{L}{2,}(?:ad|id)[oa]s?$/u.test(w);
}

function passiveVoice(sentence) {
  const hits = [];
  for (const m of sentence.matchAll(PASSIVE)) {
    if (!isParticiple(m[1])) continue;
    const end = m.index + m[0].length + m[1].length;
    const agent = sentence.slice(end).match(AGENT);
    hits.push(`${m[0]}${m[1]}${agent ? agent[0] : ""}`.replace(/\s+/g, " "));
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Gerundismo ("vai estar enviando") and the progressive ("está enviando").
// ---------------------------------------------------------------------------

const IR_AUX = "vou|vai|vamos|vão|irei|irá|iremos|irão|iria|iríamos|iriam";
const GERUND = "\\p{L}+(?:ando|endo|indo|ondo)";
const GERUND_NOT = toSet("quando comando mando bando brando");
const GERUNDISMO = new RegExp(`(?<![${WORD}])(?:${IR_AUX})\\s+estar\\s+(${GERUND})(?![${WORD}])`, "giu");
const ESTAR =
  "estou|está|estamos|estão|estava|estavam|estávamos|estive|esteve|estivemos|estiveram|estarei|estará|estaremos|estarão|estaria|estariam|estar";
const PROGRESSIVE = new RegExp(`(?<![${WORD}])(?:${ESTAR})\\s+(${GERUND})(?![${WORD}])`, "giu");
const IR_BEFORE = new RegExp(`(?<![${WORD}])(?:${IR_AUX})\\s+$`, "iu");

function gerundismo(sentence) {
  const hits = [];
  for (const m of sentence.matchAll(GERUNDISMO)) {
    if (!GERUND_NOT.has(m[1].toLowerCase())) hits.push(m[0].replace(/\s+/g, " "));
  }
  return hits;
}

function progressive(sentence) {
  const hits = [];
  for (const m of sentence.matchAll(PROGRESSIVE)) {
    if (GERUND_NOT.has(m[1].toLowerCase())) continue;
    // "vai estar enviando" belongs to the gerundismo rule.
    if (IR_BEFORE.test(sentence.slice(0, m.index))) continue;
    hits.push(m[0].replace(/\s+/g, " "));
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Passiva sintética or indeterminada with the enclitic "-se".
// ---------------------------------------------------------------------------

const ENCLITIC_SE = new RegExp(`(?<![${WORD}-])\\p{L}+-se(?![${WORD}-])`, "giu");

function syntheticPassive(sentence) {
  return [...sentence.matchAll(ENCLITIC_SE)].map((m) => m[0]);
}

// ---------------------------------------------------------------------------
// Nominalização: a light verb followed by a noun that holds the action.
// ---------------------------------------------------------------------------

const LIGHT_VERBS = [
  "realiz(?:ar|a|am|o|amos|ou|aram|ando|ado|ada|e|em|ava|avam|ará|arão|aria|ariam)",
  "efetu(?:ar|a|am|o|amos|ou|aram|ando|ado|ada|e|em|ava|avam|ará|arão|aria|ariam)",
  "fa(?:zer|z|zem|zemos|ço|ça|çam|zia|ziam|zendo|zido|ria|riam|rá|rão)|fez|fiz|fizemos|fizeram",
  "proced(?:er|e|em|o|eu|eram|endo|ido|ia|iam)",
  "promov(?:er|e|em|o|eu|eram|endo|ido|ia|iam)",
].join("|");

const NOMINALIZATION = wordRe(
  `(${LIGHT_VERBS})(?:\\s+(?:a|à|ao|aos|às|o|os|as|um|uma|de|da|do|das|dos|na|no)){0,2}\\s+(\\p{L}{3,}(?:ção|ções|mento|mentos))`,
);

const NOUN_TO_VERB = {
  execução: "executar",
  descrição: "descrever",
  inscrição: "inscrever",
  instrução: "instruir",
  construção: "construir",
  destruição: "destruir",
  tradução: "traduzir",
  produção: "produzir",
  redução: "reduzir",
  introdução: "introduzir",
  resolução: "resolver",
  recepção: "receber",
  correção: "corrigir",
  proteção: "proteger",
  detecção: "detectar",
  seleção: "selecionar",
  edição: "editar",
  eleição: "eleger",
  recebimento: "receber",
  conhecimento: "conhecer",
  atendimento: "atender",
  entendimento: "entender",
  crescimento: "crescer",
  esquecimento: "esquecer",
};

function verbFor(noun) {
  const n = noun.toLowerCase().replace(/ções$/, "ção").replace(/mentos$/, "mento");
  if (NOUN_TO_VERB[n]) return NOUN_TO_VERB[n];
  if (/ação$/.test(n)) return `${n.slice(0, -4)}ar`;
  if (/amento$/.test(n)) return `${n.slice(0, -6)}ar`;
  return null;
}

function nominalization(sentence) {
  return [...sentence.matchAll(NOMINALIZATION)].map((m) => {
    const verb = verbFor(m[2]);
    const fix = verb ? `use the verb "${verb}"` : `use the verb that gives the noun "${m[2]}"`;
    return { sample: m[0], message: `Nominalization "${m[0]}": ${fix}.` };
  });
}

// ---------------------------------------------------------------------------
// Negation: negative sentences warn, double negation is an error.
// ---------------------------------------------------------------------------

// "não só", "não apenas" and "não somente" add a point; they do not negate.
const NEGATION = wordRe("não(?!\\s+(?:só|apenas|somente)(?![\\p{L}\\p{N}_]))|nunca|nenhum|nenhuma|nenhuns|nenhumas|jamais|ninguém|nada");
const DOUBLE_NEGATION = wordRe(
  "(?:não(?!\\s+(?:só|apenas|somente)(?![\\p{L}\\p{N}_]))|nunca|jamais)(?:\\s+[\\p{L}\\p{N}'’-]+){0,5}?\\s+(?:nenhum|nenhuma|nenhuns|nenhumas|nunca|jamais|ninguém|nada)",
);

function doubleNegation(sentence) {
  return [...sentence.matchAll(DOUBLE_NEGATION)].map((m) => m[0].replace(/\s+/g, " "));
}

function negative(sentence) {
  // The error rule already covers a sentence with a double negation.
  if (doubleNegation(sentence).length > 0) return null;
  const first = sentence.match(NEGATION);
  return first ? first[0] : null;
}

// ---------------------------------------------------------------------------
// Siglas: an acronym needs its expansion on first use.
// ---------------------------------------------------------------------------

const ACRONYM = /(?<![\p{L}\p{N}_])\p{Lu}{2,6}s?(?![\p{L}\p{N}_])/gu;
const ACRONYM_OK = new Set(["OK", "TV", "PC"]);
const EXPANSION_AFTER = /^\s*(?:[(\[]|[-–—]\s)/;

function unexplainedAcronym(sentence, ctx = {}) {
  // Narration forbids acronyms outright, with its own error.
  if (ctx.narration) return null;
  // Shouted text has no lowercase letter: it is not a list of acronyms.
  if (!/\p{Ll}/u.test(sentence)) return null;
  const seen = ((ctx.state ??= {}).acronyms ??= new Set());
  const hits = [];
  for (const m of sentence.matchAll(ACRONYM)) {
    const sigla = m[0].replace(/s$/, "");
    if (ACRONYM_OK.has(sigla) || seen.has(sigla)) continue;
    seen.add(sigla);
    if (ctx.glossaryTerms?.has(sigla.toLowerCase())) continue;
    if (EXPANSION_AFTER.test(sentence.slice(m.index + m[0].length))) continue;
    if (sentence[m.index - 1] === "(") continue;
    hits.push({
      sample: m[0],
      message: `Acronym "${sigla}" is not explained on first use. Write the full name once, then the acronym in parentheses.`,
    });
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Qualificadores vagos.
// ---------------------------------------------------------------------------

const INTENSIFIER_BEM =
  "bem\\s+(?!como(?![\\p{L}\\p{N}_]))(?:mais|menos|maior|menor|pouc\\p{L}*|simples|rápid\\p{L}*|lent\\p{L}*|grandes?|pequen\\p{L}*|fáceis|fácil|difíceis|difícil|claro|clara|claros|claras|cedo|tarde|longe|perto|devagar|depressa|curt\\p{L}*|long\\p{L}*|alt\\p{L}*|baix\\p{L}*|\\p{L}+mente)";
const QUALIFIER = wordRe(`muit[oa]s?|bastantes?|extremamente|praticamente|basicamente|realmente|${INTENSIFIER_BEM}`);

function vagueQualifier(sentence) {
  return [...sentence.matchAll(QUALIFIER)].map((m) => ({
    sample: m[0].replace(/\s+/g, " "),
    message: `Vague qualifier "${m[0].replace(/\s+/g, " ")}". Give a number, a limit or a name instead.`,
  }));
}

// ---------------------------------------------------------------------------
// Grammar rules
// ---------------------------------------------------------------------------

export const grammar = [
  {
    rule: "voz-passiva",
    severity: "error",
    message: 'Passive voice with "ser". Make the actor the subject: write "O broker valida o pacote."',
    test: passiveVoice,
  },
  {
    rule: "gerundismo",
    severity: "error",
    message: 'Gerundismo ("vai estar enviando"). Use the simple verb: "enviará" or "vai enviar".',
    test: gerundismo,
  },
  {
    rule: "dupla-negacao",
    severity: "error",
    message: 'Double negation. Write the affirmative: "Todo pedido tem prazo", not "Nenhum pedido não tem prazo".',
    test: doubleNegation,
  },
  {
    rule: "progressivo",
    severity: "warning",
    message: 'Progressive with "estar" and a gerund. Use the simple tense: "o servidor envia", not "o servidor está enviando".',
    test: progressive,
  },
  {
    rule: "passiva-sintetica",
    severity: "warning",
    message: 'Passive with the enclitic "-se". Name the actor: "o sistema valida", not "valida-se".',
    test: syntheticPassive,
  },
  {
    rule: "nominalizacao",
    severity: "warning",
    message: "Nominalization. Use the verb that holds the action.",
    test: nominalization,
  },
  {
    rule: "frase-negativa",
    severity: "warning",
    message: "Negative sentence. Prefer the affirmative form.",
    test: negative,
  },
  {
    rule: "sigla-nao-explicada",
    severity: "warning",
    message: "Acronym not explained on first use.",
    test: unexplainedAcronym,
  },
  {
    rule: "qualificador-vago",
    severity: "warning",
    message: "Vague qualifier.",
    test: vagueQualifier,
  },
];

// ---------------------------------------------------------------------------
// Lexicon: our own plain-language replacements. `verb: true` also matches the
// regular inflections of the infinitive; `forms` lists exact forms instead.
// ---------------------------------------------------------------------------

const ENDINGS = {
  ar: "o as a amos am ei aste ou aram ava avas ávamos avam ado ada ados adas ando arei ará aremos arão aria ariam e es em emos asse assem arem",
  er: "o es e emos em i este eu eram ia ias ía íamos iam ido ida idos idas endo erei erá eremos erão eria eriam a as amos am esse essem erem",
  ir: "o es e imos ímos em i iste iu iram ia ias ía íamos iam ido ida idos idas indo irei irá iremos irão iria iriam a as amos am isse issem irem",
};

export function inflect(base) {
  const m = base.match(/^(.+)(ar|er|ir)$/u);
  if (!m) return [base];
  const [, stem, theme] = m;
  return [...new Set([base, ...ENDINGS[theme].split(" ").map((ending) => stem + ending)])];
}

const verb = (avoid, use, note) => ({ avoid, use, verb: true, ...(note ? { note } : {}) });
const word = (avoid, use, note) => ({ avoid, use, ...(note ? { note } : {}) });
const foreign = (avoid, use) => word(avoid, use, "Foreign word: use the Portuguese word, or explain it on first use.");

export const lexicon = [
  // Formal verbs
  verb("efetuar", "fazer"),
  verb("utilizar", "usar"),
  verb("possuir", "ter"),
  verb("solicitar", "pedir"),
  verb("adquirir", "comprar ou conseguir"),
  verb("iniciar", "começar"),
  verb("finalizar", "terminar"),
  verb("disponibilizar", "dar ou oferecer"),
  verb("viabilizar", "permitir"),
  verb("dirimir", "resolver"),
  verb("mitigar", "reduzir"),
  verb("elucidar", "explicar"),
  verb("ratificar", "confirmar"),
  verb("retificar", "corrigir"),
  verb("denominar", "chamar"),
  verb("ensejar", "causar"),
  verb("subsidiar", "apoiar"),
  verb("vislumbrar", "ver"),
  verb("outorgar", "dar"),
  verb("preconizar", "recomendar"),
  verb("pleitear", "pedir"),
  verb("exarar", "escrever"),
  verb("evidenciar", "mostrar"),
  verb("mensurar", "medir"),
  verb("aferir", "medir ou verificar"),
  verb("sopesar", "pesar"),
  { avoid: "perfazer", use: "somar", forms: ["perfazer", "perfaz", "perfazem", "perfez", "perfizeram"] },
  { avoid: "visando", use: "para" },

  // Formal connectors and adverbs
  word("a fim de", "para"),
  word("no sentido de", "para"),
  word("com o objetivo de", "para"),
  word("com a finalidade de", "para"),
  word("de forma a", "para"),
  word("de modo a", "para"),
  word("tendo em vista", "porque ou como"),
  word("tendo em conta", "porque ou como"),
  word("haja vista", "porque ou como"),
  word("uma vez que", "porque ou como"),
  word("devido ao fato de que", "porque"),
  word("em virtude de", "por causa de"),
  word("por conta de", "por causa de"),
  word("por meio de", "com ou por"),
  word("através de", "por ou com"),
  word("mediante", "com ou por"),
  word("por intermédio de", "por ou com"),
  word("no que tange a", "sobre"),
  word("no que diz respeito a", "sobre"),
  word("no tocante a", "sobre"),
  word("em relação a", "sobre"),
  word("com relação a", "sobre"),
  word("a respeito de", "sobre"),
  word("acerca de", "sobre"),
  word("diante do exposto", "então"),
  word("assim sendo", "então"),
  word("destarte", "assim"),
  word("outrossim", "também"),
  word("ademais", "também"),
  word("bem como", "e"),
  word("todavia", "mas"),
  word("contudo", "mas"),
  word("entretanto", "mas"),
  word("porém", "mas"),
  word("portanto", "então"),
  word("conquanto", "embora"),
  word("porquanto", "porque"),
  word("em que pese", "embora"),
  word("não obstante", "mas ou embora"),
  word("posteriormente", "depois"),
  word("anteriormente", "antes"),
  word("previamente", "antes"),
  word("subsequente", "seguinte"),
  word("atualmente", "hoje ou agora"),
  word("no momento", "agora"),
  word("neste momento", "agora"),
  word("neste ínterim", "enquanto isso"),
  word("nesse ínterim", "enquanto isso"),
  word("doravante", "de agora em diante"),
  word("outrora", "antes"),
  word("dentre", "entre"),
  word("mormente", "principalmente"),
  word("precipuamente", "principalmente"),
  word("consoante", "conforme"),
  word("tão logo", "assim que"),
  word("tão somente", "só"),
  word("via de regra", "em geral"),
  word("em tempo hábil", "a tempo"),
  word("sucintamente", "em poucas palavras"),
  word("supracitado", "citado antes"),
  word("supramencionado", "citado antes"),
  word("aludido", "citado"),
  word("aproximadamente", "cerca de"),
  word("a priori", "antes"),
  word("a posteriori", "depois"),

  // Verb phrases that hide a simple verb
  word("fazer uso de", "usar"),
  word("dar início a", "começar"),
  word("dar continuidade a", "continuar"),
  word("levar a cabo", "fazer ou terminar"),
  word("tomar conhecimento de", "saber ou ler"),
  word("estar em condições de", "poder"),

  // Foreign words (explain them or translate them)
  foreign("feedback", "retorno"),
  foreign("deadline", "prazo"),
  foreign("performance", "desempenho"),
  foreign("default", "padrão"),
  foreign("setup", "configuração"),
  foreign("insight", "ideia"),
  foreign("expertise", "experiência"),
  foreign("briefing", "resumo"),
  foreign("checklist", "lista de conferência"),
  foreign("workaround", "solução provisória"),
];

export default { id, grammar, lexicon, inflect };
