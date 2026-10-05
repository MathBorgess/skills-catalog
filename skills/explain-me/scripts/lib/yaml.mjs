// YAML subset used by design specs (frontmatter of frame.md / DESIGN.md).
//
// Supported: block maps, block lists (of scalars, flow maps, block maps and
// nested lists), flow maps `{a: 1}`, flow lists `[a, b]` (single or multi line),
// quoted and unquoted scalars, numbers, booleans (true/false/on/off/yes/no),
// null (`null`, `~`, empty), `#` comments, `|` and `>` block scalars.
//
// Anything else (anchors, aliases, tags, tabs for indentation, duplicate keys,
// documents separators) raises a YamlError whose message starts with the line
// number. Zero dependencies.

export class YamlError extends Error {
  constructor(message, line) {
    super(line ? `line ${line}: ${message}` : message);
    this.name = "YamlError";
    this.line = line ?? null;
  }
}

const NUMBER_RE = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;
const TRUE_WORDS = new Set(["true", "yes", "on"]);
const FALSE_WORDS = new Set(["false", "no", "off"]);

// ---------------------------------------------------------------------------
// scalars
// ---------------------------------------------------------------------------

function decodeDouble(body, line) {
  let out = "";
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const next = body[++i];
    switch (next) {
      case "n": out += "\n"; break;
      case "t": out += "\t"; break;
      case "r": out += "\r"; break;
      case "b": out += "\b"; break;
      case "f": out += "\f"; break;
      case "0": out += "\0"; break;
      case "/": out += "/"; break;
      case '"': out += '"'; break;
      case "\\": out += "\\"; break;
      case " ": out += " "; break;
      case "u": {
        const hex = body.slice(i + 1, i + 5);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw new YamlError("bad \\u escape in a double-quoted string", line);
        out += String.fromCharCode(parseInt(hex, 16));
        i += 4;
        break;
      }
      default:
        throw new YamlError(`unknown escape \\${next ?? ""} in a double-quoted string`, line);
    }
  }
  return out;
}

// Reads a quoted string starting at `start` (the quote char). Returns {value, end}
// where `end` is the index just past the closing quote.
function readQuoted(text, start, line) {
  const quote = text[start];
  let i = start + 1;
  if (quote === '"') {
    let raw = "";
    while (i < text.length) {
      const ch = text[i];
      if (ch === "\\") {
        raw += ch + (text[i + 1] ?? "");
        i += 2;
        continue;
      }
      if (ch === '"') return { value: decodeDouble(raw, line), end: i + 1 };
      raw += ch;
      i++;
    }
    throw new YamlError("unterminated double-quoted string", line);
  }
  let value = "";
  while (i < text.length) {
    const ch = text[i];
    if (ch === "'") {
      if (text[i + 1] === "'") {
        value += "'";
        i += 2;
        continue;
      }
      return { value, end: i + 1 };
    }
    value += ch;
    i++;
  }
  throw new YamlError("unterminated single-quoted string", line);
}

export function scalarFromPlain(text, line) {
  const t = text.trim();
  if (t === "" || t === "~") return null;
  const lower = t.toLowerCase();
  if (lower === "null") return null;
  if (TRUE_WORDS.has(lower)) return true;
  if (FALSE_WORDS.has(lower)) return false;
  if (NUMBER_RE.test(t)) return Number(t);
  if (/^[&*!]/.test(t)) {
    throw new YamlError(`"${t[0]}" starts an anchor, alias or tag, which this YAML subset does not support; quote the value`, line);
  }
  if (/^[%@`]/.test(t)) throw new YamlError(`a plain value cannot start with "${t[0]}"; quote it`, line);
  return t;
}

// Parses a whole scalar token (quoted or plain), used for block values and list items.
function parseScalarToken(text, line) {
  const t = text.trim();
  if (t[0] === '"' || t[0] === "'") {
    const { value, end } = readQuoted(t, 0, line);
    if (t.slice(end).trim() !== "") throw new YamlError("unexpected text after the closing quote", line);
    return value;
  }
  return scalarFromPlain(t, line);
}

// ---------------------------------------------------------------------------
// comments
// ---------------------------------------------------------------------------

// Remove a trailing `# comment` (a # at line start or after whitespace, outside quotes).
export function stripComment(text) {
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (quote === '"' && ch === "\\") i++;
      else if (ch === quote) {
        if (quote === "'" && text[i + 1] === "'") i++;
        else quote = null;
      }
      continue;
    }
    // A quote only opens a string at a token start, so apostrophes inside plain words are fine.
    if ((ch === '"' || ch === "'") && (i === 0 || /[\s:,\[{\-]/.test(text[i - 1]))) {
      quote = ch;
      continue;
    }
    if (ch === "#" && (i === 0 || /\s/.test(text[i - 1]))) return text.slice(0, i);
  }
  return text;
}

// ---------------------------------------------------------------------------
// flow collections
// ---------------------------------------------------------------------------

function parseFlow(text, line) {
  let i = 0;
  const skipWs = () => {
    while (i < text.length && /\s/.test(text[i])) i++;
  };

  function parseValue(inKey = false) {
    skipWs();
    const ch = text[i];
    if (ch === "{") return parseMap();
    if (ch === "[") return parseList();
    if (ch === '"' || ch === "'") {
      const { value, end } = readQuoted(text, i, line);
      i = end;
      return value;
    }
    // plain scalar: up to , } ] (and for keys, up to ":" followed by space/end)
    let start = i;
    while (i < text.length) {
      const c = text[i];
      if (c === "," || c === "}" || c === "]") break;
      if (inKey && c === ":" && (i + 1 >= text.length || /[\s,}\]]/.test(text[i + 1]))) break;
      if (!inKey && c === "{" ) throw new YamlError('unexpected "{" inside a flow value; quote the value', line);
      i++;
    }
    if (inKey) return text.slice(start, i).trim();
    return scalarFromPlain(text.slice(start, i), line);
  }

  function parseMap() {
    i++; // {
    const out = {};
    skipWs();
    if (text[i] === "}") {
      i++;
      return out;
    }
    for (;;) {
      skipWs();
      if (i >= text.length) throw new YamlError("unterminated flow map, missing }", line);
      const key = parseValue(true);
      skipWs();
      if (text[i] !== ":") throw new YamlError(`expected ":" after key ${JSON.stringify(key)} in a flow map`, line);
      i++;
      skipWs();
      let value = null;
      if (text[i] !== "," && text[i] !== "}") value = parseValue();
      const k = String(key);
      if (Object.prototype.hasOwnProperty.call(out, k)) throw new YamlError(`duplicate key "${k}"`, line);
      out[k] = value;
      skipWs();
      if (text[i] === ",") {
        i++;
        skipWs();
        if (text[i] === "}") {
          i++;
          return out;
        }
        continue;
      }
      if (text[i] === "}") {
        i++;
        return out;
      }
      throw new YamlError('expected "," or "}" in a flow map', line);
    }
  }

  function parseList() {
    i++; // [
    const out = [];
    skipWs();
    if (text[i] === "]") {
      i++;
      return out;
    }
    for (;;) {
      skipWs();
      if (i >= text.length) throw new YamlError("unterminated flow list, missing ]", line);
      out.push(parseValue());
      skipWs();
      if (text[i] === ",") {
        i++;
        skipWs();
        if (text[i] === "]") {
          i++;
          return out;
        }
        continue;
      }
      if (text[i] === "]") {
        i++;
        return out;
      }
      throw new YamlError('expected "," or "]" in a flow list', line);
    }
  }

  const value = parseValue();
  skipWs();
  if (i < text.length) throw new YamlError(`unexpected text after the flow value: ${JSON.stringify(text.slice(i, i + 20))}`, line);
  return value;
}

function flowBalanced(text) {
  let depth = 0;
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (quote === '"' && ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      if (i === 0 || /[\s:,\[{]/.test(text[i - 1])) quote = ch;
      continue;
    }
    if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") depth--;
  }
  return depth <= 0 && !quote;
}

// ---------------------------------------------------------------------------
// block parser
// ---------------------------------------------------------------------------

export function parse(source, { lineOffset = 0 } = {}) {
  const text = String(source).replace(/\r\n?/g, "\n");
  const lines = text.split("\n").map((raw, idx) => {
    const no = idx + 1 + lineOffset;
    const lead = /^[ \t]*/.exec(raw)[0];
    // reported when the parser reaches the line, so errors surface in file order
    const badTab = lead.includes("\t") && raw.trim() !== "" && !raw.trim().startsWith("#");
    return { no, raw, indent: lead.length, badTab, content: stripComment(raw).trim() };
  });

  let pos = 0;

  const skipBlank = () => {
    while (pos < lines.length && lines[pos].content === "") pos++;
  };
  const peek = () => {
    skipBlank();
    if (pos < lines.length && lines[pos].badTab) throw new YamlError("tabs are not allowed for indentation; use spaces", lines[pos].no);
    return pos < lines.length ? lines[pos] : null;
  };

  function parseBlock(minIndent) {
    const first = peek();
    if (!first || first.indent < minIndent) return null;
    const content = first.content;
    if (/^---\s*$/.test(content) || /^\.\.\.\s*$/.test(content)) {
      throw new YamlError("document separators are not supported inside a spec", first.no);
    }
    if (content === "-" || content.startsWith("- ")) return parseList(first.indent);
    if (looksLikeMapEntry(content)) return parseMap(first.indent);
    // a lone scalar / flow value
    pos++;
    return parseInlineValue(content, first.no, first.indent);
  }

  function looksLikeMapEntry(content) {
    return splitKey(content, 0) !== null;
  }

  // Splits `key: rest` and returns {key, rest} or null if this is not a map entry.
  function splitKey(content, no) {
    if (content[0] === '"' || content[0] === "'") {
      let q;
      try {
        q = readQuoted(content, 0, no);
      } catch (e) {
        return null;
      }
      const after = content.slice(q.end).trimStart();
      if (after[0] !== ":" || (after.length > 1 && !/\s/.test(after[1]))) return null;
      return { key: q.value, rest: after.slice(1).trim() };
    }
    if (content[0] === "{" || content[0] === "[") return null;
    for (let i = 0; i < content.length; i++) {
      if (content[i] === ":" && (i + 1 === content.length || /\s/.test(content[i + 1]))) {
        const key = content.slice(0, i).trim();
        if (key === "") return null;
        return { key, rest: content.slice(i + 1).trim() };
      }
    }
    return null;
  }

  function parseInlineValue(content, no, parentIndent) {
    if (content[0] === "{" || content[0] === "[") {
      // multi-line flow: keep appending following lines until balanced
      let buf = content;
      const startNo = no;
      while (!flowBalanced(buf)) {
        if (pos >= lines.length) throw new YamlError("unterminated flow collection", startNo);
        const next = lines[pos++];
        if (next.content === "") continue;
        buf += " " + next.content;
      }
      return parseFlow(buf, startNo);
    }
    return parseScalarToken(content, no);
  }

  function parseBlockScalar(header, ownerIndent, no) {
    const style = header[0]; // | or >
    const chomp = /[-+]/.exec(header.slice(1))?.[0] ?? "";
    if (header.slice(1).replace(/[-+]/g, "").replace(/\d/g, "").trim() !== "") {
      throw new YamlError(`unsupported block scalar header "${header}"`, no);
    }
    const body = [];
    let blockIndent = null;
    while (pos < lines.length) {
      const ln = lines[pos];
      if (ln.raw.trim() === "") {
        body.push("");
        pos++;
        continue;
      }
      if (ln.indent <= ownerIndent) break;
      if (blockIndent === null) blockIndent = ln.indent;
      if (ln.indent < blockIndent) break;
      body.push(ln.raw.slice(blockIndent));
      pos++;
    }
    // trailing blank lines belong to chomping
    let trailing = 0;
    while (body.length && body[body.length - 1] === "") {
      body.pop();
      trailing++;
    }
    let value;
    if (style === "|") {
      value = body.join("\n");
    } else {
      // folded: single newlines become spaces; blank lines become newlines
      value = "";
      for (let i = 0; i < body.length; i++) {
        const ln = body[i];
        if (i === 0) value = ln;
        else if (ln === "") value += "\n";
        else if (body[i - 1] === "") value += ln;
        else value += " " + ln;
      }
    }
    if (chomp === "-") return value;
    if (chomp === "+") return value + "\n".repeat(trailing + 1);
    return body.length ? value + "\n" : "";
  }

  // Parse the value found after `key:` (rest) or `- ` (rest); `ownerIndent` is the indent of
  // the key/dash line, used to find nested blocks.
  function parseAfterIndicator(rest, no, ownerIndent, { listItem = false, sameIndentList = false } = {}) {
    if (rest === "") {
      const next = peek();
      if (next && next.indent > ownerIndent) return parseBlock(next.indent);
      if (!listItem && sameIndentList && next && next.indent === ownerIndent && (next.content === "-" || next.content.startsWith("- "))) {
        return parseList(ownerIndent);
      }
      return null;
    }
    if (rest[0] === "|" || rest[0] === ">") return parseBlockScalar(rest, ownerIndent, no);
    return parseInlineValue(rest, no, ownerIndent);
  }

  function parseMap(indent) {
    const out = {};
    for (;;) {
      const ln = peek();
      if (!ln || ln.indent < indent) break;
      if (ln.indent > indent) throw new YamlError("unexpected indentation", ln.no);
      if (ln.content === "-" || ln.content.startsWith("- ")) break;
      const entry = splitKey(ln.content, ln.no);
      if (!entry) throw new YamlError(`expected "key: value", found ${JSON.stringify(ln.content.slice(0, 40))}`, ln.no);
      pos++;
      if (Object.prototype.hasOwnProperty.call(out, entry.key)) throw new YamlError(`duplicate key "${entry.key}"`, ln.no);
      out[entry.key] = parseAfterIndicator(entry.rest, ln.no, indent, { sameIndentList: true });
    }
    return out;
  }

  function parseList(indent) {
    const out = [];
    for (;;) {
      const ln = peek();
      if (!ln || ln.indent < indent) break;
      if (ln.indent > indent) throw new YamlError("unexpected indentation in a list", ln.no);
      if (!(ln.content === "-" || ln.content.startsWith("- "))) break;
      const afterDash = ln.content === "-" ? "" : ln.content.slice(2);
      const rest = afterDash.trim();
      if (rest === "") {
        pos++;
        out.push(parseAfterIndicator("", ln.no, indent, { listItem: true }));
        continue;
      }
      // Inline item. If it is a block map or nested list, rewrite this line as a virtual line
      // positioned where the item content starts, then parse a block there.
      const dashToContent = ln.content.length - afterDash.trimStart().length;
      const offset = ln.raw.indexOf("-") + dashToContent;
      const virtualIndent = offset;
      const isNestedList = rest === "-" || rest.startsWith("- ");
      if (isNestedList || (rest[0] !== "|" && rest[0] !== ">" && splitKey(rest, ln.no))) {
        lines[pos] = { no: ln.no, raw: " ".repeat(virtualIndent) + rest, indent: virtualIndent, content: rest };
        out.push(parseBlock(virtualIndent));
        continue;
      }
      pos++;
      if (rest[0] === "|" || rest[0] === ">") out.push(parseBlockScalar(rest, indent, ln.no));
      else out.push(parseInlineValue(rest, ln.no, indent));
    }
    return out;
  }

  const first = peek();
  if (!first) return null;
  const value = parseBlock(first.indent);
  const rest = peek();
  if (rest) throw new YamlError(`unexpected content ${JSON.stringify(rest.content.slice(0, 40))}`, rest.no);
  return value;
}

// ---------------------------------------------------------------------------
// serializer (same subset; parse(stringify(x)) deep-equals x)
// ---------------------------------------------------------------------------

const PLAIN_KEY_RE = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;

function needsQuotes(s) {
  if (s === "" || s !== s.trim()) return true;
  if (/[\n\r\t]/.test(s)) return true;
  if (/^[-?:,\[\]{}#&*!|>'"%@`]/.test(s)) return true;
  if (/: |:$| #|,|\[|\]|\{|\}/.test(s)) return true;
  const lower = s.toLowerCase();
  if (lower === "null" || lower === "~" || TRUE_WORDS.has(lower) || FALSE_WORDS.has(lower)) return true;
  if (NUMBER_RE.test(s)) return true;
  return false;
}

function scalarOut(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new YamlError(`cannot serialize non-finite number ${v}`);
    return String(v);
  }
  const s = String(v);
  return needsQuotes(s) ? JSON.stringify(s) : s;
}

function keyOut(k) {
  return PLAIN_KEY_RE.test(k) && !TRUE_WORDS.has(k.toLowerCase()) && !FALSE_WORDS.has(k.toLowerCase()) && k.toLowerCase() !== "null"
    ? k
    : JSON.stringify(k);
}

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isScalar = (v) => v === null || v === undefined || typeof v !== "object";

function flowOut(v) {
  if (Array.isArray(v)) return `[${v.map(flowOut).join(", ")}]`;
  if (isPlainObject(v)) {
    const keys = Object.keys(v);
    if (!keys.length) return "{}";
    return `{ ${keys.map((k) => `${keyOut(k)}: ${flowOut(v[k])}`).join(", ")} }`;
  }
  return scalarOut(v);
}

function flatEnough(v, width) {
  if (Array.isArray(v)) return v.every((x) => isScalar(x) || (isPlainObject(x) && Object.values(x).every(isScalar))) && flowOut(v).length <= width;
  if (isPlainObject(v)) return Object.values(v).every(isScalar) && flowOut(v).length <= width;
  return true;
}

export function stringify(value, { flowWidth = 100 } = {}) {
  const out = [];

  function emitValue(v, indent, prefix) {
    // prefix is e.g. "key:" or "-"; emits the value either inline or as a nested block
    const pad = " ".repeat(indent);
    if (isScalar(v)) {
      out.push(`${pad}${prefix} ${scalarOut(v)}`);
      return;
    }
    if (Array.isArray(v)) {
      if (v.length === 0) {
        out.push(`${pad}${prefix} []`);
        return;
      }
      if (v.every(isScalar) && flatEnough(v, flowWidth)) {
        out.push(`${pad}${prefix} ${flowOut(v)}`);
        return;
      }
      out.push(`${pad}${prefix}`);
      emitList(v, indent + 2);
      return;
    }
    const keys = Object.keys(v);
    if (keys.length === 0) {
      out.push(`${pad}${prefix} {}`);
      return;
    }
    if (flatEnough(v, flowWidth)) {
      out.push(`${pad}${prefix} ${flowOut(v)}`);
      return;
    }
    out.push(`${pad}${prefix}`);
    emitMap(v, indent + 2);
  }

  function emitMap(obj, indent) {
    for (const k of Object.keys(obj)) emitValue(obj[k], indent, `${keyOut(k)}:`);
  }

  function emitList(list, indent) {
    const pad = " ".repeat(indent);
    for (const item of list) {
      if (isScalar(item)) out.push(`${pad}- ${scalarOut(item)}`);
      else if (Array.isArray(item)) {
        if (item.length === 0) out.push(`${pad}- []`);
        else if (item.every(isScalar) && flatEnough(item, flowWidth)) out.push(`${pad}- ${flowOut(item)}`);
        else {
          out.push(`${pad}-`);
          emitList(item, indent + 2);
        }
      } else if (Object.keys(item).length === 0) out.push(`${pad}- {}`);
      else if (flatEnough(item, flowWidth)) out.push(`${pad}- ${flowOut(item)}`);
      else {
        out.push(`${pad}-`);
        emitMap(item, indent + 2);
      }
    }
  }

  if (isScalar(value)) return scalarOut(value) + "\n";
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]\n";
    emitList(value, 0);
  } else if (Object.keys(value).length === 0) return "{}\n";
  else emitMap(value, 0);
  return out.join("\n") + "\n";
}
