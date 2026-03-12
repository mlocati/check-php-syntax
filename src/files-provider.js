import fs from 'node:fs';
import path from 'node:path';

/** @import { Options } from './types.js' */

/**
 * Provides files to check the syntax of, based on the options provided.
 */
export default class FilesProvider {
  /**
   * @type {Options}
   */
  #options;

  /**
   * The number of items that were skipped because they were excluded.
   * @type {number}
   */
  numItemsSkipped = 0;
  /**
   * The number of files that were provided.
   * @type {number}
   */
  numFilesProvided = 0;

  /**
   * Creates a new files provider.
   * @param {Options} options The options to use for providing files
   */
  constructor(options) {
    this.#options = options;
  }

  /**
   * Provides relative paths of the files to check the syntax of.
   * @returns {Generator<string, void, undefined>}
   */
  *getFiles() {
    this.numItemsSkipped = 0;
    this.numFilesProvided = 0;
    for (const file of this.#options.include) {
      yield file;
    }
    for (const file of this.#getFilesIn('')) {
      if (this.#options.include.includes(file)) {
        continue;
      }
      this.numFilesProvided++;
      yield file;
    }
  }

  /**
   * Recursively provides relative paths of the files to check the syntax of, starting from a given relative directory.
   * @param {string} relativeDirectory The directory to start from, relative to the directory specified in the options
   * @returns {Generator<string, void, undefined>}
   */
  *#getFilesIn(relativeDirectory) {
    const absoluteDirectory =
      relativeDirectory === '' ? this.#options.directory : path.join(this.#options.directory, relativeDirectory);
    const files = [];
    const subDirectories = [];
    fs.readdirSync(absoluteDirectory).forEach((item) => {
      if (item === '.' || item === '..') {
        return;
      }
      const relativeItem = relativeDirectory === '' ? item : path.join(relativeDirectory, item);
      if (this.#isRelativePathExcluded(relativeItem)) {
        this.numItemsSkipped++;
        return;
      }
      const absoluteItem = path.join(absoluteDirectory, item);
      if (fs.lstatSync(absoluteItem).isDirectory()) {
        subDirectories.push(relativeItem);
      } else if (item.match(/.\.php$/i)) {
        files.push(relativeItem);
      }
    });
    for (const file of files) {
      yield file;
    }
    for (const subDirectory of subDirectories) {
      for (const item of this.#getFilesIn(subDirectory)) {
        yield item;
      }
    }
  }

  /**
   * Checks if a given relative path should be skipped because it is excluded.
   * @param {string} relativePath
   * @returns {boolean}
   */
  #isRelativePathExcluded(relativePath) {
    if (this.#options.exclude.includes(relativePath)) {
      return true;
    }
    for (const exclude of this.#options.exclude) {
      if (relativePath.startsWith(`${exclude}${path.sep}`)) {
        return true;
      }
    }

    return false;
  }
}
