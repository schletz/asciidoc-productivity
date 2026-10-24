import * as vscode from 'vscode';

/**
 * Changes settings of the extension for the duration of a test and restores the
 * previous values afterwards. Values are written to the workspace settings, which
 * live in the per-run workspace folder and therefore never persist between runs.
 */
export default class TestSettings {
    private readonly section = 'asciidoc-productivity';
    private readonly previousValues = new Map<string, unknown>();

    /**
     * Sets a setting of the extension.
     * @param key Key without the extension prefix, e.g. 'completionsUrl'.
     * @param value New value; undefined removes the workspace value.
     */
    public async set(key: string, value: unknown): Promise<void> {
        const config = vscode.workspace.getConfiguration(this.section);
        if (!this.previousValues.has(key)) {
            this.previousValues.set(key, config.inspect(key)?.workspaceValue);
        }
        await config.update(key, value, vscode.ConfigurationTarget.Workspace);
    }

    /**
     * Restores every setting changed through this instance.
     */
    public async restore(): Promise<void> {
        const config = vscode.workspace.getConfiguration(this.section);
        for (const [key, value] of this.previousValues) {
            await config.update(key, value, vscode.ConfigurationTarget.Workspace);
        }
        this.previousValues.clear();
    }
}
