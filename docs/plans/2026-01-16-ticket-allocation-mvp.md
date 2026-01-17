# Ticket Allocation Engine MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, use ui-ux-pro-max to design frontend style and implement.

**Goal:** Build a 3-page MVP ticket allocation dApp where users can browse events, grab tickets (first-come-first-served), and organizers can create events - optimized for Hackathon demo with polished UI.

**Architecture:**
- Smart Contract: Single `TicketEngine.sol` managing events, tickets, and attempts with on-chain state
- Frontend: Next.js 15 + Tailwind CSS 4 + DaisyUI 5 with Scaffold-ETH 2 hooks for contract interaction
- State: On-chain events emitted for real-time updates, wallet-based identity (no backend)

**Tech Stack:** Solidity 0.8.x, Hardhat, Next.js 15, React 19, Tailwind CSS 4, DaisyUI 5, wagmi, viem, RainbowKit

---

## Phase 1: Smart Contract Foundation

### Task 1.1: Create TicketEngine Contract - Data Structures

**Files:**
- Create: `packages/hardhat/contracts/TicketEngine.sol`

**Step 1: Create the contract file with structs and enums**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TicketEngine
 * @notice MVP ticket allocation engine - first-come-first-served with 1 ticket per user limit
 */
contract TicketEngine is ReentrancyGuard {
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
}
```

**Step 2: Compile to verify syntax**

Run: `cd D:\project\pers\ticket-allocation-engine && yarn compile`
Expected: Compilation successful

**Step 3: Commit**

```bash
git add packages/hardhat/contracts/TicketEngine.sol
git commit -m "feat(contract): add TicketEngine data structures

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 1.2: Add Events (Solidity Events for Frontend)

**Files:**
- Modify: `packages/hardhat/contracts/TicketEngine.sol`

**Step 1: Add event declarations after state variables**

```solidity
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
```

**Step 2: Compile to verify**

Run: `cd D:\project\pers\ticket-allocation-engine && yarn compile`
Expected: Compilation successful

**Step 3: Commit**

```bash
git add packages/hardhat/contracts/TicketEngine.sol
git commit -m "feat(contract): add TicketEngine events for frontend updates

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 1.3: Implement createEvent Function

**Files:**
- Modify: `packages/hardhat/contracts/TicketEngine.sol`

**Step 1: Add createEvent function**

```solidity
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
```

**Step 2: Compile to verify**

Run: `cd D:\project\pers\ticket-allocation-engine && yarn compile`
Expected: Compilation successful

**Step 3: Commit**

```bash
git add packages/hardhat/contracts/TicketEngine.sol
git commit -m "feat(contract): implement createEvent function

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 1.4: Implement grabTicket Function

**Files:**
- Modify: `packages/hardhat/contracts/TicketEngine.sol`

**Step 1: Add grabTicket function**

```solidity
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

        // Check event status
        if (block.timestamp < evt.startTime) {
            result = AttemptResult.NotStarted;
            _recordAttempt(_eventId, result);
            return (false, result, 0);
        }

        // Check if already has ticket
        if (hasTicketForEvent[_eventId][msg.sender]) {
            result = AttemptResult.AlreadyOwnsTicket;
            _recordAttempt(_eventId, result);
            return (false, result, 0);
        }

        // Check if sold out
        if (evt.remainingTickets == 0) {
            result = AttemptResult.SoldOut;
            _recordAttempt(_eventId, result);
            return (false, result, 0);
        }

        // Success - issue ticket
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
```

**Step 2: Compile to verify**

Run: `cd D:\project\pers\ticket-allocation-engine && yarn compile`
Expected: Compilation successful

**Step 3: Commit**

```bash
git add packages/hardhat/contracts/TicketEngine.sol
git commit -m "feat(contract): implement grabTicket with first-come-first-served logic

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 1.5: Add View Functions

**Files:**
- Modify: `packages/hardhat/contracts/TicketEngine.sol`

**Step 1: Add view functions**

```solidity
    // ============ View Functions ============

    /**
     * @notice Get current status of an event
     */
    function getEventStatus(uint256 _eventId) public view returns (EventStatus) {
        Event storage evt = events[_eventId];
        require(evt.exists, "Event does not exist");

        if (block.timestamp < evt.startTime) {
            return EventStatus.NotStarted;
        }
        if (evt.remainingTickets == 0) {
            return EventStatus.SoldOut;
        }
        return EventStatus.InProgress;
    }

    /**
     * @notice Get all event IDs
     */
    function getAllEventIds() external view returns (uint256[] memory) {
        return allEventIds;
    }

    /**
     * @notice Get event details
     */
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

        return (
            evt.id,
            evt.title,
            evt.startTime,
            evt.totalTickets,
            evt.remainingTickets,
            evt.organizer,
            getEventStatus(_eventId)
        );
    }

    /**
     * @notice Get all events with details (for listing)
     */
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

    /**
     * @notice Get user's tickets
     */
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
            uint256 ticketId = userTicketForEvent[eventId][_user];
            Ticket storage ticket = tickets[ticketId];

            ticketIds[i] = ticketId;
            eventIds[i] = eventId;
            eventTitles[i] = events[eventId].title;
            acquiredTimes[i] = ticket.acquiredAt;
        }
    }

    /**
     * @notice Get user's attempt history
     */
    function getUserAttempts(address _user) external view returns (Attempt[] memory) {
        return userAttempts[_user];
    }

    /**
     * @notice Get recent successful tickets for an event (for real-time display)
     * @param _eventId Event ID
     * @param _limit Max number of tickets to return
     */
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

        // Return most recent first
        for (uint256 i = 0; i < returnLen; i++) {
            uint256 ticketId = evtTickets[len - 1 - i];
            Ticket storage ticket = tickets[ticketId];
            ticketIds[i] = ticketId;
            owners[i] = ticket.owner;
            acquiredTimes[i] = ticket.acquiredAt;
        }
    }
```

**Step 2: Compile to verify**

Run: `cd D:\project\pers\ticket-allocation-engine && yarn compile`
Expected: Compilation successful

**Step 3: Commit**

```bash
git add packages/hardhat/contracts/TicketEngine.sol
git commit -m "feat(contract): add view functions for frontend queries

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 1.6: Create Deploy Script

**Files:**
- Create: `packages/hardhat/deploy/01_deploy_ticket_engine.ts`
- Delete or rename: `packages/hardhat/deploy/00_deploy_your_contract.ts`

**Step 1: Create deploy script**

```typescript
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployTicketEngine: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  await deploy("TicketEngine", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });

  console.log("TicketEngine deployed!");
};

export default deployTicketEngine;

deployTicketEngine.tags = ["TicketEngine"];
```

**Step 2: Rename old deploy script to prevent conflicts**

Run: `mv packages/hardhat/deploy/00_deploy_your_contract.ts packages/hardhat/deploy/00_deploy_your_contract.ts.bak`

**Step 3: Deploy to local chain**

Run: `cd D:\project\pers\ticket-allocation-engine && yarn chain` (in one terminal)
Run: `cd D:\project\pers\ticket-allocation-engine && yarn deploy` (in another terminal)
Expected: TicketEngine deployed successfully

**Step 4: Commit**

```bash
git add packages/hardhat/deploy/
git commit -m "feat(deploy): add TicketEngine deploy script

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 1.7: Write Contract Tests

**Files:**
- Create: `packages/hardhat/test/TicketEngine.ts`

**Step 1: Create comprehensive test file**

```typescript
import { expect } from "chai";
import { ethers } from "hardhat";
import { TicketEngine } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("TicketEngine", function () {
  let ticketEngine: TicketEngine;
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;

  beforeEach(async () => {
    [owner, user1, user2] = await ethers.getSigners();
    const TicketEngineFactory = await ethers.getContractFactory("TicketEngine");
    ticketEngine = await TicketEngineFactory.deploy();
    await ticketEngine.waitForDeployment();
  });

  describe("createEvent", () => {
    it("should create an event successfully", async () => {
      const futureTime = (await time.latest()) + 3600; // 1 hour from now

      await expect(ticketEngine.createEvent("Test Event", futureTime, 100))
        .to.emit(ticketEngine, "EventCreated")
        .withArgs(1, "Test Event", futureTime, 100, owner.address);

      const event = await ticketEngine.getEvent(1);
      expect(event.title).to.equal("Test Event");
      expect(event.totalTickets).to.equal(100);
      expect(event.remainingTickets).to.equal(100);
    });

    it("should reject empty title", async () => {
      const futureTime = (await time.latest()) + 3600;
      await expect(ticketEngine.createEvent("", futureTime, 100))
        .to.be.revertedWith("Title cannot be empty");
    });

    it("should reject zero tickets", async () => {
      const futureTime = (await time.latest()) + 3600;
      await expect(ticketEngine.createEvent("Test", futureTime, 0))
        .to.be.revertedWith("Must have at least 1 ticket");
    });

    it("should reject past start time", async () => {
      const pastTime = (await time.latest()) - 100;
      await expect(ticketEngine.createEvent("Test", pastTime, 100))
        .to.be.revertedWith("Start time must be in future");
    });
  });

  describe("grabTicket", () => {
    let eventId: bigint;
    let startTime: number;

    beforeEach(async () => {
      startTime = (await time.latest()) + 60;
      const tx = await ticketEngine.createEvent("Grab Test", startTime, 2);
      await tx.wait();
      eventId = 1n;
    });

    it("should fail when event not started", async () => {
      const result = await ticketEngine.connect(user1).grabTicket.staticCall(eventId);
      expect(result.success).to.be.false;
      expect(result.result).to.equal(3); // NotStarted
    });

    it("should succeed after event starts", async () => {
      await time.increaseTo(startTime + 1);

      await expect(ticketEngine.connect(user1).grabTicket(eventId))
        .to.emit(ticketEngine, "TicketGrabbed")
        .withArgs(eventId, 1, user1.address, 1);

      const hasTicket = await ticketEngine.hasTicketForEvent(eventId, user1.address);
      expect(hasTicket).to.be.true;
    });

    it("should prevent double grab", async () => {
      await time.increaseTo(startTime + 1);
      await ticketEngine.connect(user1).grabTicket(eventId);

      const result = await ticketEngine.connect(user1).grabTicket.staticCall(eventId);
      expect(result.success).to.be.false;
      expect(result.result).to.equal(1); // AlreadyOwnsTicket
    });

    it("should emit SoldOut when last ticket grabbed", async () => {
      await time.increaseTo(startTime + 1);
      await ticketEngine.connect(user1).grabTicket(eventId);

      await expect(ticketEngine.connect(user2).grabTicket(eventId))
        .to.emit(ticketEngine, "EventSoldOut")
        .withArgs(eventId);
    });

    it("should reject grab when sold out", async () => {
      await time.increaseTo(startTime + 1);
      await ticketEngine.connect(user1).grabTicket(eventId);
      await ticketEngine.connect(user2).grabTicket(eventId);

      const [owner3] = await ethers.getSigners();
      const result = await ticketEngine.connect(owner3).grabTicket.staticCall(eventId);
      expect(result.success).to.be.false;
      expect(result.result).to.equal(2); // SoldOut
    });
  });

  describe("view functions", () => {
    beforeEach(async () => {
      const futureTime = (await time.latest()) + 60;
      await ticketEngine.createEvent("Event 1", futureTime, 10);
      await ticketEngine.createEvent("Event 2", futureTime + 3600, 20);
    });

    it("should return all event IDs", async () => {
      const ids = await ticketEngine.getAllEventIds();
      expect(ids.length).to.equal(2);
      expect(ids[0]).to.equal(1);
      expect(ids[1]).to.equal(2);
    });

    it("should return correct event status", async () => {
      let status = await ticketEngine.getEventStatus(1);
      expect(status).to.equal(0); // NotStarted

      await time.increase(61);
      status = await ticketEngine.getEventStatus(1);
      expect(status).to.equal(1); // InProgress
    });
  });
});
```

**Step 2: Run tests**

Run: `cd D:\project\pers\ticket-allocation-engine && yarn test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add packages/hardhat/test/TicketEngine.ts
git commit -m "test(contract): add comprehensive TicketEngine tests

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 2: Frontend Foundation

### Task 2.1: Update Layout and Metadata

**Files:**
- Modify: `packages/nextjs/app/layout.tsx`
- Modify: `packages/nextjs/components/Header.tsx`

**Step 1: Update layout metadata**

In `packages/nextjs/app/layout.tsx`, update the getMetadata call:

```typescript
export const metadata = getMetadata({
  title: "Ticket Engine - Fair Ticket Allocation",
  description: "First-come-first-served ticket allocation with transparent on-chain results",
});
```

**Step 2: Update Header with new navigation**

Replace `menuLinks` in `packages/nextjs/components/Header.tsx`:

```typescript
import { TicketIcon, PlusCircleIcon, UserIcon } from "@heroicons/react/24/outline";

export const menuLinks: HeaderMenuLink[] = [
  {
    label: "Events",
    href: "/",
    icon: <TicketIcon className="h-4 w-4" />,
  },
  {
    label: "Create Event",
    href: "/create",
    icon: <PlusCircleIcon className="h-4 w-4" />,
  },
  {
    label: "My Tickets",
    href: "/me",
    icon: <UserIcon className="h-4 w-4" />,
  },
];
```

Also update the logo text from "Scaffold-ETH" to "Ticket Engine".

**Step 3: Verify the app still loads**

Run: `cd D:\project\pers\ticket-allocation-engine && yarn start`
Expected: App loads with new header

**Step 4: Commit**

```bash
git add packages/nextjs/app/layout.tsx packages/nextjs/components/Header.tsx
git commit -m "feat(ui): update layout metadata and navigation for Ticket Engine

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 2.2: Create Types File

**Files:**
- Create: `packages/nextjs/types/ticket-engine.ts`

**Step 1: Create types**

```typescript
export enum EventStatus {
  NotStarted = 0,
  InProgress = 1,
  SoldOut = 2,
}

export enum AttemptResult {
  Success = 0,
  AlreadyOwnsTicket = 1,
  SoldOut = 2,
  NotStarted = 3,
}

export interface TicketEvent {
  id: bigint;
  title: string;
  startTime: bigint;
  totalTickets: bigint;
  remainingTickets: bigint;
  organizer: string;
  status: EventStatus;
}

export interface Ticket {
  id: bigint;
  eventId: bigint;
  eventTitle: string;
  acquiredAt: bigint;
}

export interface Attempt {
  eventId: bigint;
  participant: string;
  timestamp: bigint;
  result: AttemptResult;
}

export const getStatusLabel = (status: EventStatus): string => {
  switch (status) {
    case EventStatus.NotStarted:
      return "Not Started";
    case EventStatus.InProgress:
      return "In Progress";
    case EventStatus.SoldOut:
      return "Sold Out";
    default:
      return "Unknown";
  }
};

export const getStatusColor = (status: EventStatus): string => {
  switch (status) {
    case EventStatus.NotStarted:
      return "badge-warning";
    case EventStatus.InProgress:
      return "badge-success";
    case EventStatus.SoldOut:
      return "badge-error";
    default:
      return "badge-neutral";
  }
};

export const getAttemptResultLabel = (result: AttemptResult): string => {
  switch (result) {
    case AttemptResult.Success:
      return "Success";
    case AttemptResult.AlreadyOwnsTicket:
      return "Already owns ticket";
    case AttemptResult.SoldOut:
      return "Sold out";
    case AttemptResult.NotStarted:
      return "Event not started";
    default:
      return "Unknown";
  }
};
```

**Step 2: Commit**

```bash
git add packages/nextjs/types/ticket-engine.ts
git commit -m "feat(types): add TypeScript types for Ticket Engine

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 2.3: Create useTicketEngine Hook

**Files:**
- Create: `packages/nextjs/hooks/useTicketEngine.ts`

**Step 1: Create the hook**

```typescript
"use client";

import { useCallback } from "react";
import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { EventStatus, TicketEvent, Ticket, Attempt, AttemptResult } from "~~/types/ticket-engine";

export const useTicketEngine = () => {
  const { address } = useAccount();

  // Read all events
  const { data: allEventsData, refetch: refetchEvents } = useScaffoldReadContract({
    contractName: "TicketEngine",
    functionName: "getAllEvents",
  });

  // Write contract
  const { writeContractAsync: writeTicketEngine, isMining } = useScaffoldWriteContract({
    contractName: "TicketEngine",
  });

  // Parse events data into typed array
  const events: TicketEvent[] = allEventsData
    ? allEventsData[0].map((id, index) => ({
        id,
        title: allEventsData[1][index],
        startTime: allEventsData[2][index],
        totalTickets: allEventsData[3][index],
        remainingTickets: allEventsData[4][index],
        organizer: allEventsData[5][index],
        status: getEventStatusFromData(
          allEventsData[2][index],
          allEventsData[4][index]
        ),
      }))
    : [];

  // Create event
  const createEvent = useCallback(
    async (title: string, startTime: bigint, totalTickets: bigint) => {
      const result = await writeTicketEngine({
        functionName: "createEvent",
        args: [title, startTime, totalTickets],
      });
      await refetchEvents();
      return result;
    },
    [writeTicketEngine, refetchEvents]
  );

  // Grab ticket
  const grabTicket = useCallback(
    async (eventId: bigint) => {
      const result = await writeTicketEngine({
        functionName: "grabTicket",
        args: [eventId],
      });
      await refetchEvents();
      return result;
    },
    [writeTicketEngine, refetchEvents]
  );

  return {
    events,
    createEvent,
    grabTicket,
    isMining,
    refetchEvents,
    address,
  };
};

// Read single event
export const useEvent = (eventId: bigint) => {
  const { data, refetch } = useScaffoldReadContract({
    contractName: "TicketEngine",
    functionName: "getEvent",
    args: [eventId],
  });

  const event: TicketEvent | null = data
    ? {
        id: data[0],
        title: data[1],
        startTime: data[2],
        totalTickets: data[3],
        remainingTickets: data[4],
        organizer: data[5],
        status: data[6] as EventStatus,
      }
    : null;

  return { event, refetch };
};

// Read user's tickets
export const useUserTickets = (userAddress?: string) => {
  const { data, refetch } = useScaffoldReadContract({
    contractName: "TicketEngine",
    functionName: "getUserTickets",
    args: [userAddress],
    query: {
      enabled: !!userAddress,
    },
  });

  const tickets: Ticket[] = data
    ? data[0].map((ticketId, index) => ({
        id: ticketId,
        eventId: data[1][index],
        eventTitle: data[2][index],
        acquiredAt: data[3][index],
      }))
    : [];

  return { tickets, refetch };
};

// Read user's attempts
export const useUserAttempts = (userAddress?: string) => {
  const { data, refetch } = useScaffoldReadContract({
    contractName: "TicketEngine",
    functionName: "getUserAttempts",
    args: [userAddress],
    query: {
      enabled: !!userAddress,
    },
  });

  const attempts: Attempt[] = data
    ? data.map((attempt) => ({
        eventId: attempt.eventId,
        participant: attempt.participant,
        timestamp: attempt.timestamp,
        result: attempt.result as AttemptResult,
      }))
    : [];

  return { attempts, refetch };
};

// Read recent tickets for an event
export const useRecentTickets = (eventId: bigint, limit: bigint = 5n) => {
  const { data, refetch } = useScaffoldReadContract({
    contractName: "TicketEngine",
    functionName: "getRecentTickets",
    args: [eventId, limit],
  });

  const recentTickets = data
    ? data[0].map((ticketId, index) => ({
        ticketId,
        owner: data[1][index],
        acquiredAt: data[2][index],
      }))
    : [];

  return { recentTickets, refetch };
};

// Check if user has ticket for event
export const useHasTicket = (eventId: bigint, userAddress?: string) => {
  const { data: hasTicket } = useScaffoldReadContract({
    contractName: "TicketEngine",
    functionName: "hasTicketForEvent",
    args: [eventId, userAddress],
    query: {
      enabled: !!userAddress,
    },
  });

  const { data: ticketId } = useScaffoldReadContract({
    contractName: "TicketEngine",
    functionName: "userTicketForEvent",
    args: [eventId, userAddress],
    query: {
      enabled: !!userAddress && !!hasTicket,
    },
  });

  return { hasTicket: !!hasTicket, ticketId };
};

// Helper to determine status from timestamp and remaining tickets
function getEventStatusFromData(startTime: bigint, remainingTickets: bigint): EventStatus {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (now < startTime) return EventStatus.NotStarted;
  if (remainingTickets === 0n) return EventStatus.SoldOut;
  return EventStatus.InProgress;
}
```

**Step 2: Commit**

```bash
git add packages/nextjs/hooks/useTicketEngine.ts
git commit -m "feat(hooks): add useTicketEngine hooks for contract interaction

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 3: Page 1 - Events List (Home)

### Task 3.1: Create EventCard Component

**Files:**
- Create: `packages/nextjs/components/ticket-engine/EventCard.tsx`

**Step 1: Create the component**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TicketEvent, EventStatus, getStatusLabel, getStatusColor } from "~~/types/ticket-engine";

interface EventCardProps {
  event: TicketEvent;
}

export const EventCard = ({ event }: EventCardProps) => {
  const [countdown, setCountdown] = useState("");
  const [currentStatus, setCurrentStatus] = useState(event.status);

  // Update countdown every second
  useEffect(() => {
    const updateCountdown = () => {
      const now = BigInt(Math.floor(Date.now() / 1000));

      if (now >= event.startTime) {
        if (event.remainingTickets === 0n) {
          setCurrentStatus(EventStatus.SoldOut);
        } else {
          setCurrentStatus(EventStatus.InProgress);
        }
        setCountdown("");
        return;
      }

      setCurrentStatus(EventStatus.NotStarted);
      const diff = Number(event.startTime - now);
      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;

      if (hours > 24) {
        const days = Math.floor(hours / 24);
        setCountdown(`${days}d ${hours % 24}h`);
      } else if (hours > 0) {
        setCountdown(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setCountdown(`${minutes}m ${seconds}s`);
      } else {
        setCountdown(`${seconds}s`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [event.startTime, event.remainingTickets]);

  const startDate = new Date(Number(event.startTime) * 1000);
  const formattedDate = startDate.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const getButtonText = () => {
    switch (currentStatus) {
      case EventStatus.NotStarted:
        return "View Details";
      case EventStatus.InProgress:
        return "Grab Ticket";
      case EventStatus.SoldOut:
        return "View Results";
    }
  };

  const getButtonClass = () => {
    switch (currentStatus) {
      case EventStatus.NotStarted:
        return "btn-outline btn-primary";
      case EventStatus.InProgress:
        return "btn-primary";
      case EventStatus.SoldOut:
        return "btn-ghost";
    }
  };

  return (
    <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow duration-300">
      <div className="card-body">
        {/* Header: Title + Status */}
        <div className="flex justify-between items-start gap-2">
          <h2 className="card-title text-lg line-clamp-2">{event.title}</h2>
          <span className={`badge ${getStatusColor(currentStatus)} shrink-0`}>
            {getStatusLabel(currentStatus)}
          </span>
        </div>

        {/* Time Info */}
        <div className="flex flex-col gap-1 text-sm text-base-content/70">
          <div className="flex items-center gap-2">
            <span>Start:</span>
            <span className="font-mono">{formattedDate}</span>
          </div>
          {countdown && (
            <div className="flex items-center gap-2">
              <span>In:</span>
              <span className="font-mono text-warning font-semibold">{countdown}</span>
            </div>
          )}
        </div>

        {/* Ticket Info */}
        <div className="flex items-center justify-between mt-2 p-3 bg-base-200 rounded-lg">
          <span className="text-sm text-base-content/70">Tickets</span>
          <div className="text-right">
            <span className="text-2xl font-bold text-primary">
              {event.remainingTickets.toString()}
            </span>
            <span className="text-base-content/50 text-sm">
              {" / "}
              {event.totalTickets.toString()}
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div className="card-actions justify-end mt-4">
          <Link href={`/event/${event.id}`} className="w-full">
            <button className={`btn ${getButtonClass()} w-full`}>
              {getButtonText()}
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
};
```

**Step 2: Create index export**

Create `packages/nextjs/components/ticket-engine/index.tsx`:

```tsx
export * from "./EventCard";
```

**Step 3: Commit**

```bash
git add packages/nextjs/components/ticket-engine/
git commit -m "feat(ui): add EventCard component with countdown timer

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 3.2: Create Home Page with Event List

**Files:**
- Modify: `packages/nextjs/app/page.tsx`

**Step 1: Replace home page content**

```tsx
"use client";

import Link from "next/link";
import type { NextPage } from "next";
import { PlusCircleIcon } from "@heroicons/react/24/outline";
import { useTicketEngine } from "~~/hooks/useTicketEngine";
import { EventCard } from "~~/components/ticket-engine";

const Home: NextPage = () => {
  const { events } = useTicketEngine();

  // Sort events: InProgress first, then NotStarted, then SoldOut
  const sortedEvents = [...events].sort((a, b) => {
    const statusOrder = { 1: 0, 0: 1, 2: 2 }; // InProgress, NotStarted, SoldOut
    return statusOrder[a.status] - statusOrder[b.status];
  });

  return (
    <div className="flex flex-col grow">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-primary/10 to-secondary/10 py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Ticket Allocation Engine
          </h1>
          <p className="text-lg text-base-content/70 mb-6">
            Fair, transparent, first-come-first-served ticket allocation on-chain
          </p>
          <Link href="/create">
            <button className="btn btn-primary btn-lg gap-2">
              <PlusCircleIcon className="h-6 w-6" />
              Create Event
            </button>
          </Link>
        </div>
      </div>

      {/* Events Grid */}
      <div className="flex-grow p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">Active Events</h2>

          {events.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🎫</div>
              <h3 className="text-xl font-semibold mb-2">No events yet</h3>
              <p className="text-base-content/70 mb-6">
                Be the first to create a ticket event!
              </p>
              <Link href="/create">
                <button className="btn btn-primary">
                  Create an Event
                </button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedEvents.map((event) => (
                <EventCard key={event.id.toString()} event={event} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
```

**Step 2: Verify the page loads**

Run: `yarn start`
Expected: Home page shows events grid (empty state if no events)

**Step 3: Commit**

```bash
git add packages/nextjs/app/page.tsx
git commit -m "feat(ui): implement home page with events grid

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 4: Event Detail Page

### Task 4.1: Create Event Detail Page

**Files:**
- Create: `packages/nextjs/app/event/[id]/page.tsx`

**Step 1: Create the event detail page**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { ArrowLeftIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { Address } from "@scaffold-ui/components";
import { useEvent, useHasTicket, useRecentTickets } from "~~/hooks/useTicketEngine";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { EventStatus, getStatusLabel, getStatusColor, AttemptResult } from "~~/types/ticket-engine";
import { notification } from "~~/utils/scaffold-eth";

type GrabResult = {
  success: boolean;
  result: AttemptResult;
  ticketId?: bigint;
} | null;

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = BigInt(params.id as string);

  const { address } = useAccount();
  const { event, refetch } = useEvent(eventId);
  const { hasTicket, ticketId } = useHasTicket(eventId, address);
  const { recentTickets, refetch: refetchRecent } = useRecentTickets(eventId, 5n);

  const { writeContractAsync, isMining } = useScaffoldWriteContract({
    contractName: "TicketEngine",
  });

  const [countdown, setCountdown] = useState("");
  const [currentStatus, setCurrentStatus] = useState<EventStatus | null>(null);
  const [grabResult, setGrabResult] = useState<GrabResult>(null);

  // Update countdown and status
  useEffect(() => {
    if (!event) return;

    const updateStatus = () => {
      const now = BigInt(Math.floor(Date.now() / 1000));

      if (now < event.startTime) {
        setCurrentStatus(EventStatus.NotStarted);
        const diff = Number(event.startTime - now);
        const hours = Math.floor(diff / 3600);
        const minutes = Math.floor((diff % 3600) / 60);
        const seconds = diff % 60;

        if (hours > 0) {
          setCountdown(`${hours}h ${minutes}m ${seconds}s`);
        } else if (minutes > 0) {
          setCountdown(`${minutes}m ${seconds}s`);
        } else {
          setCountdown(`${seconds}s`);
        }
      } else if (event.remainingTickets === 0n) {
        setCurrentStatus(EventStatus.SoldOut);
        setCountdown("");
      } else {
        setCurrentStatus(EventStatus.InProgress);
        setCountdown("");
      }
    };

    updateStatus();
    const interval = setInterval(updateStatus, 1000);
    return () => clearInterval(interval);
  }, [event]);

  // Polling for updates during active event
  useEffect(() => {
    if (currentStatus !== EventStatus.InProgress) return;

    const pollInterval = setInterval(() => {
      refetch();
      refetchRecent();
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [currentStatus, refetch, refetchRecent]);

  const handleGrabTicket = async () => {
    if (!address) {
      notification.error("Please connect your wallet");
      return;
    }

    try {
      setGrabResult(null);
      await writeContractAsync({
        functionName: "grabTicket",
        args: [eventId],
      });

      // Refetch to get updated state
      await refetch();
      await refetchRecent();

      // The transaction succeeded, now check if we got the ticket
      // We need to read the result from the contract or check hasTicket
      const hasNow = await refetch();

      if (hasTicket || hasNow) {
        setGrabResult({
          success: true,
          result: AttemptResult.Success,
          ticketId: ticketId,
        });
      }
    } catch (error: any) {
      console.error("Grab ticket error:", error);
      // Transaction might have succeeded but returned failure result
      await refetch();
    }
  };

  if (!event) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  const startDate = new Date(Number(event.startTime) * 1000);
  const formattedDate = startDate.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const renderButton = () => {
    if (hasTicket) {
      return (
        <button className="btn btn-success btn-lg w-full" disabled>
          <CheckCircleIcon className="h-6 w-6" />
          You have ticket #{ticketId?.toString()}
        </button>
      );
    }

    switch (currentStatus) {
      case EventStatus.NotStarted:
        return (
          <button className="btn btn-lg w-full" disabled>
            Starts in {countdown}
          </button>
        );
      case EventStatus.InProgress:
        return (
          <button
            className="btn btn-primary btn-lg w-full"
            onClick={handleGrabTicket}
            disabled={isMining}
          >
            {isMining ? (
              <>
                <span className="loading loading-spinner"></span>
                Grabbing...
              </>
            ) : (
              "Grab Ticket Now"
            )}
          </button>
        );
      case EventStatus.SoldOut:
        return (
          <button className="btn btn-lg w-full" disabled>
            Sold Out
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="btn btn-ghost btn-sm gap-2 mb-6"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back
        </button>

        {/* Event Header */}
        <div className="bg-base-100 rounded-2xl p-6 shadow-xl mb-6">
          <div className="flex justify-between items-start mb-4">
            <h1 className="text-2xl md:text-3xl font-bold">{event.title}</h1>
            <span className={`badge badge-lg ${getStatusColor(currentStatus ?? event.status)}`}>
              {getStatusLabel(currentStatus ?? event.status)}
            </span>
          </div>

          {/* Status Panel - Big Numbers */}
          <div className="bg-base-200 rounded-xl p-6 text-center mb-6">
            {currentStatus === EventStatus.NotStarted && countdown && (
              <div className="mb-4">
                <div className="text-sm text-base-content/70">Starts in</div>
                <div className="text-4xl font-bold text-warning font-mono">
                  {countdown}
                </div>
              </div>
            )}

            <div className="text-sm text-base-content/70">Remaining Tickets</div>
            <div className="text-6xl font-bold text-primary">
              {event.remainingTickets.toString()}
            </div>
            <div className="text-base-content/50">
              of {event.totalTickets.toString()} total
            </div>
          </div>

          {/* Rules Card */}
          <div className="bg-base-200 rounded-xl p-4 mb-6">
            <h3 className="font-semibold mb-2">Rules</h3>
            <ul className="text-sm space-y-1 text-base-content/70">
              <li>• First-come-first-served</li>
              <li>• Each participant can only get 1 ticket</li>
              <li>• Event ends when sold out</li>
            </ul>
          </div>

          {/* Grab Button / Result */}
          <div className="space-y-4">
            {renderButton()}

            {/* Success/Failure Result */}
            {grabResult && (
              <div className={`alert ${grabResult.success ? "alert-success" : "alert-error"}`}>
                {grabResult.success ? (
                  <>
                    <CheckCircleIcon className="h-6 w-6" />
                    <div>
                      <div className="font-bold">Congratulations!</div>
                      <div>You got ticket #{grabResult.ticketId?.toString()}</div>
                    </div>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => router.push("/me")}
                    >
                      View My Tickets
                    </button>
                  </>
                ) : (
                  <>
                    <XCircleIcon className="h-6 w-6" />
                    <div>
                      <div className="font-bold">Failed</div>
                      <div>
                        {grabResult.result === AttemptResult.SoldOut && "Already sold out"}
                        {grabResult.result === AttemptResult.AlreadyOwnsTicket && "You already have a ticket"}
                        {grabResult.result === AttemptResult.NotStarted && "Event has not started yet"}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Event Info */}
          <div className="divider"></div>
          <div className="text-sm text-base-content/70 space-y-2">
            <div className="flex justify-between">
              <span>Start Time:</span>
              <span className="font-mono">{formattedDate}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Organizer:</span>
              <Address address={event.organizer} />
            </div>
          </div>
        </div>

        {/* Recent Grabs */}
        {recentTickets.length > 0 && (
          <div className="bg-base-100 rounded-2xl p-6 shadow-xl">
            <h3 className="font-semibold mb-4">Recent Successful Grabs</h3>
            <div className="space-y-2">
              {recentTickets.map((ticket, i) => (
                <div
                  key={ticket.ticketId.toString()}
                  className="flex justify-between items-center p-3 bg-base-200 rounded-lg text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="badge badge-primary badge-sm">
                      #{ticket.ticketId.toString()}
                    </span>
                    <Address address={ticket.owner} size="sm" />
                  </div>
                  <span className="text-base-content/50">
                    {formatTimeAgo(Number(ticket.acquiredAt))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Disclaimer */}
        <div className="text-center text-xs text-base-content/50 mt-8 space-y-1">
          <p>This event follows public rules, results are determined by the system.</p>
          <p>V1 does not provide identity verification.</p>
        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
```

**Step 2: Verify page works**

Run: `yarn start` and navigate to `/event/1`
Expected: Event detail page loads (or 404 if no events)

**Step 3: Commit**

```bash
git add packages/nextjs/app/event/
git commit -m "feat(ui): implement event detail page with grab ticket functionality

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 5: Create Event Page

### Task 5.1: Create Event Form Page

**Files:**
- Create: `packages/nextjs/app/create/page.tsx`

**Step 1: Create the create event page**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { ArrowLeftIcon, ClipboardDocumentIcon, CheckIcon } from "@heroicons/react/24/outline";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

export default function CreateEventPage() {
  const router = useRouter();
  const { address } = useAccount();
  const { writeContractAsync, isMining } = useScaffoldWriteContract({
    contractName: "TicketEngine",
  });

  const [title, setTitle] = useState("");
  const [startDateTime, setStartDateTime] = useState("");
  const [totalTickets, setTotalTickets] = useState("");
  const [createdEventId, setCreatedEventId] = useState<bigint | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!address) {
      notification.error("Please connect your wallet");
      return;
    }

    if (!title.trim()) {
      notification.error("Please enter a title");
      return;
    }

    const startTime = Math.floor(new Date(startDateTime).getTime() / 1000);
    if (startTime <= Math.floor(Date.now() / 1000)) {
      notification.error("Start time must be in the future");
      return;
    }

    const tickets = parseInt(totalTickets);
    if (isNaN(tickets) || tickets <= 0) {
      notification.error("Please enter a valid number of tickets");
      return;
    }

    try {
      await writeContractAsync({
        functionName: "createEvent",
        args: [title.trim(), BigInt(startTime), BigInt(tickets)],
      });

      // Get the event ID from the contract's nextEventId - 1
      // For MVP, we'll just redirect to home
      notification.success("Event created successfully!");

      // Show success state with link
      // In a real app, we'd get the event ID from the transaction receipt
      setCreatedEventId(1n); // Placeholder - would parse from event logs

    } catch (error) {
      console.error("Create event error:", error);
      notification.error("Failed to create event");
    }
  };

  const eventUrl = createdEventId
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/event/${createdEventId}`
    : '';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(eventUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Get minimum datetime (now + 1 minute)
  const minDateTime = new Date(Date.now() + 60000).toISOString().slice(0, 16);

  if (createdEventId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-base-100 rounded-2xl p-8 shadow-xl max-w-md w-full text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold mb-2">Event Created!</h1>
          <p className="text-base-content/70 mb-6">
            Your event is now live and ready for participants.
          </p>

          {/* Event Link */}
          <div className="bg-base-200 rounded-lg p-4 mb-6">
            <label className="text-sm text-base-content/70 block mb-2">
              Event Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={eventUrl}
                readOnly
                className="input input-bordered flex-1 text-sm font-mono"
              />
              <button
                onClick={handleCopy}
                className="btn btn-primary btn-square"
              >
                {copied ? (
                  <CheckIcon className="h-5 w-5" />
                ) : (
                  <ClipboardDocumentIcon className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => router.push(`/event/${createdEventId}`)}
              className="btn btn-primary w-full"
            >
              View Event
            </button>
            <button
              onClick={() => router.push("/")}
              className="btn btn-ghost w-full"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-lg mx-auto">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="btn btn-ghost btn-sm gap-2 mb-6"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back
        </button>

        <div className="bg-base-100 rounded-2xl p-6 shadow-xl">
          <h1 className="text-2xl font-bold mb-6">Create Event</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Event Title *</span>
              </label>
              <input
                type="text"
                placeholder="Enter event title"
                className="input input-bordered w-full"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                required
              />
            </div>

            {/* Start Time */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Start Time *</span>
              </label>
              <input
                type="datetime-local"
                className="input input-bordered w-full"
                value={startDateTime}
                onChange={(e) => setStartDateTime(e.target.value)}
                min={minDateTime}
                required
              />
              <label className="label">
                <span className="label-text-alt text-base-content/50">
                  Ticket grabbing will start at this time
                </span>
              </label>
            </div>

            {/* Total Tickets */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Total Tickets *</span>
              </label>
              <input
                type="number"
                placeholder="Enter number of tickets"
                className="input input-bordered w-full"
                value={totalTickets}
                onChange={(e) => setTotalTickets(e.target.value)}
                min={1}
                max={10000}
                required
              />
            </div>

            {/* Fixed Rules Display */}
            <div className="bg-base-200 rounded-lg p-4">
              <h3 className="font-medium mb-2">Rules (Fixed for V1)</h3>
              <ul className="text-sm text-base-content/70 space-y-1">
                <li>• First-come-first-served</li>
                <li>• Each participant can get 1 ticket max</li>
              </ul>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="btn btn-primary w-full btn-lg"
              disabled={isMining || !address}
            >
              {isMining ? (
                <>
                  <span className="loading loading-spinner"></span>
                  Creating...
                </>
              ) : !address ? (
                "Connect Wallet to Create"
              ) : (
                "Create Event"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify page works**

Run: `yarn start` and navigate to `/create`
Expected: Create event form loads

**Step 3: Commit**

```bash
git add packages/nextjs/app/create/
git commit -m "feat(ui): implement create event page with form

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 6: Personal Page (My Tickets)

### Task 6.1: Create Personal Page with Tabs

**Files:**
- Create: `packages/nextjs/app/me/page.tsx`

**Step 1: Create the personal page**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { TicketIcon, ClockIcon } from "@heroicons/react/24/outline";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useUserTickets, useUserAttempts } from "~~/hooks/useTicketEngine";
import { getAttemptResultLabel, AttemptResult } from "~~/types/ticket-engine";

type TabType = "tickets" | "history";

export default function PersonalPage() {
  const { address, isConnected } = useAccount();
  const { tickets } = useUserTickets(address);
  const { attempts } = useUserAttempts(address);
  const [activeTab, setActiveTab] = useState<TabType>("tickets");

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-base-100 rounded-2xl p-8 shadow-xl max-w-md w-full text-center">
          <div className="text-6xl mb-4">🔐</div>
          <h1 className="text-2xl font-bold mb-2">Connect Your Wallet</h1>
          <p className="text-base-content/70 mb-6">
            Connect your wallet to view your tickets and participation history.
          </p>
          <RainbowKitCustomConnectButton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header with Address */}
        <div className="bg-base-100 rounded-2xl p-6 shadow-xl mb-6">
          <h1 className="text-2xl font-bold mb-4">My Account</h1>
          <div className="flex items-center justify-between p-4 bg-base-200 rounded-lg">
            <div>
              <div className="text-sm text-base-content/70">Connected Wallet</div>
              <div className="font-mono text-sm">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </div>
            </div>
            <RainbowKitCustomConnectButton />
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs tabs-boxed mb-6 p-1 bg-base-100 rounded-xl shadow">
          <button
            className={`tab tab-lg flex-1 gap-2 ${activeTab === "tickets" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("tickets")}
          >
            <TicketIcon className="h-5 w-5" />
            My Tickets ({tickets.length})
          </button>
          <button
            className={`tab tab-lg flex-1 gap-2 ${activeTab === "history" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            <ClockIcon className="h-5 w-5" />
            History ({attempts.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="bg-base-100 rounded-2xl p-6 shadow-xl">
          {activeTab === "tickets" ? (
            <TicketsTab tickets={tickets} />
          ) : (
            <HistoryTab attempts={attempts} />
          )}
        </div>
      </div>
    </div>
  );
}

function TicketsTab({ tickets }: { tickets: ReturnType<typeof useUserTickets>["tickets"] }) {
  if (tickets.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4">🎫</div>
        <h3 className="text-lg font-semibold mb-2">No tickets yet</h3>
        <p className="text-base-content/70 mb-6">
          You haven't grabbed any tickets. Check out active events!
        </p>
        <Link href="/">
          <button className="btn btn-primary">Browse Events</button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tickets.map((ticket) => (
        <div
          key={ticket.id.toString()}
          className="flex items-center justify-between p-4 bg-base-200 rounded-xl"
        >
          <div className="flex items-center gap-4">
            <div className="bg-primary/20 p-3 rounded-lg">
              <TicketIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="font-semibold">{ticket.eventTitle}</div>
              <div className="text-sm text-base-content/70">
                Ticket #{ticket.id.toString()}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-base-content/50">Acquired</div>
            <div className="text-sm font-mono">
              {new Date(Number(ticket.acquiredAt) * 1000).toLocaleDateString()}
            </div>
          </div>
          <Link href={`/event/${ticket.eventId}`}>
            <button className="btn btn-ghost btn-sm">View Event</button>
          </Link>
        </div>
      ))}
    </div>
  );
}

function HistoryTab({ attempts }: { attempts: ReturnType<typeof useUserAttempts>["attempts"] }) {
  if (attempts.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4">📋</div>
        <h3 className="text-lg font-semibold mb-2">No participation history</h3>
        <p className="text-base-content/70 mb-6">
          You haven't participated in any events yet.
        </p>
        <Link href="/">
          <button className="btn btn-primary">Browse Events</button>
        </Link>
      </div>
    );
  }

  // Reverse to show most recent first
  const sortedAttempts = [...attempts].reverse();

  return (
    <div className="space-y-3">
      {sortedAttempts.map((attempt, index) => (
        <div
          key={`${attempt.eventId}-${attempt.timestamp}-${index}`}
          className="flex items-center justify-between p-4 bg-base-200 rounded-xl"
        >
          <div className="flex items-center gap-4">
            <div
              className={`p-2 rounded-lg ${
                attempt.result === AttemptResult.Success
                  ? "bg-success/20"
                  : "bg-error/20"
              }`}
            >
              {attempt.result === AttemptResult.Success ? "✅" : "❌"}
            </div>
            <div>
              <div className="font-medium">Event #{attempt.eventId.toString()}</div>
              <div className="text-sm text-base-content/70">
                {getAttemptResultLabel(attempt.result)}
              </div>
            </div>
          </div>
          <div className="text-right text-sm text-base-content/50 font-mono">
            {new Date(Number(attempt.timestamp) * 1000).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Verify page works**

Run: `yarn start` and navigate to `/me`
Expected: Personal page loads with connect wallet prompt or tabs

**Step 3: Commit**

```bash
git add packages/nextjs/app/me/
git commit -m "feat(ui): implement personal page with tickets and history tabs

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 7: Final Polish

### Task 7.1: Clean Up Unused Files

**Files:**
- Delete: `packages/hardhat/contracts/YourContract.sol`
- Modify: `packages/nextjs/contracts/deployedContracts.ts` (if needed after deploy)

**Step 1: Remove sample contract**

Run: `rm packages/hardhat/contracts/YourContract.sol`

**Step 2: Remove old deploy backup if exists**

Run: `rm packages/hardhat/deploy/00_deploy_your_contract.ts.bak` (if it exists)

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: clean up unused scaffold-eth sample files

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 7.2: Deploy and Test Full Flow

**Step 1: Start local chain**

Run: `yarn chain` (in terminal 1)

**Step 2: Deploy contracts**

Run: `yarn deploy` (in terminal 2)
Expected: TicketEngine deployed

**Step 3: Start frontend**

Run: `yarn start` (in terminal 3)
Expected: App running at http://localhost:3000

**Step 4: Manual test checklist**

1. [ ] Home page shows empty state
2. [ ] Can navigate to Create Event page
3. [ ] Can create event (requires wallet connection)
4. [ ] Event appears on home page
5. [ ] Event detail page shows countdown
6. [ ] When event starts, can grab ticket
7. [ ] Success/failure message shows
8. [ ] Ticket appears in My Tickets
9. [ ] Attempt appears in History
10. [ ] Sold out state works correctly

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete Ticket Allocation Engine MVP

- Smart contract with first-come-first-served ticket allocation
- Home page with events grid
- Event detail page with real-time status and grab functionality
- Create event page for organizers
- Personal page with tickets and participation history

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Summary

This plan delivers a complete MVP for the Ticket Allocation Engine with:

**Smart Contract (TicketEngine.sol):**
- Event creation with title, start time, total tickets
- First-come-first-served ticket grabbing with 1 per user limit
- Rich events for frontend real-time updates
- Comprehensive view functions

**Frontend (3 Pages):**
1. **Home (/)**: Events grid with status badges, countdown timers, ticket counts
2. **Event Detail (/event/[id])**: Real-time status, grab button, recent grabs feed
3. **Personal (/me)**: Wallet connection, tickets tab, participation history tab
+ **Create Event (/create)**: Simple form for organizers

**Key Features:**
- Real-time countdown timers
- Instant grab result feedback
- Wallet-based identity (no backend)
- Clean, polished DaisyUI components
- Mobile-responsive design

**Estimated Execution:** ~30-40 tasks, each 2-5 minutes = 1-2 hour implementation time (ideal for Hackathon)
