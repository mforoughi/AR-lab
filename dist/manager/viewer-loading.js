// Time out stalled requests, but allow large models to keep downloading while
// bytes arrive. A separate preparation limit also covers malformed GLB files.
export async function readResource(url, {json = false, label = 'File', expectedBytes = 0, onProgress = () => {}, timeoutMs = 30000} = {}) {
  const controller = new AbortController();
  let timer;
  const reset = () => {
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), timeoutMs);
  };
  reset();
  try {
    const response = await fetch(url, {signal: controller.signal, credentials: 'same-origin'});
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new Error('Sign in to the dashboard, then reopen this QR link.');
      throw new Error(label + ' could not load (' + response.status + '). Open the project in the dashboard and check that it is published.');
    }
    if ((response.headers.get('content-type') || '').includes('text/html')) throw new Error('Sign in to the dashboard, then reopen this QR link.');
    const total = expectedBytes || Number(response.headers.get('content-length')) || 0;
    const reader = response.body.getReader(), chunks = [];
    let loaded = 0;
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      reset();
      chunks.push(value);
      loaded += value.byteLength;
      onProgress(loaded, total);
    }
    const data = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
    return json ? JSON.parse(new TextDecoder().decode(data)) : data.buffer;
  } catch (error) {
    if (controller.signal.aborted) throw new Error(label + ' download stopped responding. Check your connection and reload.');
    throw error;
  } finally { clearTimeout(timer); }
}

export async function withTimeout(promise, milliseconds, message) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}
