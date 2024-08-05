const fs = require('fs');
const path = require('node:path');

class FilesProvider
{
    #options;
    numItemsSkipped = 0;
    numFilesProvided = 0;

    /**
     * @param {Options} options 
     */
    constructor(options)
    {
        this.#options = options;
    }

    *getFiles()
    {
        this.numItemsSkipped = 0;
        this.numFilesProvided = 0;
        for (const file of this.#options.include) {
            yield file;
        }
        for (const file of this.#getFilesIn('')) {
            this.numFilesProvided++;
            yield file;
        }
    }

    /**
     * @param {string} relativeDirectory 
     */
    *#getFilesIn(relativeDirectory)
    {
        const absoluteDirectory = relativeDirectory === '' ? this.#options.directory : path.join(this.#options.directory, relativeDirectory);
        const files = [];
        const subDirectories = [];
        fs.readdirSync(absoluteDirectory).forEach((item) => {
            if (item === '.' || item === '..') {
                return;
            }
            const relativeItem = relativeDirectory === '' ? item : path.join(relativeDirectory, item);
            if (this.#isSkipItem(relativeItem)) {
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
    };

    /**
     * @param {string} relativePath 
     *
     * @returns {bool}
     */
    #isSkipItem(relativePath)
    {
        if (this.#options.exclude.includes(relativePath)) {
            return true;
        }
        for (const exclude in this.#options.exclude) {
            if (relativePath.startsWith(`${exclude}${path.sep}`)) {
                return true;
            }
        }

        return false;
    }
}

exports.FilesProvider = FilesProvider;
