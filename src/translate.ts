import * as vscode from 'vscode';
import * as path from 'path';
import ConfigurationService from './ConfigurationService';
import LLMService from './LLMService';

const outputChannel = vscode.window.createOutputChannel("LLM");

/**
 * Initiates a translation process for either an entire file or a text selection using an LLM service.
 * Prompts the user for a target language, handles input validation, and updates the document/selection with the translated content.
 * @param configurationService - Service providing default configuration values.
 * @param llmService - Service responsible for sending prompts to the LLM and retrieving results.
 * @param clickedUri - Optional URI of a file selected via the explorer; if provided, translates the entire file.
 */
export async function translate(
    configurationService: ConfigurationService,
    llmService: LLMService,
    clickedUri?: vscode.Uri) {

    try {
        let textToTranslate = '';
        let targetUri: vscode.Uri | undefined = clickedUri;
        let activeEditor = vscode.window.activeTextEditor;

        // Detect input source based on invocation context (file explorer vs. editor selection)
        if (targetUri) {
            const fileData = await vscode.workspace.fs.readFile(targetUri);
            textToTranslate = (Buffer.from(fileData) as any).getStringWithEncodingDetection();
        } else if (activeEditor) {
            const selection = activeEditor.selection;
            if (selection.isEmpty) {
                vscode.window.showWarningMessage('Please select the text first.');
                return;
            }
            textToTranslate = activeEditor.document.getText(selection).trim();
        } else {
            return;
        }

        // Validate input and prompt for target language
        if (!textToTranslate) {
            vscode.window.showWarningMessage('No content found to translate.');
            return;
        }

        const MAX_CHARS = 16384;
        if (textToTranslate.length > MAX_CHARS) {
            vscode.window.showWarningMessage(`You have selected ${textToTranslate.length} characters. Make sure that the response is not cut off.`);
        }

        const destinationLanguage = await vscode.window.showInputBox({
            prompt: 'Target language. Example: en-US',
            value: configurationService.getDefaultTargetLanguage()
        });
        if (!destinationLanguage) { return; }

        // Construct system prompt for the LLM
        const systemPrompt = `You are a professional translator for asciidoc documents. Translate the given text into ${destinationLanguage}.
        Output ONLY the translation. Do not add explanations or quotes. Keep all formatting and syntax intact.`;

        // Execute translation with progress notification
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: targetUri ? `Translating file ${path.basename(targetUri.fsPath)}...` : `Translating selection...`,
            cancellable: false
        }, async () => {
            const result = await llmService.sendPrompt(
                systemPrompt, textToTranslate, 0.1, outputChannel);

            // Apply translated content to the appropriate context
            if (targetUri) {
                const doc = await vscode.workspace.openTextDocument(targetUri);
                const editor = await vscode.window.showTextDocument(doc);
                const fullRange = new vscode.Range(
                    doc.positionAt(0),
                    doc.positionAt(doc.getText().length)
                );

                await editor.edit(editBuilder => {
                    editBuilder.replace(fullRange, result.content);
                });
            } else if (activeEditor) {
                await activeEditor.edit(editBuilder => {
                    editBuilder.replace(activeEditor!.selection, result.content);
                });
            }

            // Report translation statistics and potential truncation warnings
            if (result.stats) {
                let message = `Translation finished in ${result.stats.durationSeconds} sec, ${result.stats.completionTokens} tokens, ${result.stats.tokensPerSecond} tokens/sec.`
                if (result.stats.hasLengethExeeded) {
                    message = message + "\nWARNING: The limit for maxOutputTokens has been exceeded. The text is truncated."
                    vscode.window.showWarningMessage(message, { modal: true });
                }
                else
                    vscode.window.showInformationMessage(message);
            }
        });

    } catch (error: any) {
        vscode.window.showErrorMessage(error.message);
    }
}