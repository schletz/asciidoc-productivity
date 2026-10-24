import { TableRows } from './MarkupSyntax';
import { escapeTableCell, splitTableCells } from './tableCells';

/** Column alignment as declared by the colons in the delimiter row. */
export type ColumnAlignment = 'none' | 'left' | 'center' | 'right';

/** Matches a delimiter row such as `|---|:--:|`; outer pipes are optional. */
const delimiterRowPattern = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/;

/**
 * A GitHub Flavored Markdown table: rows of unescaped cells plus one alignment per column.
 * Every row has as many cells as there are alignments, so the table is always rectangular.
 */
export default class MarkdownTable {
    private constructor(
        public readonly rows: TableRows,
        public readonly alignments: ColumnAlignment[]
    ) { }

    /**
     * Creates a table without alignment markers. Short rows are padded with empty cells.
     * @param rows Table content; the first row is the header.
     */
    public static fromRows(rows: TableRows): MarkdownTable {
        return MarkdownTable.normalized(rows, []);
    }

    /**
     * Reads a table from its source lines. Lines without an unescaped pipe are ignored, the
     * first delimiter row provides the alignments, further delimiter rows are dropped.
     * Unlike GFM, cells beyond the header width are kept and the header is padded instead,
     * so formatting never loses content.
     * @param lines Source lines of the table, with or without indentation.
     */
    public static parse(lines: string[]): MarkdownTable {
        const rows: TableRows = [];
        let alignments: ColumnAlignment[] | undefined;
        for (const line of lines.map(l => l.trim()).filter(MarkdownTable.isRow)) {
            const cells = splitTableCells(line.replace(/^\|/, '').replace(/(?<!\\)\|$/, ''));
            if (MarkdownTable.isDelimiterRow(line)) {
                alignments ??= cells.map(MarkdownTable.alignmentOf);
            } else {
                rows.push(cells);
            }
        }
        return MarkdownTable.normalized(rows, alignments ?? []);
    }

    /**
     * True if the line can belong to a table, i.e. it contains a pipe that is not escaped.
     */
    public static isRow(line: string): boolean {
        return /(?<!\\)\|/.test(line);
    }

    /**
     * True if the trimmed line is a delimiter row such as `| --- | :-: |`.
     */
    public static isDelimiterRow(line: string): boolean {
        return delimiterRowPattern.test(line.trim());
    }

    /**
     * Writes the table with all columns padded to their widest cell, aligned according to the
     * delimiter row. Widths count code points, so wide characters (CJK, emoji) may still look
     * misaligned in the editor.
     * @param indent Prefix for every line, e.g. to keep a table nested in a list.
     * @returns The table lines joined with LF, without a trailing line break; '' for no rows.
     */
    public render(indent: string = ''): string {
        if (this.rows.length === 0) {
            return '';
        }
        const escapedRows = this.rows.map(row => row.map(escapeTableCell));

        // Markdown renderers commonly expect at least three dashes in the delimiter row.
        const widths = this.alignments.map((_, col) =>
            Math.max(3, ...escapedRows.map(row => codePointLength(row[col]))));

        const formatRow = (row: string[]) =>
            `${indent}| ${widths.map((width, col) => align(row[col], width, this.alignments[col])).join(' | ')} |`;
        const delimiterRow =
            `${indent}|${widths.map((width, col) => delimiterCell(width + 2, this.alignments[col])).join('|')}|`;

        const [header, ...body] = escapedRows;
        return [formatRow(header), delimiterRow, ...body.map(formatRow)].join('\n');
    }

    /**
     * Pads rows and alignments to the widest of both.
     */
    private static normalized(rows: TableRows, alignments: ColumnAlignment[]): MarkdownTable {
        const colCount = Math.max(alignments.length, ...rows.map(row => row.length));
        const pad = <T>(values: T[], filler: T) => Array.from({ length: colCount }, (_, col) => values[col] ?? filler);
        return new MarkdownTable(rows.map(row => pad(row, '')), pad(alignments, 'none' as ColumnAlignment));
    }

    private static alignmentOf(delimiterCell: string): ColumnAlignment {
        const left = delimiterCell.startsWith(':');
        const right = delimiterCell.endsWith(':');
        return left && right ? 'center' : right ? 'right' : left ? 'left' : 'none';
    }
}

function codePointLength(text: string): number {
    return [...text].length;
}

/**
 * Pads a cell to the column width; center puts the odd space on the right.
 */
function align(cell: string, width: number, alignment: ColumnAlignment): string {
    const space = width - codePointLength(cell);
    if (alignment === 'right') {
        return ' '.repeat(space) + cell;
    }
    if (alignment === 'center') {
        const before = Math.floor(space / 2);
        return ' '.repeat(before) + cell + ' '.repeat(space - before);
    }
    return cell + ' '.repeat(space);
}

/**
 * Dashes for one delimiter cell including the surrounding spaces, with colons for alignment.
 */
function delimiterCell(length: number, alignment: ColumnAlignment): string {
    switch (alignment) {
        case 'left': return ':' + '-'.repeat(length - 1);
        case 'right': return '-'.repeat(length - 1) + ':';
        case 'center': return ':' + '-'.repeat(length - 2) + ':';
        default: return '-'.repeat(length);
    }
}
