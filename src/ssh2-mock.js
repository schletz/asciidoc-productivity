/**
 * Stub for the ssh2 package, substituted by an alias in webpack.config.js.
 * docker-modem (used by dockerode) imports ssh2 for Docker hosts reached over SSH. Bundling
 * the real package failed on machines with a different build environment, and the extension
 * only talks to the local Docker daemon, so the stub is never instantiated.
 */
module.exports = {
    Client: function() {}
};
