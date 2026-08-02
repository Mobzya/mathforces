import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock3,
  Radio,
  Sparkles,
  Trophy,
  UsersRound
} from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { FirstVisitRouter } from "@/components/content/FirstVisitRouter";
import { prisma } from "@/server/db/client";
import { getContestShowcaseStandings } from "@/server/standings/showcase";

const features = [
  {
    icon: Camera,
    index: "01",
    title: "Решайте на бумаге",
    text: "Загрузите фото полного доказательства — так же естественно, как сдать тетрадь."
  },
  {
    icon: Sparkles,
    index: "02",
    title: "Получайте разбор",
    text: "Предварительная оценка учитывает ход рассуждений, а спорные случаи проверяются вручную."
  },
  {
    icon: Trophy,
    index: "03",
    title: "Растите в рейтинге",
    text: "Каждый тур влияет на позицию, звание и личную историю олимпиадного роста."
  }
];

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if ((await cookies()).get("mathforces_welcome_seen")?.value === "1") {
    redirect("/feed");
  }
  const running = await prisma.contest.findFirst({
    include: {
      _count: { select: { registrations: true } },
      problems: { orderBy: { orderIndex: "asc" }, select: { id: true } }
    },
    orderBy: { startAt: "desc" },
    where: { isPublic: true, status: "RUNNING" }
  });
  const showcase =
    running ??
    (await prisma.contest.findFirst({
      include: {
        _count: { select: { registrations: true } },
        problems: { orderBy: { orderIndex: "asc" }, select: { id: true } }
      },
      orderBy: { endAt: "desc" },
      where: { isPublic: true, status: "FINISHED" }
    }));
  const standings = showcase ? await getContestShowcaseStandings(showcase.id) : [];
  return (
    <>
      <FirstVisitRouter />
      <section className="paper-grid relative overflow-hidden border-b border-[var(--line)]">
        <div className="page-shell grid min-h-[620px] items-center gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          <div className="relative z-10">
            <Badge className="mb-6" tone="red">
              <span className="size-1.5 rounded-full bg-current" />
              Новый формат олимпиад
            </Badge>
            <h1 className="max-w-3xl font-display text-[clamp(3rem,7vw,5.8rem)] font-semibold leading-[0.94] tracking-[-0.055em] text-[var(--ink)]">
              Математика
              <br />
              становится <span className="italic text-[var(--accent)]">спортом.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[var(--muted)] sm:text-xl">
              Контесты для школьников с проверкой решений по фотографии, живой таблицей и рейтингом,
              который хочется повышать.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <ButtonLink className="px-6" href="/register">
                Начать решать
                <ArrowRight aria-hidden="true" size={17} />
              </ButtonLink>
              <ButtonLink className="px-6" href="/contests" variant="secondary">
                Смотреть контесты
              </ButtonLink>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-[var(--muted)]">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="text-emerald-600" size={16} />
                Бесплатный старт
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="text-emerald-600" size={16} />
                Работает на телефоне
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl lg:mx-0 lg:ml-auto">
            <div className="absolute -left-5 -top-5 hidden h-full w-full rounded-[1.75rem] border border-[var(--line-strong)] bg-white/30 sm:block" />
            <div className="card relative overflow-hidden rounded-[1.75rem]">
              <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge tone={running ? "green" : "gray"}>
                      <Radio size={11} />
                      {running ? "Сейчас идёт" : "Последний контест"}
                    </Badge>
                  </div>
                  <h2 className="mt-2 font-display text-xl font-semibold">
                    {showcase?.title ?? "Первый контест скоро"}
                  </h2>
                </div>
                <div className="text-right">
                  <div className="inline-flex items-center gap-1.5 font-mono text-sm font-bold text-[var(--accent)]">
                    <Clock3 size={15} />
                    {showcase
                      ? new Date(running ? showcase.endAt : showcase.startAt).toLocaleDateString(
                          "ru-RU",
                          { day: "2-digit", month: "short" }
                        )
                      : "—"}
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {running ? "завершение" : "дата тура"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-[3rem_1fr_auto] items-center border-b border-[var(--line)] bg-[var(--surface-muted)] px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
                <span>Место</span>
                <span>Участник</span>
                <span>Баллы</span>
              </div>
              {standings.map((row) => (
                <div
                  className="grid grid-cols-[3rem_1fr_auto] items-center border-b border-[var(--line)] px-5 py-3.5 last:border-0"
                  key={row.user.id}
                >
                  <span className="font-display text-lg font-semibold text-[var(--muted)]">
                    {row.place}
                  </span>
                  <div>
                    <p
                      className="font-mono text-sm font-bold"
                      style={{ color: row.user.rankColor }}
                    >
                      {row.user.nickname}
                    </p>
                    <div className="mt-1.5 flex gap-1">
                      {[0, 1, 2, 3, 4].map((problem) => (
                        <span
                          className={`h-1.5 w-7 rounded-full ${
                            showcase?.problems[problem] &&
                            row.scoredProblemIds.includes(showcase.problems[problem].id)
                              ? "bg-emerald-500"
                              : "bg-[var(--line)]"
                          }`}
                          key={problem}
                        />
                      ))}
                    </div>
                  </div>
                  <span className="font-mono text-sm font-bold">{row.totalScore}</span>
                </div>
              ))}
              <div className="flex items-center justify-between bg-[var(--strong)] px-5 py-4 text-white">
                <div className="flex items-center gap-2 text-sm">
                  <UsersRound size={17} />
                  <span>
                    <strong>{showcase?._count.registrations ?? 0}</strong> участников
                  </span>
                </div>
                <span className="text-xs text-white/65">
                  {running ? "Таблица обновляется live" : "Итоговые результаты"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="page-section">
        <div className="page-shell">
          <SectionHeading eyebrow="Как это работает" title="Всё важное — в одном туре" />
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {features.map(({ icon: Icon, index, text, title }) => (
              <article
                className="card group relative min-h-72 overflow-hidden p-6 transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(19,35,61,0.08)] sm:p-7"
                key={title}
              >
                <div className="flex items-start justify-between">
                  <span className="grid size-11 place-items-center rounded-xl bg-[var(--strong)] text-white">
                    <Icon size={20} strokeWidth={1.8} />
                  </span>
                  <span className="font-display text-4xl italic text-[var(--line-strong)]">
                    {index}
                  </span>
                </div>
                <h3 className="mt-12 font-display text-2xl font-semibold tracking-[-0.025em]">
                  {title}
                </h3>
                <p className="mt-3 leading-7 text-[var(--muted)]">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--line)] bg-[var(--strong)] text-white">
        <div className="page-shell grid gap-8 py-14 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-300">
              Первый раунд уже близко
            </p>
            <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              Ваше следующее красивое доказательство может изменить рейтинг.
            </h2>
          </div>
          <ButtonLink
            className="w-full bg-white text-[var(--ink)] hover:bg-white/90 md:w-auto"
            href="/register"
          >
            Создать аккаунт
            <ArrowRight size={17} />
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
