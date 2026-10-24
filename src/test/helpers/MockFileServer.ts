import * as http from 'http';
import { AddressInfo } from 'net';

/**
 * Local HTTP server that serves fixed files, e.g. images for download commands.
 * Unknown paths are answered with 404.
 */
export default class MockFileServer {
    private constructor(private readonly server: http.Server) { }

    /**
     * Starts a server on a free port of the loopback interface.
     * @param files Response bodies by URL path, e.g. { '/image.png': pngBytes }.
     */
    public static async start(files: Record<string, Buffer>): Promise<MockFileServer> {
        const server = http.createServer((req, res) => {
            const body = files[req.url ?? ''];
            res.writeHead(body ? 200 : 404);
            res.end(body);
        });
        await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
        return new MockFileServer(server);
    }

    /**
     * Absolute URL of a path on this server.
     * @param path URL path starting with a slash.
     */
    public url(path: string): string {
        const { port } = this.server.address() as AddressInfo;
        return `http://127.0.0.1:${port}${path}`;
    }

    /**
     * Stops the server and closes open connections.
     */
    public async stop(): Promise<void> {
        this.server.closeAllConnections();
        await new Promise<void>(resolve => this.server.close(() => resolve()));
    }
}
