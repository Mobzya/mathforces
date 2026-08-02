"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Building2,
  CircleMinus,
  Crown,
  Medal,
  Radio,
  Sparkles,
  Trophy,
  UsersRound
} from "lucide-react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { shouldReduceMotion } from "@/lib/preferences";
import type {
  RatingLeaderboardPayload,
  RatingLeaderboardRow,
  RatingOrganization
} from "@/types/rating";

type LiveStatus = "connecting" | "live" | "offline";

export function RatingLeaderboard({
  initialLeaderboard,
  organizations
}: {
  initialLeaderboard: RatingLeaderboardPayload;
  organizations: RatingOrganization[];
}) {
  const [leaderboard, setLeaderboard] = useState(initialLeaderboard);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>("connecting");
  const [isNavigating, startNavigation] = useTransition();
  const router = useRouter();
  const leaderboardRef = useRef(initialLeaderboard);
  const rowElements = useRef(new Map<string, HTMLAnchorElement>());
  const previousPositions = useRef(new Map<string, DOMRect>());
  const previousRatings = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const reduceMotion = shouldReduceMotion();
    if (reduceMotion) {
      previousPositions.current.clear();
      previousRatings.current.clear();
      return;
    }

    for (const [id, element] of rowElements.current) {
      const previous = previousPositions.current.get(id);
      const current = element.getBoundingClientRect();
      if (previous) {
        const deltaY = previous.top - current.top;
        if (Math.abs(deltaY) > 1) {
          element.animate(
            [
              { transform: `translateY(${deltaY}px)`, zIndex: 2 },
              { transform: "translateY(0)", zIndex: 2 }
            ],
            { duration: 700, easing: "cubic-bezier(.2,.8,.2,1)" }
          );
        }
      } else if (previousPositions.current.size > 0) {
        element.animate(
          [
            { opacity: 0, transform: "translateY(12px)" },
            { opacity: 1, transform: "translateY(0)" }
          ],
          { duration: 450, easing: "ease-out" }
        );
      }

      const oldRating = previousRatings.current.get(id);
      const newRating = leaderboard.rows.find((row) => row.id === id)?.currentRating;
      if (oldRating !== undefined && newRating !== undefined && oldRating !== newRating) {
        element.animate(
          [
            {
              backgroundColor:
                newRating > oldRating ? "rgba(16, 185, 129, 0.16)" : "rgba(198, 62, 70, 0.14)"
            },
            { backgroundColor: "rgba(255, 255, 255, 0.9)" }
          ],
          { duration: 1_200, easing: "ease-out" }
        );
      }
    }
    previousPositions.current.clear();
    previousRatings.current.clear();
  }, [leaderboard]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (initialLeaderboard.organizationId) {
      params.set("organization", initialLeaderboard.organizationId);
    }
    if (initialLeaderboard.scope === "friends") params.set("scope", "friends");
    params.set("page", String(initialLeaderboard.page));
    let source: EventSource | null = null;
    const connect = () => {
      if (source || document.visibilityState === "hidden") return;
      source = new EventSource(`/api/rating/stream?${params.toString()}`);
      source.addEventListener("open", () => setLiveStatus("live"));
      source.addEventListener("rating", (event) => {
        try {
          const next = JSON.parse((event as MessageEvent<string>).data) as RatingLeaderboardPayload;
          previousPositions.current = new Map(
            [...rowElements.current].map(([id, element]) => [id, element.getBoundingClientRect()])
          );
          previousRatings.current = new Map(
            leaderboardRef.current.rows.map((row) => [row.id, row.currentRating])
          );
          leaderboardRef.current = next;
          setLeaderboard(next);
          setLiveStatus("live");
        } catch {
          setLiveStatus("offline");
        }
      });
      source.addEventListener("warning", () => setLiveStatus("offline"));
      source.addEventListener("error", () => setLiveStatus("offline"));
    };
    const disconnect = () => {
      source?.close();
      source = null;
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") disconnect();
      else {
        setLiveStatus("connecting");
        connect();
      }
    };

    connect();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [initialLeaderboard.organizationId, initialLeaderboard.page, initialLeaderboard.scope]);

  function changeOrganization(organizationId: string) {
    startNavigation(() => {
      router.push(ratingHref(organizationId || null, 1, leaderboard.scope));
    });
  }

  function changeScope() {
    startNavigation(() => {
      router.push(
        ratingHref(
          leaderboard.organizationId,
          1,
          leaderboard.scope === "friends" ? "all" : "friends"
        )
      );
    });
  }

  const podium = leaderboard.page === 1 ? leaderboard.rows.slice(0, 3) : [];
  const selectedOrganization = organizations.find(
    (organization) => organization.id === leaderboard.organizationId
  );

  return (
    <>
      <section className="relative overflow-hidden bg-[var(--strong)] text-white">
        <div className="absolute -right-24 -top-28 size-96 rounded-full border border-white/10" />
        <div className="absolute -right-8 -top-12 size-64 rounded-full border border-white/10" />
        <div className="absolute -bottom-32 left-[15%] size-80 rounded-full bg-[var(--accent)]/10 blur-3xl" />
        <div className="page-shell relative py-12 sm:py-16">
          <div className="grid items-end gap-8 lg:grid-cols-[1fr_auto]">
            <div>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-red-300">
                <Sparkles aria-hidden="true" size={15} />
                Глобальная классификация
              </p>
              <h1 className="mt-4 max-w-3xl font-display text-[clamp(2.8rem,7vw,5.8rem)] font-semibold leading-[0.92] tracking-[-0.055em]">
                Таблица
                <br />
                <span className="italic text-red-300">рейтинга.</span>
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/60 sm:text-lg">
                Каждый рейтинговый тур меняет не только число, но и положение среди всех участников
                Mathforces.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:w-[31rem]">
              <HeroMetric icon={UsersRound} label="Участников" value={leaderboard.total} />
              <HeroMetric icon={Trophy} label="С рейтингом" value={leaderboard.ratedCount} />
              <div className="col-span-2 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm sm:col-span-1">
                <p className="flex items-center gap-2 text-xs text-white/50">
                  <Radio
                    aria-hidden="true"
                    className={liveStatus === "live" ? "text-emerald-300" : "text-amber-300"}
                    size={14}
                  />
                  {liveStatus === "live"
                    ? "Обновляется live"
                    : liveStatus === "connecting"
                      ? "Подключаемся"
                      : "Переподключаемся"}
                </p>
                <p className="mt-3 truncate text-sm font-semibold">
                  {leaderboard.lastContest?.title ?? "Туров пока не было"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell page-section">
        <div className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
          <label className="form-label w-full sm:max-w-md">
            <span className="flex items-center gap-2">
              <Building2 aria-hidden="true" size={16} />
              Организация
            </span>
            <select
              className="field"
              disabled={isNavigating}
              onChange={(event) => changeOrganization(event.target.value)}
              value={leaderboard.organizationId ?? ""}
            >
              <option value="">Все организации · {allMembers(organizations)} уч.</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name} · {organization.memberCount} уч.
                </option>
              ))}
            </select>
          </label>
          <button
            className={`min-h-12 rounded-xl border px-4 text-sm font-bold ${leaderboard.scope === "friends" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-[var(--line-strong)] bg-[var(--surface)]"}`}
            disabled={isNavigating}
            onClick={changeScope}
            type="button"
          >
            🟢 {leaderboard.scope === "friends" ? "Только друзья" : "Фильтр по друзьям"}
          </button>
          <div className="text-sm leading-6 text-[var(--muted)] sm:max-w-md sm:text-right">
            {leaderboard.lastContest ? (
              <>
                Движение мест рассчитано относительно порядка до контеста{" "}
                <Link
                  className="font-semibold text-[var(--ink)] hover:underline"
                  href={`/contests/${leaderboard.lastContest.id}/standings`}
                >
                  «{leaderboard.lastContest.title}»
                </Link>
                .
              </>
            ) : (
              "Изменения мест появятся после первого рейтингового контеста."
            )}
          </div>
        </div>

        {podium.length > 0 && (
          <div className="mt-8 grid items-end gap-4 md:grid-cols-3">
            {podiumOrder(podium).map((row) => (
              <PodiumCard key={row.id} row={row} />
            ))}
          </div>
        )}

        <div className="mt-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
              {selectedOrganization?.name ?? "Все участники"}
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold">Полная классификация</h2>
          </div>
          <p className="text-sm text-[var(--muted)]">
            Страница {leaderboard.page} из {leaderboard.totalPages}
          </p>
        </div>

        {leaderboard.rows.length === 0 ? (
          <div className="card mt-6 grid min-h-64 place-items-center p-8 text-center">
            <div>
              <UsersRound
                className="mx-auto text-[var(--line-strong)]"
                size={38}
                strokeWidth={1.5}
              />
              <h2 className="mt-4 font-display text-2xl font-semibold">Участников пока нет</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Они появятся здесь сразу после регистрации.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-2">
            <div className="hidden grid-cols-[5rem_minmax(13rem,1.4fr)_minmax(10rem,1fr)_9rem_8rem] px-5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)] md:grid">
              <span>Место</span>
              <span>Участник</span>
              <span>Организация</span>
              <span>За тур</span>
              <span className="text-right">Рейтинг</span>
            </div>
            {leaderboard.rows.map((row) => (
              <RatingRow
                key={row.id}
                ref={(element) => {
                  if (element) rowElements.current.set(row.id, element);
                  else rowElements.current.delete(row.id);
                }}
                row={row}
              />
            ))}
          </div>
        )}

        {leaderboard.totalPages > 1 && (
          <nav
            aria-label="Страницы рейтинга"
            className="mt-8 flex items-center justify-between gap-4"
          >
            {leaderboard.page > 1 ? (
              <Link
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--line-strong)] bg-white px-4 text-sm font-semibold"
                href={ratingHref(
                  leaderboard.organizationId,
                  leaderboard.page - 1,
                  leaderboard.scope
                )}
              >
                <ArrowLeft aria-hidden="true" size={17} />
                Назад
              </Link>
            ) : (
              <span />
            )}
            {leaderboard.page < leaderboard.totalPages && (
              <Link
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--strong)] px-4 text-sm font-semibold text-white"
                href={ratingHref(
                  leaderboard.organizationId,
                  leaderboard.page + 1,
                  leaderboard.scope
                )}
              >
                Дальше
                <ArrowRight aria-hidden="true" size={17} />
              </Link>
            )}
          </nav>
        )}
      </section>
    </>
  );
}

function HeroMetric({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Trophy;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
      <Icon aria-hidden="true" className="text-red-300" size={17} />
      <p className="mt-3 font-display text-3xl font-semibold">
        <AnimatedNumber value={value} />
      </p>
      <p className="mt-1 text-xs text-white/50">{label}</p>
    </div>
  );
}

function PodiumCard({ row }: { row: RatingLeaderboardRow }) {
  const isWinner = row.place === 1;
  return (
    <Link
      className={`group relative overflow-hidden rounded-[1.5rem] border p-5 transition duration-300 hover:-translate-y-1 ${
        isWinner
          ? "border-[var(--ink)] bg-[var(--strong)] text-white shadow-[0_24px_60px_rgba(19,35,61,0.18)] md:min-h-64 md:p-6"
          : "border-[var(--line)] bg-white md:min-h-56"
      }`}
      href={`/profile/${row.id}`}
    >
      <div
        className="absolute -right-8 -top-8 size-32 rounded-full opacity-15"
        style={{ backgroundColor: row.rankColor }}
      />
      <div className="relative flex items-start justify-between">
        <span
          className={`grid size-11 place-items-center rounded-xl ${
            isWinner ? "bg-white/10 text-amber-300" : "bg-[var(--surface-muted)]"
          }`}
        >
          {isWinner ? (
            <Crown aria-hidden="true" size={21} />
          ) : (
            <Medal aria-hidden="true" size={20} />
          )}
        </span>
        <span className="font-display text-4xl font-semibold opacity-35">{row.place}</span>
      </div>
      <div className="relative mt-8 flex min-w-0 items-center gap-3">
        <UserAvatar
          avatarUrl={row.avatarUrl}
          className="size-11 text-lg"
          nickname={row.nickname}
          rankColor={row.rankColor}
          sizes="44px"
        />
        <div className="min-w-0">
          <p
            className="truncate font-mono text-lg font-bold group-hover:underline"
            style={{ color: isWinner ? "white" : row.rankColor }}
          >
            {row.nickname}
          </p>
          <p
            className={`mt-1 truncate text-xs ${isWinner ? "text-white/55" : "text-[var(--muted)]"}`}
          >
            {row.organization.name}
          </p>
        </div>
      </div>
      <div className="relative mt-5 flex items-end justify-between gap-3">
        <p className="font-display text-4xl font-semibold">
          {row.currentRating > 0 ? <AnimatedNumber value={row.currentRating} /> : "—"}
        </p>
        <PlaceMovement compact delta={row.placeDelta} />
      </div>
    </Link>
  );
}

const RatingRow = function RatingRow({
  ref,
  row
}: {
  ref: (element: HTMLAnchorElement | null) => void;
  row: RatingLeaderboardRow;
}) {
  return (
    <Link
      data-rating-row
      className="card relative grid gap-3 overflow-hidden p-4 transition-shadow hover:border-[var(--line-strong)] hover:shadow-[0_16px_45px_rgba(19,35,61,0.08)] md:grid-cols-[5rem_minmax(13rem,1.4fr)_minmax(10rem,1fr)_9rem_8rem] md:items-center md:px-5"
      href={`/profile/${row.id}`}
      ref={ref}
    >
      <div className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: row.rankColor }} />
      <div className="flex items-center gap-2 md:block">
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted)] md:hidden">
          Место
        </span>
        <span className="font-display text-2xl font-semibold">
          <AnimatedNumber value={row.place} />
        </span>
      </div>
      <div className="flex min-w-0 items-center gap-3">
        <UserAvatar
          avatarUrl={row.avatarUrl}
          className="size-10 text-sm"
          nickname={row.nickname}
          rankColor={row.rankColor}
          sizes="40px"
        />
        <div className="min-w-0">
          <p
            className="truncate font-mono font-bold hover:underline"
            style={{ color: row.rankColor }}
          >
            {row.nickname}
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{row.rankTitle}</p>
        </div>
      </div>
      <p className="flex min-w-0 items-center gap-2 truncate text-sm text-[var(--muted)]">
        <Building2 aria-hidden="true" className="shrink-0" size={15} />
        <span className="truncate">{row.organization.name}</span>
      </p>
      <PlaceMovement delta={row.placeDelta} />
      <div className="flex items-baseline justify-between gap-3 md:block md:text-right">
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted)] md:hidden">
          Рейтинг
        </span>
        <p className="font-display text-3xl font-semibold">
          {row.currentRating > 0 ? <AnimatedNumber value={row.currentRating} /> : "—"}
        </p>
        {row.ratingDelta !== null && (
          <p
            className={`mt-0.5 font-mono text-xs font-bold ${
              row.ratingDelta >= 0 ? "text-emerald-700" : "text-[var(--accent)]"
            }`}
          >
            {row.ratingDelta > 0 ? "+" : ""}
            {row.ratingDelta} за тур
          </p>
        )}
      </div>
    </Link>
  );
};

function PlaceMovement({ compact = false, delta }: { compact?: boolean; delta: number }) {
  if (delta > 0) {
    return (
      <span
        className={`inline-flex items-center gap-1 font-mono font-bold text-emerald-700 ${
          compact ? "text-xs" : "text-sm"
        }`}
        title={`Поднялся на ${delta} мест`}
      >
        <ArrowUp aria-hidden="true" size={16} />
        {delta}
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span
        className={`inline-flex items-center gap-1 font-mono font-bold text-[var(--accent)] ${
          compact ? "text-xs" : "text-sm"
        }`}
        title={`Опустился на ${Math.abs(delta)} мест`}
      >
        <ArrowDown aria-hidden="true" size={16} />
        {Math.abs(delta)}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 text-[var(--muted)] ${
        compact ? "text-xs" : "text-sm"
      }`}
      title="Место не изменилось"
    >
      <CircleMinus aria-hidden="true" size={15} />0
    </span>
  );
}

function podiumOrder(rows: RatingLeaderboardRow[]) {
  if (rows.length < 3) return rows;
  return [rows[1], rows[0], rows[2]];
}

function allMembers(organizations: RatingOrganization[]) {
  return organizations.reduce((total, organization) => total + organization.memberCount, 0);
}

function ratingHref(organizationId: string | null, page: number, scope: "all" | "friends") {
  const params = new URLSearchParams();
  if (organizationId) params.set("organization", organizationId);
  if (page > 1) params.set("page", String(page));
  if (scope === "friends") params.set("scope", "friends");
  const query = params.toString();
  return query ? `/rating?${query}` : "/rating";
}
