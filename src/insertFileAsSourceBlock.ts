import * as vscode from 'vscode';
import EditorService from './EditorService';
import path from 'path';
import { sourceTypes } from './globals';

/**
 * Inserts the content of a file as an AsciiDoc source block at the current cursor position.
 * @param clickedUri The URI of the target file, typically triggered from the explorer view.
 */
export async function insertFileAsSourceBlock(clickedUri: vscode.Uri): Promise<void> {
    if (!clickedUri) {
        vscode.window.showErrorMessage('This command must be called from the file explorer.');
        return;
    }

    try {
        const editorService = new EditorService();
        const filePath = clickedUri.fsPath;
        const fileName = path.basename(filePath);
        const ext = path.extname(filePath).replace('.', '').toLowerCase();
        
        // Construct the AsciiDoc source header using the format-neutral language identifier
        const lang = sourceTypes[ext];
        const sourceHeader = lang ? `[source,${lang}]` : "[source]";

        const fileData = await vscode.workspace.fs.readFile(clickedUri);
        const fileContent = Buffer.from(fileData).getStringWithEncodingDetection();
        const relativePath = editorService.getRelativeAsciiDocPath(filePath);
        const block = `.link:${relativePath}[→ ${fileName}]\n${sourceHeader}\n----\n${fileContent}\n----\n`;

        await editorService.insertAtCurrentPosition(block);
        await editorService.focusEditor();
    } catch (error: any) {
        if (error instanceof Error) {
            vscode.window.showErrorMessage(error.message);
        }
    }
}