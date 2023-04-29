export enum OrderStatus {
  UNOPENED = "unopened",
  OPEN = "open",
  FILLED = "filled",
  CANCELLED = "cancelled",
}

// struct Order {
//   address onRamper;
//   address onRamperEncryptPublicKey;
//   uint256 amountToReceive;
//   uint256 maxAmountToPay;
//   OrderStatus status;
// }
  
export interface OnRampOrder {
  orderId: number;
  onRamper: string;
  onRamperEncryptPublicKey: string;
  amountToReceive: number;
  maxAmountToPay: number;
  status: OrderStatus;
}

export enum OrderClaimStatus {
  UNSUBMITTED = "unsubmitted",
  SUBMITTED = "submitted",
  USED = "used",
  CLAWBACK = "clawback"
}

// struct OrderClaim {
//   address offRamper;
//   uint256 venmoId;
//   ClaimStatus status;
//   uint256 encryptedOffRamperVenmoId;
//   uint256 claimExpirationTime;
//   uint256 minAmountToPay;
// }

export interface OnRampOrderClaim {
  claimId: number;
  offRamper: string;
  hashedVenmoId: string;
  status: OrderClaimStatus;
  encryptedOffRamperVenmoId: string;
  claimExpirationTime: number;
  minAmountToPay: number;
}
