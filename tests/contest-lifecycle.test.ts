import assert from "node:assert/strict";
import test from "node:test";
import {
  canRevealContestProblems,
  isContestAcceptingSubmissions,
  isContestRegistrationOpen
} from "@/server/contests/lifecycle";

const now = new Date("2026-08-02T10:00:00.000Z");

test("регистрация закрывается в момент начала", () => {
  assert.equal(
    isContestRegistrationOpen(
      { startAt: new Date("2026-08-02T10:01:00.000Z"), status: "ANNOUNCED" },
      now
    ),
    true
  );
  assert.equal(isContestRegistrationOpen({ startAt: now, status: "ANNOUNCED" }, now), false);
});

test("администратор может оставить регистрацию открытой во время контеста", () => {
  const contest = {
    endAt: new Date("2026-08-02T11:30:00.000Z"),
    registrationClosesAt: new Date("2026-08-02T10:30:00.000Z"),
    startAt: now,
    status: "RUNNING" as const
  };
  assert.equal(isContestRegistrationOpen(contest, now), true);
  assert.equal(isContestRegistrationOpen(contest, new Date("2026-08-02T10:30:00.000Z")), false);
});

test("посылки принимаются только внутри активного временного окна", () => {
  const contest = {
    endAt: new Date("2026-08-02T11:30:00.000Z"),
    startAt: now,
    status: "RUNNING" as const
  };
  assert.equal(isContestAcceptingSubmissions(contest, now), true);
  assert.equal(isContestAcceptingSubmissions(contest, new Date("2026-08-02T11:30:00.000Z")), false);
});

test("условия не раскрываются участнику до фактического старта", () => {
  const contest = {
    startAt: new Date("2026-08-02T10:01:00.000Z"),
    status: "RUNNING" as const
  };
  assert.equal(canRevealContestProblems(contest, false, now), false);
  assert.equal(canRevealContestProblems(contest, true, now), true);
});
