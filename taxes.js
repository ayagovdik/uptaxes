'use strict'

const Promise = require('bluebird')
const moment = require('moment')
const numeral = require('numeral')
const roundTo = require('round-to')
const sqlite3 = require('sqlite3').verbose()
const table = require('text-table')

const config = require('./config.json')

const db = new sqlite3.Database(config.dbFilePath)

console.log('node taxes.js fi m 2019 10')
console.log('node taxes.js vat q 2019 1')
console.log('node taxes.js vat p 2019')

const type = process.argv[2]
const periodType = process.argv[3]
console.log('type, periodType', {type, periodType})

const roundAmount = (amount) => roundTo(amount, 2)

let date
let startDate
let endDate

switch (periodType) {
	case 'y':
		date = moment([process.argv[4]])
		startDate = date.startOf('year').format('YYYY-MM-DD 00:00:00')
		endDate = date.endOf('year').format('YYYY-MM-DD 23:59:59')
		break
	case 'q':
		date = moment(`${process.argv[4]}-${process.argv[5]}`, 'YYYY-Q')
		startDate = date.startOf('quarter').format('YYYY-MM-DD 00:00:00')
		endDate = date.endOf('quarter').format('YYYY-MM-DD 23:59:59')
		break
	case 'm':
		date = moment(`${process.argv[4]}-${process.argv[5]}`, 'YYYY-M')//moment([process.argv[4], process.argv[5]])
		startDate = date.startOf('month').format('YYYY-MM-DD 00:00:00')
		endDate = date.endOf('month').format('YYYY-MM-DD 23:59:59')
		break
	case 'p':
		// date = moment(`${process.argv[4]}-${process.argv[5]}`, 'YYYY-Q')
		startDate = '2019-01-01 00:00:00'
		endDate = '2019-06-30 23:59:59'
		break
	default:
		throw new Error('Wrong period Type')
}

const taxes = {
	vat: () => {
		return new Promise((resolve, reject) => {
			console.log(`\n\n---=== VAT for Upwork period from ${startDate} till ${endDate} ===---\n`)

			const sql = 'SELECT id, amount, rate, date FROM statements WHERE skip = 0 AND type = "service fee" AND date BETWEEN ? AND ? ORDER BY id'
			return db.all(sql, [startDate, endDate], (err, res) => {
				if (err) return reject(err)

				return resolve(res)
			})
		})
			.then(rows => {
				const data = [
					[
						'Transaction',
						'Date',
						'Amount',
						'Rate NB',
						'Amount BYN',
						'VAT BYN'
					]
				]
				const total = rows.reduce((total, row) => {
					const sum = roundAmount(row.amount * row.rate)
					const vat = roundAmount(sum * config.rates.vat / 100)
					const date = moment(row.date, 'YYYY-MM-DD hh:mm:ss').format('YYYY-MM-DD')
					data.push([
						row.id,
						date,
						numeral(row.amount).format('$0,0.00'),
						numeral(row.rate).format('0,0.0000'),
						// numeral(sum).format('0000[.]00'),
						numeral(sum).format('0,0.00'),
						numeral(vat).format('0,0.00')
					])
					total.amount += sum
					total.vat += vat
					return total
				}, { amount: 0, fi: 0, vat: 0 })
				var t = table(data, { align: [ 'l', 'c', 'r', 'r', 'r', 'r'] });
				console.log(t);
				console.log(`Total Upwork income: ${numeral(total.amount).format('0,0.00')} p`)
				console.log(`\tTotal VAT: ${numeral(total.vat).format('0,0.00')} p`)
				return rows
			})
	},
	fi: () => {
		return new Promise((resolve, reject) => {
			console.log(`\n\n---=== Foreight Income Taxes for Upwork period from ${startDate} till ${endDate} ===---\n`)

			const sql = 'SELECT id, amount, rate, date FROM statements WHERE skip = 0 AND type = "service fee" AND date BETWEEN ? AND ? ORDER BY id'
			return db.all(sql, [startDate, endDate], (err, res) => {
				if (err) return reject(err)

				return resolve(res)
			})
		})
			.then(rows => {
				const data = [
					[
						'Transaction',
						'Date',
						'Amount',
						'Rate NB',
						'Amount BYN',
						'FI BYN'
					]
				]
				const total = rows.reduce((total, row) => {
					const sum = roundAmount(row.amount * row.rate)
					const fi = roundAmount(sum * config.rates.income / 100)
					const date = moment(row.date, 'YYYY-MM-DD hh:mm:ss').format('YYYY-MM-DD')
					data.push([
						row.id,
						date,
						numeral(row.amount).format('$0,0.00'),
						numeral(row.rate).format('0,0.0000'),
						numeral(sum).format('0,0.00'),
						numeral(fi).format('0,0.00')
					])
					total.amount += sum
					total.fi += fi
					return total
				}, { amount: 0, fi: 0, vat: 0 })
				var t = table(data, { align: [ 'l', 'c', 'r', 'r', 'r', 'r'] });
				console.log(t);
				console.log(`Total Upwork income: ${numeral(total.amount).format('0,0.00')} p`)
				console.log(`\tTotal FI Taxes: ${numeral(total.fi).format('0,0.00')} p`)
				return rows
			})
	},
	usn: () => {
		return new Promise((resolve, reject) => {
			console.log(`\n\n---=== USN Taxes for Upwork period from ${startDate} till ${endDate} ===---\n`)

			const sql = 'SELECT id, type, amount, rate, date FROM statements WHERE skip = 0 AND NOT (type = "vat" OR type = "service fee" OR type = "withdrawal" OR type = "withdrawal fee") AND date BETWEEN ? AND ? ORDER BY id'
			// const sql = 'SELECT * FROM statements WHERE skip = 0 AND (type = "service fee" OR type = "withdrawal") AND date BETWEEN ? AND ? ORDER BY id'
			// const sql = 'SELECT * FROM statements WHERE skip = 1 and date BETWEEN ? AND ? ORDER BY id'
			return db.all(sql, [startDate, endDate], (err, res) => {
				if (err) return reject(err)

				return resolve(res)
			})
		})
			.then(rows => {
				const data = [
					[
						'Transaction',
						'Type',
						'Date',
						'Amount',
						'Rate NB',
						'Amount BYN',
						'USN BYN'
					]
				]
				const total = rows.reduce((total, row) => {
					const sum = roundAmount(row.amount * row.rate)
					const usn = roundAmount(sum * config.rates.usn / 100)
					const date = moment(row.date, 'YYYY-MM-DD hh:mm:ss').format('YYYY-MM-DD')
					data.push([
						row.id,
						row.type,
						date,
						numeral(row.amount).format('$0,0.00'),
						numeral(row.rate).format('0,0.0000'),
						numeral(sum).format('0,0.00'),
						numeral(usn).format('0,0.00')
					])
					total.amount += sum
					total.usn += usn
					return total
				}, { amount: 0, usn: 0, vat: 0 })
				var t = table(data, { align: [ 'l', 'c', 'c', 'r', 'r', 'r', 'r'] });
				console.log(t);
				console.log(`Total Upwork income: ${numeral(total.amount).format('0,0.00')} p`)
				console.log(`\tTotal USN Taxes: ${numeral(total.usn).format('0,0.00')} p`)
				return rows
			})
	},
	test: () => {
		return new Promise((resolve, reject) => {
			console.log(`\n\n---=== USN Taxes for Upwork period from ${startDate} till ${endDate} ===---\n`)

			const sql = 'SELECT id, type, amount, rate, date FROM statements WHERE date BETWEEN ? AND ? ORDER BY id'
			// const sql = 'SELECT * FROM statements WHERE skip = 0 AND (type = "service fee" OR type = "withdrawal") AND date BETWEEN ? AND ? ORDER BY id'
			// const sql = 'SELECT * FROM statements WHERE skip = 1 and date BETWEEN ? AND ? ORDER BY id'
			return db.all(sql, [startDate, endDate], (err, res) => {
				if (err) return reject(err)

				return resolve(res)
			})
		})
			.then(rows => {
				console.log('rows', rows)
				return rows
			})
	}
}

return taxes[type]()
	.catch(err => console.log(err.message, err))
