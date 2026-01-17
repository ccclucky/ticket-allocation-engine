# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ticket Allocation Engine is a decentralized ticket allocation system built on Monad Testnet. It uses ERC721 NFTs for fair, transparent ticket distribution with on-chain SVG generation.

## Tech Stack

- **Blockchain**: Monad Testnet (EVM-compatible, chainId: 10143)
- **Smart Contracts**: Solidity 0.8.20, Hardhat 2.22, OpenZeppelin
- **Frontend**: Next.js 15 (App Router), React 19, TailwindCSS 4, DaisyUI 5
- **Web3**: Wagmi 2.19, Viem 2.39, RainbowKit 2.2
- **Monorepo**: Yarn 3.2.3 workspaces

## Common Commands

```bash
# Install dependencies
yarn install

# Local development
yarn chain              # Start local Hardhat node
yarn deploy             # Deploy contracts (local)
yarn start              # Start Next.js dev server (localhost:3000)

# Testing
yarn test               # Run Hardhat tests with gas reporting

# Deploy to Monad Testnet
yarn deploy --network monadTestnet
yarn deploy --network monadTestnet --reset  # Force redeploy

# Linting
yarn lint               # Run all linters
yarn hardhat:lint       # Lint Solidity
yarn next:lint          # Lint Next.js

# Account management
yarn generate           # Create burner wallet
yarn account:import     # Import existing private key
```

## Architecture

### Monorepo Structure

```
packages/
├── hardhat/            # Smart contracts
│   ├── contracts/      # Solidity sources (TicketEngine.sol)
│   ├── deploy/         # Deployment scripts (hardhat-deploy)
│   └── test/           # Chai tests
└── nextjs/             # Frontend DApp
    ├── app/            # Next.js App Router pages
    ├── components/     # React components
    ├── hooks/          # Custom hooks + scaffold-eth hooks
    └── contracts/      # Auto-generated ABIs (deployedContracts.ts)
```

### Smart Contract (TicketEngine.sol)

Core functions:
- `createEvent(title, startTime, totalTickets)` - Organizer creates event
- `grabTicket(eventId)` - User claims ticket (one per user per event)
- `getEvent(eventId)` - Read event details
- `hasTicketForEvent(eventId, address)` - Check ownership

Features: ReentrancyGuard, ERC721 with on-chain SVG, time-gated access, per-user limits.

### Frontend Pages

- `/` - Event listing
- `/create` - Create new event
- `/event/[id]` - Event details and ticket claiming
- `/me` - User dashboard (tickets, history)
- `/debug` - Contract interaction UI

## Scaffold-ETH 2 Patterns (Mandatory)

**Always use these hooks for contract interaction:**

```typescript
// Reading contract data
const { data } = useScaffoldReadContract({
  contractName: "TicketEngine",
  functionName: "getEvent",
  args: [eventId],
});

// Writing to contract
const { writeContractAsync } = useScaffoldWriteContract({
  contractName: "TicketEngine"
});
await writeContractAsync({
  functionName: "grabTicket",
  args: [eventId],
});

// Reading events
const { data: events } = useScaffoldEventHistory({
  contractName: "TicketEngine",
  eventName: "TicketGrabbed",
  watch: true,
});
```

**Never use direct Wagmi/Viem contract calls.** SE-2 hooks read ABIs from `packages/nextjs/contracts/deployedContracts.ts`.

## Key Configuration Files

- `packages/nextjs/scaffold.config.ts` - Network config, RPC settings
- `packages/hardhat/hardhat.config.ts` - Compiler settings, network definitions
- Contract ABI auto-generated after `yarn deploy` in `packages/nextjs/contracts/deployedContracts.ts`

## Deployment Workflow

1. Update contract in `packages/hardhat/contracts/`
2. Run tests: `yarn test`
3. Deploy: `yarn deploy --network monadTestnet`
4. ABI auto-updates in `deployedContracts.ts`
5. Frontend reads new contract address automatically

## CI/CD

GitHub Actions runs on push/PR to main:
- Hardhat linting (max 0 warnings)
- Next.js linting (max 0 warnings)
- TypeScript type checking

Pre-commit hooks via Husky run lint-staged on changed files.
