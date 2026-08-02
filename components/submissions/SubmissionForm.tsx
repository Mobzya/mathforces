"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Camera,
  CheckCircle2,
  CircleAlert,
  FileImage,
  LoaderCircle,
  LockKeyhole,
  Send,
  UploadCloud
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { readApiError } from "@/components/auth/form-utils";

type ProblemOption = {
  id: string;
  label: string;
  maxScore: number;
  title: string;
};

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function SubmissionForm({
  contestId,
  initialError = "",
  initialProblemId,
  problems
}: {
  contestId: string;
  initialError?: string;
  initialProblemId: string;
  problems: ProblemOption[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState(initialError);
  const [isPending, setIsPending] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  function selectFile(nextFile: File | null) {
    setError("");
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
    }
    if (!nextFile) {
      setFile(null);
      setPreviewUrl("");
      return;
    }
    if (!ALLOWED_FILE_TYPES.has(nextFile.type)) {
      setFile(null);
      setPreviewUrl("");
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      setError("Выберите изображение JPEG, PNG или WebP");
      return;
    }
    if (nextFile.size > MAX_FILE_BYTES) {
      setFile(null);
      setPreviewUrl("");
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      setError("Размер изображения не должен превышать 15 МБ");
      return;
    }
    setFile(nextFile);
    const nextPreviewUrl = URL.createObjectURL(nextFile);
    previewUrlRef.current = nextPreviewUrl;
    setPreviewUrl(nextPreviewUrl);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!file) {
      setError("Сделайте фотографию или выберите изображение решения");
      inputRef.current?.focus();
      return;
    }

    setIsPending(true);
    try {
      const form = new FormData(event.currentTarget);
      const problemId = String(form.get("problemId") ?? "");
      const query = new URLSearchParams({
        contestId,
        isPublic: "true",
        problemId
      });
      const response = await fetch(`/api/submissions?${query}`, {
        body: file,
        credentials: "same-origin",
        headers: {
          "Content-Type": file.type,
          "X-Mathforces-File-Name": encodeURIComponent(file.name),
          "X-Mathforces-Upload": "raw-image"
        },
        method: "POST"
      });

      if (!response.ok) {
        const apiError = await readApiError(response);
        setError(apiError.fieldErrors.image ?? apiError.fieldErrors.problem ?? apiError.message);
        return;
      }

      setIsRedirecting(true);
      window.requestAnimationFrame(() => {
        window.location.replace(`/contests/${contestId}/submissions`);
      });
    } catch {
      setError("Нет связи с сервером. Проверьте интернет и повторите попытку");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form
      action="/api/submissions"
      className="space-y-5"
      encType="multipart/form-data"
      method="post"
      onSubmit={handleSubmit}
    >
      <input name="contestId" type="hidden" value={contestId} />
      <input name="isPublic" type="hidden" value="true" />

      <label className="form-label">
        Задача
        <select
          className="field appearance-none"
          defaultValue={initialProblemId}
          name="problemId"
          required
        >
          {problems.map((problem) => (
            <option key={problem.id} value={problem.id}>
              {problem.label}. {problem.title} · {problem.maxScore} б.
            </option>
          ))}
        </select>
      </label>

      <div>
        <p className="text-sm font-semibold">Фотография решения</p>
        <div
          className={`relative mt-2 overflow-hidden rounded-2xl border-2 border-dashed bg-[var(--surface-muted)] transition ${
            error ? "border-red-300" : "border-[var(--line-strong)] hover:border-[var(--ink)]"
          }`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            selectFile(event.dataTransfer.files[0] ?? null);
          }}
        >
          {previewUrl ? (
            <div className="pointer-events-none relative aspect-[4/3]">
              <Image
                alt="Предпросмотр фотографии решения"
                className="object-contain"
                fill
                src={previewUrl}
                unoptimized
              />
            </div>
          ) : (
            <div className="pointer-events-none grid min-h-64 w-full place-items-center p-8 text-center">
              <span>
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-white text-[var(--accent)] shadow-sm">
                  <UploadCloud size={25} />
                </span>
                <span className="mt-4 block font-semibold">Сделать фото или выбрать файл</span>
                <span className="mt-2 block text-xs leading-5 text-[var(--muted)]">
                  JPEG, PNG или WebP · до 15 МБ
                </span>
              </span>
            </div>
          )}

          <input
            aria-label={
              file ? "Заменить фотографию решения" : "Сделать фото или выбрать файл решения"
            }
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            className="absolute inset-0 z-10 size-full cursor-pointer opacity-0"
            id="submission-image"
            name="image"
            onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
            ref={inputRef}
            type="file"
          />
        </div>

        {file && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-white px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{file.name}</p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {(file.size / 1024 / 1024).toFixed(1)} МБ
              </p>
            </div>
            <label
              className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-xs font-semibold text-[var(--accent)]"
              htmlFor="submission-image"
            >
              <Camera size={15} />
              Заменить
            </label>
          </div>
        )}
      </div>

      <div className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <LockKeyhole className="mt-0.5 shrink-0" size={17} />
        <p>
          В ленте будут видны ник, задача, время, статус и балл. Саму фотографию увидите только вы и
          администратор.
        </p>
      </div>

      {error && (
        <div
          className="flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          <CircleAlert className="mt-0.5 shrink-0" size={18} />
          <div>
            <p className="font-semibold">Не удалось отправить решение</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {isRedirecting && (
        <div
          className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          role="status"
        >
          <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
          <p>Посылка принята. Открываем ленту…</p>
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <Link
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--line-strong)] bg-white px-4 text-sm font-semibold"
          href={`/contests/${contestId}`}
        >
          <FileImage size={17} />
          Вернуться к задачам
        </Link>
        <button
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--strong)] px-4 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPending || isRedirecting}
          type="submit"
        >
          {isPending || isRedirecting ? (
            <>
              <LoaderCircle className="animate-spin" size={17} />
              {isRedirecting ? "Открываем ленту…" : "Загружаем…"}
            </>
          ) : (
            <>
              <Send size={17} />
              Отправить решение
            </>
          )}
        </button>
      </div>
    </form>
  );
}
