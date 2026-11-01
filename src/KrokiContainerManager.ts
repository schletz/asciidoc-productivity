import * as vscode from 'vscode';
import Docker from 'dockerode';

/** Log of the preview, shared with PreviewService. */
export const outputChannel = vscode.window.createOutputChannel("AsciiDoc Preview");

/**
 * Runs a local `yuzutech/kroki` container, so PlantUML diagrams in the preview render
 * offline. The container is bound to a random host port and removed when it stops.
 */
export class KrokiContainerManager {
    private docker = new Docker();
    private container?: Docker.Container;
    private startupPromise?: Promise<void>;
    /** Host port of the running container; undefined while none is running. */
    public port?: string;

    /**
     * Pulls the image if missing, starts the container and waits until Kroki answers.
     * Concurrent calls share one startup.
     * @throws Error if Docker is unreachable or Kroki does not become ready.
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
        // Host port 0 lets Docker pick a free port; the actual one is read back after the start.
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
     * Polls Kroki until it answers, because the Java server inside the container needs some
     * seconds after the container start.
     * @param port - Host port of the container.
     * @throws Error after 20 attempts at 500 ms intervals.
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
                // Connection refused is expected while the server boots.
            }
            await new Promise(r => setTimeout(r, 500));
        }

        throw new Error('Kroki server did not become ready in time.');
    }

    /**
     * Stops the container, which Docker then removes. Does nothing if none is running.
     */
    public async stop(): Promise<void> {
        if (!this.container) {
            return;
        }

        try {
            await this.container.stop();
            outputChannel.appendLine('[INFO] Kroki container stopped and removed.');
        } catch {
            // The container may already be gone, e.g. stopped outside VS Code.
        } finally {
            this.container = undefined;
            this.port = undefined;
        }
    }
}
