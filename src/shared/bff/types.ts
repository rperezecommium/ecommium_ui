import type { AdminContext } from "../config/admin-context";

export type BffRequestContext = AdminContext & {
  correlationId?: string;
};

export type BffResult<T> =
  | {
      ok: true;
      data: T;
      status: number;
      correlationId: string;
    }
  | {
      ok: false;
      error: string;
      status?: number;
      correlationId: string;
    };
