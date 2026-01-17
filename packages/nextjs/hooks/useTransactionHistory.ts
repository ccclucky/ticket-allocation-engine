"use client";

import { useCallback, useEffect, useState } from "react";
import { STORAGE_KEY, TransactionRecord, TransactionStats } from "~~/types/transaction";

export const useTransactionHistory = () => {
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setTransactions(JSON.parse(stored));
      }
    } catch {
      console.error("Failed to load transaction history from localStorage");
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage
  const saveToStorage = useCallback((records: TransactionRecord[]) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch {
      console.error("Failed to save transaction history to localStorage");
    }
  }, []);

  // Add a new transaction record
  const addTransaction = useCallback(
    (record: TransactionRecord) => {
      setTransactions(prev => {
        // Check for duplicate hash
        if (prev.some(tx => tx.hash === record.hash)) {
          return prev;
        }
        const updated = [record, ...prev];
        saveToStorage(updated);
        return updated;
      });
    },
    [saveToStorage],
  );

  // Clear all transaction history
  const clearHistory = useCallback(() => {
    setTransactions([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Get transactions by type
  const getTransactionsByType = useCallback(
    (type: "grab" | "create") => {
      return transactions.filter(tx => tx.type === type);
    },
    [transactions],
  );

  // Calculate statistics
  const getStats = useCallback((): TransactionStats => {
    if (transactions.length === 0) {
      return {
        totalAttempts: 0,
        successCount: 0,
        failCount: 0,
        averageConfirmTime: 0,
        totalGasCost: "0",
      };
    }

    const successCount = transactions.filter(tx => tx.success).length;
    const failCount = transactions.length - successCount;
    const averageConfirmTime = transactions.reduce((sum, tx) => sum + tx.confirmTime, 0) / transactions.length;
    const totalGasCost = transactions.reduce((sum, tx) => sum + BigInt(tx.gasCost), 0n).toString();

    return {
      totalAttempts: transactions.length,
      successCount,
      failCount,
      averageConfirmTime: Math.round(averageConfirmTime),
      totalGasCost,
    };
  }, [transactions]);

  // Get grab-only stats
  const getGrabStats = useCallback((): TransactionStats => {
    const grabTxs = transactions.filter(tx => tx.type === "grab");
    if (grabTxs.length === 0) {
      return {
        totalAttempts: 0,
        successCount: 0,
        failCount: 0,
        averageConfirmTime: 0,
        totalGasCost: "0",
      };
    }

    const successCount = grabTxs.filter(tx => tx.success).length;
    const failCount = grabTxs.length - successCount;
    const averageConfirmTime = grabTxs.reduce((sum, tx) => sum + tx.confirmTime, 0) / grabTxs.length;
    const totalGasCost = grabTxs.reduce((sum, tx) => sum + BigInt(tx.gasCost), 0n).toString();

    return {
      totalAttempts: grabTxs.length,
      successCount,
      failCount,
      averageConfirmTime: Math.round(averageConfirmTime),
      totalGasCost,
    };
  }, [transactions]);

  return {
    transactions,
    isLoaded,
    addTransaction,
    clearHistory,
    getTransactionsByType,
    getStats,
    getGrabStats,
  };
};
