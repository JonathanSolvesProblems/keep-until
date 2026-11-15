### cloud pass 1

Run: results/pantry-2026-11-15-cloud-repeatability.json | cloud model gemini-3.5-flash-lite | on-device status: on-device: not in this browser (cloud fallback)

| photo | expected | app did | date text read | parsed | path | match |
|---|---|---|---|---|---|---|
| 20261115_112242.jpg | unverified | set_aside SET_ASIDE | 25 OC 2029 |  | in_cloud 1864 ms |  |
| 20261115_112247.jpg | turn_it | turn_it |  |  | in_cloud 2117 ms | yes |
| 20261115_112303.jpg | turn_it | turn_it |  |  | in_cloud 1930 ms | yes |
| 20261115_112311.jpg | turn_it | turn_it |  |  | in_cloud 2952 ms | yes |
| 20261115_112323.jpg | turn_it | turn_it |  |  | in_cloud 2316 ms | yes |
| 20261115_112326.jpg | turn_it | turn_it |  |  | in_cloud 2606 ms | yes |
| 20261115_112402.jpg | turn_it | turn_it |  |  | in_cloud 2815 ms | yes |
| 20261115_112406.jpg | log | turn_it |  |  | in_cloud 3969 ms | NO |
| 20261115_112410.jpg | turn_it | turn_it |  |  | in_cloud 2076 ms | yes |
| 20261115_112419.jpg | turn_it | turn_it |  |  | in_cloud 1999 ms | yes |
| 20261115_112421.jpg | turn_it | turn_it |  |  | in_cloud 3204 ms | yes |
| 20261115_112427.jpg | log | log KEEP | 2027 FE 14 | 2027-02-14 | in_cloud 2336 ms | yes date ok |
| 20261115_112441.jpg | set_aside | set_aside SET_ASIDE |  |  | in_cloud 3525 ms | yes |
| 20261115_112446.jpg | set_aside | set_aside SET_ASIDE | 2026 DE 07 |  | in_cloud 4233 ms | yes |
| 20261115_112452.jpg | set_aside | set_aside SET_ASIDE |  |  | in_cloud 4414 ms | yes |
| 20261115_112458.jpg | set_aside | set_aside SET_ASIDE | 2026 NO 30 |  | in_cloud 1414 ms | yes |

Scored photos: 14 of 15 handled as a careful volunteer would.
Dates checked against the label: 1 of 1 correct.
in_cloud: 16 reads, median 2471 ms, max 4414 ms

### cloud pass 2

Run: results/pantry-2026-11-15-cloud-repeatability.json | cloud model gemini-3.5-flash-lite | on-device status: on-device: not in this browser (cloud fallback)

| photo | expected | app did | date text read | parsed | path | match |
|---|---|---|---|---|---|---|
| 20261115_112242.jpg | unverified | set_aside SET_ASIDE | 25 OC 2029FYFY |  | in_cloud 1799 ms |  |
| 20261115_112247.jpg | turn_it | turn_it |  |  | in_cloud 1848 ms | yes |
| 20261115_112303.jpg | turn_it | turn_it |  |  | in_cloud 1105 ms | yes |
| 20261115_112311.jpg | turn_it | turn_it |  |  | in_cloud 3076 ms | yes |
| 20261115_112323.jpg | turn_it | turn_it |  |  | in_cloud 2631 ms | yes |
| 20261115_112326.jpg | turn_it | turn_it |  |  | in_cloud 1277 ms | yes |
| 20261115_112402.jpg | turn_it | turn_it |  |  | in_cloud 1406 ms | yes |
| 20261115_112406.jpg | log | log DISCARD | 26MA14 | 2026-05-14 | in_cloud 2379 ms | NO date WRONG (label 2027-05) |
| 20261115_112410.jpg | turn_it | turn_it |  |  | in_cloud 2031 ms | yes |
| 20261115_112419.jpg | turn_it | turn_it |  |  | in_cloud 1580 ms | yes |
| 20261115_112421.jpg | turn_it | turn_it |  |  | in_cloud 3599 ms | yes |
| 20261115_112427.jpg | log | log KEEP | 2027 FE 14 | 2027-02-14 | in_cloud 1210 ms | yes date ok |
| 20261115_112441.jpg | set_aside | set_aside SET_ASIDE |  |  | in_cloud 1231 ms | yes |
| 20261115_112446.jpg | set_aside | set_aside SET_ASIDE | 2026 DE 07 |  | in_cloud 2337 ms | yes |
| 20261115_112452.jpg | set_aside | set_aside SET_ASIDE |  |  | in_cloud 1121 ms | yes |
| 20261115_112458.jpg | set_aside | set_aside SET_ASIDE | 2026 NO 30 |  | in_cloud 1251 ms | yes |

Scored photos: 14 of 15 handled as a careful volunteer would.
Dates checked against the label: 1 of 2 correct.
in_cloud: 16 reads, median 1690 ms, max 3599 ms

### cloud pass 3

Run: results/pantry-2026-11-15-cloud-repeatability.json | cloud model gemini-3.5-flash-lite | on-device status: on-device: not in this browser (cloud fallback)

| photo | expected | app did | date text read | parsed | path | match |
|---|---|---|---|---|---|---|
| 20261115_112242.jpg | unverified | set_aside SET_ASIDE | 25 OC 2029FYFY |  | in_cloud 1622 ms |  |
| 20261115_112247.jpg | turn_it | turn_it |  |  | in_cloud 1278 ms | yes |
| 20261115_112303.jpg | turn_it | turn_it |  |  | in_cloud 1010 ms | yes |
| 20261115_112311.jpg | turn_it | turn_it |  |  | in_cloud 2393 ms | yes |
| 20261115_112323.jpg | turn_it | turn_it |  |  | in_cloud 2356 ms | yes |
| 20261115_112326.jpg | turn_it | turn_it |  |  | in_cloud 995 ms | yes |
| 20261115_112402.jpg | turn_it | turn_it |  |  | in_cloud 3251 ms | yes |
| 20261115_112406.jpg | log | log KEEP | BB/MA 2027 MA 17 | 2027-05-17 | in_cloud 1443 ms | yes date ok |
| 20261115_112410.jpg | turn_it | turn_it |  |  | in_cloud 1715 ms | yes |
| 20261115_112419.jpg | turn_it | turn_it |  |  | in_cloud 1195 ms | yes |
| 20261115_112421.jpg | turn_it | turn_it |  |  | in_cloud 1254 ms | yes |
| 20261115_112427.jpg | log | log KEEP | 2027 FE 14 | 2027-02-14 | in_cloud 1847 ms | yes date ok |
| 20261115_112441.jpg | set_aside | set_aside SET_ASIDE |  |  | in_cloud 1579 ms | yes |
| 20261115_112446.jpg | set_aside | set_aside SET_ASIDE | 2026 DE 07 |  | in_cloud 1235 ms | yes |
| 20261115_112452.jpg | set_aside | set_aside SET_ASIDE |  |  | in_cloud 1254 ms | yes |
| 20261115_112458.jpg | set_aside | set_aside SET_ASIDE | 2026 NO 30 |  | in_cloud 1939 ms | yes |

Scored photos: 15 of 15 handled as a careful volunteer would.
Dates checked against the label: 2 of 2 correct.
in_cloud: 16 reads, median 1511 ms, max 3251 ms

