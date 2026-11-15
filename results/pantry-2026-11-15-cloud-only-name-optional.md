### only_in_cloud

Run: results/pantry-2026-11-15-cloud-only-name-optional.json | cloud model gemini-3.5-flash-lite | on-device status: not recorded

| photo | expected | app did | date text read | parsed | path | match |
|---|---|---|---|---|---|---|
| 20261115_112242.jpg | unverified | set_aside SET_ASIDE | 25 OC 2029FYFY |  | in_cloud 2842 ms |  |
| 20261115_112247.jpg | turn_it | turn_it |  |  | in_cloud 1258 ms | yes |
| 20261115_112303.jpg | turn_it | turn_it |  |  | in_cloud 1858 ms | yes |
| 20261115_112311.jpg | turn_it | turn_it |  |  | in_cloud 1949 ms | yes |
| 20261115_112323.jpg | turn_it | turn_it |  |  | in_cloud 2786 ms | yes |
| 20261115_112326.jpg | turn_it | turn_it |  |  | in_cloud 1483 ms | yes |
| 20261115_112402.jpg | turn_it | set_aside SET_ASIDE |  |  | in_cloud 3125 ms | NO |
| 20261115_112406.jpg | log | log KEEP | BB/MA 5037 MA | 5037-05-01 | in_cloud 2472 ms | NO date WRONG (label 2027-05) |
| 20261115_112410.jpg | turn_it | turn_it |  |  | in_cloud 2288 ms | yes |
| 20261115_112419.jpg | turn_it | turn_it |  |  | in_cloud 1596 ms | yes |
| 20261115_112421.jpg | turn_it | turn_it |  |  | in_cloud 1723 ms | yes |
| 20261115_112427.jpg | log | log KEEP | 2027 FE 14 | 2027-02-14 | in_cloud 1015 ms | yes date ok |
| 20261115_112441.jpg | set_aside | set_aside SET_ASIDE |  |  | in_cloud 2814 ms | yes |
| 20261115_112446.jpg | set_aside | set_aside SET_ASIDE | 2026 DE 07 |  | in_cloud 1454 ms | yes |
| 20261115_112452.jpg | set_aside | set_aside SET_ASIDE |  |  | in_cloud 2886 ms | yes |
| 20261115_112458.jpg | set_aside | set_aside SET_ASIDE | 2026 NO 30 |  | in_cloud 2205 ms | yes |

Scored photos: 13 of 15 handled as a careful volunteer would.
Dates checked against the label: 1 of 2 correct.
in_cloud: 16 reads, median 2077 ms, max 3125 ms

