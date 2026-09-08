import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

const mdComponents = {
  p: ({ children }) => <p className="mb-2 last:mb-0 text-slate-600">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1 text-slate-600">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1 text-slate-600">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-slate-800">{children}</strong>,
  code: ({ children, className }) => {
    const isBlock = className?.includes('language-');
    if (isBlock) {
      return <code className={className}>{children}</code>;
    }
    return (
      <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-primary-dark font-mono">{children}</code>
    );
  },
};

/** Markdown collapses single newlines — keep question lines readable. */
export function markdownWithLineBreaks(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/\r\n/g, '\n').replace(/\n/g, '  \n');
}

/**
 * Markdown + LaTeX ($inline$ and $$display$$) for assignment instructions.
 * Invalid LaTeX is skipped by KaTeX when throwOnError is false.
 */
export default function MarkdownMath({ markdown, className = '' }) {
  return (
    <div className={`markdown-math ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
        components={mdComponents}
      >
        {markdownWithLineBreaks(markdown || '')}
      </ReactMarkdown>
    </div>
  );
}
