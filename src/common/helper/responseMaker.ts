import { ResultWithError } from "../types";

export function jsonResponse(
  data: any,
  statusCode: number = 200,
  headers: HeadersInit = {},
) {
  return new Response(JSON.stringify(data), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

export function Promisify<T>(req: Promise<ResultWithError>): Promise<T> {
  return req.then(({ data, error }) => {
    if (error || data === null) {
      throw error ?? new Error("Received null data");
    }
    return data;
  });
}