"use client";

import { Dices, RotateCcw, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useOptimistic, useRef, useState } from "react";
import { ARCHIVE_AREAS } from "@/lib/archive/taxonomy";
import type { ProblemTopicValue } from "@/types/contest";

type WheelProblem = { id: string; subtopic: string; topic: ProblemTopicValue };
type DragState = { angle: number; moved: boolean; rotation: number } | null;
type SpinMode = "inner" | "outer" | null;

const CENTER = 260;
const OUTER = 238;
const INNER = 128;
const LABEL_RADIUS = 184;
const SPIN_MS = 2200;

function point(radius: number, degrees: number) {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(radians), y: CENTER + radius * Math.sin(radians) };
}

function annularPath(start: number, end: number, outer: number, inner: number) {
  const a = point(outer, start);
  const b = point(outer, end);
  const c = point(inner, end);
  const d = point(inner, start);
  const large = end - start > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${outer} ${outer} 0 ${large} 1 ${b.x} ${b.y} L ${c.x} ${c.y} A ${inner} ${inner} 0 ${large} 0 ${d.x} ${d.y} Z`;
}

function wedgePath(index: number) {
  return annularPath(index * 30, index * 30 + 30, OUTER, INNER);
}

export function ArchiveWheel({
  problems,
  selectedSubtopic,
  selectedTopic
}: {
  problems: WheelProblem[];
  selectedSubtopic?: string | null;
  selectedTopic?: ProblemTopicValue | null;
}) {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<DragState>(null);
  const suppressClick = useRef(false);
  const spinTimer = useRef<number | null>(null);
  const [rotation, setRotation] = useState(0);
  const [innerRotation, setInnerRotation] = useState(0);
  const [spinMode, setSpinMode] = useState<SpinMode>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [optimisticSelection, setOptimisticSelection] = useOptimistic(
    {
      subtopic: selectedSubtopic ?? null,
      topic: selectedTopic ?? null
    },
    (_current, next: { subtopic: string | null; topic: ProblemTopicValue | null }) => next
  );
  const spinning = spinMode !== null;
  const activeTopic = spinMode === "outer" ? null : optimisticSelection.topic;
  const activeSubtopic = spinning ? null : optimisticSelection.subtopic;
  const selectedArea = ARCHIVE_AREAS.find((area) => area.key === activeTopic) ?? null;
  const counts = useMemo(() => {
    const result = new Map<ProblemTopicValue, number>();
    for (const problem of problems) result.set(problem.topic, (result.get(problem.topic) ?? 0) + 1);
    return result;
  }, [problems]);
  const randomProblemPool = useMemo(
    () => problems.filter((problem) => !activeTopic || problem.topic === activeTopic),
    [activeTopic, problems]
  );
  const innerSubtopics = useMemo(() => {
    if (!selectedArea) return [];
    const actual = Array.from(
      new Set(
        problems
          .filter((problem) => problem.topic === selectedArea.key)
          .map((problem) => problem.subtopic.trim())
          .filter(Boolean)
      )
    ).sort((left, right) => left.localeCompare(right, "ru"));
    return actual.length > 0 ? actual : selectedArea.subtopics;
  }, [problems, selectedArea]);

  useEffect(
    () => () => {
      if (spinTimer.current) window.clearTimeout(spinTimer.current);
    },
    []
  );

  function updateFilter(topic?: ProblemTopicValue, subtopic?: string, scroll = true) {
    const url = new URL(window.location.href);
    if (topic) url.searchParams.set("topic", topic);
    else url.searchParams.delete("topic");
    if (subtopic) url.searchParams.set("subtopic", subtopic);
    else url.searchParams.delete("subtopic");
    url.searchParams.delete("page");
    startTransition(() => {
      setOptimisticSelection({
        subtopic: subtopic ?? null,
        topic: topic ?? null
      });
      router.replace(`${url.pathname}${url.search}`, { scroll: false });
    });
    if (scroll)
      window.setTimeout(
        () =>
          document
            .querySelector("#archive-list")
            ?.scrollIntoView({ behavior: "smooth", block: "start" }),
        380
      );
  }

  function alignedRotation(index: number, turns = 0) {
    const target = -(index * 30 + 15);
    const normalizedCurrent = ((rotation % 360) + 360) % 360;
    const normalizedTarget = ((target % 360) + 360) % 360;
    const forward = (normalizedTarget - normalizedCurrent + 360) % 360;
    return rotation + turns * 360 + forward;
  }

  function chooseArea(index: number) {
    if (spinning || suppressClick.current) return;
    const area = ARCHIVE_AREAS[index]!;
    setInnerRotation(0);
    setRotation(alignedRotation(index));
    updateFilter(area.key, undefined, false);
  }

  function spinOuterTo(index: number, complete: () => void) {
    if (spinTimer.current) window.clearTimeout(spinTimer.current);
    setSpinMode("outer");
    setRotation(alignedRotation(index, 4 + Math.floor(Math.random() * 2)));
    spinTimer.current = window.setTimeout(() => {
      setSpinMode(null);
      complete();
    }, SPIN_MS + 80);
  }

  function spinInnerTo(index: number, count: number, complete: () => void) {
    if (spinTimer.current) window.clearTimeout(spinTimer.current);
    const sector = 360 / Math.max(1, count);
    const target = -(index * sector + sector / 2);
    const current = ((innerRotation % 360) + 360) % 360;
    const normalizedTarget = ((target % 360) + 360) % 360;
    const forward = (normalizedTarget - current + 360) % 360;
    setSpinMode("inner");
    setInnerRotation(innerRotation + (5 + Math.floor(Math.random() * 2)) * 360 + forward);
    spinTimer.current = window.setTimeout(() => {
      setSpinMode(null);
      complete();
    }, SPIN_MS + 80);
  }

  function randomArea() {
    const available = ARCHIVE_AREAS.filter((area) => (counts.get(area.key) ?? 0) > 0);
    const area =
      available[Math.floor(Math.random() * available.length)] ??
      ARCHIVE_AREAS[Math.floor(Math.random() * ARCHIVE_AREAS.length)]!;
    const index = ARCHIVE_AREAS.indexOf(area);
    spinOuterTo(index, () => updateFilter(area.key, undefined, false));
  }

  function randomProblem() {
    const problem = randomProblemPool[Math.floor(Math.random() * randomProblemPool.length)];
    if (!problem) return;
    if (activeTopic && selectedArea) {
      const normalizedProblemSubtopic = problem.subtopic.toLocaleLowerCase("ru");
      const subtopicIndex = Math.max(
        0,
        innerSubtopics.findIndex((subtopic) => {
          const normalized = subtopic.toLocaleLowerCase("ru");
          return (
            normalizedProblemSubtopic.includes(normalized) ||
            normalized.includes(normalizedProblemSubtopic)
          );
        })
      );
      spinInnerTo(subtopicIndex, innerSubtopics.length, () =>
        router.push(`/archive/${problem.id}`)
      );
      return;
    }
    const index = ARCHIVE_AREAS.findIndex((area) => area.key === problem.topic);
    spinOuterTo(index, () => router.push(`/archive/${problem.id}`));
  }

  function pointerAngle(event: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current!.getBoundingClientRect();
    return (
      (Math.atan2(
        event.clientY - (rect.top + rect.height / 2),
        event.clientX - (rect.left + rect.width / 2)
      ) *
        180) /
      Math.PI
    );
  }

  function onPointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if (spinning) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { angle: pointerAngle(event), moved: false, rotation };
    setIsDragging(true);
  }

  function onPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!drag.current || spinning) return;
    let delta = pointerAngle(event) - drag.current.angle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    if (Math.abs(delta) > 2) drag.current.moved = true;
    setRotation(drag.current.rotation + delta);
  }

  function onPointerUp(event: React.PointerEvent<SVGSVGElement>) {
    if (!drag.current) return;
    suppressClick.current = drag.current.moved;
    drag.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
  }

  return (
    <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,36rem)_1fr]">
      <div className="relative mx-auto aspect-square w-full max-w-[36rem] select-none">
        <div className="absolute inset-[7%] rounded-full bg-[var(--surface)] shadow-[0_30px_90px_rgba(19,35,61,.14)]" />
        <div
          className="absolute left-1/2 top-[2.5%] z-10 -translate-x-1/2 drop-shadow-md"
          aria-hidden="true"
        >
          <span className="block h-0 w-0 border-x-[10px] border-t-[18px] border-x-transparent border-t-[var(--ink)]" />
        </div>
        <svg
          aria-label="Интерактивное колесо математических областей. Его можно вращать пальцем или мышью."
          className={`relative size-full overflow-visible touch-none ${spinning ? "cursor-wait" : "cursor-grab active:cursor-grabbing"}`}
          onPointerCancel={onPointerUp}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          ref={svgRef}
          role="img"
          viewBox="0 0 520 520"
        >
          <defs>
            <filter id="wheel-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow
                dx="0"
                dy="8"
                floodColor="#13233d"
                floodOpacity="0.22"
                stdDeviation="10"
              />
            </filter>
          </defs>
          <g
            className="origin-center"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition:
                spinMode === "outer"
                  ? `transform ${SPIN_MS}ms cubic-bezier(.12,.66,.08,1)`
                  : isDragging
                    ? "none"
                    : "transform 620ms cubic-bezier(.2,.8,.2,1)"
            }}
          >
            {ARCHIVE_AREAS.map((area, index) => {
              const mid = index * 30 + 15;
              const label = point(LABEL_RADIUS, mid);
              const count = counts.get(area.key) ?? 0;
              const active = area.key === activeTopic;
              const radians = ((mid - 90) * Math.PI) / 180;
              const distance = active ? 11 : activeTopic ? -4 : 0;
              const dx = Math.cos(radians) * distance;
              const dy = Math.sin(radians) * distance;
              const scale = active ? 1.035 : activeTopic ? 0.985 : 1;
              return (
                <g
                  className="archive-wheel-sector cursor-pointer outline-none"
                  key={area.key}
                  onClick={() => chooseArea(index)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") chooseArea(index);
                  }}
                  role="button"
                  style={{
                    opacity: activeTopic && !active ? 0.64 : 1,
                    transform: `translate(${dx}px, ${dy}px) scale(${scale})`,
                    transformBox: "fill-box",
                    transformOrigin: "center"
                  }}
                  tabIndex={0}
                >
                  <path
                    className="transition-all duration-500 hover:brightness-110"
                    d={wedgePath(index)}
                    fill={area.color}
                    filter={active ? "url(#wheel-shadow)" : undefined}
                    opacity={0.96}
                    stroke="var(--background)"
                    strokeWidth={active ? 6 : 3}
                  />
                  {area.subtopics.slice(1).map((_, lineIndex) => {
                    const angle = index * 30 + ((lineIndex + 1) * 30) / area.subtopics.length;
                    const start = point(INNER, angle);
                    const end = point(OUTER, angle);
                    return (
                      <line
                        key={angle}
                        opacity={active ? ".55" : ".3"}
                        stroke="white"
                        strokeWidth="1.3"
                        x1={start.x}
                        x2={end.x}
                        y1={start.y}
                        y2={end.y}
                      />
                    );
                  })}
                  <text
                    fill="white"
                    fontSize={active ? "10" : "13"}
                    fontWeight="700"
                    textAnchor="middle"
                    transform={`rotate(${mid > 180 ? mid + 90 : mid - 90} ${label.x} ${label.y})`}
                    x={label.x}
                    y={label.y + (active ? -10 : -5)}
                  >
                    {area.shortLabel}
                  </text>
                  {active && (
                    <text
                      className="archive-wheel-new-label"
                      fill="rgba(255,255,255,.9)"
                      fontSize="8"
                      fontWeight="700"
                      textAnchor="middle"
                      transform={`rotate(${mid > 180 ? mid + 90 : mid - 90} ${label.x} ${label.y})`}
                      x={label.x}
                      y={label.y + 2}
                    >
                      ВЫБРАНО
                    </text>
                  )}
                  <text
                    fill="rgba(255,255,255,.76)"
                    fontSize="9"
                    textAnchor="middle"
                    transform={`rotate(${mid > 180 ? mid + 90 : mid - 90} ${label.x} ${label.y})`}
                    x={label.x}
                    y={label.y + (active ? 15 : 11)}
                  >
                    {count} задач
                  </text>
                </g>
              );
            })}
          </g>

          {selectedArea ? (
            <g
              className="archive-subtopic-ring"
              key={`${selectedArea.key}:${innerSubtopics.join("|")}`}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <g
                style={{
                  transform: `rotate(${innerRotation}deg)`,
                  transformOrigin: `${CENTER}px ${CENTER}px`,
                  transition:
                    spinMode === "inner"
                      ? `transform ${SPIN_MS}ms cubic-bezier(.12,.66,.08,1)`
                      : "transform 520ms cubic-bezier(.2,.8,.2,1)"
                }}
              >
                {innerSubtopics.map((subtopic, index) => {
                  const start = index * (360 / innerSubtopics.length);
                  const end = (index + 1) * (360 / innerSubtopics.length);
                  const label = point(96, start + (end - start) / 2);
                  const active = activeSubtopic === subtopic;
                  const chooseSubtopic = () => updateFilter(selectedArea.key, subtopic);
                  return (
                    <g
                      aria-label={`Выбрать подтему «${subtopic}»`}
                      className="cursor-pointer outline-none"
                      key={subtopic}
                      onClick={(event) => {
                        event.stopPropagation();
                        chooseSubtopic();
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          chooseSubtopic();
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <path
                        className="archive-inner-sector"
                        d={annularPath(start + 1.5, end - 1.5, 122, 67)}
                        fill={active ? "var(--strong)" : selectedArea.color}
                        opacity={active ? 1 : 0.78}
                        stroke="var(--surface)"
                        strokeWidth="2"
                      />
                      <text
                        fill="white"
                        fontSize="9"
                        fontWeight="700"
                        textAnchor="middle"
                        x={label.x}
                        y={label.y + 3}
                      >
                        <title>{subtopic}</title>
                        {shorten(subtopic)}
                      </text>
                    </g>
                  );
                })}
              </g>
              <path d="M 253 132 L 267 132 L 260 144 Z" fill="var(--ink)" opacity=".86" />
              <circle cx={CENTER} cy={CENTER} fill="var(--strong)" r="59" />
              <text
                fill="white"
                fontFamily="Georgia, serif"
                fontSize="13"
                fontWeight="700"
                textAnchor="middle"
                x={CENTER}
                y={CENTER - 4}
              >
                {shorten(selectedArea.shortLabel, 13)}
              </text>
              <text
                fill="rgba(255,255,255,.62)"
                fontSize="8"
                textAnchor="middle"
                x={CENTER}
                y={CENTER + 13}
              >
                подтемы внутри
              </text>
            </g>
          ) : (
            <g>
              <circle cx={CENTER} cy={CENTER} fill="var(--strong)" r="75" />
              <circle cx={CENTER} cy={CENTER} fill="none" opacity=".16" r="63" stroke="white" />
              <text
                fill="white"
                fontFamily="Georgia, serif"
                fontSize="24"
                fontWeight="700"
                textAnchor="middle"
                x={CENTER}
                y={CENTER - 6}
              >
                12
              </text>
              <text
                fill="rgba(255,255,255,.68)"
                fontSize="11"
                textAnchor="middle"
                x={CENTER}
                y={CENTER + 16}
              >
                областей
              </text>
            </g>
          )}
        </svg>
        <p className="pointer-events-none absolute inset-x-0 bottom-0 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
          Потяните, чтобы повернуть
        </p>
      </div>

      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
          <Sparkles size={14} /> Карта архива
        </div>
        <div className="min-h-28">
          <div
            aria-live="polite"
            className="archive-selection-copy"
            key={selectedArea?.key ?? "all"}
          >
            <h2 className="mt-5 font-display text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
              {selectedArea?.label ?? "Выберите область"}
            </h2>
            <p className="mt-3 max-w-xl leading-7 text-[var(--muted)]">
              {spinMode === "inner"
                ? "Выбираем подтему и задачу…"
                : spinMode === "outer"
                  ? "Колесо выбирает область…"
                  : selectedArea
                    ? "Подтемы появились внутри колеса — нажмите на нужную или запустите случайную задачу."
                    : "Поворачивайте колесо мышью или пальцем, нажмите сектор или доверьтесь случаю."}
            </p>
          </div>
        </div>

        {selectedArea && (
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${!activeSubtopic ? "border-[var(--strong)] bg-[var(--strong)] text-white" : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--line-strong)]"}`}
              onClick={() => updateFilter(selectedArea.key)}
              type="button"
            >
              Все подтемы
            </button>
            {innerSubtopics.map((subtopic) => (
              <button
                className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${activeSubtopic === subtopic ? "border-[var(--strong)] bg-[var(--strong)] text-white" : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--line-strong)]"}`}
                key={subtopic}
                onClick={() => updateFilter(selectedArea.key, subtopic)}
                type="button"
              >
                {subtopic}
              </button>
            ))}
          </div>
        )}

        <div className="mt-7 flex flex-wrap gap-3">
          <button
            className="button-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold disabled:opacity-60"
            disabled={spinning}
            onClick={randomArea}
            type="button"
          >
            <RotateCcw className={spinMode === "outer" ? "animate-spin" : ""} size={17} /> Случайная
            тема
          </button>
          <button
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--line-strong)] bg-[var(--surface)] px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-45"
            disabled={randomProblemPool.length === 0 || spinning}
            onClick={randomProblem}
            type="button"
          >
            <Dices className={spinMode === "inner" ? "animate-spin" : ""} size={17} /> Случайная
            задача
          </button>
          {activeTopic && (
            <button
              className="min-h-11 rounded-xl px-3 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
              onClick={() => updateFilter()}
              type="button"
            >
              Сбросить
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function shorten(value: string, length = 17) {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}
