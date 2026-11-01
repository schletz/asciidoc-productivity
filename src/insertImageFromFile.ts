import EditorService from './EditorService';
import MarkupSyntax from './MarkupSyntax';

/**
 * Lets the user pick an image file and inserts a reference with the path relative to the
 * document. Unlike the other image commands it does not require a saved document.
 * @param editorService - The active editor.
 * @param syntax - Markup of the active document.
 */
export async function insertImageFromFile(editorService: EditorService, syntax: MarkupSyntax): Promise<void> {
    const imagePath = await editorService.showOpenDialog({
        canSelectMany: false,
        openLabel: 'Select image',
        filters: { 'Images': ['png', 'jpg', 'jpeg', 'gif', 'svg'] }
    });

    if (imagePath) {
        const relativePath = editorService.getRelativePath(imagePath);
        await editorService.insertAtCurrentPosition(syntax.image(relativePath));
    }
}
