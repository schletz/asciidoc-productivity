import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import Docker from 'dockerode';
import * as tar from 'tar-stream';
import * as stream from 'stream';

const outputChannel = vscode.window.createOutputChannel("AsciiDoc PDF Export");
const docker = new Docker();

/**
 * Handles theme parameter prompting and preparation.
 * Returns Docker arguments and an optional temporary file path for cleanup.
 * @param dirPath - The directory containing the source file.
 * @param baseName - The filename without extension.
 * @returns Object containing theme arguments and optional temp theme path.
 */
async function getThemeParameter(dirPath: string, baseName: string): Promise<{ themeArgs: string[], tempThemePath?: string }> {
    let tempThemePath: string | undefined = undefined;
    let themeArgs: string[] = [];
    let useTheme = false;

    const defaultThemePath = path.join(dirPath, `${baseName}.yml`);

    if (fs.existsSync(defaultThemePath)) {
        const answer = await vscode.window.showInformationMessage(
            `Should I use ${baseName}.yml as theme file?`, 'Yes', 'No'
        );
        if (answer === 'Yes') {
            themeArgs = ['--theme', `${baseName}.yml`];
            useTheme = true;
        }
    }

    if (!useTheme) {
        const answer = await vscode.window.showInformationMessage(
            `Do you want to load a theme template?`, 'Yes', 'No'
        );
        if (answer === 'Yes') {
            const selectedFiles = await vscode.window.showOpenDialog({
                defaultUri: vscode.Uri.file(dirPath),
                openLabel: 'Select Theme',
                filters: { 'Theme Files': ['yml', 'yaml'] }
            });

            if (selectedFiles && selectedFiles.length > 0) {
                const selectedThemePath = selectedFiles[0].fsPath;

                // Check if the file is already inside the workspace directory
                if (selectedThemePath.toLowerCase().startsWith(dirPath.toLowerCase())) {
                    const relThemePath = path.relative(dirPath, selectedThemePath).replace(/\\/g, '/');
                    themeArgs = ['--theme', relThemePath];
                } else {
                    const tempFileName = `.temp-theme-${Date.now()}.yml`;
                    tempThemePath = path.join(dirPath, tempFileName);

                    fs.copyFileSync(selectedThemePath, tempThemePath);
                    themeArgs = ['--theme', tempFileName];
                    outputChannel.appendLine(`[INFO] External theme copied to temporary file: ${tempFileName}`);
                }
            }
        }
    }

    return { themeArgs, tempThemePath };
}

/**
 * Verifies Docker image existence and builds it in-memory if missing.
 */
async function ensureDockerImage(): Promise<void> {
    try {
        await docker.getImage('asciidoctor-pandoc:latest').inspect();
        outputChannel.appendLine('[INFO] Docker image "asciidoctor-pandoc" already exists.');
        return;
    } catch (e) {
        outputChannel.appendLine('[INFO] Docker image not found. Building image (in-memory)...');
    }

    const dockerfileContent = `
FROM asciidoctor/docker-asciidoctor
RUN apk add --no-cache pandoc
WORKDIR /documents
CMD ["sh"]
    `.trim();

    const pack = tar.pack();
    pack.entry({ name: 'Dockerfile' }, dockerfileContent);
    pack.finalize();

    const stream = await docker.buildImage(pack, { t: 'asciidoctor-pandoc' });

    await new Promise((resolve, reject) => {
        docker.modem.followProgress(
            stream,
            (err: any, res: any) => err ? reject(err) : resolve(res),
            (event: any) => {
                if (event.stream) { outputChannel.append(event.stream); }
                if (event.error) { outputChannel.appendLine(`[ERROR] ${event.error}`); }
            }
        );
    });
    outputChannel.appendLine('[INFO] Image successfully created.');
}

/**
 * Creates and runs the AsciiDoc container, streaming logs to the output channel.
 * @param dirPath - The workspace directory path.
 * @param fileName - The source filename.
 * @param targetPdf - The destination PDF filename.
 * @param themeParam - Array of theme-related Docker arguments.
 */
async function runAsciidoctorContainer(
    dirPath: string,
    fileName: string,
    targetPdf: string,
    themeParam: string[]
): Promise<void> {

    const cmd = [
        'asciidoctor-pdf',
        ...themeParam,
        '-r', 'asciidoctor-mathematical',
        '-r', 'asciidoctor-diagram',
        '-a', 'allow-uri-read',
        '-a', 'stem',
        '-a', 'mathematical-format=svg',
        '-o', targetPdf,
        fileName
    ];

    outputChannel.appendLine(`[EXEC] asciidoctor-pdf parameters: ${cmd.join(' ')}`);

    const container = await docker.createContainer({
        Image: 'asciidoctor-pandoc',
        Cmd: cmd,
        HostConfig: {
            AutoRemove: true,
            Binds: [`${dirPath}:/documents`]
        },
        WorkingDir: '/documents'
    });

    const logStream = new stream.PassThrough();
    logStream.on('data', (chunk) => {
        outputChannel.append(chunk.toString('utf8'));
    });

    const streamAttach = await container.attach({ stream: true, stdout: true, stderr: true });
    container.modem.demuxStream(streamAttach, logStream, logStream);

    await container.start();

    const data = await container.wait();
    if (data.StatusCode !== 0) {
        throw new Error(`The conversion process failed (Exit Code: ${data.StatusCode}).`);
    }
}


/**
 * Orchestrates the PDF export workflow for a given file URI.
 * @param clickedUri - The VS Code URI of the file to convert.
 */
export async function exportAsPdf(clickedUri: vscode.Uri) {
    if (!clickedUri) {
        vscode.window.showErrorMessage('Please call this command via the File Explorer.');
        return;
    }

    const inputPath = clickedUri.fsPath;
    const dirPath = path.dirname(inputPath);
    const fileName = path.basename(inputPath);
    const baseName = path.parse(fileName).name;
    const targetPdf = `${baseName}.pdf`;

    outputChannel.show();
    outputChannel.appendLine(`Starting PDF export for ${fileName}...`);

    const { themeArgs, tempThemePath } = await getThemeParameter(dirPath, baseName);

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Converting ${fileName} to PDF...`,
        cancellable: false
    }, async () => {
        try {
            await docker.ping();
            await ensureDockerImage();

            await runAsciidoctorContainer(dirPath, fileName, targetPdf, themeArgs);

            const cacheFolder = path.join(dirPath, '.asciidoctor');
            if (fs.existsSync(cacheFolder)) {
                fs.rmSync(cacheFolder, { recursive: true, force: true });
            }

            vscode.window.showInformationMessage(`Export successful: ${targetPdf}`);
            outputChannel.appendLine('[INFO] Done!');
        } catch (error: any) {
            if (error.syscall == 'connect') {
                vscode.window.showErrorMessage(
                    "Unable to access docker. Run 'docker ps' in the terminal to check if docker is running and if you have the necessary permissions."
                );
            } else {
                vscode.window.showErrorMessage(error.message || 'Error during PDF export. Check the output channel for details.');
            }
            outputChannel.appendLine(`[ABORT] ${error.message}`);
        } finally {
            if (tempThemePath && fs.existsSync(tempThemePath)) {
                try {
                    fs.unlinkSync(tempThemePath);
                    outputChannel.appendLine('[INFO] Temporary theme file cleaned up.');
                } catch (cleanupError) {
                    outputChannel.appendLine(`[WARNING] Could not delete temporary file: ${cleanupError}`);
                }
            }
        }
    });
}