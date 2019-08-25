var Test = require('../config/testConfig.js');
var BigNumber = require('bignumber.js');
const truffleAssert = require('truffle-assertions');
let amount = web3.utils.toWei('10', 'ether');
let insuranceAmount = web3.utils.toWei('1', 'ether');

contract('Flight Surety App Tests', async (accounts) => {
    var config;
    before('setup contract', async () => {
        config = await Test.Config(accounts)
        await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address)

    });

    it(`(multiparty) has correct initial isOperational() value`, async function () {
        // Get operating status
        let status = await config.flightSuretyApp.isOperational.call();
        assert.equal(status, true, "Incorrect initial operating status value");
  
    });

    it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {

        // Ensure that access is denied for non-Contract Owner account
        await truffleAssert.reverts(config.flightSuretyApp.setOperatingStatus(false, { from: accounts[2] }), 'Caller is not contract owner')
              
    });

    it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {

        // Ensure that access is allowed for Contract Owner account
        await config.flightSuretyApp.setOperatingStatus(false, {from:config.owner})
        let status = await config.flightSuretyApp.isOperational.call();
        assert.equal(status, false, "Access not restricted to Contract Owner");
        
    });

    it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {

        // Block access by the owner
        await config.flightSuretyApp.setOperatingStatus(false, {from:config.owner});
        
        // try to call when the contract is not operational
        await truffleAssert.reverts(config.flightSuretyApp.getAirlinesNumber.call({from: accounts[2]}), 'Contract is currently not operational')
  
        // Set it back for other tests to work
        await config.flightSuretyApp.setOperatingStatus(true, {from:config.owner})
  
    });

    it('(airline) can register an Airline using registerAirline() if the caller is already registred', async () => {
        
        let newAirline = accounts[2]
        let newAirlineName = web3.utils.utf8ToHex('newAirline')
        let airlinesNumber = Number(await config.flightSuretyApp.getAirlinesNumber.call())
  
        // register first airline
        await config.flightSuretyApp.registerAirline(config.firstAirline, web3.utils.utf8ToHex('First Airline'))
      
        //  the first airline trys te resiter a new airline
        let tx = await config.flightSuretyApp.registerAirline(newAirline, newAirlineName, {from: config.firstAirline})
        let resut = await config.flightSuretyApp.fetchAirlineDetails.call(newAirline);
  
        // Verify the result set    
        assert.equal(resut[0], true, 'Error: The isRegistered airline is not registered correctly')
        assert.equal(resut[1], false, 'Error: The isAutorised airline is not registered correctly')
        assert.equal(web3.utils.hexToUtf8(resut[2]), web3.utils.hexToUtf8(newAirlineName), 'Error: The name airline is not registered correctly')
        assert.equal(resut[3], 0, 'Error: The balance airline is not registered correctly')
        assert.equal(Number(await config.flightSuretyApp.getAirlinesNumber.call()), airlinesNumber + 2, 'Error: The number of airlines was not incremented correctly')
        assert.equal(tx.logs[0].event, "AirLineRegistrated", 'Invalid event emitted')
  
    });

    it('(airline) cannot register an Airline using registerAirline() if the caller is not registred', async () => {
        let newAirline = accounts[3]
        let newAirlineName = web3.utils.utf8ToHex('newAirline 3')
        let airlineNotRegistred = accounts[4]
        // register a new flight 
        await truffleAssert.reverts(config.flightSuretyApp.registerAirline(newAirline, newAirlineName, {from: airlineNotRegistred}), 
                          "Caller is not registred")
  
    });

    it('(airline) cannot register an Airline using registerAirline() if consensus is not achieved', async () => {
        
        // at this stat we have aleadry 3 airlines registred. We can add one more without voting.
        let newAirline = accounts[5]
        let newAirlineName = web3.utils.utf8ToHex('newAirline 5')
        await config.flightSuretyApp.registerAirline(newAirline, newAirlineName)

        // add the 5th airline, the registred airlines have to vote to validate the registration, 50% vote is needed.
        let newAirline2 = accounts[6]
        let newAirlineName2 = web3.utils.utf8ToHex('newAirline 6')

        let airlinesNumberBefor = Number(await config.flightSuretyApp.getAirlinesNumber.call())
        tx = await config.flightSuretyApp.registerAirline(newAirline2, newAirlineName2)
        let airlinesNumberAfter = Number(await config.flightSuretyApp.getAirlinesNumber.call())

        assert.equal(airlinesNumberBefor, airlinesNumberAfter, 'Error: The number of airlines is not valid')
  
    });


    it('(airline) can register an Airline using registerAirline() if consensus is achieved', async () => {
        
        // at this stat we have aleadry 4 airlines registred. We can add one more without voting.
        let newAirline = accounts[7]
        let newAirlineName = web3.utils.utf8ToHex('newAirline 7')
        let airlinesNumber = Number(await config.flightSuretyApp.getAirlinesNumber.call())

        // add the 5th airline, the registred airlines have to vote to validate the registration, 50% vote is needed.
        // vote# 1
        await config.flightSuretyApp.registerAirline(newAirline, newAirlineName, {from: config.firstAirline})

        // vote# 2
        let tx = await config.flightSuretyApp.registerAirline(newAirline, newAirlineName, {from: accounts[5]})
        let resut = await config.flightSuretyApp.fetchAirlineDetails.call(newAirline);
   
        // Verify the result set    
        assert.equal(resut[0], true, 'Error: The isRegistered airline is not registered correctly')
        assert.equal(resut[1], false, 'Error: The isAutorised airline is not registered correctly')
        assert.equal(web3.utils.hexToUtf8(resut[2]), web3.utils.hexToUtf8(newAirlineName), 'Error: The name airline is not registered correctly')
        assert.equal(resut[3], 0, 'Error: The balance airline is not registered correctly')
        assert.equal(Number(await config.flightSuretyApp.getAirlinesNumber.call()), airlinesNumber + 1, 'Error: The number of airlines was not incremented correctly')
        assert.equal(tx.logs[0].event, "AirLineRegistrated", 'Invalid event emitted')
  
    });

    it('(airline) can fund Airline using fundAirline() if the caller is registred', async () => {
        let newAirline = accounts[28]
        let newAirlineName = web3.utils.utf8ToHex('newAirline 8')
        // register airline
        await config.flightSuretyApp.registerAirline(newAirline, newAirlineName, {from: config.firstAirline})
        await config.flightSuretyApp.registerAirline(newAirline, newAirlineName, {from: accounts[5]})
        await config.flightSuretyApp.registerAirline(newAirline, newAirlineName, {from: accounts[7]})
        
        // Get the contract banlance befor funding
        let contractBalanceBefor = Number(await web3.eth.getBalance(config.flightSuretyData.address)) 
  
        // fund airline
        let tx = await config.flightSuretyApp.fundAirline({from: newAirline, value: amount})
        let resut = await config.flightSuretyApp.fetchAirlineDetails.call(newAirline);
  
        // Get the contract banlance after funding
        let contractBalanceAfter = Number(await web3.eth.getBalance(config.flightSuretyData.address)) 
  
        // Verify the result set
        assert.equal(resut[0], true, 'Error: The isRegistered airline is not updated correctly')
        assert.equal(resut[1], true, 'Error: The isAutorised airline is not updated correctly')
        assert.equal(resut[3], amount, 'Error: The balance airline is not updated correctly')
        assert.equal(tx.logs[0].event, "ContractFunded", 'Error: Invalid event emitted')
        assert.equal(contractBalanceAfter, contractBalanceBefor + Number(amount) , 'Error: The contract balance variable is not updated correctly')
  
    });

    it('(airline) cannot fund Airline using fundAirline() if the caller is not registred', async () => {
    
        let newAirline = accounts[9]
        // Get the contract banlance befor funding
        let contractBalanceBefor = Number(await web3.eth.getBalance(config.flightSuretyData.address)) 
  
        // fund airline
        await truffleAssert.reverts(config.flightSuretyApp.fundAirline({from: newAirline, value: amount}) , "Caller is not registred" )

        let contractBalanceAfter = Number(await web3.eth.getBalance(config.flightSuretyData.address)) 

        // Verify the result set
        assert.equal(Number(contractBalanceBefor), Number(contractBalanceAfter), 'Error: The contract balance variable is updated wrongly')
    
    });

    it('(airline) cannot fund Airline using fundAirline() with an amount < minimun required', async () => {
  
        // fund airline
        await truffleAssert.reverts(config.flightSuretyApp.fundAirline({from: accounts[28], value: insuranceAmount}) , 'Minimum registration fee is required')

    });

    it('(airline-flight) can add a new flight using addNewFlight() if the caller is registred and funded', async () => {

        let newAirline = accounts[10]
        let newAirlineName = web3.utils.utf8ToHex('newAirline 10')
        
        // vote to register a newairline
        await config.flightSuretyApp.registerAirline(newAirline, newAirlineName, {from: config.firstAirline})
        await config.flightSuretyApp.registerAirline(newAirline, newAirlineName, {from: accounts[5]})
        await config.flightSuretyApp.registerAirline(newAirline, newAirlineName, {from: accounts[7]})

        // fund airline
        await config.flightSuretyApp.fundAirline({from: newAirline, value: amount})

        // Add new flight
        const flightNumber = 'AF1800'
        let tx = await config.flightSuretyApp.addNewFlight(web3.utils.utf8ToHex(flightNumber), 1122334455, {from: newAirline}) 
        let resut = await config.flightSuretyApp.fetchFlightDetails.call(web3.utils.utf8ToHex(flightNumber))

        // Verify the result set
        assert.equal(resut[0], newAirline, 'Error: Flight airline address is not valid')
        assert.equal(web3.utils.hexToUtf8(resut[1]), flightNumber, 'Error: flight number is not valid')
        assert.equal(resut[2], 1122334455, 'Error: flight timestamp is not valid')
        assert.equal(resut[3], 0, 'Error: flight status code is not valid')
        assert.equal(tx.logs[0].event, "NewFlightAdded", 'Invalid event emitted')
    
    });

    it('(airline-flight) cannot add an existing flight using addNewFlight()', async () => {

        let newAirline = accounts[11]
        let newAirlineName = web3.utils.utf8ToHex('newAirline 11')
    
        // vote to register a newairline
        await config.flightSuretyApp.registerAirline(newAirline, newAirlineName, {from: config.firstAirline})
        await config.flightSuretyApp.registerAirline(newAirline, newAirlineName, {from: accounts[5]})
        await config.flightSuretyApp.registerAirline(newAirline, newAirlineName, {from: accounts[7]})
        await config.flightSuretyApp.registerAirline(newAirline, newAirlineName, {from: config.owner})
    
        // fund airline
        await config.flightSuretyApp.fundAirline({from: newAirline, value: amount})
    
        // Add new flight
        const flightNumber = 'AF1900'
        await config.flightSuretyApp.addNewFlight(web3.utils.utf8ToHex(flightNumber), 1122334455, {from: newAirline}) 
        
        // add the same flight
        await truffleAssert.reverts(config.flightSuretyApp.addNewFlight(web3.utils.utf8ToHex(flightNumber), 1122334455, {from: newAirline}) , 'Flight already registered')        
   
    });

    it('(airline-flight) cannot add a flight using addNewFlight() if the caller is not registred', async () => {

        let newAirline = accounts[12]

        // Add new flight
        const flightNumber = 'AF2000'
        await truffleAssert.reverts(config.flightSuretyApp.addNewFlight(web3.utils.utf8ToHex(flightNumber), 1122334455, {from: newAirline}) , 'Caller is not registred')        

    });

    it('(airline-flight) cannot add a flight using addNewFlight() if the caller is registred but not autorised', async () => {

        let newAirline = accounts[13]
        let newAirlineName = web3.utils.utf8ToHex('newAirline 13')

        //console.log(await config.flightSuretyApp.getAirlinesNumber.call())

        // vote to register a newairline
        await config.flightSuretyApp.registerAirline(newAirline, newAirlineName, {from: config.firstAirline})
        await config.flightSuretyApp.registerAirline(newAirline, newAirlineName, {from: accounts[5]})
        await config.flightSuretyApp.registerAirline(newAirline, newAirlineName, {from: accounts[7]})
        await config.flightSuretyApp.registerAirline(newAirline, newAirlineName, {from: config.owner})

        // Add new flight
        const flightNumber = 'AF2100'
        await truffleAssert.reverts(config.flightSuretyApp.addNewFlight(web3.utils.utf8ToHex(flightNumber), 1122334455, {from: newAirline}) , 'Caller is not autorised, you have to fund first')        

    });

    it('(passenger) can buy insurance flight using buyInsurance()', async () => {

        let newAirline = accounts[14]
        let newAirlineName = web3.utils.utf8ToHex('newAirline 14')
        let passenger = accounts[15]

        // vote to register a newairline
        await config.flightSuretyApp.registerAirline(newAirline, newAirlineName, {from: config.firstAirline})
        await config.flightSuretyApp.registerAirline(newAirline, newAirlineName, {from: accounts[5]})
        await config.flightSuretyApp.registerAirline(newAirline, newAirlineName, {from: accounts[7]})
        await config.flightSuretyApp.registerAirline(newAirline, newAirlineName, {from: accounts[10]})
        await config.flightSuretyApp.registerAirline(newAirline, newAirlineName, {from: config.owner})

        // fund airline
        await config.flightSuretyApp.fundAirline({from: newAirline, value: amount})

        // Add new flight
        const flightNumber = 'AF2200'
        await config.flightSuretyApp.addNewFlight(web3.utils.utf8ToHex(flightNumber), 1122334455, {from: newAirline}) 

        // Get the contract banlance befor buying
        let contractBalanceBefor = Number(await web3.eth.getBalance(config.flightSuretyData.address)) 
  
        // buy insurance
        let tx = await config.flightSuretyApp.buyInsurance(web3.utils.utf8ToHex(flightNumber), {from: passenger, value: insuranceAmount})

        // Get the contract banlance after buying
        let contractBalanceAfter = Number(await web3.eth.getBalance(config.flightSuretyData.address)) 

        // Verify the result set
        assert.equal(tx.logs[0].event, "InsurancePurchased", 'Invalid event emitted') 
        assert.equal(Number(contractBalanceAfter), Number(contractBalanceBefor) + Number(insuranceAmount), 'Error: The contract balance variable is updated wrongly')

    });

    it('(passenger) cannot buy insurance for a non existing flight using buyInsurance()', async () => {

        let newAirline = accounts[16]
        let newAirlineName = web3.utils.utf8ToHex('newAirline 16')
        let passenger = accounts[17]

        // vote to register a newairline
        await config.flightSuretyApp.registerAirline(newAirline, newAirlineName, {from: config.firstAirline})
        await config.flightSuretyApp.registerAirline(newAirline, newAirlineName, {from: accounts[5]})
        await config.flightSuretyApp.registerAirline(newAirline, newAirlineName, {from: accounts[7]})
        await config.flightSuretyApp.registerAirline(newAirline, newAirlineName, {from: accounts[10]})
        await config.flightSuretyApp.registerAirline(newAirline, newAirlineName, {from: config.owner})

        // fund airline
        await config.flightSuretyApp.fundAirline({from: newAirline, value: amount})

        // Add new flight
        const flightNumber = 'AF2300'

        await truffleAssert.reverts( config.flightSuretyApp.buyInsurance(web3.utils.utf8ToHex(flightNumber), {from: passenger, value: insuranceAmount})
                                        , 'Flight does not exist')
    
    });

    it('(passenger) cannot buy insurance for the same flight using buyInsurance() more than once', async () => {

        let newAirline = accounts[18]
        let newAirlineName = web3.utils.utf8ToHex('newAirline 18')
        let passenger = accounts[19]

        // vote to register a newairline
        await config.flightSuretyApp.registerAirline(newAirline, newAirlineName, {from: config.firstAirline})
        await config.flightSuretyApp.registerAirline(newAirline, newAirlineName, {from: accounts[5]})
        await config.flightSuretyApp.registerAirline(newAirline, newAirlineName, {from: accounts[7]})
        await config.flightSuretyApp.registerAirline(newAirline, newAirlineName, {from: accounts[10]})
        await config.flightSuretyApp.registerAirline(newAirline, newAirlineName, {from: config.owner})
        await config.flightSuretyApp.registerAirline(newAirline, newAirlineName, {from: accounts[14]})

        // fund airline
        await config.flightSuretyApp.fundAirline({from: newAirline, value: amount})
     
        // Add new flight
        const flightNumber = 'AF2400'
        await config.flightSuretyApp.addNewFlight(web3.utils.utf8ToHex(flightNumber), 1122334455, {from: newAirline}) 

        // buy insurance
        let tx = await config.flightSuretyApp.buyInsurance(web3.utils.utf8ToHex(flightNumber), {from: passenger, value: insuranceAmount})

         // Buy the same insurance for the seconde time
         await truffleAssert.reverts( config.flightSuretyApp.buyInsurance(web3.utils.utf8ToHex(flightNumber), {from: passenger, value: insuranceAmount})
                                        , 'Insurrance already exists for this flight')
        
    });



});