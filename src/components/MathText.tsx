"use client";
// Renders text containing inline $...$ / display $$...$$ LaTeX via KaTeX.
// Non-math segments render as plain text (whitespace preserved).
import katex from "katex";
import "katex/dist/katex.min.css";
import { useMemo } from "react";

function renderSegment(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, { displayMode, throwOnError: false });
  } catch {
    return tex;
  }
}

export default function MathText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const html = useMemo(() => {
    const escape = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    // Split on $$...$$ first, then $...$ inside the remaining plain parts.
    return text
      .split(/(\$\$[\s\S]+?\$\$)/g)
      .map((part) => {
        if (part.startsWith("$$") && part.endsWith("$$")) {
          return renderSegment(part.slice(2, -2), true);
        }
        return part
          .split(/(\$[^$\n]+?\$)/g)
          .map((seg) =>
            seg.startsWith("$") && seg.endsWith("$") && seg.length > 2
              ? renderSegment(seg.slice(1, -1), false)
              : escape(seg),
          )
          .join("");
      })
      .join("");
  }, [text]);

  return (
    <span
      className={`whitespace-pre-wrap [&_.katex-display]:my-2 ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
