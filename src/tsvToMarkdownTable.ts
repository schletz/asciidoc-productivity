/**
 * Converts tab separated text (e.g. copied from Excel) into a Markdown table.
 * The first line becomes the header row. All columns are padded to their widest cell
 * so the table is aligned in the source as well.
 * @param tsv The tab separated text. Lines may end with LF or CRLF.
 * @returns The Markdown table without a trailing line break, or an empty string if the input has no rows.
 */
export function tsvToMarkdownTable(tsv: string): string {
    // Only strip trailing line breaks: trailing tabs represent empty cells in the last row.
    const lines = tsv.replace(/(\r?\n)+$/, '').split(/\r?\n/);
    if (lines.length === 1 && lines[0] === '') {
        return '';
    }

    // Pipes would end a cell early, so they must be escaped.
    const rows = lines.map(line => line.split('\t').map(cell => cell.trim().replace(/\|/g, '\\|')));
    const colCount = Math.max(...rows.map(row => row.length));

    // Markdown renderers commonly expect at least three dashes in the delimiter row.
    const widths = Array.from({ length: colCount }, (_, col) =>
        Math.max(3, ...rows.map(row => (row[col] ?? '').length)));

    const formatRow = (row: string[]) =>
        `| ${widths.map((width, col) => (row[col] ?? '').padEnd(width)).join(' | ')} |`;
    const delimiterRow = `|${widths.map(width => '-'.repeat(width + 2)).join('|')}|`;

    const [header, ...body] = rows;
    return [formatRow(header), delimiterRow, ...body.map(formatRow)].join('\n');
}
