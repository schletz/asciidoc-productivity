import * as assert from 'assert';
import * as vscode from 'vscode';
import CommandTestContext from '../helpers/CommandTestContext';
import FakeClipboard from '../helpers/FakeClipboard';
import TestWorkspace from '../helpers/TestWorkspace';

suite('E2E: markup command errors', () => {
    const context = CommandTestContext.register();

    test('rejects documents that are neither AsciiDoc nor Markdown', async () => {
        new FakeClipboard(context.sandbox, 'A\tB');
        const error = context.sandbox.stub(vscode.window, 'showErrorMessage');
        const editor = await TestWorkspace.openDocument('notes.txt', 'Text');

        await TestWorkspace.runCommand('insertTsvTable');

        assert.strictEqual(editor.document.getText(), 'Text');
        assert.strictEqual(error.firstCall.args[0], 'Only AsciiDoc and Markdown documents are supported.');
    });

    test('accepts an untitled document by its language id', async () => {
        new FakeClipboard(context.sandbox, 'A\tB');
        const editor = await TestWorkspace.openUntitledDocument('markdown');

        await TestWorkspace.runCommand('insertTsvTable');

        assert.strictEqual(editor.document.getText(), '| A   | B   |\n|-----|-----|\n');
    });

    test('reports a missing editor', async () => {
        const error = context.sandbox.stub(vscode.window, 'showErrorMessage');

        await TestWorkspace.runCommand('insertTsvTable');

        assert.strictEqual(error.firstCall.args[0], 'No editor open.');
    });
});
