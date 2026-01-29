"use strict";
(() => {
  self.onmessage = function(e) {
    const taskId = e.data.taskId;
    self.postMessage({
      type: "log",
      message: `[Dummy Worker] Received task: ${JSON.stringify(e.data)} - this is a dummy worker for example sake`,
      taskId
    });
  };
})();
