/**
 * @typedef {Object} Options Represents the options for the syntax check
 * @property {string} directory The absolute path of the directory containing the PHP files to check the syntax of
 * @property {string[]} include Relative paths of files to be always included in the syntax check
 * @property {string[]} exclude Relative paths of files to exclude files from the syntax check
 * @property {bool} failOnWarnings Whether to fail the action if there are warnings in the syntax check
 * @property {bool} supportDuplicatedNames Whether to support duplicated names in the syntax check (e.g. classes with the same name in different files)
 * @property {bool} debug Whether to output debug messages
 */

/**
 * @typedef {Object} PHPVersion Represents the version of PHP installed on the system
 * @property {number} major The major version number (e.g. 8 for PHP 8.5.2)
 * @property {number} minor The minor version number (e.g. 5 for PHP 8.5.2)
 * @property {number} patch The patch version number (e.g. 2 for PHP 8.5.2)
 */

export {};
