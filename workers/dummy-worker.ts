import { sendMessage } from "./utils";

self.onmessage = function (e: MessageEvent) {
  sendMessage(self, {
    data: null,
    message: `got message: ${JSON.stringify(e.data)}`,
    level: "log",
    task: e.data,
  });
};
