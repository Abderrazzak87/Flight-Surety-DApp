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

    mapping (address => Airline) private registeredAirlines;    // airlines registred to the contract
    uint256 private airLinesCounter;                            // stors the number of registered airlines

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


    uint256 public constant REGISTRATION_FEE_AIRLINES = 10 ether;
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
        airLinesCounter = airLinesCounter.add(1);

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
        require(registeredAirlines[msg.sender].isRegistered, "Caller is not regeitred");
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
        require(!registeredAirlines[msg.sender].isAutorised, "Caller is not autorised, you have to fund first");
        _;
    }


    modifier requireMinimumAmount(){
        require(msg.value >= REGISTRATION_FEE_AIRLINES, 'Minimum registratiob fee is required');
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
    function setOperatingStatus (bool mode) external
    requireContractOwner
    {
        operational = mode;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

   /**
    * @dev Add an airline to the registration queue
    *      Can only be called from FlightSuretyApp contract
    *
    */
    function registerAirline(address _airLineAddress, bytes32 _airLineName) external
    requireIsOperational
    requireIsNotRegistered(_airLineAddress)
    requireIsRegistered
    {
        require(_airLineAddress != address(0), 'The airline Address is not valid');
        registeredAirlines[_airLineAddress] = Airline({
                                                        isRegistered : true,
                                                        isAutorised: false,
                                                        name: _airLineName,
                                                        balance : 0
                                                    });
        airLinesCounter = airLinesCounter.add(1);
    }

    /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */
    function fund(uint256 _fundAmount, address _airlineAddress) public payable
    requireIsOperational
    requireIsRegistered
    requireMinimumAmount
    {
        registeredAirlines[_airlineAddress].balance = registeredAirlines[_airlineAddress].balance.add(_fundAmount);
        registeredAirlines[_airlineAddress].isAutorised = true;
        contractBalance = contractBalance.add(_fundAmount);
        emit ContractFunded(_fundAmount, _airlineAddress);
    }

    function addNewFlight(address _airlineAddress, bytes32 _flightNumber, uint256 _timestamp, uint8 _status) external
    requireIsOperational
    requireIsAuthorized
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
    {
        bytes32 insuranceKey = generateKey(_passengerAddress, _flightKey, 0);
        insurances[insuranceKey] = Insurance(_passengerAddress, _amount, false);
        flightInsurances[_flightKey].push(insuranceKey);
        registeredAirlines[flights[_flightKey].airline].balance = registeredAirlines[flights[_flightKey].airline].balance.add(_amount);
        contractBalance = contractBalance.add(_amount);
        emit InsurancePurchased(_flightKey, _passengerAddress, _amount);
    }

    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsurees (Insurance storage _insurance, uint256 _amount) private
    requireIsOperational
    requireIsAuthorized
    {
        passengerBalances[_insurance.passenger] = passengerBalances[_insurance.passenger].add(_amount).add(_insurance.value);
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
        require(address(this).balance >= _amount, "The contract balance is not sufficient to pay the insured passenger");
        require(passengerBalances[_passenger] >= _amount, "The desired amount exceedes the amount owed by the passenger");
        //address payable payablePassengerAddress = address(uint160(_passenger));
        uint256 passengerCurrentBalance = passengerBalances[_passenger];
        uint256 newBalance = passengerCurrentBalance.sub(_amount);
        passengerBalances[_passenger] = newBalance;
        _passenger.transfer(_amount);
        contractBalance = contractBalance.sub(_amount);
        emit PassengerPaid(_passenger, _amount);
    }



    function generateKey(address _airlineAddress, bytes32 _flight, uint256 _timestamp)  internal pure returns(bytes32) {
        return keccak256(abi.encodePacked(_airlineAddress, _flight, _timestamp));
    }
}
