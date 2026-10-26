import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import CommandTestContext from '../helpers/CommandTestContext';
import TestWorkspace from '../helpers/TestWorkspace';

suite('E2E: convertToTable', () => {
    const context = CommandTestContext.register();

    test('AsciiDoc: replaces the selected lines with a table', async () => {
        context.sandbox.stub(vscode.window, 'showInputBox').resolves(';');
        const editor = await TestWorkspace.openDocument('convertToTable.adoc',
            '= Title\n\n«Name; Age\nAnna; 17\n»after\n');

        await TestWorkspace.runCommand('convertToTable');

        assert.strictEqual(editor.document.getText(),
            '= Title\n\n[%header,cols="a,a"]\n|===\n|Name\n|Age\n\n|Anna\n|17\n|===\nafter\n');
    });

    test('Markdown: converts whole lines touched by the selection and skips blank lines', async () => {
        context.sandbox.stub(vscode.window, 'showInputBox').resolves(':');
        const editor = await TestWorkspace.openDocument('convertToTable.md',
            '# Title\n\nA«: C\n\nB: »D\n');

        await TestWorkspace.runCommand('convertToTable');

        assert.strictEqual(editor.document.getText(),
            '# Title\n\n| A   | C   |\n|-----|-----|\n| B   | D   |\n');
    });

    test('Markdown: \\t in the input box stands for a tab', async () => {
        context.sandbox.stub(vscode.window, 'showInputBox').resolves('\\t');
        const editor = await TestWorkspace.openDocument('convertToTableTab.md', '«A\tB\nx\ty»');

        await TestWorkspace.runCommand('convertToTable');

        assert.strictEqual(editor.document.getText(), '| A   | B   |\n|-----|-----|\n| x   | y   |');
    });

    test('warns without a selection and does not ask for a delimiter', async () => {
        const inputBox = context.sandbox.stub(vscode.window, 'showInputBox');
        const warning = context.sandbox.stub(vscode.window, 'showWarningMessage');
        const editor = await TestWorkspace.openDocument('convertToTableNoSelection.md', 'A: C');

        await TestWorkspace.runCommand('convertToTable');

        assert.strictEqual(editor.document.getText(), 'A: C');
        sinon.assert.notCalled(inputBox);
        assert.strictEqual(warning.firstCall.args[0], 'Please select the lines to convert first.');
    });

    test('warns and leaves the document unchanged if the delimiter is missing', async () => {
        context.sandbox.stub(vscode.window, 'showInputBox').resolves(';');
        const warning = context.sandbox.stub(vscode.window, 'showWarningMessage');
        const editor = await TestWorkspace.openDocument('convertToTableNoDelimiter.md', '«A: C»');

        await TestWorkspace.runCommand('convertToTable');

        assert.strictEqual(editor.document.getText(), 'A: C');
        assert.strictEqual(warning.firstCall.args[0], 'Delimiter ";" not found in the selection.');
    });
});
