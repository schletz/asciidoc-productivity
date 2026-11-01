import * as vscode from 'vscode';
import path from 'path';
import ConfigurationService from './ConfigurationService';
import LLMService from './LLMService';

const outputChannel = vscode.window.createOutputChannel("LLM-SendFilesToAi");

interface PromptQuickPickItem extends vscode.QuickPickItem {
    systemPrompt: string;
    temperature: number;
    isCustom: boolean;
}

interface FileItem {
    uri: vscode.Uri;
    size: number;
}

/**
 * Collects every file below a target. Only directories starting with a dot are skipped;
 * the exclusion settings of copySourcesToClipboard do not apply.
 * @param targetUri - File or directory.
 * @param fileItems - Receives the files with their size.
 */
async function collectFiles(
    targetUri: vscode.Uri,
    fileItems: FileItem[]
): Promise<void> {
    const stat = await vscode.workspace.fs.stat(targetUri);
    const name = path.basename(targetUri.fsPath);

    if (stat.type === vscode.FileType.File) {
        fileItems.push({ uri: targetUri, size: stat.size });
    } else if (stat.type === vscode.FileType.Directory) {
        if (name.startsWith('.')) { return; }

        const entries = await vscode.workspace.fs.readDirectory(targetUri);
        for (const [entryName, type] of entries) {
            const entryUri = vscode.Uri.joinPath(targetUri, entryName);
            await collectFiles(entryUri, fileItems);
        }
    }
}

/**
 * Command handler: sends every selected file through the chosen system prompt and overwrites
 * it with the answer, without backup. A truncated answer leaves the file unchanged.
 * Cancelling takes effect between two files.
 * @param clickedUri - Item the context menu was opened on.
 * @param selectedUris - All selected explorer items; take precedence over clickedUri.
 * @param configurationService - Source of the system prompts.
 * @param llmService - Sends the requests; remembers temperature rejections across the files.
 */
export async function sendFilesToAi(
    clickedUri: vscode.Uri | undefined,
    selectedUris: vscode.Uri[] | undefined,
    configurationService: ConfigurationService,
    llmService: LLMService
): Promise<void> {
    const targets = selectedUris?.length ? selectedUris : (clickedUri ? [clickedUri] : []);

    if (!targets.length) {
        vscode.window.showErrorMessage('Please select at least one file or folder.');
        return;
    }

    const fileItems: FileItem[] = [];
    for (const target of targets) {
        await collectFiles(target, fileItems);
    }

    if (!fileItems.length) {
        vscode.window.showWarningMessage('No matching files found in the selection.');
        return;
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
        placeHolder: `Select AI action for ${fileItems.length} file(s)`,
        matchOnDetail: true
    });

    if (!selectedOption) { return; }

    let systemPrompt = selectedOption.systemPrompt;
    let temperature = selectedOption.temperature;

    if (selectedOption.isCustom) {
        const customInput = await vscode.window.showInputBox({
            prompt: 'Enter your custom system prompt'
        });
        if (!customInput) { return; }
        systemPrompt = customInput;

        const tempInput = await vscode.window.showInputBox({
            prompt: 'Enter temperature (e.g. 0.1)',
            value: '0.1'
        });
        if (!tempInput) { return; }
        temperature = parseFloat(tempInput);
    }

    const totalBytes = fileItems.reduce((sum, item) => sum + item.size, 0);

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `AI Processing: ${selectedOption.label}`,
        cancellable: true
    }, async (progress, token) => {
        let processedCount = 0;
        let errorCount = 0;

        for (let i = 0; i < fileItems.length; i++) {
            if (token.isCancellationRequested) {
                vscode.window.showWarningMessage(
                    `Cancelled by user. Processed ${processedCount} of ${fileItems.length} files.`
                );
                outputChannel.appendLine('[INFO] Process cancelled by user.');
                break;
            }

            const fileItem = fileItems[i];
            const fileName = path.basename(fileItem.uri.fsPath);

            // Progress grows with the file size, which approximates the processing time.
            const incrementPercentage = totalBytes > 0 ? (fileItem.size / totalBytes) * 100 : 0;

            progress.report({
                message: `File ${i + 1}/${fileItems.length}: ${fileName}`,
                increment: incrementPercentage
            });

            try {
                const fileData = await vscode.workspace.fs.readFile(fileItem.uri);
                const fileContent = (Buffer.from(fileData) as any).getStringWithEncodingDetection();

                const result = await llmService.sendPrompt(
                    systemPrompt, fileContent, temperature, outputChannel
                );
                if (result.stats && result.stats.hasLengthExceeded) {
                    const message = `WARNING: Skipped processing ${fileItem.uri}: The limit for maxOutputTokens has been exceeded.`;
                    vscode.window.showWarningMessage(message, { modal: true });
                    continue;
                }
                let finalContent = result.content;

                // Models often wrap a whole file in a code fence despite the instruction.
                if (finalContent.startsWith('```')) {
                    finalContent = finalContent.replace(/^```[a-zA-Z]*\r?\n/, '');
                    finalContent = finalContent.replace(/\r?\n```$/, '');
                }

                await vscode.workspace.fs.writeFile(fileItem.uri, Buffer.from(finalContent, 'utf8'));
                processedCount++;
            } catch (error: any) {
                outputChannel.appendLine(`[ERROR] Processing ${fileName}: ${error.message}`);
                errorCount++;
            }
        }

        if (!token.isCancellationRequested) {
            if (errorCount > 0) {
                vscode.window.showWarningMessage(
                    `Finished with ${errorCount} errors. See output channel for details.`
                );
            } else {
                vscode.window.showInformationMessage(
                    `Successfully processed and saved ${processedCount} file(s).`
                );
            }
        }
    });
}