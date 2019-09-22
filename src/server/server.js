const FlightSuretyApp = require('../../build/contracts/FlightSuretyApp.json')
const Config = require('./config.json')
const Web3 = require('web3')
const express = require('express')

let config = Config['localhost']
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')))
web3.eth.defaultAccount = web3.eth.accounts[0]
let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress)
let oneEther = web3.utils.toWei('1', 'ether')
const oracles = new Map()

// Flight status codees
const STATUS_CODE_UNKNOWN = 0
const STATUS_CODE_ON_TIME = 10
const STATUS_CODE_LATE_AIRLINE = 20
const STATUS_CODE_LATE_WEATHER = 30
const STATUS_CODE_LATE_TECHNICAL = 40
const STATUS_CODE_LATE_OTHER = 50
const STATUSCODES  = [STATUS_CODE_UNKNOWN, STATUS_CODE_ON_TIME, STATUS_CODE_LATE_AIRLINE, STATUS_CODE_LATE_WEATHER, STATUS_CODE_LATE_TECHNICAL, STATUS_CODE_LATE_OTHER]



flightSuretyApp.events.OracleRequest({fromBlock: 0}, function (error, event) {
    if (error) 
      console.log(error)
    else {    
      console.log('OracleRequest event received')
      submitOracleResponses(event)
  }
})

flightSuretyApp.events.OracleReport({fromBlock: 0}, (error, event) => {
  if (error) 
      console.log(error)
  else    
      console.log('OracleReport event received')
})

flightSuretyApp.events.FlightStatusInfo({fromBlock: 0}, (error, event) => {
  if (error) 
      console.log(error)
  else {
      console.log(`${event.event} Received with attributes : 
          airline ${event.returnValues.airline} 
          flightNumber ${web3.utils.toUtf8(event.returnValues.flight)} 
          timeStamp ${Number(event.returnValues.timestamp)} 
          statusCode : ${event.returnValues.status}
      `)
  }
})

const registerOracle = (address) => {
  return new Promise((resolve, reject) => {
      flightSuretyApp.methods.registerOracle().send({from: address, value: web3.utils.toWei('1', 'ether'), gas: 3000000}, (error, result) => {
          if (error) {
              console.error('Error encountered while registering oracle  '+ address)
              reject(error)
          } else {
              resolve(result)
          }
      })
  })
}

const registerOracles = async () => {
  try {
    let accounts = await web3.eth.getAccounts() 
    let startIndex = 25
    console.log(Number(await web3.eth.getBalance(flightSuretyApp.address)) )
    console.log(accounts[0])
    for (let i = 0; i < 25; i++) {
        //let result = await flightSuretyApp.methods.registerOracle().send({from: accounts[i+startIndex], value: oneEther, gas: 9000000})
        await registerOracle(accounts[i+startIndex])
        let indexes = await flightSuretyApp.methods.getMyIndexes().call({from: accounts[i+startIndex], gas: 9000000})
        oracles.set(accounts[i+startIndex], indexes)
        console.log(`Oracle number ${i} : ${accounts[i+startIndex]} registred with indexes =  ${indexes}`)
    }
  } catch (error){
      console.log('Unable to register oracle:'  + accounts[i+startIndex])
      console.log('Error: ' + error)

  }
}


const submitOracleResponses = async(event) =>{

  let matchingOracles = []
  
  for (let [address, indexes] of oracles) {
    indexes.forEach(index => {
        if (index == event.returnValues.index) {
            matchingOracles.push(address)
            console.log(index + '->' + address)
        }
    })
  }
  console.log("-------   ---   ---   ---  submitOracleResponses -------   ---   ---   ---  ")
  console.log(`airline adsress ${event.returnValues.airline}`)
  console.log(`flight ${event.returnValues.flight}`)
  console.log(`flight ${event.returnValues.timestamp}`)
  console.log("-------   ---   ---   ---  submitOracleResponses -------   ---   ---   ---  ")
  
  matchingOracles.forEach(async(address) => { 
    try {
        await submitOracleResponse(
              address
            , event.returnValues.index
            , event.returnValues.airline
            , event.returnValues.flight
            , event.returnValues.timestamp
        )

      } catch(error){
          console.log('Unable to submitOracleResponse for Oracle Address ' + address)
          console.log('Error: ' + error)
      }    
  })
}


const submitOracleResponse = (oracleAddress, index, airline, flightNumber, timestamp) => {
  return new Promise((resolve, reject) => {
    let statusCode = generateRandomFlightStatusCode()
      flightSuretyApp.methods.submitOracleResponse(index, airline, flightNumber, timestamp, statusCode)
          .send({from: oracleAddress, gas: 500000}, 
              (error, result) => {
                  if(!error){
                      resolve(result)
                      console.log(`Oracle ${oracleAddress} is submitting flight status code of ${statusCode}`)
                  }       
                  else {
                      console.log(`oracle ${oracleAddress} was rejected while submitting oracle response with status statusCode ${statusCode}`)
                      reject(error)
                  }                
          })
  })
}


const generateRandomFlightStatusCode = () =>{
  let index = Math.floor(Math.random() * 10)
  if (index <= 4)
      return STATUSCODES[index]
  else {
    return STATUSCODES[2]
  }    
}

const app = express()
app.get('/api', (req, res) => {
    res.send({
      message: 'An API for use with your Dapp!'
    })
})

registerOracles()

module.export = { 
  app
}
