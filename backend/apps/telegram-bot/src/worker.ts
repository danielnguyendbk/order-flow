import { createBot } from "./bot.js";
import { getBotConfig } from "./config/env.js";
import { createNotificationWorker } from "./notifications/worker.js";

const config = getBotConfig();
const worker = createNotificationWorker(createBot(config), config.redisUrl);

worker.on("completed", (job) => console.info(`Notification ${job.id} sent`));
worker.on("failed", (job, error) => console.error(`Notification ${job?.id} failed`, error));
