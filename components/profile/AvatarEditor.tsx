"use client";

import { Camera, LoaderCircle, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { readApiError } from "@/components/auth/form-utils";
import { UserAvatar } from "@/components/profile/UserAvatar";

export function AvatarEditor({
  avatarUrl: initialAvatarUrl,
  nickname,
  rankColor
}: {
  avatarUrl: string | null;
  nickname: string;
  rankColor: string;
}) {
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [pending, setPending] = useState<"upload" | "delete" | null>(null);
  const [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setPending("upload");
    setMessage("");
    const form = new FormData();
    form.set("avatar", file);
    try {
      const response = await fetch("/api/users/me/avatar", {
        body: form,
        method: "POST"
      });
      if (!response.ok) {
        const error = await readApiError(response);
        setMessage(error.fieldErrors.avatar ?? error.message);
        return;
      }
      const payload = (await response.json()) as { avatarUrl: string };
      setAvatarUrl(payload.avatarUrl);
      setMessage("Аватар обновлён");
      window.dispatchEvent(new Event("mathforces:user-updated"));
    } catch {
      setMessage("Нет связи с сервером");
    } finally {
      setPending(null);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    setPending("delete");
    setMessage("");
    try {
      const response = await fetch("/api/users/me/avatar", {
        method: "DELETE"
      });
      if (!response.ok) {
        setMessage((await readApiError(response)).message);
        return;
      }
      setAvatarUrl(null);
      setMessage("Аватар удалён");
      window.dispatchEvent(new Event("mathforces:user-updated"));
    } catch {
      setMessage("Нет связи с сервером");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <UserAvatar
          avatarUrl={avatarUrl}
          className="size-20 text-3xl shadow-lg"
          nickname={nickname}
          rankColor={rankColor}
        />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-semibold">
            <Camera aria-hidden="true" size={17} />
            Аватар профиля
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            Квадратное изображение выглядит лучше всего · JPEG, PNG или WebP · до 5 МБ
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--strong)] px-3 text-xs font-semibold text-white disabled:opacity-60"
              disabled={pending !== null}
              onClick={() => input.current?.click()}
              type="button"
            >
              {pending === "upload" ? (
                <LoaderCircle className="animate-spin" size={15} />
              ) : (
                <Upload size={15} />
              )}
              Загрузить
            </button>
            {avatarUrl && (
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--line-strong)] px-3 text-xs font-semibold text-[var(--accent)] disabled:opacity-60"
                disabled={pending !== null}
                onClick={() => void remove()}
                type="button"
              >
                {pending === "delete" ? (
                  <LoaderCircle className="animate-spin" size={15} />
                ) : (
                  <Trash2 size={15} />
                )}
                Удалить
              </button>
            )}
          </div>
          <input
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => void upload(event.target.files?.[0])}
            ref={input}
            type="file"
          />
        </div>
      </div>
      {message && (
        <p
          className={`mt-3 text-xs font-semibold ${
            message === "Аватар обновлён" || message === "Аватар удалён"
              ? "text-emerald-700"
              : "text-[var(--accent)]"
          }`}
          role="status"
        >
          {message}
        </p>
      )}
    </div>
  );
}
