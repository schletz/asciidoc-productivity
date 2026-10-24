import { defineConfig } from '@vscode/test-cli';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

// Every run starts with an empty workspace, so files written by commands under test
// never leak into the next run or into the repository.
const workspaceFolder = path.join(projectRoot, '.vscode-test', 'workspace');
fs.rmSync(workspaceFolder, { recursive: true, force: true });
fs.mkdirSync(path.join(workspaceFolder, '.vscode'), { recursive: true });

// New and empty documents would otherwise get the platform line ending (CRLF on Windows).
// Documents with content keep the line ending found in the content.
fs.writeFileSync(
	path.join(workspaceFolder, '.vscode', 'settings.json'),
	JSON.stringify({ 'files.eol': '\n' }, null, '\t'));

export default defineConfig({
	files: 'out/test/**/*.test.js',
	version: 'stable',
	workspaceFolder,
	// Other installed extensions must not interfere with the extension under test.
	launchArgs: ['--disable-extensions', '--disable-workspace-trust'],
	mocha: {
		ui: 'tdd',
		timeout: 20000,
	},
});
