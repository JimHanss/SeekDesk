import type { MessageSegment, SyntaxToken, SyntaxTokenKind } from "../../types";

export function parseMessageSegments(content: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  const fencePattern = /```([^\r\n`]*)\r?\n?([\s\S]*?)(?:\r?\n```|$)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = fencePattern.exec(content)) !== null) {
    if (match.index > cursor) {
      segments.push({
        type: "text",
        content: content.slice(cursor, match.index)
      });
    }

    segments.push({
      type: "code",
      language: match[1]?.trim() ?? "",
      content: trimCodeBlockEdges(match[2] ?? "")
    });

    cursor = fencePattern.lastIndex;
  }

  if (cursor < content.length) {
    segments.push({
      type: "text",
      content: content.slice(cursor)
    });
  }

  return segments.filter((segment) => segment.content.length > 0);
}

function trimCodeBlockEdges(code: string) {
  return code.replace(/^\r?\n/, "").replace(/\r?\n$/, "");
}

export function normalizeCodeLanguage(language: string) {
  const normalized = language.trim().toLowerCase();

  switch (normalized) {
    case "js":
    case "jsx":
    case "javascript":
      return "javascript";
    case "ts":
    case "tsx":
    case "typescript":
      return "typescript";
    case "sh":
    case "shell":
    case "bash":
    case "zsh":
      return "bash";
    case "jsonc":
    case "json":
      return "json";
    default:
      return normalized;
  }
}

const scriptKeywords = new Set([
  "abstract",
  "async",
  "await",
  "boolean",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "declare",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "from",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "null",
  "number",
  "of",
  "private",
  "protected",
  "public",
  "readonly",
  "return",
  "satisfies",
  "static",
  "string",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "type",
  "typeof",
  "undefined",
  "unknown",
  "var",
  "void",
  "while",
  "with",
  "yield"
]);

const bashKeywords = new Set([
  "case",
  "done",
  "do",
  "elif",
  "else",
  "esac",
  "export",
  "fi",
  "for",
  "function",
  "if",
  "in",
  "local",
  "readonly",
  "then",
  "while"
]);

export function tokenizeCode(code: string, language: string): SyntaxToken[] {
  const tokens: SyntaxToken[] = [];
  const isBash = language === "bash";
  let index = 0;

  while (index < code.length) {
    const character = code[index] ?? "";
    const nextCharacter = code[index + 1] ?? "";

    if (isWhitespace(character)) {
      const start = index;
      index += 1;

      while (index < code.length && isWhitespace(code[index] ?? "")) {
        index += 1;
      }

      tokens.push({ kind: "text", value: code.slice(start, index) });
      continue;
    }

    if (!isBash && character === "/" && nextCharacter === "*") {
      const end = code.indexOf("*/", index + 2);
      const nextIndex = end === -1 ? code.length : end + 2;
      tokens.push({ kind: "comment", value: code.slice(index, nextIndex) });
      index = nextIndex;
      continue;
    }

    if (!isBash && character === "/" && nextCharacter === "/") {
      const nextIndex = findLineEnd(code, index);
      tokens.push({ kind: "comment", value: code.slice(index, nextIndex) });
      index = nextIndex;
      continue;
    }

    if (isBash && character === "#" && isBashCommentStart(code, index)) {
      const nextIndex = findLineEnd(code, index);
      tokens.push({ kind: "comment", value: code.slice(index, nextIndex) });
      index = nextIndex;
      continue;
    }

    if (character === '"' || character === "'" || character === "`") {
      const nextIndex = scanQuotedString(code, index, character);
      tokens.push({
        kind: nextNonWhitespace(code, nextIndex) === ":" ? "property" : "string",
        value: code.slice(index, nextIndex)
      });
      index = nextIndex;
      continue;
    }

    if (isNumberStart(code, index)) {
      const start = index;
      index += 1;

      while (index < code.length && /[\w.]/.test(code[index] ?? "")) {
        index += 1;
      }

      tokens.push({ kind: "number", value: code.slice(start, index) });
      continue;
    }

    if (isIdentifierStart(character)) {
      const start = index;
      index += 1;

      while (index < code.length && isIdentifierPart(code[index] ?? "", isBash)) {
        index += 1;
      }

      const value = code.slice(start, index);
      const kind = getIdentifierTokenKind(code, index, value, language);
      tokens.push({ kind, value });
      continue;
    }

    if (isPunctuation(character)) {
      tokens.push({ kind: "punctuation", value: character });
      index += 1;
      continue;
    }

    tokens.push({ kind: "text", value: character });
    index += 1;
  }

  return tokens;
}

function findLineEnd(code: string, start: number) {
  const nextLine = code.indexOf("\n", start);
  return nextLine === -1 ? code.length : nextLine;
}

function scanQuotedString(code: string, start: number, quote: string) {
  let index = start + 1;

  while (index < code.length) {
    if (code[index] === "\\") {
      index += 2;
      continue;
    }

    if (code[index] === quote) {
      return index + 1;
    }

    index += 1;
  }

  return code.length;
}

function nextNonWhitespace(code: string, start: number) {
  let index = start;

  while (index < code.length && /\s/.test(code[index] ?? "")) {
    index += 1;
  }

  return code[index] ?? "";
}

function isWhitespace(character: string) {
  return /\s/.test(character);
}

function isNumberStart(code: string, index: number) {
  const character = code[index] ?? "";
  const previous = index > 0 ? code[index - 1] ?? "" : "";

  return /\d/.test(character) && !isIdentifierPart(previous, false);
}

function isIdentifierStart(character: string) {
  return /[A-Za-z_$]/.test(character);
}

function isIdentifierPart(character: string, isBash: boolean) {
  return isBash ? /[A-Za-z0-9_$-]/.test(character) : /[A-Za-z0-9_$]/.test(character);
}

function isPunctuation(character: string) {
  return /[{}()[\].,;:<>+\-*/=%!&|?]/.test(character);
}

function isBashCommentStart(code: string, index: number) {
  return index === 0 || /[\s;]/.test(code[index - 1] ?? "");
}

function getIdentifierTokenKind(
  code: string,
  endIndex: number,
  value: string,
  language: string
): SyntaxTokenKind {
  if (language === "bash") {
    return bashKeywords.has(value) ? "keyword" : "text";
  }

  if (language === "json") {
    return value === "true" || value === "false" || value === "null"
      ? "keyword"
      : "text";
  }

  if (scriptKeywords.has(value)) {
    return "keyword";
  }

  return nextNonWhitespace(code, endIndex) === ":" ||
    previousNonWhitespace(code, endIndex - value.length) === "."
    ? "property"
    : "text";
}

function previousNonWhitespace(code: string, start: number) {
  let index = start - 1;

  while (index >= 0 && /\s/.test(code[index] ?? "")) {
    index -= 1;
  }

  return code[index] ?? "";
}

export function syntaxTokenClass(kind: SyntaxTokenKind) {
  switch (kind) {
    case "comment":
      return "text-slate-500";
    case "keyword":
      return "font-semibold text-violet-300";
    case "number":
      return "text-orange-300";
    case "property":
      return "text-sky-300";
    case "punctuation":
      return "text-slate-400";
    case "string":
      return "text-emerald-300";
    case "text":
      return "text-slate-100";
  }
}
