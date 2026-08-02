"use client";

import { LoaderCircle, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { readApiError } from "@/components/auth/form-utils";

type FaqSection = {
  description: string;
  id: string;
  isPublished: boolean;
  items: {
    answer: string;
    id: string;
    isPublished: boolean;
    orderIndex: number;
    question: string;
  }[];
  orderIndex: number;
  slug: string;
  title: string;
};
type NewsPost = { body: string; excerpt: string; id: string; isPublished: boolean; title: string };

export function ContentManager({ posts, sections }: { posts: NewsPost[]; sections: FaqSection[] }) {
  const router = useRouter();
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  async function request(key: string, url: string, init: RequestInit) {
    setPending(key);
    setError("");
    try {
      const response = await fetch(url, init);
      if (!response.ok) {
        setError((await readApiError(response)).message);
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Нет связи с сервером");
      return false;
    } finally {
      setPending("");
    }
  }
  async function createSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (
      await request("new-section", "/api/admin/faq", {
        body: JSON.stringify({
          description: data.get("description"),
          kind: "section",
          title: data.get("title")
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      })
    )
      form.reset();
  }
  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (
      await request("new-item", "/api/admin/faq", {
        body: JSON.stringify({
          answer: data.get("answer"),
          kind: "item",
          question: data.get("question"),
          sectionId: data.get("sectionId")
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      })
    )
      form.reset();
  }
  async function createPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (
      await request("new-post", "/api/admin/news", {
        body: JSON.stringify({
          body: data.get("body"),
          excerpt: data.get("excerpt"),
          isPublished: data.get("isPublished") === "on",
          title: data.get("title")
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      })
    )
      form.reset();
  }
  return (
    <div>
      {error && (
        <p className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
      <section>
        <h2 className="font-display text-3xl font-semibold">FAQ</h2>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <form className="card p-5" onSubmit={createSection}>
            <h3 className="font-semibold">Новый раздел</h3>
            <input className="field mt-4" name="title" placeholder="Название" required />
            <textarea
              className="field mt-3 min-h-20"
              name="description"
              placeholder="Короткое описание"
            />
            <Submit loading={pending === "new-section"} label="Добавить раздел" />
          </form>
          <form className="card p-5" onSubmit={createItem}>
            <h3 className="font-semibold">Новый вопрос</h3>
            <select className="field mt-4" name="sectionId" required>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.title}
                </option>
              ))}
            </select>
            <input className="field mt-3" name="question" placeholder="Вопрос" required />
            <textarea className="field mt-3 min-h-28" name="answer" placeholder="Ответ" required />
            <Submit loading={pending === "new-item"} label="Добавить вопрос" />
          </form>
        </div>
        <div className="mt-6 space-y-5">
          {sections.map((section) => (
            <div className="card p-5" key={section.id}>
              <SectionEditor pending={pending} request={request} section={section} />{" "}
              <div className="mt-5 space-y-3">
                {section.items.map((item) => (
                  <ItemEditor item={item} key={item.id} pending={pending} request={request} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="mt-14">
        <h2 className="font-display text-3xl font-semibold">Новости</h2>
        <form className="card mt-5 p-5" onSubmit={createPost}>
          <div className="grid gap-3 md:grid-cols-2">
            <input className="field" name="title" placeholder="Заголовок" required />
            <input className="field" name="excerpt" placeholder="Короткая подводка" />
          </div>
          <textarea
            className="field mt-3 min-h-36"
            name="body"
            placeholder="Текст новости"
            required
          />
          <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
            <input name="isPublished" type="checkbox" />
            Опубликовать сразу
          </label>
          <Submit loading={pending === "new-post"} label="Создать новость" />
        </form>
        <div className="mt-5 space-y-4">
          {posts.map((post) => (
            <PostEditor key={post.id} pending={pending} post={post} request={request} />
          ))}
        </div>
      </section>
    </div>
  );
}

function SectionEditor({
  pending,
  request,
  section
}: {
  pending: string;
  request: Requester;
  section: FaqSection;
}) {
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await request(
      `section-${section.id}`,
      `/api/admin/faq/sections/${section.id}`,
      jsonPatch({
        description: data.get("description"),
        isPublished: data.get("isPublished") === "on",
        orderIndex: Number(data.get("orderIndex")),
        title: data.get("title")
      })
    );
  }
  return (
    <form className="grid gap-3 md:grid-cols-[1fr_6rem_auto]" onSubmit={save}>
      <div>
        <input className="field" defaultValue={section.title} name="title" />
        <input className="field mt-2" defaultValue={section.description} name="description" />
      </div>
      <label className="form-label">
        Порядок
        <input
          className="field"
          defaultValue={section.orderIndex}
          name="orderIndex"
          type="number"
        />
      </label>
      <div className="flex items-end gap-2">
        <label className="mb-3 text-xs">
          <input defaultChecked={section.isPublished} name="isPublished" type="checkbox" /> виден
        </label>
        <IconButton
          icon={Save}
          loading={pending === `section-${section.id}`}
          onClick={undefined}
          type="submit"
        />
        <IconButton
          icon={Trash2}
          loading={false}
          onClick={() =>
            confirm("Удалить раздел со всеми вопросами?") &&
            request(`delete-section-${section.id}`, `/api/admin/faq/sections/${section.id}`, {
              method: "DELETE"
            })
          }
        />
      </div>
    </form>
  );
}
function ItemEditor({
  item,
  pending,
  request
}: {
  item: FaqSection["items"][number];
  pending: string;
  request: Requester;
}) {
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await request(
      `item-${item.id}`,
      `/api/admin/faq/items/${item.id}`,
      jsonPatch({
        answer: data.get("answer"),
        isPublished: data.get("isPublished") === "on",
        orderIndex: Number(data.get("orderIndex")),
        question: data.get("question")
      })
    );
  }
  return (
    <form className="rounded-xl border border-[var(--line)] p-4" onSubmit={save}>
      <input className="field" defaultValue={item.question} name="question" />
      <textarea className="field mt-2 min-h-24" defaultValue={item.answer} name="answer" />
      <div className="mt-3 flex items-center gap-3">
        <input
          className="field max-w-20"
          defaultValue={item.orderIndex}
          name="orderIndex"
          type="number"
        />
        <label className="text-xs">
          <input defaultChecked={item.isPublished} name="isPublished" type="checkbox" /> виден
        </label>
        <IconButton
          icon={Save}
          loading={pending === `item-${item.id}`}
          onClick={undefined}
          type="submit"
        />
        <IconButton
          icon={Trash2}
          loading={false}
          onClick={() =>
            confirm("Удалить вопрос?") &&
            request(`delete-item-${item.id}`, `/api/admin/faq/items/${item.id}`, {
              method: "DELETE"
            })
          }
        />
      </div>
    </form>
  );
}
function PostEditor({
  pending,
  post,
  request
}: {
  pending: string;
  post: NewsPost;
  request: Requester;
}) {
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await request(
      `post-${post.id}`,
      `/api/admin/news/${post.id}`,
      jsonPatch({
        body: data.get("body"),
        excerpt: data.get("excerpt"),
        isPublished: data.get("isPublished") === "on",
        title: data.get("title")
      })
    );
  }
  return (
    <form className="card p-5" onSubmit={save}>
      <input className="field" defaultValue={post.title} name="title" />
      <input className="field mt-3" defaultValue={post.excerpt} name="excerpt" />
      <textarea className="field mt-3 min-h-32" defaultValue={post.body} name="body" />
      <div className="mt-3 flex items-center gap-3">
        <label className="text-sm font-semibold">
          <input defaultChecked={post.isPublished} name="isPublished" type="checkbox" />{" "}
          опубликована
        </label>
        <IconButton
          icon={Save}
          loading={pending === `post-${post.id}`}
          onClick={undefined}
          type="submit"
        />
        <IconButton
          icon={Trash2}
          loading={false}
          onClick={() =>
            confirm("Удалить новость и комментарии?") &&
            request(`delete-post-${post.id}`, `/api/admin/news/${post.id}`, { method: "DELETE" })
          }
        />
      </div>
    </form>
  );
}
type Requester = (key: string, url: string, init: RequestInit) => Promise<boolean>;
function jsonPatch(body: object): RequestInit {
  return {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "PATCH"
  };
}
function Submit({ label, loading }: { label: string; loading: boolean }) {
  return (
    <button
      className="button-primary mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold"
      disabled={loading}
      type="submit"
    >
      {loading ? <LoaderCircle className="animate-spin" size={15} /> : <Plus size={15} />}
      {label}
    </button>
  );
}
function IconButton({
  icon: Icon,
  loading,
  onClick,
  type = "button"
}: {
  icon: typeof Save;
  loading: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      aria-label="Действие"
      className="grid size-10 place-items-center rounded-lg border border-[var(--line)]"
      disabled={loading}
      onClick={onClick}
      type={type}
    >
      {loading ? <LoaderCircle className="animate-spin" size={15} /> : <Icon size={15} />}
    </button>
  );
}
