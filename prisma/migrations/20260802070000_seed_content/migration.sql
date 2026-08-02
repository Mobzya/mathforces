INSERT INTO "FaqSection" ("id", "title", "slug", "description", "orderIndex", "isPublished", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'Старт', 'start', 'Первые шаги на Mathforces', 1, true, NOW(), NOW()),
  (gen_random_uuid(), 'Контесты и рейтинг', 'contests-rating', 'Как устроено соревнование', 2, true, NOW(), NOW()),
  (gen_random_uuid(), 'Решения и проверка', 'solutions', 'Посылки, баллы и апелляции', 3, true, NOW(), NOW())
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "FaqItem" ("id", "sectionId", "question", "answer", "orderIndex", "isPublished", "createdAt", "updatedAt")
SELECT gen_random_uuid(), s."id", v.question, v.answer, v.order_index, true, NOW(), NOW()
FROM (VALUES
  ('start', 'Что нужно для старта?', 'Зарегистрируйтесь по почте, логину и паролю. Класс, организацию и аватар можно добавить позже.', 1),
  ('contests-rating', 'Почему до первого контеста рейтинг не показан?', 'Внутренне система считает стартовое значение равным нулю, но в интерфейсе оно отображается как «—» до первого рейтингового тура.', 1),
  ('solutions', 'Как отправить решение?', 'Прикрепите чёткое фото или скан в JPEG, PNG или WebP. Покажите весь ход рассуждений, а не только ответ.', 1)
) AS v(slug, question, answer, order_index)
JOIN "FaqSection" s ON s."slug" = v.slug
WHERE NOT EXISTS (
  SELECT 1 FROM "FaqItem" i WHERE i."sectionId" = s."id" AND i."question" = v.question
);

INSERT INTO "NewsPost" ("id", "authorId", "title", "excerpt", "body", "isPublished", "publishedAt", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, 'Добро пожаловать в «Главное»', 'Здесь появляются новые контесты, механики и важные обновления.', 'Это живая лента Mathforces. Администраторы будут публиковать здесь анонсы туров, изменения рейтинговой системы и полезные разборы.', true, NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "NewsPost");
