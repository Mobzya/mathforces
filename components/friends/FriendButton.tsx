"use client";

import { Check, LoaderCircle, UserMinus, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { readApiError } from "@/components/auth/form-utils";

type State = { id: string; incoming: boolean; status: "ACCEPTED" | "PENDING" } | null;

export function FriendButton({
  initialState,
  targetUserId
}: {
  initialState: State;
  targetUserId: string;
}) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function act() {
    setPending(true);
    setError("");
    const endpoint = state ? `/api/friends/${state.id}` : "/api/friends";
    const method = !state
      ? "POST"
      : state.status === "PENDING" && state.incoming
        ? "PATCH"
        : "DELETE";
    const response = await fetch(endpoint, {
      ...(method === "POST"
        ? {
            body: JSON.stringify({ targetUserId }),
            headers: { "Content-Type": "application/json" }
          }
        : {}),
      method
    });
    if (!response.ok) setError((await readApiError(response)).message);
    else {
      setState(
        method === "DELETE"
          ? null
          : {
              id: (
                (await response.json()) as {
                  friendship: { id: string; status: "ACCEPTED" | "PENDING" };
                }
              ).friendship.id,
              incoming: false,
              status: method === "PATCH" ? "ACCEPTED" : "PENDING"
            }
      );
      router.refresh();
    }
    setPending(false);
  }
  const label = !state
    ? "Добавить в друзья"
    : state.status === "ACCEPTED"
      ? "Удалить из друзей"
      : state.incoming
        ? "Принять запрос"
        : "Отменить запрос";
  const Icon = pending
    ? LoaderCircle
    : state?.status === "ACCEPTED"
      ? UserMinus
      : state?.incoming
        ? Check
        : UserPlus;
  return (
    <div className="mt-4">
      <button
        className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-sm font-bold"
        disabled={pending}
        onClick={act}
        type="button"
      >
        <Icon className={pending ? "animate-spin" : ""} size={16} />
        {label}
      </button>
      {error && <p className="mt-2 text-xs font-semibold text-[var(--accent)]">{error}</p>}
    </div>
  );
}
