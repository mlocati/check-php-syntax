const path = require('node:path');
const child_process = require('node:child_process');
const { FilesProvider} = require('./files-provider.js');
const { Shescape } = require('shescape');

const CHECKRESULT_OK = 1;
const CHECKRESULT_WARNINGS = 2;
const CHECKRESULT_ERRORS = 3;

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
 * @returns {string}
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
 * @param {bool} debug
 *
 * @returns {number}
 */
function getMaxCommandLineLength(debug)
{
    if (process.platform === 'win32') {
        /** @see https://learn.microsoft.com/en-us/troubleshoot/windows-client/shell-experience/command-line-string-limitation */
        const result = 8100;
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
        const calculated = argMax - envSize - numEnvVars * 4 - 2048;
        if (calculated < 1) {
            throw new Error(`ARG_MAX seems too low`);
        }
        if (debug) {
            process.stdout.write(`Calculated length of command lines: ${calculated} (${argMax} - ${envSize} - ${numEnvVars} * 4 - 2048)\n`);
        }
        const cap = 120000;
        const result = calculated < cap ? calculated : cap;
        if (debug) {
            process.stdout.write(`Maximum length of command lines: min(${calculated}, ${cap}) = ${result}\n`);
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
 * @param {PHPVersion} phpVersion
 * @param {bool} multipleFiles
 */
function* generateCommandLines(filesProvider, options, phpVersion, multipleFiles)
{
    const maxCommandLineLength = multipleFiles ? getMaxCommandLineLength(options.debug) : 0;
    const prefix = 'php -n -d display_errors=stderr -d error_reporting=-1' + (phpVersion.major >= 8 ? ' -d opcache.jit=disable' : '') + ' -l';
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
 * @param {PHPVersion} phpVersion
 * @param {bool} multipleFiles
 *
 * @returns {Promise<int>}
 */
async function checkWithL(options, phpVersion, multipleFiles)
{
    if (options.debug) {
        if (multipleFiles) {
            process.stdout.write('Using php -l to check the files (many at once)\n')
        } else {
            process.stdout.write('Using php -l to check the files (one by one)\n')
        }
    }
    const filesProvider = new FilesProvider(options);
    let result = CHECKRESULT_OK;
    for (const commandLine of generateCommandLines(filesProvider, options, phpVersion, multipleFiles)) {
        if (options.debug) {
            process.stdout.write(`Executing: ${commandLine}\n`)
        }
        result = Math.max(result, await checkWithLDo(options, commandLine));
    }
    process.stdout.write(`\nNumber of files processed: ${filesProvider.numFilesProvided}\nNumber of items skipped: ${filesProvider.numItemsSkipped}\n`)

    return result;
}

/**
 * @param {Options} options
 * @param {string} commandLine
 *
 * @returns {Promise<int>}
 */
function checkWithLDo(options, commandLine)
{
    const child = child_process.exec(
        commandLine,
        {
            cwd: options.directory,
            stdio: [
                // stdin
                'ignore',
                // stout
                'ignore',
                // stderr
                'pipe',
            ],
        }
    );
    let warningsDetected = false;
    child.stderr.on('data', (data) => {
        warningsDetected = true;
        process.stderr.write(data.toString());
    });

    return new Promise((resolve, _reject) => {
        child.on('close', (code) => {
            if (code !== 0) {
                resolve(CHECKRESULT_ERRORS);
            } else if(warningsDetected) {
                resolve(CHECKRESULT_WARNINGS);
            } else {
                resolve(CHECKRESULT_OK);
            }
        });
    });
}

/**
 * @param {Options} options
 * @param {PHPVersion} phpVersion
 *
 * @returns {Promise<int>}
 */
function checkWithOpCache(options, phpVersion)
{
    if (options.debug) {
        process.stdout.write('Using opcache to check the files\n')
    }
    const args = [
        '-d', 'display_errors=stderr',
        '-d', 'error_reporting=-1',
        '-d', 'opcache.enable_cli=1',
    ];
    if (phpVersion.major >= 8) {
        args.push('-d');
        args.push('opcache.jit=disable');
    }
    args.push(path.join(__dirname, 'checker.php'));
    options.include.forEach((f) => args.push(`+${f}`));
    options.exclude.forEach((f) => args.push(`-${f}`));

    const child = child_process.spawn(
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
                'pipe',
            ],
        }
    );
    let warningsDetected = false;
    child.stderr.on('data', (data) => {
        warningsDetected = true;
        process.stderr.write(data.toString());
    });

    return new Promise((resolve, _reject) => {
        child.on('close', (code) => {
            if (code !== 0) {
                resolve(CHECKRESULT_ERRORS);
            } else if(warningsDetected) {
                resolve(CHECKRESULT_WARNINGS);
            } else {
                resolve(CHECKRESULT_OK);
            }
        });
    });
}


/**
 * @param {Options} options
 */
async function check(options)
{
    const phpVersion = getPHPVersion();
    process.stdout.write(`Checking files with PHP ${phpVersion.major}.${phpVersion.minor}.${phpVersion.patch}\n`);
    let result;
    if (phpVersion.major > 8 || phpVersion.major === 8 && phpVersion.minor >= 3) {
        result = await checkWithL(options, phpVersion, true)
    } else if (options.supportDuplicatedNames) {
        result = await checkWithL(options, phpVersion, false)
    } else {
        result = await checkWithOpCache(options, phpVersion);
    }
    switch (result) {
        case CHECKRESULT_OK:
            process.stdout.write('No errors found.\n');
            process.exit(0);
            break;
        case CHECKRESULT_WARNINGS:
            process.stdout.write('Warnings found!\n');
            process.exit(options.failOnWarnings ? 1 : 0);
        case CHECKRESULT_ERRORS:
        default:
            process.stdout.write('Errors found!\n');
            process.exit(1);
    }
}

exports.check = check;
