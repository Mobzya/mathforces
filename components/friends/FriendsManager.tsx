"use client";

import { Check, LoaderCircle, Search, UserMinus, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { readApiError } from "@/components/auth/form-utils";
import { UserAvatar } from "@/components/profile/UserAvatar";

type Person = {
  avatarUrl: string | null;
  currentRating: number;
  id: string;
  nickname: string;
  organization: string;
  rankColor: string;
};
type FriendRow = {
  friendshipId: string;
  isIncoming: boolean;
  isOnline: boolean;
  person: Person;
  status: "ACCEPTED" | "PENDING";
};

export function FriendsManager({
  accepted,
  incoming,
  outgoing,
  suggestions
}: {
  accepted: FriendRow[];
  incoming: FriendRow[];
  outgoing: FriendRow[];
  suggestions: Person[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  async function action(key: string, url: string, init: RequestInit) {
    setPending(key);
    setError("");
    try {
      const response = await fetch(url, init);
      if (!response.ok) setError((await readApiError(response)).message);
      else router.refresh();
    } catch {
      setError("Нет связи с сервером");
    } finally {
      setPending("");
    }
  }
  return (
    <div>
      <form className="card flex gap-3 p-4" method="get">
        <label className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            size={17}
          />
          <input className="field pl-10" name="q" placeholder="Найти по нику" />
        </label>
        <button className="button-primary rounded-xl px-5 text-sm font-bold" type="submit">
          Найти
        </button>
      </form>
      {error && <p className="mt-3 text-sm font-semibold text-[var(--accent)]">{error}</p>}
      {suggestions.length > 0 && (
        <Section title="Результаты поиска">
          {suggestions.map((person) => (
            <PersonCard
              action={
                <ActionButton
                  icon={UserPlus}
                  label="Добавить"
                  loading={pending === person.id}
                  onClick={() =>
                    action(person.id, "/api/friends", {
                      body: JSON.stringify({ targetUserId: person.id }),
                      headers: { "Content-Type": "application/json" },
                      method: "POST"
                    })
                  }
                />
              }
              key={person.id}
              person={person}
            />
          ))}
        </Section>
      )}
      {incoming.length > 0 && (
        <Section title="Входящие запросы">
          {incoming.map((row) => (
            <PersonCard
              action={
                <div className="flex gap-2">
                  <ActionButton
                    icon={Check}
                    label="Принять"
                    loading={pending === row.friendshipId}
                    onClick={() =>
                      action(row.friendshipId, `/api/friends/${row.friendshipId}`, {
                        method: "PATCH"
                      })
                    }
                  />
                  <ActionButton
                    icon={X}
                    label="Отклонить"
                    loading={false}
                    onClick={() =>
                      action(row.friendshipId, `/api/friends/${row.friendshipId}`, {
                        method: "DELETE"
                      })
                    }
                  />
                </div>
              }
              key={row.friendshipId}
              person={row.person}
            />
          ))}
        </Section>
      )}
      {outgoing.length > 0 && (
        <Section title="Отправленные">
          {outgoing.map((row) => (
            <PersonCard
              action={
                <ActionButton
                  icon={X}
                  label="Отменить"
                  loading={pending === row.friendshipId}
                  onClick={() =>
                    action(row.friendshipId, `/api/friends/${row.friendshipId}`, {
                      method: "DELETE"
                    })
                  }
                />
              }
              key={row.friendshipId}
              person={row.person}
            />
          ))}
        </Section>
      )}
      <Section title={`Друзья · ${accepted.length}`}>
        {accepted.length === 0 ? (
          <div className="card p-10 text-center text-sm text-[var(--muted)]">
            Найдите знакомых по нику или добавьте их из профиля.
          </div>
        ) : (
          accepted.map((row) => (
            <PersonCard
              action={
                <ActionButton
                  icon={UserMinus}
                  label="Удалить"
                  loading={pending === row.friendshipId}
                  onClick={() =>
                    action(row.friendshipId, `/api/friends/${row.friendshipId}`, {
                      method: "DELETE"
                    })
                  }
                />
              }
              isOnline={row.isOnline}
              key={row.friendshipId}
              person={row.person}
            />
          ))
        )}
      </Section>
    </div>
  );
}

function Section({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="mt-9">
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">{children}</div>
    </section>
  );
}
function PersonCard({
  action,
  isOnline,
  person
}: {
  action: React.ReactNode;
  isOnline?: boolean;
  person: Person;
}) {
  return (
    <article className="card flex items-center gap-3 p-4">
      <UserAvatar
        avatarUrl={person.avatarUrl}
        className="size-11"
        nickname={person.nickname}
        rankColor={person.rankColor}
        sizes="44px"
      />
      <div className="min-w-0 flex-1">
        <Link
          className="truncate font-mono font-bold hover:underline"
          href={`/profile/${person.id}`}
          style={{ color: person.rankColor }}
        >
          {person.nickname}
        </Link>
        <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
          {isOnline ? "🟢 сейчас на сайте · " : ""}
          {person.organization} · {person.currentRating > 0 ? person.currentRating : "—"}
        </p>
      </div>
      {action}
    </article>
  );
}
function ActionButton({
  icon: Icon,
  label,
  loading,
  onClick
}: {
  icon: typeof UserPlus;
  label: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 text-xs font-bold"
      disabled={loading}
      onClick={onClick}
      type="button"
    >
      {loading ? <LoaderCircle className="animate-spin" size={14} /> : <Icon size={14} />}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
