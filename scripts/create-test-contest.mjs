import "dotenv/config";
import pg from "pg";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://mathforces:mathforces@localhost:5432/mathforces?schema=public";
const pool = new pg.Pool({ connectionString });

const contestId = "00000000-0000-4000-8000-000000000301";

const problems = [
  {
    baseScore: 100,
    evaluationRubric:
      "20 баллов за корректное преобразование, 50 за нахождение всех корней, 30 за проверку и обоснование отсутствия других решений.",
    id: "00000000-0000-4000-8000-000000000311",
    maxScore: 100,
    orderIndex: 1,
    statement:
      "Решите в действительных числах уравнение\n\n(x − 1)(x − 2)(x − 3)(x − 4) = 24.\n\nТребуется привести полное решение и проверить все найденные корни.",
    title: "Симметричное уравнение",
    topic: "ALGEBRA"
  },
  {
    baseScore: 120,
    evaluationRubric:
      "40 баллов за правильную модель подсчёта, 50 за рекуррентное соотношение или разбиение на случаи, 30 за верный итог.",
    id: "00000000-0000-4000-8000-000000000312",
    maxScore: 120,
    orderIndex: 2,
    statement:
      "Сколькими способами можно выбрать несколько чисел из множества {1, 2, …, 10} так, чтобы среди выбранных не было двух соседних чисел?\n\nПустой выбор учитывать не нужно. Обоснуйте формулу подсчёта.",
    title: "Несоседние числа",
    topic: "COMBINATORICS"
  },
  {
    baseScore: 150,
    evaluationRubric:
      "50 баллов за необходимые наблюдения о делимости, 70 за строгое доказательство основного утверждения, 30 за завершение всех случаев.",
    id: "00000000-0000-4000-8000-000000000313",
    maxScore: 150,
    orderIndex: 3,
    statement:
      "Докажите, что для любого целого n число n⁵ − n делится на 30.\n\nРазрешается отдельно исследовать делимость на взаимно простые множители числа 30.",
    title: "Делимость на 30",
    topic: "NUMBER_THEORY"
  },
  {
    baseScore: 180,
    evaluationRubric:
      "60 баллов за полезные дополнительные построения, 80 за доказательство ключевого равенства или подобия, 40 за строгий вывод.",
    id: "00000000-0000-4000-8000-000000000314",
    maxScore: 180,
    orderIndex: 4,
    statement:
      "В остроугольном треугольнике ABC высоты AD, BE и CF пересекаются в точке H. Докажите, что\n\nHD · HA = HE · HB = HF · HC.\n\nПриложите читаемый чертёж и полное доказательство.",
    title: "Высоты треугольника",
    topic: "GEOMETRY"
  },
  {
    baseScore: 200,
    evaluationRubric:
      "60 баллов за исследование малых случаев и гипотезу, 100 за полное доказательство, 40 за аккуратную проверку граничных случаев.",
    id: "00000000-0000-4000-8000-000000000315",
    maxScore: 200,
    orderIndex: 5,
    statement:
      "Найдите все натуральные числа n, для которых число n² + 3n + 1 является полным квадратом.\n\nНеобходимо доказать, что найденный список решений полный.",
    title: "Между квадратами",
    topic: "NUMBER_THEORY"
  }
];

try {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `
        INSERT INTO "Contest" (
          id, title, description, rules, tags, "startAt", "endAt",
          "durationMinutes", status, "isPublic", "organizationId", "updatedAt"
        )
        VALUES (
          $1, $2, $3, $4, $5,
          (NOW() AT TIME ZONE 'UTC') - INTERVAL '5 minutes',
          (NOW() AT TIME ZONE 'UTC') + INTERVAL '6 hours',
          360, 'RUNNING', true, NULL, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          rules = EXCLUDED.rules,
          tags = EXCLUDED.tags,
          "startAt" = EXCLUDED."startAt",
          "endAt" = EXCLUDED."endAt",
          "durationMinutes" = EXCLUDED."durationMinutes",
          status = EXCLUDED.status,
          "isPublic" = true,
          "organizationId" = NULL,
          "updatedAt" = NOW()
      `,
      [
        contestId,
        "Тестовый контест Mathforces",
        "Открытый контест для проверки регистрации, загрузки фотографий решений и публичной ленты посылок.",
        "Зарегистрируйтесь на контест, откройте любую задачу и отправьте фотографию полного решения. Допустимы JPEG, PNG и WebP до 15 МБ.",
        ["тестовый", "sprint-3"]
      ]
    );

    for (const problem of problems) {
      await client.query(
        `
          INSERT INTO "Problem" (
            id, "contestId", title, statement, topic, "baseScore", "maxScore",
            "scoreDecayPer5Min", "orderIndex", "evaluationRubric", "updatedAt"
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, 5, $8, $9, NOW())
          ON CONFLICT ("contestId", "orderIndex") DO UPDATE SET
            title = EXCLUDED.title,
            statement = EXCLUDED.statement,
            topic = EXCLUDED.topic,
            "baseScore" = EXCLUDED."baseScore",
            "maxScore" = EXCLUDED."maxScore",
            "scoreDecayPer5Min" = EXCLUDED."scoreDecayPer5Min",
            "evaluationRubric" = EXCLUDED."evaluationRubric",
            "updatedAt" = NOW()
        `,
        [
          problem.id,
          contestId,
          problem.title,
          problem.statement,
          problem.topic,
          problem.baseScore,
          problem.maxScore,
          problem.orderIndex,
          problem.evaluationRubric
        ]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  console.log(`Тестовый контест создан: http://localhost:3000/contests/${contestId}`);
  console.log("Приём решений открыт на ближайшие 6 часов.");
} finally {
  await pool.end();
}
