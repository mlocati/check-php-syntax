const core = require('@actions/core');
const path = require('node:path');
const fs = require('node:fs');

/**
 * @param {string} option
 *
 * @returns {string[]}
 */
function getRelativePathsOption(option) {
    const result = [];
    let str = core.getInput(option);
    if (str === '') {
        return result;
    }
    str.replace(/\r\n/g, '\n').replace(/\r/g, '\r').split(/\n/).forEach((line) => {
        line = line.replace(/^\s+|\s+$/g, '').replaceAll('/', path.sep);
        if (line !== '') {
            if (line[0] === path.sep) {
                throw new Error(`Invalid ${option} option: "${line}" is an absolute path`);
            }
            result.push(line.trimEnd(path.sep));
        }
    });
    return result;
}

/**
 * @param {string} option
 *
 * @returns bool
 */
function getBooleanOption(option) {
    const str = core.getInput(option).toLowerCase();
    if (['1', 'yes', 'y', 'true', 't', 'on'].includes(str)) {
        return true;
    }
    if (['0', 'no', 'n', 'false', 'f', 'off', ''].includes(str)) {
        return false;
    }
    throw new Error(`Invalid ${option} option: "${str}" is not a boolean-like value`);
}

/**
 * @returns {string}
 */
function getDirectory()
{
    let raw = core.getInput('directory');
    if (raw === '') {
        raw = process.cwd();
    }
    raw = raw.replaceAll('/', path.sep);
    const abs = path.isAbsolute(raw) ? path.normalize(raw) : path.resolve(raw);
    if (!fs.existsSync(abs)) {
        throw new Error(`Invalid directory option: "${raw}" does not exist`);
    }
    if (!fs.lstatSync(abs).isDirectory()) {
        throw new Error(`Invalid directory option: "${raw}" is not a directory`);
    }
    return abs;
}

/**
 * @returns {Options}
 */
function resolveArguments() {
    const result = {
        directory: getDirectory(),
        include: getRelativePathsOption('include'),
        exclude: getRelativePathsOption('exclude'),
        failOnWarnings: getBooleanOption('fail-on-warnings'),
        supportDuplicatedNames: getBooleanOption('support-duplicated-names'),
        debug: getBooleanOption('debug'),
    };
    if (result.debug) {
        process.stdout.write([
            'Input options:',
            `- directory: ${JSON.stringify(result.directory)}`,
            `- include: ${JSON.stringify(result.include)}`,
            `- exclude: ${JSON.stringify(result.exclude)}`,
            `- fail-on-warnings: ${JSON.stringify(result.failOnWarnings)}`,
            `- support-duplicated-names: ${JSON.stringify(result.supportDuplicatedNames)}`,
            ''
        ].join('\n'));
    }
    return result;
}

exports.resolveArguments = resolveArguments;
