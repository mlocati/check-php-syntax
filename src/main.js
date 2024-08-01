const core = require('@actions/core');
const optionsResolver = require('./options-resolver.js');
const checker = require('./checker.js');

async function run() {
    try {
        const options = optionsResolver.resolveArguments();
        await checker.check(options.directory, options.include, options.exclude);
    } catch (error) {
        core.setFailed(error.message);
    }
}

run();
