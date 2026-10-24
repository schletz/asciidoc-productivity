import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

import EditorService from './EditorService';
import MarkupSyntax from './MarkupSyntax';

const execAsync = promisify(exec);

/**
 * Extracts an image from the system clipboard and inserts its reference into the current document.
 * @param editorService The active editor.
 * @param syntax Markup of the active document.
 * @throws Error if the document is unsaved, the platform is Linux, or the clipboard holds no image.
 */
export async function insertImageFromClipboard(editorService: EditorService, syntax: MarkupSyntax): Promise<void> {
    if (!editorService.isDocumentSaved()) {
        throw new Error('Please save the document first to insert images with relative paths.');
    }

    // Construct platform-specific command to extract clipboard image to the target path.
    let scriptFor: (savePath: string) => string;
    if (process.platform === 'win32') {
        scriptFor = savePath => `powershell -command "Add-Type -AssemblyName System.Windows.Forms; $clip = [System.Windows.Forms.Clipboard]::GetImage(); if ($clip -ne $null) { $clip.Save('${savePath}', [System.Drawing.Imaging.ImageFormat]::Png) } else { exit 1 }"`;
    } else if (process.platform === 'darwin') {
        scriptFor = savePath => `osascript -e 'set theFile to (open for access POSIX file "${savePath}" with write permission)' -e 'try' -e 'write (the clipboard as «class PNGf») to theFile' -e 'end try' -e 'close access theFile'`;
    } else {
        throw new Error('This function is not supported on Linux.');
    }

    const savePath = await editorService.showSaveDialog({
        saveLabel: 'Save image',
        filters: { 'Images': ['png'] }
    });

    if (!savePath) {
        return;
    }

    // A non-zero exit code means the clipboard holds no image.
    try {
        await execAsync(scriptFor(savePath));
    } catch {
        throw new Error('Error: No image found in the clipboard.');
    }

    await editorService.insertAtCurrentPosition(syntax.image(editorService.getRelativePath(savePath)));
}
