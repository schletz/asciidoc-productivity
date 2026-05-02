import * as vscode from 'vscode';
import ConfigurationService from './ConfigurationService';
import LLMService from './LLMService';

const outputChannel = vscode.window.createOutputChannel("LLM-SendToAi");

/**
 * Extends VS Code's QuickPickItem to store additional AI configuration data.
 */
interface PromptQuickPickItem extends vscode.QuickPickItem {
    systemPrompt: string;
    temperature: number;
    isCustom: boolean;
}

/**
 * Initiates an AI processing task on the currently selected text in the active editor.
 * Presents a quick pick menu of predefined system prompts or allows custom input,
 * sends the request to the LLM service, and replaces the selection with the result.
 * @param configurationService - Provides access to stored prompt configurations.
 * @param llmService - Handles communication with the AI model.
 */
export async function sendToAi(configurationService: ConfigurationService, llmService: LLMService) {
    try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { return; }
        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showWarningMessage('Please first select the text that should be processed.');
            return;
        }

        const textToProcess = editor.document.getText(selection).trim();
        const MAX_CHARS = 16384;
        // Warn user when selection exceeds typical context window limits to prevent truncation
        if (textToProcess.length > MAX_CHARS) {
            vscode.window.showWarningMessage(`You have selected ${textToProcess.length} characters. Make sure that the response is not cut off.`);
        }

        const prompts = configurationService.getSystemPrompts();

        // Map configured prompts to QuickPick items with their associated AI parameters
        const quickPickItems: PromptQuickPickItem[] = prompts.map(p => ({
            label: p.name,
            detail: p.prompt,
            systemPrompt: p.prompt,
            temperature: p.temperature ?? 0.1,
            isCustom: false
        }));

        // Append a custom prompt option to the selection menu
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

        // Prompt user for custom configuration when the custom option is chosen
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

        // Execute AI request with a progress notification to indicate ongoing work
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Sending to AI (${selectedOption.label})...`,
            cancellable: false
        }, async () => {
            const result = await llmService.sendPrompt(
                systemPrompt, userPrompt, temperature, outputChannel);

            // Replace the original selection with the AI-generated response
            await editor.edit(editBuilder => {
                editBuilder.replace(selection, result.content);
            });

            if (result.stats) {
                let message = `AI task finished in ${result.stats.durationSeconds} sec, ${result.stats.completionTokens} tokens, ${result.stats.tokensPerSecond} tokens/sec.`;
                // Check for output token limit violations and notify the user accordingly
                if (result.stats.hasLengethExeeded) {
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