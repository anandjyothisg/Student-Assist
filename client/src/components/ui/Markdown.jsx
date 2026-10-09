import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { copyText } from './clipboard';

/**
 * Markdown — small, dependency-free renderer for AI answers.
 * Supports headings, paragraphs, lists, blockquotes, fenced code, tables,
 * horizontal rules, and inline code / bold / italic / links. Styled by `.prose-ai`.
 */

function CodeBlock({ lang, code }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    if (await copyText(code)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };
  return (
    <div className="not-prose my-4 overflow-hidden rounded-md border border-border bg-[var(--bg-inset)]">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5 text-xs text-fg-3">
        <span className="font-mono">{lang || 'code'}</span>
        <button
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 transition-colors hover:bg-subtle hover:text-fg"
        >
          {copied ? <Check className="size-3.5 text-success" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="!m-0 !rounded-none !border-0"><code>{code}</code></pre>
    </div>
  );
}

const INLINE = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_|\[[^\]]+\]\([^)\s]+\)|\[\d{1,2}\](?!\())/g;

let citeHandler = null; // set per render by <Markdown onCite>

function inline(text, keyBase = 'i') {
  if (!text) return null;
  const parts = text.split(INLINE);
  return parts.map((p, i) => {
    const k = `${keyBase}-${i}`;
    if (!p) return null;
    const cite = p.match(/^\[(\d{1,2})\]$/);
    if (cite) {
      const n = Number(cite[1]);
      const handler = citeHandler;
      return handler ? (
        <button key={k} type="button" className="cite-chip" onClick={() => handler(n)} aria-label={`Source ${n}`}>{n}</button>
      ) : (
        <sup key={k} className="cite-chip">{n}</sup>
      );
    }
    if (p.startsWith('`') && p.endsWith('`') && p.length > 1) return <code key={k}>{p.slice(1, -1)}</code>;
    if ((p.startsWith('**') && p.endsWith('**')) || (p.startsWith('__') && p.endsWith('__'))) return <strong key={k}>{inline(p.slice(2, -2), k)}</strong>;
    if ((p.startsWith('*') && p.endsWith('*')) || (p.startsWith('_') && p.endsWith('_'))) return <em key={k}>{p.slice(1, -1)}</em>;
    const link = p.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (link) {
      const safe = /^(https?:|mailto:)/i.test(link[2]);
      return safe ? <a key={k} href={link[2]} target="_blank" rel="noreferrer noopener">{link[1]}</a> : link[1];
    }
    return p;
  });
}

function parseBlocks(src) {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;

  const isBlank = (l) => !l || !l.trim();
  const startsBlock = (l) => /^(#{1,6}\s|```|>\s?|\s*[-*+]\s|\s*\d+[.)]\s|\|.*\||-{3,}\s*$|\*{3,}\s*$)/.test(l);

  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) { i++; continue; }

    const fence = line.match(/^```(\S*)/);
    if (fence) {
      const body = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) body.push(lines[i++]);
      i++;
      blocks.push({ type: 'code', lang: fence[1], code: body.join('\n') });
      continue;
    }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { blocks.push({ type: 'h', level: h[1].length, text: h[2] }); i++; continue; }

    if (/^(-{3,}|\*{3,})\s*$/.test(line)) { blocks.push({ type: 'hr' }); i++; continue; }

    if (/^>\s?/.test(line)) {
      const body = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push({ type: 'quote', text: body.join(' ') });
      continue;
    }

    if (/^\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const row = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = row(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) rows.push(row(lines[i++]));
      blocks.push({ type: 'table', head, rows });
      continue;
    }

    const ul = /^\s*[-*+]\s+/;
    const ol = /^\s*\d+[.)]\s+/;
    if (ul.test(line) || ol.test(line)) {
      const ordered = ol.test(line);
      const re = ordered ? ol : ul;
      const items = [];
      while (i < lines.length && (re.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && items.length))) {
        if (re.test(lines[i])) items.push(lines[i].replace(re, ''));
        else items[items.length - 1] += ` ${lines[i].trim()}`;
        i++;
      }
      blocks.push({ type: ordered ? 'ol' : 'ul', items });
      continue;
    }

    const para = [line];
    i++;
    while (i < lines.length && !isBlank(lines[i]) && !startsBlock(lines[i])) para.push(lines[i++]);
    blocks.push({ type: 'p', text: para.join('\n') });
  }
  return blocks;
}

export function Markdown({ children, className = '', onCite }) {
  const text = typeof children === 'string' ? children : '';
  const blocks = parseBlocks(text);
  citeHandler = onCite || null;

  return (
    <div className={`prose-ai ${className}`}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'code':
            return <CodeBlock key={i} lang={b.lang} code={b.code} />;
          case 'h': {
            const Tag = b.level <= 2 ? 'h3' : 'h4';
            return <Tag key={i}>{inline(b.text, `h${i}`)}</Tag>;
          }
          case 'hr':
            return <hr key={i} />;
          case 'quote':
            return <blockquote key={i}>{inline(b.text, `q${i}`)}</blockquote>;
          case 'ul':
            return <ul key={i}>{b.items.map((it, j) => <li key={j}>{inline(it, `u${i}${j}`)}</li>)}</ul>;
          case 'ol':
            return <ol key={i}>{b.items.map((it, j) => <li key={j}>{inline(it, `o${i}${j}`)}</li>)}</ol>;
          case 'table':
            return (
              <div key={i} className="table-wrap">
                <table>
                  <thead><tr>{b.head.map((c, j) => <th key={j}>{inline(c, `th${i}${j}`)}</th>)}</tr></thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j}>{r.map((c, k) => <td key={k}>{inline(c, `td${i}${j}${k}`)}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return (
              <p key={i}>
                {b.text.split('\n').map((ln, j, arr) => (
                  <React.Fragment key={j}>{inline(ln, `p${i}${j}`)}{j < arr.length - 1 && <br />}</React.Fragment>
                ))}
              </p>
            );
        }
      })}
    </div>
  );
}
