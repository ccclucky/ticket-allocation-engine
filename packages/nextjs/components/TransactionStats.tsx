"use client";

import { formatEther } from "viem";
import { BoltIcon, CheckCircleIcon, CurrencyDollarIcon, XCircleIcon } from "@heroicons/react/24/outline";

interface TransactionStatsDisplayProps {
  success: boolean;
  confirmTime: number;
  gasCost: string;
  message?: string;
  failReason?: string;
}

export const TransactionStatsDisplay = ({
  success,
  confirmTime,
  gasCost,
  message,
  failReason,
}: TransactionStatsDisplayProps) => {
  const gasCostFormatted = formatEther(BigInt(gasCost));
  const gasCostDisplay = parseFloat(gasCostFormatted).toFixed(8);

  return (
    <div className={`alert ${success ? "alert-success" : "alert-error"} shadow-lg`}>
      <div className="flex flex-col w-full gap-3">
        <div className="flex items-center gap-2">
          {success ? <CheckCircleIcon className="h-6 w-6 shrink-0" /> : <XCircleIcon className="h-6 w-6 shrink-0" />}
          <span className="font-bold text-lg">{success ? "交易成功" : "交易失败"}</span>
        </div>

        {message && <div className="text-sm">{message}</div>}
        {!success && failReason && <div className="text-sm opacity-80">{failReason}</div>}

        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-1.5 bg-base-100/20 rounded-lg px-3 py-1.5">
            <BoltIcon className="h-4 w-4" />
            <span className="font-medium">确认耗时:</span>
            <span className="font-mono font-bold">{confirmTime}ms</span>
          </div>
          <div className="flex items-center gap-1.5 bg-base-100/20 rounded-lg px-3 py-1.5">
            <CurrencyDollarIcon className="h-4 w-4" />
            <span className="font-medium">Gas 费用:</span>
            <span className="font-mono font-bold">{gasCostDisplay} MON</span>
          </div>
        </div>

        {!success && (
          <div className="text-xs opacity-70 flex items-center gap-1">
            <span>💡</span>
            <span>即使失败，成本也极低，可以放心尝试</span>
          </div>
        )}
      </div>
    </div>
  );
};

interface TransactionStatsSummaryProps {
  totalAttempts: number;
  successCount: number;
  failCount: number;
  averageConfirmTime: number;
  totalGasCost: string;
}

export const TransactionStatsSummary = ({
  totalAttempts,
  successCount,
  failCount,
  averageConfirmTime,
  totalGasCost,
}: TransactionStatsSummaryProps) => {
  if (totalAttempts === 0) return null;

  const gasCostFormatted = formatEther(BigInt(totalGasCost));
  const gasCostDisplay = parseFloat(gasCostFormatted).toFixed(8);

  return (
    <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-xl p-4 border border-base-200">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">📊</span>
        <span className="font-semibold">交易统计</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div className="bg-base-100/50 rounded-lg p-3 text-center">
          <div className="text-base-content/70">总尝试</div>
          <div className="font-bold text-lg">{totalAttempts}次</div>
        </div>
        <div className="bg-base-100/50 rounded-lg p-3 text-center">
          <div className="text-base-content/70">成功/失败</div>
          <div className="font-bold text-lg">
            <span className="text-success">{successCount}</span>
            <span className="text-base-content/50">/</span>
            <span className="text-error">{failCount}</span>
          </div>
        </div>
        <div className="bg-base-100/50 rounded-lg p-3 text-center">
          <div className="text-base-content/70 flex items-center justify-center gap-1">
            <BoltIcon className="h-3 w-3" />
            平均耗时
          </div>
          <div className="font-bold font-mono text-lg">{averageConfirmTime}ms</div>
        </div>
        <div className="bg-base-100/50 rounded-lg p-3 text-center">
          <div className="text-base-content/70 flex items-center justify-center gap-1">
            <CurrencyDollarIcon className="h-3 w-3" />总 Gas
          </div>
          <div className="font-bold font-mono text-lg">{gasCostDisplay}</div>
        </div>
      </div>
    </div>
  );
};

interface TransactionHistoryItemProps {
  eventId?: string;
  eventTitle?: string;
  success: boolean;
  confirmTime: number;
  gasCost: string;
  timestamp: number;
  type: "grab" | "create";
}

export const TransactionHistoryItem = ({
  eventId,
  eventTitle,
  success,
  confirmTime,
  gasCost,
  timestamp,
  type,
}: TransactionHistoryItemProps) => {
  const gasCostFormatted = formatEther(BigInt(gasCost));
  const gasCostDisplay = parseFloat(gasCostFormatted).toFixed(8);
  const timeAgo = formatTimeAgo(timestamp);

  return (
    <div className="flex items-center justify-between p-4 bg-base-200/50 rounded-xl">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${success ? "bg-success/20" : "bg-error/20"}`}>
          {success ? (
            <CheckCircleIcon className="h-5 w-5 text-success" />
          ) : (
            <XCircleIcon className="h-5 w-5 text-error" />
          )}
        </div>
        <div>
          <div className="font-medium">
            {type === "grab" ? "抢票" : "创建活动"}
            {eventTitle ? ` - ${eventTitle}` : eventId ? ` #${eventId}` : ""}
          </div>
          <div className="text-sm text-base-content/70">{success ? "成功" : "失败"}</div>
        </div>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <div className="text-right">
          <div className="flex items-center gap-1 text-base-content/70">
            <BoltIcon className="h-3 w-3" />
            <span className="font-mono">{confirmTime}ms</span>
          </div>
          <div className="flex items-center gap-1 text-base-content/70">
            <CurrencyDollarIcon className="h-3 w-3" />
            <span className="font-mono">{gasCostDisplay} MON</span>
          </div>
        </div>
        <div className="text-base-content/50 text-xs min-w-[60px] text-right">{timeAgo}</div>
      </div>
    </div>
  );
};

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}秒前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}
