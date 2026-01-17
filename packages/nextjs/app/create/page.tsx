"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, usePublicClient } from "wagmi";
import { ArrowLeftIcon, CalendarIcon, CheckIcon, ClipboardDocumentIcon, TicketIcon } from "@heroicons/react/24/outline";
import { TransactionStatsDisplay } from "~~/components/TransactionStats";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useTransactionHistory } from "~~/hooks/useTransactionHistory";
import { TransactionRecord } from "~~/types/transaction";
import { notification } from "~~/utils/scaffold-eth";

type TxStats = {
  confirmTime: number;
  gasCost: string;
} | null;

export default function CreateEventPage() {
  const router = useRouter();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending: isMining } = useScaffoldWriteContract("TicketEngine");
  const { addTransaction } = useTransactionHistory();

  const { data: nextEventId } = useScaffoldReadContract({
    contractName: "TicketEngine",
    functionName: "nextEventId",
  });

  const [title, setTitle] = useState("");
  const [startDateTime, setStartDateTime] = useState("");
  const [totalTickets, setTotalTickets] = useState("");
  const [createdEventId, setCreatedEventId] = useState<bigint | null>(null);
  const [copied, setCopied] = useState(false);
  const [txStats, setTxStats] = useState<TxStats>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!address) {
      notification.error("请先连接钱包");
      return;
    }

    if (!publicClient) {
      notification.error("无法连接到网络");
      return;
    }

    if (!title.trim()) {
      notification.error("请输入活动标题");
      return;
    }

    const startTime = Math.floor(new Date(startDateTime).getTime() / 1000);
    if (startTime <= Math.floor(Date.now() / 1000)) {
      notification.error("开始时间必须在未来");
      return;
    }

    const tickets = parseInt(totalTickets);
    if (isNaN(tickets) || tickets <= 0) {
      notification.error("请输入有效的票数");
      return;
    }

    let txHash: string | undefined;

    try {
      txHash = await writeContractAsync({
        functionName: "createEvent",
        args: [title.trim(), BigInt(startTime), BigInt(tickets)],
      });

      // Start timing AFTER MetaMask confirmation (after writeContractAsync returns)
      const txStartTime = Date.now();

      // Get transaction receipt to get gas info
      let gasCost = "0";
      let confirmTime = 0;
      if (txHash) {
        try {
          const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
          confirmTime = Date.now() - txStartTime;

          const gasUsed = receipt.gasUsed;
          const gasPrice = receipt.effectiveGasPrice;
          gasCost = (gasUsed * gasPrice).toString();

          // Save to transaction history
          const txRecord: TransactionRecord = {
            hash: txHash,
            type: "create",
            eventId: nextEventId?.toString(),
            eventTitle: title.trim(),
            userAddress: address,
            success: true,
            confirmTime,
            gasUsed: gasUsed.toString(),
            gasPrice: gasPrice.toString(),
            gasCost,
            timestamp: Date.now(),
          };
          addTransaction(txRecord);
        } catch (err) {
          console.warn("Failed to get transaction receipt:", err);
        }
      }

      setTxStats({ confirmTime, gasCost });
      notification.success("活动创建成功！");
      setCreatedEventId(nextEventId ?? 1n);
    } catch (error) {
      console.error("Create event error:", error);
      notification.error("创建失败，请重试");
    }
  };

  const eventUrl = createdEventId
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/event/${createdEventId}`
    : "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(eventUrl);
    setCopied(true);
    notification.success("链接已复制");
    setTimeout(() => setCopied(false), 2000);
  };

  const minDateTime = new Date(Date.now() + 60000).toISOString().slice(0, 16);

  if (createdEventId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-base-200/30">
        <div className="bg-base-100 rounded-2xl p-8 shadow-xl max-w-md w-full border border-base-200">
          <div className="text-center">
            <div className="text-7xl mb-4">🎉</div>
            <h1 className="text-2xl font-bold mb-2">发布成功！</h1>
            <p className="text-base-content/70 mb-6">你的活动已创建，可以分享给参与者了</p>
          </div>

          {txStats && (
            <div className="mb-6">
              <TransactionStatsDisplay
                success={true}
                confirmTime={txStats.confirmTime}
                gasCost={txStats.gasCost}
                message="活动创建交易已确认"
              />
            </div>
          )}

          <div className="bg-base-200/50 rounded-lg p-4 mb-6">
            <label className="text-sm text-base-content/70 block mb-2">活动链接</label>
            <div className="flex gap-2">
              <input type="text" value={eventUrl} readOnly className="input input-bordered flex-1 text-sm font-mono" />
              <button onClick={handleCopy} className="btn btn-primary btn-square">
                {copied ? <CheckIcon className="h-5 w-5" /> : <ClipboardDocumentIcon className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <button onClick={() => router.push(`/event/${createdEventId}`)} className="btn btn-primary w-full">
              查看活动
            </button>
            <button onClick={() => router.push("/")} className="btn btn-ghost w-full">
              返回首页
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-base-200/30">
      <div className="max-w-lg mx-auto">
        <button onClick={() => router.back()} className="btn btn-ghost btn-sm gap-2 mb-6">
          <ArrowLeftIcon className="h-4 w-4" />
          返回
        </button>

        <div className="bg-base-100 rounded-2xl p-6 shadow-xl border border-base-200">
          <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <TicketIcon className="h-6 w-6 text-primary" />
            创建活动
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">活动标题 *</span>
              </label>
              <input
                type="text"
                placeholder="例如：Web3 Hackathon 门票"
                className="input input-bordered w-full"
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={100}
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium flex items-center gap-1">
                  <CalendarIcon className="h-4 w-4" />
                  开始时间 *
                </span>
              </label>
              <input
                type="datetime-local"
                className="input input-bordered w-full"
                value={startDateTime}
                onChange={e => setStartDateTime(e.target.value)}
                min={minDateTime}
                required
              />
              <label className="label">
                <span className="label-text-alt text-base-content/50">到达此时间后，用户可以开始抢票</span>
              </label>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium flex items-center gap-1">
                  <TicketIcon className="h-4 w-4" />
                  总票数 *
                </span>
              </label>
              <input
                type="number"
                placeholder="例如：100"
                className="input input-bordered w-full"
                value={totalTickets}
                onChange={e => setTotalTickets(e.target.value)}
                min={1}
                max={10000}
                required
              />
            </div>

            <div className="bg-base-200/50 rounded-lg p-4">
              <h3 className="font-medium mb-2">规则（V1 固定）</h3>
              <ul className="text-sm text-base-content/70 space-y-1">
                <li>• 先到先得</li>
                <li>• 每个参与者最多 1 张</li>
              </ul>
            </div>

            <button type="submit" className="btn btn-primary w-full btn-lg" disabled={isMining || !address}>
              {isMining ? (
                <>
                  <span className="loading loading-spinner"></span>
                  创建中...
                </>
              ) : !address ? (
                "请先连接钱包"
              ) : (
                "发布活动"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
