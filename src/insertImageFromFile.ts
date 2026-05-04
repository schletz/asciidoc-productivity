import * as vscode from 'vscode';
import EditorService from './EditorService';

/**
 * Inserts an image into the current document by prompting the user to select a file.
 * @returns {Promise<void>} A promise that resolves when the operation completes or fails.
 */
export async function insertImageFromFile(): Promise<void> {
    try {
        const editorService = new EditorService();

        // Retrieve the selected image path from the system dialog
        const imagePath = await editorService.showOpenDialog({
            canSelectMany: false,
            openLabel: 'Select image',
            filters: { 'Images': ['png', 'jpg', 'jpeg', 'gif', 'svg'] }
        });

        if (imagePath) {
            // Convert the absolute path to a document-relative path for AsciiDoc compatibility
            const relativePath = editorService.getRelativeAsciiDocPath(imagePath);
            await editorService.insertAtCurrentPosition(`image::${relativePath}[]\n`);
        }
    } catch (error: any) {
        if (error instanceof Error) {
            vscode.window.showErrorMessage(error.message);
        } else {
            vscode.window.showErrorMessage('An unknown error occurred.');
        }
    }
}