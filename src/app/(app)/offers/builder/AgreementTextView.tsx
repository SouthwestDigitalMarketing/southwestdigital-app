function isBulletLine(line: string) {
  return /^\s*•\s+/.test(line);
}

function parseDefinitionLine(line: string): [string, string] | null {
  const match = line.replace(/^\s+/, "").match(/^([A-Za-z][\w /&'-]*):\s{2,}(.*)$/);
  return match ? [match[1], match[2].trim()] : null;
}

type ParsedParagraph =
  | { type: "list"; items: string[] }
  | { type: "clause"; number: string; heading: string; body: string }
  | { type: "definitionList"; rows: [string, string][] }
  | { type: "text"; text: string };

function parseParagraph(chunk: string): ParsedParagraph {
  const lines = chunk.split("\n").filter((line) => line.length > 0);
  if (lines.length > 0 && lines.every(isBulletLine)) {
    return { type: "list", items: lines.map((line) => line.replace(/^\s*•\s+/, "")) };
  }
  const clauseMatch = lines[0]?.match(/^(\d+)\.\s+(.+)$/);
  if (clauseMatch && lines.length > 1) {
    return { type: "clause", number: clauseMatch[1], heading: clauseMatch[2], body: lines.slice(1).join(" ") };
  }
  const definitionRows = lines.map(parseDefinitionLine);
  if (definitionRows.length > 0 && definitionRows.every((row): row is [string, string] => row !== null)) {
    return { type: "definitionList", rows: definitionRows as [string, string][] };
  }
  return { type: "text", text: chunk };
}

function parseAgreementSections(text: string) {
  return text
    .split("\n\n\n")
    .map((section) => section.split("\n"))
    .filter((lines) => lines[0]?.trim())
    .map((lines) => ({
      title: lines[0],
      paragraphs: lines.slice(2).join("\n").trim().split("\n\n").filter(Boolean).map(parseParagraph),
    }));
}

export default function AgreementTextView({ text }: { text: string }) {
  const sections = parseAgreementSections(text);
  return (
    <div className="space-y-6">
      {sections.map(({ title, paragraphs }, sectionIndex) => (
        <section key={sectionIndex}>
          <h3 className="text-base font-bold text-brandnavy">{title}</h3>
          <div className="mt-1.5 space-y-2.5 pl-2">
            {paragraphs.map((paragraph, index) => {
              if (paragraph.type === "list") {
                return (
                  <ul key={index} className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-700">
                    {paragraph.items.map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                );
              }
              if (paragraph.type === "clause") {
                return (
                  <div key={index}>
                    <p className="text-sm font-semibold text-slate-900">{paragraph.number}. {paragraph.heading}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-slate-700">{paragraph.body}</p>
                  </div>
                );
              }
              if (paragraph.type === "definitionList") {
                return (
                  <table key={index} className="border-collapse text-sm">
                    <tbody>
                      {paragraph.rows.map(([label, value], rowIndex) => (
                        <tr key={rowIndex} className="border-b border-slate-100 last:border-b-0">
                          <td className="whitespace-nowrap py-1 pr-4 align-top font-semibold text-slate-900">{label}</td>
                          <td className="py-1 align-top text-slate-700">{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              }
              return (
                <p key={index} className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{paragraph.text}</p>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
