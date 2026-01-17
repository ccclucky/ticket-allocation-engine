"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import {
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  TicketIcon,
  TrashIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { TransactionHistoryItem, TransactionStatsSummary } from "~~/components/TransactionStats";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useTokenURI, useUserAttempts, useUserTickets } from "~~/hooks/useTicketEngine";
import { useTransactionHistory } from "~~/hooks/useTransactionHistory";
import { AttemptResult, getAttemptResultLabel } from "~~/types/ticket-engine";

type TabType = "tickets" | "history" | "txHistory";

export default function PersonalPage() {
  const { address, isConnected } = useAccount();
  const { tickets } = useUserTickets(address);
  const { attempts } = useUserAttempts(address);
  const { transactions, getGrabStats, clearHistory, isLoaded } = useTransactionHistory();
  const [activeTab, setActiveTab] = useState<TabType>("tickets");

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-base-200/30">
        <div className="bg-base-100 rounded-2xl p-8 shadow-xl max-w-md w-full text-center border border-base-200">
          <div className="text-7xl mb-4">🔐</div>
          <h1 className="text-2xl font-bold mb-2">连接钱包</h1>
          <p className="text-base-content/70 mb-6">连接钱包以查看你的票夹和参与记录</p>
          <RainbowKitCustomConnectButton />
        </div>
      </div>
    );
  }

  const grabStats = getGrabStats();

  return (
    <div className="min-h-screen p-4 md:p-8 bg-base-200/30">
      <div className="max-w-2xl mx-auto">
        <div className="bg-base-100 rounded-2xl p-6 shadow-xl mb-6 border border-base-200">
          <h1 className="text-2xl font-bold mb-4">我的账户</h1>
          <div className="flex items-center justify-between p-4 bg-base-200/50 rounded-lg">
            <div>
              <div className="text-sm text-base-content/70">已连接钱包</div>
              <div className="font-mono text-sm">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </div>
            </div>
            <RainbowKitCustomConnectButton />
          </div>
        </div>

        <div className="tabs tabs-boxed mb-6 p-1 bg-base-100 rounded-xl shadow border border-base-200">
          <button
            className={`tab tab-lg flex-1 gap-2 ${activeTab === "tickets" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("tickets")}
          >
            <TicketIcon className="h-5 w-5" />
            我的票夹 ({tickets.length})
          </button>
          <button
            className={`tab tab-lg flex-1 gap-2 ${activeTab === "history" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            <ClockIcon className="h-5 w-5" />
            链上记录 ({attempts.length})
          </button>
          <button
            className={`tab tab-lg flex-1 gap-2 ${activeTab === "txHistory" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("txHistory")}
          >
            <ChartBarIcon className="h-5 w-5" />
            交易统计 ({transactions.length})
          </button>
        </div>

        <div className="bg-base-100 rounded-2xl p-6 shadow-xl border border-base-200">
          {activeTab === "tickets" && <TicketsTab tickets={tickets} />}
          {activeTab === "history" && <HistoryTab attempts={attempts} />}
          {activeTab === "txHistory" && (
            <TransactionHistoryTab
              transactions={transactions}
              stats={grabStats}
              clearHistory={clearHistory}
              isLoaded={isLoaded}
            />
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
        <div className="text-6xl mb-4">🎫</div>
        <h3 className="text-lg font-semibold mb-2">你还没有票</h3>
        <p className="text-base-content/70 mb-6">去首页看看有什么活动吧！</p>
        <Link href="/">
          <button className="btn btn-primary">浏览活动</button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tickets.map(ticket => (
        <TicketCard key={ticket.id.toString()} ticket={ticket} />
      ))}
    </div>
  );
}

function TicketCard({ ticket }: { ticket: ReturnType<typeof useUserTickets>["tickets"][0] }) {
  const { nftData, isLoading } = useTokenURI(ticket.id);

  return (
    <div className="bg-gradient-to-r from-primary/5 to-secondary/5 rounded-xl border border-base-200 overflow-hidden">
      {/* NFT Image */}
      <div className="p-4 flex justify-center bg-base-200/30">
        {isLoading ? (
          <div className="w-[280px] h-[160px] flex items-center justify-center">
            <span className="loading loading-spinner loading-md text-primary"></span>
          </div>
        ) : nftData?.image ? (
          <img
            src={nftData.image}
            alt={nftData.name || "NFT Ticket"}
            className="w-[280px] h-[160px] rounded-lg shadow-lg"
          />
        ) : (
          <div className="w-[280px] h-[160px] bg-gradient-to-br from-violet-500 to-indigo-500 rounded-lg flex items-center justify-center">
            <TicketIcon className="h-16 w-16 text-white/50" />
          </div>
        )}
      </div>

      {/* Ticket Info */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-primary/20 p-3 rounded-lg">
            <TicketIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="font-semibold">{ticket.eventTitle}</div>
            <div className="text-sm text-base-content/70">票号 #{ticket.id.toString()}</div>
          </div>
        </div>
        <div className="text-right mr-4">
          <div className="text-sm text-base-content/50">获取时间</div>
          <div className="text-sm font-mono">
            {new Date(Number(ticket.acquiredAt) * 1000).toLocaleDateString("zh-CN")}
          </div>
        </div>
        <Link href={`/event/${ticket.eventId}`}>
          <button className="btn btn-ghost btn-sm">查看活动</button>
        </Link>
      </div>
    </div>
  );
}

function HistoryTab({ attempts }: { attempts: ReturnType<typeof useUserAttempts>["attempts"] }) {
  if (attempts.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📋</div>
        <h3 className="text-lg font-semibold mb-2">暂无参与记录</h3>
        <p className="text-base-content/70 mb-6">你还没有参与过任何活动</p>
        <Link href="/">
          <button className="btn btn-primary">浏览活动</button>
        </Link>
      </div>
    );
  }

  const sortedAttempts = [...attempts].reverse();

  return (
    <div className="space-y-3">
      {sortedAttempts.map((attempt, index) => (
        <div
          key={`${attempt.eventId}-${attempt.timestamp}-${index}`}
          className="flex items-center justify-between p-4 bg-base-200/50 rounded-xl"
        >
          <div className="flex items-center gap-4">
            <div
              className={`p-2 rounded-lg ${attempt.result === AttemptResult.Success ? "bg-success/20" : "bg-error/20"}`}
            >
              {attempt.result === AttemptResult.Success ? (
                <CheckCircleIcon className="h-5 w-5 text-success" />
              ) : (
                <XCircleIcon className="h-5 w-5 text-error" />
              )}
            </div>
            <div>
              <div className="font-medium">活动 #{attempt.eventId.toString()}</div>
              <div className="text-sm text-base-content/70">{getAttemptResultLabel(attempt.result)}</div>
            </div>
          </div>
          <div className="text-right text-sm text-base-content/50 font-mono">
            {new Date(Number(attempt.timestamp) * 1000).toLocaleString("zh-CN")}
          </div>
        </div>
      ))}
    </div>
  );
}

interface TransactionHistoryTabProps {
  transactions: ReturnType<typeof useTransactionHistory>["transactions"];
  stats: ReturnType<typeof useTransactionHistory>["getGrabStats"] extends () => infer R ? R : never;
  clearHistory: () => void;
  isLoaded: boolean;
}

function TransactionHistoryTab({ transactions, stats, clearHistory, isLoaded }: TransactionHistoryTabProps) {
  if (!isLoaded) {
    return (
      <div className="flex justify-center py-12">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📊</div>
        <h3 className="text-lg font-semibold mb-2">暂无交易记录</h3>
        <p className="text-base-content/70 mb-6">抢票或创建活动后，这里会显示交易统计</p>
        <Link href="/">
          <button className="btn btn-primary">浏览活动</button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <TransactionStatsSummary
        totalAttempts={stats.totalAttempts}
        successCount={stats.successCount}
        failCount={stats.failCount}
        averageConfirmTime={stats.averageConfirmTime}
        totalGasCost={stats.totalGasCost}
      />

      {/* Monad Highlight */}
      <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 rounded-xl p-4 border border-violet-500/20">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">⚡</span>
          <span className="font-semibold text-violet-400">Monad 优势</span>
        </div>
        <div className="text-sm text-base-content/70 space-y-1">
          <p>
            • 平均交易确认时间:{" "}
            <span className="font-mono font-bold text-violet-400">{stats.averageConfirmTime}ms</span>
          </p>
          <p>• 即使交易失败，Gas 成本也极低，可以放心尝试</p>
        </div>
      </div>

      {/* Transaction List */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">交易记录</h3>
          <button onClick={clearHistory} className="btn btn-ghost btn-xs gap-1 text-error">
            <TrashIcon className="h-4 w-4" />
            清除记录
          </button>
        </div>
        <div className="space-y-3">
          {transactions.map(tx => (
            <TransactionHistoryItem
              key={tx.hash}
              eventId={tx.eventId}
              eventTitle={tx.eventTitle}
              success={tx.success}
              confirmTime={tx.confirmTime}
              gasCost={tx.gasCost}
              timestamp={tx.timestamp}
              type={tx.type}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
