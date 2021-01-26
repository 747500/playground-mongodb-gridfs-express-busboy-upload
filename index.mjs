'use strict'

import path from 'path'
import fs from 'fs'
import querystring from 'querystring'

import express from 'express'
import morgan from 'morgan'
import Busboy from 'busboy'

import mongodb from 'mongodb'

const app = express()
const port = 4000
app.use(morgan('dev'))
app.use(express.json())

const uri = "mongodb://127.0.0.1:27017?retryWrites=true&writeConcern=majority"

mongodb.MongoClient.connect(
	uri,
	{
		useUnifiedTopology: true
	}
).then((connection) => {
	return connection.db('crm')
}).then((db) => {

	var bucket = new mongodb.GridFSBucket(db)

	console.log('mongodb connected')

	app.post('/upload', (req, res, next) => {

		var busboy = new Busboy({ headers: req.headers, immediate: true })

		/*
		busboy.on('field', (fieldname, val, valTruncated, keyTruncated) => {
			console.log(fieldname, val, valTruncated, keyTruncated)
		})
		*/

		busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {

 			var ostream = bucket.openUploadStream(
				filename,
				{
					contentType: mimetype,
				}
			);

			var id = ostream.id

			console.log(`file: "${filename}" id ${id} encoding: ${encoding}, mimetype: ${mimetype}`)

			ostream.on('data', data => {
	        	console.log(`data: "${filename}" id ${id} got ${data.length} bytes`)
	        })

			ostream.once('finish', () => {
				console.log(`finish: "${filename}" id ${id}`)
			})

			file.pipe(ostream)
		})

		busboy.once('finish', () => {
			console.log('Upload complete')
			res.send('Ok')
		});

		req.pipe(busboy)
	})

	app.post('/upload/:filename', (req, res, next) => {

		const filename = req.params.filename
		const mimetype = req.headers['content-type']

		var stream = bucket.openUploadStream(
			filename,
			{
				contentType: mimetype,
				metadata: {
					lastModified: new Date(req.headers['last-modified'])
				}
			}
		);

		stream.once('finish', () => {
			res.send({ file_id: stream.id })
		})

		stream.once('error', next)

		req.pipe(stream)

	})

	app.get('/f/:id', (req, res, next) => {

		const oid = mongodb.ObjectId(req.params.id)

		db.collection('fs.files').findOne({ _id: oid }).then(fileinfo => {

			if (null === fileinfo) { // 404 Not Found
				next()
				return;
			}

			const hasLastModified =
					'object' === typeof fileinfo.metadata &&
					fileinfo.metadata.lastModified instanceof Date

			const lastModified =
					hasLastModified ?
					fileinfo.metadata.lastModified :
					fileinfo.uploadDate

			const contentDisposition =
					'inline;' + // or 'attachment' for downloads
					'filename=' +
					querystring.escape(fileinfo.filename)

			res.set({
				'Content-Length': fileinfo.length,
				'Content-Type': fileinfo.contentType,
				'Last-Modified': lastModified.toISOString(),
				'Content-Disposition': contentDisposition
			})

			const stream = bucket.openDownloadStream(oid)

			stream.once('error', next)

			stream.pipe(res)

		}).catch(err => {
			next(err)
		})
	})

	app.use(express.static('public'))

	app.listen(port, () => {
		console.log(`Example app listening at http://localhost:${port}`)
	})

}).catch((err) => {

	console.error(err)

})
