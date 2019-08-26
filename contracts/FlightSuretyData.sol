pragma solidity >=0.4.24;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;
    using SafeMath for uint8;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner;                                      // Account used to deploy contract
    bool private operational = true;                                    // Blocks all state changes throughout the contract if false
    uint256 contractBalance = 0;                                        // stors the contract balance

    struct Airline {
        bool isRegistered;
        bool isAutorised;
        bytes32 name;
        uint256 balance;
    }

    mapping (address => bool) authorizedCaller;                  // list of address authorize to call the contract Data
    mapping (address => Airline) private registeredAirlines;    // airlines registred to the contract
    uint256 private airlinesCounter = 0;                            // stors the number of registered airlines


    struct Flight {
        address airline;
        bytes32 flightNumber;
        uint256 timestamp;
        uint8 statusCode;
    }

    bytes32[] private flightKeys;                               // liste of flight keys created in this contract
    mapping (bytes32 => Flight) private flights;                // flight key => Flight details  mapping

    struct Insurance {
        address passenger;
        uint256 value;
        bool paid;
    }

    mapping (bytes32 => bytes32[]) private flightInsurances;    // flight key => insurance keys related to the flight
    mapping (bytes32 => Insurance) private insurances;          // insurance Key =>  Insurance details mapping
    mapping (address => uint256) private passengerBalances;     // balance for each insured passenger

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/

    event AirLineRegistrated(address _airlineAddress);
    event ContractFunded(uint256 _fundAmount, address _airlineAddress);
    event NewFlightAdded(address _airlineAddress, bytes32 _flightNumber, uint256 _timestamp, uint8 _status);
    event InsurancePurchased(bytes32 _flightKey, address _passengerAddress, uint256 _amount);
    event PassengerPaid(address _passenger, uint256 _amount);

    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor (bytes32 _firstAirlineNmae) public {
        contractOwner = msg.sender;
        registeredAirlines[msg.sender] = Airline({
                                                    isRegistered : true,
                                                    isAutorised: false,
                                                    name: _firstAirlineNmae,
                                                    balance : 0
                                                });
        airlinesCounter = airlinesCounter.add(1);

    }

    /**
    * @dev fall back function
    *     
    */
    function () external payable {

    }


    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational() {
        require(operational, "Contract is currently not operational");
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner() {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }
    /**
    * @dev Modifier that requires the function caller to be registerated to be able te register a new airline
    */
    modifier requireIsRegistered() {
        require(registeredAirlines[msg.sender].isRegistered || authorizedCaller[msg.sender], "Caller is not registred");
        _;
    }
    /**
    * @dev Modifier that requires the airline is not already registered
    */
    modifier requireIsNotRegistered(address _airlineAddress)
    {
        require(!registeredAirlines[_airlineAddress].isRegistered, "Airline is already registered");
        _;
    }
    /**
    * @dev Modifier that requires the function caller to be autorised to be able te participate in the smart contract
    */
    modifier requireIsAuthorized()
    {
        require(registeredAirlines[msg.sender].isAutorised || authorizedCaller[msg.sender], "Caller is not autorised, you have to fund first");
        _;
    }

    /**
    * @dev Modifier that requires the flight does not exist to be added
    */
    modifier requireFlightNotExists(address _airlineAddress, bytes32 _flightNumber, uint256 _timestamp) {
        bytes32 key = generateKey(_airlineAddress, _flightNumber, _timestamp);
        require(flights[key].airline == address(0), 'Flight already registered');
        _;
    }

    /**
    * @dev Modifier that requires the flight exists
    */
    modifier requireFlightExists(bytes32 _flightKey) {
        require(flights[_flightKey].airline != address(0), 'Flight does not exist');
        _;
    }

    /**
    * @dev Modifier that requires the insurance does not exist to be purshaced.
    */
    modifier requireNotInsured(address _passengerAddress, bytes32 _flightKey) {
        bytes32 insuranceKey = generateKey(_passengerAddress, _flightKey, 0);
        require(insurances[insuranceKey].passenger == address(0), 'Insurrance already exists for this flight');
        _;
    }


    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */
    function isOperational() public view returns(bool) {
        return operational;
    }


    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */
    function setOperatingStatus (bool _mode) external
    requireContractOwner
    {
        operational = _mode;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

   /**
    * @dev Add an airline to the registration queue
    *      Can only be called from FlightSuretyApp contract
    *
    */
    function registerAirline(address _airlineAddress, bytes32 _airlineName) external
    requireIsOperational
    requireIsNotRegistered(_airlineAddress)
    requireIsRegistered
    {
        require(_airlineAddress != address(0), 'The airline Address is not valid');
        registeredAirlines[_airlineAddress] = Airline({
                                                        isRegistered : true,
                                                        isAutorised: false,
                                                        name: _airlineName,
                                                        balance : 0
                                                    });
        airlinesCounter = airlinesCounter.add(1);
        emit AirLineRegistrated(_airlineAddress);
    }

    /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */
    function fund(uint256 _fundAmount, address _airlineAddress) public payable
    requireIsOperational
    requireIsRegistered
    {
        registeredAirlines[_airlineAddress].balance = registeredAirlines[_airlineAddress].balance.add(_fundAmount);
        registeredAirlines[_airlineAddress].isAutorised = true;
        //address payable contractAddress = address(uint160(address(this)));
        //contractAddress.transfer(_fundAmount);
        contractBalance = contractBalance.add(_fundAmount);
        emit ContractFunded(_fundAmount, _airlineAddress);
    }

    /**
    * @dev add new flight by an airline
    *
    */
    function addNewFlight(address _airlineAddress, bytes32 _flightNumber, uint256 _timestamp, uint8 _status) external
    requireIsOperational
    requireIsRegistered
    requireIsAuthorized
    requireFlightNotExists(_airlineAddress, _flightNumber, _timestamp)
    {
        bytes32 key = generateKey(_airlineAddress, _flightNumber, _timestamp);
        flights[key] = Flight({
                                    airline: _airlineAddress,
                                    flightNumber: _flightNumber,
                                    timestamp: _timestamp,
                                    statusCode: _status
                                    });
        flightKeys.push(key);
        emit NewFlightAdded(_airlineAddress, _flightNumber, _timestamp, _status);
    }


   /**
    * @dev Buy insurance for a flight
    *
    */
    function buy(bytes32 _flightKey, address _passengerAddress, uint256 _amount) external payable
    requireIsOperational
    requireIsAuthorized
    requireFlightExists(_flightKey)
    requireNotInsured(_passengerAddress, _flightKey)
    {
        bytes32 insuranceKey = generateKey(_passengerAddress, _flightKey, 0);
        insurances[insuranceKey] = Insurance(_passengerAddress, _amount, false);
        flightInsurances[_flightKey].push(insuranceKey);
        registeredAirlines[flights[_flightKey].airline].balance = registeredAirlines[flights[_flightKey].airline].balance.add(_amount);
        //address(this).transfer(_amount);
        contractBalance = contractBalance.add(_amount);
        emit InsurancePurchased(_flightKey, _passengerAddress, _amount);
    }

    /**
     * @dev credits all ensurees for the given flight (flight key)
     *
     */
    function creditInsurees(bytes32 _flightKey, uint256 _multiplier) external
    requireIsOperational
    requireIsAuthorized
    {
        address airlineAddress = flights[_flightKey].airline;
        for (uint i = 0; i < flightInsurances[_flightKey].length; i++)
        {
            Insurance storage insurance = insurances[flightInsurances[_flightKey][i]];
            if (insurance.paid == false) {
                uint256 amount = insurance.value.mul(_multiplier).div(100);
                creditInsuree(insurance, amount);
                registeredAirlines[airlineAddress].balance = registeredAirlines[airlineAddress].balance.sub(amount);
            }
        }
    }

    /**
     *  @dev Credits payouts to insuree
     *
    */
    function creditInsuree (Insurance storage _insurance, uint256 _amount) private
    requireIsOperational
    requireIsAuthorized
    {
        require (!_insurance.paid, "This insurance has already been paid");
        passengerBalances[_insurance.passenger] = passengerBalances[_insurance.passenger].add(_amount);
        _insurance.paid = true;
    }


    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function pay(address _passenger, uint256 _amount) external payable
    requireIsOperational
    requireIsAuthorized
    {
        require(contractBalance >= _amount, "The contract balance is not sufficient to pay the insured passenger");
        require(passengerBalances[_passenger] >= _amount, "The desired amount exceedes the amount owed by the passenger");
        address payable payablePassengerAddress = address(uint160(_passenger));
        uint256 passengerCurrentBalance = passengerBalances[_passenger];
        uint256 newBalance = passengerCurrentBalance.sub(_amount);
        passengerBalances[_passenger] = newBalance;
        payablePassengerAddress.transfer(_amount);
        contractBalance = contractBalance.sub(_amount);
        emit PassengerPaid(_passenger, _amount);
    }

    /**
     *  @dev Update the flight status
     *
    */
    function setFlightStatus(bytes32 _flightKey, uint8 _statusCode) external
    requireIsOperational
    requireIsAuthorized
    {
        flights[_flightKey].statusCode = _statusCode;
    }

    /**
     *  @dev returns the number of the airlines registred to the contract
     *
    */
    function getAirlinesNumber() external view requireIsOperational returns(uint256)
    {
        return airlinesCounter;
    }

    /**
     *  @dev returns the number of the airlines registred to the contract
     *
    */
    function getContractBalance() external view requireIsOperational requireContractOwner returns(uint256)
    {
        return contractBalance;
    }

    /**
     *  @dev returns the passenger balance if exists
     *
    */
    function getPassengerBalance(address _passengerAddress) external view requireIsOperational returns(uint256)
    {
        return passengerBalances[_passengerAddress];
    }

    /**
     * @dev Authorize one address contract to use all this contract's methonds
     * @param _callerAddress The new authorized contract's address
     */
    function authorizeCaller(address _callerAddress) external
    requireIsOperational
    requireContractOwner
    {
        authorizedCaller[_callerAddress] = true;
    }


    function generateKey(address _airlineAddress, bytes32 _flight, uint256 _timestamp)  internal pure returns(bytes32) {
        return keccak256(abi.encodePacked(_airlineAddress, _flight, _timestamp));
    }
    /**
     *  @dev fetch Flight details
     *
    */
    function fetchFlightDetails(bytes32 _flightNumber) external view requireIsOperational returns (
    address airline,
    bytes32 flightNumber,
    uint256 timestamp,
    uint8 statusCode,
    bytes32 flightKey
    )
    {
        Flight storage flight = flights[bytes32(0)];
        flightKey = bytes32(0);
        for (uint8 i = 0; i < flightKeys.length; i++){
            if(flights[flightKeys[i]].flightNumber == _flightNumber){
                flight = flights[flightKeys[i]];
                flightKey = flightKeys[i];
                break;
            }
        }
        airline = flight.airline;
        flightNumber = flight.flightNumber;
        timestamp = flight.timestamp;
        statusCode = flight.statusCode;

        return (
            airline,
            flightNumber,
            timestamp,
            statusCode,
            flightKey)
            ;
    }

    /**
     *  @dev fetch Airline details
     *  @param _airlineAddress the airline address to fetch
     *
    */
    function fetchAirlineDetails(address _airlineAddress) external view requireIsOperational returns
    (   bool isRegistered,
        bool isAutorised,
        bytes32 name,
        uint256 balance
    )
    {
        Airline storage airline = registeredAirlines[_airlineAddress];
        isRegistered = airline.isRegistered;
        isAutorised = airline.isAutorised;
        name = airline.name;
        balance = airline.balance;

        return (isRegistered, isAutorised, name, balance);
    }

    /**
     *  @dev fetch Insuree details
     *
    */
    function fetchInsuranceDetails(bytes32 _flightKey, address _passengerAddress) external view
    requireIsOperational
    returns
    (
        address passenger,
        uint256 value,
        bool paid
    )
    {
        Insurance storage insurance = insurances[bytes32(0)];

        for (uint i = 0; i < flightInsurances[_flightKey].length; i++)
        {
            insurance = insurances[flightInsurances[_flightKey][i]];
            if (insurance.passenger == _passengerAddress){
                insurance = insurances[flightInsurances[_flightKey][i]];
                break;
            }
        }
        passenger = insurance.passenger;
        value = insurance.value;
        paid = insurance.paid;

        return (passenger, value, paid);
    }
}