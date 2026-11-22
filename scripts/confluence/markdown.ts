// Markdown → Confluence-Speicherformat (storage). Bewusst klein: nur, was PROJEKTUEBERSICHT.md nutzt
// (Überschriften, Absätze, verschachtelte Listen, Tabellen, Codeblöcke, Trennlinien, **fett**, *kursiv*, `code`, [Link](url)).

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Inline-Formatierung. `code` zuerst herauslösen, damit darin nichts umgewandelt wird. */
export function inline(text: string): string {
  const codes: string[] = [];
  let s = text.replace(/`([^`]+)`/g, (_m, c: string) => {
    codes.push(`<code>${escapeHtml(c)}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  s = escapeHtml(s);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, t: string, u: string) => `<a href="${u.replace(/"/g, '&quot;')}">${t}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?![*\w])/g, '$1<em>$2</em>');
  // eslint-disable-next-line no-control-regex
  return s.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => codes[Number(i)]);
}

const BULLET = /^(\s*)([-*]|\d+\.)\s+(.*)$/;

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

function splitRow(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

/** Liste ab `start` (alle Zeilen mit mindestens dieser Einrückung); gibt HTML und den nächsten Zeilenindex zurück. */
function renderList(lines: string[], start: number): { html: string; next: number } {
  const first = BULLET.exec(lines[start])!;
  const base = first[1].length;
  const ordered = /\d/.test(first[2]);
  const items: string[] = [];
  let i = start;
  while (i < lines.length) {
    const m = BULLET.exec(lines[i]);
    if (!m || m[1].length !== base) break;
    let text = m[3];
    let nestedHtml = '';
    i++;
    while (i < lines.length) {
      const line = lines[i];
      if (line.trim() === '') break;
      const sub = BULLET.exec(line);
      if (sub && sub[1].length > base) {
        const nested = renderList(lines, i);
        nestedHtml += nested.html;
        i = nested.next;
      } else if (sub) {
        break;
      } else if (indentOf(line) > base) {
        text += ' ' + line.trim();
        i++;
      } else {
        break;
      }
    }
    items.push(`<li>${inline(text)}${nestedHtml}</li>`);
    // Leerzeile zwischen Einträgen derselben Liste überspringen
    if (i < lines.length && lines[i].trim() === '' && i + 1 < lines.length) {
      const peek = BULLET.exec(lines[i + 1]);
      if (peek && peek[1].length === base) i++;
    }
  }
  const tag = ordered ? 'ol' : 'ul';
  return { html: `<${tag}>${items.join('')}</${tag}>`, next: i };
}

export function markdownToStorage(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      i++;
      continue;
    }
    const fence = /^```(\w*)\s*$/.exec(line);
    if (fence) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) code.push(lines[i++]);
      i++;
      const lang = fence[1] ? `<ac:parameter ac:name="language">${fence[1]}</ac:parameter>` : '';
      out.push(
        `<ac:structured-macro ac:name="code">${lang}<ac:plain-text-body><![CDATA[${code.join('\n').replace(/]]>/g, ']]]]><![CDATA[>')}]]></ac:plain-text-body></ac:structured-macro>`,
      );
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);
      i++;
      continue;
    }
    if (/^-{3,}\s*$/.test(line)) {
      out.push('<hr />');
      i++;
      continue;
    }
    if (line.trim().startsWith('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(splitRow(lines[i++]));
      out.push(
        `<table><tbody><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr>` +
          rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('') +
          '</tbody></table>',
      );
      continue;
    }
    if (BULLET.test(line)) {
      const list = renderList(lines, i);
      out.push(list.html);
      i = list.next;
      continue;
    }
    // Absatz: Zeilen bis zur nächsten Leerzeile oder einem anderen Block
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,6}\s|```|-{3,}\s*$)/.test(lines[i]) &&
      !BULLET.test(lines[i]) &&
      !lines[i].trim().startsWith('|')
    ) {
      para.push(lines[i++].trim());
    }
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return out.join('\n');
}

export function infoPanel(html: string): string {
  return `<ac:structured-macro ac:name="info"><ac:rich-text-body><p>${html}</p></ac:rich-text-body></ac:structured-macro>`;
}
