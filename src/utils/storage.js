// package dependencies
const { createWriteStream, unlink } = require('fs');
const mkdirp = require('mkdirp');
const { v4: uuid4 } = require('uuid');
var path = require('path');
// file dependencies
const config = require('../config');
const logger = require('./winston');

// Ensure upload directories exists
mkdirp(config.STORAGE_PATH_PHOTOS);
mkdirp(config.STORAGE_PATH_DOCS);

/**
 * Stores a photo. The file is stored in the filesystem and
 * returns its relative path
 * @param {GraphQLUpload} photo GraphQL photo upload
 * @param {string} belonging photo belongs to
 * @returns {string} Returns its relative path
 */
const storePhoto = async (photo, belonging) => {
    try {
        const { createReadStream, filename, mimetype } = await photo;
        switch (mimetype) {
            case "image/jpeg":
            case "image/png":
            case "image/svg+xml":
                break;
            default:
                throw new Error('Invalid file not image')
        }
        belonging = belonging || "";
        const stream = createReadStream();
        const id = uuid4();
        const ext = path.extname(filename);
        const relativePath = `/storage/files/${belonging}-${id}${ext}`;
        const absolutePath = `${config.STORAGE_PATH_PHOTOS}/${belonging}-${id}${ext}`
        // Store the file in the filesystem.
        await new Promise((resolve, reject) => {
            // Create a stream to which the upload will be written.
            const writeStream = createWriteStream(absolutePath);

            // When the upload is fully written, resolve the promise.
            writeStream.on('finish', resolve);

            // If there's an error writing the file, remove the partially written file
            // and reject the promise.
            writeStream.on('error', (error) => {
                unlink(path, () => {
                    reject(error);
                });
            });

            // In Node.js <= v13, errors are not automatically propagated between piped
            // streams. If there is an error receiving the upload, destroy the write
            // stream with the corresponding error.
            stream.on('error', (error) => writeStream.destroy(error));

            // Pipe the upload into the write stream.
            stream.pipe(writeStream);
        });

        return relativePath
    } catch (error) {
        logger.error(error)
        throw error
    }
}

/**
 * Stores a file. The file is stored in the filesystem and
 * returns its relative path
 * @param {GraphQLUpload} file GraphQL file upload
 * @param {string} belonging file belongs to
 * @returns {string} Returns its relative path
 */
const storeFile = async (file, belonging) => {
    try {
        const { createReadStream, filename, mimetype } = await file;
        switch (mimetype) {
            case "application/pdf":
            case "application/msword":
            case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            case "application/vnd.ms-excel":
            case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
                break;
            default:
                throw new Error('Invalid file not document')
        }
        belonging = belonging || "";
        const stream = createReadStream();
        const id = uuid4();
        const ext = path.extname(filename);
        const relativePath = `/storage/files/${belonging}-${id}${ext}`;
        const absolutePath = `${config.STORAGE_PATH_DOCS}/${belonging}-${id}${ext}`
        // Store the file in the filesystem.
        await new Promise((resolve, reject) => {
            // Create a stream to which the upload will be written.
            const writeStream = createWriteStream(absolutePath);

            // When the upload is fully written, resolve the promise.
            writeStream.on('finish', resolve);

            // If there's an error writing the file, remove the partially written file
            // and reject the promise.
            writeStream.on('error', (error) => {
                unlink(path, () => {
                    reject(error);
                });
            });

            // In Node.js <= v13, errors are not automatically propagated between piped
            // streams. If there is an error receiving the upload, destroy the write
            // stream with the corresponding error.
            stream.on('error', (error) => writeStream.destroy(error));

            // Pipe the upload into the write stream.
            stream.pipe(writeStream);
        });

        return relativePath
    } catch (error) {
        logger.error(error)
        throw error
    }
}

/**
 * Deletes a file in filesystem
 * @param {string} filename Relative path of file
 * @param {string} type File or image
 * @returns {boolean} Returns either a success or an error
 */
const removeFile = async (filename, type) => {
    try {
        switch (type) {
            case "photo":
                filename = filename.replace("/storage/files/", `${config.STORAGE_PATH_PHOTOS}/`);
                break;
            case "file":
                filename = filename.replace("/storage/files/", `${config.STORAGE_PATH_DOCS}`);
                break;
            default:
                throw new Error('Cant remove file undefined file type')
        }
        unlink(filename, (err) => {
            throw err
        })
        return true
    } catch (error) {
        logger.error(error);
        throw error
    }
}

module.exports = {
    removeFile
}