import http from "node:http";
import https from "node:https";
import { env } from "../../../env.js";
import { ApiError } from "../../../lib/errors.js";
import type {
  AiWorkerGenerateRequest,
  AiWorkerGenerateResponse,
} from "./try-on.types.js";

function requestJson<T>(
  urlStr: string,
  method: string,
  bodyObj?: unknown,
  timeoutMs = 0,
): Promise<{ status: number; data: T }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const client = url.protocol === "https:" ? https : http;
    const bodyStr = bodyObj !== undefined ? JSON.stringify(bodyObj) : undefined;

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (bodyStr !== undefined) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = String(Buffer.byteLength(bodyStr));
    }

    const req = client.request(
      url,
      {
        method,
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf-8");
          try {
            const data = JSON.parse(raw);
            resolve({ status: res.statusCode || 200, data });
          } catch {
            resolve({ status: res.statusCode || 200, data: raw as any });
          }
        });
      },
    );

    // Disable timeout or set custom timeout
    if (timeoutMs > 0) {
      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error("TimeoutError"));
      });
    } else {
      req.setTimeout(0); // Unlimited timeout for long-running AI jobs
    }

    req.on("error", (err) => {
      reject(err);
    });

    if (bodyStr !== undefined) {
      req.write(bodyStr);
    }
    req.end();
  });
}

export class AiWorkerClient {
  private baseUrl: string;
  private timeoutMs: number;

  constructor(baseUrl = env.aiWorkerUrl, timeoutMs = 0) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.timeoutMs = timeoutMs;
  }

  async checkHealth(): Promise<{ ok: boolean; [key: string]: unknown }> {
    try {
      const { status, data } = await requestJson<{ ok?: boolean; [key: string]: unknown }>(
        `${this.baseUrl}/health`,
        "GET",
        undefined,
        5000,
      );
      if (status >= 400) {
        return { ok: false, status };
      }
      return { ok: true, ...(typeof data === "object" ? data : {}) };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    }
  }

  async generate(request: AiWorkerGenerateRequest): Promise<AiWorkerGenerateResponse> {
    const url = `${this.baseUrl}/v1/try-on/generate`;
    try {
      const { status, data: resData } = await requestJson<any>(
        url,
        "POST",
        request,
        this.timeoutMs,
      );

      if (status >= 400) {
        const errJson = typeof resData === "object" && resData !== null ? resData : {};
        const errorCode =
          errJson.error_code ||
          (status === 429
            ? "ai_worker_rate_limited"
            : status === 402
            ? "credits_insufficient"
            : "ai_worker_failed");

        const OVERLOAD_MESSAGE = "Hệ thống AI hiện đang quá tải hoặc bận xử lý. Quý khách vui lòng thử lại sau ít phút.";
        let errorMessage = OVERLOAD_MESSAGE;

        if (typeof errJson.detail === "string" && !errJson.detail.includes("{") && !errJson.detail.includes("Kie") && !errJson.detail.includes("code:") && !errJson.detail.includes("当前服务繁忙")) {
          errorMessage = errJson.detail;
        } else if (typeof errJson.detail === "object" && errJson.detail !== null) {
          const innerMsg = errJson.detail.error_message || errJson.detail.message || errJson.detail.msg;
          if (typeof innerMsg === "string" && !innerMsg.includes("{") && !innerMsg.includes("Kie") && !innerMsg.includes("code:") && !innerMsg.includes("当前服务繁忙")) {
            errorMessage = innerMsg;
          }
        } else if (typeof errJson.error_message === "string" && !errJson.error_message.includes("{") && !errJson.error_message.includes("Kie") && !errJson.error_message.includes("code:") && !errJson.error_message.includes("当前服务繁忙")) {
          errorMessage = errJson.error_message;
        }

        throw new ApiError(status, errorCode, errorMessage);
      }

      return resData as AiWorkerGenerateResponse;
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        throw err;
      }

      const OVERLOAD_MESSAGE = "Hệ thống AI hiện đang quá tải hoặc bận xử lý. Quý khách vui lòng thử lại sau ít phút.";

      if (err instanceof Error && (err.name === "TimeoutError" || err.message === "TimeoutError")) {
        throw new ApiError(504, "ai_worker_timeout", OVERLOAD_MESSAGE);
      }

      console.error("[AiWorkerClient] generate error:", err);
      throw new ApiError(503, "ai_worker_unavailable", OVERLOAD_MESSAGE);
    }
  }
}
