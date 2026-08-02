import assert from "node:assert/strict";
import test from "node:test";
import { validateChangePasswordInput, validateRegisterInput } from "../server/auth/validation";
import { createPasswordResetSecret, hashPasswordResetToken } from "../server/auth/password-reset";

test("смена пароля отклоняет совпадающий и слишком короткий пароль", () => {
  const same = validateChangePasswordInput({
    currentPassword: "old-password",
    newPassword: "old-password"
  });
  assert.ok(same.errors?.newPassword);

  const short = validateChangePasswordInput({
    currentPassword: "old-password",
    newPassword: "short"
  });
  assert.ok(short.errors?.newPassword);
});

test("одноразовый секрет восстановления хранится только как SHA-256", () => {
  const secret = createPasswordResetSecret();
  assert.ok(secret.token.length >= 40);
  assert.equal(secret.tokenHash, hashPasswordResetToken(secret.token));
  assert.equal(secret.tokenHash.length, 64);
  assert.notEqual(secret.tokenHash, secret.token);
});

test("валидная смена пароля сохраняет точные значения", () => {
  const result = validateChangePasswordInput({
    currentPassword: "old-password",
    newPassword: "new-password"
  });
  assert.deepEqual(result.data, {
    currentPassword: "old-password",
    newPassword: "new-password"
  });
});

test("регистрация не требует класс и организацию", () => {
  const result = validateRegisterInput({
    email: "new@example.com",
    nickname: "new_user",
    password: "password123"
  });
  assert.ok(result.data);
  assert.equal(result.data?.grade, null);
  assert.equal(result.data?.organization, null);
});
