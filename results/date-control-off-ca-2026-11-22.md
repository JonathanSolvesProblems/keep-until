# Date reading on 100 outside photos, 2026-11-22

The set: 100 photos of products sold in Canada whose expiry date an Open Food Facts volunteer confirmed (`shared/date-control-off-ca.json`, registered before the run in commit 4e076a2). Source: Open Food Facts Robotoff `expiration_date` insights with `annotation = 1`, filtered to Canada. Images by Open Food Facts contributors, CC BY-SA 4.0; they are fetched at run time and not stored in this repository.

The run: the app's own batch reader (Testing tools, run saved photos), cloud only, because reading the date is the cloud model's job in the hybrid (Gemini Nano on the laptop only decides whether a date is in view). Graded by `scripts/grade_dates.py` with the rule registered with the set: the date the app reads must have the same numbers, in the same order, as the date the volunteer confirmed (separators ignored, 2023 equal to 23). Day and month order is not scored, so the app's keep or discard decision on these numeric dates is not part of the score.

## Result

**Dates read right: 71 of 100.** Median cloud read 1.5 s; no read failed; 5 photos with no date read.

Correction, 2026-11-24: this file first said 72. One photo's stamp reads `100223` and the confirmed date is `10/02/2023`: the same date, written with a two-digit year. The registered rule compares digits and does not allow for that, so the photo is a miss. An interim version of the grader had counted it; a code review caught that the grader was then more lenient than the rule. The grader now compares against the digits registered with each item.

What this set is and is not:
- It is an outside set with outside labels: neither the photos nor the confirmed dates are mine.
- Its dates are numeric (`31/01/2023`, `25.11.2024`), the formats Open Food Facts' text reader finds. It has none of the year-first bilingual stamps (`2027 FE 14`) Canadian donations mostly carry; those are in my own pantry set.
- The confirmed date is the one Open Food Facts' text reader picked, which is not always the best-before: some packages print a packed-on or production date too. Those cases count as misses here, by the registered rule; the audit below says how many.
- The photos are years old, so most of these products are long past their dates on 2026-11-22; the app's decisions on them are not meaningful and are shown only for completeness.

## Audit of the 29 misses

A separate reviewer, given only the photos and both readings, enlarged each package and recorded every date printed on it (photo by photo: `results/date-control-off-ca-2026-11-22-audit.md`):

| What the photo shows | Photos |
|---|---|
| The app read the best-before or expiry date; the confirmed date is a packed-on or production date printed on the same package | 14 |
| The confirmed date is not a food date (a carton print code, a date on a paper under the package, an unlabelled code before the real best-before) | 5 |
| Not legible enough to settle either reading | 6 |
| The app misread the date (an 8 read as a 9; a code line read as a date) | 2 |
| The app read the same date, written with a two-digit year (100223 for 10/02/2023) | 1 |
| Not food (a price sticker on a video game) | 1 |

So the app's clear misreads on this set are 2 of 100. The registered score stays 71: the audit explains the misses, it does not re-score them. The 14 packages with two dates are the case a sort table cares about most, and on each of them the app chose the best-before or expiry.

## Every photo

Run: results/date-control-off-ca-2026-11-22.json | cloud model gemini-3.5-flash-lite | 100 photos

| photo | date confirmed on Open Food Facts | date the app read | app's answer | same date |
|---|---|---|---|---|
| 8004476001068-1.jpg | 31/01/2023 | 31/01/2023 | DISCARD | yes |
| 0872214008666-2.jpg | 04/10/2023 | EXP:04/10/2023 | SET_ASIDE | yes |
| 0621001001645-1.jpg | 13/05/21 | 13/05/21 | DISCARD | yes |
| 0883204017216-1.jpg | 26/06/2021 | EXP:26/06/2021 | DISCARD | yes |
| 5904637025410-1.jpg | 08.08.2023 | 08.08.2023 | DISCARD | yes |
| 0621001003946-1.jpg | 03/10/23 | 03/10/23 | SET_ASIDE | yes |
| 0621001003953-1.jpg | 03/10/23 | 03/10/23 | SET_ASIDE | yes |
| 0061308210195-1.jpg | 02/07/2021 | BB/MA 2022 DE 31 | SET_ASIDE | NO |
| 0069529050064-2.jpg | 30/10/2025 | BBF:30/10/2025 | SET_ASIDE | yes |
| 0797059859573-1.jpg | 10/09/23 | EXP 10/09/23 | KEEP | yes |
| 0069694014878-1.jpg | 25.11.2024 | 25.11.2024 | DISCARD | yes |
| 3700311812176-5.jpg | 23/11/2018 | 23/11/2018 | DISCARD | yes |
| 3256540002364-11.jpg | 05/07/2019 | 19/07/2019 | DISCARD | NO |
| 0066019200251-4.jpg | 22/12/2016 | 22/12/2016 | DISCARD | yes |
| 3245412891168-9.jpg | 01.06.2020 | 01.06.2020 | SET_ASIDE | yes |
| 8025202001220-2.jpg | 19/05/2025 | 19/05/2025 | DISCARD | yes |
| 0083747003657-2.jpg | 07/01/23 | 07/01/23 | SET_ASIDE | yes |
| 0689466018479-1.jpg | 24/10/24 | 24/10/24 | DISCARD | yes |
| 0889842103557-1.jpg | 15/07/17 | (no date read) | no_item | NO |
| 6253001010378-1.jpg | 04/05/2021 | 03/05/2023 | SET_ASIDE | NO |
| 0814574001307-2.jpg | 28-06-18 | 18-06-18 | SET_ASIDE | NO |
| 0872632120193-2.jpg | 13/02/23 | 13/08/24 | SET_ASIDE | NO |
| 0697658692383-2.jpg | 12-10-20 | 12-10-20 | SET_ASIDE | yes |
| 0665081004622-3.jpg | 25/06/25 | (no date read) | need_date_photo | NO |
| 0064420100818-3.jpg | 21-01-19 | 21-01-19 | SET_ASIDE | yes |
| 0056932604045-1.jpg | 04/08/21 | 04/09/21 | SET_ASIDE | NO |
| 5425010833151-2.jpg | 18/07/2019 | 18/07/2019 | DISCARD | yes |
| 8076809507110-9.jpg | 02/01/2020 | 02/01/2020 | SET_ASIDE | yes |
| 0041508963985-3.jpg | 07.11.18 | BBE 10.2019 | DISCARD | NO |
| 0753519473840-1.jpg | 04/05/2024 | BEST BY:04/05/2024 | SET_ASIDE | yes |
| 0068200859118-4.jpg | 26-07-21 | (no date read) | SET_ASIDE | NO |
| 6281036281203-4.jpg | 12/04/20 | P 12/04/20 | SET_ASIDE | yes |
| 0037695503486-2.jpg | 12/11/2024 | 12/11/2024 | SET_ASIDE | yes |
| 0056664013115-2.jpg | 14/03/2021 | 14/03/2021 | DISCARD | yes |
| 0815442005021-1.jpg | 27/05/2022 | USE BY/EMPLOYEZ AVANT 24 MA 18 | DISCARD | NO |
| 0185782000223-1.jpg | 03/08/2023 | 03/09/2023 | SET_ASIDE | NO |
| 0272928908991-1.jpg | 29.03.2023 | 29.03.2023 | SET_ASIDE | yes |
| 0666872160435-1.jpg | 13.07.2025 | 13.07.2025 | SET_ASIDE | yes |
| 8160550018510-1.jpg | 30/01/23 | 30/01/23 | SET_ASIDE | yes |
| 0678432504047-1.jpg | 19/10/22 | 28/1/23 | DISCARD | NO |
| 2100001048860-1.jpg | 10/10/2022 | 10/10/2022 | DISCARD | yes |
| 5027738016191-1.jpg | 03/01/2023 | 03/Jan/2024 | DISCARD | NO |
| 0069288001987-1.jpg | 07/11/22 | 07/11/22 | SET_ASIDE | yes |
| 0773619030064-1.jpg | 10/10/22 | 10/10/22 | SET_ASIDE | yes |
| 0850033079791-3.jpg | 10/06/24 | BEST BY 10/06/24 | SET_ASIDE | yes |
| 0067400017922-1.jpg | 25/03/20 | 25/03/20 | SET_ASIDE | yes |
| 0710228339935-1.jpg | 14.02.2023 | 14.02.2023 | SET_ASIDE | yes |
| 0667888082179-2.jpg | 14/05/2021 | 14/05/2021 | DISCARD | yes |
| 8681630323015-2.jpg | 09.11.23 | 09.11.23 | SET_ASIDE | yes |
| 0638031612178-19.jpg | 05/03/25 | 05/03/25 | SET_ASIDE | yes |
| 0817670010204-2.jpg | 03/12/21 | 03/12/21 | SET_ASIDE | yes |
| 0256760916956-1.jpg | 23.10.22 | 23.NO.22 | SET_ASIDE | NO |
| 0037466041339-12.jpg | 30-11-2023 | 30-11 -2023 | DISCARD | yes |
| 0628451526308-4.jpg | 11/11/2020 | 11/11/2020 | DISCARD | yes |
| 0065244133204-10.jpg | 22-08-22 | 22-08-22 | SET_ASIDE | yes |
| 0833280000046-1.jpg | 28/07/20 | 28/07/20 | SET_ASIDE | yes |
| 0856303004951-1.jpg | 14.05.20 | 14.05.202 | SET_ASIDE | NO |
| 3547130101070-2.jpg | 15/08/2023 | 15/08/2023 | SET_ASIDE | yes |
| 8941100291351-1.jpg | 29/06/23 | EXP : 29/06/23 | DISCARD | yes |
| 3800500043715-3.jpg | 04.09.2024 | 04.09.2024 | SET_ASIDE | yes |
| 0083747003978-2.jpg | 07/06/24 | 07/06/24 | SET_ASIDE | yes |
| 7622201686994-1.jpg | 12.01.22 | OTG0320282 | SET_ASIDE | NO |
| 8413575000900-1.jpg | 19/06/24 | 19/06/24 | DISCARD | yes |
| 0827896001306-1.jpg | 10/02/2023 | 100223 | SET_ASIDE | NO |
| 8801073142312-6.jpg | 15.07.2023 | EXP. 15.07.2023 | DISCARD | yes |
| 0764718447952-1.jpg | 09/01/2023 | EXP DATE: 09/01/2023 | SET_ASIDE | yes |
| 0057391100031-1.jpg | 12/06/22 | 12/06/22 | SET_ASIDE | yes |
| 0716519089985-1.jpg | 12/06/22 | 12/06/22 | SET_ASIDE | yes |
| 0048107199128-1.jpg | 13/11/24 | EXP:03/10/24 | SET_ASIDE | NO |
| 0036632077653-3.jpg | 25-04-23 | ECI-25-04-23 | DISCARD | yes |
| 0065244133129-7.jpg | 20-11-20 | (no date read) | need_date_photo | NO |
| 0628451668336-1.jpg | 25/11/22 | 25/11/22 | DISCARD | yes |
| 2000001105320-4.jpg | 21-11-2022 | 08-FE-2023 | SET_ASIDE | NO |
| 0627843476740-1.jpg | 15/12/2023 | 15/12/2023 | DISCARD | yes |
| 0890142001719-1.jpg | 02/09/23 | 02/09/23 | SET_ASIDE | yes |
| 0209311212991-1.jpg | 16.01.2023 | 16.01.2023 | SET_ASIDE | yes |
| 8690997135506-1.jpg | 23.04.2022 | 23.10.2023 | DISCARD | NO |
| 0841161096057-1.jpg | 26/01/23 | 26/01/23 | SET_ASIDE | yes |
| 0062229089334-1.jpg | 14/04/2022 | BB/ 14/10/2023 | SET_ASIDE | NO |
| 0211650203998-1.jpg | 15.05.2021 | 09.05.2021 | SET_ASIDE | NO |
| 0067400825602-1.jpg | 21/12/22 | 21/12/22 | SET_ASIDE | yes |
| 0200036004427-1.jpg | 25.03.2023 | 09.04.2023 | SET_ASIDE | NO |
| 0073996001238-1.jpg | 14/12/22 | 14/12/22 | SET_ASIDE | yes |
| 0065244125216-7.jpg | 22-08-22 | (no date read) | need_date_photo | NO |
| 0621147300916-2.jpg | 23/10/23 | 23/10/23 | DISCARD | yes |
| 0810175007335-1.jpg | 27/12/20 | 27/12/20 | SET_ASIDE | yes |
| 0850013716807-3.jpg | 25.05.20 | 25.05.28 | KEEP | NO |
| 0743434000337-4.jpg | 30/11/2023 | 30/11/2023 | DISCARD | yes |
| 2000000145943-3.jpg | 01/04/22 | 01/04/23 | need_date_photo | NO |
| 0624823101043-1.jpg | 03/09/2023 | 03/09/2023 | SET_ASIDE | yes |
| 0876681002806-1.jpg | 06/10/2021 | 11/10/2021 | SET_ASIDE | NO |
| 0041800326006-11.jpg | 28/03/2019 | 28/03/2019 | DISCARD | yes |
| 0876131001199-1.jpg | 22/10/2023 | B.B. 22/10/2023 | DISCARD | yes |
| 0628176694061-1.jpg | 10/07/21 | 10/07/21 | SET_ASIDE | yes |
| 0621001012634-1.jpg | 12/07/22 | 12/07/22 | SET_ASIDE | yes |
| 0014100280132-1.jpg | 02/05/22 | 02/05/22 | SET_ASIDE | yes |
| 4897053640538-2.jpg | 19.04.2022 | 19.04.2022 | SET_ASIDE | yes |
| 0814153001834-1.jpg | 12/10/21 | 12/10/21 | SET_ASIDE | yes |
| 0875405005468-2.jpg | 03/08/2022 | 03/08/2022 | SET_ASIDE | yes |
| 0058449172192-4.jpg | 15/02/2022 | 15/02/2022 | DISCARD | yes |

Dates read right: 71 of 100. No date read: 5. Read failed: 0.
Not counted: 1 more read the same date with a two-digit year.
Cloud read time: median 1.5 s over 158 reads.
