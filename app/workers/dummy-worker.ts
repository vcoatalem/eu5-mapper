import { sendMessage } from "./utils";
import { IWorkerTask } from "./types/workerTypes";

self.onmessage = function (e: MessageEvent<IWorkerTask>) {
  sendMessage(self, {
    data: null,
    message: `[Dummy Worker] Received task: ${JSON.stringify(e.data)} - this is a dummy worker for example sake`,
    level: "log",
    task: e.data,
  });
};
