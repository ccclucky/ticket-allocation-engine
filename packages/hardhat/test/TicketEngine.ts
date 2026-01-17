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
      const futureTime = (await time.latest()) + 3600;
      await expect(ticketEngine.createEvent("Test Event", futureTime, 100))
        .to.emit(ticketEngine, "EventCreated")
        .withArgs(1, "Test Event", futureTime, 100, owner.address);

      const event = await ticketEngine["getEvent(uint256)"](1);
      expect(event.title).to.equal("Test Event");
      expect(event.totalTickets).to.equal(100);
      expect(event.remainingTickets).to.equal(100);
    });

    it("should reject empty title", async () => {
      const futureTime = (await time.latest()) + 3600;
      await expect(ticketEngine.createEvent("", futureTime, 100)).to.be.revertedWith("Title cannot be empty");
    });

    it("should reject zero tickets", async () => {
      const futureTime = (await time.latest()) + 3600;
      await expect(ticketEngine.createEvent("Test", futureTime, 0)).to.be.revertedWith("Must have at least 1 ticket");
    });

    it("should reject past start time", async () => {
      const pastTime = (await time.latest()) - 100;
      await expect(ticketEngine.createEvent("Test", pastTime, 100)).to.be.revertedWith("Start time must be in future");
    });
  });

  describe("grabTicket", () => {
    let eventId: bigint;
    let startTime: number;

    beforeEach(async () => {
      startTime = (await time.latest()) + 60;
      await ticketEngine.createEvent("Grab Test", startTime, 2);
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

      const result = await ticketEngine.connect(owner).grabTicket.staticCall(eventId);
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
