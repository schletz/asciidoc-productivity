import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import CommandTestContext from '../helpers/CommandTestContext';
import FakeClipboard from '../helpers/FakeClipboard';
import MockFileServer from '../helpers/MockFileServer';
import TestWorkspace from '../helpers/TestWorkspace';

/** Signature bytes of a PNG file; enough to check that the download was written unchanged. */
const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

suite('E2E: insertImageFromFile', () => {
    const context = CommandTestContext.register();

    for (const [fileName, expected] of [
        ['docs/fromFile.adoc', 'image::../img/my picture.png[]\n'],
        ['docs/fromFile.md', '![my picture](<../img/my picture.png>)\n']
    ]) {
        test(`${path.extname(fileName).slice(1)}: inserts the selected image with a relative path`, async () => {
            const imagePath = TestWorkspace.writeFile('img/my picture.png', pngBytes);
            context.sandbox.stub(vscode.window, 'showOpenDialog').resolves([vscode.Uri.file(imagePath)]);
            const editor = await TestWorkspace.openDocument(fileName, '«»');

            await TestWorkspace.runCommand('insertImageFromFile');

            assert.strictEqual(editor.document.getText(), expected);
        });
    }
});

suite('E2E: insertImageBlock', () => {
    const context = CommandTestContext.register();
    let server: MockFileServer;

    suiteSetup(async () => {
        server = await MockFileServer.start({ '/image.png': pngBytes });
    });

    suiteTeardown(async () => {
        await server.stop();
    });

    for (const [fileName, expected] of [
        ['imageBlock.adoc', (url: string) => `.Source: ${url}\nimage::images/download-adoc.png[]\n`],
        ['imageBlock.md', (url: string) => `![download-md](images/download-md.png)\n\n*Source: <${url}>*\n`]
    ] as const) {
        const extension = path.extname(fileName).slice(1);
        test(`${extension}: downloads the clipboard URL and inserts the image with its source`, async () => {
            const url = server.url('/image.png');
            new FakeClipboard(context.sandbox, url);
            const savePath = path.join(TestWorkspace.rootPath, 'images', `download-${extension}.png`);
            fs.mkdirSync(path.dirname(savePath), { recursive: true });
            context.sandbox.stub(vscode.window, 'showSaveDialog').resolves(vscode.Uri.file(savePath));
            const editor = await TestWorkspace.openDocument(fileName, '«»');

            await TestWorkspace.runCommand('insertImageBlock');

            assert.strictEqual(editor.document.getText(), expected(url));
            assert.deepStrictEqual(fs.readFileSync(savePath), pngBytes);
        });
    }

    test('reports a failed download and leaves the document unchanged', async () => {
        new FakeClipboard(context.sandbox, server.url('/missing.png'));
        context.sandbox.stub(vscode.window, 'showSaveDialog')
            .resolves(vscode.Uri.file(path.join(TestWorkspace.rootPath, 'missing.png')));
        const error = context.sandbox.stub(vscode.window, 'showErrorMessage');
        const editor = await TestWorkspace.openDocument('imageBlockMissing.md', 'Text');

        await TestWorkspace.runCommand('insertImageBlock');

        assert.strictEqual(editor.document.getText(), 'Text');
        assert.strictEqual(error.firstCall.args[0], 'Error downloading image (Status: 404).');
    });
});

suite('E2E: insertImageFromClipboard', () => {
    const context = CommandTestContext.register();

    // Reading the image needs the real system clipboard, so only the guard is tested here;
    // the inserted markup is covered by the syntax unit tests.
    test('rejects an unsaved document before opening the save dialog', async () => {
        const error = context.sandbox.stub(vscode.window, 'showErrorMessage');
        const saveDialog = context.sandbox.stub(vscode.window, 'showSaveDialog');
        await TestWorkspace.openUntitledDocument('markdown');

        await TestWorkspace.runCommand('insertImageFromClipboard');

        assert.strictEqual(error.firstCall.args[0], 'Please save the document first to insert images with relative paths.');
        assert.strictEqual(saveDialog.callCount, 0);
    });
});
