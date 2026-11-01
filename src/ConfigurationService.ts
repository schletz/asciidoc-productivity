import * as vscode from 'vscode';

/** A preset task of the "Send to AI" commands. */
export interface SystemPrompt {
    /** Label shown in the QuickPick; identifies the prompt when merging with the built-in ones. */
    name: string;
    prompt: string;
    /** Optional in user settings; callers fall back to 0.1. */
    temperature: number;
}

/**
 * Reads the settings of the section `asciidoc-productivity`. Every getter repeats the default
 * declared in package.json, so both places must be changed together.
 */
export default class ConfigurationService {
    constructor() { }

    /**
     * @returns The pipe-separated extension regex for copying sources, without whitespace.
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
     * @returns Directory names skipped when copying sources, lowercased for case-insensitive matching.
     */
    public getExcludedDirectories(): string[] {
        const config = vscode.workspace.getConfiguration('asciidoc-productivity');

        return config.get<string[]>(
            'excludeDirectories', ['bin', 'obj', 'node_modules']
        ).map(dir => dir.toLowerCase());
    }

    /**
     * @returns File names skipped when copying sources, lowercased for case-insensitive matching.
     */
    public getExcludedFiles(): string[] {
        const config = vscode.workspace.getConfiguration('asciidoc-productivity');

        return config.get<string[]>(
            'excludeFiles', ["package-lock.json"]
        ).map(file => file.toLowerCase());
    }

    /**
     * @returns The full chat completions URL of an OpenAI-compatible endpoint, or the base URL
     *   (e.g. `https://api.anthropic.com/v1/`) for the Anthropic Messages API.
     */
    public getCompletionsUrl(): string {
        const config = vscode.workspace.getConfiguration('asciidoc-productivity');

        return config.get<string>(
            'completionsUrl', "http://localhost:1234/v1/chat/completions"
        );
    }

    /**
     * @returns The model identifier sent in every LLM request.
     */
    public getLlm(): string {
        const config = vscode.workspace.getConfiguration('asciidoc-productivity');

        return config.get<string>(
            'llm', "lmstudio-community/Qwen3.6-35B-A3B-GGUF"
        );
    }

    /**
     * @returns The `max_tokens` value of LLM requests.
     */
    public getMaxOutputTokens(): number {
        const config = vscode.workspace.getConfiguration('asciidoc-productivity');

        return config.get<number>(
            'maxOutputTokens', 4096
        );
    }

    /**
     * @returns The language prefilled in the input box of the translate command.
     */
    public getDefaultTargetLanguage(): string {
        const config = vscode.workspace.getConfiguration('asciidoc-productivity');

        return config.get<string>(
            'defaultLanguage', "en-US"
        );
    }

    /**
     * @returns The API key for cloud endpoints; empty for local servers.
     */
    public getApiKey(): string {
        const config = vscode.workspace.getConfiguration('asciidoc-productivity');
        return config.get<string>('apiKey', "");
    }

    /**
     * Returns the user's prompts followed by every built-in prompt whose name the user has not
     * taken. The built-in list mirrors the default in package.json, which is never read here
     * because `inspect` only returns explicitly set values.
     * @returns The prompts in QuickPick order.
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
        // The workspace list is only used if no global list exists; the two are not merged.
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
