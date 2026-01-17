// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title TicketEngine
 * @notice MVP ticket allocation engine - first-come-first-served with 1 ticket per user limit
 * @dev Now implements ERC721 for NFT tickets viewable in wallets
 */
contract TicketEngine is ReentrancyGuard, ERC721 {
    using Strings for uint256;
    // ============ Enums ============
    enum EventStatus { NotStarted, InProgress, SoldOut }
    enum AttemptResult { Success, AlreadyOwnsTicket, SoldOut, NotStarted }

    // ============ Structs ============
    struct Event {
        uint256 id;
        string title;
        uint256 startTime;
        uint256 totalTickets;
        uint256 remainingTickets;
        address organizer;
        bool exists;
    }

    struct Ticket {
        uint256 id;
        uint256 eventId;
        address owner;
        uint256 acquiredAt;
    }

    struct Attempt {
        uint256 eventId;
        address participant;
        uint256 timestamp;
        AttemptResult result;
    }

    // ============ State Variables ============
    uint256 public nextEventId = 1;
    uint256 public nextTicketId = 1;

    // eventId => Event
    mapping(uint256 => Event) public events;

    // ticketId => Ticket
    mapping(uint256 => Ticket) public tickets;

    // eventId => participant => hasTicket
    mapping(uint256 => mapping(address => bool)) public hasTicketForEvent;

    // eventId => participant => ticketId
    mapping(uint256 => mapping(address => uint256)) public userTicketForEvent;

    // eventId => ticketIds[]
    mapping(uint256 => uint256[]) public eventTickets;

    // user => eventIds they have tickets for
    mapping(address => uint256[]) public userEvents;

    // user => attempts
    mapping(address => Attempt[]) public userAttempts;

    // all event IDs for listing
    uint256[] public allEventIds;

    // ============ Constructor ============
    constructor() ERC721("TicketEngine", "TICKET") {}

    // ============ Events ============
    event EventCreated(
        uint256 indexed eventId,
        string title,
        uint256 startTime,
        uint256 totalTickets,
        address indexed organizer
    );

    event TicketGrabbed(
        uint256 indexed eventId,
        uint256 indexed ticketId,
        address indexed participant,
        uint256 remainingTickets
    );

    event AttemptRecorded(
        uint256 indexed eventId,
        address indexed participant,
        AttemptResult result,
        uint256 timestamp
    );

    event EventSoldOut(uint256 indexed eventId);

    // ============ External Functions ============

    /**
     * @notice Create a new ticket event
     * @param _title Event title
     * @param _startTime Unix timestamp when grabbing starts
     * @param _totalTickets Total number of tickets available
     */
    function createEvent(
        string calldata _title,
        uint256 _startTime,
        uint256 _totalTickets
    ) external returns (uint256 eventId) {
        require(bytes(_title).length > 0, "Title cannot be empty");
        require(_totalTickets > 0, "Must have at least 1 ticket");
        require(_startTime > block.timestamp, "Start time must be in future");

        eventId = nextEventId++;

        events[eventId] = Event({
            id: eventId,
            title: _title,
            startTime: _startTime,
            totalTickets: _totalTickets,
            remainingTickets: _totalTickets,
            organizer: msg.sender,
            exists: true
        });

        allEventIds.push(eventId);

        emit EventCreated(eventId, _title, _startTime, _totalTickets, msg.sender);
    }

    /**
     * @notice Attempt to grab a ticket for an event
     * @param _eventId The event to grab a ticket for
     * @return success Whether the grab was successful
     * @return result The result of the attempt
     * @return ticketId The ticket ID if successful (0 if failed)
     */
    function grabTicket(uint256 _eventId)
        external
        nonReentrant
        returns (bool success, AttemptResult result, uint256 ticketId)
    {
        Event storage evt = events[_eventId];
        require(evt.exists, "Event does not exist");

        if (block.timestamp < evt.startTime) {
            result = AttemptResult.NotStarted;
            _recordAttempt(_eventId, result);
            return (false, result, 0);
        }

        if (hasTicketForEvent[_eventId][msg.sender]) {
            result = AttemptResult.AlreadyOwnsTicket;
            _recordAttempt(_eventId, result);
            return (false, result, 0);
        }

        if (evt.remainingTickets == 0) {
            result = AttemptResult.SoldOut;
            _recordAttempt(_eventId, result);
            return (false, result, 0);
        }

        ticketId = nextTicketId++;
        evt.remainingTickets--;

        tickets[ticketId] = Ticket({
            id: ticketId,
            eventId: _eventId,
            owner: msg.sender,
            acquiredAt: block.timestamp
        });

        hasTicketForEvent[_eventId][msg.sender] = true;
        userTicketForEvent[_eventId][msg.sender] = ticketId;
        eventTickets[_eventId].push(ticketId);
        userEvents[msg.sender].push(_eventId);

        // Mint NFT to the ticket owner
        _mint(msg.sender, ticketId);

        result = AttemptResult.Success;
        _recordAttempt(_eventId, result);

        emit TicketGrabbed(_eventId, ticketId, msg.sender, evt.remainingTickets);

        if (evt.remainingTickets == 0) {
            emit EventSoldOut(_eventId);
        }

        return (true, result, ticketId);
    }

    // ============ Internal Functions ============

    function _recordAttempt(uint256 _eventId, AttemptResult _result) internal {
        Attempt memory attempt = Attempt({
            eventId: _eventId,
            participant: msg.sender,
            timestamp: block.timestamp,
            result: _result
        });
        userAttempts[msg.sender].push(attempt);
        emit AttemptRecorded(_eventId, msg.sender, _result, block.timestamp);
    }

    // ============ View Functions ============

    function getEventStatus(uint256 _eventId) public view returns (EventStatus) {
        Event storage evt = events[_eventId];
        require(evt.exists, "Event does not exist");
        if (block.timestamp < evt.startTime) return EventStatus.NotStarted;
        if (evt.remainingTickets == 0) return EventStatus.SoldOut;
        return EventStatus.InProgress;
    }

    function getAllEventIds() external view returns (uint256[] memory) {
        return allEventIds;
    }

    function getEvent(uint256 _eventId) external view returns (
        uint256 id,
        string memory title,
        uint256 startTime,
        uint256 totalTickets,
        uint256 remainingTickets,
        address organizer,
        EventStatus status
    ) {
        Event storage evt = events[_eventId];
        require(evt.exists, "Event does not exist");
        return (evt.id, evt.title, evt.startTime, evt.totalTickets, evt.remainingTickets, evt.organizer, getEventStatus(_eventId));
    }

    function getAllEvents() external view returns (
        uint256[] memory ids,
        string[] memory titles,
        uint256[] memory startTimes,
        uint256[] memory totalTicketCounts,
        uint256[] memory remainingTicketCounts,
        address[] memory organizers
    ) {
        uint256 len = allEventIds.length;
        ids = new uint256[](len);
        titles = new string[](len);
        startTimes = new uint256[](len);
        totalTicketCounts = new uint256[](len);
        remainingTicketCounts = new uint256[](len);
        organizers = new address[](len);

        for (uint256 i = 0; i < len; i++) {
            Event storage evt = events[allEventIds[i]];
            ids[i] = evt.id;
            titles[i] = evt.title;
            startTimes[i] = evt.startTime;
            totalTicketCounts[i] = evt.totalTickets;
            remainingTicketCounts[i] = evt.remainingTickets;
            organizers[i] = evt.organizer;
        }
    }

    function getUserTickets(address _user) external view returns (
        uint256[] memory ticketIds,
        uint256[] memory eventIds,
        string[] memory eventTitles,
        uint256[] memory acquiredTimes
    ) {
        uint256[] storage userEventsList = userEvents[_user];
        uint256 len = userEventsList.length;
        ticketIds = new uint256[](len);
        eventIds = new uint256[](len);
        eventTitles = new string[](len);
        acquiredTimes = new uint256[](len);

        for (uint256 i = 0; i < len; i++) {
            uint256 eventId = userEventsList[i];
            uint256 tId = userTicketForEvent[eventId][_user];
            ticketIds[i] = tId;
            eventIds[i] = eventId;
            eventTitles[i] = events[eventId].title;
            acquiredTimes[i] = tickets[tId].acquiredAt;
        }
    }

    function getUserAttempts(address _user) external view returns (Attempt[] memory) {
        return userAttempts[_user];
    }

    function getRecentTickets(uint256 _eventId, uint256 _limit) external view returns (
        uint256[] memory ticketIds,
        address[] memory owners,
        uint256[] memory acquiredTimes
    ) {
        uint256[] storage evtTickets = eventTickets[_eventId];
        uint256 len = evtTickets.length;
        uint256 returnLen = len < _limit ? len : _limit;
        ticketIds = new uint256[](returnLen);
        owners = new address[](returnLen);
        acquiredTimes = new uint256[](returnLen);

        for (uint256 i = 0; i < returnLen; i++) {
            uint256 tId = evtTickets[len - 1 - i];
            ticketIds[i] = tId;
            owners[i] = tickets[tId].owner;
            acquiredTimes[i] = tickets[tId].acquiredAt;
        }
    }

    // ============ ERC721 Overrides ============

    /**
     * @notice Returns the token URI for a given ticket NFT
     * @dev Generates on-chain metadata with event info
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        // Check token exists
        require(tickets[tokenId].id != 0, "Token does not exist");

        Ticket storage ticket = tickets[tokenId];
        Event storage evt = events[ticket.eventId];

        // Build JSON metadata in parts to avoid stack too deep
        string memory jsonPart1 = string(abi.encodePacked(
            '{"name":"', evt.title, ' #', tokenId.toString(), '",',
            '"description":"Event ticket for ', evt.title, '",'
        ));

        string memory jsonPart2 = string(abi.encodePacked(
            '"attributes":[',
            '{"trait_type":"Event ID","value":"', ticket.eventId.toString(), '"},',
            '{"trait_type":"Ticket ID","value":"', tokenId.toString(), '"}],'
        ));

        string memory jsonPart3 = string(abi.encodePacked(
            '"image":"data:image/svg+xml;base64,', _generateSVG(evt.title, tokenId), '"}'
        ));

        string memory json = string(abi.encodePacked(jsonPart1, jsonPart2, jsonPart3));

        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(bytes(json))
        ));
    }

    /**
     * @dev Generates a simple SVG image for the ticket
     */
    function _generateSVG(string memory title, uint256 ticketId) internal pure returns (string memory) {
        // Split into parts to avoid stack too deep
        string memory part1 = string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="350" height="200" viewBox="0 0 350 200">',
            '<defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">',
            '<stop offset="0%" style="stop-color:#8B5CF6"/><stop offset="100%" style="stop-color:#6366F1"/>',
            '</linearGradient></defs>'
        ));

        string memory part2 = string(abi.encodePacked(
            '<rect width="350" height="200" rx="16" fill="url(#g)"/>',
            '<text x="175" y="40" text-anchor="middle" fill="white" font-size="14" font-family="sans-serif" opacity="0.8">TICKET</text>'
        ));

        string memory part3 = string(abi.encodePacked(
            '<text x="175" y="100" text-anchor="middle" fill="white" font-size="20" font-family="sans-serif" font-weight="bold">', title, '</text>',
            '<text x="175" y="160" text-anchor="middle" fill="white" font-size="32" font-family="monospace" font-weight="bold">#', ticketId.toString(), '</text>',
            '</svg>'
        ));

        return Base64.encode(bytes(string(abi.encodePacked(part1, part2, part3))));
    }
}
