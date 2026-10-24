import * as assert from 'assert';
import * as vscode from 'vscode';
import CommandTestContext from '../helpers/CommandTestContext';
import TestWorkspace from '../helpers/TestWorkspace';

suite('E2E: formatTable', () => {
    const context = CommandTestContext.register();

    test('aligns the table under the cursor and leaves the rest of the document unchanged', async () => {
        const editor = await TestWorkspace.openDocument('formatTable.md',
            '# Title\n\n| Name | Age |\n|---|--:|\n| Bern«»d | 102 |\n\n| Other | table |\n|-|-|\n');

        await TestWorkspace.runCommand('formatTable');

        assert.strictEqual(editor.document.getText(),
            '# Title\n\n| Name  | Age |\n|-------|----:|\n| Bernd | 102 |\n\n| Other | table |\n|-|-|\n');
    });

    test('keeps CRLF line endings', async () => {
        const editor = await TestWorkspace.openDocument('formatTableCrlf.md', '«»| A | B |\r\n|-|-|\r\n| 1 | 2 |\r\n');

        await TestWorkspace.runCommand('formatTable');

        assert.strictEqual(editor.document.getText(), '| A   | B   |\r\n|-----|-----|\r\n| 1   | 2   |\r\n');
    });

    test('does not modify an already formatted table', async () => {
        const editor = await TestWorkspace.openDocument('formatTableClean.md', '«»| A   |\n|-----|\n| 1   |\n');

        await TestWorkspace.runCommand('formatTable');

        assert.strictEqual(editor.document.isDirty, false);
    });

    test('warns when the cursor is not inside a table', async () => {
        const warning = context.sandbox.stub(vscode.window, 'showWarningMessage');
        const editor = await TestWorkspace.openDocument('formatTableOutside.md', '«»Text\n\n| A |\n|---|\n');

        await TestWorkspace.runCommand('formatTable');

        assert.strictEqual(editor.document.getText(), 'Text\n\n| A |\n|---|\n');
        assert.strictEqual(warning.firstCall.args[0], 'Place the cursor inside a Markdown table.');
    });

    test('reports that AsciiDoc tables are not supported', async () => {
        const error = context.sandbox.stub(vscode.window, 'showErrorMessage');
        const editor = await TestWorkspace.openDocument('formatTable.adoc', '|===\n|«»A |B\n|===\n');

        await TestWorkspace.runCommand('formatTable');

        assert.strictEqual(editor.document.getText(), '|===\n|A |B\n|===\n');
        assert.strictEqual(error.firstCall.args[0], 'Formatting tables is only supported in Markdown documents.');
    });
});
