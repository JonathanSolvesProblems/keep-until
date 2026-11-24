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

// The baseline rule the model is measured against: brand in the notice and a shared product word.
import { keywordRule } from "./match.js";

test("keyword rule pulls a same-brand item only when a product word is shared", () => {
  assert.equal(keywordRule(walnuts, { brand: "No Name", product: "Chopped walnuts" }), "pull");
  assert.equal(keywordRule(walnuts, { brand: "No Name", product: "Baking powder" }), "no_match");
});

test("keyword rule never matches on the brand's own words or on another brand", () => {
  const soup = { Title: "Soup Time brand French Onion Soup recalled due to undeclared wheat", Product: "French Onion Soup" };
  assert.equal(keywordRule(soup, { brand: "Soup Time", product: "Baba's Borscht Soup" }), "no_match");
  assert.equal(keywordRule(soup, { brand: "Campbell's", product: "French Onion Soup" }), "no_match");
});

test("a brand printed in short form (PC) is proposed against the spelled-out brand", () => {
  const ginger = { Title: "President’s Choice brand English-Style Gingersnap Cookies recalled due to metal wire", Product: "English-Style Gingersnap Cookies" };
  assert.equal(candidatesFor(ginger, [{ id: "pc", brand: "PC", product: "English Style Gingersnap Cookies" }]).length, 1);
  assert.equal(candidatesFor(ginger, [{ id: "x", brand: "PC Financial", product: "Gift card" }]).length, 0);
});

test("keyword rule matches singular against plural", () => {
  const ginger = { Title: "President's Choice brand English-Style Gingersnap Cookies recalled due to metal wire", Product: "English-Style Gingersnap Cookies" };
  assert.equal(keywordRule(ginger, { brand: "President's Choice", product: "Gingersnap cookie" }), "pull");
});

test("a brand that prints its short form in the notice still matches as printed", () => {
  const notice = { Title: "PC Blue Menu brand Lentil Soup recalled due to spoilage", Product: "Lentil Soup" };
  assert.equal(candidatesFor(notice, [{ id: "a", brand: "PC Blue Menu", product: "Lentil soup" }]).length, 1);
});
