On-device status: on-device: available | exported 2026-11-15T17:48:38.935Z

### A_full_read_no_example
sources ['on_device']; errors 0; median 8624 ms
  20261115_112247.jpg: expected turn_it, got set_aside  {"product": "Geant Vert.", "brand": "Geant", "category": "canned_fruit_veg", "date_text": "", "date_kind": "none_visible", "damage": "none", "confiden
  20261115_112303.jpg: expected turn_it, got set_aside  {"product": "Nutrition Facts", "brand": "", "category": "unclear", "date_text": "", "date_kind": "none_visible", "damage": "none", "confidence": "high
  20261115_112311.jpg: expected turn_it, got log  {"product": "Gallo Extra Virgin Olive Oil", "brand": "Gallo", "category": "olive_oil", "date_text": "none", "date_kind": "none_visible", "damage": "no
  20261115_112323.jpg: expected turn_it, got set_aside  {"product": "Simple Check\u2122 symbol", "brand": "Simple Check", "category": "general_grocery_canned", "date_text": "", "date_kind": "none_visible", 
  20261115_112326.jpg: expected turn_it, got set_aside  {"product": "baking powder poudre \u00e0 p\u00e2te", "brand": "no name", "category": "flour_based_mixes", "date_text": "", "date_kind": "none_visible"
  20261115_112402.jpg: expected turn_it, got log  {"product": "Nutrition Facts", "brand": "THE ARM & HAMMER", "category": "general_grocery_canned", "date_text": "none", "date_kind": "none_visible", "d
  20261115_112406.jpg: expected log, got log  {"product": "Herley Canada Inc.", "brand": "Herley Canada Inc.", "category": "general_grocery_canned", "date_text": "5666009287", "date_kind": "none_v
  20261115_112410.jpg: expected turn_it, got set_aside  {"product": "Chips", "brand": "", "category": "chips", "date_text": "BB/MA", "date_kind": "best_before", "damage": "none", "confidence": "high", "next
  20261115_112419.jpg: expected turn_it, got set_aside  {"product": "CAMPBELL'S CHICKEN \u00b7 POULET BROTH \u00b7 BOUILLON", "brand": "Campbell's", "category": "canned_prepared_meals", "date_text": "", "da
  20261115_112421.jpg: expected turn_it, got set_aside  {"product": "Nutrition Facts", "brand": "", "category": "unclear", "date_text": "", "date_kind": "none_visible", "damage": "none", "confidence": "high
  20261115_112427.jpg: expected log, got set_aside  {"product": "202_FE 14 02146", "brand": "", "category": "salsa_chili_taco_sauce", "date_text": "207FE14202146", "date_kind": "best_before", "damage": 
Scored photos handled correctly: 4 of 15

### B_triage
sources ['on_device']; errors 0; median 5162 ms
  20261115_112323.jpg: expected turn_it, got log  {"package_in_view": true, "date_in_view": true, "needs_refrigeration": false, "product": "Simple Check\u2122"}
  20261115_112406.jpg: expected log, got turn_it  {"package_in_view": true, "date_in_view": false, "needs_refrigeration": false, "product": "HERSHEY'S CANADA INC."}
  20261115_112427.jpg: expected log, got set_aside  {"package_in_view": true, "date_in_view": true, "needs_refrigeration": true, "product": "TWISTING CAP BREAKS FOIL SEAL. TURNER LE COUVERCLE BRISE LE S
  20261115_112452.jpg: expected set_aside, got turn_it  {"package_in_view": true, "date_in_view": false, "needs_refrigeration": false, "product": "Parmesan Roasted Broccoli"}
  20261115_112458.jpg: expected set_aside, got turn_it  {"package_in_view": true, "date_in_view": false, "needs_refrigeration": false, "product": "PARMESAN SHREDDED CHEESE FROMAGE R\u00c2P\u00c9"}
Scored photos handled correctly: 10 of 15

### C_date_only
sources ['on_device']; errors 0; median 5166 ms
  20261115_112247.jpg: no date on this side, but it returned '308'
  20261115_112303.jpg: no date on this side, but it returned '1\n6780000206\n1'
  20261115_112311.jpg: no date on this side, but it returned '10/2018'
  20261115_112323.jpg: no date on this side, but it returned 'BEST BEFORE DATE ON BOTTOM OF 2024'
  20261115_112326.jpg: no date on this side, but it returned '450 g'
  20261115_112402.jpg: no date on this side, but it returned '11/25/23'
  20261115_112406.jpg: label 2027-05, read 'N/A'
  20261115_112410.jpg: no date on this side, but it returned '30/12/25'
  20261115_112419.jpg: no date on this side, but it returned 'N/A'
  20261115_112421.jpg: no date on this side, but it returned 'N/A'
  20261115_112441.jpg: no date on this side, but it returned 'N/A'
Dated photos read right: 3 of 4. Photos with no date on that side: 1 left blank, 10 given an invented date.

