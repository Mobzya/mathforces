export function shouldUseSecureSessionCookie(request?: Request): boolean {
  const override = process.env.SESSION_COOKIE_SECURE?.trim().toLowerCase();
  if (override === "true") return true;
  if (override === "false") return false;
  if (!request) return process.env.NODE_ENV === "production";

  const forwardedProtocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",", 1)[0]
    ?.trim()
    .toLowerCase();
  if (forwardedProtocol === "https") return true;

  const requestUrl = new URL(request.url);
  if (requestUrl.protocol === "https:") return true;

  const publicHost =
    request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim() ||
    request.headers.get("host") ||
    requestUrl.host;
  return process.env.NODE_ENV === "production" && !isLocalDevelopmentHost(publicHost);
}

function isLocalDevelopmentHost(host: string): boolean {
  const hostname = host
    .replace(/^\[/, "")
    .replace(/\](:\d+)?$/, "")
    .replace(/:\d+$/, "")
    .toLowerCase();
  if (
    hostname === "localhost" ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname.endsWith(".local") ||
    hostname.startsWith("127.") ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.")
  ) {
    return true;
  }
  const private172 = /^172\.(\d{1,2})\./.exec(hostname);
  return private172 ? Number(private172[1]) >= 16 && Number(private172[1]) <= 31 : false;
}
