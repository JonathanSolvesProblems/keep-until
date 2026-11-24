# Audit of the date-reading misses, 2026-11-22

A reviewer given only the photos and two readings of each (A: the date an Open Food Facts volunteer
confirmed; B: the date the app read) enlarged each package and recorded every date printed on it.
All 29 are misses by the registered rule (`results/date-control-off-ca-2026-11-22.md`); #18 is the
same date written with a two-digit year.

| # | File | Dates printed (as printed) | A matches? | B matches? | Category |
|---|---|---|---|---|---|
| 1 | 0061308210195-1 | PROD.DATE 02/07/2021 07:35:20; BB/MA 2022 DE 31 L212606 | yes, production | yes, BB/MA | B is BB, A is another date |
| 2 | 3256540002364-11 | 05/07/2019 (EMBALLÉ LE); 19/07/2019 (MEILLEUR AVANT) | yes, packed | yes, best before | B is BB, A is another date |
| 3 | 0889842103557-1 | 15/07/17 (unlabelled price sticker on a video game, not food) | yes, no label | no date read | not food |
| 4 | 6253001010378-1 | P:04/05/2021; E:03/05/2023 | yes, production | yes, expiry | B is expiry, A is another date |
| 5 | 0814574001307-2 | handwritten ?8-06-18, first digit blurred | can't tell | can't tell | can't tell |
| 6 | 0872632120193-2 | LOT 1302302; 13/02/23 11:53:00; M.A./B.B. 13/08/24 | yes | yes, M.A./B.B. | B is BB, A is another date |
| 7 | 0665081004622-3 | no date on the package; the date is on a paper under the bag | not a package date | none read (correct) | A is not a food date |
| 8 | 0056932604045-1 | 04/0?/21, second digit of the month under glare | can't tell | can't tell | can't tell |
| 9 | 0041508963985-3 | BBE 10.2019 10; [label cut off] 07.11.18 17 | yes, second line | yes, BBE | B is BB, A is another date |
| 10 | 0068200859118-4 | 26-07-21-NFT (unlabelled code); Best Before 2025.… and Lot 2024… cut off | characters match, not the best-before | no date read | A is not a food date |
| 11 | 0815442005021-1 | L. 180522; USE BY/EMPLOYEZ AVANT 24 MA 18; F.E 27/05/2022 | yes, F.E (production) | yes, use-by line | B is use-by, A is another date |
| 12 | 0185782000223-1 | BB \ MA 03/08/2023 LOT 2121601 | yes, BB | no (read 09; the digit is an 8) | B misread |
| 13 | 0678432504047-1 | 19/10/22 (EMBALLÉ LE); 28/·1/23 (MEILLEUR AVANT) | yes, packed | yes, best before | B is BB, A is another date |
| 14 | 5027738016191-1 | MFG DATE 03/01/2023; BEST BEFORE 03/Jan/2024 | yes, MFG | yes, BB | B is BB, A is another date |
| 15 | 0256760916956-1 | PACKED ON 18NO.22; BEST BEFORE 23NO.22 | no (NO is November) | yes, BB | A is wrong |
| 16 | 0856303004951-1 | 14.05.2… year smeared by a crease | can't tell | can't tell | can't tell |
| 17 | 7622201686994-1 | OTG03202?2 16:26 (code); MFG 12.01.22 | yes, MFG | no (read the code line) | B misread |
| 18 | 0827896001306-1 | BEST BEFORE 100223; 23/11/2022 (EMBALLÉ LE); 10/02/2023 (MEILLEUR AVANT) | yes, best before | yes, same date | same date, two-digit year (a miss by the rule) |
| 19 | 0048107199128-1 | LOT#: 104?7022A EXP:?3/1?/24 (curved, blurred) | can't tell | can't tell | can't tell |
| 20 | 0065244133129-7 | carton colour-bar code only (…-20-11-20); no food date visible | characters match, a print code | none read (correct) | A is not a food date |
| 21 | 2000001105320-4 | Fab: 21-11-2022; EMBALLAGE 24-JA-2023; MEILLEUR AV 08-FE-2023 | yes, Fab | yes, BB | B is BB, A is another date |
| 22 | 8690997135506-1 | PROD DATE:23.04.2022; EXP DATE:23.10.2023 | yes, production | yes, expiry | B is expiry, A is another date |
| 23 | 0062229089334-1 | PRD/ 14/04/2022; BB/ 14/10/2023 | yes, production | yes, BB | B is BB, A is another date |
| 24 | 0211650203998-1 | EMBALLÉ LE ?5.05.2021 (first digit faded); MEILLEUR AVANT 09.05.2021 | can't tell | yes, BB | B is BB, A is another date |
| 25 | 0200036004427-1 | EMBALLE LE 25.03.2023; MEILLEUR AVANT 09.04.2023 | yes, packed | yes, BB | B is BB, A is another date |
| 26 | 0065244125216-7 | carton colour-bar code only (…-22-08-22); no food date visible | characters match, a print code | none read (correct) | A is not a food date |
| 27 | 0850013716807-3 | BEST BY 25.05.2? (last digit cut off) | can't tell | can't tell | can't tell |
| 28 | 2000000145943-3 | 01/04/2? (lower half cut off) | can't tell | can't tell | can't tell |
| 29 | 0876681002806-1 | 06/10/2021 (EMBALLÉ LE); 11/10/2021 (MEILLEUR AVANT) | yes, packed | yes, best before | B is BB, A is another date |

Counts over the 29 misses: B read the best-before, use-by or expiry and A is a packed or production
date, 14; A is not a food date or is wrong, 5 (#7, 10, 15, 20, 26); can't tell, 6; B misread, 2;
same date with a two-digit year, 1 (#18); not food, 1.
