/**
 * Mock implementation of the ssh2 module for Webpack bundling.
 * This placeholder prevents build errors by providing a stub for the native ssh2 package,
 * which is not utilized in this project as only the local Docker daemon is accessed.
 */
module.exports = {
    /**
     * Stub constructor for the SSH client.
     * Intentionally left empty as this mock is never instantiated at runtime.
     */
    Client: function() {}
};