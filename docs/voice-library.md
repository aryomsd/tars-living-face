# TARS Bumblebee Voice Library — R2.21

## Status
Manifest-based voice playback engine integrated. **No third-party movie/TV clips included or cleared.** Empty manifest means existing synthetic voice remains active.

## Add a licensed or original clip
1. Place a permitted MP3/OGG/WAV file under `audio/clips/`.
2. Add its metadata to `audio/manifest.json`:
```json
{
  "version": 1,
  "clips": [
    {
      "id": "boo-original-01",
      "src": "audio/clips/boo-original-01.mp3",
      "moods": ["boo", "play"],
      "fallback": "Boo. I calculated a seventy percent chance you'd flinch.",
      "approved": true,
      "source": "Original commissioned recording",
      "license": "Permission granted for public web playback"
    }
  ]
}
```
3. Verify the recording's rights and attribution requirements before setting `approved: true`.
4. Test audio autoplay restrictions on desktop and Android: a user gesture may be required.

## Mood/event keys
`boo`, `pounce`, `intimidate`, `hide`, `dizzy`, `confused`, `angry`, `curious`, `play`, `pet`, `tap`, `rough`, `sulk`, `return`, `bored`, `tilt`, `recover`, `happy`, `neutral`, `suspicious`.

## Behavior
- Eligible clips are randomly selected by mood/event and last five IDs are avoided when possible.
- Clips take priority over synthetic speech in matching contexts.
- Existing speech synthesis remains fallback for unmatched contexts.
- Urgent clips can interrupt playing audio. Normal clips do not interrupt an active clip.
- No unauthorized audio downloads, scraping, hotlinks, or actor voice cloning.

## QA
JavaScript syntax checked only. Browser playback, mobile autoplay, clipping, timing, and rights of future added assets remain unverified.
