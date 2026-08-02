import { SearchX } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <section className="page-shell grid min-h-[65vh] place-items-center py-16 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[var(--strong)] text-white">
          <SearchX aria-hidden="true" size={28} />
        </span>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
          Ошибка 404
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold">Такой страницы нет</h1>
        <p className="mt-4 leading-7 text-[var(--muted)]">
          Возможно, адрес изменился или ссылка была скопирована не полностью.
        </p>
        <ButtonLink className="mt-7" href="/contests">
          Перейти к контестам
        </ButtonLink>
      </div>
    </section>
  );
}
