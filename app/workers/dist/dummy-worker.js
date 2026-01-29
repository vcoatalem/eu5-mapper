"use strict";
(() => {
  // app/workers/utils.ts
  var sendMessage = (self2, payload) => {
    const workerMessage = {
      type: payload.level,
      taskType: payload.task.type,
      taskId: payload.task.id,
      message: payload.message ?? ""
    };
    if (payload.data !== void 0) {
      workerMessage.data = payload.data;
    }
    self2.postMessage(workerMessage);
  };

  // app/workers/dummy-worker.ts
  self.onmessage = function(e) {
    sendMessage(self, {
      data: null,
      message: `[Dummy Worker] Received task: ${JSON.stringify(e.data)} - this is a dummy worker for example sake`,
      level: "log",
      task: e.data
    });
  };
})();
