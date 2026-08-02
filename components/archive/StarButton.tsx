"use client";

import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function StarButton({
  initialStarred,
  problemId
}: {
  initialStarred: boolean;
  problemId: string;
}) {
  const router = useRouter();
  const [starred, setStarred] = useState(initialStarred);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (pending) return;
    setPending(true);
    const next = !starred;
    setStarred(next);
    const response = await fetch(`/api/archive/problems/${problemId}/star`, {
      method: next ? "PUT" : "DELETE"
    });
    if (!response.ok) setStarred(!next);
    else router.refresh();
    setPending(false);
  }

  return (
    <button
      aria-label={starred ? "Убрать из избранного" : "Добавить в избранное"}
      className={`grid size-11 place-items-center rounded-xl border transition ${starred ? "border-amber-300 bg-amber-50 text-amber-500" : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:text-amber-500"}`}
      disabled={pending}
      onClick={toggle}
      type="button"
    >
      <Star fill={starred ? "currentColor" : "none"} size={19} />
    </button>
  );
}
