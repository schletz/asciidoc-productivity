import { TableRows } from './MarkupSyntax';
import { parseDelimited } from './parseDelimited';

/**
 * Splits tab separated text (e.g. copied from Excel) into table rows.
 * Cells are trimmed and shorter rows are padded with empty cells, so every row has as many
 * cells as the widest one.
 * @param tsv The tab separated text. Lines may end with LF or CRLF.
 * @returns The rows, or an empty array if the input has no rows.
 */
export function parseTsv(tsv: string): TableRows {
    return parseDelimited(tsv, '\t');
}
