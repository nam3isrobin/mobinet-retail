# Mobinet Retail — Scrollcraft Brief

**Interviewed, not self-authored.**

---

## Interview Answers (Verbatim)

### Q1: Vibe (3–5 words + references)
Clean industrial muscle.
References: Blade Runner 2049, Bang & Olufsen showroom.

### Q2: Scroll journey
Hero showcase → Product categories → Featured deals → Brand story → Why us → CTA.

### Q3: Energy curve
Calm open → builds intensity through products → peaks at deals/offers → calm close.

### Q4: Feeling & the ONE moment
"I felt like I walked into the most premium tech store that ever existed."
The moment: a flagship phone rotates and reveals its internals.

### Q5: One thing no site does
Products physically react to my cursor, like I'm touching them through the screen.

### Q6: Aesthetic range
Premium-minimal: clean, restrained, lots of negative space.

### Q7: Structure
One unbroken world: a continuous camera flight through a single environment.

### Q8: Existing assets
Nothing. Fully generated world.

---

## The Journey (6 beats)

```
1  Arrival        The visitor enters a dark, vast tech showroom. Silence and scale.
2  Discovery      Product categories materialise as the camera drifts through zones.
3  Desire         The flagship phone rotates — its internals exposed, circuits glowing.
4  Trust          The brand story grounds the spectacle: who Mobinet is, what they stand for.
5  Proof          Social proof, service guarantees, delivery promise. Rapid, factual.
6  Commitment     One CTA. The showroom narrows to a single lit counter.
```

---

## Feeling Curve

| Act | Emotion     | Cause                                                                        |
|-----|-------------|------------------------------------------------------------------------------|
| 1   | Awe         | Dark void opens into an enormous showroom; camera drifts forward slowly      |
| 2   | Curiosity   | Distinct product zones emerge from shadow; devices catch light individually  |
| 3   | Desire      | **PEAK.** Phone rotates, back panel lifts, internals glow. Longest hold.    |
| 4   | Intimacy    | Camera settles. Quiet type tells who Mobinet is. Scale drops to human.       |
| 5   | Confidence  | Rapid stagger of proof points. Facts, not feelings. Short, factual beats.   |
| 6   | Resolve     | Showroom narrows to one lit counter. The world has arrived at a destination. |

**Adjacent check**: Awe → Curiosity → Desire → Intimacy → Confidence → Resolve. No two adjacent acts share the same emotion. ✓

---

## The Peak

> The screen is dark, and then a phone rotates and its back lifts off and you can see every circuit inside it glowing.

Act 3 (Desire). It receives:
- The highest-fidelity generated asset (macro product shot + camera move).
- Preceding silence: Act 2 ends quiet, camera settling into stillness.
- The largest scroll span on the page (longest `data-sc-linger` / leg weight).

---

## Tell-Someone Sentence

> "It's the site where you walk through a tech showroom and the products react to your hand."

---

## Authored Silence

- Between Act 2 → Act 3: A brief empty-ground moment (0.3–0.5s of pure dark showroom floor) before the phone reveal begins. This is deliberate anticipation, not dead scroll.

---

## Grammar: Continuous World (§2.4)

The interview chose "one unbroken world." This maps directly to the **Continuous World** grammar, which requires `worldflight` mode.

### Why the other 7 lost

| Grammar              | Why it lost                                                                                      |
|----------------------|--------------------------------------------------------------------------------------------------|
| Filmic one-shot      | Uses act-based blocks with seam edges. The interview asked for one continuous place, not acts.    |
| Chaptered editorial  | A printed publication. Tech retail is not a magazine feature.                                     |
| Live surface         | Requires a working product interface. Mobinet is a retail store, not a SaaS tool.                |
| Typographic poster   | No media, typography-only. Contradicts the need for product visuals and showroom immersion.       |
| Gallery / catalog    | Lateral drift walkable collection. Close, but lacks the continuous environment flight.            |
| Split stage          | Two-column comparative tension. No comparative argument exists here.                             |
| Rhythmic cutlist     | Rapid hard cuts. Contradicts the calm, continuous, premium-minimal vibe.                         |

### Continuous World grammar rules applied

- **Worldflight mode** (`data-sc-mode="worldflight"`): 1 fixed stage, 1 spacer, crossfading legs.
- **No section blocks**: Copy exists in a fixed overlay layer.
- **No `drift`**: One continuous authored grade.
- **Nav**: Interactive waypoint list with position markers.
- **Hero**: Establishing camera inside the world.
- **Close**: Physical arrival at a destination; CTA is an object in the environment.

---

## Signature Move: Haptic Cursor Field

When the visitor's pointer enters product zones during copy windows, the product imagery responds with a physics-driven micro-tilt and luminance bloom, as if the cursor exerts a magnetic proximity field on the objects through the screen. Implemented as custom inline JS reading `--sc-mx` / `--sc-my` from `data-sc-spotlight` and applying `transform: perspective(800px) rotateX() rotateY()` plus a radial gradient highlight anchored to cursor position on dedicated product overlay elements.

This is NOT a standard `data-sc-tilt` recolor. The interaction:
1. Operates on worldflight copy-layer product callout cards (not the stage itself).
2. Adds a luminance bloom (radial gradient from cursor coords) that physically follows the pointer.
3. Only activates within specific copy windows when products are narratively present.
4. Gated to `@media (hover: hover) and (pointer: fine)`.

**The test**: Describing "products react to my cursor with a light bloom that follows my hand" cannot be confused with standard tilt cards or spotlight backgrounds.

---

## World: Nocturne (modified toward showroom)

Style preamble (verbatim for all prompts):

```
Photographic, cinematic. Shot on 35mm anamorphic lens, shallow depth of field.
Dark premium tech retail showroom interior, polished concrete floors reflecting
practical LED accent lighting. Controlled warm key light from recessed ceiling
spots, cool blue-white ambient fill from product display cases. Deep shadow
falloff, wet-look reflective surfaces, visible film grain. Color grade: deep
charcoal blacks, cool steel blue mid-tones, warm amber product highlights.
NOT 3D render, NOT clay, NOT illustration, NOT CGI, no digital glow, no neon
oversaturation. Matte film grain, true blacks, anamorphic bokeh on point lights.
```

This is a **Nocturne** base (practical lighting, wet reflective surfaces, deep blue-black shadows, warm point highlights) adapted toward a premium showroom rather than street/nightlife.

---

## Worldflight Score

| Leg | Weight | Camera Move                                           | Copy Window          | Feeling    | Product Zone                    |
|-----|--------|-------------------------------------------------------|----------------------|------------|---------------------------------|
| 1   | 1.0    | Slow dolly-in through dark showroom entrance           | `hero` (0–0.62)     | Awe        | None (establishing shot)        |
| 2   | 1.2    | Drift right past illuminated display shelves           | `0.15 0.55`          | Curiosity  | Phones, laptops, audio gear     |
| 3   | 1.6    | Close orbit around flagship phone, back panel lifts    | `0.10 0.70`          | **Desire** | Flagship phone (peak)           |
| 4   | 0.8    | Settle into quiet alcove, camera slows                 | `0.20 0.75`          | Intimacy   | Brand story wall                |
| 5   | 0.6    | Gentle drift past trust signals (signage, badges)      | `0.10 0.80`          | Confidence | Service/delivery proof          |
| 6   | 0.8    | Camera arrives at a single lit counter                 | `finale` (0.4–hold) | Resolve    | CTA counter                    |

**Total weight**: 6.0 → Spacer = (6.0 + 1) × 100vh = 700vh.
**Pacing check**: Rate ≈ weight / 5s clip. Legs 1–3 at ~0.20–0.32 vh/s, Legs 4–6 at ~0.12–0.16 vh/s. The slowdown into intimacy/resolve is deliberate.

**Peak allocation**: Leg 3 has weight 1.6 (largest by visible margin). Leg 2 ends quiet before it. ✓

---

## Fingerprint Gate

First build. Registry empty. Gate clears trivially. Row to append after shipping:

| Build | Grammar | Nav | Hero | Act-Sequence | Close | Signature | World | Port |
|---|---|---|---|---|---|---|---|---|
| Mobinet Retail | Continuous World | Waypoint list | Establishing dolly into showroom | 6 legs, 6.0w, ~12vh | Arrival at lit counter | Haptic cursor field (bloom + tilt on product callouts) | Nocturne-showroom | 4500 |

---

## Assets Required

| Asset | Type | Prompt Summary | AR |
|---|---|---|---|
| `leg1.mp4` | Camera move | Slow dolly into dark showroom entrance | 16:9 |
| `leg2.mp4` | Camera move | Drift right past display shelves with devices | 16:9 |
| `leg3.mp4` | Camera move | Close orbit around flagship phone, back lifts | 16:9 |
| `leg4.mp4` | Camera move | Settle into quiet alcove with brand signage | 16:9 |
| `leg5.mp4` | Camera move | Drift past trust badges and service signage | 16:9 |
| `leg6.mp4` | Camera move | Arrive at single lit service counter | 16:9 |
| `p1–p6.webp` | Poster stills | Extracted from each encoded leg's first frame | 16:9 |
| `chain1–5.png` | Seam frames | Extracted from each encoded leg's last frame | 16:9 |

6 clips × 160 credits = 960 credits + 6 stills for start images × 28 = 168. **Total: ~1,128 credits.**
