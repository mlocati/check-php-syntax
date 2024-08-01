const path = require('node:path');
const exec = require('@actions/exec');

/**
 * @param {string} directory 
 * @param {string[]} include 
 * @param {string[]} exclude 
 */
async function check(directory, include, exclude)
{
    const args = [
        '-d', 'opcache.enable_cli=1',
        path.join(__dirname, 'checker.php'),
    ];
    include.forEach((f) => args.push(`+${f}`));
    exclude.forEach((f) => args.push(`-${f}`));
    await exec.exec(
        'php',
        args,
        {
            cwd: directory,
            ignoreReturnCode: false,
        }
    );
}

exports.check = check;
