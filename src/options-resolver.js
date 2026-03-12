import { getInput } from '@actions/core';
import * as path from 'node:path';
import * as fs from 'node:fs';

/** @import { Options } from './types.js' */

const isWindows = process.platform === 'win32';

/**
 * Parse an input option that contains a list of relative paths, separated by newlines.
 * @param {string} optionName
 * @throws {Error} If any of the paths is absolute
 * @returns {string[]}
 */
function getRelativePathsOption(optionName) {
    let str = getInput(optionName);
    if (str === '') {
        return [];
    }
    return str
        .replace(/\r/g, '\n')
        .split(/\n/)
        .map(line => line.trim())
        .filter(line => line !== '')
        .map(line => {
            const normalizedLine = line.replaceAll('/', path.sep);
            if (normalizedLine[0] === path.sep || (isWindows && normalizedLine.match(/^[a-zA-Z]:\\/))) {
                throw new Error(`Invalid ${optionName} option: "${line}" is an absolute path`);
            }
            return normalizedLine.trimEnd(path.sep);
        })
    ;
}

/**
 * Parse a boolean input option.
 * @param {string} optionName
 * @throws {Error} If the input value is not a boolean-like string
 * @returns {boolean}
 */
function getBooleanOption(optionName) {
    const raw = getInput(optionName).trim();
    const normalized = raw.toLowerCase();
    if (['1', 'yes', 'y', 'true', 't', 'on'].includes(normalized)) {
        return true;
    }
    if (['0', 'no', 'n', 'false', 'f', 'off', ''].includes(normalized)) {
        return false;
    }
    throw new Error(`Invalid ${optionName} option: "${raw}" is not a boolean-like value`);
}

/**
 * Parse the directory input option, and validate that it exists and is a directory.
 * @throws {Error} If the directory does not exist or is not a directory
 * @returns {string} The absolute path of the directory to check the syntax of
 */
function getDirectory() {
    const raw = getInput('directory') || process.cwd();
    const normalized = raw.replaceAll('/', path.sep);
    const abs = path.isAbsolute(normalized) ? path.normalize(normalized) : path.resolve(normalized);
    if (!fs.existsSync(abs)) {
        throw new Error(`Invalid directory option: "${raw}" does not exist`);
    }
    if (!fs.lstatSync(abs).isDirectory()) {
        throw new Error(`Invalid directory option: "${raw}" is not a directory`);
    }
    return abs;
}

/**
 * Parse the input options.
 * @throws {Error} If any of the options is invalid
 * @returns {Options}
 */
export default function resolveArguments() {
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
        ].join('\n') + '\n');
    }
    return result;
}
