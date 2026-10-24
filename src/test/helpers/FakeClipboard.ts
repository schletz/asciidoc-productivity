import * as sinon from 'sinon';
import * as vscode from 'vscode';

/**
 * In-memory replacement for vscode.env.clipboard, so tests neither depend on nor
 * overwrite the clipboard of the developer's machine. The extension under test sees
 * the fake because it shares the vscode API object with the tests.
 */
export default class FakeClipboard {
    /** Current clipboard content; read by readText and replaced by writeText. */
    public text: string;

    /**
     * Installs the fake into the sandbox; sandbox.restore() removes it again.
     * @param sandbox Sinon sandbox of the current test.
     * @param initialText Content that readText returns until the extension writes.
     */
    constructor(sandbox: sinon.SinonSandbox, initialText: string = '') {
        this.text = initialText;
        // The clipboard object itself is frozen, but env exposes it through a configurable
        // getter, so the whole object is replaced.
        const fake: vscode.Clipboard = {
            readText: async () => this.text,
            writeText: async (value: string) => { this.text = value; }
        };
        sandbox.replaceGetter(vscode.env, 'clipboard', () => fake);
    }
}
