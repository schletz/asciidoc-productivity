import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import CommandTestContext from '../helpers/CommandTestContext';
import FakeClipboard from '../helpers/FakeClipboard';
import TestWorkspace from '../helpers/TestWorkspace';

suite('E2E: insertTsvTable', () => {
    const context = CommandTestContext.register();

    test('AsciiDoc: inserts clipboard TSV as table at the cursor', async () => {
        new FakeClipboard(context.sandbox, 'Name\tAge\nAnna\t17\n');
        const editor = await TestWorkspace.openDocument('insertTsvTable.adoc', '= Title\n\n«»');

        await TestWorkspace.runCommand('insertTsvTable');

        assert.strictEqual(editor.document.getText(),
            '= Title\n\n[%header,cols="a,a"]\n|===\n|Name\n|Age\n\n|Anna\n|17\n|===\n');
    });

    test('Markdown: inserts clipboard TSV as aligned table at the cursor', async () => {
        new FakeClipboard(context.sandbox, 'Name\tAge\nAnna\t17\n');
        const editor = await TestWorkspace.openDocument('insertTsvTable.md', '# Title\n\n«»');

        await TestWorkspace.runCommand('insertTsvTable');

        assert.strictEqual(editor.document.getText(),
            '# Title\n\n| Name | Age |\n|------|-----|\n| Anna | 17  |\n');
    });

    test('warns and leaves the document unchanged on an empty clipboard', async () => {
        new FakeClipboard(context.sandbox, '  ');
        const warning = context.sandbox.stub(vscode.window, 'showWarningMessage');
        const editor = await TestWorkspace.openDocument('insertTsvTableEmpty.md', 'Text');

        await TestWorkspace.runCommand('insertTsvTable');

        assert.strictEqual(editor.document.getText(), 'Text');
        sinon.assert.calledOnce(warning);
        assert.strictEqual(warning.firstCall.args[0], 'Clipboard is empty.');
    });
});
