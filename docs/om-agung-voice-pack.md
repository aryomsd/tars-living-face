# MORC_ / Om Agung voice pack

This manifest maps ten **owner-generated** MP3 voice files to personalized events. **The audio files have NOT been uploaded.** Until present, MORC falls back to browser speech synthesis. Do not publish this as a finished voice pack until the files are supplied and verified.

## How to deliver

Generate 10 clips using the exact `text` in `manifest.json`, then export MP3. Name files exactly as the manifest's `file` values and commit them to `audio/guests/om-agung/` on the published branch. Ensure `Om` is pronounced as Indonesian *om*, not the letters O-M. Suggested voice: dry, witty, raspy, robotic British-influenced delivery. Avoid long silences at clip boundaries.

## Behavior

- START GREETING: chime then greeting (01)
- Idle: picks available idle/question/roast/compliment clips, avoiding recent repeats; 22–47s cooldown
- PROVOKE: provoke clips
- JOKE: roast clips
- COMPLIMENT: compliment clips
- GREET: greeting
- Missing or failed clips: browser TTS fallback
- The pack only activates when guest name is `Om Agung` (case-insensitive). Other names retain generic TTS.

## Verification checklist

1. Verify each MP3 loads with HTTP 200 and plays in a real browser.
2. Check greeting chime and spoken name on desktop and mobile after user interaction.
3. Confirm no speech overlap and no clipping on rapid actions.
4. Confirm missing clips safely fall back to TTS.
5. Confirm existing eye physics and Audio Director remain unchanged.

No external API key is needed at runtime: clips are static files hosted with GitHub Pages.
