import { config } from "@/lib/config";

interface FluxGenerateRequest {
  prompt: string;
  width?: number;
  height?: number;
  model?: "flux-2-pro" | "flux-2-max";
}

interface FluxTaskResponse {
  id: string;
  status:
    | "Pending"
    | "Ready"
    | "Error"
    | "Content Moderated"
    | "Request Moderated"
    | "Task not found";
  result?: {
    sample: string;
  };
}

const FLUX_API_URLS = {
  "flux-2-pro": "https://api.bfl.ml/v1/flux-2-pro",
  "flux-2-max": "https://api.bfl.ml/v1/flux-2-max",
} as const;

const FLUX_RESULT_URL = "https://api.bfl.ml/v1/get_result";
const MAX_POLL_ATTEMPTS = 120; // 2 minutes at 1-second intervals
const POLL_INTERVAL_MS = 1000;

/**
 * FluxApiError carries a user-safe `message` and optional server-only `details`.
 * Per CLAUDE.md §6: the `message` is safe to return to the client; `details`
 * (e.g. raw upstream response body) must only be logged server-side.
 */
export class FluxApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly fluxStatus?: string,
    /** Internal details — upstream response body, config names, etc. NEVER return to client. */
    public readonly details?: string
  ) {
    super(message);
    this.name = "FluxApiError";
  }
}

/**
 * Module-level concurrency guard. Flux enforces 24 concurrent requests
 * API-side; we cap at 8 per process to bound memory (each in-flight
 * image holds a ~10 MB buffer while polling + downloading).
 */
const MAX_CONCURRENT_GENERATIONS = 8;
let activeGenerations = 0;

async function withConcurrencyGuard<T>(fn: () => Promise<T>): Promise<T> {
  if (activeGenerations >= MAX_CONCURRENT_GENERATIONS) {
    throw new FluxApiError(
      "Too many image generations in progress. Please wait a moment and try again.",
      429
    );
  }
  activeGenerations++;
  try {
    return await fn();
  } finally {
    activeGenerations--;
  }
}

async function submitGenerationTask(request: FluxGenerateRequest): Promise<string> {
  const apiKey = config.ai.fluxApiKey;
  if (!apiKey) {
    // Generic user-facing message; details (env var name) stay in server logs.
    throw new FluxApiError(
      "Image generation is not configured on this server.",
      undefined,
      undefined,
      "FLUX_API_KEY env var is missing"
    );
  }

  const model = request.model ?? "flux-2-pro";
  const url = FLUX_API_URLS[model];

  const body = {
    prompt: request.prompt,
    width: request.width ?? 1920,
    height: request.height ?? 1080,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (response.status === 429) {
    throw new FluxApiError(
      "Flux API rate limit reached (max 24 concurrent requests). Try again shortly.",
      429
    );
  }

  if (!response.ok) {
    // Do NOT include upstream body in the user-facing message — it can contain
    // internal model/account details. Keep the raw body in `details` for logs.
    const errorText = await response.text().catch(() => "Unknown error");
    throw new FluxApiError(
      `Flux API request failed with status ${response.status}.`,
      response.status,
      undefined,
      errorText
    );
  }

  const data = await response.json();
  if (!data.id) {
    throw new FluxApiError("Flux API did not return a task ID");
  }

  return data.id as string;
}

async function pollForResult(taskId: string): Promise<string> {
  const apiKey = config.ai.fluxApiKey;

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const response = await fetch(`${FLUX_RESULT_URL}?id=${taskId}`, {
      headers: {
        "x-key": apiKey,
      },
    });

    if (!response.ok) {
      throw new FluxApiError(`Flux polling failed: ${response.status}`, response.status);
    }

    const data: FluxTaskResponse = await response.json();

    switch (data.status) {
      case "Ready":
        if (!data.result?.sample) {
          throw new FluxApiError("Flux returned Ready status but no image URL");
        }
        return data.result.sample;

      case "Pending":
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        break;

      case "Content Moderated":
        throw new FluxApiError(
          "Image generation was blocked by content moderation. Try a different prompt.",
          undefined,
          "Content Moderated"
        );

      case "Request Moderated":
        throw new FluxApiError(
          "Request was blocked by moderation. Try a different prompt.",
          undefined,
          "Request Moderated"
        );

      case "Error":
        throw new FluxApiError("Flux API returned an error during generation");

      case "Task not found":
        throw new FluxApiError("Flux task not found. It may have expired.");

      default:
        throw new FluxApiError(`Unknown Flux status: ${data.status}`);
    }
  }

  throw new FluxApiError(`Flux generation timed out after ${MAX_POLL_ATTEMPTS} seconds`);
}

async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new FluxApiError(`Failed to download generated image: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function generateImage(
  request: FluxGenerateRequest
): Promise<{ buffer: Buffer; taskId: string }> {
  return withConcurrencyGuard(async () => {
    const taskId = await submitGenerationTask(request);
    const imageUrl = await pollForResult(taskId);
    const buffer = await downloadImage(imageUrl);
    return { buffer, taskId };
  });
}

export async function generatePreviews(
  request: FluxGenerateRequest,
  count: 2 | 3 = 3
): Promise<Array<{ buffer: Buffer; taskId: string; index: number }>> {
  const tasks = Array.from({ length: count }, (_, i) =>
    generateImage(request).then((result) => ({ ...result, index: i }))
  );
  return Promise.all(tasks);
}

export function estimateCost(
  count: number = 1,
  model: "flux-2-pro" | "flux-2-max" = "flux-2-pro"
): {
  perImage: number;
  total: number;
  formatted: string;
} {
  const perImage = model === "flux-2-max" ? 0.2 : 0.05;
  const total = perImage * count;
  return {
    perImage,
    total,
    formatted: `$${total.toFixed(2)}`,
  };
}
