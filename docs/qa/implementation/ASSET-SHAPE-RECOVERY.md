# Asset Studio shape recovery and usage audit

2026-09-18; branch `fix/asset-shape-budget`. Started 09:07:16 UTC.

## Why the preceding run consumed so much

The exact preceding turn's local `token_usage_record` entries, deduplicated by
response ID, show **174 model responses** and **168 tool batches**. Its recorded
contexts specify `gpt-6-astra` with `low` effort, confirming the owner's report.
The thread's later setting is different and must not be used to contradict it.

| Runtime counter | Tokens |
|---|---:|
| Total input, including repeated context | 25,742,514 |
| Cached input, included above | 25,186,816 |
| Uncached input | 555,698 |
| Output | 80,408 |
| Reasoning, included in output | 19,458 |

These are runtime tokens, not unique text or task-attributed account credits.
There were two compactions. The work expanded across downloads, multiple image
routes, multiview inference, rigging, texture loading and publishing. Repeated
inspection/polling, broad file output (including a minified dependency) and long
context added avoidable overhead. Local GPU time itself is not a Codex token
charge. Low effort does not limit the number of responses or context processing.
[Official usage explanation](https://learn.chatgpt.com/docs/pricing#what-are-the-usage-limits-for-my-plan).

Corrections: one causal trial at a time; inspect source images before inference;
reuse installed upstream code; retain full logs on disk with bounded summaries;
use scripts for waits and measurements; no repeated broad validation without a
new change. Aegis efficiency and research-pilot methods now record these lessons.
The installed cache is `3.18.13+codex.20260918093108`; additive plugin PR #14 remains
open. No claim of an account-percentage saving is made.

## Shaping failure and repair

Siria `6a20e617fc92` had two 300-second failures at multiview 512/60. Both reached
surface decoding without exporting a model. The prior successful 512/60 timing
was for the mini checkpoint, and did not justify this multiview default.

- Separate five-minute multiview profile: at most 384 grid / 30 steps. Requested
  and effective values are saved in the conditioning receipt and shown in Studio.
- Selected 4096 texture pixels remain independent of geometry grid resolution.
- Stage progress now reports cutout preparation, loading, sampling and export.
- A first repaired run finished in 200.131 s, but rendered three bodies. The
  front input contained three figures and the back contained two. This output
  is retained as a failure, not a successful visual result.
- Studio now detects separate full-height silhouettes before inference and
  provides **Concept > directional view > Isolate one figure**. The selected crop
  retains source hashes/bounds and invalidates approval. Original artwork stays
  intact. This conservative detector is not proof of correct camera or anatomy.
- Selected the central front and left back figure through that API; existing
  left/right single figures remained. The corrected run produced one character
  in **155.614 s**, using all four inputs. No image regeneration was needed.
- Material-less GLBs used glTF's metallic default and looked black from behind.
  The shared viewer now uses neutral nonmetal clay only for missing materials;
  authored materials and painted assets retain their treatment.

The new mesh is unpainted and still needs likeness/detail review. A small ground
artifact remains near the boots; the source side-view shadows are a likely
contributor, not a proven cause. This checkpoint fixes failed generation and
multiple bodies, not the full commercial-quality target.

## Make-It-Animatable v2 comparison

The upstream app is already cloned at `local-asset-runtime/make-it-animatable-v2`,
commit `bbd8b158d88879c310ad130f9b25056935d221e9`. Studio calls its actual `app_v2`
model loading, surface sampling, coarse-joint/hand sampling, weight/joint/pose
inference and weight-conflict correction functions. This is the local version
of the requested method, not a new independent algorithm or hosted generation.
[Upstream](https://github.com/jasongzy/Make-It-Animatable).

Added a **Fresh MIA v2 prediction** control to bypass compatible cached predictions.
On the unchanged Ashtar source, candidate `8eb0e74ae2c4` performed fresh inference
and binding in **108.069 s**; `reusedPrediction` is absent. Its 52-bone rig passed
current anatomy/weight checks. The native worker now also completes after fresh
inference, resolving the previously unverified teardown path.

Applied the same Walking capture to this rig through Studio: candidate
`5ac968201864`, **93.431 s**. Existing candidate `d322292a6fb8` remains available.

| Check | Previous | Fresh local MIA |
|---|---:|---:|
| Loop surface seam, m | 0.000000794 | 0.000000795 |
| Loop velocity discontinuity P95, m/s | 0.200 | 0.188 |
| Interior left stance travel P95, m/s | 0.169 | 0.169 |
| Interior right stance travel P95, m/s | 0.147 | 0.147 |

The result is comparable, not a demonstrated major quality improvement. Interior
stance excludes immediate contact transitions; it is not a whole-cycle skating
metric. Front/back and six walk phases were rendered with original paint and
zero browser console errors. Owner visual acceptance remains pending.

## Attached RaBit paper

Read `2303.12564v2.pdf` (14 pages, main text plus supplementary methods), including
shape/pose/texture equations, reconstruction ablations and local UV layouts.
[Paper](https://arxiv.org/abs/2303.12564) / [code](https://github.com/zhongjinluo/RaBit).

RaBit uses a fixed topology learned from artist-created biped cartoons, a 100-value
shape representation, 23-joint linear blend skinning and a learned UV generator.
Its part-sensitive texture branches address local features and its fusion module
addresses seams. This supports separate part review and stable anatomy/UV
contracts. It is not a ready-made arbitrary-mesh rigging replacement: adopting its
template would require a separate fit/retopology path and could discard armor,
tails or identity. No RaBit weights were installed and no RaBit inference is
claimed. Existing source-preserving MIA/fitted workflows remain in use.

## Verification

62 Studio tests pass, including figure isolation, source preservation, stale-source
rejection, multi-figure blocking, engine-specific budgets and fresh-inference
cache bypass. Source syntax, house style, generated mirror and browser results
are stored under `artifacts/reference-integrity`. Failed examples and all timed
runs remain in the local project directories. Publication is recorded on tracker #1.
