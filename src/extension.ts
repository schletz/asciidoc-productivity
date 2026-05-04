import { commands, ExtensionContext, Uri } from 'vscode';
import './bufferExtensions';
import { insertSourceBlock } from './insertSourceBlock';
import { insertImageBlock } from './insertImageBlock';
import { insertTsvTable } from './insertTsvTable';
import { insertImageFromFile } from './insertImageFromFile';
import { insertImageFromClipboard } from './insertImageFromClipboard';
import { insertFileAsSourceBlock } from './insertFileAsSourceBlock';
import { copySourcesToClipboard } from './copySourcesToClipboard';
import { exportAsPdf } from './exportAsPdf';
import ConfigurationService from './ConfigurationService';
import { copyAsTsv } from './copyAsTsv';
import { translate } from './translate';
import LLMService from './LLMService';
import { showPreview } from './showPreview';
import { sendToAi } from './sendToAi';
import { sendFilesToAi } from './sendFilesToAi';

/**
 * Activates the extension by registering all commands and subscribing them to the context.
 * @param context - The VS Code extension context provided by the host environment.
 */
export function activate(context: ExtensionContext) {
    let insertSourceBlockCmd = commands.registerCommand(
        'asciidoc-productivity.insertSourceBlock', insertSourceBlock);

    let insertImageBlockCmd = commands.registerCommand(
        'asciidoc-productivity.insertImageBlock', insertImageBlock);

    let insertTsvTableCmd = commands.registerCommand(
        'asciidoc-productivity.insertTsvTable', insertTsvTable);

    let insertImageFromFileCmd = commands.registerCommand(
        'asciidoc-productivity.insertImageFromFile', insertImageFromFile);

    let insertImageFromClipboardCmd = commands.registerCommand(
        'asciidoc-productivity.insertImageFromClipboard', insertImageFromClipboard);

    let insertFileAsSourceBlockCmd = commands.registerCommand(
        'asciidoc-productivity.insertFileAsSourceBlock',
        async (clickedUri: Uri) => await insertFileAsSourceBlock(clickedUri));

    let copySourcesToClipboardCmd = commands.registerCommand(
        'asciidoc-productivity.copySourcesToClipboard',
        async (clickedUri?: Uri, selectedUris?: Uri[]) => await copySourcesToClipboard(clickedUri, selectedUris, new ConfigurationService()));

    let copyAsTsvCmd = commands.registerCommand(
        'asciidoc-productivity.copyAsTsv', copyAsTsv);

    let translateCmd = commands.registerCommand(
        'asciidoc-productivity.translate',
        async () => {
            const configurationService = new ConfigurationService();
            const llmService = new LLMService(configurationService);
            await translate(configurationService, llmService, undefined);
        }
    );

    let sendToAiCmd = commands.registerCommand(
        'asciidoc-productivity.sendToAi',
        async () => {
            const configurationService = new ConfigurationService();
            const llmService = new LLMService(configurationService);
            await sendToAi(configurationService, llmService);
        }
    );

    let exportAsPdfCmd = commands.registerCommand(
        'asciidoc-productivity.exportAsPdf',
        async (clickedUri: Uri) => await exportAsPdf(clickedUri));

    let showPreviewCmd = commands.registerCommand(
        'asciidoc-productivity.showPreview',
        () => showPreview(context)
    );

    let sendFilesToAiCmd = commands.registerCommand(
        'asciidoc-productivity.sendFilesToAi',
        async (clickedUri?: Uri, selectedUris?: Uri[]) => {
            const configurationService = new ConfigurationService();
            const llmService = new LLMService(configurationService);
            await sendFilesToAi(clickedUri, selectedUris, configurationService, llmService);
        }
    );

    context.subscriptions.push(
        insertSourceBlockCmd,
        insertImageBlockCmd,
        insertTsvTableCmd,
        insertImageFromFileCmd,
        insertImageFromClipboardCmd,
        insertFileAsSourceBlockCmd,
        copySourcesToClipboardCmd,
        copyAsTsvCmd,
        translateCmd,
        exportAsPdfCmd,
        showPreviewCmd,
        sendFilesToAiCmd
    );
}

/**
 * Deactivates the extension. Currently performs no cleanup operations.
 */
export function deactivate() { }