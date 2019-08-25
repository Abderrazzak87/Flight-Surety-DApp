var Test = require('../config/testConfig.js');
var BigNumber = require('bignumber.js');
const truffleAssert = require('truffle-assertions');
let amount = web3.utils.toWei('20', 'ether');
let insuranceAmount = web3.utils.toWei('1', 'ether');
let INSURANCE_PAYBACK_MULTIPLIER = 150;

contract('Flight Surety Data Tests', async (accounts) => {
    var config;
    before('setup contract', async () => {
        config = await Test.Config(accounts)
        await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address)

    });

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

  it(`(multiparty) has correct initial isOperational() value`, async function () {
      // Get operating status
      let status = await config.flightSuretyData.isOperational.call();
      assert.equal(status, true, "Incorrect initial operating status value");

    });

  it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {

      // Ensure that access is denied for non-Contract Owner account
      let accessDenied = false;
      try 
      {
          await config.flightSuretyData.setOperatingStatus(false, { from: accounts[2] });
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, true, "Access not restricted to Contract Owner");
            
    });

  it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {

      // Ensure that access is allowed for Contract Owner account
      let accessDenied = false;
      try 
      {
          await config.flightSuretyData.setOperatingStatus(false, {from:config.owner});
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, false, "Access not restricted to Contract Owner");
      
    });

  it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {

      await config.flightSuretyData.setOperatingStatus(false, {from:config.owner});

      let reverted = false;
      try 
      {
         // call a function requires is operatianal
         await config.flightSuretyData.getAirlinesNumber.call()
      }
      catch(e) {
          reverted = true;
      }
      assert.equal(reverted, true, "Access not blocked for requireIsOperational")   

      // Set it back for other tests to work
      await config.flightSuretyData.setOperatingStatus(true, {from:config.owner})

    });

  it('(airline) can register an Airline using registerAirline() if the caller is already registred', async () => {
      // ARRANGE
      let newAirline = accounts[2]
      let newAirlineName = 'newAirline'
      let airlinesNumber = Number(await config.flightSuretyData.getAirlinesNumber.call())

      // register first airline
      await config.flightSuretyData.registerAirline(config.firstAirline, web3.utils.utf8ToHex('First Airline'))
    
        //  the first airline trys te resiter a new airline
        let tx = await config.flightSuretyData.registerAirline(newAirline, web3.utils.utf8ToHex(newAirlineName), {from: config.firstAirline})
        let resut = await config.flightSuretyData.fetchAirlineDetails.call(newAirline);

        // Verify the result set    
        assert.equal(resut[0], true, 'Error: The isRegistered airline is not registered correctly')
        assert.equal(resut[1], false, 'Error: The isAutorised airline is not registered correctly')
        assert.equal(web3.utils.hexToUtf8(resut[2]), newAirlineName, 'Error: The name airline is not registered correctly')
        assert.equal(resut[3], 0, 'Error: The balance airline is not registered correctly')
        assert.equal(Number(await config.flightSuretyData.getAirlinesNumber.call()), airlinesNumber + 2, 'Error: The number of airlines was not incremented correctly')
        assert.equal(tx.logs[0].event, "AirLineRegistrated", 'Invalid event emitted')

    });

  it('(airline) cannot register an Airline using registerAirline() if the caller is not registred', async () => {
      let newAirline = accounts[3]
      let newAirlineName = web3.utils.utf8ToHex('newAirline 3')
      let airlineNotRegistred = accounts[4]
      // register a new flight 
      await truffleAssert.reverts(config.flightSuretyData.registerAirline(newAirline, newAirlineName, {from: airlineNotRegistred}), 
                        "Caller is not registred")

    });

  it('(airline) can fund Airline using fund() if the caller is registred', async () => {
      let newAirline = accounts[5]
      let newAirlineName = web3.utils.utf8ToHex('newAirline 5')
      // register airline
      await config.flightSuretyData.registerAirline(newAirline, newAirlineName, {from: config.owner})
      
      // Get the contract banlance befor funding
      let contractBalanceBefor = await config.flightSuretyData.getContractBalance.call({from: config.owner})

      // fund airline
      let tx = await config.flightSuretyData.fund(amount, newAirline, {from: newAirline}) 
      let resut = await config.flightSuretyData.fetchAirlineDetails.call(newAirline)

      // Get the contract banlance after funding
      let contractBalanceAfter = await config.flightSuretyData.getContractBalance.call({from: config.owner})


      // Verify the result set
      assert.equal(resut[0], true, 'Error: The isRegistered airline is not updated correctly')
      assert.equal(resut[1], true, 'Error: The isAutorised airline is not updated correctly')
      assert.equal(resut[3], amount, 'Error: The balance airline is not updated correctly')
      assert.equal(tx.logs[0].event, "ContractFunded", 'Error: Invalid event emitted')
      assert.equal(Number(contractBalanceAfter), Number(contractBalanceBefor) + Number(amount) , 'Error: The contract balance variable is not updated correctly')

    });

  it('(airline) cannot fund Airline using fund() if the caller is not registred', async () => {
    
        let newAirline = accounts[6]

        let contractBalanceBefor = await config.flightSuretyData.getContractBalance.call({from: config.owner})
        // fund airline
        await truffleAssert.reverts(config.flightSuretyData.fund(amount, newAirline, {from: newAirline}) , "Caller is not registred" )

        let contractBalanceAfter = await config.flightSuretyData.getContractBalance.call({from: config.owner})

        // Verify the result set
        assert.equal(Number(contractBalanceBefor), Number(contractBalanceAfter), 'Error: The contract balance variable is updated wrongly')
    
    });


  it('(flight) can add a new flight using addNewFlight() if the caller is registred and funded', async () => {

        let newAirline = accounts[7]
        let newAirlineName = web3.utils.utf8ToHex('newAirline 7')

        // register airline
        await config.flightSuretyData.registerAirline(newAirline, newAirlineName, {from: config.owner})

        // fund airline
        await config.flightSuretyData.fund(amount, newAirline, {from: newAirline}) 

        // Add new flight
        const flightNumber = 'AF1800'
        let tx = await config.flightSuretyData.addNewFlight(newAirline, web3.utils.utf8ToHex(flightNumber), 1122334455, 0, {from: newAirline}) 
        let resut = await config.flightSuretyData.fetchFlightDetails.call(web3.utils.utf8ToHex(flightNumber))

        // Verify the result set
        assert.equal(resut[0], newAirline, 'Error: Flight airline address is not valid')
        assert.equal(web3.utils.hexToUtf8(resut[1]), flightNumber, 'Error: flight number is not valid')
        assert.equal(resut[2], 1122334455, 'Error: flight timestamp is not valid')
        assert.equal(resut[3], 0, 'Error: flight status code is not valid')
        assert.equal(tx.logs[0].event, "NewFlightAdded", 'Invalid event emitted')    

    });

     it('(flight) cannot add an existing flight using addNewFlight()', async () => {

        let newAirline = accounts[8]
        let newAirlineName = web3.utils.utf8ToHex('newAirline 8')
    
        // register airline
        await config.flightSuretyData.registerAirline(newAirline, newAirlineName, {from: config.owner})
    
        // fund airline
        await config.flightSuretyData.fund(amount, newAirline, {from: newAirline}) 
    
        // Add new flight
        const flightNumber = 'AF1900'
        await config.flightSuretyData.addNewFlight(newAirline, web3.utils.utf8ToHex(flightNumber), 1122334455, 0, {from: newAirline}) 
        
        // add the same flight
        await truffleAssert.reverts(config.flightSuretyData.addNewFlight(newAirline, web3.utils.utf8ToHex(flightNumber), 1122334455, 0, {from: newAirline}), 'Flight already registered')        
   
    });

    it('(flight) cannot add a flight using addNewFlight() if the caller is not registred', async () => {

        let newAirline = accounts[9]

        // Add new flight
        const flightNumber = 'AF2000'
        await truffleAssert.reverts(config.flightSuretyData.addNewFlight(newAirline, web3.utils.utf8ToHex(flightNumber), 1122334455, 0, {from: newAirline}), 'Caller is not registred')        

    
    });

    it('(flight) cannot add a flight using addNewFlight() if the caller is registred but not autorised', async () => {

        let newAirline = accounts[10]
        let newAirlineName = web3.utils.utf8ToHex('newAirline 10')

        // register airline
        await config.flightSuretyData.registerAirline(newAirline, newAirlineName, {from: config.owner})

        // Add new flight
        const flightNumber = 'AF2100'
        await truffleAssert.reverts(config.flightSuretyData.addNewFlight(newAirline, web3.utils.utf8ToHex(flightNumber), 1122334455, 0, {from: newAirline}), 'Caller is not autorised, you have to fund first')        

    });

    it('(passenger) can buy insurance flight using buy()', async () => {
        
        let newAirline = accounts[11]
        let newAirlineName = web3.utils.utf8ToHex('newAirline 11')
        let passengerAddress = accounts[12]

        // register airline
        await config.flightSuretyData.registerAirline(newAirline, newAirlineName, {from: config.owner})
    
        // fund airline
        await config.flightSuretyData.fund(amount, newAirline, {from: newAirline}) 
     
        // Add new flight
        const flightNumber = 'AF2200'
        await config.flightSuretyData.addNewFlight(newAirline, web3.utils.utf8ToHex(flightNumber), 1122334455, 0, {from: newAirline}) 

        // Get contract and airline balance befor buy
        let contractBalanceBefor = await config.flightSuretyData.getContractBalance.call({from: config.owner})
        let airlineBalanceBefor = (await config.flightSuretyData.fetchAirlineDetails.call(newAirline))[3]
        
        // Buy insurance
        let flightResult =  await config.flightSuretyData.fetchFlightDetails.call(web3.utils.utf8ToHex(flightNumber)) 
        let tx = await config.flightSuretyData.buy(flightResult[4], passengerAddress, insuranceAmount, {from: newAirline}) 
        
        // Get contract and airline balance after buy
        let contractBalanceAfter = await config.flightSuretyData.getContractBalance.call({from: config.owner})
        let airlineBalanceAfter = (await config.flightSuretyData.fetchAirlineDetails.call(newAirline))[3]

        let flightKey = (await config.flightSuretyData.fetchFlightDetails.call(web3.utils.utf8ToHex(flightNumber)))[4]

        let resut = await config.flightSuretyData.fetchInsuranceDetails.call(flightKey, passengerAddress)

        assert.equal(resut[0], passengerAddress, 'Error: Insurance passenger address is not valid')
        assert.equal(resut[1], insuranceAmount, 'Error: Insurance value is not valid')
        assert.equal(resut[2], false, 'Error: Insurance ispaid boolean is not valid')
        assert.equal(Number(contractBalanceAfter), Number(contractBalanceBefor) + Number(insuranceAmount), 'Error: contract balance is not valid after buying insurance')
        assert.equal(Number(airlineBalanceAfter), Number(airlineBalanceBefor) + Number(insuranceAmount), 'Error: airline balance is not valid after buying insurance')
        assert.equal(tx.logs[0].event, "InsurancePurchased", 'Invalid event emitted')   
         
    });
    
    it('(passenger) cannot buy insurance for a non existing flight using buy()', async () => {

        let newAirline = accounts[13]
        let newAirlineName = web3.utils.utf8ToHex('newAirline 13')
        let passengerAddress = accounts[14]

         // register airline
         await config.flightSuretyData.registerAirline(newAirline, newAirlineName, {from: config.owner})
    
         // fund airline
         await config.flightSuretyData.fund(amount, newAirline, {from: newAirline}) 

         // Decalre new flight witch will not be added to the contract
        const flightNumber = 'AF2300'

        // Buy insurance
        let flightResult =  await config.flightSuretyData.fetchFlightDetails.call(web3.utils.utf8ToHex(flightNumber))
        await truffleAssert.reverts( config.flightSuretyData.buy(flightResult[4], passengerAddress, insuranceAmount, {from: newAirline}) 
                                        , 'Flight does not exist')
    
    
    });

    it('(passenger) cannot buy insurance for the same flight using buy() more than once', async () => {

        let newAirline = accounts[15]
        let newAirlineName = web3.utils.utf8ToHex('newAirline 15')
        let passengerAddress = accounts[16]

        // register airline
        await config.flightSuretyData.registerAirline(newAirline, newAirlineName, {from: config.owner})
    
        // fund airline
        await config.flightSuretyData.fund(amount, newAirline, {from: newAirline}) 
     
        // Add new flight
        const flightNumber = 'AF2400'
        await config.flightSuretyData.addNewFlight(newAirline, web3.utils.utf8ToHex(flightNumber), 1122334455, 0, {from: newAirline}) 

         // Buy insurance
         let flightResult =  await config.flightSuretyData.fetchFlightDetails.call(web3.utils.utf8ToHex(flightNumber)) 
         await config.flightSuretyData.buy(flightResult[4], passengerAddress, insuranceAmount, {from: newAirline}) 

         // Buy the same insurance for the seconde time
         await truffleAssert.reverts( config.flightSuretyData.buy(flightResult[4], passengerAddress, insuranceAmount, {from: newAirline}) 
                                        , 'Insurrance already exists for this flight')
        
    });

    it('(flight) can credit all insurees for the given flight using creditInsurees()', async () => {

        let newAirline = accounts[17]
        let newAirlineName = web3.utils.utf8ToHex('newAirline 17')
        let passenger1Address = accounts[18]
        let passenger2Address = accounts[19]

        // register airline
        await config.flightSuretyData.registerAirline(newAirline, newAirlineName, {from: config.owner})
    
        // fund airline
        await config.flightSuretyData.fund(amount, newAirline, {from: newAirline}) 
     
        // Add new flight
        const flightNumber = 'AF2500'
        await config.flightSuretyData.addNewFlight(newAirline, web3.utils.utf8ToHex(flightNumber), 1122334455, 0, {from: newAirline}) 

         // Buy insurance for two insurees
         let flightResult =  await config.flightSuretyData.fetchFlightDetails.call(web3.utils.utf8ToHex(flightNumber)) 
         await config.flightSuretyData.buy(flightResult[4], passenger1Address, insuranceAmount, {from: newAirline}) 
         await config.flightSuretyData.buy(flightResult[4], passenger2Address, insuranceAmount, {from: newAirline}) 

         // Get the airline balance befor crediting insurees
         let airlineBalanceBefor = (await config.flightSuretyData.fetchAirlineDetails.call(newAirline))[3]

         // credit insurees
         tx = await config.flightSuretyData.creditInsurees(flightResult[4], INSURANCE_PAYBACK_MULTIPLIER, {from: newAirline}) 
         
         // Get the airline balance befor crediting insurees
         let airlineBalanceAfler = (await config.flightSuretyData.fetchAirlineDetails.call(newAirline))[3]
         let amountToCredit = ((insuranceAmount * INSURANCE_PAYBACK_MULTIPLIER) / 100) * 2

         assert.equal(Number(airlineBalanceAfler), Number(airlineBalanceBefor) - Number(amountToCredit), 'Error: airline balance not correct after creting insurees')
        
    });

    it('(flight) cannot credit insuree for an insurance already paid using creditInsurees()', async () => {

        let newAirline = accounts[20]
        let newAirlineName = web3.utils.utf8ToHex('newAirline 20')
        let passengerAddress = accounts[21]

        // register airline
        await config.flightSuretyData.registerAirline(newAirline, newAirlineName, {from: config.owner})
    
        // fund airline
        await config.flightSuretyData.fund(amount, newAirline, {from: newAirline}) 
     
        // Add new flight
        const flightNumber = 'AF2600'
        await config.flightSuretyData.addNewFlight(newAirline, web3.utils.utf8ToHex(flightNumber), 1122334455, 0, {from: newAirline}) 

         // Buy insurance
         let flightResult =  await config.flightSuretyData.fetchFlightDetails.call(web3.utils.utf8ToHex(flightNumber)) 
         await config.flightSuretyData.buy(flightResult[4], passengerAddress, insuranceAmount, {from: newAirline}) 

         // credit insurees
         await config.flightSuretyData.creditInsurees(flightResult[4], INSURANCE_PAYBACK_MULTIPLIER, {from: newAirline}) 


          // Get the airline balance befor crediting insurees
          let airlineBalanceBefor = (await config.flightSuretyData.fetchAirlineDetails.call(newAirline))[3]

          // credit the same passenger fot the same insurance
          tx = await config.flightSuretyData.creditInsurees(flightResult[4], INSURANCE_PAYBACK_MULTIPLIER, {from: newAirline}) 
          
          // Get the airline balance befor crediting insurees
          let airlineBalanceAfler = (await config.flightSuretyData.fetchAirlineDetails.call(newAirline))[3]
 
          assert.equal(Number(airlineBalanceAfler), Number(airlineBalanceBefor), 'Error: insuree cannot be credited twice for the same insurance')
    });


    it('(flight) can pay an insuree using pay()', async () => {

        let newAirline = accounts[22]
        let newAirlineName = web3.utils.utf8ToHex('newAirline 22')
        let passengerAddress = accounts[23]

        // register airline
        await config.flightSuretyData.registerAirline(newAirline, newAirlineName, {from: config.owner})
    
        // fund airline
        await config.flightSuretyData.fund(amount, newAirline, {from: newAirline}) 
     
        // Add new flight
        const flightNumber = 'AF2700'
        await config.flightSuretyData.addNewFlight(newAirline, web3.utils.utf8ToHex(flightNumber), 1122334455, 0, {from: newAirline}) 

        // Buy insurance
        let flightResult =  await config.flightSuretyData.fetchFlightDetails.call(web3.utils.utf8ToHex(flightNumber)) 
        await config.flightSuretyData.buy(flightResult[4], passengerAddress, insuranceAmount, {from: newAirline}) 
         
        // credit insurees
        await config.flightSuretyData.creditInsurees(flightResult[4], INSURANCE_PAYBACK_MULTIPLIER, {from: newAirline})

        // Get Passenger balance befor paying
        let passengerBalanceBefor = Number(await web3.eth.getBalance(passengerAddress))
         
        // Pay passenger
        let amountToPay = web3.utils.toWei(((insuranceAmount * INSURANCE_PAYBACK_MULTIPLIER) / 100).toString())
        tx = await config.flightSuretyData.pay(passengerAddress, amountToPay, {from: newAirline}) 
        
        // Get Passenger balance befor paying
        let passengerBalanceAfter = Number(await web3.eth.getBalance(passengerAddress))

        //assert.equal(Number(passengerBalanceAfter), Number(passengerBalanceBefor) + Number(amountToPay) , 'Error: passenger balance')
        assert.equal(tx.logs[0].event, "PassengerPaid", 'Invalid event emitted')   

          
    });

});
