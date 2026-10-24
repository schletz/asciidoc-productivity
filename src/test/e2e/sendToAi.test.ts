import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import MockLlmServer from '../helpers/MockLlmServer';
import TestSettings from '../helpers/TestSettings';
import TestWorkspace from '../helpers/TestWorkspace';

suite('E2E: sendToAi', () => {
    let sandbox: sinon.SinonSandbox;
    let llm: MockLlmServer;
    const settings = new TestSettings();

    suiteSetup(async () => {
        await TestWorkspace.activateExtension();
        llm = await MockLlmServer.start();
    });

    suiteTeardown(async () => {
        await llm.stop();
    });

    setup(() => {
        sandbox = sinon.createSandbox();
        llm.requests.length = 0;
        // Pick the built-in prompt instead of showing the QuickPick.
        sandbox.stub(vscode.window, 'showQuickPick').callsFake(async (items: any) =>
            (await items).find((item: vscode.QuickPickItem) => item.label === 'Check spelling and grammar'));
        sandbox.stub(vscode.window, 'showInformationMessage');
    });

    teardown(async () => {
        sandbox.restore();
        await settings.restore();
        await TestWorkspace.closeAllEditors();
    });

    test('replaces the selection with the answer of an OpenAI compatible endpoint', async () => {
        await settings.set('completionsUrl', llm.openAiUrl);
        await settings.set('llm', 'local-test-model');
        llm.respondWith('This is correct.');
        const editor = await TestWorkspace.openDocument('sendToAiOpenAi.adoc',
            '= Title\n\n«This are wrong.»\n');

        await TestWorkspace.runCommand('sendToAi');

        assert.strictEqual(editor.document.getText(), '= Title\n\nThis is correct.\n');
        const request = llm.lastRequest!;
        assert.strictEqual(request.path, '/v1/chat/completions');
        assert.strictEqual(request.headers.authorization, 'Bearer EMPTY');
        assert.strictEqual(request.body.model, 'local-test-model');
        assert.strictEqual(request.body.temperature, 0.1);
        assert.deepStrictEqual(request.body.messages[1], { role: 'user', content: 'This are wrong.' });
    });

    test('uses the Anthropic dialect and omits the temperature for Claude 5 models', async () => {
        llm.interceptAnthropic(sandbox);
        await settings.set('completionsUrl', 'https://api.anthropic.com/v1/');
        await settings.set('llm', 'claude-sonnet-5-5');
        await settings.set('apiKey', 'test-key');
        llm.respondWith('This is correct.');
        const editor = await TestWorkspace.openDocument('sendToAiAnthropic.adoc', '«This are wrong.»');

        await TestWorkspace.runCommand('sendToAi');

        assert.strictEqual(editor.document.getText(), 'This is correct.');
        const request = llm.lastRequest!;
        assert.strictEqual(request.path, '/v1/messages');
        assert.strictEqual(request.headers['x-api-key'], 'test-key');
        assert.strictEqual(request.body.temperature, undefined);
        assert.ok(request.body.system.startsWith('You are an expert editor'));
    });

    test('shows a warning and keeps the selection on an API error', async () => {
        await settings.set('completionsUrl', llm.openAiUrl);
        llm.respondWithError(500, '{"error":"boom"}');
        const warning = sandbox.stub(vscode.window, 'showWarningMessage');
        const editor = await TestWorkspace.openDocument('sendToAiError.adoc', '«Unchanged»');

        await TestWorkspace.runCommand('sendToAi');

        assert.strictEqual(editor.document.getText(), 'Unchanged');
        sinon.assert.calledOnce(warning);
        assert.match(String(warning.firstCall.args[0]), /API Error: Status 500/);
    });
});
