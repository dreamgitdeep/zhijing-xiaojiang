interface Branch {
  title: string;
  leaves: string[];
}

function parseMindMap(text: string): Branch[] {
  const branches: Branch[] = [];
  let current: Branch | null = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const heading = line.match(/^#{1,4}\s+(.+)/);
    if (heading) {
      current = { title: heading[1].replace(/[*_`]/g, ''), leaves: [] };
      branches.push(current);
      continue;
    }
    const bullet = line.match(/^(?:[-*]|\d+[.、])\s+(.+)/);
    const leaf = (bullet ? bullet[1] : line).replace(/[*_`]/g, '');
    if (!current) {
      current = { title: '要点', leaves: [] };
      branches.push(current);
    }
    if (leaf && current.leaves.length < 6) current.leaves.push(leaf);
  }
  return branches.slice(0, 4);
}

export function MindMap({ text, topic }: { text: string; topic: string }) {
  const branches = parseMindMap(text);
  if (!branches.length) {
    return <p className="text-fs-label text-on-surface-variant">该回答暂无可结构化的内容。</p>;
  }
  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <span className="rounded-full bg-primary px-6 py-2 text-fs-sub font-medium text-on-primary shadow-card">
          {topic}
        </span>
      </div>
      <div className="mx-auto h-4 w-px bg-outline-variant/60" />
      <div className="grid gap-3 md:grid-cols-3">
        {branches.map((b) => (
          <div key={b.title} className="rounded-xl border-neo border-outline-variant/25 bg-surface-container/60 p-3">
            <div className="mb-2 flex justify-center">
              <span className="rounded-full bg-primary-container px-3 py-1 text-fs-label font-medium text-on-primary-container">
                {b.title}
              </span>
            </div>
            <ul className="space-y-1.5">
              {b.leaves.map((l, i) => (
                <li key={i} className="rounded-lg bg-surface px-2.5 py-1.5 text-fs-label leading-relaxed text-on-surface-variant shadow-card">
                  {l}
                </li>
              ))}
              {!b.leaves.length && (
                <li className="px-2.5 text-fs-label text-on-surface-variant/60">（见文字版）</li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
