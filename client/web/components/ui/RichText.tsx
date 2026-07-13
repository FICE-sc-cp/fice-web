import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function RichText({
  text,
  linkClassName,
}: {
  text: string;
  linkClassName?: string;
}) {
  const nodes: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const href = match[2];
    const external = /^https?:\/\//.test(href);
    nodes.push(
      <a
        key={key++}
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        className={cn(
          "font-semibold underline underline-offset-2 transition-opacity hover:opacity-70",
          linkClassName,
        )}
      >
        {match[1]}
      </a>,
    );
    last = match.index + match[0].length;
  }

  if (last < text.length) nodes.push(text.slice(last));

  return <>{nodes}</>;
}
