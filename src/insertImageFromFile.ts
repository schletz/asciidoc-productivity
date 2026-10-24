import EditorService from './EditorService';
import MarkupSyntax from './MarkupSyntax';

/**
 * Inserts an image into the current document by prompting the user to select a file.
 * @param editorService The active editor.
 * @param syntax Markup of the active document.
 * @returns {Promise<void>} A promise that resolves when the operation completes or is cancelled.
 */
export async function insertImageFromFile(editorService: EditorService, syntax: MarkupSyntax): Promise<void> {
    // Retrieve the selected image path from the system dialog
    const imagePath = await editorService.showOpenDialog({
        canSelectMany: false,
        openLabel: 'Select image',
        filters: { 'Images': ['png', 'jpg', 'jpeg', 'gif', 'svg'] }
    });

    if (imagePath) {
        // Convert the absolute path to a document-relative path
        const relativePath = editorService.getRelativePath(imagePath);
        await editorService.insertAtCurrentPosition(syntax.image(relativePath));
    }
}
