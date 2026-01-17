"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Address } from "@scaffold-ui/components";
import { formatEther } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import {
  ArrowLeftIcon,
  BoltIcon,
  CheckCircleIcon,
  ClockIcon,
  TicketIcon,
  TrophyIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useGrabbingSync } from "~~/hooks/useGrabbingSync";
import { useEvent, useHasTicket, useRecentTickets } from "~~/hooks/useTicketEngine";
import { useTransactionHistory } from "~~/hooks/useTransactionHistory";
import { AttemptResult, EventStatus, getStatusColor, getStatusLabel } from "~~/types/ticket-engine";
import { TransactionRecord } from "~~/types/transaction";
import { notification } from "~~/utils/scaffold-eth";

type GrabResult = {
  success: boolean;
  result: AttemptResult;
  ticketId?: bigint;
  confirmTime?: number;
  gasCost?: string;
} | null;

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = BigInt(params.id as string);

  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { event, refetch } = useEvent(eventId);
  const { hasTicket, ticketId } = useHasTicket(eventId, address);
  // Get more recent tickets for the winners panel
  const { recentTickets, refetch: refetchRecent } = useRecentTickets(eventId, 100n);
  // Real-time grabbing sync via Supabase
  const { grabbingList, startGrabbing, endGrabbing } = useGrabbingSync(eventId.toString());
  const { transactions, addTransaction } = useTransactionHistory();

  // Filter out winners from grabbing list
  const winnersSet = new Set(recentTickets.map((t: { owner: string }) => t.owner.toLowerCase()));
  const activeGrabbingList = grabbingList.filter(g => !winnersSet.has(g.wallet_address.toLowerCase()));

  // Filter transactions for this event
  const eventTransactions = transactions.filter(tx => tx.eventId === eventId.toString() && tx.type === "grab");
  const eventStats = {
    totalAttempts: eventTransactions.length,
    successCount: eventTransactions.filter(tx => tx.success).length,
    avgConfirmTime:
      eventTransactions.length > 0
        ? Math.round(eventTransactions.reduce((sum, tx) => sum + tx.confirmTime, 0) / eventTransactions.length)
        : 0,
    totalGasCost: eventTransactions.reduce((sum, tx) => sum + BigInt(tx.gasCost), 0n),
  };

  const { writeContractAsync, isPending: isMining } = useScaffoldWriteContract("TicketEngine");

  const [countdown, setCountdown] = useState("");
  const [currentStatus, setCurrentStatus] = useState<EventStatus | null>(null);
  const [grabResult, setGrabResult] = useState<GrabResult>(null);

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
          setCountdown(`${hours}时 ${minutes}分 ${seconds}秒`);
        } else if (minutes > 0) {
          setCountdown(`${minutes}分 ${seconds}秒`);
        } else {
          setCountdown(`${seconds}秒`);
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

  useEffect(() => {
    if (currentStatus !== EventStatus.InProgress) return;

    const pollInterval = setInterval(() => {
      refetch();
      refetchRecent();
    }, 1000);

    return () => clearInterval(pollInterval);
  }, [currentStatus, refetch, refetchRecent]);

  const handleGrabTicket = async () => {
    if (!address) {
      notification.error("请先连接钱包");
      return;
    }

    if (!publicClient) {
      notification.error("无法连接到网络");
      return;
    }

    let txHash: string | undefined;

    try {
      setGrabResult(null);

      // Broadcast grabbing state to all clients via Supabase
      await startGrabbing(address);

      txHash = await writeContractAsync({
        functionName: "grabTicket",
        args: [eventId],
      });

      // Start timing AFTER MetaMask confirmation
      const startTime = Date.now();

      if (txHash) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
        const confirmTime = Date.now() - startTime;

        const gasUsed = receipt.gasUsed;
        const gasPrice = receipt.effectiveGasPrice;
        const gasCost = (gasUsed * gasPrice).toString();

        const isSuccess = receipt.status === "success";

        // Update grabbing status in Supabase
        await endGrabbing(address, isSuccess);

        // Save to transaction history (persistent)
        const txRecord: TransactionRecord = {
          hash: txHash,
          type: "grab",
          eventId: eventId.toString(),
          eventTitle: event?.title,
          userAddress: address,
          success: isSuccess,
          confirmTime,
          gasUsed: gasUsed.toString(),
          gasPrice: gasPrice.toString(),
          gasCost,
          timestamp: Date.now(),
        };
        addTransaction(txRecord);

        await refetch();
        await refetchRecent();

        if (isSuccess) {
          setGrabResult({
            success: true,
            result: AttemptResult.Success,
            ticketId: ticketId,
            confirmTime,
            gasCost,
          });
          notification.success("恭喜！抢票成功！");
        } else {
          setGrabResult({
            success: false,
            result: AttemptResult.SoldOut,
            confirmTime,
            gasCost,
          });
          notification.error("抢票失败");
        }
      }
    } catch (error: unknown) {
      console.error("Grab ticket error:", error);
      // Update grabbing status on error
      if (address) {
        await endGrabbing(address, false);
      }
      await refetch();
      notification.error("抢票失败，请重试");
    }
  };

  if (!event) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  const startDate = new Date(Number(event.startTime) * 1000);
  const formattedDate = startDate.toLocaleString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const soldTickets = Number(event.totalTickets) - Number(event.remainingTickets);
  const progressPercent = (soldTickets / Number(event.totalTickets)) * 100;

  const renderButton = () => {
    if (hasTicket) {
      return (
        <button className="btn btn-success btn-lg w-full gap-2" disabled>
          <CheckCircleIcon className="h-6 w-6" />
          已获得票号 #{ticketId?.toString()}
        </button>
      );
    }

    switch (currentStatus) {
      case EventStatus.NotStarted:
        return (
          <button className="btn btn-lg w-full gap-2" disabled>
            <ClockIcon className="h-6 w-6" />
            {countdown} 后开始
          </button>
        );
      case EventStatus.InProgress:
        return (
          <button
            className="btn btn-primary btn-lg w-full animate-pulse"
            onClick={handleGrabTicket}
            disabled={isMining}
          >
            {isMining ? (
              <>
                <span className="loading loading-spinner"></span>
                抢票中...
              </>
            ) : (
              "立即抢票"
            )}
          </button>
        );
      case EventStatus.SoldOut:
        return (
          <button className="btn btn-lg w-full" disabled>
            已售罄
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-base-200 to-base-300">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.back()} className="btn btn-ghost btn-sm gap-2">
            <ArrowLeftIcon className="h-4 w-4" />
            返回
          </button>
          <span className={`badge badge-lg ${getStatusColor(currentStatus ?? event.status)}`}>
            {getStatusLabel(currentStatus ?? event.status)}
          </span>
        </div>

        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{event.title}</h1>
          <p className="text-base-content/70">开始时间: {formattedDate}</p>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard
            icon={<TicketIcon className="h-6 w-6" />}
            label="剩余票数"
            value={event.remainingTickets.toString()}
            subValue={`/ ${event.totalTickets.toString()}`}
            color="text-green-500"
            highlight={event.remainingTickets === 0n}
          />
          <StatCard
            icon={<TrophyIcon className="h-6 w-6" />}
            label="已售出"
            value={soldTickets.toString()}
            subValue="张"
            color="text-yellow-500"
          />
          <StatCard
            icon={<UserGroupIcon className="h-6 w-6" />}
            label="中签人数"
            value={recentTickets.length.toString()}
            subValue="人"
            color="text-blue-500"
          />
          <StatCard
            icon={<BoltIcon className="h-6 w-6" />}
            label="状态"
            value={
              currentStatus === EventStatus.InProgress
                ? "抢票中"
                : currentStatus === EventStatus.NotStarted
                  ? "未开始"
                  : "已结束"
            }
            color="text-purple-500"
          />
        </div>

        {/* Progress Bar */}
        <div className="bg-base-100 rounded-xl p-4 shadow-lg mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-semibold">抢票进度</span>
            <span className="text-base-content/70">
              {soldTickets} / {event.totalTickets.toString()} 张已售出
            </span>
          </div>
          <div className="w-full bg-base-200 rounded-full h-4 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Two Panels */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Left Panel - Grab Ticket */}
          <div className="bg-base-100 rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-primary to-secondary p-4">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <TicketIcon className="h-6 w-6" />
                抢票入口
              </h3>
            </div>
            <div className="p-6">
              {/* Countdown or Status */}
              {currentStatus === EventStatus.NotStarted && countdown && (
                <div className="text-center mb-6 p-4 bg-warning/10 rounded-xl border border-warning/30">
                  <div className="text-sm text-base-content/70">距离开始</div>
                  <div className="text-3xl font-bold text-warning font-mono">{countdown}</div>
                </div>
              )}

              {/* Grab Button */}
              <div className="mb-6">{renderButton()}</div>

              {/* Grab Result */}
              {grabResult && (
                <div
                  className={`p-4 rounded-xl ${grabResult.success ? "bg-success/10 border border-success/30" : "bg-error/10 border border-error/30"}`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    {grabResult.success ? (
                      <span className="text-success font-bold">🎉 抢票成功！</span>
                    ) : (
                      <span className="text-error font-bold">😥 抢票失败</span>
                    )}
                  </div>
                  {grabResult.confirmTime !== undefined && (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-base-content/50">确认时间</div>
                        <div className="font-mono font-bold text-green-500">{grabResult.confirmTime}ms</div>
                      </div>
                      <div>
                        <div className="text-base-content/50">Gas 费用</div>
                        <div className="font-mono font-bold text-yellow-500">
                          {parseFloat(formatEther(BigInt(grabResult.gasCost || "0"))).toFixed(6)} MON
                        </div>
                      </div>
                    </div>
                  )}
                  {grabResult.success && grabResult.ticketId && (
                    <div className="mt-3 text-center">
                      <span className="badge badge-success badge-lg">票号 #{grabResult.ticketId.toString()}</span>
                    </div>
                  )}
                </div>
              )}

              {grabResult?.success && (
                <button className="btn btn-ghost w-full mt-4" onClick={() => router.push("/me")}>
                  去我的票夹 →
                </button>
              )}

              {/* Persistent Stats - Always show if there are transactions */}
              {eventStats.totalAttempts > 0 && (
                <div className="mt-6 p-4 bg-gradient-to-br from-violet-500/10 to-purple-500/10 rounded-xl border border-violet-500/20">
                  <h4 className="font-semibold mb-3 text-sm flex items-center gap-2">
                    <BoltIcon className="h-4 w-4 text-violet-500" />
                    Monad 性能统计
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-base-100/50 rounded-lg p-3 text-center">
                      <div className="text-xs text-base-content/50">平均确认时间</div>
                      <div className="text-xl font-bold font-mono text-green-500">{eventStats.avgConfirmTime}ms</div>
                    </div>
                    <div className="bg-base-100/50 rounded-lg p-3 text-center">
                      <div className="text-xs text-base-content/50">总 Gas 消耗</div>
                      <div className="text-lg font-bold font-mono text-yellow-500">
                        {parseFloat(formatEther(eventStats.totalGasCost)).toFixed(6)} MON
                      </div>
                    </div>
                    <div className="bg-base-100/50 rounded-lg p-3 text-center">
                      <div className="text-xs text-base-content/50">尝试次数</div>
                      <div className="text-xl font-bold font-mono text-blue-500">{eventStats.totalAttempts}</div>
                    </div>
                    <div className="bg-base-100/50 rounded-lg p-3 text-center">
                      <div className="text-xs text-base-content/50">成功率</div>
                      <div className="text-xl font-bold font-mono text-purple-500">
                        {eventStats.totalAttempts > 0
                          ? ((eventStats.successCount / eventStats.totalAttempts) * 100).toFixed(0)
                          : 0}
                        %
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Rules */}
              <div className="mt-6 p-4 bg-base-200/50 rounded-xl">
                <h4 className="font-semibold mb-2 text-sm">规则说明</h4>
                <ul className="text-xs space-y-1 text-base-content/70">
                  <li>• 规则：先到先得</li>
                  <li>• 限购：每个参与者最多 1 张</li>
                  <li>• 结束：售罄自动结束</li>
                </ul>
              </div>

              {/* Organizer */}
              <div className="mt-4 pt-4 border-t border-base-200 text-sm flex justify-between items-center">
                <span className="text-base-content/70">主办方</span>
                <Address address={event.organizer} />
              </div>
            </div>
          </div>

          {/* Right Panel - Split into Grabbing and Winners */}
          <div className="flex flex-col gap-4">
            {/* Top Section - Currently Grabbing (Real-time via Supabase) */}
            <div className="bg-base-100 rounded-2xl shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-4">
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  <UserGroupIcon className="h-6 w-6" />
                  正在抢票
                  <span className="badge badge-ghost ml-auto">{activeGrabbingList.length} 人</span>
                </h3>
              </div>
              <div className="p-4 h-[200px] overflow-y-auto">
                {activeGrabbingList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-base-content/50">
                    <UserGroupIcon className="h-12 w-12 mb-2 opacity-30" />
                    <p className="text-sm">暂无用户正在抢票...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {activeGrabbingList.slice(0, 20).map((participant, index) => (
                      <div
                        key={`${participant.wallet_address}-${index}`}
                        className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-500/5 to-cyan-500/5 rounded-lg border border-blue-500/20"
                      >
                        <div className="flex items-center gap-3">
                          <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                          </span>
                          <span className="font-mono text-sm">
                            {participant.wallet_address.slice(0, 8)}...{participant.wallet_address.slice(-6)}
                          </span>
                        </div>
                        <span className="text-xs text-base-content/50">抢票中...</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Section - Winners */}
            <div className="bg-base-100 rounded-2xl shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-yellow-500 to-orange-500 p-4">
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  <TrophyIcon className="h-6 w-6" />
                  中签榜单
                  <span className="badge badge-ghost ml-auto">
                    {recentTickets.length} / {event.totalTickets.toString()}
                  </span>
                </h3>
              </div>
              <div className="p-4 h-[280px] overflow-y-auto">
                {recentTickets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-base-content/50">
                    <TrophyIcon className="h-16 w-16 mb-4 opacity-30" />
                    <p>等待幸运儿出现...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {recentTickets.map((ticket: { ticketId: bigint; owner: string; acquiredAt: bigint }) => (
                      <div
                        key={ticket.ticketId.toString()}
                        className="flex items-center justify-between p-3 bg-gradient-to-r from-yellow-500/5 to-orange-500/5 rounded-lg border border-yellow-500/20"
                      >
                        <div className="flex items-center gap-3">
                          <span className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs font-bold px-2 py-1 rounded">
                            #{ticket.ticketId.toString()}
                          </span>
                          <span className="font-mono text-sm">
                            {ticket.owner.slice(0, 8)}...{ticket.owner.slice(-6)}
                          </span>
                        </div>
                        <span className="text-xs text-base-content/50">{formatTimeAgo(Number(ticket.acquiredAt))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Transaction History - Persistent from localStorage */}
        {eventTransactions.length > 0 && (
          <div className="bg-base-100 rounded-2xl shadow-xl overflow-hidden mb-6">
            <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-4">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <BoltIcon className="h-6 w-6" />
                抢票记录
                <span className="badge badge-ghost ml-auto">{eventTransactions.length} 次尝试</span>
              </h3>
            </div>
            <div className="p-4">
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {eventTransactions.map((tx, index) => (
                  <div
                    key={tx.hash}
                    className={`flex items-center justify-between p-3 rounded-lg text-sm ${
                      tx.success ? "bg-success/10 border border-success/30" : "bg-base-200/50"
                    } ${index === 0 ? "ring-2 ring-primary" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${tx.success ? "bg-success" : "bg-base-content/30"}`} />
                      <span className="font-mono text-xs">
                        {tx.userAddress
                          ? `${tx.userAddress.slice(0, 8)}...${tx.userAddress.slice(-6)}`
                          : `${tx.hash.slice(0, 10)}...${tx.hash.slice(-8)}`}
                      </span>
                      {tx.success ? (
                        <span className="badge badge-success badge-sm">成功</span>
                      ) : (
                        <span className="badge badge-error badge-sm">失败</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-xs text-green-500">{tx.confirmTime}ms</span>
                      <span className="font-mono text-xs text-yellow-500">
                        {parseFloat(formatEther(BigInt(tx.gasCost))).toFixed(6)} MON
                      </span>
                      <span className="text-xs text-base-content/50">
                        {new Date(tx.timestamp).toLocaleTimeString("zh-CN")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-base-content/50 space-y-1">
          <p>本活动将按公开规则执行，结果以系统裁定为准。</p>
          <p>V1 不提供实名核验，不保证现实意义的一人一票。</p>
        </div>
      </div>
    </div>
  );
}

// ============ Helper Components ============
function StatCard({
  icon,
  label,
  value,
  subValue,
  color,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div className={`bg-base-100 rounded-xl p-3 shadow-lg ${highlight ? "ring-2 ring-error" : ""}`}>
      <div className={`${color} mb-1`}>{icon}</div>
      <div className="text-xs text-base-content/70">{label}</div>
      <div className="text-xl font-bold font-mono">
        {value}
        {subValue && <span className="text-sm font-normal text-base-content/50"> {subValue}</span>}
      </div>
    </div>
  );
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return `${seconds}秒前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  return `${hours}小时前`;
}
