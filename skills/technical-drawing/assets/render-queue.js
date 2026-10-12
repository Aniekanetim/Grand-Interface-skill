/* Keep obsolete previews out of the worker without cancelling captured exports. */
(function(root){
function create(worker) {
  let active = null, preview = null, failure = null, requestId = 0;
  const exports = [];

  function cancelPreview() {
    if (!preview) return;
    const error = new Error('Drawing preview superseded');
    error.name = 'AbortError';
    preview.reject(error);
    preview = null;
  }

  function dispatch() {
    if (active || failure) return;
    if (exports.length) active = exports.shift();
    else { active = preview; preview = null; }
    if (!active) return;
    try { worker.postMessage(active.message); }
    catch (error) {
      const job = active; active = null;
      job.reject(error);
      dispatch();
    }
  }

  function request(message, {preview:replaceable = false} = {}) {
    return new Promise((resolve, reject) => {
      if (failure) { reject(failure); return; }
      const job = {message:{...structuredClone(message),request:++requestId},resolve,reject};
      if (replaceable) { cancelPreview(); preview = job; }
      else exports.push(job);
      dispatch();
    });
  }

  worker.onmessage = ({data}) => {
    if (!active || data.request !== active.message.request) return;
    const job = active; active = null;
    if (data.error) job.reject(new Error(data.error));
    else job.resolve(data.result);
    dispatch();
  };
  worker.onerror = event => {
    failure = new Error(event.message || 'Drawing worker failed');
    for (const job of [active, preview, ...exports]) job?.reject(failure);
    active = null; preview = null; exports.length = 0;
  };

  return {request,cancelPreview};
}
root.DrawingRenderQueue = {create};
})(globalThis);
