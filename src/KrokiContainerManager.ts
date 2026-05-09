import * as vscode from 'vscode';
import Docker from 'dockerode';

export const outputChannel = vscode.window.createOutputChannel("AsciiDoc Preview");

/**
 * Manages the lifecycle of a local Kroki Docker container for PlantUML rendering.
 * Ensures only one instance runs during the preview session and cleans up upon exit.
 */
export class KrokiContainerManager {
    private docker = new Docker();
    private container?: Docker.Container;
    private startupPromise?: Promise<void>;
    public port?: string;

    /**
     * Pulls the yuzutech/kroki image if not present and starts a new container with a dynamic host port.
     * Implements a locking mechanism to prevent race conditions on rapid calls.
     */
    public start(): Promise<void> {
        if (this.container) {
            return Promise.resolve();
        }
        if (this.startupPromise) {
            return this.startupPromise;
        }

        this.startupPromise = this._start().finally(() => {
            this.startupPromise = undefined;
        });

        return this.startupPromise;
    }

    private async _start(): Promise<void> {
        try {
            await this.docker.getImage('yuzutech/kroki:latest').inspect();
            outputChannel.appendLine('[INFO] Docker image "yuzutech/kroki" already exists.');
        } catch {
            outputChannel.show();
            outputChannel.appendLine('[INFO] Docker image not found. Pulling image...');
            await new Promise<void>((resolve, reject) => {
                this.docker.pull('yuzutech/kroki:latest', (err: any, stream: any) => {
                    if (err) {
                        return reject(err);
                    }
                    this.docker.modem.followProgress(
                        stream,
                        (e: any) => e ? reject(e) : resolve(),
                        (event: any) => {
                            if (event.stream) {
                                outputChannel.append(event.stream);
                            } else if (event.status) {
                                outputChannel.appendLine(`[STATUS] ${event.status} ${event.progress || ''}`);
                            }
                        }
                    );
                });
            });
            outputChannel.appendLine('[INFO] Image successfully pulled.');
        }

        outputChannel.appendLine('[INFO] Creating Kroki container...');
        this.container = await this.docker.createContainer({
            Image: 'yuzutech/kroki:latest',
            ExposedPorts: { '8000/tcp': {} },
            HostConfig: {
                AutoRemove: true,
                PortBindings: { '8000/tcp': [{ HostPort: '0' }] }
            }
        });

        await this.container.start();
        const info = await this.container.inspect();
        this.port = info.NetworkSettings.Ports['8000/tcp'][0].HostPort;
        
        outputChannel.appendLine(`[INFO] Kroki container started on host port ${this.port}. Waiting for health check...`);
        await this.waitForKroki(this.port);
        outputChannel.appendLine('[INFO] Kroki server is up and running.');
    }

    /**
     * Polls the Kroki server until it returns a successful HTTP response.
     * Prevents the preview webview from requesting broken images while the internal Java server is booting.
     * @param port - The dynamic host port bound to the container.
     */
    private async waitForKroki(port: string): Promise<void> {
        const url = `http://localhost:${port}/`;
        const maxAttempts = 20;
        
        for (let i = 0; i < maxAttempts; i++) {
            try {
                const response = await fetch(url);
                if (response.ok) {
                    return;
                }
            } catch (e) {
                // Connection refused is expected during early boot
            }
            await new Promise(r => setTimeout(r, 500));
        }
        
        throw new Error('Kroki server did not become ready in time.');
    }

    /**
     * Stops and removes the active Kroki container.
     */
    public async stop(): Promise<void> {
        if (!this.container) {
            return;
        }

        try {
            await this.container.stop();
            outputChannel.appendLine('[INFO] Kroki container stopped and removed.');
        } catch {
            // Container might already be gone
        } finally {
            this.container = undefined;
            this.port = undefined;
        }
    }
}