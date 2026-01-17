"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EventStatus, TicketEvent, getStatusColor, getStatusLabel } from "~~/types/ticket-engine";

interface EventCardProps {
  event: TicketEvent;
}

export const EventCard = ({ event }: EventCardProps) => {
  const [countdown, setCountdown] = useState("");
  const [currentStatus, setCurrentStatus] = useState(event.status);

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
        setCountdown(`${days}天 ${hours % 24}时`);
      } else if (hours > 0) {
        setCountdown(`${hours}时 ${minutes}分 ${seconds}秒`);
      } else if (minutes > 0) {
        setCountdown(`${minutes}分 ${seconds}秒`);
      } else {
        setCountdown(`${seconds}秒`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [event.startTime, event.remainingTickets]);

  const startDate = new Date(Number(event.startTime) * 1000);
  const formattedDate = startDate.toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const getButtonText = () => {
    switch (currentStatus) {
      case EventStatus.NotStarted:
        return "查看详情";
      case EventStatus.InProgress:
        return "去抢票";
      case EventStatus.SoldOut:
        return "查看结果";
    }
  };

  const getButtonClass = () => {
    switch (currentStatus) {
      case EventStatus.NotStarted:
        return "btn-outline btn-primary";
      case EventStatus.InProgress:
        return "btn-primary animate-pulse";
      case EventStatus.SoldOut:
        return "btn-ghost";
    }
  };

  return (
    <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 border border-base-200">
      <div className="card-body">
        <div className="flex justify-between items-start gap-2">
          <h2 className="card-title text-lg line-clamp-2">{event.title}</h2>
          <span className={`badge ${getStatusColor(currentStatus)} shrink-0`}>{getStatusLabel(currentStatus)}</span>
        </div>

        <div className="flex flex-col gap-1 text-sm text-base-content/70">
          <div className="flex items-center gap-2">
            <span>开始:</span>
            <span className="font-mono">{formattedDate}</span>
          </div>
          {countdown && (
            <div className="flex items-center gap-2">
              <span>倒计时:</span>
              <span className="font-mono text-warning font-semibold">{countdown}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-2 p-3 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-lg border border-base-200">
          <span className="text-sm text-base-content/70">剩余票数</span>
          <div className="text-right">
            <span className="text-3xl font-bold text-primary">{event.remainingTickets.toString()}</span>
            <span className="text-base-content/50 text-sm"> / {event.totalTickets.toString()}</span>
          </div>
        </div>

        <div className="card-actions justify-end mt-4">
          <Link href={`/event/${event.id}`} className="w-full">
            <button className={`btn ${getButtonClass()} w-full`}>{getButtonText()}</button>
          </Link>
        </div>
      </div>
    </div>
  );
};
