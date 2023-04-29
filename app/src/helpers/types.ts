export enum OrderStatus {
  UNOPENED = "unopened",
  OPEN = "open",
  FILLED = "filled",
  CANCELLED = "cancelled",
}
  
export interface OnRampOrder {
  orderId: number;
  sender: string;
  amount: number;
  maxAmount: number;                      // TODO: Remove when updated contract goes live
  status: OrderStatus;
  encryptingKey: string;
}

export enum OrderClaimStatus {
  UNSUBMITTED = "unsubmitted",
  SUBMITTED = "submitted",
  USED = "used",
  CLAWBACK = "clawback"
}

export interface OnRampOrderClaim {
  venmoId: string;                        // TODO: Remove when updated contract goes live
  status: OrderClaimStatus;
  expirationTimestamp: number;
  requestedAmount: number;
  encryptedVenmoHandle: string;
  hashedVenmoHandle: string;
}
