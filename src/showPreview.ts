import * as vscode from 'vscode';
import { PreviewService } from './PreviewService';

/**
 * Command handler: opens the preview of the active AsciiDoc document.
 * @param context - Extension context; provides the path of lib/.
 */
export async function showPreview(context: vscode.ExtensionContext): Promise<void> {
    await PreviewService.getInstance().showPreview(context);
}
