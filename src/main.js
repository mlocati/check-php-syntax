const core = require('@actions/core');
const optionsResolver = require('./options-resolver.js');
const checker = require('./checker.js');

/**
 * @returns {Promise}
 */
function run()
{
    try {
        const options = optionsResolver.resolveArguments();
        return checker.check(options);
    } catch (error) {
        core.setFailed(error.message);
    }
}

return run();
