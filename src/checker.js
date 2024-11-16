const path = require('node:path');
const child_process = require('node:child_process');
const { FilesProvider} = require('./files-provider.js');
const { Shescape } = require('shescape');

/**
 * @typedef {object} PHPVersion
 * @property {number} major
 * @property {number} minor
 * @property {number} patch
 */

const shescape = new Shescape();

/**
 * @param {string} arg 
 *
 * @returns string
 */
function escapeArgument(arg)
{
    const check = process.platform === 'win32' ? arg.replaceAll(path.sep, '/') : arg;
    if (!/[^a-zA-Z0-9_\-/.]/.test(check)) {
        return arg;
    }

    return shescape.escape(arg);
}

/**
 * @returns {PHPVersion}
 */
function getPHPVersion()
{
    const stdout = child_process.execSync('php -n -r "echo PHP_VERSION_ID;"',
        {
            encoding: 'utf-8',
            stdio: [
                // stdin
                'ignore',
                // stout
                'pipe',
                // stderr
                'ignore',
            ],
        }
    );
    const match = /^(?<major>[1-9][0-9]*)(?<minor>[0-9][0-9])(?<patch>[0-9][0-9])$/.exec(stdout.trim());
    if (!match) {
        throw new Error(`Failed to parse version ${stdout}` + (stderr ? `\n${stderr}` : ''));
    }
    return {
        major: parseInt(match.groups.major, 10),
        minor: parseInt(match.groups.minor, 10),
        patch: parseInt(match.groups.patch, 10),
    }
}

/**
 * 
 * @param {bool} debug 
 *
 * @returns {number}
 */
function getMaxCommandLineLength(debug)
{
    if (process.platform === 'win32') {
        /** @see https://learn.microsoft.com/en-us/troubleshoot/windows-client/shell-experience/command-line-string-limitation */
        const result = 8191;
        if (debug) {
            process.stdout.write(`Maximum length of command lines: ${result} (fixed for Windows)\n`);
        }
        return result;
    }
    try {
        const execOptions =             {
            encoding: 'utf-8',
            stdio: [
                // stdin
                'ignore',
                // stout
                'pipe',
                // stderr
                'ignore',
            ],
        };
        /** @see https://www.in-ulm.de/~mascheck/various/argmax/ */
        let raw;
        raw = child_process.execSync('getconf ARG_MAX', execOptions).trim();
        const argMax = parseInt(raw, 10);
        if (!argMax || argMax < 1) {
            throw new Error(`Failed to parse the output of getconf ARG_MAX (${raw})`);
        }
        raw = child_process.execSync('env', execOptions).trim();
        const envSize = raw.length;
        const numEnvVars = raw.split('\n').length;
        const result = argMax - envSize - numEnvVars * 4 - 2048;
        if (result < 1) {
            throw new Error(`ARG_MAX seems too low`);
        }
        if (debug) {
            process.stdout.write(`Maximum length of command lines: ${result} (${argMax} - ${envSize} - ${numEnvVars} * 4 - 2048)\n`);
        }
        return result;
    } catch (e) {
        if (debug) {
            process.stderr.write(`Failed to detect the maximum lenght of command lines: ${e.message}\n`)
        }
    }
    /** @see https://www.gnu.org/software/automake/manual/html_node/Length-Limitations.html */
    if (debug) {
        process.stdout.write(`Maximum length of command lines: 4096 (minimum as per POSIX specs)`);
    }
    return 4096;
}

/**
 * @param {FilesProvider} filesProvider
 * @param {Options} options
 * @param {bool} multipleFiles
 */
function* generateCommandLines(filesProvider, options, multipleFiles)
{
    const maxCommandLineLength = multipleFiles ? getMaxCommandLineLength(options.debug) : 0;
    const prefix = 'php -n -d display_errors=stderr -l';
    let commandLine = '';
    for (const file of filesProvider.getFiles()) {
        const chunk = ' ' + escapeArgument(file);
        if (commandLine === '') {
            commandLine = prefix + chunk;
        } else {
            const newCommandLine = commandLine + chunk;
            if (newCommandLine.length < maxCommandLineLength) {
                commandLine = newCommandLine;
            } else {
                yield commandLine;
                commandLine = prefix + chunk;
            }
        }
    }
    if (commandLine !== '') {
        yield commandLine;
    }
}

/**
 * @param {Options} options
 * @param {bool} multipleFiles
 *
 * @returns {bool}
 */
function checkWithL(options, multipleFiles)
{
    if (options.debug) {
        if (multipleFiles) {
            process.stdout.write('Using php -l to check the files (many at once)\n')
        } else {
            process.stdout.write('Using php -l to check the files (one by one)\n')
        }
    }
    const filesProvider = new FilesProvider(options);
    let success = true;
    for (const commandLine of generateCommandLines(filesProvider, options, multipleFiles)) {
        if (options.debug) {
            process.stdout.write(`Executing: ${commandLine}\n`)
        }
        try {
            child_process.execSync(
                commandLine,
                {
                    cwd: options.directory,
                    stdio: [
                        // stdin
                        'ignore',
                        // stout
                        'ignore',
                        // stderr
                        'inherit',
                    ],
                }
            );
        } catch {
            success = false;
        }
    }
    process.stdout.write(`\nNumber of files processed: ${filesProvider.numFilesProvided}\nNumber of items skipped: ${filesProvider.numItemsSkipped}\n`)
    process.stdout.write(success ? 'No errors found.\n' : 'ERRORS FOUND!\n');

    return success;
}

/**
 * @param {Options} options
 *
 * @returns {bool}
 */
function checkWithOpCache(options)
{
    if (options.debug) {
        process.stdout.write('Using opcache to check the files\n')
    }
    const args = [
        '-d', 'opcache.enable_cli=1',
        path.join(__dirname, 'checker.php'),
    ];
    options.include.forEach((f) => args.push(`+${f}`));
    options.exclude.forEach((f) => args.push(`-${f}`));
    
    const procInfo = child_process.spawnSync(
        'php',
        args,
        {
            cwd: options.directory,
            stdio: [
                // stdin
                'ignore',
                // stout
                'inherit',
                // stderr
                'inherit',
            ],
        }
    );

    return procInfo.status === 0;
}


/**
 * @param {Options} options
 */
function check(options)
{
    const PHP_VERSION = getPHPVersion();
    process.stdout.write(`Checking files with PHP ${PHP_VERSION.major}.${PHP_VERSION.minor}.${PHP_VERSION.patch}\n`);
    let result;
    if (PHP_VERSION.major > 9 || PHP_VERSION.major === 8 && PHP_VERSION.minor >= 3) {
        result = checkWithL(options, true)
    } else if (options.supportDuplicatedNames) {
        result = checkWithL(options, false)
    } else {
        result = checkWithOpCache(options);
    }
    if (result !== true) {
        process.exit(1);
    }
}

exports.check = check;
