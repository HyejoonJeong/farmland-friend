/** Render the restricted heading/list format as safe React text, never HTML. */
export function BusinessAnswer({ text }: { text: string }) {
  const blocks = text.trim().split(/\n\s*\n/);
  return (
    <div className="space-y-5 break-words">
      {blocks.map((block, index) => {
        const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
        const elements = [];
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (/^#{1,3}\s+/.test(line)) {
            elements.push(
              <h2 key={i} className="text-[21px] leading-relaxed font-bold text-primary">
                {line.replace(/^#{1,3}\s+/, "")}
              </h2>,
            );
          } else if (/^[-•]\s+/.test(line)) {
            const items = [];
            const start = i;
            while (i < lines.length && /^[-•]\s+/.test(lines[i])) {
              items.push(lines[i].replace(/^[-•]\s+/, ""));
              i++;
            }
            i--;
            elements.push(
              <ul key={start} className="list-disc space-y-2 pl-6 marker:text-primary">
                {items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}
              </ul>,
            );
          } else {
            elements.push(<p key={i}>{line}</p>);
          }
        }
        return <section key={index} className="space-y-3">{elements}</section>;
      })}
    </div>
  );
}

export function businessAnswerSpeech(text: string) {
  return text.replace(/^\s*(?:#{1,3}\s+|[-•]\s+)/gm, "");
}