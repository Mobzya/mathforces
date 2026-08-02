import assert from "node:assert/strict";
import test from "node:test";
import { createCsv, escapeCsvCell } from "../server/export/csv";

test("CSV экранирует кавычки и блокирует spreadsheet-формулы", () => {
  assert.equal(escapeCsvCell('Ученик "A"'), '"Ученик ""A"""');
  assert.equal(escapeCsvCell('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"');
  assert.equal(escapeCsvCell("+1+1"), '"\'+1+1"');
});

test("CSV содержит BOM и строки CRLF", () => {
  assert.equal(
    createCsv([
      ["Ник", "Балл"],
      ["Иван", 100]
    ]),
    '\uFEFF"Ник","Балл"\r\n"Иван","100"'
  );
});
