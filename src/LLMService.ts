import { performance } from 'perf_hooks';
import ConfigurationService from './ConfigurationService';
import TemperatureSupport from './TemperatureSupport';
import type * as vscode from 'vscode';

/** Usage metrics of one completion. */
export interface PromptStats {
    promptTokens: number;
    completionTokens: number;
    durationSeconds: number;
    tokensPerSecond: number;
    /** True if the answer was cut off at maxOutputTokens. */
    hasLengthExceeded: boolean;
}

/** The generated text and its metrics. */
export interface PromptResult {
    content: string;
    /** Null if the endpoint reported no completion tokens; callers then show no statistics or truncation warning. */
    stats: PromptStats | null;
}

/**
 * API dialect of the configured endpoint. The Anthropic Messages API differs from
 * OpenAI-compatible endpoints in authentication, request body and response shape.
 */
type ApiProvider = 'anthropic' | 'openai';

/** Completion result independent of the dialect. */
interface CompletionData {
    content: string;
    promptTokens: number;
    completionTokens: number;
    hasLengthExceeded: boolean;
}

/** A request ready to be sent with fetch. */
interface ApiRequest {
    url: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
}

/** Request parameters shared by both dialects. */
interface CompletionRequestOptions {
    url: string;
    model: string;
    apiKey: string;
    systemPrompt: string;
    userPrompt: string;
    maxTokens: number;
    /** Sampling temperature, or null when the model does not accept it. */
    temperature: number | null;
}

/**
 * Sends one system and one user message to the configured LLM endpoint. Speaks the native
 * Anthropic Messages API when the host contains `anthropic.com`, otherwise OpenAI-compatible
 * chat completions (OpenAI, Google Gemini, LM Studio, Ollama, ...). Requests have no timeout.
 */
export default class LLMService {
    private configService: ConfigurationService;
    private temperatureSupport: TemperatureSupport;

    /**
     * @param configService - Source of URL, model, API key and token limit, read per request.
     */
    constructor(configService: ConfigurationService) {
        this.configService = configService;
        this.temperatureSupport = new TemperatureSupport();
    }

    /**
     * Sends a prompt and returns the trimmed answer.
     * @param systemPrompt - Instruction for the model.
     * @param userPrompt - Text to process.
     * @param temperature - Sampling temperature. It is omitted for models that do not accept
     *   it; a request rejected because of it is repeated once without it.
     * @param outputChannel - Optional log for endpoint, model and speed.
     * @returns The answer and its metrics.
     * @throws Error with status and response body if the endpoint answers with an error.
     */
    public async sendPrompt(
        systemPrompt: string,
        userPrompt: string,
        temperature: number,
        outputChannel?: vscode.OutputChannel
    ): Promise<PromptResult> {
        const url = this.configService.getCompletionsUrl();
        const model = this.configService.getLlm();
        const apiKey = this.configService.getApiKey();
        const maxTokens = this.configService.getMaxOutputTokens();

        const provider = this.detectProvider(url);
        const options: CompletionRequestOptions = {
            url,
            model,
            apiKey,
            systemPrompt,
            userPrompt,
            maxTokens,
            temperature: this.temperatureSupport.isSupported(model) ? temperature : null
        };

        if (outputChannel) {
            outputChannel.appendLine(`\n[LLMService] Sending request to: ${url}`);
            outputChannel.appendLine(`[LLMService] Provider: ${provider}, Model: ${model}`);
            outputChannel.appendLine(`[LLMService] Temperature: ${options.temperature ?? 'omitted (not supported by model)'}`);
        }

        let startTime = performance.now();
        let response = await this.postCompletion(provider, options);

        if (!response.ok) {
            // The error body usually explains the failure, so it goes into the message.
            const details = await response.text().catch(() => '');

            // The static model check cannot know every model id. A rejection of the
            // temperature corrects it for this instance, and the request is repeated once.
            if (options.temperature === null
                || !TemperatureSupport.isTemperatureRejection(response.status, details)) {
                throw new Error(`API Error: Status ${response.status} - ${response.statusText}${details ? ` - ${details}` : ''}`);
            }

            this.temperatureSupport.rememberRejection(model);
            outputChannel?.appendLine(
                `[LLMService] Model ${model} rejected the temperature parameter. Retrying without it.`);

            startTime = performance.now();
            response = await this.postCompletion(provider, { ...options, temperature: null });

            if (!response.ok) {
                const retryDetails = await response.text().catch(() => '');
                throw new Error(`API Error: Status ${response.status} - ${response.statusText}${retryDetails ? ` - ${retryDetails}` : ''}`);
            }
        }

        const data: any = await response.json();
        const completion = provider === 'anthropic'
            ? this.parseAnthropicResponse(data)
            : this.parseOpenAiResponse(data);

        const endTime = performance.now();
        const durationSeconds = (endTime - startTime) / 1000;

        let stats: PromptStats | null = null;
        if (completion.completionTokens > 0 && durationSeconds > 0) {
            stats = {
                promptTokens: completion.promptTokens,
                completionTokens: completion.completionTokens,
                durationSeconds: Number(durationSeconds.toFixed(1)),
                tokensPerSecond: Number((completion.completionTokens / durationSeconds).toFixed(1)),
                hasLengthExceeded: completion.hasLengthExceeded
            };

            if (outputChannel) {
                outputChannel.appendLine(`[LLMService] Response received in ${stats.durationSeconds.toFixed(2)}s`);
                outputChannel.appendLine(`[LLMService] Speed: ${stats.tokensPerSecond} TPS`);
            }
        }

        return { content: completion.content, stats };
    }

    /**
     * Builds the request for the dialect and posts it.
     * @param provider - API dialect.
     * @param options - Request parameters with the effective temperature.
     * @returns The response, successful or not.
     */
    private async postCompletion(
        provider: ApiProvider,
        options: CompletionRequestOptions
    ): Promise<Response> {
        const request = provider === 'anthropic'
            ? this.buildAnthropicRequest(options)
            : this.buildOpenAiRequest(options);

        return fetch(request.url, {
            method: 'POST',
            headers: request.headers,
            body: JSON.stringify(request.body)
        });
    }

    /**
     * Picks the dialect from the host name; an unparsable URL counts as OpenAI-compatible.
     * @param url - Configured completions URL.
     */
    private detectProvider(url: string): ApiProvider {
        try {
            return new URL(url).host.toLowerCase().includes('anthropic.com') ? 'anthropic' : 'openai';
        } catch {
            return 'openai';
        }
    }

    /**
     * Builds a Messages API request. The configured URL is the base (e.g.
     * `https://api.anthropic.com/v1/`); `messages` is appended to it.
     * @param options - Request parameters.
     */
    private buildAnthropicRequest(options: CompletionRequestOptions): ApiRequest {
        const base = options.url.endsWith('/') ? options.url : `${options.url}/`;
        const endpoint = new URL('messages', base).toString();

        const body: Record<string, unknown> = {
            model: options.model,
            max_tokens: options.maxTokens,
            system: options.systemPrompt,
            messages: [{ role: 'user', content: options.userPrompt }]
        };

        if (options.temperature !== null) {
            body.temperature = options.temperature;
        }

        return {
            url: endpoint,
            headers: {
                'content-type': 'application/json',
                'x-api-key': options.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body
        };
    }

    /**
     * Builds a chat completions request. The configured URL is used unchanged and must
     * contain the full path.
     * @param options - Request parameters.
     */
    private buildOpenAiRequest(options: CompletionRequestOptions): ApiRequest {
        // Local servers ignore the key, but some reject a request without the header.
        const authHeader = options.apiKey ? `Bearer ${options.apiKey}` : 'Bearer EMPTY';

        const body: Record<string, unknown> = {
            model: options.model,
            messages: [
                { role: 'system', content: options.systemPrompt },
                { role: 'user', content: options.userPrompt }
            ],
            max_tokens: options.maxTokens
        };

        if (options.temperature !== null) {
            body.temperature = options.temperature;
        }

        return {
            url: options.url,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
            },
            body
        };
    }

    /**
     * Joins all text blocks of a Messages API response.
     * @param data - Parsed response body.
     */
    private parseAnthropicResponse(data: any): CompletionData {
        const content = (data.content ?? [])
            .filter((block: any) => block.type === 'text')
            .map((block: any) => block.text)
            .join('')
            .trim();

        return {
            content,
            promptTokens: data.usage?.input_tokens ?? 0,
            completionTokens: data.usage?.output_tokens ?? 0,
            hasLengthExceeded: data.stop_reason === 'max_tokens'
        };
    }

    /**
     * Reads the first choice of a chat completions response.
     * @param data - Parsed response body.
     * @throws TypeError if the response has no `choices[0].message.content`.
     */
    private parseOpenAiResponse(data: any): CompletionData {
        return {
            content: data.choices[0].message.content.trim(),
            promptTokens: data.usage?.prompt_tokens ?? 0,
            completionTokens: data.usage?.completion_tokens ?? 0,
            hasLengthExceeded: data.choices[0].finish_reason === 'length'
        };
    }
}
