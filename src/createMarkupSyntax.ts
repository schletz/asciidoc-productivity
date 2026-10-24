import * as path from 'path';
import AsciidocSyntax from './AsciidocSyntax';
import MarkdownSyntax from './MarkdownSyntax';
import MarkupSyntax from './MarkupSyntax';

/** The parts of a vscode.TextDocument needed to pick the syntax. */
export interface MarkupDocument {
    languageId: string;
    fileName: string;
}

/**
 * File extensions used when the language id is unknown. The editor/context menu entries in
 * package.json repeat this list in their when clauses; keep both in sync.
 */
const asciidocExtensions = ['.adoc', '.asciidoc', '.asc'];
const markdownExtensions = ['.md', '.markdown'];

/**
 * Picks the markup syntax for a document. The language id decides first; the file
 * extension is the fallback, because the language id `asciidoc` only exists when an
 * AsciiDoc extension is installed. Without one, .adoc files open as plain text.
 * @param document The document the command works on.
 * @throws Error if the document is neither AsciiDoc nor Markdown.
 */
export function createMarkupSyntax(document: MarkupDocument): MarkupSyntax {
    const extension = path.extname(document.fileName).toLowerCase();
    if (document.languageId === 'asciidoc' || asciidocExtensions.includes(extension)) {
        return new AsciidocSyntax();
    }
    if (document.languageId === 'markdown' || markdownExtensions.includes(extension)) {
        return new MarkdownSyntax();
    }
    throw new Error('Only AsciiDoc and Markdown documents are supported.');
}
