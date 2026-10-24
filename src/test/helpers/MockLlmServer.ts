import * as http from 'http';
import { AddressInfo } from 'net';
import * as sinon from 'sinon';

/** A request as received by the mock server. */
export interface RecordedRequest {
    method: string;
    path: string;
    headers: http.IncomingHttpHeaders;
    body: any;
}

/** Answer the mock server sends for the next requests. */
interface MockAnswer {
    status: number;
    /** Text of the completion, used when status is 200. */
    content: string;
    /** Simulates a response cut off at maxOutputTokens. */
    truncated: boolean;
    /** Raw body sent instead of a completion, used when status is not 200. */
    errorBody: string;
}

/**
 * Local HTTP server that imitates an LLM endpoint. Requests to a path ending in
 * /messages are answered in the Anthropic Messages format, all others in the
 * OpenAI chat completions format. Every request is recorded for assertions.
 */
export default class MockLlmServer {
    public readonly requests: RecordedRequest[] = [];
    private answer: MockAnswer = { status: 200, content: '', truncated: false, errorBody: '' };

    private constructor(private readonly server: http.Server) { }

    /**
     * Starts a server on a free port of the loopback interface.
     */
    public static async start(): Promise<MockLlmServer> {
        let mock: MockLlmServer | undefined;
        const server = http.createServer((req, res) => mock!.handle(req, res));
        mock = new MockLlmServer(server);
        await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
        return mock;
    }

    /** Base URL of the server, ending with /v1/. */
    public get baseUrl(): string {
        const { port } = this.server.address() as AddressInfo;
        return `http://127.0.0.1:${port}/v1/`;
    }

    /** Full URL of the OpenAI compatible endpoint, as expected by the completionsUrl setting. */
    public get openAiUrl(): string {
        return `${this.baseUrl}chat/completions`;
    }

    /** The most recent request. */
    public get lastRequest(): RecordedRequest | undefined {
        return this.requests.at(-1);
    }

    /**
     * Answers all following requests with a successful completion.
     * @param content Text the model "generates".
     * @param truncated True to report that the output token limit was hit.
     */
    public respondWith(content: string, truncated: boolean = false): void {
        this.answer = { status: 200, content, truncated, errorBody: '' };
    }

    /**
     * Answers all following requests with an HTTP error.
     * @param status HTTP status code, e.g. 400 or 500.
     * @param body Raw response body, e.g. an API error JSON.
     */
    public respondWithError(status: number, body: string): void {
        this.answer = { status, content: '', truncated: false, errorBody: body };
    }

    /**
     * Redirects fetch calls to https://api.anthropic.com to this server. The extension
     * only speaks the Anthropic dialect when the host contains anthropic.com, so this is
     * the only way to exercise that code path locally. Extension and tests share the
     * global fetch of the extension host process.
     * @param sandbox Sinon sandbox of the current test; restore() removes the redirect.
     */
    public interceptAnthropic(sandbox: sinon.SinonSandbox): void {
        const realFetch = globalThis.fetch;
        const anthropicBase = 'https://api.anthropic.com/v1/';
        sandbox.stub(globalThis, 'fetch').callsFake((input: string | URL | Request, init?: RequestInit) => {
            const url = input instanceof Request ? input.url : input.toString();
            return realFetch(url.startsWith(anthropicBase) ? url.replace(anthropicBase, this.baseUrl) : input, init);
        });
    }

    /**
     * Stops the server and closes open connections.
     */
    public async stop(): Promise<void> {
        this.server.closeAllConnections();
        await new Promise<void>(resolve => this.server.close(() => resolve()));
    }

    /**
     * Records the request and writes the configured answer in the dialect matching the path.
     */
    private handle(req: http.IncomingMessage, res: http.ServerResponse): void {
        const chunks: Buffer[] = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            const path = req.url ?? '';
            this.requests.push({
                method: req.method ?? '',
                path,
                headers: req.headers,
                body: raw ? JSON.parse(raw) : undefined
            });

            if (this.answer.status !== 200) {
                res.writeHead(this.answer.status, { 'Content-Type': 'application/json' });
                res.end(this.answer.errorBody);
                return;
            }

            const body = path.endsWith('/messages')
                ? this.anthropicBody()
                : this.openAiBody();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(body));
        });
    }

    private openAiBody(): object {
        return {
            choices: [{
                message: { role: 'assistant', content: this.answer.content },
                finish_reason: this.answer.truncated ? 'length' : 'stop'
            }],
            usage: { prompt_tokens: 10, completion_tokens: 20 }
        };
    }

    private anthropicBody(): object {
        return {
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: this.answer.content }],
            stop_reason: this.answer.truncated ? 'max_tokens' : 'end_turn',
            usage: { input_tokens: 10, output_tokens: 20 }
        };
    }
}
