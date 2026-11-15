### only_on_device

Run: results/pantry-2026-11-15-comparison-triage.json | cloud model gemini-3.5-flash-lite | on-device status: on-device: available

| photo | expected | app did | date text read | parsed | path | match |
|---|---|---|---|---|---|---|
| 20261115_112242.jpg | unverified | set_aside SET_ASIDE | 209F/313 |  | on_device 503429 ms |  |
| 20261115_112247.jpg | turn_it | set_aside SET_ASIDE |  |  | on_device 6792 ms | NO |
| 20261115_112303.jpg | turn_it | set_aside SET_ASIDE |  |  | on_device 9355 ms | NO |
| 20261115_112311.jpg | turn_it | set_aside SET_ASIDE |  |  | on_device 8573 ms | NO |
| 20261115_112323.jpg | turn_it | set_aside SET_ASIDE | 60383 01063 / 
 6035576 |  | on_device 8875 ms | NO |
| 20261115_112326.jpg | turn_it | set_aside SET_ASIDE |  |  | on_device 7299 ms | NO |
| 20261115_112402.jpg | turn_it | set_aside SET_ASIDE |  |  | on_device 8895 ms | NO |
| 20261115_112406.jpg | log | set_aside SET_ASIDE |  |  | on_device 6670 ms | NO |
| 20261115_112410.jpg | turn_it | set_aside SET_ASIDE |  |  | on_device 6525 ms | NO |
| 20261115_112419.jpg | turn_it | set_aside SET_ASIDE | none |  | on_device 8436 ms | NO |
| 20261115_112421.jpg | turn_it | set_aside SET_ASIDE | nan |  | on_device 9009 ms | NO |
| 20261115_112427.jpg | log | set_aside SET_ASIDE | 2027 FE 14216 |  | on_device 10367 ms | NO |
| 20261115_112441.jpg | set_aside | set_aside SET_ASIDE | . |  | on_device 6868 ms | yes |
| 20261115_112446.jpg | set_aside | set_aside SET_ASIDE | 20238 DE 07 |  | on_device 8581 ms | yes |
| 20261115_112452.jpg | set_aside | set_aside SET_ASIDE |  |  | on_device 7247 ms | yes |
| 20261115_112458.jpg | set_aside | set_aside SET_ASIDE |  |  | on_device 7318 ms | yes |

Scored photos: 4 of 15 handled as a careful volunteer would.
Dates checked against the label: 0 of 0 correct.
on_device: 16 reads, median 8504 ms, max 503429 ms

### prefer_on_device

Run: results/pantry-2026-11-15-comparison-triage.json | cloud model gemini-3.5-flash-lite | on-device status: on-device: available

| photo | expected | app did | date text read | parsed | path | match |
|---|---|---|---|---|---|---|
| 20261115_112242.jpg | unverified | set_aside SET_ASIDE | 25 OC 2029FYFY |  | on_device 5755 ms > in_cloud 1679 ms |  |
| 20261115_112247.jpg | turn_it | turn_it |  |  | on_device 6050 ms | yes |
| 20261115_112303.jpg | turn_it | turn_it |  |  | on_device 5348 ms | yes |
| 20261115_112311.jpg | turn_it | turn_it |  |  | on_device 4975 ms | yes |
| 20261115_112323.jpg | turn_it | turn_it |  |  | on_device 4880 ms | yes |
| 20261115_112326.jpg | turn_it | turn_it |  |  | on_device 5076 ms | yes |
| 20261115_112402.jpg | turn_it | turn_it |  |  | on_device 5042 ms | yes |
| 20261115_112406.jpg | log | turn_it |  |  | on_device 4930 ms | NO |
| 20261115_112410.jpg | turn_it | turn_it |  |  | on_device 5082 ms | yes |
| 20261115_112419.jpg | turn_it | turn_it |  |  | on_device 5453 ms > in_cloud 4285 ms | yes |
| 20261115_112421.jpg | turn_it | turn_it |  |  | on_device 5407 ms | yes |
| 20261115_112427.jpg | log | log KEEP | 2027 FE 14 | 2027-02-14 | on_device 6006 ms > in_cloud 1747 ms | yes date ok |
| 20261115_112441.jpg | set_aside | set_aside SET_ASIDE |  |  | on_device 5518 ms > in_cloud 2207 ms | yes |
| 20261115_112446.jpg | set_aside | set_aside SET_ASIDE | 2026 DE 07 |  | on_device 5149 ms > in_cloud 1184 ms | yes |
| 20261115_112452.jpg | set_aside | turn_it |  |  | on_device 5057 ms | NO |
| 20261115_112458.jpg | set_aside | set_aside SET_ASIDE | 2026 NO 30 |  | on_device 4988 ms > in_cloud 3292 ms | yes |

Scored photos: 13 of 15 handled as a careful volunteer would.
Dates checked against the label: 1 of 1 correct.
on_device: 16 reads, median 5116 ms, max 6050 ms
in_cloud: 6 reads, median 1977 ms, max 4285 ms

### only_in_cloud

Run: results/pantry-2026-11-15-comparison-triage.json | cloud model gemini-3.5-flash-lite | on-device status: on-device: available

| photo | expected | app did | date text read | parsed | path | match |
|---|---|---|---|---|---|---|
| 20261115_112242.jpg | unverified | set_aside SET_ASIDE | 25 OC 2029 |  | in_cloud 1110 ms |  |
| 20261115_112247.jpg | turn_it | turn_it |  |  | in_cloud 1299 ms | yes |
| 20261115_112303.jpg | turn_it | turn_it |  |  | in_cloud 1225 ms | yes |
| 20261115_112311.jpg | turn_it | turn_it |  |  | in_cloud 5405 ms | yes |
| 20261115_112323.jpg | turn_it | turn_it |  |  | in_cloud 6973 ms | yes |
| 20261115_112326.jpg | turn_it | turn_it |  |  | in_cloud 7047 ms | yes |
| 20261115_112402.jpg | turn_it | turn_it |  |  | in_cloud 5323 ms | yes |
| 20261115_112406.jpg | log | turn_it | BB/MA |  | in_cloud 1117 ms | NO |
| 20261115_112410.jpg | turn_it | turn_it |  |  | in_cloud 2553 ms | yes |
| 20261115_112419.jpg | turn_it | turn_it |  |  | in_cloud 1448 ms | yes |
| 20261115_112421.jpg | turn_it | turn_it |  |  | in_cloud 1088 ms | yes |
| 20261115_112427.jpg | log | log KEEP | 2027 FE 14 | 2027-02-14 | in_cloud 1277 ms | yes date ok |
| 20261115_112441.jpg | set_aside | set_aside SET_ASIDE |  |  | in_cloud 1263 ms | yes |
| 20261115_112446.jpg | set_aside | set_aside SET_ASIDE | 2026 DE 07 |  | in_cloud 1204 ms | yes |
| 20261115_112452.jpg | set_aside | set_aside SET_ASIDE |  |  | in_cloud 1580 ms | yes |
| 20261115_112458.jpg | set_aside | set_aside SET_ASIDE | 2026 NO 30 |  | in_cloud 2842 ms | yes |

Scored photos: 14 of 15 handled as a careful volunteer would.
Dates checked against the label: 1 of 1 correct.
in_cloud: 16 reads, median 1374 ms, max 7047 ms

