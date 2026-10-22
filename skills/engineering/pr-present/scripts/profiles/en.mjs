// English language profile for ste-lint.
//
// Grammar rules follow the writing rules of ASD-STE100, paraphrased. The word
// list is our own plain-language list. The ASD-STE100 dictionary is not shipped:
// get it from https://www.asd-ste100.org/.
//
// A rule is an error only when its false-positive rate on ordinary technical
// prose is low. Heuristic rules are warnings.
//
// Shape: { id, grammar: [{ rule, severity, message, test(sentence, ctx) }], lexicon: [{ avoid, use, note? }] }.
// test() returns null, a sample string, { sample, message }, or an array of those.

export const id = "en";

const WORD = "\\p{L}\\p{N}_";
const wordRe = (source, flags = "giu") => new RegExp(`(?<![${WORD}])(?:${source})(?![${WORD}])`, flags);
const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toSet = (text) => new Set(text.trim().split(/\s+/));

// ---------------------------------------------------------------------------
// Passive voice: a form of "be", up to two adverbs, then a past participle.
// ---------------------------------------------------------------------------

const BE = "am|is|are|was|were|be|been|being|isn['’]t|aren['’]t|wasn['’]t|weren['’]t";
const GAP =
  "(?:\\s+(?:not|never|always|also|then|already|still|just|only|often|first|later|ever|usually|typically|normally|generally|simply|\\p{L}+ly)){0,2}";
// The participle is captured in a lookahead so the next scan can start on it.
const PASSIVE = new RegExp(`(?<![${WORD}])(?:${BE})${GAP}\\s+(?=(\\p{L}+)(?![${WORD}]))`, "giu");

const IRREGULAR = toSet(`
  built made taken given written sent held kept known shown seen found set put run read left lost
  brought bought caught chosen driven eaten fallen forgotten gotten grown hidden hit hurt laid led met
  paid said sold spent split spread stolen struck taught thrown told thought understood won worn begun
  broken drawn torn sworn bound cut shut let cast dealt dug fed fought flown frozen hung lent meant
  ridden risen sung sunk swept swung spoken stuck sought shot spun bent bitten blown bred shaken
  shrunk slid
`);

// Words that end in "ed" but are not participles.
const NOT_PARTICIPLE = toSet(`
  need seed feed weed heed deed reed speed bleed breed greed creed steed tweed proceed succeed exceed
  indeed hundred naked wicked sacred kindred embed shed sled
`);

// Participles that behave as plain adjectives after "be".
const ADJECTIVAL = toSet(`
  advanced limited unlimited detailed complicated sophisticated experienced skilled qualified
  interested concerned tired excited bored worried pleased surprised scared married supposed
`);

function isParticiple(word) {
  const w = word.toLowerCase();
  if (ADJECTIVAL.has(w)) return false;
  if (IRREGULAR.has(w)) return true;
  return w.length >= 4 && w.endsWith("ed") && !NOT_PARTICIPLE.has(w);
}

function passiveVoice(sentence) {
  const hits = [];
  for (const m of sentence.matchAll(PASSIVE)) {
    if (isParticiple(m[1])) hits.push(`${m[0]}${m[1]}`.replace(/\s+/g, " "));
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Noun clusters (heuristic): four or more nouns in a row, with no word that
// is clearly a function word, verb, adverb or adjective between them.
// ---------------------------------------------------------------------------

const STOP = toSet(`
  a an the this that these those each every some any no all both either neither such own other another
  i you he she it we they me him her us them my your his its our their mine yours theirs
  who whom whose which what where when why how
  am is are was were be been being do does did done doing have has had having
  will would shall should can could may might must
  and or but nor so yet if then else than as because although though while whereas unless until once since before after
  of in on at by for with without within from to into onto upon over under between among through during about against across around
  not never always also often usually just only still already very quite rather fairly really somewhat basically
  here there now too again ever
  one two three four five six seven eight nine ten first second third per via except plus minus versus
  off up down out away back near next later early enough short same different new old more most less few many much several
  stay stays bump bumps produce produces schedule schedules
  use uses get gets set sets run runs make makes take takes give gives keep keeps put puts send sends read reads
  write writes open opens close closes start starts stop stops add adds remove removes create creates delete deletes
  check checks show shows find finds see sees tell tells ask asks need needs want wants let lets try tries help helps
  call calls turn turns move moves change changes build builds load loads save saves store stores pass passes
  return returns fail fails work works
`);

// A suffix counts only after a stem of three letters: "size" and "drive" are nouns.
const NOT_NOUN_SUFFIX = /.{3,}(?:ly|ed|ing|ize|ise|ify|ous|ive|ful|less|able|ible)$/;
const TOKEN = /[\p{L}\p{N}][\p{L}\p{N}'’-]*|[^\s\p{L}\p{N}]/gu;

function isNounLike(token) {
  if (!/^\p{L}[\p{L}'’-]*$/u.test(token)) return false;
  const w = token.toLowerCase();
  return w.length >= 3 && !STOP.has(w) && !NOT_NOUN_SUFFIX.test(w);
}

function nounClusters(sentence) {
  const hits = [];
  let run = [];
  const flush = () => {
    if (run.length > 3) hits.push({ sample: run.join(" "), size: run.length });
    run = [];
  };
  for (const m of sentence.matchAll(TOKEN)) {
    if (isNounLike(m[0])) run.push(m[0]);
    else flush();
  }
  flush();
  return hits.map((h) => ({
    sample: h.sample,
    message: `Noun cluster of ${h.size} words. Keep it to three nouns or fewer: add "of" or "for", or use a verb.`,
  }));
}

// ---------------------------------------------------------------------------
// -ing as a noun or adjective (heuristic) and the progressive tense.
// ---------------------------------------------------------------------------

// Real nouns and common adjectives that end in -ing.
const ING_OK = toSet(`
  string strings spring ceiling morning evening during warning warnings setting settings heading headings
  listing listings building following existing remaining underlying corresponding resulting incoming
  outgoing preceding something anything nothing everything sibling finding findings
`);

const ING_AFTER_DETERMINER = new RegExp(
  `(?<![${WORD}])(?:the|a|an|this|that|these|those|each|every|its|their|our|your|his|her|my|some|any|such)\\s+(\\p{L}{3,}ing)(?![${WORD}])`,
  "giu",
);

function ingAsNoun(sentence) {
  const hits = [];
  for (const m of sentence.matchAll(ING_AFTER_DETERMINER)) {
    if (!ING_OK.has(m[1].toLowerCase())) hits.push(m[0]);
  }
  return hits;
}

const BE_PROGRESSIVE = "am|is|are|was|were|be|been|isn['’]t|aren['’]t|wasn['’]t|weren['’]t";
const PROGRESSIVE = new RegExp(`(?<![${WORD}])(?:${BE_PROGRESSIVE})${GAP}\\s+(\\p{L}{3,}ing)(?![${WORD}])`, "giu");
const PROGRESSIVE_OK = toSet(`
  during morning evening ceiling string spring something anything nothing everything sibling
  interesting missing confusing surprising promising outstanding existing remaining following
`);

function progressive(sentence) {
  const hits = [];
  for (const m of sentence.matchAll(PROGRESSIVE)) {
    if (!PROGRESSIVE_OK.has(m[1].toLowerCase())) hits.push(m[0].replace(/\s+/g, " "));
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Ambiguous modals and vague qualifiers.
// ---------------------------------------------------------------------------

const MODAL = wordRe("should|may|might|could|would|shall");
const MODAL_ADVICE = {
  should: 'Use "must" for a requirement. Use "can" for a possibility.',
  may: 'Use "can" for a possibility. Use "must" for a requirement.',
  might: 'Use "can" for a possibility, or state the condition with "if".',
  could: 'Use "can" for a possibility, or state the condition with "if".',
  would: 'State the condition with "if" and use the present tense.',
  shall: 'Use "must" for a requirement.',
};

function ambiguousModal(sentence) {
  const hits = [];
  for (const m of sentence.matchAll(MODAL)) {
    const word = m[0];
    // "May" in the middle of a sentence is the month.
    if (word === "May" && m.index > 0) continue;
    hits.push({ sample: word, message: `Ambiguous modal "${word}". ${MODAL_ADVICE[word.toLowerCase()]}` });
  }
  return hits;
}

const QUALIFIER = wordRe("very|quite|rather|fairly|really|somewhat|basically|extremely|relatively|slightly");

function vagueQualifier(sentence) {
  return [...sentence.matchAll(QUALIFIER)].map((m) => ({
    sample: m[0],
    message: `Vague qualifier "${m[0]}". Give a number, a limit or a name instead.`,
  }));
}

// ---------------------------------------------------------------------------
// Phrasal verbs: [base verb, its forms, particle, replacement].
// ---------------------------------------------------------------------------

const PHRASAL = [
  ["set", "set|sets|setting", "up", "configure, install or prepare"],
  ["carry", "carry|carries|carried|carrying", "out", "do or perform"],
  ["find", "find|finds|found|finding", "out", "learn or find"],
  ["point", "point|points|pointed|pointing", "out", "show"],
  ["figure", "figure|figures|figured|figuring", "out", "calculate or find"],
  ["work", "work|works|worked|working", "out", "calculate or solve"],
  ["turn", "turn|turns|turned|turning", "on", "start or enable"],
  ["turn", "turn|turns|turned|turning", "off", "stop or disable"],
  ["switch", "switch|switches|switched|switching", "on", "start or enable"],
  ["switch", "switch|switches|switched|switching", "off", "stop or disable"],
  ["shut", "shut|shuts|shutting", "down", "stop"],
  ["start", "start|starts|started|starting", "up", "start"],
  ["hand", "hand|hands|handed|handing", "over", "give"],
  ["bring", "bring|brings|brought|bringing", "up", "show or raise"],
  ["give", "give|gives|gave|given|giving", "up", "stop or abandon"],
  ["clean", "clean|cleans|cleaned|cleaning", "up", "remove or clear"],
  ["fill", "fill|fills|filled|filling", "in", "complete"],
  ["fill", "fill|fills|filled|filling", "out", "complete"],
  ["sign", "sign|signs|signed|signing", "up", "register"],
  ["back", "back|backs|backed|backing", "up", "copy or save a copy of"],
  ["roll", "roll|rolls|rolled|rolling", "back", "restore or undo"],
  ["look", "look|looks|looked|looking", "up", "find or search for"],
  ["look", "look|looks|looked|looking", "into", "examine"],
  ["check", "check|checks|checked|checking", "out", "see, read or get"],
  ["pick", "pick|picks|picked|picking", "up", "get or take"],
  ["put", "put|puts|putting", "off", "delay"],
  ["take", "take|takes|took|taken|taking", "out", "remove"],
  ["go", "go|goes|went|gone|going", "through", "examine or read"],
  ["hook", "hook|hooks|hooked|hooking", "up", "connect"],
  ["plug", "plug|plugs|plugged|plugging", "in", "connect"],
  ["wrap", "wrap|wraps|wrapped|wrapping", "up", "finish"],
  ["speed", "speed|speeds|sped|speeded|speeding", "up", "make faster"],
  ["slow", "slow|slows|slowed|slowing", "down", "make slower"],
  ["throw", "throw|throws|threw|thrown|throwing", "away", "discard or delete"],
  ["write", "write|writes|wrote|written|writing", "down", "record"],
  ["sort", "sort|sorts|sorted|sorting", "out", "solve or arrange"],
  ["rule", "rule|rules|ruled|ruling", "out", "exclude"],
  ["come", "come|comes|came|coming", "up with", "make or create"],
];

const PHRASAL_RES = PHRASAL.map(([, forms, particle, use]) => ({
  re: wordRe(`(?:${forms})\\s+${particle.replace(/\s+/g, "\\s+")}`),
  use,
}));

function phrasalVerb(sentence) {
  const hits = [];
  for (const { re, use } of PHRASAL_RES) {
    for (const m of sentence.matchAll(re)) {
      hits.push({ sample: m[0], message: `Phrasal verb "${m[0]}". Use a single verb: ${use}.` });
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Grammar rules
// ---------------------------------------------------------------------------

export const grammar = [
  {
    rule: "passive-voice",
    severity: "error",
    message: "Passive voice. Make the actor the subject: write \"The broker validates the packet.\"",
    test: passiveVoice,
  },
  {
    rule: "noun-cluster",
    severity: "warning",
    message: "Noun cluster of more than three nouns.",
    test: nounClusters,
  },
  {
    rule: "ing-noun",
    severity: "warning",
    message: "An -ing word used as a noun or adjective. Use a plain noun or a verb.",
    test: ingAsNoun,
  },
  {
    rule: "progressive-tense",
    severity: "warning",
    message: "Progressive tense. Use the simple present: write \"The server sends\", not \"The server is sending\".",
    test: progressive,
  },
  {
    rule: "ambiguous-modal",
    severity: "warning",
    message: "Ambiguous modal verb.",
    test: ambiguousModal,
  },
  {
    rule: "vague-qualifier",
    severity: "warning",
    message: "Vague qualifier.",
    test: vagueQualifier,
  },
  {
    rule: "phrasal-verb",
    severity: "warning",
    message: "Phrasal verb. Use a single verb.",
    test: phrasalVerb,
  },
];

// ---------------------------------------------------------------------------
// Lexicon: our own plain-language replacements. `verb: true` also matches the
// regular inflections of the word.
// ---------------------------------------------------------------------------

export function inflect(base) {
  const forms = new Set([base]);
  const consonantY = /[^aeiou]y$/.test(base);
  const sibilant = /(?:s|x|z|ch|sh)$/.test(base);
  const silentE = base.endsWith("e") && !base.endsWith("ee");
  forms.add(consonantY ? `${base.slice(0, -1)}ies` : sibilant ? `${base}es` : `${base}s`);
  forms.add(base.endsWith("e") ? `${base}d` : consonantY ? `${base.slice(0, -1)}ied` : `${base}ed`);
  forms.add(silentE ? `${base.slice(0, -1)}ing` : `${base}ing`);
  return [...forms];
}

const verb = (avoid, use, note) => ({ avoid, use, verb: true, ...(note ? { note } : {}) });
const word = (avoid, use, note) => ({ avoid, use, ...(note ? { note } : {}) });

export const lexicon = [
  // Formal verbs
  verb("utilize", "use"),
  verb("utilise", "use"),
  verb("commence", "start"),
  verb("initiate", "start"),
  verb("terminate", "stop or end"),
  verb("facilitate", "help or make easier"),
  verb("leverage", "use"),
  verb("assist", "help"),
  verb("attempt", "try"),
  verb("demonstrate", "show"),
  verb("obtain", "get"),
  verb("acquire", "get"),
  verb("purchase", "buy"),
  verb("require", "need or needed"),
  verb("modify", "change"),
  verb("employ", "use"),
  verb("endeavor", "try"),
  verb("indicate", "show"),
  verb("determine", "find or decide"),
  verb("ascertain", "find"),
  verb("reside", "live or be"),
  verb("possess", "have"),
  verb("retain", "keep"),
  verb("transmit", "send"),
  verb("construct", "build"),
  verb("accomplish", "do or finish"),
  verb("locate", "find"),
  verb("inform", "tell"),
  verb("ensure", "make sure"),
  verb("perform", "do"),
  verb("necessitate", "need"),
  verb("disseminate", "share or send"),
  verb("elucidate", "explain"),
  verb("augment", "add to or increase"),
  verb("ameliorate", "improve"),
  verb("mitigate", "reduce"),
  verb("expedite", "make faster"),
  verb("reiterate", "repeat"),
  verb("substantiate", "prove or support"),
  verb("exhibit", "show"),
  verb("depict", "show"),
  verb("conclude", "end or decide"),
  verb("proceed", "go on or continue"),

  // Formal connectors and adverbs
  word("subsequent", "next or later"),
  word("subsequently", "then or later"),
  word("prior to", "before"),
  word("in order to", "to"),
  word("in order that", "so that"),
  word("due to the fact that", "because"),
  word("for the reason that", "because"),
  word("in spite of the fact that", "although"),
  word("inasmuch as", "because"),
  word("insofar as", "if or when"),
  word("in the event that", "if"),
  word("with regard to", "about"),
  word("with respect to", "about"),
  word("regarding", "about"),
  word("concerning", "about"),
  word("pertaining to", "about"),
  word("at this point in time", "now"),
  word("at the present time", "now"),
  word("in the near future", "soon"),
  word("in a timely manner", "on time or quickly"),
  word("on a regular basis", "regularly"),
  word("on a daily basis", "daily"),
  word("going forward", "from now on"),
  word("a number of", "some or several"),
  word("a large number of", "many"),
  word("the majority of", "most"),
  word("the vast majority of", "most"),
  word("numerous", "many"),
  word("approximately", "about"),
  word("sufficient", "enough"),
  word("additional", "more or extra"),
  word("in addition to", "and or besides"),
  word("as well as", "and"),
  word("in addition", "also"),
  word("aforementioned", "this or that"),
  word("remainder", "rest"),
  word("therefore", "so"),
  word("consequently", "so"),
  word("hence", "so"),
  word("thus", "so"),
  word("thereby", "so"),
  word("whereby", "where or by which"),
  word("furthermore", "also"),
  word("moreover", "also"),
  word("however", "but"),
  word("nevertheless", "but"),
  word("notwithstanding", "despite"),
  word("whilst", "while"),
  word("amongst", "among"),
  word("upon", "on or when"),
  word("herein", "here"),
  word("therein", "there"),
  word("forthwith", "now"),
  word("kindly", "please"),
  word("via", "by or through"),
  word("in the absence of", "without"),
  word("in conjunction with", "with"),
  word("in close proximity to", "near"),
  word("for the purpose of", "for"),
  word("is able to", "can"),
  word("has the ability to", "can"),
  word("is capable of", "can"),
  word("make use of", "use"),
  word("take into consideration", "consider"),
  word("give consideration to", "consider"),
  word("come to a conclusion", "decide"),

  // Formal nouns and adjectives
  word("functionality", "function or feature"),
  word("utilization", "use"),
  word("methodology", "method"),
  word("magnitude", "size"),
  word("optimal", "best"),
  word("optimum", "best"),
  word("paradigm", "model"),
  word("granular", "detailed"),
  word("robust", "strong", "State what makes it strong."),
  word("seamless", "smooth", "State what the user does not see."),
  word("seamlessly", "smoothly"),

  // Idioms and figures of speech
  word("under the hood", "inside"),
  word("out of the box", "by default"),
  word("rule of thumb", "guideline"),
  word("heavy lifting", "hard work"),
  word("silver bullet", "single fix"),
  word("deep dive", "detailed look"),
  word("circle back", "return to"),
  word("touch base", "talk"),
  word("cutting-edge", "new"),
  word("state-of-the-art", "modern"),

  // Latin abbreviations
  word("e.g.", "for example"),
  word("i.e.", "that is"),
];

export default { id, grammar, lexicon, inflect };
