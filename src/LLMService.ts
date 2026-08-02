import { performance } from 'perf_hooks';
import ConfigurationService from './ConfigurationService';
import TemperatureSupport from './TemperatureSupport';
import type * as vscode from 'vscode';

export interface PromptStats {
    promptTokens: number;
    completionTokens: number;
    durationSeconds: number;
    tokensPerSecond: number;
    hasLengethExeeded: boolean;
}

export interface PromptResult {
    content: string;
    stats: PromptStats | null;
}

/**
 * Identifies which API dialect a configured endpoint speaks. The Anthropic
 * Messages API differs from OpenAI-compatible endpoints (Google, OpenAI, ...)
 * in authentication, request body, and response shape.
 */
type ApiProvider = 'anthropic' | 'openai';

/**
 * Normalized completion result, decoupled from the provider-specific payload.
 */
interface CompletionData {
    content: string;
    promptTokens: number;
    completionTokens: number;
    hasLengthExceeded: boolean;
}

/**
 * Fully prepared HTTP request for a completions endpoint.
 */
interface ApiRequest {
    url: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
}

/**
 * Parameters shared by all completion requests, regardless of the API dialect.
 */
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
 * Service for managing interactions with external LLM APIs.
 *
 * Supports two wire formats: the native Anthropic Messages API
 * (`api.anthropic.com`) and OpenAI-compatible chat completions
 * (OpenAI, Google Gemini's OpenAI endpoint, ...).
 */
export default class LLMService {
    private configService: ConfigurationService;
    private temperatureSupport: TemperatureSupport;

    constructor(configService: ConfigurationService) {
        this.configService = configService;
        this.temperatureSupport = new TemperatureSupport();
    }

    /**
     * Sends a prompt to the configured LLM and returns generated content with usage metrics.
     * @param systemPrompt - System-level instruction for the model.
     * @param userPrompt - User input message.
     * @param temperature - Controls randomness in response generation. It is
     *   omitted automatically for models that no longer accept sampling
     *   parameters; a request rejected because of it is retried once without it.
     * @param outputChannel - Optional VS Code channel for logging request/response metrics.
     * @returns Promise resolving to a PromptResult containing content and stats.
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
            // Surface the API's error body, which usually explains the failure.
            const details = await response.text().catch(() => '');

            // Newer models reject the sampling parameters. The static model
            // check cannot know every id, so a rejection is used to correct it
            // and the request is repeated once without the temperature.
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
                hasLengethExeeded: completion.hasLengthExceeded
            };

            if (outputChannel) {
                outputChannel.appendLine(`[LLMService] Response received in ${stats.durationSeconds.toFixed(2)}s`);
                outputChannel.appendLine(`[LLMService] Speed: ${stats.tokensPerSecond} TPS`);
            }
        }

        return { content: completion.content, stats };
    }

    /**
     * Builds and sends a completion request for the given API dialect.
     * @param provider - Detected API dialect.
     * @param options - Request parameters including the effective temperature.
     * @returns The raw fetch response, successful or not.
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
     * Determines the API dialect from the endpoint host.
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
     * Builds a native Anthropic Messages API request.
     * Uses `x-api-key` auth, the mandatory `anthropic-version` header, a
     * separate `system` field, and the `/v1/messages` endpoint resolved
     * relative to the configured base URL (e.g. `https://api.anthropic.com/v1/`).
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

        // Models that dropped the sampling parameters rely on their default
        // effort setting instead; older models still use the temperature for
        // translations, code formatting, and code comments.
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
     * Builds an OpenAI-compatible chat completions request (OpenAI, Google, ...).
     * The configured URL is expected to already include the full path.
     */
    private buildOpenAiRequest(options: CompletionRequestOptions): ApiRequest {
        // Fallback to placeholder token when API key is missing to prevent request failure
        const authHeader = options.apiKey ? `Bearer ${options.apiKey}` : 'Bearer EMPTY';

        const body: Record<string, unknown> = {
            model: options.model,
            messages: [
                { role: 'system', content: options.systemPrompt },
                { role: 'user', content: options.userPrompt }
            ],
            max_tokens: options.maxTokens
        };

        // Recent OpenAI reasoning models reject the parameter as well.
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
     * Normalizes a native Anthropic Messages API response.
     * @param data - Parsed JSON body returned by `/v1/messages`.
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
     * Normalizes an OpenAI-compatible chat completions response.
     * @param data - Parsed JSON body returned by the chat completions endpoint.
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
