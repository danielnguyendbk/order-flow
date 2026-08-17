import { HistoryRepository } from "./history.repository";
import { OrderStatusHistory, CreateHistoryInput } from "./history.types";

/**
 * Service for recording and retrieving order status transition logs.
 */
export class HistoryService {
  constructor(private readonly historyRepository: HistoryRepository) {}

  /**
   * Records a status transition event for an order.
   */
  public async recordTransition(input: CreateHistoryInput): Promise<OrderStatusHistory> {
    return this.historyRepository.create(input);
  }

  /**
   * Retrieves the full status history for a given order.
   */
  public async getOrderHistory(orderId: string): Promise<OrderStatusHistory[]> {
    return this.historyRepository.findByOrderId(orderId);
  }
}
