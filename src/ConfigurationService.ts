import * as vscode from 'vscode';

export interface SystemPrompt {
    name: string;
    prompt: string;
    temperature: number;
}

/**
 * Manages retrieval of extension settings from the VSCode workspace configuration.
 * Provides fallback defaults for all settings and handles merging of custom system prompts.
 */
export default class ConfigurationService {
    constructor() {}

    /**
     * Retrieves the configured file extensions allowed for processing.
     * Returns a whitespace-stripped, pipe-separated string of extensions.
     * Falls back to a predefined list if not configured.
     */
    public getIncludeExtensions(): string {
        const config = vscode.workspace.getConfiguration('asciidoc-productivity');
        const includeExtensions = config.get<string>(
            'includeExtensions',
            "cs|csproj|java|rb|json|js|ts|jsx|tsx|py|txt|xml|adoc|md|cmd|sh|sql|yaml|puml");
        return includeExtensions.replace(/\s+/g, '');
    }

    /**
     * Retrieves the list of directories to exclude from analysis.
     * Normalizes all directory names to lowercase for case-insensitive matching.
     * Falls back to a default exclusion list if not configured.
     */
    public getExcludedDirectories(): string[] {
        const config = vscode.workspace.getConfiguration('asciidoc-productivity');

        return config.get<string[]>(
            'excludeDirectories', ['bin', 'obj', 'node_modules'])
            .map(dir => dir.toLowerCase());
    }

    /**
     * Retrieves the list of files to exclude from analysis.
     * Normalizes all file names to lowercase for case-insensitive matching.
     * Falls back to a default exclusion list if not configured.
     */
    public getExcludedFiles(): string[] {
        const config = vscode.workspace.getConfiguration('asciidoc-productivity');

        return config.get<string[]>(
            'excludeFiles', ["package-lock.json"])
            .map(file => file.toLowerCase());
    }

    /**
     * Retrieves the base URL endpoint for AI completion requests.
     * Falls back to a local LM Studio default if not configured.
     */
    public getCompletionsUrl(): string {
        const config = vscode.workspace.getConfiguration('asciidoc-productivity');

        return config.get<string>(
            'completionsUrl', "http://localhost:1234/v1/chat/completions");
    }

    /**
     * Retrieves the identifier or path of the LLM model to use for completions.
     * Falls back to a default Qwen model if not configured.
     */
    public getLlm(): string {
        const config = vscode.workspace.getConfiguration('asciidoc-productivity');

        return config.get<string>(
            'llm', "lmstudio-community/Qwen3.6-35B-A3B-GGUF");
    }

    /**
     * Retrieves the maximum number of tokens allowed in AI responses.
     * Falls back to 4096 if not configured.
     */
    public getMaxOutputTokens(): number {
        const config = vscode.workspace.getConfiguration('asciidoc-productivity');

        return config.get<number>(
            'maxOutputTokens', 4096);
    }

    /**
     * Retrieves the default target language code for text processing tasks.
     * Falls back to "en-US" if not configured.
     */
    public getDefaultTargetLanguage(): string {
        const config = vscode.workspace.getConfiguration('asciidoc-productivity');

        return config.get<string>(
            'defaultLanguage', "en-US");
    }

    /**
     * Retrieves the API key used for authenticating with external AI services.
     * Returns an empty string if no key is configured.
     */
    public getApiKey(): string {
        const config = vscode.workspace.getConfiguration('asciidoc-productivity');
        return config.get<string>('apiKey', "");
    }

    /**
     * Merges user-defined system prompts with built-in defaults.
     * User-provided prompts take precedence; default prompts are appended only if their names do not conflict.
     */
    public getSystemPrompts(): SystemPrompt[] {
        const config = vscode.workspace.getConfiguration('asciidoc-productivity');

        const defaultPrompts: SystemPrompt[] = [
            {
                "name": "Check spelling and grammar",
                "prompt": "You are an expert editor for asciidoc documents. Correct spelling, grammar, and punctuation of the provided text.\nMaintain the original tone and all formatting (especially AsciiDoc syntax and source blocks).\nOutput ONLY the corrected text. Do not add explanations or comments.",
                "temperature": 0.1
            },
            {
                "name": "Simplify text",
                "prompt": "You are an expert editor for asciidoc documents. Rewrite the provided German text to be clear and easily understandable for non-native students with a B2 language level.\nKeep all technical terms intact, but resolve overly nested sentences (Schachtelsätze) and avoid unnecessary passive voice.\nMaintain the original tone and all formatting (especially AsciiDoc syntax and source blocks).\nOutput ONLY the rewritten text. Do not add explanations or comments.",
                "temperature": 0.2
            }
        ];

        const configValue = config.inspect<SystemPrompt[]>('systemPrompts');
        const userPrompts = configValue?.globalValue || configValue?.workspaceValue || [];

        const combinedPrompts = [...userPrompts];

        for (const defaultPrompt of defaultPrompts) {
            if (!combinedPrompts.some(p => p.name === defaultPrompt.name)) {
                combinedPrompts.push(defaultPrompt);
            }
        }

        return combinedPrompts;
    }
}