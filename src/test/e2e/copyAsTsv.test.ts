import * as assert from 'assert';
import * as vscode from 'vscode';
import CommandTestContext from '../helpers/CommandTestContext';
import FakeClipboard from '../helpers/FakeClipboard';
import TestWorkspace from '../helpers/TestWorkspace';

suite('E2E: copyAsTsv', () => {
    const context = CommandTestContext.register();

    test('AsciiDoc: copies the selected table as TSV and unescapes pipes', async () => {
        const clipboard = new FakeClipboard(context.sandbox);
        context.sandbox.stub(vscode.window, 'showInformationMessage');
        await TestWorkspace.openDocument('copyAsTsv.adoc',
            '«|===\n|Name\n|Age\n\n|a\\|b\n|17\n|===»\n');

        await TestWorkspace.runCommand('copyAsTsv');

        assert.strictEqual(clipboard.text, 'Name\tAge\na|b\t17');
    });

    test('Markdown: copies the selected table as TSV without the delimiter row', async () => {
        const clipboard = new FakeClipboard(context.sandbox);
        context.sandbox.stub(vscode.window, 'showInformationMessage');
        await TestWorkspace.openDocument('copyAsTsv.md',
            '# Title\n\n«| Name | Age |\n|------|-----|\n| a\\|b | 17  |»\n');

        await TestWorkspace.runCommand('copyAsTsv');

        assert.strictEqual(clipboard.text, 'Name\tAge\na|b\t17');
    });

    test('warns without a selection and leaves the clipboard unchanged', async () => {
        const clipboard = new FakeClipboard(context.sandbox, 'before');
        const warning = context.sandbox.stub(vscode.window, 'showWarningMessage');
        await TestWorkspace.openDocument('copyAsTsvNoSelection.md', '| A |\n|---|\n');

        await TestWorkspace.runCommand('copyAsTsv');

        assert.strictEqual(clipboard.text, 'before');
        assert.strictEqual(warning.firstCall.args[0], 'Please select a table first.');
    });
});
