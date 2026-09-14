// Minimal regex-based tokenizer for short vulnerability snippets (a handful
// of lines of Python/JS/TS). Not a full grammar — just enough to make the
// "AGENT BREAKDOWN" code block read as syntax-highlighted rather than plain
// text, without pulling in a full highlighting library for a few lines of code.

const KEYWORDS = new Set([
  "def", "class", "import", "from", "return", "if", "else", "elif", "for", "while", "try", "except",
  "finally", "with", "as", "pass", "break", "continue", "lambda", "yield", "raise", "assert", "in",
  "is", "not", "and", "or", "None", "True", "False", "self", "const", "let", "var", "function",
  "async", "await", "export", "default", "new", "this", "typeof", "interface", "type", "extends",
  "implements", "public", "private", "static", "require",
]);

export type TokenType = "keyword" | "string" | "comment" | "number" | "function" | "plain";

export interface Token {
  text: string;
  type: TokenType;
}

const TOKEN_RE = /(#.*$|\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b\d+\.?\d*\b)|([A-Za-z_][A-Za-z0-9_]*)(?=\()|([A-Za-z_][A-Za-z0-9_]*)|(\s+)|(.)/g;

export function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN_RE.exec(line)) !== null) {
    const [, comment, string, number, funcCall, word, space, other] = match;
    if (comment) tokens.push({ text: comment, type: "comment" });
    else if (string) tokens.push({ text: string, type: "string" });
    else if (number) tokens.push({ text: number, type: "number" });
    else if (funcCall) tokens.push({ text: funcCall, type: "function" });
    else if (word) tokens.push({ text: word, type: KEYWORDS.has(word) ? "keyword" : "plain" });
    else if (space) tokens.push({ text: space, type: "plain" });
    else if (other) tokens.push({ text: other, type: "plain" });
  }
  return tokens;
}

export const TOKEN_CLASSES: Record<TokenType, string> = {
  keyword: "text-medium",
  string: "text-mint",
  comment: "text-secondary/70 italic",
  number: "text-high",
  function: "text-primary font-medium",
  plain: "text-primary/85",
};
