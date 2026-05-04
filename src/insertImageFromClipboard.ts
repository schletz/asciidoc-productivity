import * as vscode from 'vscode';
import { exec } from 'child_process';

import EditorService from './EditorService';

/**
 * Extracts an image from the system clipboard and inserts its reference into the current AsciiDoc document.
 */
export async function insertImageFromClipboard(): Promise<void> {
    try {
        const editorService = new EditorService();

        if (!editorService.isDocumentSaved()) {
            vscode.window.showErrorMessage('Please save the AsciiDoc document first to insert images with relative paths.');
            return;
        }

        const savePath = await editorService.showSaveDialog({
            saveLabel: 'Save image',
            filters: { 'Images': ['png'] }
        });

        if (!savePath) {
            return;
        }

        const relativePath = editorService.getRelativeAsciiDocPath(savePath);

        // Construct platform-specific command to extract clipboard image to the target path.
        let script = '';
        const platform = process.platform;

        if (platform === 'win32') {
            script = `powershell -command "Add-Type -AssemblyName System.Windows.Forms; $clip = [System.Windows.Forms.Clipboard]::GetImage(); if ($clip -ne $null) { $clip.Save('${savePath}', [System.Drawing.Imaging.ImageFormat]::Png) } else { exit 1 }"`;
        } else if (platform === 'darwin') {
            script = `osascript -e 'set theFile to (open for access POSIX file "${savePath}" with write permission)' -e 'try' -e 'write (the clipboard as «class PNGf») to theFile' -e 'end try' -e 'close access theFile'`;
        } else {
            vscode.window.showErrorMessage('This function is not supported on Linux.');
            return;
        }

        // Execute the script asynchronously. On success, insert the image macro at the cursor position.
        exec(script, async (error) => {
            if (error) {
                vscode.window.showErrorMessage('Error: No image found in the clipboard.');
                return;
            }
            await editorService.insertAtCurrentPosition(`image::${relativePath}[]\n`);
        });

    } catch (error: any) {
        if (error instanceof Error) {
            vscode.window.showErrorMessage(error.message);
        } else {
            vscode.window.showErrorMessage('An unknown error occurred.');
        }
    }
}