import { TOKEN_CLASSES, tokenizeLine } from "@/lib/highlight";

interface CodeBlockProps {
  code: string;
  startLine?: number;
  vulnerableLine?: number | null;
  className?: string;
}

/** Lightly syntax-highlighted code block with an optional marked "vulnerable" line. */
export default function CodeBlock({ code, startLine = 1, vulnerableLine, className = "" }: CodeBlockProps) {
  const lines = code.split("\n");

  return (
    <div className={`overflow-x-auto rounded-md border border-border bg-app font-mono text-[12.5px] leading-relaxed ${className}`}>
      {lines.map((line, index) => {
        const lineNumber = startLine + index;
        const isVulnerable = vulnerableLine === lineNumber;
        return (
          <div key={index}>
            {isVulnerable && (
              <div className="border-l-2 border-critical bg-critical/10 px-3 py-1 text-[11px] italic text-critical/80">
                {"// VULNERABLE LINE BELOW"}
              </div>
            )}
            <div
              className={`flex px-3 py-0.5 ${
                isVulnerable ? "border-l-2 border-critical bg-critical/10" : "border-l-2 border-transparent"
              }`}
            >
              <span className="mr-4 w-6 shrink-0 select-none text-right text-secondary/50">{lineNumber}</span>
              <span className="whitespace-pre">
                {tokenizeLine(line).map((token, tokenIndex) => (
                  <span key={tokenIndex} className={TOKEN_CLASSES[token.type]}>
                    {token.text}
                  </span>
                ))}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
