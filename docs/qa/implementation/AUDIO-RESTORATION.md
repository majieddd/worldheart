# Audio restoration and material sound retry

Active 2026-09-15. Owner: Codex, `feature/audio-restoration`.

| Item | State | Scope |
|---|---|---|
| U140 | Active | Restore every pre-revamp runtime, asset and audio UI change; verify and publish V2 |
| U141 | Planned | Research and build a separate warmer material-based comparison, with instrument-only music |
| U142 | Open | Owner listening acceptance; do not treat classifier scores as proof of no vocals or pleasant sound |

The owner rejected U136-U139 after listening: vocals, sharp/tinny effects and
static-like ambience. This supersedes its prior automated acceptance. Those
records are retained as historical machine checks, not evidence of sound quality.
The previous audio at `c872a07` is the restoration target. Gameplay/mobile work
predating the sound pass remains intact. Main is not a publication target.

The retry takes inspiration from Tears of the Kingdom's material texture,
satisfying repeatable interactions, space and believable distance. It will not
copy Nintendo recordings or melodies. The restored game remains the default;
the new direction must be separately auditionable before another broad replacement.

Rollback local verification: 334 tests, 96 source modules, style gate, all 106
default runtime assets matching c872a07, generated mirrors and six browser
checks on the reported Io/seed configuration pass. The fixture followed the
world inspector's Play this seed link to its actual start controls. V2 publication
is next. Retained local fixture failures were a stopped server and an attempt
to press the hidden Begin button while still in the world inspector.
