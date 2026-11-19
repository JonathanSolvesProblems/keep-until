# Recall control set, 2026-11-19

Run: `results/recall-control-2026-11-19.json`, cloud model gemini-3.5-flash-lite, through Firebase AI Logic (PREFER_IN_CLOUD). Expected outcomes registered before the run in `shared/recall-control.json` (committed f301c0b).

Each case is a real Government of Canada food recall notice (feed pulled 2026-11-14, copied verbatim) paired with an item a food bank could have kept under the same brand. Brand matching alone, the rule the daily function runs, proposes all eight.

| case | recall notice | kept item | expected | brand rule | model | model's reason |
|---|---|---|---|---|---|---|
| c1 | Hershey's brand Kisses - Creamy Milk Chocolate recalled due to undeclared almond | Hershey's Chipits milk chocolate chips | no_match | pull ✗ | no_match ✓ | The notice recalls Kisses while the kept item is Chipits milk chocolate chips. |
| c2 | Hershey's brand Kisses - Creamy Milk Chocolate recalled due to undeclared almond | Hershey's Kisses Creamy Milk Chocolate | recalled | pull ✓ | pull ✓ | The recall notice lists the exact same brand and product name as the kept item. |
| c3 | no name brand chopped walnuts recalled due to shell fragments | No Name Baking powder | no_match | pull ✗ | no_match ✓ | The recall notice is for chopped walnuts while the kept item is baking powder. |
| c4 | no name brand chopped walnuts recalled due to shell fragments | No Name Chopped walnuts | recalled | pull ✓ | pull ✓ | The recall notice names the exact same brand and product as the kept item. |
| c5 | no name brand Beef Burgers recalled due to E. coli O157:H7 | No Name Baking powder | no_match | pull ✗ | no_match ✓ | The notice recalls beef burgers while the kept item is baking powder. |
| c6 | Campbell's Verve brand and Campbell's brand frozen soup recalled due to pieces of wood | Campbell's Chicken broth 900 mL | no_match | pull ✗ | no_match ✓ | The recall notice only applies to frozen soup, while the kept item is chicken broth. |
| c7 | Campbell's Verve brand and Campbell's brand frozen soup recalled due to pieces of wood | Campbell's Frozen soup | recalled | pull ✓ | pull ✓ | The recall notice names the exact same brand and product type as the kept item. |
| c8 | SeaQuest brand Shrimp Ring with Mild Cocktail Sauce and President's Choice brand Black Tiger Shrimp with Mild Cocktail Sauce recalled due to undeclared mustard | President's Choice Shredded parmesan cheese | no_match | pull ✗ | no_match ✓ | The notice recalls shrimp products, but the kept item is cheese. |

**Model: 8 of 8. Brand rule alone: 3 of 8** (it would have pulled five items that were never recalled).

Both sides had the same input: the notice text and the kept item. The rule is what the scheduled function does without the model; the model settles each of its candidates at shift start.
Limit: eight cases, all decided from text. A real lot-code recall (check_lot) is not in this set yet.
