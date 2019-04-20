'use strict'

const Promise = require('bluebird')
const csvtojson = require('csvtojson')
const fetch = require('node-fetch')
const moment = require('moment')
const sqlite3 = require('sqlite3').verbose()

const config = require('./config.json')

const columnsMap = {
	date: 'Date',
	id: 'Ref ID',
	type: 'Type',
	description: 'Description',
	agency: 'Agency',
	freelancer: 'Freelancer',
	team: 'Team',
	account: 'Account Name',
	po: 'PO',
	amount: 'Amount',
	amountLocal: 'Amount in local currency',
	currency: 'Currency',
	balance: 'Balance'
}

const checkRow = row => {
	if (!row.balance && row.balance !== 0) {
		console.log('\tRow does not contain balance - pending. Skipping...', row)
		return false
	}
	// if (in_array($type, ['Withdrawal Fee', 'Withdrawal'])) {
	// 	return false
	// }
	return true
}

const parseCsv = (filename, columnsMap) => {
	return new Promise((resolve, reject) => {
		const dbFields = Object.keys(columnsMap)
		const data = []

		csvtojson()
			.fromFile(filename)
			.on('json', json => {
				const row = {}
				dbFields.forEach(x => {
					let value = json[columnsMap[x]]
					switch (x) {
						case 'date':
							// Jul 19, 2017
							value = moment(value, 'MMM DD, YYYY').format('YYYY-MM-DD hh:mm:ss')
							break;
						case 'id':
							value = parseInt(value, 10)
							break;
						case 'type':
							value = value.toLowerCase()
							break;
						case 'amount':
							value = parseFloat(value)
							break;
						case 'amountLocal':
							if (value) value = parseFloat(value)
							break;
						case 'balance':
							if (value) value = parseFloat(value)
							break;
						default:

					}
					row[x] = value
				})
				if (checkRow(row)) data.push(row)
			})
			.on('done', err => {
				console.log('Parsing is done.')
				if (err) return reject(err)
				return resolve(data)
			})
	})
}

const insertStatement = row => {
	const dbFields = Object.keys(columnsMap)
	return new Promise((resolve, reject) => {
		db.all("SELECT id FROM statements WHERE id = " + row.id, (err, res) => {
			if (err) return reject(err)

			return resolve(res)
		})
	})
		.then(rows => {
			if (rows.length) {
				console.warn(`\tStatement ${row.id} already presents in database. Skipping...`)
				return true
			}

			const sql = "INSERT into statements(" + dbFields.join(',') + ") VALUES (" + dbFields.map(x => "'" + row[x] + "'").join(',') + ")"
			// console.log('SQL:', sql)
			console.warn(`\tStatement ${row.id} for $${row.amount}\tadded to database.`)
			return new Promise((resolve, reject) => {
				db.run(sql, err => {
					if (err) return reject(err)

					return resolve(true)
				})
			})
		})
		// .catch(err => console.log(err.message, err))
}

const populateRate = (date, currencyCode) => {
	currencyCode = currencyCode || 840
	// http://www.nbrb.by/API/ExRates/Rates/840?ParamMode=1&onDate=2016-07-05
	const uri = `http://www.nbrb.by/API/ExRates/Rates/${currencyCode}?ParamMode=1&onDate=${date}`
	console.log('uri', uri)
	return new Promise(resolve => setTimeout(() => resolve(true), 1000))
		.then(() => fetch(uri))
	    .then(function(res) {
			if (res.status === 200) return res.json()

			throw new Error('Not 200 response from API nbrb: ' + uri)
	    })
		.then(function(json) {
			console.log(json)
			return json.Cur_OfficialRate
	    })
		.catch(err => console.log(err.message, err))
}

const populateRates = currencyCode => {
	// @TODO: ay p2 - move to config
	// @TODO: ay p3 - use ISO currency code
	currencyCode = currencyCode || 145

	return new Promise((resolve, reject) => {
		db.get("SELECT GROUP_CONCAT(DISTINCT DATE(date)) as dates FROM statements WHERE rate IS NULL", (err, res) => {
			if (err) return reject(err)
			return resolve(res.dates ? res.dates.split(',').sort() : [])
		})
	})
		.then(emptyDates => {
			if (!emptyDates.length) return true

			const startDate = emptyDates[0]
			const endDate = emptyDates[emptyDates.length - 1]
			const uri = `http://www.nbrb.by/API/ExRates/Rates/Dynamics/${currencyCode}?startDate=${startDate}&endDate=${endDate}`
			console.log('\tNBRB API call: ', uri)
			return fetch(uri)
			    .then(res => {
					if (res.status === 200) return res.json()

					throw new Error('Not 200 response from API nbrb: ' + uri)
			    })
				.then(json => {
					const rates = json.reduce((all, rate) => {
						// 2017-05-31T00:00:00
						const date = moment(rate['Date'], 'YYYY-MM-DDThh:mm:ss').format('YYYY-MM-DD')
						all[date] = rate['Cur_OfficialRate']
						return all
					}, {})

					return rates
			    })
				.then(rates => {
					return Promise.map(emptyDates, date => {
						const stmt = db.prepare("UPDATE statements SET rate = $rate WHERE DATE(date) = $date")
						return new Promise((resolve, reject) => {
							return db.run('UPDATE statements SET rate = ? WHERE DATE(date) = ?', [rates[date], date], err => {
								if (err) return reject(err)
								return resolve(true)
							})
						})
					})
				})
				.catch(err => console.log(err.message, err))
		})
		.catch(err => console.log(err.message, err))
}

const db = new sqlite3.Database(config.dbFilePath)
const filename = process.argv[2]

parseCsv(filename, columnsMap)
	// insert data to database
	.then(rows => Promise.all(rows.map(row => insertStatement(row))))
	// populate missed currency rates
	.then(() => populateRates())
	.catch(err => {
		console.log(err.message, err)
	})
