/**
 * SqlBlock component for QueryWiz
 * Implements react-syntax-highlighter with custom brand overrides:
 * - Keywords: #C9A84C (ancient gold)
 * - Strings: #e8e8e8 (light grey)
 */
import React, { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check } from "lucide-react";

interface SqlBlockProps {
  sql: string;
}

export function SqlBlock({ sql }: SqlBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <div className="flex flex-col h-full gap-3 overflow-hidden">
      {/* Label and Copy button inline as shown in design HTML */}
      <div className="flex justify-between items-center text-xs">
        <h3 className="gold-text uppercase tracking-widest font-mono font-medium">Generated SQL</h3>
        <button
          type="button"
          id="copy-sql-btn"
          onClick={handleCopy}
          className="text-[10px] uppercase font-mono gold-border px-2.5 py-1 rounded opacity-60 hover:opacity-100 bg-[#111111]/60 text-[#e8e8e8] duration-200 cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-500" />
              <span className="text-emerald-500 font-bold">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 text-[#C9A84C]" />
              <span>Copy SQL</span>
            </>
          )}
        </button>
      </div>

      {/* Code syntax container with gold-border, and custom overrides */}
      <div className="relative flex-1 bg-[#111] gold-border rounded-lg p-2.5 jetbrains text-xs leading-relaxed overflow-auto max-h-[350px] md:max-h-full">
        {/* Scoped CSS Injector to guarantee color overrides of the token parser */}
        <style dangerouslySetInnerHTML={{ __html: `
          .querywiz-prism pre {
            background: #111111 !important;
            margin: 0 !important;
            padding: 8px !important;
          }
          .querywiz-prism code {
            font-family: var(--font-mono), monospace !important;
            text-shadow: none !important;
          }
          /* Custom core overrides */
          .querywiz-prism .token.keyword {
            color: #C9A84C !important;
            font-weight: bold !important;
          }
          .querywiz-prism .token.string {
            color: #e8e8e8 !important;
          }
          .querywiz-prism .token.function {
            color: #d1b87a !important;
          }
          .querywiz-prism .token.number {
            color: #dfce9f !important;
          }
          .querywiz-prism .token.comment {
            color: #4b5563 !important;
          }
          .querywiz-prism .token.punctuation {
            color: #9ca3af !important;
          }
          .querywiz-prism .token.operator {
            color: #C9A84C !important;
          }
        `}} />

        <div className="querywiz-prism">
          <SyntaxHighlighter
            language="sql"
            style={atomDark}
            showLineNumbers={true}
            wrapLines={true}
            customStyle={{
              background: "#111111",
              fontSize: "12px",
              lineHeight: "1.7",
              fontFamily: "var(--font-mono), monospace",
            }}
          >
            {sql}
          </SyntaxHighlighter>
        </div>
      </div>
    </div>
  );
}
