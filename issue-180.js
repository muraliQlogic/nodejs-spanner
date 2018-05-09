const assert = require('assert')
const async = require('async')

const Spanner = require('./src')
const spanner = new Spanner()

const instance = spanner.instance('issue-180-instance')
const database = instance.database('issue-180-database');
const table = database.table('accounts');

const NUM_ROWS_TO_INSERT = 3000

async function init() {
  await prepareInstance()
  await prepareDatabase()
  await prepareTable()
  await insertData()
  await insertData()
  await insertData()

  async.times(5, runQueryBatches, err => {
    if (err) throw err
    console.log('Query was successful')
  })

  function runQueryBatches(_, callback) {
    async.times(5, runQuery, callback)
  }

  let invalidRowReceived = false

  function runQuery(_, callback) {
    const query = {
      sql: 'SELECT `root`.`account_created_on` as `field0`, `root`.`Short_Text` as `field1`, `root`.`Short_Text1` as `field2`, `root`.`account_CID` as `field3`, `root`.`recordId` as `recordId` FROM `accounts` AS root',
      json: true,
    }

    let numRowsReceived = 0

    database.runStream(query)
      .on('error', callback)
      .on('data', function (row) {
        if (invalidRowReceived) {
          this.end()
          return
        }

        numRowsReceived++

        const tests = {
          field0: /.*account_created_on/,
          field1: /.*Short_Text/,
          field2: /.*Short_Text1/,
          field3: /.*account_CID/,
          recordId: /^\d+$/,
        }

        const isValidRow = Object.keys(row).every(key => tests[key].test(row[key]))

        if (!isValidRow && !invalidRowReceived) {
          invalidRowReceived = true
          console.log('Faulty row', row)
          this.destroy(new Error('Faulty row'))
        }
      })
      .on('end', () => {
        assert.strictEqual(numRowsReceived % NUM_ROWS_TO_INSERT, 0)
        callback()
      })
  }
}

init()

function prepareInstance() {
  return new Promise((resolve, reject) => {
    instance.create({
      config: 'regional-us-central1',
      nodes: 1,
    }, (err, instance, operation) => {
      if (err) {
        if (err.code === 6) {
          resolve()
        } else {
          reject(err)
        }
      } else {
        resolve(operation.promise())
      }
    })
  })
}

function prepareDatabase() {
  return new Promise((resolve, reject) => {
    database.create(err => {
      if (!err || (err && err.code === 6)) {
        resolve()
      } else {
        reject(err)
      }
    })
  })
}

function prepareTable() {
  const schema = `
    CREATE TABLE account (
      recordId STRING(36) NOT NULL,
      account_CID STRING(255),
      account_created_on STRING(1024),
      account_created_on_unixTimestamp FLOAT64,
      account_dashboard_tabs STRING(255),
      account_ok_tabs STRING(255),
      account_summary_content_tabs STRING(255),
      account_to_creator STRING(36),
      account_to_customer_admin STRING(36),
      account_view_tabs STRING(255),
      Address STRING(1024),
      Address1 STRING(1024),
      Address1_city STRING(255),
      Address1_postalcode STRING(255),
      Address1_provinceterritory STRING(255),
      Address_city STRING(255),
      Address_postalcode STRING(255),
      Address_provinceterritory STRING(255),
      current_document_number FLOAT64,
      customer_content_tabs STRING(255),
      Email STRING(255),
      fund_to_account STRING(36),
      FundsTab_AccountSubNavigation STRING(255),
      Number FLOAT64,
      Number1 FLOAT64,
      Number_of_Payments FLOAT64,
      payment_plan_to_account STRING(36),
      Phone_Number STRING(1024),
      Phone_Number1 STRING(1024),
      requested_payment_plan_to_account STRING(36),
      RequestRelationshipCID STRING(255),
      RequestRelationshipContentTab STRING(255),
      Selection_Field___Static STRING(MAX),
      Short_Text STRING(255),
      Short_Text1 STRING(255),
      Short_Text4 STRING(255),
      upload_customer_csv STRING(1024),
      upload_customer_csv_name STRING(255),
      user_to_accounts STRING(36),
    ) PRIMARY KEY (recordId)`

  return new Promise((resolve, reject) => {
    table.create(schema, err => {
      if (!err || (err && err.code === 6)) {
        resolve()
      } else {
        reject(err)
      }
    })
  })
}

function insertData() {
  const rows = []

  for (var i = 0; i < NUM_ROWS_TO_INSERT; i++) {
    rows.push({
      account_created_on: 'account_created_on',
      Short_Text: 'Short_Text',
      Short_Text1: 'Short_Text1',
      account_CID: 'account_CID',
      recordId: Math.round(Date.now() * Math.random())
    })
  }

  return table.insert(rows)
}