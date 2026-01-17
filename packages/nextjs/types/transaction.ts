export interface TransactionRecord {
  hash: string;
  type: "grab" | "create";
  eventId?: string;
  eventTitle?: string;
  userAddress?: string; // wallet address
  success: boolean;
  confirmTime: number; // milliseconds
  gasUsed: string; // bigint as string
  gasPrice: string; // bigint as string
  gasCost: string; // wei as string
  timestamp: number;
}

export interface TransactionStats {
  totalAttempts: number;
  successCount: number;
  failCount: number;
  averageConfirmTime: number;
  totalGasCost: string; // wei as string
}

export const STORAGE_KEY = "monad-tx-history";
