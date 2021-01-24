'use strict'

import path from 'path'
import fs from 'fs'

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

	var bucket = new mongodb.GridFSBucket(db);


	console.log('mongodb connected');

	app.post('/', (req, res, next) => {

		var busboy = new Busboy({ headers: req.headers, immediate: true })

		/*
		busboy.on('field', (fieldname, val, valTruncated, keyTruncated) => {
			console.log(fieldname, val, valTruncated, keyTruncated)
		})
		*/

		busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
			console.log('File [' + fieldname + ']: filename: ' + filename + ', encoding: ' + encoding + ', mimetype: ' + mimetype);

			//var saveTo = path.join('.', 'tmp', filename)
			//var ostream = fs.createWriteStream(saveTo)
 			var ostream = bucket.openUploadStream(
				filename,
				{
					contentType: mimetype,
				}
			);
			var id = ostream.id;

			ostream.on('data', function(data) {
	        	console.log('File [' + fieldname + '] got ' + data.length + ' bytes');
	        })

			ostream.once('finish', () => {
				console.log('finish File [' + fieldname + '] Finished with id ' + id);
			})

			file.pipe(ostream)
		})

		busboy.once('finish', function() {
			console.log('Upload complete');
			res.writeHead(200, { 'Connection': 'close' });
			res.end("That's all folks!");
			//res.send('200 Ok')
		});

		return req.pipe(busboy)
	})

	app.use(express.static('public'))

	app.listen(port, () => {
		console.log(`Example app listening at http://localhost:${port}`)
	})

}).catch((err) => {

	console.error(err)

});
