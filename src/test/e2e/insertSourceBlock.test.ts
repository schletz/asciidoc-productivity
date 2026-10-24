import * as assert from 'assert';
import * as vscode from 'vscode';
import CommandTestContext from '../helpers/CommandTestContext';
import FakeClipboard from '../helpers/FakeClipboard';
import TestWorkspace from '../helpers/TestWorkspace';

suite('E2E: insertSourceBlock', () => {
    const context = CommandTestContext.register();

    test('AsciiDoc: wraps the clipboard in a block with the entered language', async () => {
        new FakeClipboard(context.sandbox, 'print(1)');
        const inputBox = context.sandbox.stub(vscode.window, 'showInputBox').resolves('python');
        const editor = await TestWorkspace.openDocument('insertSourceBlock.adoc', '«»');

        await TestWorkspace.runCommand('insertSourceBlock');

        assert.strictEqual(editor.document.getText(), '[source,python]\n----\nprint(1)\n----\n');
        assert.strictEqual(inputBox.firstCall.args[0]?.value, 'csharp', 'default language');
    });

    test('Markdown: wraps the clipboard in a fenced block', async () => {
        new FakeClipboard(context.sandbox, 'print(1)');
        context.sandbox.stub(vscode.window, 'showInputBox').resolves('python');
        const editor = await TestWorkspace.openDocument('insertSourceBlock.md', '# Code\n\n«»');

        await TestWorkspace.runCommand('insertSourceBlock');

        assert.strictEqual(editor.document.getText(), '# Code\n\n```python\nprint(1)\n```\n');
    });

    test('warns and leaves the document unchanged on an empty clipboard', async () => {
        new FakeClipboard(context.sandbox, '');
        context.sandbox.stub(vscode.window, 'showInputBox').resolves('python');
        const warning = context.sandbox.stub(vscode.window, 'showWarningMessage');
        const editor = await TestWorkspace.openDocument('insertSourceBlockEmpty.md', 'Text');

        await TestWorkspace.runCommand('insertSourceBlock');

        assert.strictEqual(editor.document.getText(), 'Text');
        assert.strictEqual(warning.firstCall.args[0], 'The clipboard is empty.');
    });
});
