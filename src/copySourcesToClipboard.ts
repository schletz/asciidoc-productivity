import * as vscode from 'vscode';
import path from 'path';
import * as mammoth from 'mammoth';
import ConfigurationService from './ConfigurationService';
// @ts-expect-error: Ignore ESM/CommonJS conflict (TS1479)
import { PdfReader } from "pdfreader";
import { sourceTypes } from './globals';

export type OutputFormat = 'xml' | 'markdown';

interface FormatQuickPickItem extends vscode.QuickPickItem {
    format: OutputFormat;
}

/**
 * Regex based filter criteria. Every provided pattern represents an active filter;
 * active filters are combined with AND. Omitted properties are treated as inactive.
 */
interface FilterCriteria {
    /** Regex matched against the bare file extension (anchored). */
    extensions?: string;
    /** Regex matched against the relative file path. */
    filenames?: string;
    /** Regex matched against the file content. */
    content?: string;
}

/**
 * Extracts raw text content from a DOCX file.
 * @param uri - The URI of the DOCX file to process.
 * @returns A promise resolving to the extracted plain text string.
 */
async function copyDocx(uri: vscode.Uri): Promise<string> {
    try {
        const fileData = await vscode.workspace.fs.readFile(uri);
        const buffer = Buffer.from(fileData);
        const result = await mammoth.extractRawText({ buffer });
        return result.value.trim();
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error reading DOCX ${uri}:`, errorMessage);
        return `[Error extracting DOCX file: ${errorMessage}]`;
    }
}

/**
 * Extracts text content from a PDF file.
 * @param uri - The URI of the PDF file to process.
 * @returns A promise resolving to the extracted plain text string.
 */
async function copyPdf(uri: vscode.Uri): Promise<string> {
    try {
        const fileData = await vscode.workspace.fs.readFile(uri);
        const buffer = Buffer.from(fileData);
        const reader = new PdfReader();
        const content = await new Promise<string>((resolve, reject) => {
            let extractedText = "";
            reader.parseBuffer(buffer, (err: any, item: any) => {
                if (err) { reject(err); }
                else if (!item) { resolve(extractedText); }
                else if (item.text) { extractedText += item.text + " "; }
            });
        });
        return content.trim();
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error reading PDF ${uri.fsPath}:`, errorMessage);
        return `[Error extracting PDF file: ${errorMessage}]`;
    }
}

/** Map of supported file extensions to their respective extraction functions. */
const parsers: Record<string, (filename: vscode.Uri) => Promise<string>> = {
    "docx": copyDocx,
    "pdf": copyPdf
};

/**
 * Manages the extraction and formatting of source files into XML or Markdown format for clipboard storage.
 */
class SourceCopier {
    private parentPath: string;
    private rootName: string;
    private extensionsRegex?: RegExp;
    private filenamesRegex?: RegExp;
    private contentRegex?: RegExp;
    private excludedFiles: string[];
    private excludedDirectories: string[];
    private maxFileSizeBytes = 10_485_760;
    private maxSourceFileSizeBytes = 51_200;
    private output: string;
    private format: OutputFormat;
    private processedFileCount = 0;
    private processedFilePaths = new Set<string>();

    /**
     * Initializes the copier with target URIs, filter criteria, and configuration.
     * @param targets - The list of file or directory URIs to process.
     * @param filter - Filter criteria. Each provided regex acts as an active filter and
     *  all active filters are combined with AND. `extensions` is anchored and matched
     *  against the bare file extension, `filenames` is matched against the relative file
     *  path and `content` is matched against the file content (with `.` matching newlines).
     * @param configService - Configuration service providing exclusion lists.
     * @param format - Output format to generate ('xml' or 'markdown').
     */
    constructor(
        targets: vscode.Uri[],
        filter: FilterCriteria,
        configService: ConfigurationService,
        format: OutputFormat
    ) {
        if (filter.extensions) {
            this.extensionsRegex = new RegExp(`^(${filter.extensions})$`, 'i');
        }
        if (filter.filenames) {
            this.filenamesRegex = new RegExp(filter.filenames, 'i');
        }
        if (filter.content) {
            // The 's' (dotAll) flag lets '.' also match newline characters.
            this.contentRegex = new RegExp(filter.content, 'is');
        }
        this.excludedFiles = configService.getExcludedFiles();
        this.excludedDirectories = configService.getExcludedDirectories();
        this.format = format;

        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            this.parentPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
            this.rootName = vscode.workspace.workspaceFolders[0].name;
        } else {
            this.parentPath = path.dirname(targets[0].fsPath);
            this.rootName = path.basename(this.parentPath);
        }

        const now = new Date().toISOString();
        if (this.format === 'xml') {
            this.output = `<?xml version="1.0"?>\n<documents root="${this.rootName}" created="${now}">\n\n`;
        } else {
            this.output = `# ${this.rootName}\n\nCreated: ${now}\n\n`;
        }
    }

    /**
     * Executes the file processing pipeline and handles clipboard/save operations.
     * @param targets - The list of URIs to process.
     */
    public async execute(targets: vscode.Uri[]) {
        const filteredTargets = targets.filter(target => {
            return !targets.some(other => {
                if (target.fsPath === other.fsPath) { return false; }
                const relative = path.relative(target.fsPath, other.fsPath);
                return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative);
            });
        });

        for (const targetUri of filteredTargets) {
            const stat = await vscode.workspace.fs.stat(targetUri);
            const name = path.basename(targetUri.fsPath);

            if (stat.type === vscode.FileType.Directory) {
                if (this.excludedDirectories.includes(name.toLowerCase()) || name.startsWith('.')) {
                    continue;
                }
                await this.processDirectory(targetUri);
            } else if (stat.type === vscode.FileType.File) {
                await this.processFile(targetUri);
            }
        }

        if (this.format === 'xml') {
            this.output += `</documents>\n`;
        }

        await vscode.env.clipboard.writeText(this.output);

        const formatName = this.format === 'xml' ? 'XML' : 'Markdown';
        const fileExt = this.format === 'xml' ? 'xml' : 'md';

        const userChoice = await vscode.window.showInformationMessage(
            `${this.processedFileCount} files copied as ${formatName}. Would you also like to save the content as a file?`,
            'Yes',
            'No'
        );

        if (userChoice === 'Yes') {
            const filters: { [name: string]: string[] } = {};
            filters[`${formatName} Files`] = [fileExt];
            filters['All Files'] = ['*'];

            const saveUri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(`${this.rootName}_sources.${fileExt}`),
                filters: filters,
                saveLabel: `Save ${formatName}`
            });

            if (saveUri) {
                const fileData = Buffer.from(this.output, 'utf8');
                await vscode.workspace.fs.writeFile(saveUri, fileData);
                vscode.window.showInformationMessage(`${formatName} file saved successfully!`);
            }
        }
    }

    /**
     * Processes a single file: validates extensions, size, and exclusions before extraction.
     * @param fileUri - The URI of the file to process.
     */
    private async processFile(fileUri: vscode.Uri) {
        const fsPath = fileUri.fsPath;
        const name = path.basename(fsPath);

        if (this.processedFilePaths.has(fsPath)) {
            return;
        }

        if (this.excludedFiles.includes(name.toLowerCase())) { return; }

        const ext = path.extname(name).replace('.', '').toLowerCase();
        let relativePath = path.relative(this.parentPath, fileUri.fsPath).replace(/\\/g, '/');
        if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
            relativePath = name;
        }

        if (this.extensionsRegex && !this.extensionsRegex.test(ext)) { return; }
        if (this.filenamesRegex && !this.filenamesRegex.test(relativePath)) { return; }

        const fileStat = await vscode.workspace.fs.stat(fileUri);
        const sizeLimit = sourceTypes[ext]
            ? this.maxSourceFileSizeBytes
            : this.maxFileSizeBytes;
        let fileContent = "";

        if (fileStat.size <= sizeLimit) {
            if (parsers[ext]) {
                fileContent = await parsers[ext](fileUri);
            } else {
                const fileData = await vscode.workspace.fs.readFile(fileUri);
                fileContent = (Buffer.from(fileData) as any).getStringWithEncodingDetection();
            }
        }
        else {
            fileContent = `This file was not processed because it has ${fileStat.size} Bytes. This exceeded the size limit of ${sizeLimit} bytes.`
        }

        if (this.contentRegex && !this.contentRegex.test(fileContent)) { return; }

        this.processedFilePaths.add(fsPath);
        
        // Use format-neutral language identifier (falls back to extension)
        const language = sourceTypes[ext] ?? ext;

        if (this.format === 'xml') {
            this.output += `<file path="${relativePath}" language="${language}">\n<![CDATA[\n${fileContent}\n]]>\n</file>\n\n`;
        } else {
            this.output += `## File ${relativePath}\n\n\`\`\`${language}\n${fileContent}\n\`\`\`\n\n`;
        }
        
        this.processedFileCount++;
    }

    /**
     * Recursively processes a directory and its contents.
     * @param dirUri - The URI of the directory to process.
     */
    private async processDirectory(dirUri: vscode.Uri) {
        const entries = await vscode.workspace.fs.readDirectory(dirUri);

        for (const [name, type] of entries) {
            const itemUri = vscode.Uri.joinPath(dirUri, name);

            if (type === vscode.FileType.Directory) {
                if (this.excludedDirectories.includes(name.toLowerCase()) || name.startsWith('.')) {
                    continue;
                }
                await this.processDirectory(itemUri);
            } else if (type === vscode.FileType.File) {
                await this.processFile(itemUri);
            }
        }
    }
}

/** Labels identifying the selectable filter types in the QuickPick. */
const FILTER_EXTENSIONS = 'Search in Extensions';
const FILTER_FILENAMES = 'Match Filenames';
const FILTER_CONTENT = 'Match Content';

/**
 * Prompts the user for a single regex value.
 * @param prompt - Description shown above the input field.
 * @param value - Initial value prefilled in the input field.
 * @returns The entered regex, or undefined if cancelled.
 */
function promptForRegex(prompt: string, value: string): Thenable<string | undefined> {
    return vscode.window.showInputBox({
        prompt,
        value,
        ignoreFocusOut: true
    });
}

/** Ordered metadata describing each selectable filter type and where its regex applies. */
const FILTER_DEFINITIONS: { label: string; key: keyof FilterCriteria; detail: string }[] = [
    { label: FILTER_EXTENSIONS, key: 'extensions', detail: 'Regex applied to the file extension' },
    { label: FILTER_FILENAMES, key: 'filenames', detail: 'Regex applied to the relative file path' },
    { label: FILTER_CONTENT, key: 'content', detail: 'Regex applied to the file content (dot matches newline)' }
];

/**
 * Lets the user select one or more filter types and edit an individual regex for each
 * in a single form. Selected filters are combined with AND, so e.g. selecting the
 * extensions filter with `cs` and the content filter with `PersonsController` matches
 * all `.cs` files containing `PersonsController`. The extensions filter is preselected
 * and prefilled with the configured default; the others start empty and unselected.
 * @param defaultExtensions - Default regex prefilled for the extensions filter.
 * @returns The collected filter criteria, or undefined if cancelled.
 */
function promptForFilters(defaultExtensions: string): Promise<FilterCriteria | undefined> {
    return new Promise<FilterCriteria | undefined>(resolve => {
        const editButton: vscode.QuickInputButton = {
            iconPath: new vscode.ThemeIcon('edit'),
            tooltip: 'Edit regular expression'
        };

        // Current regex per filter type, keyed by label.
        const patterns: Record<string, string> = {
            [FILTER_EXTENSIONS]: defaultExtensions,
            [FILTER_FILENAMES]: '',
            [FILTER_CONTENT]: ''
        };

        const buildItems = (): vscode.QuickPickItem[] => FILTER_DEFINITIONS.map(definition => ({
            label: definition.label,
            description: patterns[definition.label]
                ? patterns[definition.label]
                : '(no pattern — use the ✎ button to set one)',
            detail: definition.detail,
            buttons: [editButton]
        }));

        const quickPick = vscode.window.createQuickPick();
        quickPick.title = 'Filter files (selected filters are combined with AND)';
        quickPick.placeholder = 'Check the filters to apply; use the ✎ button to edit each regex';
        quickPick.canSelectMany = true;
        quickPick.ignoreFocusOut = true;
        quickPick.items = buildItems();
        // Preselect the extensions filter.
        quickPick.selectedItems = quickPick.items.filter(item => item.label === FILTER_EXTENSIONS);

        let accepted = false;
        // Guards onDidHide against the temporary hide triggered while a nested input box is shown.
        let editing = false;

        quickPick.onDidTriggerItemButton(async event => {
            const label = event.item.label;
            editing = true;
            const value = await promptForRegex(`${label}: regular expression`, patterns[label]);
            editing = false;

            if (value !== undefined) {
                patterns[label] = value;
                const activeLabels = new Set(quickPick.selectedItems.map(item => item.label));
                // Editing a regex implies the user wants that filter active.
                if (value) { activeLabels.add(label); }
                quickPick.items = buildItems();
                quickPick.selectedItems = quickPick.items.filter(item => activeLabels.has(item.label));
            }
            quickPick.show();
        });

        quickPick.onDidAccept(() => {
            accepted = true;
            const criteria: FilterCriteria = {};
            const selectedLabels = new Set(quickPick.selectedItems.map(item => item.label));
            for (const definition of FILTER_DEFINITIONS) {
                if (selectedLabels.has(definition.label) && patterns[definition.label]) {
                    criteria[definition.key] = patterns[definition.label];
                }
            }
            quickPick.hide();
            resolve(criteria);
        });

        quickPick.onDidHide(() => {
            if (editing) { return; }
            quickPick.dispose();
            if (!accepted) { resolve(undefined); }
        });

        quickPick.show();
    });
}

/**
 * Entry point for the copy sources command. Collects targets and initiates processing.
 * @param clickedUri - The URI of a single clicked item.
 * @param selectedUris - The list of URIs from multi-selection.
 * @param configurationService - Configuration service providing defaults.
 */
export async function copySourcesToClipboard(
    clickedUri: vscode.Uri | undefined,
    selectedUris: vscode.Uri[] | undefined,
    configurationService: ConfigurationService) {

    let targets: vscode.Uri[] = [];
    if (selectedUris && selectedUris.length > 0) {
        targets = selectedUris;
    } else if (clickedUri) {
        targets = [clickedUri];
    } else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        targets = [vscode.workspace.workspaceFolders[0].uri];
    } else {
        vscode.window.showErrorMessage('Please open a folder (workspace) or select a directory/file.');
        return;
    }

    try {
        const formatSelection = await vscode.window.showQuickPick<FormatQuickPickItem>([
            { label: 'XML', description: 'Zum Einfügen als Datei in einem Chat.', format: 'xml' },
            { label: 'Markdown', description: 'Zum Einfügen als Quelle in NotebookLM.', format: 'markdown' }
        ], {
            placeHolder: 'Select output format'
        });

        if (!formatSelection) {
            return;
        }

        const filter = await promptForFilters(configurationService.getIncludeExtensions());
        if (filter === undefined) {
            return;
        }

        const copier = new SourceCopier(
            targets,
            filter,
            configurationService,
            formatSelection.format
        );
        await copier.execute(targets);

    } catch (error: any) {
        if (error instanceof Error) {
            vscode.window.showErrorMessage(`Error during copying: ${error.message}`);
        }
    }
}