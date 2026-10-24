import MarkupSyntax, { TableRows } from './MarkupSyntax';
import { escapeTableCell, splitTableCells } from './tableCells';

/**
 * Markup generation and parsing for AsciiDoc documents.
 */
export default class AsciidocSyntax implements MarkupSyntax {
    public sourceBlock(content: string, language?: string): string {
        const langDef = language?.trim() ? `,${language.trim()}` : '';
        return `[source${langDef}]\n----\n${content}\n----\n`;
    }

    public fileSourceBlock(content: string, language: string | undefined, relativePath: string, fileName: string): string {
        return `.link:${relativePath}[→ ${fileName}]\n${this.sourceBlock(content, language)}`;
    }

    public image(relativePath: string): string {
        return `image::${relativePath}[]\n`;
    }

    public imageWithSource(relativePath: string, sourceUrl: string): string {
        // The block title is rendered as a visible caption below the image.
        return `.Source: ${sourceUrl}\n${this.image(relativePath)}`;
    }

    /**
     * Writes every cell on its own line, rows separated by a blank line. {@link parseTable}
     * relies on exactly this layout.
     */
    public table(rows: TableRows): string {
        if (rows.length === 0) {
            return '';
        }
        const cols = Array(rows[0].length).fill('a').join(',');
        const body = rows
            .map(row => row.map(cell => `|${escapeTableCell(cell)}`).join('\n'))
            .join('\n\n');
        return `[%header,cols="${cols}"]\n|===\n${body}\n|===\n`;
    }

    /**
     * Only reads the layout written by {@link table}: rows are separated by at least one
     * blank line. Rows written on a single line (`|a |b`) end up as one row.
     */
    public parseTable(text: string): TableRows {
        // Isolate individual table rows after removing the table delimiters.
        const rowTexts = text.replace(/^\|===/gm, '').trim().split(/(?:\r?\n){2,}/);
        if (rowTexts.length === 1 && rowTexts[0] === '') {
            return [];
        }
        return rowTexts.map(row => splitTableCells(row.replace(/^\|/, '')));
    }
}
