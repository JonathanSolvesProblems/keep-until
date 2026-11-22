# Recall control sets, 2026-11-22: the model against two rules

Run: `results/recall-control-2026-11-22.json`, cloud model gemini-3.5-flash-lite, through Firebase AI Logic (PREFER_IN_CLOUD), from the app's recall control runner on localhost.
Rules: `scripts/recall_baselines.mjs`, using the product's own matcher (`functions/match.js`).

Two rules stand in for the model. **Brand alone** is what the daily function proposes. **Brand plus a product word** pulls only when the brand is in the notice and the kept item shares a product word (four letters or more, singular) with the recalled product: the rule a careful programmer would write without a model.

## First set, registered 2026-11-19

| case | recall notice | kept item | expected | brand alone | brand + product word | Gemini | Gemini's reason |
|---|---|---|---|---|---|---|---|
| c1 | Hershey's brand Kisses - Creamy Milk Chocolate recalled due to undeclared almond | Hershey's Chipits milk chocolate chips | no_match | pull ✗ | pull ✗ | no_match ✓ | The notice recalls Kisses - Creamy Milk Chocolate, but the kept item is Chipits milk chocolate chips. |
| c2 | Hershey's brand Kisses - Creamy Milk Chocolate recalled due to undeclared almond | Hershey's Kisses Creamy Milk Chocolate | recalled | pull ✓ | pull ✓ | pull ✓ | The recall notice explicitly lists the exact brand and product name of the kept item. |
| c3 | no name brand chopped walnuts recalled due to shell fragments | No Name Baking powder | no_match | pull ✗ | no_match ✓ | no_match ✓ | The recall is for chopped walnuts while the kept item is baking powder. |
| c4 | no name brand chopped walnuts recalled due to shell fragments | No Name Chopped walnuts | recalled | pull ✓ | pull ✓ | pull ✓ | The recall notice explicitly names the brand and product as recalled due to shell fragments. |
| c5 | no name brand Beef Burgers recalled due to E. coli O157:H7 | No Name Baking powder | no_match | pull ✗ | no_match ✓ | no_match ✓ | The recall notice is for Beef Burgers while the kept item is Baking powder. |
| c6 | Campbell's Verve brand and Campbell's brand frozen soup recalled due to pieces of wood | Campbell's Chicken broth 900 mL | no_match | pull ✗ | no_match ✓ | no_match ✓ | The recall notice specifies frozen soup, whereas the kept item is chicken broth. |
| c7 | Campbell's Verve brand and Campbell's brand frozen soup recalled due to pieces of wood | Campbell's Frozen soup | recalled | pull ✓ | pull ✓ | pull ✓ | The recall notice explicitly names Campbell's brand frozen soup, which matches the kept item. |
| c8 | SeaQuest brand Shrimp Ring with Mild Cocktail Sauce and President's Choice brand Black Tig | President's Choice Shredded parmesan cheese | no_match | pull ✗ | no_match ✓ | no_match ✓ | The notice recalls shrimp products, but the kept item is shredded parmesan cheese. |

Gemini 8 of 8. Brand plus a product word 7 of 8. Brand alone 3 of 8.

## Second set, registered 2026-11-22 (commit 02cd1d2), harder: same brand and mostly the same kind of food

| case | recall notice | kept item | expected | brand alone | brand + product word | Gemini | Gemini's reason |
|---|---|---|---|---|---|---|---|
| d1 | President’s Choice brand English-Style Gingersnap Cookies recalled due to metal wire | President's Choice Chocolate Chip Cookies | no_match | pull ✗ | pull ✗ | no_match ✓ | The recall notice is for English-Style Gingersnap Cookies while the kept item is Chocolate Chip Cookies. |
| d2 | President’s Choice brand English-Style Gingersnap Cookies recalled due to metal wire | PC English Style Gingersnap Cookies | recalled | no_match ✗ | no_match ✗ | pull ✓ | The recall notice explicitly names the President’s Choice brand English-Style Gingersnap Cookies. |
| d3 | Compliments Organic brand Dark Chocolate with Sea Salt recalled due to undeclared almond | Compliments Organic Dark Chocolate 70% Cacao | no_match | pull ✗ | pull ✗ | no_match ✓ | The notice recalls Dark Chocolate with Sea Salt while the kept item is Dark Chocolate 70% Cacao. |
| d4 | Compliments Organic brand Dark Chocolate with Sea Salt recalled due to undeclared almond | Compliments Organic Dark Chocolate with Sea Salt 100 g | recalled | pull ✓ | pull ✓ | pull ✓ | The recall notice states the exact same brand and product as the kept item. |
| d5 | Soup Time brand French Onion Soup recalled due to undeclared wheat | Soup Time Baba's Borscht Soup | no_match | pull ✗ | no_match ✓ | no_match ✓ | The notice recalls French Onion Soup, but the kept item is Baba's Borscht Soup. |
| d6 | Great Value brand 100% Grape Juice recalled due to tartrate crystals | Great Value 100% Apple Juice | no_match | pull ✗ | pull ✗ | no_match ✓ | The recall notice is for Grape Juice while the kept item is Apple Juice. |
| d7 | Cadbury brand Dairy Milk Oreo Candy (bar) recalled due to undeclared pistachio | Cadbury Dairy Milk Fruit & Nut bar | no_match | pull ✗ | pull ✗ | no_match ✓ | The notice recalls the Dairy Milk Oreo Candy bar, while the kept item is a Dairy Milk Fruit & Nut bar. |
| d8 | Amy's brand Organic Lentil Soup (Less Sodium) recalled due to container integrity defects  | Amy's Soupe aux lentilles biologique, teneur reduite en sodium | recalled | pull ✓ | pull ✓ | pull ✓ | The notice recalls the Amy's brand Organic Lentil Soup (Less Sodium), which matches the kept item. |

Gemini 8 of 8. Brand plus a product word 3 of 8. Brand alone 2 of 8.

## Both sets

**Model: 16 of 16. Brand plus a product word: 10 of 16. Brand alone: 5 of 16.**

## Limits

- d2's brand is printed as "PC". The daily function's brand match needs three letters, so in the product this item is never proposed and the model never sees it. The model settles it here only because the control set hands it the pair. A short or abbreviated brand is a gap in the proposal step, not in the model.
- The second set was chosen to be the hard part of recall matching (variants of the same product, an abbreviation, a French label), so it favours a reader of meaning over a word rule by design. Its expected answers were committed before either the rules or the model ran on it.
- 16 cases, all decided from text. A recall limited to certain lot codes (check_lot) is not in either set yet.
- The first set's model answers here are a second run; they match the 2026-11-19 run case for case (`results/recall-control-2026-11-19.md`).
