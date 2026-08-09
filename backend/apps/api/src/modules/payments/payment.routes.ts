import { Router } from "express";
import { PaymentController } from "./payment.controller";
import { PaymentRepository } from "./payment.repository";
import { PaymentService } from "./payment.service";

export function createPaymentRouter(): Router {
  const paymentRepository = new PaymentRepository();
  const paymentService = new PaymentService(paymentRepository);
  const controller = new PaymentController(paymentService);

  const router = Router({ mergeParams: true });

  router.get("/", controller.listOrderPayments);
  router.post("/qr", controller.initQrPayment);
  router.post("/cash/confirm", controller.confirmCash);

  return router;
}
