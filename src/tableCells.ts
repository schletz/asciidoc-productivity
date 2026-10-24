/**
 * Splits a table row at every pipe that is not escaped with a backslash and unescapes
 * the cells. Shared by the AsciiDoc and Markdown table parsers, which both escape a pipe
 * inside a cell as `\|`.
 * @param row Row text without the leading pipe.
 * @returns The trimmed, unescaped cells.
 */
export function splitTableCells(row: string): string[] {
    return row.split(/(?<!\\)\|/).map(cell => cell.trim().replace(/\\\|/g, '|'));
}

/**
 * Escapes pipes in a cell so they do not end the cell early.
 * @param cell Plain cell text.
 */
export function escapeTableCell(cell: string): string {
    return cell.replace(/\|/g, '\\|');
}
