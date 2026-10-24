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

## 2026-10-24 — R2.15 Emergent Personality (experimental)
- Added session-scoped trust, play drive, caution, curiosity, confidence, recent event history, and pointer awareness.
- Gentle interaction grows trust; rough interaction grows caution. Pointer taps stimulate play drive.
- Weighted behavior decisions choose approach, retreat, investigate, play, rest, or observe based on recent context and temperament. Behaviors use existing route/face/expression/voice engines.
- RESET clears persona. No persistence or machine learning claimed. JavaScript syntax validated; browser runtime QA pending.

## 2026-10-24 — R2.16 Living Depth
- Added spring-driven simulated Z-axis depth, scale range approximately 0.62–1.46, applied as a single shared canvas transform to both eyes and both neck rings.
- Personality decisions drive depth approach/retreat/play/rest/investigate. Gentle interaction brings face closer; stressful interaction retreats.
- Depth changes are visual-only; 2D pointer hit testing and neck/edge collision remain in original logical coordinates. This limitation requires device QA, especially at large scale.
- JavaScript syntax validated; browser and device QA pending.

## 2026-10-24 — R2.16.1 Neck tether and edge rebound hotfix
- User visual reference revealed excessive eye-to-ring separation. Tightened tether to 38 logical units and made correction full-strength; fall mode clamps eyes to outer ring.
- Edge collisions use outer-ring radius scaled with Z depth; neck/eyes translated together on contact. Increased body restitution (horizontal ~0.65–0.85; vertical 0.70) and added stronger visual impact cues.
- JavaScript syntax check passed. Device/visual QA not performed; edge behavior requires user verification.

## 2026-10-24 — R2.17 Depth Distribution & Emotion Escalation
- Depth scaling widened from approximately 62–146% to 16–184% absolute envelope; ordinary sampled goals remain near neutral (depth -0.34..+0.34), with occasional personality-led excursions toward ±0.9. Visual scale now 1+0.84*z. Rare extremes; spring unchanged.
- Mood reassessment 11s → 16s (~45% slower); typical expression holds extended ~40%. Personality decision interval increased to 3.8–7.2s.
- Repeated PROVOKE and sustained extreme tilt escalate annoyed → angry → confused → dizzy, with a 20s quiet reset. Dizzy no longer appears on first sustained tilt; stronger angled eye geometry added for annoyed/angry/confused.
- JS syntax check passed; real browser/gyro/visual QA pending. Note Z scaling at very close distances can crowd the screen; collision uses scaled ring radius.

## 2026-10-24 — R2.18 Canvas-relative Z extremes
- Replaced fixed Z scale with depthScale() based on the shorter logical canvas side. Outer ring/tick diameter (328 units) maps to 10% at z=-1, 55% at z=0 and 80% at z=+1. All ring rendering and collision radius share this scale.
- Increased occasional approach/retreat depth targets toward ±1; ordinary depth sampling remains concentrated near center. Mood and escalation logic unchanged.
- JS syntax check passed. Browser/device QA pending; small viewports and scale extremes should be verified.

## 2026-10-24 — R2.19 Expressive Z Antics
- Contextual depthGesture state machine with cooldowns and independent spring presets (fast jump, slow intimidation, slow shrinking).
- Playful pointer proximity can trigger two-phase Z pounce or rare BOO surprise, with a cursor-directed XY slingshot for pounce.
- Provocation escalation can trigger slow looming/intimidation or deep dizzy retreat. Fearful retreat can trigger hide. Existing normal center-biased Z remains default.
- Gesture cooldown roughly 11–22 seconds, BOO 23–43 seconds. JS syntax validated; real browser/device interaction QA pending.

## 2026-10-24 — R2.20 Cinematic Synthetic Voice
- Added original Hollywood-inspired cinematic dialogue pools for BOO, pounce, intimidation, hide, dizziness, confusion, anger, curiosity and play, with event-specific triggering and speech cooldown.
- Browser SpeechSynthesis still used (no copyrighted film samples, no actor voice clone); shifted mood-dependent English TTS pitch/rate toward dry, understated delivery. Actual timbre varies by OS/browser installed voice.
- Syntax check passed; audio quality, voice availability and browser-device QA pending.

## 2026-10-24 — R2.21 Bumblebee Voice Library
- Added manifest-driven HTML Audio clip playback prioritized over browser TTS by event/mood, recent-clip avoidance, interruption behavior and TTS fallback.
- Empty manifest intentionally ships without unlicensed Hollywood clips; see docs/voice-library.md for adding cleared assets.
- JavaScript syntax check passed. Playback/browser/mobile QA pending.

## 2026-10-24 — R2.22 First Real Recorded Voice Clips
- Added three rights-cleared Wikimedia Commons speech clips to audio/manifest.json: two CC0 Boo variants (Dinoroki, EyobAbebe10) and a VOA US-public-domain Hello everyone greeting.
- Added a strict Commons Special:Redirect/file OGG source allowance to the voice loader. The existing TTS fallback remains in place.
- PlayPhrase movie/TV excerpts deliberately not imported: its stated educational/personal permissions do not authorize standalone public clip libraries and no API is provided.
- JS syntax validated. Network playback / redirects / Android autoplay remain UNVERIFIED; remote Commons URLs may be blocked by browser or provider. No claim of Hollywood recordings.

## 2026-10-24 — R2.23 Elastic Kinetics
- Neck inner/outer ring springs loosened (6.6/.69 and 4.7/.64), ring separation 13→19, face tether 38→43 for residual elastic bounce without long-tail behavior.
- Ring rendering adds bounded local elliptical deformation and subtle rotation from relative ring/face velocity and Z velocity, including tick marks.
- Z-axis now uses shared XY-named kinetic profiles (sleepy/sluggish/lazy/normal/active/fast/snappy/dragging), with explicit gesture overrides, three physics substeps, bounded velocity and damped boundary rebound.
- JS syntax validated. Live device visual QA not yet performed; tune deformation and spring constants after user feedback.

## 2026-10-24 — R2.24 Behavior Orchestrator
- Introduced centralized `behaviorProfiles` and `orchestrate(action, opts)` expression packages coordinating eye shape, XY movement speed/path, Z goal, optional contextual voice.
- Integrated autonomous choices (observe/investigate/approach/retreat/play/rest) with personality trust, curiosity, play drive, caution, stress and bounded cooldown.
- Explicit GREET, JOKE, COMPLIMENT and escalating PROVOKE stages can request priority coordinated profiles; legacy gestures and direct tactile/gyro responses remain intact.
- Protect active dragging, body impacts, existing Z gestures and sulking from unsolicited autonomous overrides; voice probability remains low.
- JS syntax PASS; visual/browser/mobile behavioral QA pending. This is first-stage orchestration, not a full rewrite of legacy mood/event logic.

## 2026-10-25 — R2.25 Quiet Microbehaviors
- Added non-verbal micro-ticks: subtle glances, side-eye, small eye tilt, squint, sleepy droop, blink and intentional pauses. Bounded offsets (~2–7px), eye tilt (~0.04–0.075rad), short holds and quiet gaps.
- Suppress micro-ticks during drag, body impacts, active Z gestures and sulking. No extra voice or large body travel from ticks.
- Reduced autonomous decision cadence and idle roaming; most unattended decisions now remain in place and cue a small eye tick instead. Reduced unsolicited BOO/pounce odds while preserving explicit commands and interactive responses.
- JS syntax PASS; browser visual QA pending. Tune subtlety and animation cadence from live feedback.

## 2026-10-25 — R2.26 Local Audio Starter Integration
- Added LOAD AUDIO multiple-file input for local WAV/OGG/MP3, TEST CLIP playback, count status and event/mood mappings for 12 original starter effects.
- Local files stay in browser memory as object URLs; nothing is uploaded or persisted. Existing remote clip manifest/TTS remains fallback.
- Installation: download `tars_audio_starter_v1.zip` from ChatGPT, extract it, click LOAD AUDIO on live TARS and select all 12 WAVs from `audio/`. Click TEST CLIP; trigger GREET, JOKE, PROVOKE, SCAN to exercise routing. Browser audio activation requires interaction.
- Syntax check PASS. Live visual/audio QA pending. No copyrighted movie clips uploaded.

## 2026-10-25 — R2.27 Ring Style Options
- Removed R2.26 local audio WAV loader and TEST CLIP experiment; original voice manifest and speech fallback remain unchanged.
- Added RINGS selector in Settings: CLASSIC, MINIMAL, DASHED, TARGET, NONE. NONE hides both animated circles but retains eyes and physics. Ring rendering continues to follow depth and motion.
- JavaScript syntax PASS. Visual browser QA pending.

## 2026-10-25 — R2.28 Organic Eye Engine
- Replaced per-expression eye shape switches with one continuously morphed cubic Bézier contour per eye.
- Spring-damped width, height, lean, bulge, and horizontal offset channels; independent per-eye response and movement-triggered squash/stretch.
- Existing expression states supply continuously interpolated target parameters; original eye colors, motion, rings and behavior retained.
- JavaScript syntax PASS; live visual/browser QA pending.

## 2026-10-25 — R2.29 Eye Shape Rework
- Removed slanted Bézier/squash-centric eye contours. Continuous spring interpolation now drives superellipse roundness, independent top arch and bottom smile contours, plus height/width. No eye rotation.
- Reduced autonomous positive depth maximum from .34 to .17 (~50%); halved positive behavior-driven depth targets. Explicit dramatic proximity gestures retained.
- JS syntax PASS. Browser visual QA pending.

## 2026-10-25 — R2.30 Restore Original Eyes
- Restored exact R2.25 drawEye implementation; removed R2.28/R2.29 organic eye morphing engine and update call.
- Kept R2.27 circle-style selector and R2.29 smaller autonomous face depth.
- JS syntax PASS; browser QA pending.

## 2026-10-25 — TARS Social Community v1 (approved concept; not implemented)
- Preserve R2.30 original eye renderer and existing physics, ring choices, and smaller default face.
- Each user owns a unique persistent TARS personality, identity, and encounter history; support later backup, transfer, and export/import.
- Cross-platform focus: Android/iPhone first, with tablets and laptops. Opt-in GPS discovery shows active, discoverable nearby TARS as small animated background visitors; GPS is NOT a 50 cm ranging solution.
- Proximity candidates require confirmation before relationship upgrades. Optional BLE/native proximity, UWB-compatible ranging, or QR pairing can support close encounters; network transports carry interaction messages.
- TARS background characters can peek, wander, greet, or avoid according to mood, personality, and relationship; keep main face dominant and limit background crowding.
- Community tiers: Tier 1 Stranger (never confirmed close), micro size, 20% opacity; Tier 2 Acquaintance (confirmed near, no nudge), small, 30%; Tier 3 Familiar (nudged, no jump), medium, 50%; Tier 4 Visitor (has jumped), larger, 60%; Tier 5 Bestie (special mutually approved relationship), large, 80%. Suggested relative sizes: 20/35/50/70/90% of maximum background avatar; sizes subject to visual tuning.
- Relationship tier persists after devices separate; live presence and distance are separate states. Do not expose precise coordinates to other users.
- Owner can request a jump; TARS can independently ask to visit based on mood. Initially require acceptance. Besties may have privileged spontaneous visit requests, subject to owner controls.
- On approved visit, guest TARS disappears from its home canvas and appears alongside host TARS on target canvas. Home shows Away Visiting. On RETURN, disconnection, timeout, or confirmed separation, guest returns home. Prevent duplicate active instances and preserve relationship memories.
- Near-field target around 50 cm is aspirational: BLE RSSI is noisy; use hysteresis/debounce and do not promise centimeter precision. Browser mobile location/background scanning has platform limitations; use freshness timeouts.
- Suggested roadmap: P1 persistent identity/personality; P2 pairing, social messaging, jump/return lifecycle; P3 opt-in GPS social radar and background tier rendering; P4 proximity bridge and device testing.
- Potential backend: Cloudflare Workers / Durable Objects, pending technical validation.
- This entry records product requirements only; no new feature implementation or live proximity tests.
