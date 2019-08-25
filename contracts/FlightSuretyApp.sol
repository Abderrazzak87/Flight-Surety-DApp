pragma solidity >=0.4.24;

// It's important to avoid vulnerabilities due to numeric overflow bugs
// OpenZeppelin's SafeMath library, when used correctly, protects agains such bugs
// More info: https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2018/november/smart-contract-insecurity-bad-arithmetic/

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

/************************************************** */
/* FlightSurety Smart Contract                      */
/************************************************** */
contract FlightSuretyApp {

    FlightSuretyData dataContract;              // Filght Surety Data contract
    address payable private dataContractAddress;
    using SafeMath for uint256;                 // Allow SafeMath functions to be called for all uint256 types (similar to "prototype" in Javascript)
    using SafeMath for uint8;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    // Flight status codees
    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_ON_TIME = 10;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
    uint8 private constant STATUS_CODE_LATE_WEATHER = 30;
    uint8 private constant STATUS_CODE_LATE_TECHNICAL = 40;
    uint8 private constant STATUS_CODE_LATE_OTHER = 50;

    uint8 private CONSENSUS_START = 4;                        // the consensus algorithm starts aftre 4 airlin registration
    uint256 private CONSENSUS_ACHIEVEMENT = 50;                 // 50% vote are needed to validate a new airline registration
    uint256 private REGISTRATION_FEE_AIRLINES = 10 ether;
    uint256 private INSURANCE_PRICE =  1 ether;
    uint256 private INSURANCE_PAYBACK_MULTIPLIER = 150;

    address private contractOwner;                              // Account used to deploy contract
    bool private operational = true;                            // Blocks all state changes throughout the contract if false

    mapping(address => address[]) voteMultiCaller;              //mapping airlineAddress to add => address[] voters



    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/

    event AirLineRegistrated(address _airlineAddress);
    event ContractFunded(uint256 _fundAmount, address _airlineAddress);
    event NewFlightAdded(address _airlineAddress, bytes32 _flightNumber, uint256 _timestamp, uint8 _status);
    event InsurancePurchased(bytes32 _flightKey, address _passengerAddress, uint256 _amount);
    event PassengerPaid(address _passenger, uint256 _amount);
    event AirlineVoted(address _airlineAddress, uint256 voteNumber);


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
    modifier requireContractOwner()
    {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    modifier requireMinimumAmount(){
        require(msg.value >= REGISTRATION_FEE_AIRLINES, 'Minimum registration fee is required');
        _;
    }

    modifier requireIsRegistered {
        bool isRegistered;
        (isRegistered,,,) = dataContract.fetchAirlineDetails(msg.sender);
        require(isRegistered == true, 'Caller is not registred');
        _;
    }

    modifier requireIsAuthorized {
        bool isAuthorized;
        (,isAuthorized,,) = dataContract.fetchAirlineDetails(msg.sender);
        require(isAuthorized == true, 'Caller is not autorised, you have to fund first');
        _;
    }

    /**
    * @dev Modifier that requires the flight does not exist to be added
    */
    modifier requireFlightNotExists(address _airlineAddress, bytes32 _flightNumber, uint256 _timestamp) {
        address airline;
        (airline,,,,) = dataContract.fetchFlightDetails(_flightNumber);
        require(airline != _airlineAddress, 'Flight already registered');
        _;
    }


    /**
    * @dev Modifier that requires the flight exists
    */
    modifier requireFlightExists(bytes32 _flightNumber) {
        address airline;
        (airline,,,,) = dataContract.fetchFlightDetails(_flightNumber);
        require(airline != address(0), 'Flight does not exist');
        _;
    }

    /**
    * @dev Modifier that requires the insurance does not exist to be purshaced.
    */
    modifier requireNotInsured(address _passengerAddress, bytes32 _flightNumber) {
        bytes32 flightKey;
        address passenger = address(0);
        (,,,,flightKey) = dataContract.fetchFlightDetails(_flightNumber);
        (passenger,,) = dataContract.fetchInsuranceDetails(flightKey, _passengerAddress);
        require(passenger == address(0), 'Insurrance already exists for this flight');
        _;
    }

    /********************************************************************************************/
    /*                                       CONSTRUCTOR                                        */
    /********************************************************************************************/

    /**
    * @dev Contract constructor
    *
    */
    constructor(address payable _dataContractAddress) public {
        contractOwner = msg.sender;
        dataContract = FlightSuretyData(_dataContractAddress);
        dataContractAddress = _dataContractAddress;
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
     */
    function registerAirline(address _airlineAddress, bytes32 _airLineName) external
    requireIsOperational
    requireIsRegistered
    {
        // Get the number of registred airline from the contract data
        uint256 airlinesNumber = dataContract.getAirlinesNumber();

        // Register a new airline if the number of airlines already registred is under 4
        if (CONSENSUS_START > airlinesNumber) {
            dataContract.registerAirline(_airlineAddress, _airLineName);
            emit AirLineRegistrated(_airlineAddress);
        }
        // Multi-party consensus : 50% of the airlines regitered have to accept a new registration
        else {
            // duplicate vote verification
            bool duplicateVote = false;
            for (uint i = 0; i < voteMultiCaller[_airlineAddress].length; i++)
            {
                if (voteMultiCaller[_airlineAddress][i] == msg.sender){
                    duplicateVote = true;
                    break;
                }
            }

            if(!duplicateVote){
                voteMultiCaller[_airlineAddress].push(msg.sender);
                //emit AirlineVoted(msg.sender, voteMultiCaller[_airlineAddress].length);
            }

            // Verify consensus achievement : 50% vote needed  to register a new airline
            if ( (voteMultiCaller[_airlineAddress].length.mul(100)).div(airlinesNumber) >= CONSENSUS_ACHIEVEMENT)
            {
                dataContract.registerAirline(_airlineAddress, _airLineName);
                emit AirLineRegistrated(_airlineAddress);
            }
        }
    }


    /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */
    function fundAirline() public payable
    requireIsOperational
    requireIsRegistered
    requireMinimumAmount
    {
        //address payable dataContractAddress = address(uint160(dataContract));
        dataContractAddress.transfer(msg.value);
        dataContract.fund(msg.value, msg.sender);
        emit ContractFunded(msg.value, msg.sender);

    }

    /**
     * @dev Register a new flight.
     */
    function addNewFlight(bytes32 _flightNumber, uint256 _timestamp) external
    requireIsOperational
    requireIsRegistered
    requireIsAuthorized
    requireFlightNotExists(msg.sender, _flightNumber, _timestamp)
    {
        dataContract.addNewFlight(msg.sender, _flightNumber, _timestamp, STATUS_CODE_UNKNOWN);
        emit NewFlightAdded(msg.sender, _flightNumber, _timestamp, STATUS_CODE_UNKNOWN);
    }

    /**
     * @dev passenger buy insurance function
     */
    function buyInsurance(bytes32 _flightNumber) external payable
    requireIsOperational
    requireFlightExists(_flightNumber)
    requireNotInsured(msg.sender, _flightNumber)
    {
        //send the money and buy insurance and top up the airline balance
        require(msg.value <= INSURANCE_PRICE, 'Exceeded insurance price allowed');
        bytes32 flightKey;
        (,,,,flightKey) = dataContract.fetchFlightDetails(_flightNumber);
        //address payable dataContractAddress = address(uint160(address(dataContract)));
        dataContractAddress.transfer(msg.value);
        dataContract.buy(flightKey, msg.sender, msg.value);
        emit InsurancePurchased(_flightNumber, msg.sender, msg.value);
    }

    /**
     *  @dev returns the number of the airlines registred to the contract
     *
    */
    function getAirlinesNumber() external view requireIsOperational returns(uint256)
    {
        return dataContract.getAirlinesNumber();
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
        (isRegistered, isAutorised, name, balance) = dataContract.fetchAirlineDetails(_airlineAddress);
        return (isRegistered, isAutorised, name, balance);
    }

    /**
     *  @dev fetch Flight details
     *  @param _flightNumber the flught number to fetch
     *
    */
    function fetchFlightDetails(bytes32 _flightNumber) external view requireIsOperational returns
    (
        address airline,
        bytes32 flightNumber,
        uint256 timestamp,
        uint8 statusCode
    )
    {
        (airline, flightNumber, timestamp, statusCode,) = dataContract.fetchFlightDetails(_flightNumber);
        return (airline, flightNumber, timestamp, statusCode);
    }

    function generateKey(address _airlineAddress, bytes32 _flight, uint256 _timestamp)  internal pure returns(bytes32) {
        return keccak256(abi.encodePacked(_airlineAddress, _flight, _timestamp));
    }
   /**
    * @dev Called after oracle has updated flight status
    *
    */

    function processFlightStatus(bytes32 oracleRequestKey, address _airline, bytes32 _flightNumber, uint256 _timestamp, uint8 _statusCode) private
    requireIsOperational
    requireIsAuthorized
    {
        if(_statusCode == STATUS_CODE_LATE_AIRLINE){
            bytes32 flightKey = generateKey(_airline, _flightNumber, _timestamp);
            dataContract.creditInsurees(flightKey, INSURANCE_PAYBACK_MULTIPLIER);
            dataContract.setFlightStatus(flightKey, STATUS_CODE_LATE_AIRLINE);
            oracleResponses[oracleRequestKey].isOpen = false;
        }
    }

    /**
    * @dev Called after oracle has updated flight status
    *
    */
    // Generate a request for oracles to fetch flight information
    function fetchFlightStatus(address _airline, bytes32 _flightNumber, uint256 _timestamp) external
    {
        uint8 index = getRandomIndex(msg.sender);

        // Generate a unique key for storing the request
        bytes32 key = keccak256(abi.encodePacked(index, _airline, _flightNumber, _timestamp));
        oracleResponses[key] = ResponseInfo({
                                                requester: msg.sender,
                                                isOpen: true
                                            });

        emit OracleRequest(index, _airline, _flightNumber, _timestamp);
    }


// region ORACLE MANAGEMENT

    // Incremented to add pseudo-randomness at various points
    uint8 private nonce = 0;

    // Fee to be paid when registering oracle
    uint256 public constant REGISTRATION_FEE = 1 ether;

    // Number of oracles that must respond for valid status
    uint256 private constant MIN_RESPONSES = 3;


    struct Oracle {
        bool isRegistered;
        uint8[3] indexes;
    }
    // Track all registered oracles
    mapping(address => Oracle) private oracles;

    // Model for responses from oracles
    struct ResponseInfo {
        address requester;                              // Account that requested status
        bool isOpen;                                    // If open, oracle responses are accepted
        mapping(uint8 => address[]) responses;          // Mapping key is the status code reported
                                                        // This lets us group responses and identify
                                                        // the response that majority of the oracles
    }

    // Track all oracle responses
    // Key = hash(index, flight, timestamp)
    mapping(bytes32 => ResponseInfo) private oracleResponses;

    // Event fired each time an oracle submits a response
    event FlightStatusInfo(address airline, bytes32 flight, uint256 timestamp, uint8 status);

    event OracleReport(address airline, bytes32 flight, uint256 timestamp, uint8 status);

    // Event fired when flight status request is submitted
    // Oracles track this and if they have a matching index
    // they fetch data and submit a response
    event OracleRequest(uint8 index, address airline, bytes32 flight, uint256 timestamp);


    // Register an oracle with the contract
    function registerOracle
                            (
                            )
                            external
                            payable
    {
        // Require registration fee
        require(msg.value >= REGISTRATION_FEE, "Registration fee is required");

        uint8[3] memory indexes = generateIndexes(msg.sender);

        oracles[msg.sender] = Oracle({
                                        isRegistered: true,
                                        indexes: indexes
                                    });
    }

    function getMyIndexes
                            (
                            )
                            view
                            external
                            returns(uint8[3] memory)
    {
        require(oracles[msg.sender].isRegistered, "Not registered as an oracle");

        return oracles[msg.sender].indexes;
    }




    // Called by oracle when a response is available to an outstanding request
    // For the response to be accepted, there must be a pending request that is open
    // and matches one of the three Indexes randomly assigned to the oracle at the
    // time of registration (i.e. uninvited oracles are not welcome)
    function submitOracleResponse
                        (
                            uint8 index,
                            address airline,
                            bytes32 flight,
                            uint256 timestamp,
                            uint8 statusCode
                        )
                        external
    {
        require((oracles[msg.sender].indexes[0] == index) || (oracles[msg.sender].indexes[1] == index) || (oracles[msg.sender].indexes[2] == index), "Index does not match oracle request");


        bytes32 key = keccak256(abi.encodePacked(index, airline, flight, timestamp)); 
        require(oracleResponses[key].isOpen, "Flight or timestamp do not match oracle request");

        oracleResponses[key].responses[statusCode].push(msg.sender);

        // Information isn't considered verified until at least MIN_RESPONSES
        // oracles respond with the *** same *** information
        emit OracleReport(airline, flight, timestamp, statusCode);
        if (oracleResponses[key].responses[statusCode].length >= MIN_RESPONSES) {

            emit FlightStatusInfo(airline, flight, timestamp, statusCode);

            // Handle flight status as appropriate
            processFlightStatus(key, airline, flight, timestamp, statusCode);
        }
    }


    function getFlightKey
                        (
                            address airline,
                            bytes32 flight,
                            uint256 timestamp
                        )
                        pure
                        internal
                        returns(bytes32) 
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    // Returns array of three non-duplicating integers from 0-9
    function generateIndexes(address account) internal returns(uint8[3] memory)
    {
        uint8[3] memory indexes;
        indexes[0] = getRandomIndex(account);
        
        indexes[1] = indexes[0];
        while(indexes[1] == indexes[0]) {
            indexes[1] = getRandomIndex(account);
        }

        indexes[2] = indexes[1];
        while((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
            indexes[2] = getRandomIndex(account);
        }

        return indexes;
    }

    // Returns array of three non-duplicating integers from 0-9
    function getRandomIndex
                            (
                                address account
                            )
                            internal
                            returns (uint8)
    {
        uint8 maxValue = 10;

        // Pseudo random number...the incrementing nonce adds variation
        uint8 random = uint8(uint256(keccak256(abi.encodePacked(blockhash(block.number - nonce++), account))) % maxValue);

        if (nonce > 250) {
            nonce = 0;  // Can only fetch blockhashes for last 256 blocks so we adapt
        }

        return random;
    }

// endregion



}

contract FlightSuretyData {
    function getAirlinesNumber() external view  returns(uint256);
    function registerAirline(address _airLineAddress, bytes32 _airLineName) external;
    function fund(uint256 _fundAmount, address _airlineAddress) public payable;
    function addNewFlight(address _airlineAddress, bytes32 _flightNumber, uint256 _timestamp, uint8 _status) external;
    function buy(bytes32 _flightKey, address _passengerAddress, uint256 _amount) external payable;
    function fetchFlightDetails(bytes32 _flightNumber) external view returns (
    address airline,
    bytes32 flightNumber,
    uint256 timestamp,
    uint8 statusCode,
    bytes32 flightKey
    );
    //function generateKey(address _airlineAddress, bytes32 _flight, uint256 _timestamp)  internal pure returns(bytes32);
    function creditInsurees(bytes32 _flightKey, uint256 _multiplier) external;
    function setFlightStatus(bytes32 _flightKey, uint8 _statusCode) external;
    function fetchAirlineDetails(address _airlineAddress) external view  returns
    (   bool isRegistered,
        bool isAutorised,
        bytes32 name,
        uint256 balance
    );
    function fetchInsuranceDetails(bytes32 _flightKey, address _passengerAddress) external view
    returns
    (
        address passenger,
        uint256 value,
        bool paid
    );

}
