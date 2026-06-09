export interface EventEmployee {
  id: string;
  name: string;
  email: string;
}

export interface EventAllocation {
  employee: EventEmployee;
  allocatedAmount: number;
  claimedAmount: number;
  differenceAmount: number;
}

export interface FinanceEvent {
  id: string;
  eventName: string;
  description: string;
  allocations: EventAllocation[];
  createdAt: string;
  updatedAt: string;
}

export interface EventEmployeeOption extends EventEmployee {
  role?: {
    id: string;
    name: string;
  };
}
