import * as vscode from 'vscode';
import EditorService from './EditorService';
import MarkupSyntax from './MarkupSyntax';
import path from 'path';
import { sourceTypes } from './globals';

/**
 * Inserts the content of a file as a source block at the current cursor position.
 * @param editorService The active editor that receives the block.
 * @param syntax Markup of the active document.
 * @param clickedUri The URI of the target file, typically triggered from the explorer view.
 * @throws Error if no file URI is given, e.g. when called from the command palette.
 */
export async function insertFileAsSourceBlock(
    editorService: EditorService,
    syntax: MarkupSyntax,
    clickedUri?: vscode.Uri
): Promise<void> {
    if (!clickedUri) {
        throw new Error('This command must be called from the file explorer.');
    }

    const filePath = clickedUri.fsPath;
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).replace('.', '').toLowerCase();

    // The format-neutral language identifier works for AsciiDoc and Markdown alike.
    const lang: string | undefined = sourceTypes[ext];

    const fileData = await vscode.workspace.fs.readFile(clickedUri);
    const fileContent = Buffer.from(fileData).getStringWithEncodingDetection();
    const relativePath = editorService.getRelativePath(filePath);

    await editorService.insertAtCurrentPosition(syntax.fileSourceBlock(fileContent, lang, relativePath, fileName));
    await editorService.focusEditor();
}
