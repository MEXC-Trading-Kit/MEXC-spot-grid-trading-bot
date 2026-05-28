import type { MexcClient } from "../../api/mexc/client.js";
import type { Order, OrderSide } from "../../api/mexc/types.js";
import type { Logger } from "../../services/logger.js";
import { formatPrice, formatQuantity } from "../../utils/decimal.js";

export interface GridOrder {
  levelIndex: number;
  side: OrderSide;
  price: number;
  size: number;
  clientOrderId: string;
  orderId?: number;
  state: "pending" | "live" | "filled" | "canceled";
}

export interface OrderManagerConfig {
  symbol: string;
  dryRun: boolean;
}

let orderCounter = 0;

export function generateClientOrderId(prefix: string): string {
  orderCounter += 1;
  return `${prefix}${Date.now()}${orderCounter}`.slice(0, 32);
}

export class OrderManager {
  private readonly activeOrders = new Map<string, GridOrder>();

  constructor(
    private readonly client: MexcClient,
    private readonly config: OrderManagerConfig,
    private readonly logger: Logger,
  ) {}

  getActiveOrders(): GridOrder[] {
    return Array.from(this.activeOrders.values());
  }

  findOrderByLevel(levelIndex: number, side: OrderSide): GridOrder | undefined {
    return Array.from(this.activeOrders.values()).find(
      (o) => o.levelIndex === levelIndex && o.side === side,
    );
  }

  async placeLimitOrder(
    levelIndex: number,
    side: OrderSide,
    price: number,
    size: number,
    tickSize?: string,
    stepSize?: string,
  ): Promise<GridOrder> {
    const clientOrderId = generateClientOrderId("grid");
    const px = formatPrice(price, tickSize);
    const qty = formatQuantity(size, stepSize);

    const gridOrder: GridOrder = {
      levelIndex,
      side,
      price,
      size,
      clientOrderId,
      state: "pending",
    };

    if (this.config.dryRun) {
      this.logger.info(
        { levelIndex, side, price: px, size: qty, clientOrderId },
        "[DRY RUN] Would place limit order",
      );
      gridOrder.state = "live";
      gridOrder.orderId = Date.now();
      this.activeOrders.set(clientOrderId, gridOrder);
      return gridOrder;
    }

    const result = await this.client.placeOrder({
      symbol: this.config.symbol,
      side,
      quantity: qty,
      price: px,
      clientOrderId,
    });

    gridOrder.orderId = result.orderId;
    gridOrder.state = "live";
    this.activeOrders.set(clientOrderId, gridOrder);

    this.logger.info(
      { orderId: result.orderId, levelIndex, side, price: px, size: qty },
      "Limit order placed",
    );

    return gridOrder;
  }

  async cancelOrder(clientOrderId: string): Promise<void> {
    const order = this.activeOrders.get(clientOrderId);
    if (!order?.orderId) return;

    if (this.config.dryRun) {
      order.state = "canceled";
      this.activeOrders.delete(clientOrderId);
      return;
    }

    await this.client.cancelOrder({
      symbol: this.config.symbol,
      orderId: order.orderId,
      clientOrderId,
    });

    order.state = "canceled";
    this.activeOrders.delete(clientOrderId);
  }

  async syncWithExchange(): Promise<Order[]> {
    if (this.config.dryRun) {
      return [];
    }

    const exchangeOrders = await this.client.getOpenOrders(this.config.symbol);

    for (const exOrder of exchangeOrders) {
      const local = this.activeOrders.get(exOrder.clientOrderId);
      if (local) {
        local.orderId = exOrder.orderId;
        local.state = exOrder.status === "FILLED" ? "filled" : "live";
      }
    }

    const filledLocally = Array.from(this.activeOrders.values()).filter(
      (o) => !exchangeOrders.some((e) => e.clientOrderId === o.clientOrderId),
    );

    for (const order of filledLocally) {
      if (order.state === "live") {
        order.state = "filled";
        this.activeOrders.delete(order.clientOrderId);
      }
    }

    return exchangeOrders;
  }

  markFilled(clientOrderId: string): GridOrder | undefined {
    const order = this.activeOrders.get(clientOrderId);
    if (order) {
      order.state = "filled";
      this.activeOrders.delete(clientOrderId);
    }
    return order;
  }
}
