import { sendMessage } from "./utils";

(globalThis as any).__workerName = "Dummy Worker";

self.onmessage = function (e: MessageEvent) {
  sendMessage(self, {
    data: null,
    message: `got message: ${JSON.stringify(e.data)}`,
    level: "log",
    task: e.data,
  });
};
