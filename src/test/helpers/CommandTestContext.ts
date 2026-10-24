import * as assert from 'assert';
import * as sinon from 'sinon';
import TestWorkspace from './TestWorkspace';

/**
 * Registers the hooks every E2E suite needs: extension activation before the suite, a fresh
 * sinon sandbox per test and, after each test, restored stubs and closed editors.
 * Call {@link register} at the top of a suite body.
 */
export default class CommandTestContext {
    private currentSandbox: sinon.SinonSandbox | undefined;

    /** Sandbox of the running test; stubs created on it are removed after the test. */
    public get sandbox(): sinon.SinonSandbox {
        assert.ok(this.currentSandbox, 'The sandbox is only available inside a test.');
        return this.currentSandbox;
    }

    /**
     * Registers the hooks in the enclosing Mocha suite.
     */
    public static register(): CommandTestContext {
        const context = new CommandTestContext();

        suiteSetup(async () => {
            await TestWorkspace.activateExtension();
        });

        setup(() => {
            context.currentSandbox = sinon.createSandbox();
        });

        teardown(async () => {
            context.currentSandbox?.restore();
            context.currentSandbox = undefined;
            await TestWorkspace.closeAllEditors();
        });

        return context;
    }
}
