import { performance } from 'perf_hooks';
import ConfigurationService from './ConfigurationService';
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
 * Service for managing interactions with external LLM APIs.
 *
 * Supports two wire formats: the native Anthropic Messages API
 * (`api.anthropic.com`) and OpenAI-compatible chat completions
 * (OpenAI, Google Gemini's OpenAI endpoint, ...).
 */
export default class LLMService {
    private configService: ConfigurationService;

    constructor(configService: ConfigurationService) {
        this.configService = configService;
    }

    /**
     * Sends a prompt to the configured LLM and returns generated content with usage metrics.
     * @param systemPrompt - System-level instruction for the model.
     * @param userPrompt - User input message.
     * @param temperature - Controls randomness in response generation.
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
        const request = provider === 'anthropic'
            ? this.buildAnthropicRequest(url, model, apiKey, systemPrompt, userPrompt, temperature, maxTokens)
            : this.buildOpenAiRequest(url, model, apiKey, systemPrompt, userPrompt, temperature, maxTokens);

        if (outputChannel) {
            outputChannel.appendLine(`\n[LLMService] Sending request to: ${request.url}`);
            outputChannel.appendLine(`[LLMService] Provider: ${provider}, Model: ${model}`);
        }

        const startTime = performance.now();

        const response = await fetch(request.url, {
            method: 'POST',
            headers: request.headers,
            body: JSON.stringify(request.body)
        });

        if (!response.ok) {
            // Surface the API's error body, which usually explains the failure.
            const details = await response.text().catch(() => '');
            throw new Error(`API Error: Status ${response.status} - ${response.statusText}${details ? ` - ${details}` : ''}`);
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
    private buildAnthropicRequest(
        url: string,
        model: string,
        apiKey: string,
        systemPrompt: string,
        userPrompt: string,
        temperature: number,
        maxTokens: number
    ): { url: string; headers: Record<string, string>; body: unknown } {
        const base = url.endsWith('/') ? url : `${url}/`;
        const endpoint = new URL('messages', base).toString();

        const body: Record<string, unknown> = {
            model,
            max_tokens: maxTokens,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }]
        };

        // Opus 4.7+/Fable/Mythos reject `temperature` (HTTP 400) and rely on the
        // default effort setting (high) instead. Sonnet/Haiku still accept it
        // and use it for translations, code formatting, and code comments.
        if (this.anthropicSupportsTemperature(model)) {
            body.temperature = temperature;
        }

        return {
            url: endpoint,
            headers: {
                'content-type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body
        };
    }

    /**
     * Indicates whether an Anthropic model accepts the `temperature` sampling
     * parameter. Opus 4.7/4.8, Fable, and Mythos models removed it and return
     * a 400 if it is sent; Sonnet and Haiku still support it.
     * @param model - Configured Anthropic model id.
     */
    private anthropicSupportsTemperature(model: string): boolean {
        return !/opus|fable|mythos/i.test(model);
    }

    /**
     * Builds an OpenAI-compatible chat completions request (OpenAI, Google, ...).
     * The configured URL is expected to already include the full path.
     */
    private buildOpenAiRequest(
        url: string,
        model: string,
        apiKey: string,
        systemPrompt: string,
        userPrompt: string,
        temperature: number,
        maxTokens: number
    ): { url: string; headers: Record<string, string>; body: unknown } {
        // Fallback to placeholder token when API key is missing to prevent request failure
        const authHeader = apiKey ? `Bearer ${apiKey}` : 'Bearer EMPTY';

        return {
            url,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
            },
            body: {
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: maxTokens,
                temperature
            }
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
