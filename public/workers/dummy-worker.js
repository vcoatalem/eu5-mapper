"use strict";
(() => {
  // workers/utils.ts
  var sendMessage = (self2, payload) => {
    const workerMessage = {
      type: payload.level,
      taskType: payload.task.type,
      taskId: payload.task.id,
      message: payload.message ? `[${globalThis.__workerName}] ${payload.message}` : ""
    };
    if (payload.data !== void 0) {
      workerMessage.data = payload.data;
    }
    self2.postMessage(workerMessage);
  };

  // workers/dummy-worker.ts
  self.onmessage = function(e) {
    sendMessage(self, {
      data: null,
      message: `got message: ${JSON.stringify(e.data)}`,
      level: "log",
      task: e.data
    });
  };
})();
