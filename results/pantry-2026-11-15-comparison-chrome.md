### only_on_device

Run: results/pantry-2026-11-15-comparison-chrome.json | cloud model gemini-3.5-flash-lite | on-device status: on-device: available

| photo | expected | app did | date text read | parsed | path | match |
|---|---|---|---|---|---|---|
| 20261115_112242.jpg | unverified | set_aside SET_ASIDE | 2314 |  | on_device 50287 ms |  |
| 20261115_112247.jpg | turn_it | set_aside SET_ASIDE | % |  | on_device 5980 ms | NO |
| 20261115_112303.jpg | turn_it | set_aside SET_ASIDE |  |  | on_device 6662 ms | NO |
| 20261115_112311.jpg | turn_it | set_aside SET_ASIDE |  |  | on_device 8004 ms | NO |
| 20261115_112323.jpg | turn_it | set_aside SET_ASIDE |  |  | on_device 6739 ms | NO |
| 20261115_112326.jpg | turn_it | set_aside SET_ASIDE | none |  | on_device 7420 ms | NO |
| 20261115_112402.jpg | turn_it | set_aside SET_ASIDE |  |  | on_device 6871 ms | NO |
| 20261115_112406.jpg | log | log KEEP | 26MR14 | 2026-03-14 | on_device 8039 ms | NO date WRONG (label 2027-05) |
| 20261115_112410.jpg | turn_it | set_aside SET_ASIDE | none |  | on_device 7670 ms | NO |
| 20261115_112419.jpg | turn_it | set_aside SET_ASIDE |  |  | on_device 7416 ms | NO |
| 20261115_112421.jpg | turn_it | set_aside SET_ASIDE |  |  | on_device 6969 ms | NO |
| 20261115_112427.jpg | log | set_aside SET_ASIDE | 2022 FE 14 02146 |  | on_device 7696 ms | NO |
| 20261115_112441.jpg | set_aside | set_aside SET_ASIDE |  |  | on_device 7088 ms | yes |
| 20261115_112446.jpg | set_aside | set_aside SET_ASIDE | 137-0 |  | on_device 8612 ms | yes |
| 20261115_112452.jpg | set_aside | set_aside SET_ASIDE | BB/MA |  | on_device 8478 ms | yes |
| 20261115_112458.jpg | set_aside | set_aside SET_ASIDE | 2026 MR 14 | 2026-03-14 | on_device 8293 ms | yes date WRONG (label 2026-11-30) |

Scored photos: 4 of 15 handled as a careful volunteer would.
Dates checked against the label: 0 of 2 correct.
on_device: 16 reads, median 7545 ms, max 50287 ms

### prefer_on_device

Run: results/pantry-2026-11-15-comparison-chrome.json | cloud model gemini-3.5-flash-lite | on-device status: on-device: available

| photo | expected | app did | date text read | parsed | path | match |
|---|---|---|---|---|---|---|
| 20261115_112242.jpg | unverified | set_aside SET_ASIDE | 25 OC 2029FYFY |  | on_device 6574 ms > in_cloud 18063 ms |  |
| 20261115_112247.jpg | turn_it | set_aside SET_ASIDE | 26 MR 14 | 2026-03-14 | on_device 8764 ms | NO |
| 20261115_112303.jpg | turn_it | set_aside SET_ASIDE |  |  | on_device 6455 ms > in_cloud 10641 ms | NO |
| 20261115_112311.jpg | turn_it | set_aside SET_ASIDE |  |  | on_device 7415 ms | NO |
| 20261115_112323.jpg | turn_it | set_aside SET_ASIDE | 26MR14 | 2026-03-14 | on_device 6328 ms | NO |
| 20261115_112326.jpg | turn_it | set_aside SET_ASIDE |  |  | on_device 7269 ms | NO |
| 20261115_112402.jpg | turn_it | set_aside SET_ASIDE |  |  | on_device 6769 ms > in_cloud 3415 ms | NO |
| 20261115_112406.jpg | log | set_aside SET_ASIDE | 2019 |  | on_device 7279 ms | NO |
| 20261115_112410.jpg | turn_it | set_aside SET_ASIDE | N/A |  | on_device 6740 ms | NO |
| 20261115_112419.jpg | turn_it | set_aside SET_ASIDE |  |  | on_device 7644 ms | NO |
| 20261115_112421.jpg | turn_it | set_aside SET_ASIDE | 2026MR14 | 2026-03-14 | on_device 10421 ms | NO |
| 20261115_112427.jpg | log | log KEEP | 2027 FE 14 | 2027-02-14 | on_device 10325 ms > in_cloud 2559 ms | yes date ok |
| 20261115_112441.jpg | set_aside | set_aside SET_ASIDE |  |  | on_device 7570 ms | yes |
| 20261115_112446.jpg | set_aside | turn_it | 37-0 |  | on_device 7063 ms | NO |
| 20261115_112452.jpg | set_aside | set_aside SET_ASIDE |  |  | on_device 8305 ms > in_cloud 5003 ms | yes |
| 20261115_112458.jpg | set_aside | set_aside SET_ASIDE |  |  | on_device 7867 ms | yes |

Scored photos: 4 of 15 handled as a careful volunteer would.
Dates checked against the label: 1 of 1 correct.
on_device: 16 reads, median 7347 ms, max 10421 ms
in_cloud: 5 reads, median 5003 ms, max 18063 ms

### only_in_cloud

Run: results/pantry-2026-11-15-comparison-chrome.json | cloud model gemini-3.5-flash-lite | on-device status: on-device: available

| photo | expected | app did | date text read | parsed | path | match |
|---|---|---|---|---|---|---|
| 20261115_112242.jpg | unverified | set_aside SET_ASIDE | 25 OC 2029 |  | in_cloud 34418 ms |  |
| 20261115_112247.jpg | turn_it | turn_it |  |  | in_cloud 3139 ms | yes |
| 20261115_112303.jpg | turn_it | turn_it |  |  | in_cloud 1531 ms | yes |
| 20261115_112311.jpg | turn_it | turn_it |  |  | in_cloud 58248 ms | yes |
| 20261115_112323.jpg | turn_it | turn_it |  |  | in_cloud 30527 ms | yes |
| 20261115_112326.jpg | turn_it | turn_it |  |  | in_cloud 2007 ms | yes |
| 20261115_112402.jpg | turn_it | turn_it |  |  | in_cloud 1593 ms | yes |
| 20261115_112406.jpg | log | turn_it |  |  | in_cloud 1404 ms | NO |
| 20261115_112410.jpg | turn_it | turn_it |  |  | in_cloud 1877 ms | yes |
| 20261115_112419.jpg | turn_it | turn_it |  |  | in_cloud 1606 ms | yes |
| 20261115_112421.jpg | turn_it | turn_it |  |  | in_cloud 1815 ms | yes |
| 20261115_112427.jpg | log | log KEEP | 2027 FE 14 | 2027-02-14 | in_cloud 1320 ms | yes date ok |
| 20261115_112441.jpg | set_aside | set_aside SET_ASIDE |  |  | in_cloud 1639 ms | yes |
| 20261115_112446.jpg | set_aside | set_aside SET_ASIDE | 2026 DE 07 |  | in_cloud 1679 ms | yes |
| 20261115_112452.jpg | set_aside | set_aside SET_ASIDE |  |  | in_cloud 1252 ms | yes |
| 20261115_112458.jpg | set_aside | set_aside SET_ASIDE | 2026 NO 30 |  | in_cloud 1718 ms | yes |

Scored photos: 14 of 15 handled as a careful volunteer would.
Dates checked against the label: 1 of 1 correct.
in_cloud: 16 reads, median 1698 ms, max 58248 ms

