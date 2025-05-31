
import yaml from 'js-yaml';
import { micromark } from 'micromark';
import { gfm, gfmHtml } from 'micromark-extension-gfm';
import { math, mathHtml } from 'micromark-extension-math';
import { directive, directiveHtml } from 'micromark-extension-directive';
import { footnote, footnoteHtml } from 'micromark-extension-footnote';
import type { FrontmatterData } from './types';

export const parseMarkdownWithFrontmatter = (text: string): {
  frontmatter: FrontmatterData;
  content: string;
} => {
  const frontmatterRegex = /^---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*[\r\n]?([\s\S]*)$/;
  const match = text.match(frontmatterRegex);

  if (match && match[1]) {
    try {
      const fmData = yaml.load(match[1]) as Record<string, any>;
      if (typeof fmData === 'object' && fmData !== null && !Array.isArray(fmData)) {
         return { frontmatter: fmData, content: match[2] || '' };
      }
    } catch (e) {
      console.warn('Failed to parse frontmatter YAML:', e);
    }
  }
  return { frontmatter: null, content: text };
};

export const getProseStylesForHtmlDownload = (
    currentFileContent: string, 
    currentFileName: string
): string => { 
  // Note: parseMarkdownWithFrontmatter is now locally available or imported if in separate module
  const { frontmatter: currentFrontmatter } = parseMarkdownWithFrontmatter(currentFileContent);
  const docTitleFromFrontmatter = currentFrontmatter?.title ? String(currentFrontmatter.title) : currentFileName.replace(/\.[^/.]+$/, "");
  
  // This function now assumes `currentFileContent` and `currentFileName` are passed if needed for context,
  // or it generates styles generally. The original App.tsx version used these for the title.
  // For now, I'll keep the structure for styling similar, but it could be made more generic.

  return `
    body { font-family: 'Inter', sans-serif; margin: 0; padding: 20px; background-color: #fff; color: #1e293b; line-height: 1.6; }
    .frontmatter-display { margin-bottom: 2rem; padding: 1rem; border: 1px solid #e2e8f0; border-radius: 0.375rem; background-color: #f8fafc; }
    .frontmatter-display h4 { font-size: 1.25rem; font-weight: 600; color: #0284c7; margin-bottom: 0.75rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; }
    .frontmatter-display pre { background-color: #f1f5f9; color: #1e293b; padding: 0.5rem; border-radius: 0.25rem; white-space: pre-wrap; font-family: monospace; font-size: 0.875em; }
    h1 { font-size: 2.25em; font-weight: bold; margin-top: 1em; margin-bottom: 0.5em; color: #0f172a; }
    h2 { font-size: 1.875em; font-weight: bold; margin-top: 0.8em; margin-bottom: 0.4em; color: #0f172a; }
    h3 { font-size: 1.5em; font-weight: bold; margin-top: 0.7em; margin-bottom: 0.3em; color: #0f172a; }
    p { margin-bottom: 1em; line-height: 1.6; color: #334155; }
    ul, ol { margin-left: 1.5em; margin-bottom: 1em; color: #334155; }
    li { margin-bottom: 0.5em; }
    li > ul, li > ol { margin-top: 0.5em; }
    blockquote { border-left: 4px solid #cbd5e1; padding-left: 1em; margin-left: 0; margin-right: 0; margin-bottom: 1em; font-style: italic; color: #475569; }
    code:not(.language-math) { background-color: #e2e8f0; color: #0f172a; padding: 0.2em 0.4em; border-radius: 0.25em; font-family: monospace; border: 1px solid #cbd5e1;}
    pre:not(.math) { background-color: #f1f5f9; border: 1px solid #e2e8f0; color: #0f172a; padding: 1em; border-radius: 0.375em; overflow-x: auto; margin-bottom: 1em; }
    pre:not(.math) code:not(.language-math) { background-color: transparent; padding: 0; border-radius: 0; border: none; font-family: monospace; }
    a { color: #0ea5e9; text-decoration: underline; }
    a:hover { color: #0284c7; }
    table { width: auto; border-collapse: collapse; margin-bottom: 1em; }
    th, td { border: 1px solid #cbd5e1; padding: 0.5em 0.75em; color: #334155; }
    th { background-color: #e2e8f0; font-weight: bold; }
    img { max-width: 100%; height: auto; border-radius: 0.375em; margin-top: 0.5em; margin-bottom: 0.5em; }
    hr { border-top: 1px solid #cbd5e1; margin: 2em 0; }
    input[type="checkbox"] { margin-right: 0.5em; }
    .katex { color: #1e293b; font-size: 1.1em; } 
    .katex-display { color: #1e293b; padding: 0.5em 0; } 
    div[name="note"] { background-color: #e0f2fe; border: 1px solid #bae6fd; padding: 1rem; border-radius: 0.375rem; margin-top: 1em; margin-bottom: 1em; }
    div[name="note"] p:last-child { margin-bottom: 0; }
    span[name="highlight"] { background-color: #fef9c3; padding: 0.1em 0.3em; border-radius: 0.2em; }
    .custom-note-class { background-color: #fef3c7; border: 1px solid #fde68a; color: #92400e; padding: 1rem; border-radius: 0.375rem; margin-top: 1em; margin-bottom: 1em; }
    .custom-note-class p:last-child { margin-bottom: 0; }
    .custom-highlight-class { background-color: #e0e7ff; color: #3730a3; padding: 0.1em 0.3em; border-radius: 0.2em; font-weight: 500; }

    /* Footnote styles for HTML download */
    a[data-footnote-ref] { font-size: 0.8em; vertical-align: super; line-height: 0; text-decoration: none; color: #0284c7; padding: 0 0.1em; }
    a[data-footnote-ref]:hover { color: #0369a1; background-color: #e0f2fe; border-radius: 0.2em; }
    hr.footnotes-sep { margin-top: 2em; margin-bottom: 1em; border-top: 1px solid #cbd5e1; }
    section.footnotes { font-size: 0.9em; color: #475569; }
    .footnotes-list { padding-left: 1.5em; list-style-type: decimal; }
    .footnotes-list li { margin-bottom: 0.5em; }
    .footnotes-list li p { font-size: inherit; color: inherit; margin-bottom: 0.3em; display: inline; }
    .footnotes-list li p:last-child { margin-bottom: 0; }
    a[data-footnote-backref] { font-family: sans-serif; text-decoration: none; color: #0284c7; }
    a[data-footnote-backref]:hover { color: #0369a1; }
    `;
};
