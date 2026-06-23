import { NextResponse } from "next/server";
import { AuthenticationError } from "./auth";
import { FeatureDisabledError } from "./features";
import { zodErrorMessage } from "./validators";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(error: unknown, status = 400) {
  if (error instanceof FeatureDisabledError) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
  }

  if (error instanceof AuthenticationError) {
    return NextResponse.json(
      { error: error.message, ...(error.code ? { code: error.code } : {}) },
      { status: error.status },
    );
  }

  return NextResponse.json({ error: zodErrorMessage(error) }, { status });
}
