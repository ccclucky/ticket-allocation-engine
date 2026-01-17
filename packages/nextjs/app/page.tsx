"use client";

import Link from "next/link";
import type { NextPage } from "next";
import { PlusCircleIcon, TicketIcon } from "@heroicons/react/24/outline";
import { EventCard } from "~~/components/ticket-engine";
import { useTicketEngine } from "~~/hooks/useTicketEngine";

const Home: NextPage = () => {
  const { events } = useTicketEngine();

  const sortedEvents = [...events].sort((a, b) => {
    const statusOrder: Record<number, number> = { 1: 0, 0: 1, 2: 2 };
    return statusOrder[a.status] - statusOrder[b.status];
  });

  return (
    <div className="flex flex-col grow">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-primary/10 via-base-100 to-secondary/10 py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-primary/10 rounded-full">
              <TicketIcon className="h-16 w-16 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            抢票裁定引擎
          </h1>
          <p className="text-lg text-base-content/70 mb-8 max-w-2xl mx-auto">
            公平、透明、先到先得的链上抢票系统
            <br />
            <span className="text-sm">First-come-first-served ticket allocation with on-chain transparency</span>
          </p>
          <Link href="/create">
            <button className="btn btn-primary btn-lg gap-2 shadow-lg hover:shadow-xl transition-shadow">
              <PlusCircleIcon className="h-6 w-6" />
              创建活动
            </button>
          </Link>
        </div>
      </div>

      {/* Events Grid */}
      <div className="flex-grow p-4 md:p-8 bg-base-200/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <TicketIcon className="h-6 w-6 text-primary" />
            活动广场
          </h2>

          {events.length === 0 ? (
            <div className="text-center py-16 bg-base-100 rounded-2xl shadow-sm">
              <div className="text-7xl mb-6">🎫</div>
              <h3 className="text-xl font-semibold mb-2">暂无活动</h3>
              <p className="text-base-content/70 mb-6">成为第一个创建抢票活动的人吧！</p>
              <Link href="/create">
                <button className="btn btn-primary">创建一个活动</button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedEvents.map(event => (
                <EventCard key={event.id.toString()} event={event} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
