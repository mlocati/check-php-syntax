const core = require('@actions/core');
const optionsResolver = require('./options-resolver.js');
const checker = require('./checker.js');

function run() {
    try {
        const options = optionsResolver.resolveArguments();
        checker.check(options);
    } catch (error) {
        core.setFailed(error.message);
    }
}

run();
