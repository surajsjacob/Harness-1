export async function api<T = any>(
  path: string,
  body?: any,
  isForm = false,
  signal?: AbortSignal
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 150_000);

  if (signal) {
    if (signal.aborted) {
      clearTimeout(timer);
      throw new Error("Stopped.");
    }
    signal.addEventListener("abort", () => ctrl.abort());
  }

  let res: Response;
  try {
    res = await fetch(`/api/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: isForm || body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e: any) {
    if (signal?.aborted) throw new Error("Stopped.");
    throw new Error(
      e?.name === "AbortError"
        ? "No answer after 2.5 minutes. Try again or pick a faster model."
        : "Can't reach the server. It may be waking up, wait 30 seconds and try again."
    );
  } finally {
    clearTimeout(timer);
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON */
  }
  if (!res.ok) throw new Error(data?.error || `Server error (${res.status}). Try again.`);
  return data as T;
}
