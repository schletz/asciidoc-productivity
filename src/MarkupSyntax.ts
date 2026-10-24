/**
 * Table content as rows of cells. The first row is the header; every row has the same
 * number of cells. Cells contain plain text without markup escaping.
 */
export type TableRows = string[][];

/** A formatted table and the document lines it replaces. */
export interface FormattedTable {
    /** First line of the table, zero-based. */
    startLine: number;
    /** Last line of the table, zero-based and inclusive. */
    endLine: number;
    /** Replacement for the lines startLine..endLine, without a trailing line break. */
    text: string;
}

/**
 * Generates and parses the markup of one document language (AsciiDoc, Markdown).
 * Implementations are pure string functions without access to VS Code, so commands stay
 * language-agnostic and the syntax can be unit tested without an extension host.
 * Every generating method returns the complete text to insert, ending with a line break.
 */
interface MarkupSyntax {
    /**
     * Wraps content in a source code block.
     * @param content Source code, inserted unchanged.
     * @param language Language identifier for syntax highlighting; empty or undefined omits it.
     */
    sourceBlock(content: string, language?: string): string;

    /**
     * Source code block preceded by a link to the file it was read from.
     * @param content File content.
     * @param language Language identifier; undefined omits it.
     * @param relativePath Path from the document to the file, with forward slashes.
     * @param fileName File name shown as link text.
     */
    fileSourceBlock(content: string, language: string | undefined, relativePath: string, fileName: string): string;

    /**
     * Image reference.
     * @param relativePath Path from the document to the image, with forward slashes.
     */
    image(relativePath: string): string;

    /**
     * Image reference with a visible note about the URL the image was downloaded from.
     * @param relativePath Path from the document to the image, with forward slashes.
     * @param sourceUrl Original URL of the image.
     */
    imageWithSource(relativePath: string, sourceUrl: string): string;

    /**
     * Table with the first row as header.
     * @param rows Table content; an empty array yields an empty string.
     */
    table(rows: TableRows): string;

    /**
     * Reads a table in the format produced by {@link table}; the inverse operation.
     * @param text Selected table markup.
     * @returns The rows with unescaped, trimmed cells; may be empty.
     */
    parseTable(text: string): TableRows;

    /**
     * Aligns the columns of the table that contains the given line. Optional: syntaxes
     * without table formatting leave it undefined, and the command reports that.
     * @param lines All lines of the document.
     * @param line Zero-based line of the cursor.
     * @returns The table range and its formatted text, or undefined if the line is not inside a table.
     */
    formatTableAt?(lines: string[], line: number): FormattedTable | undefined;
}

export default MarkupSyntax;
