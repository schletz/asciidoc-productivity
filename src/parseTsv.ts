import { TableRows } from './MarkupSyntax';

/**
 * Splits tab separated text (e.g. copied from Excel) into table rows.
 * Cells are trimmed and shorter rows are padded with empty cells, so every row has as many
 * cells as the widest one.
 * @param tsv The tab separated text. Lines may end with LF or CRLF.
 * @returns The rows, or an empty array if the input has no rows.
 */
export function parseTsv(tsv: string): TableRows {
    // Only strip trailing line breaks: trailing tabs represent empty cells in the last row.
    const lines = tsv.replace(/(\r?\n)+$/, '').split(/\r?\n/);
    if (lines.length === 1 && lines[0] === '') {
        return [];
    }

    const rows = lines.map(line => line.split('\t').map(cell => cell.trim()));
    const colCount = Math.max(...rows.map(row => row.length));
    return rows.map(row => Array.from({ length: colCount }, (_, col) => row[col] ?? ''));
}
