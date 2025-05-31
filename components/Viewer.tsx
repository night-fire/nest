
import React, { useState, useEffect, useRef } from 'react';
import { micromark } from 'micromark';
import { gfm, gfmHtml } from 'micromark-extension-gfm';
import { math, mathHtml } from 'micromark-extension-math';
import { directive, directiveHtml } from 'micromark-extension-directive';
import { footnote, footnoteHtml } from 'micromark-extension-footnote'; // Import footnote plugins
import katex from 'katex';
import type { FrontmatterData } from '../types'; 

interface ViewerProps {
  frontmatterData: FrontmatterData;
  contentMarkdown: string;
}

const FrontmatterDisplay: React.FC<{ data: NonNullable<FrontmatterData> }> = ({ data }) => {
  if (Object.keys(data).length === 0) {
    return null;
  }

  return (
    <div className="mb-6 p-4 border border-slate-200 rounded-lg shadow-sm bg-slate-50">
      <h4 className="text-lg font-display font-semibold text-sky-700 mb-3 border-b border-slate-300 pb-2">Document Metadata</h4>
      <dl className="space-y-1.5 text-sm">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="grid grid-cols-1 md:grid-cols-4 gap-x-2">
            <dt className="font-medium text-slate-500 capitalize md:col-span-1">{key.replace(/_/g, ' ')}:</dt>
            <dd className="text-slate-700 md:col-span-3 break-words">
              {Array.isArray(value)
                ? value.map((item, index) => (
                    <span 
                      key={index} 
                      className="inline-block bg-sky-100 text-sky-800 text-xs font-medium mr-1.5 mb-1 px-2 py-0.5 rounded-full shadow-xs"
                    >
                      {String(item)}
                    </span>
                  ))
                : typeof value === 'boolean' 
                ? <span className={`font-semibold ${value ? 'text-green-600' : 'text-red-600'}`}>{value ? 'Yes' : 'No'}</span>
                : String(value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
};


const Viewer: React.FC<ViewerProps> = ({ frontmatterData, contentMarkdown }) => {
  const [htmlContent, setHtmlContent] = useState<string>('');
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const generatedHtml = micromark(contentMarkdown, {
      allowDangerousHtml: true,
      extensions: [gfm(), math(), directive(), footnote()], // Added footnote
      htmlExtensions: [gfmHtml(), mathHtml(), directiveHtml(), footnoteHtml({label: 'Footnotes', backLabel: 'Back to content'})], // Added footnoteHtml
    });
    setHtmlContent(generatedHtml);
  }, [contentMarkdown]);

  useEffect(() => {
    if (htmlContent && contentRef.current) {
      contentRef.current.querySelectorAll('code.language-math.math-inline').forEach((el) => {
        try {
          katex.render(el.textContent || '', el as HTMLElement, {
            throwOnError: false,
            displayMode: false,
          });
        } catch (e) {
          console.error('KaTeX inline rendering error:', e);
          el.textContent = `KaTeX Error: ${e instanceof Error ? e.message : String(e)}`;
        }
      });
      contentRef.current.querySelectorAll('code.language-math.math-display').forEach((el) => {
        try {
          katex.render(el.textContent || '', el as HTMLElement, {
            throwOnError: false,
            displayMode: true,
          });
        } catch (e) {
          console.error('KaTeX display rendering error:', e);
           el.textContent = `KaTeX Error: ${e instanceof Error ? e.message : String(e)}`;
        }
      });
    }
  }, [htmlContent]);

  return (
    <div 
      className="w-full h-full flex-grow p-4 md:p-6 bg-white border border-slate-300 rounded-lg overflow-auto select-text shadow-sm" 
    >
      <style>{`
        .prose-styles h1 { font-size: 2em; font-weight: 700; margin-top: 1.25em; margin-bottom: 0.6em; }
        .prose-styles h2 { font-size: 1.6em; font-weight: 600; margin-top: 1em; margin-bottom: 0.5em; }
        .prose-styles h3 { font-size: 1.3em; font-weight: 600; margin-top: 0.8em; margin-bottom: 0.4em; }
        .prose-styles p { margin-bottom: 0.8em; line-height: 1.65; font-size: 0.95rem; }
        .prose-styles ul, .prose-styles ol { margin-left: 1.25em; margin-bottom: 0.8em; font-size: 0.95rem; }
        .prose-styles li { margin-bottom: 0.4em; }
        .prose-styles li > ul, .prose-styles li > ol { margin-top: 0.4em; }
        .prose-styles blockquote { border-left: 3px solid #94a3b8; /* slate-400 */ padding-left: 1em; margin-left: 0; margin-right: 0; margin-bottom: 1em; font-style: italic; color: #475569; /* slate-600 */ }
        /* code:not(.language-math) handled by global styles in index.html */
        /* pre:not(.math) handled by global styles in index.html */
        .prose-styles table { width: auto; border-collapse: collapse; margin-bottom: 1em; font-size: 0.9rem; }
        .prose-styles th, .prose-styles td { border: 1px solid #cbd5e1; /* slate-300 */ padding: 0.4em 0.6em; }
        .prose-styles th { background-color: #e2e8f0; /* slate-200 */ font-weight: 600; }
        .prose-styles img { max-width: 100%; height: auto; border-radius: 0.375rem; margin-top: 0.5em; margin-bottom: 0.5em; border: 1px solid #e2e8f0; }
        .prose-styles hr { border-top: 1px solid #cbd5e1; /* slate-300 */ margin: 1.5em 0; }
        .prose-styles input[type="checkbox"] { margin-right: 0.5em; transform: scale(0.9); }

        .katex { color: #1e293b; font-size: 1.05em; } /* slate-800 */
        .katex-display { color: #1e293b; padding: 0.5em 0; } /* slate-800 */
        
        .prose-styles pre.math.math-display { background-color: transparent; border: none; padding: 0; margin-bottom: 1em; overflow-x: auto; }
        .prose-styles pre.math.math-display code.language-math.math-display { background-color: transparent !important; color: inherit !important; padding: 0 !important; border-radius: 0 !important; }
        
        /* Directive Styles */
        .prose-styles div[name="note"] { background-color: #e0f2fe; /* sky-100 */ border: 1px solid #bae6fd; /* sky-200 */ color: #0369a1; /* sky-700 */ padding: 1rem; border-radius: 0.375rem; margin-top: 1em; margin-bottom: 1em; font-size: 0.9rem; }
        .prose-styles div[name="note"] p:last-child { margin-bottom: 0; }
        .prose-styles span[name="highlight"] { background-color: #fef9c3; /* yellow-100 */ padding: 0.1em 0.3em; border-radius: 0.2em; }

        .prose-styles .custom-note-class { background-color: #fef3c7; /* amber-100 */ border: 1px solid #fde68a; /* amber-200 */ color: #92400e; /* amber-800 */ padding: 1rem; border-radius: 0.375rem; margin-top: 1em; margin-bottom: 1em; font-size: 0.9rem; }
        .prose-styles .custom-note-class p:last-child { margin-bottom: 0; }
        .prose-styles .custom-highlight-class { background-color: #e0e7ff; /* indigo-100 */ color: #3730a3; /* indigo-800 */ padding: 0.1em 0.3em; border-radius: 0.2em; font-weight: 500; }

        /* Footnote specific styles for Viewer - these will complement the global ones from index.html */
        .prose-styles .footnotes-title { /* If footnoteHtml generates a title with this class */
          font-size: 1.2em;
          font-weight: 600;
          margin-top: 1.5em;
          margin-bottom: 0.5em;
          color: #1e293b; /* slate-800 */
        }
      `}</style>
      {frontmatterData && <FrontmatterDisplay data={frontmatterData} />}
      <div ref={contentRef} className="prose-styles" dangerouslySetInnerHTML={{ __html: htmlContent }} />
    </div>
  );
};

export default Viewer;
