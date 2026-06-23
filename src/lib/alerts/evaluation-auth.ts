import { timingSafeEqual } from "crypto";

export function isEvaluationRequestAuthorized(
  authorizationHeader: string | null,
  configuredSecrets: Array<string | undefined>,
) {
  const supplied = authorizationHeader?.startsWith("Bearer ") ? authorizationHeader.slice(7) : "";
  if (!supplied) return false;
  const suppliedBuffer = Buffer.from(supplied);

  return configuredSecrets.filter((secret): secret is string => Boolean(secret)).some((secret) => {
    const expectedBuffer = Buffer.from(secret);
    return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
  });
}
