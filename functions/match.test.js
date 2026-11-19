// Tests the rule half against real notices from the Government of Canada feed (copied verbatim,
// pulled 2026-11-14): it must propose brand collisions (the model settles them) and never miss
// a brand that is in the notice.
import { test } from "node:test";
import assert from "node:assert/strict";
import { candidatesFor, norm, recentFoodRecalls } from "./match.js";

const kisses = {
  NID: "real-hershey",
  Title: "Hershey's brand Kisses - Creamy Milk Chocolate recalled due to undeclared almond",
  Product: "Kisses - Creamy Milk Chocolate",
  Organization: "CFIA",
  "Last updated": "2026-08-01",
};
const walnuts = {
  NID: "real-noname",
  Title: "no name brand chopped walnuts recalled due to shell fragments",
  Product: "Chopped Walnuts",
  Organization: "CFIA",
  "Last updated": "2026-09-15",
};

const stock = [
  { id: "chipits", brand: "Hershey's", product: "Chipits milk chocolate chips" },
  { id: "powder", brand: "No Name", product: "Baking powder" },
  { id: "broth", brand: "Campbell's", product: "Chicken broth 900 mL" },
  { id: "unbranded", brand: "", product: "Chopped walnuts" },
];

test("normalises accents, apostrophes and case", () => {
  assert.equal(norm("Liberté Grec"), " liberte grec ");
  assert.equal(norm("Hershey's"), " hershey s ");
});

test("proposes a brand collision for the model to settle, never decides it", () => {
  const c = candidatesFor(kisses, stock);
  assert.deepEqual(c.map((x) => x.itemId), ["chipits"]);
  assert.match(c[0].why, /brand/);
});

test("matches a brand written in lower case in the notice", () => {
  assert.deepEqual(candidatesFor(walnuts, stock).map((x) => x.itemId), ["powder"]);
});

test("an item with no brand is never proposed on product words alone", () => {
  assert.equal(candidatesFor(walnuts, [stock[3]]).length, 0);
});

test("keeps only food recalls inside the window, newest first", () => {
  const feed = [kisses, walnuts, { ...kisses, NID: "old", "Last updated": "2024-01-01" }, { ...kisses, NID: "car", Organization: "TC" }];
  assert.deepEqual(recentFoodRecalls(feed, "2025-11-19").map((r) => r.NID), ["real-noname", "real-hershey"]);
});
