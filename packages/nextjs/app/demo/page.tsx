"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatEther } from "viem";
import {
  ArrowPathIcon,
  BoltIcon,
  ChartBarIcon,
  PlayIcon,
  StopIcon,
  TicketIcon,
  TrophyIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";

// ============ Types ============
interface Participant {
  id: number;
  address: string;
  success: boolean;
  confirmTime: number;
  gasCost: bigint;
  timestamp: number;
  ticketNumber?: number;
}

interface Winner {
  address: string;
  ticketNumber: number;
  confirmTime: number;
  timestamp: number;
}

// ============ Constants ============
const TOTAL_USERS = 10000;
const TOTAL_TICKETS = 100;
const MONAD_TPS = 10000;
const AVG_CONFIRM_TIME = 400;
const CONFIRM_TIME_VARIANCE = 200;
const AVG_GAS_COST = 42000000000000n;
const GAS_VARIANCE = 10000000000000n;

const generateAddress = (seed: number): string => {
  const chars = "0123456789abcdef";
  let addr = "0x";
  let hash = seed;
  for (let i = 0; i < 40; i++) {
    hash = (hash * 1103515245 + 12345) & 0x7fffffff;
    addr += chars[hash % 16];
  }
  return addr;
};

const USER_ADDRESSES = Array.from({ length: TOTAL_USERS }, (_, i) => generateAddress(i + 1000));

// ============ Main Component ============
export default function DemoPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [remainingTickets, setRemainingTickets] = useState(TOTAL_TICKETS);
  const [processedUsers, setProcessedUsers] = useState(0);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [currentTps, setCurrentTps] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const tpsWindowRef = useRef<number[]>([]);
  const winnersRef = useRef<Winner[]>([]);
  const ticketCounterRef = useRef<number>(1);

  const reset = useCallback(() => {
    setIsRunning(false);
    setRemainingTickets(TOTAL_TICKETS);
    setProcessedUsers(0);
    setParticipants([]);
    setWinners([]);
    setCurrentTps(0);
    setElapsedTime(0);
    tpsWindowRef.current = [];
    winnersRef.current = [];
    ticketCounterRef.current = 1;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const generateParticipant = useCallback((userId: number, ticketsLeft: number): Participant => {
    const success = ticketsLeft > 0 && Math.random() < 0.02;
    const confirmTime = Math.round(AVG_CONFIRM_TIME + (Math.random() - 0.5) * 2 * CONFIRM_TIME_VARIANCE);
    const gasVariance = BigInt(Math.floor((Math.random() - 0.5) * 2 * Number(GAS_VARIANCE)));
    const gasCost = AVG_GAS_COST + gasVariance;
    const address = USER_ADDRESSES[userId % USER_ADDRESSES.length];

    const participant: Participant = {
      id: userId,
      address,
      success,
      confirmTime,
      gasCost,
      timestamp: Date.now(),
    };

    if (success) {
      participant.ticketNumber = ticketCounterRef.current++;
      const winner: Winner = {
        address,
        ticketNumber: participant.ticketNumber,
        confirmTime,
        timestamp: Date.now(),
      };
      winnersRef.current = [...winnersRef.current, winner];
    }

    return participant;
  }, []);

  const startSimulation = useCallback(() => {
    reset();
    setIsRunning(true);
    startTimeRef.current = Date.now();

    let ticketsLeft = TOTAL_TICKETS;
    let usersProcessed = 0;

    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = now - startTimeRef.current;
      setElapsedTime(elapsed);

      const batchSize = Math.min(Math.floor(MONAD_TPS / 20), TOTAL_USERS - usersProcessed);

      if (batchSize <= 0 || usersProcessed >= TOTAL_USERS) {
        setIsRunning(false);
        setWinners([...winnersRef.current]);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }

      const newParticipants: Participant[] = [];
      for (let i = 0; i < batchSize; i++) {
        if (ticketsLeft <= 0) {
          const address = USER_ADDRESSES[(usersProcessed + i) % USER_ADDRESSES.length];
          const confirmTime = Math.round(AVG_CONFIRM_TIME + (Math.random() - 0.5) * 2 * CONFIRM_TIME_VARIANCE);
          const gasVariance = BigInt(Math.floor((Math.random() - 0.5) * 2 * Number(GAS_VARIANCE)));
          newParticipants.push({
            id: usersProcessed + i,
            address,
            success: false,
            confirmTime,
            gasCost: AVG_GAS_COST + gasVariance,
            timestamp: Date.now(),
          });
        } else {
          const participant = generateParticipant(usersProcessed + i, ticketsLeft);
          if (participant.success) {
            ticketsLeft--;
          }
          newParticipants.push(participant);
        }
      }

      usersProcessed += batchSize;
      setProcessedUsers(usersProcessed);
      setRemainingTickets(ticketsLeft);
      setParticipants(prev => [...newParticipants.slice(-20), ...prev].slice(0, 100));
      setWinners([...winnersRef.current]);

      tpsWindowRef.current.push(batchSize);
      if (tpsWindowRef.current.length > 20) {
        tpsWindowRef.current.shift();
      }
      const avgTps = tpsWindowRef.current.reduce((a, b) => a + b, 0) * 20;
      setCurrentTps(avgTps);
    }, 50);
  }, [reset, generateParticipant]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const avgConfirmTime =
    participants.length > 0
      ? Math.round(participants.reduce((sum, p) => sum + p.confirmTime, 0) / participants.length)
      : 0;

  const isComplete = processedUsers > 0 && !isRunning;

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-base-200 to-base-300">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-violet-500 to-purple-500 bg-clip-text text-transparent">
            Monad 性能压力测试
          </h1>
          <p className="text-base-content/70">模拟 10,000 人同时抢 100 张票的极端场景</p>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatCard
            icon={<UserGroupIcon className="h-6 w-6" />}
            label="参与人数"
            value={`${processedUsers.toLocaleString()}`}
            subValue={`/ ${TOTAL_USERS.toLocaleString()}`}
            color="text-blue-500"
          />
          <StatCard
            icon={<TicketIcon className="h-6 w-6" />}
            label="剩余票数"
            value={remainingTickets.toString()}
            subValue={`/ ${TOTAL_TICKETS}`}
            color="text-green-500"
            highlight={remainingTickets === 0}
          />
          <StatCard
            icon={<TrophyIcon className="h-6 w-6" />}
            label="已中签"
            value={winners.length.toString()}
            subValue="人"
            color="text-yellow-500"
          />
          <StatCard
            icon={<BoltIcon className="h-6 w-6" />}
            label="当前 TPS"
            value={currentTps.toLocaleString()}
            color="text-orange-500"
          />
          <StatCard
            icon={<ChartBarIcon className="h-6 w-6" />}
            label="耗时"
            value={`${(elapsedTime / 1000).toFixed(2)}`}
            subValue="秒"
            color="text-purple-500"
          />
        </div>

        {/* Progress Bar */}
        <div className="bg-base-100 rounded-xl p-4 shadow-lg mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-semibold">抢票进度</span>
            <span className="text-base-content/70">
              {TOTAL_TICKETS - remainingTickets} / {TOTAL_TICKETS} 张已售出
            </span>
          </div>
          <div className="w-full bg-base-200 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-100"
              style={{ width: `${((TOTAL_TICKETS - remainingTickets) / TOTAL_TICKETS) * 100}%` }}
            />
          </div>
        </div>

        {/* Control Button */}
        <div className="flex justify-center gap-4 mb-6">
          {!isRunning ? (
            <button onClick={startSimulation} className="btn btn-primary btn-lg gap-2 px-8">
              <PlayIcon className="h-6 w-6" />
              开始测试
            </button>
          ) : (
            <button onClick={() => setIsRunning(false)} className="btn btn-error btn-lg gap-2 px-8">
              <StopIcon className="h-6 w-6" />
              停止测试
            </button>
          )}
          {(processedUsers > 0 || participants.length > 0) && (
            <button onClick={reset} className="btn btn-ghost btn-lg gap-2">
              <ArrowPathIcon className="h-6 w-6" />
              重置
            </button>
          )}
        </div>

        {/* Two Panels */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left Panel - Live Transaction Feed */}
          <div className="bg-base-100 rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-4">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${isRunning ? "bg-white animate-pulse" : "bg-white/50"}`} />
                实时交易流
                <span className="badge badge-ghost ml-auto">已处理 {processedUsers.toLocaleString()} 笔</span>
              </h3>
            </div>
            <div className="p-4 h-[500px] overflow-y-auto">
              {participants.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-base-content/50">
                  <UserGroupIcon className="h-16 w-16 mb-4 opacity-30" />
                  <p>点击「开始测试」查看实时交易</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {participants.map((p, index) => (
                    <div
                      key={`${p.id}-${p.timestamp}`}
                      className={`flex items-center justify-between p-3 rounded-lg text-sm ${
                        p.success ? "bg-success/10 border border-success/30" : "bg-base-200/50"
                      } ${index === 0 ? "ring-2 ring-primary animate-pulse" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${p.success ? "bg-success" : "bg-base-content/30"}`} />
                        <span className="font-mono text-xs">
                          {p.address.slice(0, 8)}...{p.address.slice(-6)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {p.success ? (
                          <span className="badge badge-success badge-sm">#{p.ticketNumber}</span>
                        ) : (
                          <span className="text-base-content/40 text-xs">未中签</span>
                        )}
                        <span className="font-mono text-xs text-base-content/50">{p.confirmTime}ms</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Winners */}
          <div className="bg-base-100 rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-yellow-500 to-orange-500 p-4">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <TrophyIcon className="h-6 w-6" />
                抢到票的钱包
                <span className="badge badge-ghost ml-auto">
                  {winners.length} / {TOTAL_TICKETS}
                </span>
              </h3>
            </div>
            <div className="p-4 h-[500px] overflow-y-auto">
              {winners.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-base-content/50">
                  <TrophyIcon className="h-16 w-16 mb-4 opacity-30" />
                  <p>等待幸运儿出现...</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {winners.map(winner => (
                    <div
                      key={winner.ticketNumber}
                      className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 rounded-lg p-3 border border-yellow-500/20"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs font-bold px-2 py-1 rounded">
                          #{winner.ticketNumber}
                        </span>
                        <span className="text-xs text-base-content/50">{winner.confirmTime}ms</span>
                      </div>
                      <div className="font-mono text-xs text-base-content/70">
                        {winner.address.slice(0, 8)}...{winner.address.slice(-6)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Completion Summary */}
        {isComplete && (
          <div className="mt-6 bg-gradient-to-r from-violet-500/10 to-purple-500/10 rounded-2xl p-6 border border-violet-500/20">
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-4 bg-gradient-to-r from-violet-500 to-purple-500 bg-clip-text text-transparent">
                测试完成!
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-base-100/50 rounded-xl p-4">
                  <div className="text-sm text-base-content/70">处理交易数</div>
                  <div className="text-2xl font-bold font-mono text-primary">{processedUsers.toLocaleString()}</div>
                </div>
                <div className="bg-base-100/50 rounded-xl p-4">
                  <div className="text-sm text-base-content/70">总耗时</div>
                  <div className="text-2xl font-bold font-mono text-purple-500">{(elapsedTime / 1000).toFixed(2)}s</div>
                </div>
                <div className="bg-base-100/50 rounded-xl p-4">
                  <div className="text-sm text-base-content/70">平均确认时间</div>
                  <div className="text-2xl font-bold font-mono text-green-500">{avgConfirmTime}ms</div>
                </div>
                <div className="bg-base-100/50 rounded-xl p-4">
                  <div className="text-sm text-base-content/70">中签率</div>
                  <div className="text-2xl font-bold font-mono text-yellow-500">
                    {((winners.length / processedUsers) * 100).toFixed(2)}%
                  </div>
                </div>
              </div>
              <p className="text-base-content/70">
                Monad 以 <span className="font-bold text-primary">{avgConfirmTime}ms</span> 的平均确认时间，
                <span className="font-bold text-primary">{formatEther(AVG_GAS_COST)} MON</span> 的超低 Gas
                费用，轻松应对万人抢票场景
              </p>
            </div>
          </div>
        )}

        {/* Back Link */}
        <div className="text-center mt-8">
          <Link href="/" className="btn btn-ghost">
            ← 返回首页
          </Link>
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
    <div className={`bg-base-100 rounded-xl p-3 shadow-lg ${highlight ? "ring-2 ring-success" : ""}`}>
      <div className={`${color} mb-1`}>{icon}</div>
      <div className="text-xs text-base-content/70">{label}</div>
      <div className="text-xl font-bold font-mono">
        {value}
        {subValue && <span className="text-sm font-normal text-base-content/50"> {subValue}</span>}
      </div>
    </div>
  );
}
