import { FulfillmentStatus, PaymentStatus } from "../order.types";
import {
  isValidFulfillmentTransition,
  isValidPaymentTransition,
  isOrderEditable,
  isFulfillmentTerminal,
} from "../state-machine";

/**
 * Test suite for the Order State Machine transition rules.
 */
describe("Order State Machine", () => {
  describe("Fulfillment Transitions", () => {
    it("should permit valid status transitions", () => {
      // PENDING_PAYMENT -> QUEUED (paid)
      expect(isValidFulfillmentTransition(FulfillmentStatus.PENDING_PAYMENT, FulfillmentStatus.QUEUED)).toBe(true);
      // PENDING_PAYMENT -> CANCELLED (cancelled by customer/admin before payment)
      expect(isValidFulfillmentTransition(FulfillmentStatus.PENDING_PAYMENT, FulfillmentStatus.CANCELLED)).toBe(true);
      // QUEUED -> PREPARING (claimed by barista)
      expect(isValidFulfillmentTransition(FulfillmentStatus.QUEUED, FulfillmentStatus.PREPARING)).toBe(true);
      // PREPARING -> READY (barista finishes)
      expect(isValidFulfillmentTransition(FulfillmentStatus.PREPARING, FulfillmentStatus.READY)).toBe(true);
      // READY -> DELIVERED (handover)
      expect(isValidFulfillmentTransition(FulfillmentStatus.READY, FulfillmentStatus.DELIVERED)).toBe(true);
    });

    it("should reject invalid status transitions", () => {
      // QUEUED -> DELIVERED (cannot skip states)
      expect(isValidFulfillmentTransition(FulfillmentStatus.QUEUED, FulfillmentStatus.DELIVERED)).toBe(false);
      // PREPARING -> DELIVERED (cannot skip states)
      expect(isValidFulfillmentTransition(FulfillmentStatus.PREPARING, FulfillmentStatus.DELIVERED)).toBe(false);
      // DELIVERED -> QUEUED (cannot transition back from terminal state)
      expect(isValidFulfillmentTransition(FulfillmentStatus.DELIVERED, FulfillmentStatus.QUEUED)).toBe(false);
      // CANCELLED -> PREPARING (cannot claim cancelled order)
      expect(isValidFulfillmentTransition(FulfillmentStatus.CANCELLED, FulfillmentStatus.PREPARING)).toBe(false);
    });
  });

  describe("Payment Transitions", () => {
    it("should permit valid payment transitions", () => {
      expect(isValidPaymentTransition(PaymentStatus.UNPAID, PaymentStatus.PENDING)).toBe(true);
      expect(isValidPaymentTransition(PaymentStatus.PENDING, PaymentStatus.PAID)).toBe(true);
      expect(isValidPaymentTransition(PaymentStatus.PAID, PaymentStatus.UNDERPAID)).toBe(true);
    });

    it("should reject invalid payment transitions", () => {
      expect(isValidPaymentTransition(PaymentStatus.PAID, PaymentStatus.UNPAID)).toBe(false);
      expect(isValidPaymentTransition(PaymentStatus.REVIEW, PaymentStatus.PAID)).toBe(false);
    });
  });

  describe("Order Editability", () => {
    it("should only allow edits in PENDING_PAYMENT state", () => {
      expect(isOrderEditable(FulfillmentStatus.PENDING_PAYMENT)).toBe(true);
      expect(isOrderEditable(FulfillmentStatus.QUEUED)).toBe(false);
      expect(isOrderEditable(FulfillmentStatus.PREPARING)).toBe(false);
      expect(isOrderEditable(FulfillmentStatus.READY)).toBe(false);
      expect(isOrderEditable(FulfillmentStatus.DELIVERED)).toBe(false);
      expect(isOrderEditable(FulfillmentStatus.CANCELLED)).toBe(false);
    });
  });

  describe("Terminal State Verification", () => {
    it("should correctly identify terminal states", () => {
      expect(isFulfillmentTerminal(FulfillmentStatus.DELIVERED)).toBe(true);
      expect(isFulfillmentTerminal(FulfillmentStatus.CANCELLED)).toBe(true);
      expect(isFulfillmentTerminal(FulfillmentStatus.PREPARING)).toBe(false);
      expect(isFulfillmentTerminal(FulfillmentStatus.READY)).toBe(false);
    });
  });
});

export const stateMachineTestSuiteName = "Order State Machine Tests";
