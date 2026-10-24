import * as path from 'path';
import MarkdownTable from './MarkdownTable';
import MarkupSyntax, { FormattedTable, TableRows } from './MarkupSyntax';

/**
 * Markup generation and parsing for Markdown (CommonMark / GitHub Flavored Markdown).
 */
export default class MarkdownSyntax implements MarkupSyntax {
    public sourceBlock(content: string, language?: string): string {
        // A line in the content starting with a fence at least as long as the opening one
        // would close the block early, so the fence is made longer than any such line.
        const innerFences = content.match(/^ {0,3}`{3,}/gm) ?? [];
        const longestInner = Math.max(0, ...innerFences.map(fence => fence.trim().length));
        const fence = '`'.repeat(Math.max(3, longestInner + 1));
        return `${fence}${language?.trim() ?? ''}\n${content}\n${fence}\n`;
    }

    public fileSourceBlock(content: string, language: string | undefined, relativePath: string, fileName: string): string {
        // Markdown has no block titles, so the link is a separate line above the fence.
        return `[→ ${this.escapeLinkText(fileName)}](${this.linkDestination(relativePath)})\n`
            + this.sourceBlock(content, language);
    }

    public image(relativePath: string): string {
        // Asciidoctor derives the alt text from the file name as well.
        const altText = this.escapeLinkText(path.posix.parse(relativePath).name);
        return `![${altText}](${this.linkDestination(relativePath)})\n`;
    }

    public imageWithSource(relativePath: string, sourceUrl: string): string {
        // A link title would only be a tooltip; the AsciiDoc counterpart is a visible caption.
        return `${this.image(relativePath)}\n*Source: <${sourceUrl}>*\n`;
    }

    /**
     * Pads all columns to their widest cell so the table is aligned in the source as well.
     */
    public table(rows: TableRows): string {
        return rows.length === 0 ? '' : MarkdownTable.fromRows(rows).render() + '\n';
    }

    /**
     * Reads every line containing an unescaped pipe as a row and skips the delimiter row.
     * Leading and trailing pipes are optional, as in GitHub Flavored Markdown.
     */
    public parseTable(text: string): TableRows {
        return MarkdownTable.parse(text.split(/\r?\n/)).rows;
    }

    /**
     * A table is the block of consecutive lines with an unescaped pipe around the given line,
     * whose second line is a delimiter row. The indentation of its first line is kept.
     */
    public formatTableAt(lines: string[], line: number): FormattedTable | undefined {
        if (!MarkdownTable.isRow(lines[line] ?? '')) {
            return undefined;
        }
        let startLine = line;
        while (startLine > 0 && MarkdownTable.isRow(lines[startLine - 1])) {
            startLine--;
        }
        let endLine = line;
        while (endLine < lines.length - 1 && MarkdownTable.isRow(lines[endLine + 1])) {
            endLine++;
        }
        if (endLine === startLine || !MarkdownTable.isDelimiterRow(lines[startLine + 1])) {
            return undefined;
        }

        const indent = lines[startLine].match(/^\s*/)![0];
        const text = MarkdownTable.parse(lines.slice(startLine, endLine + 1)).render(indent);
        return { startLine, endLine, text };
    }

    /**
     * Brackets in a link text would end it early.
     */
    private escapeLinkText(text: string): string {
        return text.replace(/([[\]])/g, '\\$1');
    }

    /**
     * A link destination with spaces must be enclosed in angle brackets (CommonMark).
     */
    private linkDestination(relativePath: string): string {
        return relativePath.includes(' ') ? `<${relativePath}>` : relativePath;
    }
}
