const core = require('@actions/core');
const path = require('node:path');
const fs = require('node:fs');

/**
 * @param {string} option
 *
 * @returns {string[]}
 */
function stringToRelativePaths(option) {
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
 * @typedef {Object} Result
 * @property {string[]} directory
 * @property {string[]} include
 * @property {string[]} exclude
 */

/**
 * @returns {Result}
 */
function resolveArguments() {
    return {
        directory: getDirectory(),
        include: stringToRelativePaths('include'),
        exclude: stringToRelativePaths('exclude'),
    };
}

exports.resolveArguments = resolveArguments;
