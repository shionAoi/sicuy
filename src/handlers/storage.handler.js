var express = require('express');
var router = express.Router();
const { unlinkSync } = require('fs');
const { v4: uuid4 } = require('uuid');
const mkdirp = require('mkdirp');
var path = require('path');
// file dependencies
const config = require('../config');
const logger = require('../utils/winston');
const { validRoute } = require('./auth.handler');

// Ensure upload directories exists
mkdirp(config.STORAGE_PATH_PHOTOS);
mkdirp(config.STORAGE_PATH_DOCS);

router.post('/upload-photo', validRoute, async (req, res) => {
    try {
        let sampleFile;
        let belonging;

        if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(400).send({
                error: 'No files were uploaded.'
            });
        }

        if (!req.body || !req.body.belonging) {
            return res.status(400).send({
                error: 'No belonging were specified.'
            })
        }

        // The name of the input field
        sampleFile = req.files.file;
        const ext = path.extname(sampleFile.name);
        // Filter mimetype
        let mimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml'];
        let imgList = ['.png', '.jpg', '.jpeg', '.gif'];
        // Checking the file type
        if (!imgList.includes(ext) || !mimes.includes(sampleFile.mimetype)) {
            unlinkSync(sampleFile.tempFilePath);
            return res.status(422).send({
                error: 'Invalid not image'
            })
        }
        // The belong field of file i.e: idCuy
        belonging = req.body.belonging;
        const id = uuid4();
        const relativePath = `/storage/photos/${belonging}-${id}${ext}`;
        const absolutePath = `${config.STORAGE_PATH_PHOTOS}/${belonging}-${id}${ext}`

        // Place file in absolute path
        sampleFile.mv(absolutePath, function (err) {
            if (err)
                return res.status(500).send({
                    error: err
                });

            res.send({
                path: relativePath
            });
        });
    } catch (error) {
        logger.error(error);
        return res.status(401).send({
            error: error.message
        })
    }
})

router.get('/photos/:photo', (req, res) => {
    res.sendFile(`${config.STORAGE_PATH_PHOTOS}/${req.params.photo}`)
})

router.post('/upload-file', validRoute, async (req, res) => {
    try {
        let sampleFile;
        let belonging;

        if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(400).send({
                error: 'No files were uploaded.'
            });
        }

        if (!req.body || !req.body.belonging) {
            return res.status(400).send({
                error: 'No belonging were specified.'
            })
        }

        // The name of the input field
        sampleFile = req.files.file;
        const ext = path.extname(sampleFile.name);
        // Filter mimetype
        let mimes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        // Checking the file type
        if (!mimes.includes(sampleFile.mimetype)) {
            unlinkSync(sampleFile.tempFilePath);
            return res.status(422).send('Invalid not a file')
        }
        // The belong field of file i.e: idCuy
        belonging = req.body.belonging;
        const id = uuid4();
        const relativePath = `/storage/files/${belonging}-${id}${ext}`;
        const absolutePath = `${config.STORAGE_PATH_DOCS}/${belonging}-${id}${ext}`

        // Place file in absolute path
        sampleFile.mv(absolutePath, function (err) {
            if (err)
                return res.status(500).send({
                    error: err
                });

            res.send({
                path: relativePath
            });
        });
    } catch (error) {
        logger.error(error.message);
        return res.status(401).send({
            err: error.message
        })
    }
})

router.get('/files/:file', validRoute, (req, res) => {
    res.sendFile(`${config.STORAGE_PATH_DOCS}/${req.params.file}`)
})

module.exports = router