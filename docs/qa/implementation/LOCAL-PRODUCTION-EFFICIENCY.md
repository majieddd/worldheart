# Local production efficiency correction

## Owner request

Reduce wasted usage without reducing output quality. This supplements the current local asset-studio work; it does not replace collaborator procedures or lower visual acceptance criteria.

## Observed causes

- The production work expanded into fresh runtime installation before fully evaluating the complete cached Krea weights.
- Download retries changed clients and cache behavior. Directory metadata incorrectly appeared stalled on Windows; opening the file showed progress. HTTP range, DNS and timeout failures were real, but not every unchanged directory listing was evidence of a stalled transfer.
- Large source excerpts and raw logs repeatedly entered the conversation when a targeted excerpt or status summary would have answered the question.
- UI and backend implementation advanced before one real model-to-image pilot had passed, creating avoidable integration debugging.
- Status calls, investigations and context rebuilding added overhead. The local transcript recorded approximately 70,000 generated tokens through the efficiency audit. This includes useful code and reasoning and is not an estimate of billed cost or a claim that all those tokens were wasted.

## Changed workflow

1. Inventory installed engines, usable cached weights, GPU headroom and required interfaces once. Retain the report.
2. Run one small real pilot with the chosen method before expanding its interface or asset batch. Validate identity, complete framing, contours and materials on the actual image/model.
3. Reuse the successful local Krea conversion. The downloader now skips equivalent installed local weights instead of downloading another diffusion model and text encoder.
4. Use `tools/asset-studio/status.py` for bounded status. Full installation, inference and test logs remain on disk. Read a failure's error and relevant stack only; do not repeatedly print complete reports or source files.
5. Retry when there is a concrete diagnosis or changed condition. Record the failure and correction. Do not switch providers or weight formats repeatedly without a reason.
6. Separate setup, inference, verification and owner approval. A passing API test cannot substitute for a generated result or visual inspection.
7. Run targeted checks after relevant changes and the required integration checks once before publication. Re-run only when edits, failures or unresolved concerns justify it.
8. Keep one compact work ledger with completed outputs, the active job and remaining blockers. Preserve successful artifacts and do not regenerate them merely because context was compacted.

## Quality gates retained

Recognizable source identity; saved original model; full-body framing; crisp mesh-attached paint; all animation clips inspected; approval invalidation; desktop/mobile runtime verification; generation provenance; publication checks. Model selection and visual iteration remain quality decisions, not token-saving shortcuts.

## Measured result so far

The cached Krea diffusion weights were converted locally with every tensor key and shape checked against the installed engine. A native text-encoder namespace correction resolved the first real pilot failure. The subsequent reference-conditioned 768 x 1024 output completed in about 150 seconds, with a framing iteration retained separately. This proves that local 2D generation works; it does not prove the remaining 3D and animation quality gates.

Evidence: `artifacts/production-efficiency-audit.json`, local Comfy logs, Krea project receipts and `lib/99-art/identity-v2/vey-krea-local.json`. Transcript input counters include repeated cached context and must not be interpreted as direct account charges. No percentage savings claim is made without a measured comparison.
