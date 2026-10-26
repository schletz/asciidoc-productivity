import { TableRows } from './MarkupSyntax';

/**
 * Splits delimited text into table rows: every line is a row, the delimiter separates the cells.
 * Cells are trimmed and shorter rows are padded with empty cells, so every row has as many
 * cells as the widest one.
 * @param text The delimited text. Lines may end with LF or CRLF.
 * @param delimiter Literal string between two cells, e.g. '\t' or ';'. Must not be empty.
 * @returns The rows, or an empty array if the input has no rows.
 */
export function parseDelimited(text: string, delimiter: string): TableRows {
    // Only strip trailing line breaks: trailing delimiters represent empty cells in the last row.
    const lines = text.replace(/(\r?\n)+$/, '').split(/\r?\n/);
    if (lines.length === 1 && lines[0] === '') {
        return [];
    }

    const rows = lines.map(line => line.split(delimiter).map(cell => cell.trim()));
    const colCount = Math.max(...rows.map(row => row.length));
    return rows.map(row => Array.from({ length: colCount }, (_, col) => row[col] ?? ''));
}
