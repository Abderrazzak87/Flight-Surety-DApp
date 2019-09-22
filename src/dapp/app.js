App = {
    web3Provider: null,
    contracts: {},

    init: async function () {
        return await App.initWeb3()
    },

    initWeb3: async function () {
        /// Find or Inject Web3 Provider
        /// Modern dapp browsers...
        if (window.ethereum) {
            App.web3Provider = window.ethereum
            try {
                // Request account access
                await window.ethereum.enable()
            } catch (error) {
                // User denied account access...
                console.error("User denied account access")
            }
        }
        // Legacy dapp browsers...
        else if (window.web3) {
            App.web3Provider = window.web3.currentProvider
        }
        // If no injected web3 instance is detected, fall back to Ganache
        else {
            App.web3Provider = new Web3.providers.HttpProvider('http://localhost:7545')
        }

        console.log('App.web3Provider',App.web3Provider)
        App.getMetaskAccountID()
        return App.initFlightSuretyContract()
    },

    getMetaskAccountID: function () {
        web3 = new Web3(App.web3Provider)

        // Retrieving accounts
        web3.eth.getAccounts(function(err, res) {
            if (err) {
                console.log('Error:',err)
                return
            }
            console.log('getMetaskID:',res)
            App.metamaskAccountID = res[0]

        })
    },

    initFlightSuretyContract: function () {
        /// Source the truffle compiled smart contracts
        var jsonAppFlightSuretyContract='../../build/contracts/FlightSuretyApp.json'
        var jsonDataFlightSuretyContract ='../../build/contracts/FlightSuretyData.json'

        /// JSONfy the smart contracts
        $.getJSON(jsonDataFlightSuretyContract, function(data) {
            console.log('data',data)
            var ContractArtifact = data
            App.contracts.DataFlightSuretyContract = TruffleContract(ContractArtifact)
            App.contracts.DataFlightSuretyContract.setProvider(App.web3Provider)
        })

        $.getJSON(jsonAppFlightSuretyContract, function(data) {
            console.log('data',data)
            var ContractArtifact = data
            App.contracts.AppFlightSuretyContract = TruffleContract(ContractArtifact)
            App.contracts.AppFlightSuretyContract.setProvider(App.web3Provider)
            App.fetchEvents()
        })
        
        return App.bindEvents()
    },

    bindEvents: function() {
        $(document).on('click', App.handleButtonClick)
        $(document).on('change', App.handleChange)
    },

    handleChange: async (event) => {
        if (event.target.id == "flights") {
            return await App.getFlightDetails()
        } else if (event.target.id == "flightsOracles") {
            return await App.getFlightDetailsForWithdraw()
        }
    },

    handleButtonClick: async (event) => {
        App.getMetaskAccountID()
        
        var processId = parseInt($(event.target).data('id'))
        console.log('processId',processId)
        
        switch (processId) {
            case 0:
                return await App.getAppContractAddress(event)
            case 1:
                return await App.getAppContractStatus(event)
            case 2:
                return await App.setAppContractStatus(false, event)
            case 3:
                return await App.setAppContractStatus(true, event)
            case 4:
                return await App.getDataContractAddress(event)
            case 5:
                return await App.getDataContractStatus(event)
            case 6:
                return await App.setDataContractStatus(false, event)
            case 7:
                return await App.setDataContractStatus(true, event)
            case 8:
                return await App.authorizeAppContract(event)
            case 9:
                return await App.registerAirline(event)
            case 10:
                return await App.fundAirline(event)
            case 11:
                return await App.addNewFlight(event)
            case 12:
                return await App.getFlights(event)
            case 13:
                return await App.buyInsurance(event)
            case 14:
                return await App.getFlightsForOracles(event) 
            case 15:
                return await App.fetchFlightStatus(event) 
            case 16:
                return await App.withdraw(event)             

        }
    },

    getAppContractAddress: async(event) => {
        event.preventDefault()
        App.contracts.AppFlightSuretyContract.deployed().then(function(instance) {
            return instance.address
        }).then(function(result) {
            $("#appAddress").val(result)
            console.log('AppContract Address:', result)
        }).catch(function(err) {
            console.log(err.message)
        })
    },

    getAppContractStatus: async (event) => {
        event.preventDefault()
        App.contracts.AppFlightSuretyContract.deployed().then(function(instance) {
            return instance.isOperational()
        }).then(function(result) {
            if (result == true) 
                $("#appContractStatus").val("App Contract is Operational")
            else 
                $("#appContractStatus").val("App Contract is Paused")
        }).catch(function(err) {
            console.log(err.message)
        })
    },

    setAppContractStatus: async (appstatus, event) => {
        event.preventDefault()
        App.contracts.AppFlightSuretyContract.deployed().then(function(instance) {
                return instance.setOperatingStatus(appstatus)
        }).then(function(result) {
            if (appstatus)
                console.log('Set AppContract Status to Operational')
            else 
                console.log('Set AppContract Status to Pause')
        }).catch(function(err) {
            console.log(err.message)
        })
    },

    getDataContractAddress: async(event) => {
        event.preventDefault()
        App.contracts.DataFlightSuretyContract.deployed().then(function(instance) {
            return instance.address
        }).then(function(result) {
            $("#dataAddress").val(result)
            console.log('DataContract Address:', result)
        }).catch(function(err) {
            console.log(err.message)
        })
    },


    getDataContractStatus: async (event) => {
        event.preventDefault()
        App.contracts.DataFlightSuretyContract.deployed().then(function(instance) {
            return instance.isOperational()
        }).then(function(result) {
            if (result == true) 
                $("#dataContractStatus").val("Data Contract is Operational")
            else 
                $("#dataContractStatus").val("Data Contract is Paused")
        }).catch(function(err) {
            console.log(err.message)
        })
    },

    setDataContractStatus: async (dataStatus, event) => {
        event.preventDefault()
        App.contracts.DataFlightSuretyContract.deployed().then(function(instance) {
                return instance.setOperatingStatus(dataStatus)
        }).then(function(result) {
            if (dataStatus)
                console.log('Set DataContract Status to Operational')
            else 
                console.log('Set DataContract Status to Pause')
        }).catch(function(err) {
            console.log(err.message)
        })
    },

    authorizeAppContract: async (event) => {
        event.preventDefault()
        const appAddress = $("#appAddress2").val()
        App.contracts.DataFlightSuretyContract.deployed().then(function(instance) {
            if(!appAddress || appAddress === '0x0000000000000000000000000000000000000000'){
                alert ('Please Get AppContract address or paste a valid address')
                return false
            }
            else {
                return instance.authorizeCaller(appAddress)
            }         
        }).then(function(result) {
            console.log(`Succeesfully authorized AppContract ${appAddress} to DataContract -> ${result}`)
            
        }).catch(function(err) {
            console.log(err.message)
        })
    },

    registerAirline: async (event) => {
        event.preventDefault()
        const airlineAddress = $("#airlineAddress").val()
        const airlineName = web3.fromAscii($("#airlineName").val())
        App.contracts.AppFlightSuretyContract.deployed().then(function(instance) {
            return instance.registerAirline(airlineAddress, airlineName, {from: App.metamaskAccountID})
            
        }).then(function(result) {
            console.log(`Airline ${airlineAddress} succeesfully registered or voted -> ${result}`)
        }).catch(function(err) {
            console.log(err.message)
        })
    },

    fundAirline: async (event) => {
        event.preventDefault()
        const fundAmount = web3.toWei($("#airlineRgestrationFee").val(), 'ether')
        App.contracts.AppFlightSuretyContract.deployed().then(function(instance) {
            return instance.fundAirline({from: App.metamaskAccountID, value: fundAmount})
            
        }).then(function(result) {
            console.log(`Airline successsfully funded -> ${result}`)
        }).catch(function(err) {
            console.log(err.message)
        })
    },

    addNewFlight: async (event) => {
        event.preventDefault()
        const flightNumber = web3.fromAscii($("#flightNumber").val())
        const flightTimestamp = Number($("#newFlightTimestamp").val())
        App.contracts.AppFlightSuretyContract.deployed().then(function(instance) {
            return  instance.addNewFlight(flightNumber, flightTimestamp, {from: App.metamaskAccountID})

        }).then(function(result) {
            console.log(`Flight successsfully added  -> ${result}`)
        }).catch(function(err) {
            alert('Please insert a flight number')
            console.log(err.message)
        })
    },

    getFlights: async (event) => {
        event.preventDefault()

        App.contracts.AppFlightSuretyContract.deployed().then(function(instance) {
            return instance.getAllFlights()
        }).then(function(result) {
            if(result && result.length > 0){
                var option = '';
                let flightToUtf8;
                result.forEach(flight => {
                    flightToUtf8 = web3.toUtf8(flight);
                    option += '<option value="'+ flightToUtf8 + '">' + flightToUtf8 + '</option>'
                })

                $("#flights").empty()
                $("#flights").append(option)
                $("#flights").val(web3.toUtf8(flights[0])).change()
                $("#flightsOracles").empty()
                $("#flightsOracles").append(option)
                $("#flightsOracles").val(web3.toUtf8(flights[0])).change()
            }
            
        }).catch(function(err) {
            console.log(err.message)
        })
     },

     getFlightsForOracles: async (event) => {
        event.preventDefault()

        App.contracts.AppFlightSuretyContract.deployed().then(function(instance) {
            return instance.getAllFlights()
        }).then(function(result) {
            if(result && result.length > 0){
                var option = '';
                let flightToUtf8;
                result.forEach(flight => {
                    flightToUtf8 = web3.toUtf8(flight);
                    option += '<option value="'+ flightToUtf8 + '">' + flightToUtf8 + '</option>'
                })

                $("#flightsOracles").empty()
                $("#flightsOracles").append(option)
                $("#flightsOracles").val(web3.toUtf8(flights[0])).change()
            }
            
        }).catch(function(err) {
            console.log(err.message)
        })
     },

     getFlightDetails: async(event) => {
        let flightNumber = $("select#flights option:selected").text()
        App.contracts.AppFlightSuretyContract.deployed().then(function(instance) {
            return instance.fetchFlightDetails(web3.fromUtf8(flightNumber))
        }).then(function(result) {
            $("#flightAirlineAddress").val(result[0]);
            console.log(result[2])
            $("#flightTimestamp").val(new Date(result[2]*1000));
            $("#flightStatus").val(result[3]);
            
        }).catch(function(err) {
            console.log(err.message)
        })
    },

    buyInsurance: async (event) => {
        event.preventDefault()
        let flightNumber = web3.fromAscii($("select#flights option:selected").text())
        let insuranceAmount = $("#insuranceAmount").val()
        let insuranceAmountInWei = web3.toWei(insuranceAmount, 'ether')
        App.contracts.AppFlightSuretyContract.deployed().then(function(instance) {
            return  instance.buyInsurance(flightNumber, {from: App.metamaskAccountID, value: insuranceAmountInWei})
        }).then(function(result) {
            console.log(`insurace successsfully bought -> ${result}`)
        }).catch(function(err) {
            alert('Please select a flight number and an insurance amount')
            console.log(err.message)
        })
    },


    getFlightDetailsForWithdraw: async(event) => {
        let flightNumber = $("select#flightsOracles option:selected").text()
        try {
            const instance = await App.contracts.AppFlightSuretyContract.deployed()
            let flightDetails = await instance.fetchFlightDetails(web3.fromUtf8(flightNumber))
            let amountToWithdraw = await instance.getPassengerBalance({from: App.metamaskAccountID})
            if (flightDetails && flightDetails.length > 0){
                $("#flightAirlineAddressOracles").val(flightDetails[0])
                $("#flightTimestampOracles").val(new Date(flightDetails[2]*1000))
                $("#flightStatusOracles").val(flightDetails[3])
                $("#amountToWithdraw").val(web3.fromWei(amountToWithdraw, 'ether'))
            } else {
                console.log(`Flight details not found for flight ${flightNumber}`)
            }
        } catch (err){
            console.log(err.message)
        }
    },

    fetchFlightStatus: async (event) => {
        event.preventDefault()
        let flightNumber = $("select#flightsOracles option:selected").text()
        try{
            const instance = await App.contracts.AppFlightSuretyContract.deployed()
            let flightDetails = await instance.fetchFlightDetails(web3.fromUtf8(flightNumber))
            let resurt = await instance.fetchFlightStatus(flightDetails[0], web3.fromAscii(flightNumber), flightDetails[2])
            console.log(`airline adsress ${flightDetails[0]}`)
            console.log(`flight ${web3.fromAscii(flightNumber)}`)
            console.log(`flight ${flightDetails[2]}`)
            console.log(`Successsfully sent the Fetch Flight Status command for flight ${flightNumber} , airline adsress ${flightDetails[0]}`)
            console.log(resurt.logs[0])

        } catch (err){
            alert('Please select a flight number in order to fetch its status')
            console.log(err.message)
        }
    },

    withdraw: async (event) => {


        event.preventDefault()
        let amountToWithdraw = $("#amountToWithdraw").val();
        
        App.contracts.AppFlightSuretyContract.deployed().then(function(instance) {
            if (amountToWithdraw && Number(amountToWithdraw) > 0)
                return  instance.withdraw(web3.toWei(amountToWithdraw, 'ether'))
            else 
                return false

        }).then(function(result) {
            if (result)
                console.log(`Amount successfully withdrawn -> ${result}`)
            else 
                alert('Please input an amount to withdraw')
        }).catch(function(err) {
            console.log(err.message)
        })
    },

    fetchEvents: async () => {
        if (typeof App.contracts.AppFlightSuretyContract.currentProvider.sendAsync !== "function") {
            App.contracts.AppFlightSuretyContract.currentProvider.sendAsync = function () {
                return App.contracts.AppFlightSuretyContract.currentProvider.send.apply(
                    App.contracts.AppFlightSuretyContract.currentProvider, 
                    arguments)
            }
        }
        
        App.contracts.AppFlightSuretyContract.deployed().then(function(instance) {
            var events = instance.allEvents(function(err, log){
                if (!err)
                $("#ftc-events").append('<li>' + log.event + ' - ' + log.transactionHash + '</li>')
            })
        }).catch(function(err) {
            console.log(err.message)
        })
    }

}

$(function () {
    $(window).load(function () {
        App.init()
    })
})