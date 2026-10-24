import * as vscode from 'vscode';
import EditorService from './EditorService';
import MarkupSyntax from './MarkupSyntax';

/**
 * Inserts an image block into the current document by downloading
 * a URL from the clipboard and saving it locally.
 * @param editorService The active editor.
 * @param syntax Markup of the active document.
 */
export async function insertImageBlock(editorService: EditorService, syntax: MarkupSyntax): Promise<void> {
    const clipboardText = await vscode.env.clipboard.readText();
    if (!clipboardText) {
        vscode.window.showWarningMessage('Clipboard is empty.');
        return;
    }

    const url = clipboardText.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        throw new Error('Clipboard does not contain a valid HTTP/HTTPS URL.');
    }

    if (!editorService.isDocumentSaved()) {
        throw new Error('Please save the document first to insert images with relative paths.');
    }

    const savePath = await editorService.showSaveDialog({
        saveLabel: 'Download & save image',
        filters: { 'Images': ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'] }
    });
    if (!savePath) { return; }

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Error downloading image (Status: ${response.status}).`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);
    await vscode.workspace.fs.writeFile(vscode.Uri.file(savePath), fileData);

    const relativePath = editorService.getRelativePath(savePath);
    await editorService.insertAtCurrentPosition(syntax.imageWithSource(relativePath, url));
}
