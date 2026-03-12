import { setFailed } from '@actions/core';
import resolveArguments from './options-resolver.js';
import check from './checker.js';

/**
 * @returns {Promise<void>}
 */
async function run()
{
    try {
        const options = resolveArguments();
        await check(options);
    } catch (error) {
        setFailed(error.message);
    }
}

run();
