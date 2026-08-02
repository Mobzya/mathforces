import { getCurrentUser } from "@/server/auth/session";
import { apiError } from "@/server/http/responses";
import { getContestStandings, getContestStandingsRevision } from "@/server/standings/queries";
import { isUuid } from "@/server/validation/primitives";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) {
    return apiError("Контест не найден", 404);
  }

  const viewer = await getCurrentUser();
  const initial = await getContestStandings(id, viewer);
  if (!initial) {
    return apiError("Контест не найден", 404);
  }

  const encoder = new TextEncoder();
  let interval: ReturnType<typeof setInterval> | undefined;
  let isClosed = false;
  let isSending = false;
  let previousRevision: string | null = null;
  let lastHeartbeatAt = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const close = () => {
        if (isClosed) return;
        isClosed = true;
        if (interval) {
          clearInterval(interval);
        }
        try {
          controller.close();
        } catch {
          // The client may already have closed the stream.
        }
      };

      const enqueue = (payload: string) => {
        if (isClosed) {
          return false;
        }
        try {
          controller.enqueue(encoder.encode(payload));
          return true;
        } catch {
          isClosed = true;
          if (interval) {
            clearInterval(interval);
          }
          return false;
        }
      };

      const send = async (standings = null as typeof initial | null, force = false) => {
        if (isClosed || isSending) return;
        isSending = true;
        try {
          if (!standings && !force) {
            const revision = await getContestStandingsRevision(id);
            if (revision === previousRevision) {
              if (Date.now() - lastHeartbeatAt >= 20_000) {
                enqueue(": keep-alive\n\n");
                lastHeartbeatAt = Date.now();
              }
              return;
            }
            previousRevision = revision;
          }
          const current = standings ?? (await getContestStandings(id, viewer));
          if (!current) {
            close();
            return;
          }
          enqueue(`event: standings\ndata: ${JSON.stringify(current)}\n\n`);
          lastHeartbeatAt = Date.now();
        } catch (error: unknown) {
          if (!isClosed) {
            console.error("Не удалось обновить SSE standings", error);
            enqueue(
              `event: warning\ndata: ${JSON.stringify({
                message: "Обновление временно недоступно"
              })}\n\n`
            );
          }
        } finally {
          isSending = false;
        }
      };

      if (request.signal.aborted) {
        close();
        return;
      }
      request.signal.addEventListener("abort", close, { once: true });
      previousRevision = await getContestStandingsRevision(id);
      await send(initial, true);
      if (isClosed) {
        return;
      }
      interval = setInterval(() => {
        void send();
      }, 4_000);
    },
    cancel() {
      isClosed = true;
      if (interval) {
        clearInterval(interval);
      }
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
