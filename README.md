# uptaxes

## Import statements

`https://www.upwork.com/earnings-history`

Filter transactions to tax period + 10 days around

Download CSV

`node import.js statement_20181221_20190410_all.csv`


## Taxes

### USN

`node taxes.js usn q 2019 1` -- quartery

`node taxes.js usn m 2019 01` -- monthly

`node taxes.js usn y 2019` -- yearly


### Foreign Legal Entities

`node taxes.js fi q 2019 1`

### VAT (not actual)

`node taxes.js vat q 2019 1`

