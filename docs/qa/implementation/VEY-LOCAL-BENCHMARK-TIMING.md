# Vey benchmark timing receipt

**Total through verified publication: 2h 48m 43s.**

UTC: 2026-09-17T03:42:02.501Z to 2026-09-17T06:30:45.042448+00:00.

Actual elapsed wall time from task start through successful public verification. Includes research, implementation, visual review, setup, downloads, failures and deployment. Excludes subsequent documentation and handoff writing. Parallel command timings overlap and must not be summed.

## Non-overlapping wall phases

| Phase | Elapsed |
|---|---:|
| Research and benchmark | 6m 19s |
| Initial setup/download window, with implementation in parallel | 1h 15m 06s |
| Generation, revisions, tool integration and local validation | 1h 6m 41s |
| Publication, upload retries and public verification | 20m 37s |

## Each measured command

Times overlap where commands ran in parallel. Process success does not mean visual approval. Texture pass 1 was rejected; pass 2 needed supervised finishing. The final candidate requires owner review.

| Step | Seconds | Process result |
|---|---:|---|
| Benchmark inspection and route selection | 377.92 | Inspected owner Tripo P2.0 model; export returned 403. Selected local Modly Trellis.2 GGUF. |
| trellis-setup | 3876.23 | completed |
| trellis-weights | 4376.36 | completed |
| priority-shape | 1761.12 | completed |
| motion contract | 2.37 | passed |
| Shape launch / rejected environment | 14.21 | failed |
| repair cuda | 37.63 | failed |
| studio timing tests | 2.17 | passed |
| repair wheel metadata | 8.10 | passed |
| Shape inference / first successful run | 323.69 | passed |
| Topology reduction | 55.31 | passed |
| Texture pass 1 / visually rejected | 65.66 | passed |
| shape browser | 5.43 | passed |
| paint browser | 5.03 | passed |
| Texture pass 2 / stronger reference | 67.90 | passed |
| paint strong browser | 5.03 | passed |
| Palette correction | 3.14 | passed |
| finished browser | 5.11 | passed |
| rig prepare | 1.25 | passed |
| Automatic skin binding / rejected | 1.22 | failed |
| Surface-weight transfer and motion | 4.44 | passed |
| new motion quality | 5.12 | passed |
| motion browser | 5.80 | passed |
| correct winding | 1.31 | passed |
| rig transfer motion final | 4.32 | passed |
| motion browser final | 5.76 | passed |
| contour browser | 5.70 | passed |
| Eye and badge detail | 5.85 | passed |
| detail winding | 1.40 | passed |
| detail rig motion | 4.46 | passed |
| motion final probe | 5.47 | passed |
| python final | 2.10 | passed |
| syntax final | 8.04 | passed |
| repo tests | 9.83 | passed |
| style final | 1.29 | passed |
| Remove duplicate source clips / rebuild | 3.86 | passed |
| Final adapter integration trial | 99.66 | passed |
| studio browser | 5.84 | passed |
| old viewer regression | 6.31 | passed |
| motion release probe | 3.22 | passed |
| browser release | 5.84 | passed |
| build mirrors | 5.89 | passed |
| cache reuse | 0.21 | passed |
| build release | 4.07 | passed |
| commit | 3.75 | passed |
| commit release | 0.42 | passed |
| push feature | 190.42 | failed |
| publish preview | 229.58 | failed |
| push feature retry | 60.20 | passed |
| publish preview retry | 3.06 | passed |
| deploy action | 63.72 | passed |
| live identity | 22.92 | failed |
| live browser | 7.29 | passed |
| live identity committed | 3.25 | passed |

## Interpretation

- Setup and weight downloads are a one-time environment cost.
- Selected successful shape, reduction, stronger texture, palette/detail, cleanup, rig and final probe commands total about eight minutes. This excludes code development, review and discarded attempts; it is not an unattended production SLA or batch average.
- A cached adapter replay was 0.21 seconds and performed no inference.
- Two HTTP 408 upload failures consumed 190.42 and 229.58 seconds. The bounded HTTP/1.1 upload retry succeeded.
- Initial live verification compared Windows worktree line endings against Git-hosted content. The corrected check compares exact committed V2 bytes; all 24 files match. No delivered content was normalized; the failed receipt is retained.
- Full stdout/stderr and original receipts remain locally in artifacts/vey-quality-research. Every attempt has UTC timestamps and elapsed seconds in the [machine-readable ledger](VEY-LOCAL-BENCHMARK-TIMING.json).
