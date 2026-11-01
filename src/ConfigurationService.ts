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
    constructor() { }

    /**
     * Retrieves the configured file extensions allowed for processing.
     * Returns a whitespace-stripped, pipe-separated string of extensions.
     * @returns The formatted extension string or defaults if unconfigured.
     */
    public getIncludeExtensions(): string {
        const config = vscode.workspace.getConfiguration('asciidoc-productivity');
        const includeExtensions = config.get<string>(
            'includeExtensions',
            "abap|actionscript|ada|adb|ado|adoc|ads|apache|apex|apib|applescript|as|asm|aug|awk|b|bat|bbc|bf|bib|bicep|biml|bpf|brs|bsl|c|cc|ceylon|cfc|cfm|cjs|clj|cljc|cljs|cls|cmake|cmd|cmm|coffee|conf|coq|cpp|cr|cs|csproj|css|csvs|cu|cxx|cyp|cypher|d|dart|dfy|diff|dig|do|dockerfile|dot|e|ecl|edp|eex|elm|eml|epp|erb|erl|ex|exs|f|f90|factor|feature|frag|fs|fsi|fsx|gd|glsl|go|gql|gradle|graphql|groovy|gv|h|hack|haml|hbs|hcl|hcr|hh|hlsl|hocon|hpp|hql|hrl|hs|htm|html|http|hx|hy|ice|idl|idr|ijs|ini|io|ipf|irb|isbl|j2|janet|java|jinja|jl|js|jsl|json|json5|jsonnet|jsp|jsx|kt|kts|lasso|lean|lhs|liquid|lisp|litcoffee|ll|ls|lsp|lua|lus|lut|m|magik|mak|matlab|md|meson|mjs|mk|ml|mli|mm|mojo|moon|mos|mxml|mzn|ndf|nginx|nim|nix|ocl|os|p|p4|pas|patch|php|phtml|pkb|pks|pl|plist|pm|pony|pp|praat|pro|prolog|properties|proto|ps|ps1|psm1|puml|py|pyw|pyx|q|qml|r|rb|re|rego|rei|res|resi|rkt|rml|robot|rq|rs|s|sas|sass|sc|scala|scm|scpt|scss|sed|service|sh|sieve|slim|sml|sqf|sql|ss|ssh|st|stan|sv|svelte|swift|syz|tap|tcl|tex|tf|thy|tlp|toml|tpl|trigger|ts|tsx|ttcn3|ttl|twig|txt|v|vala|vb|vcl|vert|veryl|vhd|vhdl|vim|vm|vue|wlk|xml|xojo_code|xpath|xq|xquery|yaml|yang|yml|zig"
        );

        return includeExtensions.replace(/\s+/g, '');
    }

    /**
     * Retrieves the list of directories to exclude from analysis.
     * Normalizes names to lowercase for case-insensitive matching.
     * @returns Array of excluded directory paths or defaults.
     */
    public getExcludedDirectories(): string[] {
        const config = vscode.workspace.getConfiguration('asciidoc-productivity');

        return config.get<string[]>(
            'excludeDirectories', ['bin', 'obj', 'node_modules']
        ).map(dir => dir.toLowerCase());
    }

    /**
     * Retrieves the list of files to exclude from analysis.
     * Normalizes names to lowercase for case-insensitive matching.
     * @returns Array of excluded file paths or defaults.
     */
    public getExcludedFiles(): string[] {
        const config = vscode.workspace.getConfiguration('asciidoc-productivity');

        return config.get<string[]>(
            'excludeFiles', ["package-lock.json"]
        ).map(file => file.toLowerCase());
    }

    /**
     * Retrieves the base URL endpoint for AI completion requests.
     * @returns The API endpoint URL or defaults to local LM Studio.
     */
    public getCompletionsUrl(): string {
        const config = vscode.workspace.getConfiguration('asciidoc-productivity');

        return config.get<string>(
            'completionsUrl', "http://localhost:1234/v1/chat/completions"
        );
    }

    /**
     * Retrieves the identifier or path of the LLM model to use for completions.
     * @returns The model identifier string or defaults to Qwen 35B.
     */
    public getLlm(): string {
        const config = vscode.workspace.getConfiguration('asciidoc-productivity');

        return config.get<string>(
            'llm', "lmstudio-community/Qwen3.6-35B-A3B-GGUF"
        );
    }

    /**
     * Retrieves the maximum number of tokens allowed in AI responses.
     * @returns The token limit integer or defaults to 4096.
     */
    public getMaxOutputTokens(): number {
        const config = vscode.workspace.getConfiguration('asciidoc-productivity');

        return config.get<number>(
            'maxOutputTokens', 4096
        );
    }

    /**
     * Retrieves the default target language code for text processing tasks.
     * @returns The language code string or defaults to "en-US".
     */
    public getDefaultTargetLanguage(): string {
        const config = vscode.workspace.getConfiguration('asciidoc-productivity');

        return config.get<string>(
            'defaultLanguage', "en-US"
        );
    }

    /**
     * Retrieves the API key used for authenticating with external AI services.
     * @returns The API key string or empty string if not configured.
     */
    public getApiKey(): string {
        const config = vscode.workspace.getConfiguration('asciidoc-productivity');
        return config.get<string>('apiKey', "");
    }

    /**
     * Merges user-defined system prompts with built-in defaults.
     * User-provided prompts take precedence; default prompts are appended only if their names do not conflict.
     * @returns Array of combined system prompt objects.
     */
    public getSystemPrompts(): SystemPrompt[] {
        const config = vscode.workspace.getConfiguration('asciidoc-productivity');

        const defaultPrompts: SystemPrompt[] = [
            {
                "name": "Check spelling and grammar",
                "prompt": "Correct spelling, grammar, and punctuation of the provided text in the user message.\nMaintain the original tone and all formatting (especially AsciiDoc/Markdown syntax and source blocks).\nOutput ONLY the corrected text. Do not add explanations or comments.",
                "temperature": 0.1
            },
            {
                "name": "Simplify text",
                "prompt": "Rewrite the provided German text in the user message to be clear and easily understandable for non-native students with a B2 language level.\nKeep all technical terms intact, but resolve overly nested sentences (Schachtelsätze) and avoid unnecessary passive voice.\nMaintain the original tone and all formatting (especially AsciiDoc/Markdown syntax and source blocks).\nOutput ONLY the rewritten text. Do not add explanations or comments.",
                "temperature": 0.2
            },
            {
                "name": "Rewrite for Agent",
                "prompt": "Structure the text in the user message so that an agent can read it in a token-efficient and compact way.\n\nYou have the following Markdown structural elements available, which you can use and combine:\n\n- Tables\n- Lists (ordered and unordered)\n- Plain text (prose)\n\nOutput ONLY the rewritten text. Do not add explanations or comments.",
                "temperature": 0.2
            }
        ];

        const configValue = config.inspect<SystemPrompt[]>('systemPrompts');
        // Prioritize global settings over workspace settings for user prompts
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