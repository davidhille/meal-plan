import { describe, expect, test } from 'bun:test';
import { markdownToStorage, inline } from './markdown';

describe('inline', () => {
  test('fett, kursiv, Code, Link', () => {
    expect(inline('**a** *b* `c<d` [x](https://e.de)')).toBe(
      '<strong>a</strong> <em>b</em> <code>c&lt;d</code> <a href="https://e.de">x</a>',
    );
  });
  test('Code bleibt unberührt', () => {
    expect(inline('`**x**`')).toBe('<code>**x**</code>');
  });
});

describe('markdownToStorage', () => {
  test('Überschrift, Absatz, Trennlinie', () => {
    expect(markdownToStorage('## Titel\n\nEin\nAbsatz\n\n---')).toBe('<h2>Titel</h2>\n<p>Ein Absatz</p>\n<hr />');
  });
  test('verschachtelte Liste mit Fortsetzungszeile', () => {
    const html = markdownToStorage('- eins\n  weiter\n  - sub\n- zwei');
    expect(html).toBe('<ul><li>eins weiter<ul><li>sub</li></ul></li><li>zwei</li></ul>');
  });
  test('Tabelle', () => {
    const html = markdownToStorage('| A | B |\n|---|---|\n| 1 | `x` |');
    expect(html).toBe('<table><tbody><tr><th>A</th><th>B</th></tr><tr><td>1</td><td><code>x</code></td></tr></tbody></table>');
  });
  test('Codeblock als Makro', () => {
    expect(markdownToStorage('```bash\nbun test\n```')).toContain('<![CDATA[bun test]]>');
  });
  test('PROJEKTUEBERSICHT.md lässt sich komplett wandeln', async () => {
    const md = await Bun.file(new URL('../../PROJEKTUEBERSICHT.md', import.meta.url)).text();
    const html = markdownToStorage(md);
    expect(html).toContain('<h2>1. Speiseplan</h2>');
    expect(html).not.toContain('**');
    expect((html.match(/<ul>/g) ?? []).length).toBe((html.match(/<\/ul>/g) ?? []).length);
  });
});
