# Development log

## 2026-10-20 — R2.6 Mobile Edition

- Initialized independent TARS repo workflow.
- Added standalone touch-compatible browser demo without dependencies.
- Maintained R2.4 locked baseline **as a reference only**; original source has not been imported.
- Pending PR merge, GitHub Pages enablement and device testing.

## 2026-10-20 — R2.7 Mobile UX iteration
- Expanded immersive mobile stage to viewport height while keeping 1020×600 canvas aspect ratio intact (letterboxing where necessary).
- Settings converted to collapsible details panel.
- Restored background processing/telemetry feed behind the canvas.
- Audio defaults ON and volume 100%; browsers may require first interaction to unlock Web Audio and speech.
- Added sparse procedural audio cues for blinking, movement, touch, proximity, processing, scan, giggle and rumble.
- Introduced engagement/excitement/irritation state with slower escalation, gradual cooldown, and mood-based approach/avoidance.
- Added pointer-enter expression and sound feedback.
- Validated inline JavaScript syntax; browser/device QA still required.
- Based on repository R2.6 adaptation; original in-chat prototype not imported byte-for-byte.

## 2026-10-20 — R2.8 Idle Curiosity / Response Bank
- Slower irritation, anger, dizziness, and wobble recovery.
- Autonomous randomized idle actions: looking, wandering, pondering, blinking, resting, curious investigation.
- 20 randomized lines for each of seven mood categories (140 total): neutral, happy, curious, suspicious, angry, dizzy, sleepy.
- Curious asymmetrical eye opening/tilt, gaze and curved approach.
- Removed background grid; small left-aligned stacked telemetry restored as a visible overlay.
- Referred to the repository R2.6 design language; exact original in-chat R2.6 frame source unavailable, so not claimed as a literal match.
- JavaScript parse check passed; device/browser behavior QA pending.

## 2026-10-20 — R2.9 Portrait / Tilt / Single Frame
- Responsive canvas backing-store with uniform 1020×600 scene transform; face geometry is never stretched.
- Portrait screen fills nearly the available viewport while retaining bottom scroll access to controls.
- Removed the inner canvas border; single outer frame. Processing telemetry overlays same frame and scrolls to newest entries (up to 60 lines).
- Opt-in DeviceOrientation tilt via ENABLE TILT; requests iOS permission on click, gracefully handles unsupported devices.
- Tilt influences gaze and drifting behavior without replacing pointer/drag interactions.
- Syntax checked via JavaScript parser; physical phone sensor and layout QA pending.

## 2026-10-20 — R2.10 Full Canvas / Gravity Tilt / Engine Trace
- Portrait canvas now uses the entire frame backing store as an interactive scene; uniform world scale preserves eye/ring proportions while worldTop/worldBottom extend available movement vertically.
- Tilt uses calibrated relative orientation, weaker vertical force, mood-weighted gravity impulses, short burst then recalibration and release; sustained extreme tilt can trigger dizziness/irritation.
- Terminal is dimmed to 36% opacity and randomized variable-length synthetic technical traces plus actual engine state labels.
- Inline JS parser check passed. Device QA remains necessary, especially iOS sensor permission and extreme portrait sizes.

## 2026-10-20 — R2.11 Gravity Bounce / Organic Terminal / Expressive Speech
- Stronger lateral tilt fall and damped collision bounce; variable fast/slow spring recovery, mood-weighted inertia, weaker vertical tilt.
- Gyroscope automatically enabled where browser permits; iOS permission-gated browsers retain a tap-to-enable path.
- Terminal trace cadence now bursty, quiet or rapid depending on interaction/gyro/mood; mixed-length lines.
- Expanded idle dialogue with longer, expressive, mood-specific lines; browser SpeechSynthesis pacing and pitch vary with mood (not ChatGPT-generated live speech).
- JavaScript parse verified; physical device/browser QA outstanding.

## 2026-10-24 — R2.12 Physics Body v1 (experimental)
- Introduced independent body physics displacement and velocity, separated from route target.
- Gyro drives gravity force; inertia, damping, collision clamping, randomized restitution and spring-to-center recovery drive physical response.
- Idle route is paused during active physics, with existing neck/ring springs preserved. RESET clears physics.
- JavaScript syntax validated; mobile/browser runtime testing not performed. R2.11 remains recoverable in Git history.

## 2026-10-24 — R2.13 Neck-first dynamics and kitten personality
- Ring 1 + ring 2 are the coupled neck, limited to 13 logical units apart. Eye-center may move only ~68 units relative to outer ring, equivalent to approximately half an eye reaching ring boundary. Normal movement pulls neck behind eyes; tilt moves neck first and constrains eyes to follow.
- Neck outer ring serves as visible tilt collision boundary with damped recoil.
- Introduced slowly changing joy, stress, boredom, sulking and play interactions. Gentle drags improve affection; rough prolonged shaking increases stress. Mood transitions evaluated at slower intervals; sulking blocks immediate cheerful expressions.
- Inline JS syntax validated. Physical device/browser behavior QA pending. R2.12 preserved in Git history.

## 2026-10-24 — R2.14 Contextual Expressive Speech
- Mood-sensitive browser SpeechSynthesis profiles with light pitch/rate variation and English local-voice preference where available.
- Event-aware speech pools for tap, gentle pet, rough play, sulking, boredom, tilt, and balance recovery. Per-event repetition avoidance and global cooldown.
- Existing status/log/terminal UI retained. Audio remains browser TTS (not generative voice). JavaScript syntax validated; physical-device and voice runtime QA pending.
