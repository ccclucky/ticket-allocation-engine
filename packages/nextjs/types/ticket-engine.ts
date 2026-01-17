export enum EventStatus {
  NotStarted = 0,
  InProgress = 1,
  SoldOut = 2,
}

export enum AttemptResult {
  Success = 0,
  AlreadyOwnsTicket = 1,
  SoldOut = 2,
  NotStarted = 3,
}

export interface TicketEvent {
  id: bigint;
  title: string;
  startTime: bigint;
  totalTickets: bigint;
  remainingTickets: bigint;
  organizer: string;
  status: EventStatus;
}

export interface Ticket {
  id: bigint;
  eventId: bigint;
  eventTitle: string;
  acquiredAt: bigint;
}

export interface Attempt {
  eventId: bigint;
  participant: string;
  timestamp: bigint;
  result: AttemptResult;
}

export const getStatusLabel = (status: EventStatus): string => {
  switch (status) {
    case EventStatus.NotStarted:
      return "未开始";
    case EventStatus.InProgress:
      return "进行中";
    case EventStatus.SoldOut:
      return "已售罄";
    default:
      return "未知";
  }
};

export const getStatusColor = (status: EventStatus): string => {
  switch (status) {
    case EventStatus.NotStarted:
      return "badge-warning";
    case EventStatus.InProgress:
      return "badge-success";
    case EventStatus.SoldOut:
      return "badge-error";
    default:
      return "badge-neutral";
  }
};

export const getAttemptResultLabel = (result: AttemptResult): string => {
  switch (result) {
    case AttemptResult.Success:
      return "成功";
    case AttemptResult.AlreadyOwnsTicket:
      return "已达到限购";
    case AttemptResult.SoldOut:
      return "已售罄";
    case AttemptResult.NotStarted:
      return "活动未开始";
    default:
      return "未知";
  }
};
