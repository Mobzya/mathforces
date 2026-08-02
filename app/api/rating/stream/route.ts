import { apiError } from "@/server/http/responses";
import { getRatingLeaderboard, getRatingLeaderboardRevision } from "@/server/rating/leaderboard";
import { isUuid } from "@/server/validation/primitives";
import { getCurrentUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organization");
  if (organizationId && !isUuid(organizationId)) {
    return apiError("Организация не найдена", 404);
  }
  const pageValue = Number(url.searchParams.get("page"));
  const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const viewer = await getCurrentUser();
  const friendsOnly = url.searchParams.get("scope") === "friends" && Boolean(viewer);
  const encoder = new TextEncoder();
  let interval: ReturnType<typeof setInterval> | undefined;
  let closed = false;
  let sending = false;
  let previousSignature = "";
  let previousRevision = "";
  let lastHeartbeatAt = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const close = () => {
        if (closed) return;
        closed = true;
        if (interval) clearInterval(interval);
        try {
          controller.close();
        } catch {
          // The browser may have already closed the stream.
        }
      };
      const enqueue = (payload: string) => {
        if (closed) return false;
        try {
          controller.enqueue(encoder.encode(payload));
          return true;
        } catch {
          closed = true;
          if (interval) clearInterval(interval);
          return false;
        }
      };
      const send = async () => {
        if (closed || sending) return;
        sending = true;
        try {
          const revision = await getRatingLeaderboardRevision(organizationId);
          if (revision === previousRevision) {
            if (Date.now() - lastHeartbeatAt >= 20_000) {
              enqueue(": keep-alive\n\n");
              lastHeartbeatAt = Date.now();
            }
            return;
          }
          previousRevision = revision;
          const leaderboard = await getRatingLeaderboard({
            friendsOnly,
            organizationId,
            page,
            viewerId: viewer?.id
          });
          const signature = JSON.stringify({
            lastContest: leaderboard.lastContest,
            ratedCount: leaderboard.ratedCount,
            rows: leaderboard.rows.map((row) => [
              row.id,
              row.place,
              row.previousPlace,
              row.currentRating,
              row.ratingDelta,
              row.avatarUrl,
              row.nickname,
              row.organization.id,
              row.organization.name
            ]),
            total: leaderboard.total
          });
          if (signature !== previousSignature) {
            previousSignature = signature;
            enqueue(`event: rating\ndata: ${JSON.stringify(leaderboard)}\n\n`);
            lastHeartbeatAt = Date.now();
          }
        } catch (error: unknown) {
          if (!closed) {
            console.error("Не удалось обновить live-рейтинг", error);
            enqueue(
              `event: warning\ndata: ${JSON.stringify({
                message: "Live-рейтинг временно недоступен"
              })}\n\n`
            );
          }
        } finally {
          sending = false;
        }
      };

      if (request.signal.aborted) {
        close();
        return;
      }
      request.signal.addEventListener("abort", close, { once: true });
      await send();
      if (closed) return;
      interval = setInterval(() => void send(), 4_000);
    },
    cancel() {
      closed = true;
      if (interval) clearInterval(interval);
    }
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no"
    }
  });
}
