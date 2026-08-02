import type { Metadata } from "next";
import type { CSSProperties } from "react";
import {
  Building2,
  BookOpenCheck,
  CalendarDays,
  ChartNoAxesCombined,
  GraduationCap,
  LogIn,
  Shapes,
  TrendingUp,
  UserPlus
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProfileSettings } from "@/components/profile/ProfileSettings";
import { ActivityHeatmap } from "@/components/profile/ActivityHeatmap";
import { FriendButton } from "@/components/friends/FriendButton";
import { RatingChart } from "@/components/profile/RatingChart";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { Badge } from "@/components/ui/Badge";
import { getRankMeta } from "@/lib/rating/rank";
import { prisma } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { serializeCurrentUser } from "@/server/users/serialize";
import { isUuid } from "@/server/validation/primitives";
import { getFriendshipBetween } from "@/server/friends/queries";
import { profileAccentColor, TOPIC_LABELS } from "@/lib/profile/customization";

export const metadata: Metadata = {
  title: "Профиль"
};

export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let currentUser;
  let user;
  let resolvedId = id;

  if (id === "me") {
    currentUser = await getCurrentUser();
    if (!currentUser) {
      redirect("/login");
    }
    resolvedId = currentUser.id;
    user = await findProfileUser(resolvedId);
  } else {
    if (!isUuid(resolvedId)) notFound();
    [currentUser, user] = await Promise.all([getCurrentUser(), findProfileUser(resolvedId)]);
  }
  if (!user) {
    notFound();
  }

  const isOwner = currentUser?.id === user.id;
  const friendship =
    currentUser && !isOwner ? await getFriendshipBetween(currentUser.id, user.id) : null;
  const createdAt = new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric"
  }).format(user.createdAt);
  const rank = getRankMeta(user.currentRating);
  const profileAccent = profileAccentColor(user.profileAccent);
  const canSeeOrganization = isOwner || user.showOrganization !== false;
  const canSeeGrade = isOwner || user.showGrade !== false;
  const archiveActivity = await getArchiveActivity(user.id);

  return (
    <section className="page-section">
      <div className="page-shell">
        {!currentUser && (
          <div className="card mb-5 flex flex-col gap-4 border-[var(--line-strong)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Вы смотрите публичный профиль</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Это не означает, что вы вошли в этот аккаунт. После входа появится редактирование
                собственного профиля.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-sm font-semibold"
                href="/login"
              >
                <LogIn aria-hidden="true" size={15} />
                Войти
              </Link>
              <Link
                className="button-primary inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold"
                href="/register"
              >
                <UserPlus aria-hidden="true" size={15} />
                Регистрация
              </Link>
            </div>
          </div>
        )}
        <div className="grid gap-5 lg:grid-cols-[20rem_1fr]">
          <aside className="space-y-4">
            <div className="card overflow-hidden">
              <div
                className="profile-cover relative h-32 overflow-hidden"
                data-pattern={user.profilePattern ?? "grid"}
                style={
                  {
                    "--profile-accent": profileAccent
                  } as CSSProperties
                }
              >
                <span className="absolute bottom-4 right-5 font-display text-5xl italic text-white/20">
                  Mƒ
                </span>
              </div>
              <div className="-mt-11 p-6 pt-0">
                <UserAvatar
                  avatarUrl={
                    user.avatarStorageKey
                      ? `/api/users/${user.id}/avatar?v=${user.avatarVersion}`
                      : null
                  }
                  className="size-24 border-4 border-[var(--surface)] text-4xl shadow-xl"
                  nickname={user.nickname}
                  rankColor={user.currentRating > 0 ? rank.color : "var(--strong)"}
                  sizes="96px"
                />
                <Badge className="mt-5" tone="gray">
                  {rank.title}
                </Badge>
                <h1
                  className="mt-3 break-words font-mono text-2xl font-bold"
                  style={{ color: rank.color }}
                >
                  {user.nickname}
                </h1>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                  {user.description || "Описание пока не заполнено."}
                </p>
                {currentUser && !isOwner && (
                  <FriendButton
                    initialState={
                      friendship
                        ? {
                            id: friendship.id,
                            incoming:
                              friendship.status === "PENDING" &&
                              friendship.requestedById !== currentUser.id,
                            status: friendship.status
                          }
                        : null
                    }
                    targetUserId={user.id}
                  />
                )}
                <div className="mt-6 space-y-3 border-t border-[var(--line)] pt-5 text-sm">
                  {canSeeOrganization && (
                    <div className="flex items-center gap-2 text-[var(--muted)]">
                      <Building2 size={16} />
                      {user.organization.name}
                    </div>
                  )}
                  {canSeeGrade && user.grade && (
                    <div className="flex items-center gap-2 text-[var(--muted)]">
                      <GraduationCap size={16} />
                      {user.grade} класс
                    </div>
                  )}
                  {user.favoriteTopic && (
                    <div className="flex items-center gap-2 text-[var(--muted)]">
                      <Shapes size={16} />
                      {TOPIC_LABELS[user.favoriteTopic]}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-[var(--muted)]">
                    <CalendarDays size={16} />
                    На платформе с {createdAt}
                  </div>
                </div>
              </div>
            </div>
            {isOwner && currentUser && (
              <ProfileSettings
                organizations={[
                  {
                    id: currentUser.organization.id,
                    memberCount: 0,
                    name: currentUser.organization.name
                  }
                ]}
                user={serializeCurrentUser(currentUser)}
              />
            )}
          </aside>

          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  icon: ChartNoAxesCombined,
                  label: "Текущий рейтинг",
                  value: displayRating(user.currentRating)
                },
                {
                  icon: TrendingUp,
                  label: "Максимум",
                  value: displayRating(user.maxRating)
                },
                {
                  icon: GraduationCap,
                  label: "Класс",
                  value: canSeeGrade ? (user.grade ?? "—") : "—"
                },
                {
                  icon: BookOpenCheck,
                  label: "Решено задач",
                  value: archiveActivity.solvedCount
                }
              ].map(({ icon: Icon, label, value }) => (
                <div className="card p-5" key={label}>
                  <Icon className="text-[var(--accent)]" size={20} />
                  <p className="mt-5 text-sm text-[var(--muted)]">{label}</p>
                  <p className="mt-1 font-display text-3xl font-semibold">{value}</p>
                </div>
              ))}
            </div>

            <ActivityHeatmap
              days={archiveActivity.days}
              solvedCount={archiveActivity.solvedCount}
            />

            {(isOwner || user.practiceAttempts.length > 0) && (
              <div className="card overflow-hidden">
                <div className="border-b border-[var(--line)] p-5 sm:p-6">
                  <h2 className="font-display text-2xl font-semibold">Последние решения архива</h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Последние попытки и их текущий результат.
                  </p>
                </div>
                {user.practiceAttempts.length === 0 ? (
                  <div className="p-6 text-sm text-[var(--muted)]">Попыток пока нет.</div>
                ) : (
                  <div className="divide-y divide-[var(--line)]">
                    {user.practiceAttempts.map((attempt) => (
                      <Link
                        className="grid gap-2 p-5 transition hover:bg-[var(--surface-muted)] sm:grid-cols-[minmax(0,1fr)_8rem_7rem] sm:items-center"
                        href={`/archive/${attempt.problem.id}`}
                        key={attempt.id}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{attempt.problem.title}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {new Intl.DateTimeFormat("ru-RU", {
                              dateStyle: "medium",
                              timeStyle: "short"
                            }).format(attempt.createdAt)}
                          </p>
                        </div>
                        <p className="text-sm text-[var(--muted)]">
                          {practiceStatusLabel(attempt.status)}
                        </p>
                        <p
                          className={`font-mono text-lg font-bold sm:text-right ${attempt.score !== null && attempt.score >= 90 ? "text-emerald-700" : ""}`}
                        >
                          {attempt.score === null ? "—" : `${attempt.score}/100`}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="card overflow-hidden">
              <div className="border-b border-[var(--line)] p-5 sm:p-6">
                <h2 className="font-display text-2xl font-semibold">Рост рейтинга</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {user.ratingChanges.length > 0
                    ? `${user.ratingChanges.length} рейтинговых контестов`
                    : "История появится после первого рейтингового контеста."}
                </p>
              </div>
              <div className="p-4 sm:p-6">
                <RatingChart
                  points={[...user.ratingChanges].reverse().map((change) => ({
                    contestTitle: change.contest.title,
                    date: change.contest.endAt.toISOString(),
                    delta: change.delta,
                    rating: change.newRating
                  }))}
                />
              </div>
            </div>

            {user.ratingChanges.length === 0 ? (
              <div className="card grid min-h-56 place-items-center p-8 text-center">
                <div>
                  <CalendarDays
                    className="mx-auto text-[var(--line-strong)]"
                    size={34}
                    strokeWidth={1.5}
                  />
                  <h2 className="mt-4 font-display text-xl font-semibold">
                    История участия пока пуста
                  </h2>
                  <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
                    Здесь появятся место, результат и изменение рейтинга.
                  </p>
                </div>
              </div>
            ) : (
              <div className="card overflow-hidden">
                <div className="border-b border-[var(--line)] p-5 sm:p-6">
                  <h2 className="font-display text-2xl font-semibold">История участия</h2>
                </div>
                <div className="divide-y divide-[var(--line)]">
                  {user.ratingChanges.map((change) => (
                    <Link
                      className="grid gap-3 p-5 transition hover:bg-[var(--surface-muted)] sm:grid-cols-[1fr_7rem_7rem_7rem] sm:items-center"
                      href={`/contests/${change.contest.id}/standings`}
                      key={change.id}
                    >
                      <div>
                        <p className="font-semibold">{change.contest.title}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(
                            change.contest.endAt
                          )}
                        </p>
                        {change.seedPlace && change.expectedPlace && (
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            Посев №{change.seedPlace} · ожидание{" "}
                            {change.expectedPlace.toLocaleString("ru-RU", {
                              maximumFractionDigits: 1,
                              minimumFractionDigits: 1
                            })}
                          </p>
                        )}
                      </div>
                      <p className="text-sm">
                        <span className="text-[var(--muted)]">Место </span>
                        {change.place}
                      </p>
                      <p className="text-sm">
                        <span className="text-[var(--muted)]">Баллы </span>
                        {change.totalScore}
                      </p>
                      <p
                        className={`font-mono font-bold ${change.delta >= 0 ? "text-emerald-700" : "text-[var(--accent)]"}`}
                      >
                        {change.delta > 0 ? "+" : ""}
                        {change.delta} → {change.newRating}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function displayRating(rating: number): number | string {
  return rating > 0 ? rating : "—";
}

function practiceStatusLabel(
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "NEEDS_REVIEW" | "FAILED"
) {
  if (status === "QUEUED") return "В очереди";
  if (status === "PROCESSING") return "Проверяется";
  if (status === "NEEDS_REVIEW") return "Нужна проверка";
  if (status === "FAILED") return "Ошибка";
  return "Проверено";
}

function findProfileUser(id: string) {
  return prisma.user.findUnique({
    include: {
      organization: true,
      practiceAttempts: {
        orderBy: { createdAt: "desc" },
        select: {
          createdAt: true,
          id: true,
          problem: { select: { id: true, title: true } },
          score: true,
          status: true
        },
        take: 10,
        where: {
          problem: { archiveEnabled: true, archivedAt: { not: null } }
        }
      },
      ratingChanges: {
        include: {
          contest: {
            select: { endAt: true, id: true, title: true }
          }
        },
        orderBy: { contest: { endAt: "desc" as const } },
        take: 200
      }
    },
    where: { id }
  });
}

async function getArchiveActivity(userId: string) {
  const [practice, contest] = await Promise.all([
    prisma.practiceAttempt.findMany({
      select: { completedAt: true, createdAt: true, problemId: true },
      where: { score: { gte: 90 }, status: "COMPLETED", userId }
    }),
    prisma.submission.findMany({
      select: {
        createdAt: true,
        finalScore: true,
        problem: { select: { archiveEnabled: true, maxScore: true } },
        problemId: true
      },
      where: { finalScore: { not: null }, status: "FINALIZED", userId }
    })
  ]);
  const firstSolve = new Map<string, Date>();
  for (const attempt of practice) {
    const date = attempt.completedAt ?? attempt.createdAt;
    const current = firstSolve.get(attempt.problemId);
    if (!current || date < current) firstSolve.set(attempt.problemId, date);
  }
  for (const submission of contest) {
    if (
      !submission.problem.archiveEnabled ||
      submission.finalScore === null ||
      submission.finalScore / Math.max(1, submission.problem.maxScore) < 0.9
    )
      continue;
    const current = firstSolve.get(submission.problemId);
    if (!current || submission.createdAt < current)
      firstSolve.set(submission.problemId, submission.createdAt);
  }
  const dayCounts = new Map<string, number>();
  for (const date of firstSolve.values()) {
    const key = date.toISOString().slice(0, 10);
    dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
  }
  return {
    days: [...dayCounts].map(([date, count]) => ({ count, date })),
    solvedCount: firstSolve.size
  };
}
