# MiniMax H3 motion-guide pilot

One 12-second H3 generation was submitted through Higgsfield, job
982ded50-f89b-483d-9048-d39dbfbba6d5 (24-credit preflight). Output is 12.25 seconds,
294 frames at 24 fps, 2560x1440. Input was the existing Vey hero image, byte-identical
to project 3f18e4dbc375's hero. The provider's current model documentation is
https://platform.minimax.io/docs/guides/video-generation . H3 Max is a separate
faster variant; this pilot used H3.

Studio imports the real MP4, stores actual prompt/job/source/video hashes, produces
12 timestamped samples, and supports slow playback and independent reference review.
All shape/paint/motion/polish fields and approval values were compared before/after
the import and retained. The clip is reference-review pending. Sampled frames
preserve the main design, but the strike occurs earlier than requested. No full
visual acceptance or video-driven skeletal retargeting is claimed.

78 Studio tests pass, including stale-reference rejection, preservation of animation
approval, malformed video cleanup and ZIP inclusion of both T-pose/video guides.
Actual browser playback advanced at half speed; desktop and 390px mobile checks
passed without console errors or horizontal overflow. Evidence is in
artifacts/reference-integrity/minimax-ui and minimax-import-receipt.json.

The previous Siria ZIP storage blocker is resolved: the package was rebuilt,
237072284 bytes, CRC and downloaded/local SHA checks passed, final GLB remains
byte-identical to its reviewed animation. Rebuilding exposed and fixed a guide
packaging indentation regression; the new positive export test covers it.

Local review: http://127.0.0.1:8773/?project=3f18e4dbc375#motion-video-guide
Remaining work: owner motion review, a separately validated video pose extraction
and retarget adapter, and an optional authenticated generation integration. The
current tool downloads a brief and imports the resulting video; it does not claim
one-click MiniMax generation. Existing local inference stays available.
