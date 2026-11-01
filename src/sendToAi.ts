import * as vscode from 'vscode';
import ConfigurationService from './ConfigurationService';
import LLMService from './LLMService';

const outputChannel = vscode.window.createOutputChannel("LLM-SendToAi");

interface PromptQuickPickItem extends vscode.QuickPickItem {
    systemPrompt: string;
    temperature: number;
    isCustom: boolean;
}

/**
 * Command handler: lets the user pick a system prompt (or enter one with a temperature),
 * sends the trimmed selection to the LLM and replaces the selection with the answer.
 * Errors are shown as warnings.
 * @param configurationService - Source of the system prompts.
 * @param llmService - Sends the request.
 */
export async function sendToAi(
    configurationService: ConfigurationService,
    llmService: LLMService
) {
    try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { return; }

        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showWarningMessage('Please first select the text that should be processed.');
            return;
        }

        const textToProcess = editor.document.getText(selection).trim();
        // Only a warning: long texts cost many tokens with cloud models and may exceed maxOutputTokens.
        const MAX_CHARS = 16384;
        if (textToProcess.length > MAX_CHARS) {
            vscode.window.showWarningMessage(
                `You have selected ${textToProcess.length} characters. Make sure that the response is not cut off.`
            );
        }

        const prompts = configurationService.getSystemPrompts();

        const quickPickItems: PromptQuickPickItem[] = prompts.map(p => ({
            label: p.name,
            detail: p.prompt,
            systemPrompt: p.prompt,
            temperature: p.temperature ?? 0.1,
            isCustom: false
        }));

        quickPickItems.push({
            label: '$(pencil) Custom Prompt...',
            description: 'Enter a specific prompt and temperature for this execution',
            detail: 'Temporary custom prompt',
            systemPrompt: '',
            temperature: 0.1,
            isCustom: true
        });

        const selectedOption = await vscode.window.showQuickPick(quickPickItems, {
            placeHolder: 'Select an AI action or enter a custom prompt',
            matchOnDetail: true
        });

        if (!selectedOption) { return; }

        let systemPrompt = selectedOption.systemPrompt;
        let temperature = selectedOption.temperature;

        if (selectedOption.isCustom) {
            const customInput = await vscode.window.showInputBox({
                prompt: 'Enter your custom system prompt',
                placeHolder: 'e.g. Translate to French and make it sound formal'
            });

            if (!customInput) { return; }
            systemPrompt = customInput;

            const tempInput = await vscode.window.showInputBox({
                prompt: 'Enter temperature (e.g. 0.1 for precise, 0.7 for creative)',
                value: '0.1',
                validateInput: (text) => {
                    const val = parseFloat(text);
                    if (isNaN(val) || val < 0) {
                        return 'Please enter a valid positive number';
                    }
                    return null;
                }
            });

            if (!tempInput) { return; }
            temperature = parseFloat(tempInput);
        }

        const userPrompt = textToProcess;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Sending to AI (${selectedOption.label})...`,
            cancellable: false
        }, async () => {
            const result = await llmService.sendPrompt(
                systemPrompt, userPrompt, temperature, outputChannel);

            // The selection captured before the request is replaced, even if the cursor moved meanwhile.
            await editor.edit(editBuilder => {
                editBuilder.replace(selection, result.content);
            });

            if (result.stats) {
                let message = `AI task finished in ${result.stats.durationSeconds} sec, ${result.stats.completionTokens} tokens, ${result.stats.tokensPerSecond} tokens/sec.`;
                    if (result.stats.hasLengthExceeded) {
                    message = message + "\nWARNING: The limit for maxOutputTokens has been exceeded. The text is truncated.";
                    vscode.window.showWarningMessage(message, { modal: true });
                } else {
                    vscode.window.showInformationMessage(message);
                }
            }
        });

    } catch (error: any) {
        vscode.window.showWarningMessage('Error during AI execution: ' + error.message);
    }
}