# EN 81 cabin example

One Theme Project, four rotations (R0/R90/R180/R270), Foundation 720×1280.

| Scene | EN 81 | Activation |
|---|---|---|
| Seyir | EN 81-70 car position + direction | always (priority 0) |
| Yangın | EN 81-73 fire, do not use the lift | `fire = true` (priority 10) |
| Aşırı yük | EN 81-20 5.12 visual overload | `service_state = overload` (priority 8) |
| Girilmez | out of service / do not enter | `service_state = service_out` (priority 9) |
| Deprem | EN 81-77 seismic | **disabled** — profile has no seismic runtime state |

Portrait (R0/R180) stacks video → direction → floor on the vertical centre line. Landscape (R90/R270) puts video on the left third and indicators on the remaining centre. R180 matches R0; R270 matches R90.

Open from **File → Open EN 81 Cabin Example**, or import `en81-cabin.tdproj.json`. Snapshots resolve from same-origin `assets/*` in the Vite public folder, then persist in the editor cache.
