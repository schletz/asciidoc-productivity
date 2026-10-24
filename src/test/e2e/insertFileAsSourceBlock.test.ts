import * as assert from 'assert';
import * as vscode from 'vscode';
import CommandTestContext from '../helpers/CommandTestContext';
import TestWorkspace from '../helpers/TestWorkspace';

suite('E2E: insertFileAsSourceBlock', () => {
    const context = CommandTestContext.register();
    let sourceFile: vscode.Uri;

    suiteSetup(() => {
        sourceFile = vscode.Uri.file(TestWorkspace.writeFile('src/My File.cs', 'class A { }'));
    });

    test('AsciiDoc: inserts the file with a link as block title', async () => {
        const editor = await TestWorkspace.openDocument('insertFileAsSourceBlock.adoc', '«»');

        await TestWorkspace.runCommand('insertFileAsSourceBlock', sourceFile);

        assert.strictEqual(editor.document.getText(),
            '.link:src/My File.cs[→ My File.cs]\n[source,csharp]\n----\nclass A { }\n----\n');
    });

    test('Markdown: inserts the file with a link line above the fence', async () => {
        const editor = await TestWorkspace.openDocument('docs/insertFileAsSourceBlock.md', '«»');

        await TestWorkspace.runCommand('insertFileAsSourceBlock', sourceFile);

        assert.strictEqual(editor.document.getText(),
            '[→ My File.cs](<../src/My File.cs>)\n```csharp\nclass A { }\n```\n');
    });

    test('reports an error when called without a file', async () => {
        const error = context.sandbox.stub(vscode.window, 'showErrorMessage');
        const editor = await TestWorkspace.openDocument('insertFileAsSourceBlockNoUri.md', 'Text');

        await TestWorkspace.runCommand('insertFileAsSourceBlock');

        assert.strictEqual(editor.document.getText(), 'Text');
        assert.strictEqual(error.firstCall.args[0], 'This command must be called from the file explorer.');
    });
});
