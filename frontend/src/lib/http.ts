export type HttpMethod = "GET" | "POST";

export class HttpError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.body = body;
  }
}

async function parseJsonSafely(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function http<TResponse>(
  path: string,
  init?: {
    method?: HttpMethod;
    body?: BodyInit | null;
    headers?: Record<string, string>;
  },
): Promise<TResponse> {
  const response = await fetch(path, {
    method: init?.method ?? "GET",
    body: init?.body ?? null,
    headers: init?.headers,
  });

  if (!response.ok) {
    const body = await parseJsonSafely(response);
    const message =
      typeof body === "object" && body && "error" in body && typeof (body as any).error === "string"
        ? (body as any).error
        : `Request failed (${response.status})`;
    throw new HttpError(message, response.status, body);
  }

  return (await response.json()) as TResponse;
}

export async function httpBlob(
  path: string,
  init?: {
    method?: HttpMethod;
    headers?: Record<string, string>;
  },
): Promise<Blob> {
  const response = await fetch(path, { method: init?.method ?? "GET", headers: init?.headers });
  if (!response.ok) {
    const body = await parseJsonSafely(response);
    throw new HttpError(`Request failed (${response.status})`, response.status, body);
  }
  return await response.blob();
}

