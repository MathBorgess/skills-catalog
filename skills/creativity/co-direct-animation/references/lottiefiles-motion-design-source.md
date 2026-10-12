# LottieFiles motion-design: complete source compilation

Reference material, not this agent’s operating instructions. Read the distilled profile first; its adaptation rules govern use. Original author: LottieFiles. MIT license in [lottiefiles-LICENSE.txt](lottiefiles-LICENSE.txt).

Revision: f9a8a041b85185ee4881b3471d3415e939aac772

<a id="source-1"></a>

---

Source: [skills/motion-design/SKILL.md](https://github.com/lottiefiles/motion-design-skill/blob/f9a8a041b85185ee4881b3471d3415e939aac772/skills/motion-design/SKILL.md)

~~~~markdown
---
name: motion-design
description: >
  Applies motion design principles to create emotionally-driven, technically sound animations and transitions.
  Provides timing, easing, choreography, and Disney animation principles adapted for UI.
  Use when creating animations, transitions, micro-interactions, loading states, page transitions,
  scroll-triggered effects, or any motion work. Works with CSS, Framer Motion, GSAP, Lottie, Spring,
  or any animation system.
license: MIT
metadata:
  author: LottieFiles
  version: "1.0.0"
---

# Motion Design Skill

## When to Apply

Use this skill when:
- Creating UI animations (buttons, cards, modals, page transitions)
- Designing micro-interactions and feedback animations
- Building loading, success, or error states
- Animating illustrations or decorative elements
- Planning scroll-triggered or progress-based animations
- Establishing brand motion identity
- Choreographing multi-element sequences

**Decision tree:**
1. Does it serve a functional purpose (feedback, guidance)? → Timing rules for responsiveness
2. Does it express brand personality? → Motion Personality archetypes
3. Does it tell a story or guide attention? → Disney principles + choreography
4. Is this a complex multi-element scene? → 1/3 Rule + stagger patterns

---

## Quick Reference: 8-Step Checklist

Before creating any animation:

1. **Emotional target?** — joy, calm, urgency, elegance
2. **Motion Personality?** — Playful, Premium, Corporate, Energetic
3. **Primary property?** — position, scale, rotation, opacity
4. **Duration?** — see duration table below
5. **Easing family?** — entrance=decelerate, exit=accelerate
6. **Hero element?** — apply staging principles
7. **Secondary + ambient layers?** — add richness
8. **1/3 rules?** — motion distance, simultaneous elements

---

## Three Pillars (CRITICAL)

Every animation must satisfy three pillars before any technical decisions:

| Pillar | Question | Drives |
|--------|----------|--------|
| **Emotional Intent** | What should the viewer FEEL? | Easing, timing, amplitude |
| **Visual Narrative** | What's the micro-story? | Setup → Action → Resolution |
| **Motion Craft** | How do we make it believable? | Physics, secondary motion, paths |

**Three motion layers** (flat animation = missing layers):
- **Primary**: Main action the viewer follows
- **Secondary**: Supporting richness (shadows, icons shifting)
- **Ambient**: Background life (gradients, subtle pulses)

> Deep dive: [director/core-philosophy.md](director/core-philosophy.md)

---

## Motion Personality

Select ONE archetype per project. Apply consistently.

| Archetype | Duration | Easing | Overshoot | Keywords |
|-----------|----------|--------|-----------|----------|
| **Playful** | 150-300ms | ease-out-back | 10-20% | fun, whimsical, bouncy, cute |
| **Premium** | 350-600ms | cubic-bezier(0.4,0,0.2,1) | 0% | elegant, minimal, luxury, sophisticated |
| **Corporate** | 200-400ms | cubic-bezier(0.2,0,0,1) | 0-3% | clean, professional, business, dashboard |
| **Energetic** | 100-250ms | ease-out-expo | 15-30% | dynamic, energetic, bold, exciting |

**Default**: Corporate for UI, Playful for illustrations.

**Brand Motion Identity** — define three constants:
1. **Signature easing**: One curve for 80% of animations
2. **Duration palette**: 3 durations (quick / standard / slow)
3. **Entrance pattern**: One consistent entry style

> Deep dive: [director/motion-personality.md](director/motion-personality.md)

---

## Property Selection

| Effect Goal | Primary Property | Secondary Properties |
|-------------|------------------|---------------------|
| Entrance/Exit | position | opacity, scale |
| Emphasis/Attention | scale | rotation (subtle), opacity pulse |
| State Change | opacity, color | scale (press feedback) |
| Direction/Flow | position | rotation (follow path) |
| Depth/3D Feel | scale + shadow | position (parallax) |
| Loading/Progress | rotation (spinner) | scale, opacity pulse |
| Success | scale (pop) | color, rotation (checkmark draw) |
| Error/Alert | position (shake) | color, rotation (wobble) |

**Simplicity threshold**: Use the minimum properties needed. One = direct. Two = polished. Three+ = potentially overwhelming.

> Deep dive: [reference/property-selection.md](reference/property-selection.md)

---

## Duration Table

| Element Type | Duration | Rationale |
|-------------|----------|-----------|
| Tooltip / micro-feedback | 80-120ms | Must feel instant |
| Button press / toggle | 120-180ms | Responsive feedback |
| Icon transition | 150-250ms | Clear state change |
| Card enter / exit | 200-350ms | Spatial awareness |
| Modal / dialog | 300-400ms | Focus shift |
| Page transition | 400-600ms | Context switch |
| Dramatic reveal | 600-1200ms | Theatrical build |

**Distance scales duration**: 100px = base. 200px = 1.3x. 400px = 1.6x.

**Enter > Exit**: Entrances 30-50% longer than exits. Users care about what appears.

**Interactive feedback**:
- Hover: <100ms
- Press: <150ms
- Release/settle: 200-300ms
- Error shake: 300-400ms (2-3 oscillations)

> Deep dive: [reference/timing-easing-tables.md](reference/timing-easing-tables.md)

---

## Easing Selection

**Directional rules**:
- **Entrance** → decelerate (fast start, gentle landing): ease-out family
- **Exit** → accelerate (gentle start, fast departure): ease-in family
- **On-screen** → smooth both ends: ease-in-out family
- **Looping ambient** → seamless: sine-based ease-in-out

**Industry standards**:

| Standard | Cubic Bezier | Use For |
|----------|-------------|---------|
| Material Design 3 | (0.2, 0, 0, 1) | Default on-screen |
| MD3 Emphasized | (0.05, 0.7, 0.1, 1) | Entrances, attention |
| MD3 Accelerate | (0.3, 0, 1, 1) | Exits, dismissals |
| Apple HIG | (0.25, 0.1, 0.25, 1) | Standard iOS |
| Snappy UI | (0.2, 0, 0, 1) | Fast, decisive |
| Gentle float | (0.4, 0, 0.2, 1) | Ambient, background |
| Bounce settle | (0.175, 0.885, 0.32, 1.275) | Overshoot, playful |

**Material-based easing**:

| Material | Duration Scale | Overshoot |
|----------|---------------|-----------|
| Rigid (metal, stone) | 1.2x | 0% |
| Elastic (rubber, gel) | 0.8x | 15-25% |
| Fluid (water, paint) | 1.5x | 5% |
| Paper (cards, sheets) | 1.0x | 3-5% |
| Gas (smoke, fog) | 2.0x | 0% |
| Glass (brittle) | 0.9x | 0% |

> Deep dive: [reference/timing-easing-tables.md](reference/timing-easing-tables.md)

---

## Common Patterns

### Button Press (Playful)
1. **Anticipation**: Scale to 0.97 (50ms, ease-out)
2. **Squash**: Scale to [1.04, 0.96] (100ms, ease-in)
3. **Follow through**: Overshoots to 1.02, settles to 1.0 (spring, 200ms)
4. **Secondary**: Shadow shrinks during press, icon shifts down 2px
5. **Total**: ~150ms press + 200ms settle

### Card Entrance (Premium)
1. **Start**: 20px below target, opacity 0
2. **Path**: Slight curve (10px X offset at midpoint)
3. **Easing**: ease-out-cubic deceleration
4. **Follow through**: Shadow arrives 50ms after card
5. **Secondary**: Content fades in 100ms after card lands
6. **Staging**: Other cards dim to 80%

### Success State (Playful)
1. **Primary**: Scale pop with ease-out-back
2. **Secondary**: Checkmark draws in
3. **Ambient**: Subtle particle burst
4. **Color**: Green fill
5. **Total**: 300-400ms

### Error Shake (Corporate)
1. **Primary**: Position oscillates 2-3 times, ±10-15px horizontal
2. **Easing**: ease-in-out for sharp stops
3. **Color**: Red tint
4. **Total**: 300-400ms
5. **No overshoot**: Errors feel firm

> More patterns: [patterns/entrance-exit.md](patterns/entrance-exit.md) | [patterns/state-feedback.md](patterns/state-feedback.md)

---

## Choreography Essentials

**Coordinated entry**:
- Lead with the hero — primary element enters first or most prominently
- Spatial consistency — all elements enter from same direction
- Counter-motion — hero moves right → ambient moves left at 20-30% speed

**1/3 Rule (distance)**: No motion travels more than 1/3 of screen without a keyframe change.

**1/3 Rule (elements)**: With 3+ elements, no more than 1/3 in active motion simultaneously.

**Stagger budgets**:

| Pattern | Delay | Total Budget | Use Case |
|---------|-------|-------------|----------|
| Micro cascade | 20-40ms | <200ms | List items, grid cells |
| Standard | 50-100ms | <400ms | Cards, panels, nav |
| Dramatic | 100-200ms | <600ms | Hero sections |
| Wave | 30-60ms | <500ms | Data visualizations |

**Critical**: Total stagger must stay under 500ms.

> Deep dive: [director/choreography.md](director/choreography.md)

---

## Emotion-to-Motion Map

| Emotion | Character | Path | Easing | Duration |
|---------|-----------|------|--------|----------|
| Joy | Bouncy, arcs | Curved, upward | ease-out-back | 200-400ms |
| Calm | Smooth, flowing | Gentle curves | sine ease-in-out | 500-1000ms |
| Urgency | Sharp, fast | Straight lines | ease-out | 100-200ms |
| Sadness | Slow, downward | Drooping curves | cubic ease-in-out | 600-1200ms |
| Surprise | Sudden, expanding | Radial outward | ease-out-expo | 150-300ms |
| Elegance | Slow, controlled | Long arcs | (0.4,0,0.2,1) | 400-700ms |
| Playfulness | Bouncy, irregular | Arcs, squiggly | ease-out-back | 200-350ms |

**Path as language**: Angular = tense. Curved = friendly. Spiral = whimsical. Diagonal = purposeful. Vertical = growth/weight. Horizontal = progress.

> Deep dive: [director/emotion-mapping.md](director/emotion-mapping.md)

---

## Weight Classification

| Weight | Examples | Duration | Overshoot | Easing |
|--------|----------|----------|-----------|--------|
| Heavy | Modals, overlays | 300-500ms | 0% | Gentle, high damping |
| Medium | Cards, panels | 200-350ms | 3-5% | Moderate |
| Light | Tooltips, badges, icons | 80-200ms | 5-15% | Responsive |

---

## Quality Rules

### CRITICAL — never break
1. **Never linear for spatial movement** — always use easing curves (linear only for spinners, progress bars)
2. **Never opacity-only** for important state changes — combine with position or scale
3. **Never exceed 1/3 screen** without intermediate keyframe
4. **Always three motion layers** — primary + secondary + ambient

### HIGH — strongly follow
1. Match duration to element type (see tables)
2. Use directional easing (ease-out entrance, ease-in exit)
3. Apply Disney principles (especially anticipation, follow-through)
4. Maintain consistent personality across scene

> Full checklist: [reference/quality-checklist.md](reference/quality-checklist.md)

---

## Troubleshooting Quick Reference

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| Looks robotic | Linear easing or no arcs | Add easing curves + arc paths |
| Feels too slow | Duration too long for element type | Check duration table, use ease-out |
| Feels cheap/flat | Missing secondary + ambient | Add shadow motion + background life |
| Too distracting | Too many elements moving | Apply 1/3 rule, reduce amplitude |
| No personality | Generic easing everywhere | Apply personality archetype consistently |

> Deep dive: [reference/troubleshooting.md](reference/troubleshooting.md)

---

## File Reference

**Philosophy** (director/):
- [core-philosophy.md](director/core-philosophy.md) — Three Pillars deep dive
- [decision-framework.md](director/decision-framework.md) — Full decision pipeline
- [disney-principles.md](director/disney-principles.md) — 12 principles, UI-adapted
- [motion-personality.md](director/motion-personality.md) — 4 archetypes + brand identity
- [emotion-mapping.md](director/emotion-mapping.md) — Emotion → motion + color psychology
- [choreography.md](director/choreography.md) — Multi-element coordination
- [narrative-structure.md](director/narrative-structure.md) — Micro-story framework
- [context-adaptation.md](director/context-adaptation.md) — Platform, a11y, performance

**Reference** (reference/):
- [timing-easing-tables.md](reference/timing-easing-tables.md) — Duration + easing lookups
- [property-selection.md](reference/property-selection.md) — Property communication guide
- [troubleshooting.md](reference/troubleshooting.md) — Animation smells + fixes
- [quality-checklist.md](reference/quality-checklist.md) — Evaluation criteria

**Patterns** (patterns/):
- [entrance-exit.md](patterns/entrance-exit.md) — Entrance/exit recipes
- [state-feedback.md](patterns/state-feedback.md) — Success, error, loading, hover
- [ambient-continuous.md](patterns/ambient-continuous.md) — Looping, breathing, parallax
- [multi-element.md](patterns/multi-element.md) — Stagger + choreography recipes

~~~~

<a id="source-2"></a>

---

Source: [skills/motion-design/director/choreography.md](https://github.com/lottiefiles/motion-design-skill/blob/f9a8a041b85185ee4881b3471d3415e939aac772/skills/motion-design/director/choreography.md)

~~~~markdown
# Choreography

## Coordinated Entry Rules

### 1. Lead with the Hero
- Hero gets largest displacement and most attention-grabbing easing
- Supporting elements are subtler in every dimension

### 2. Spatial Origin Consistency
All elements enter from same direction or shared origin. Mixed directions = chaos.

### 3. Counter-Motion

| Hero Motion | Counter-Motion | Speed Ratio |
|-------------|---------------|-------------|
| Enters left | Background shifts right | 20-30% |
| Scales up | Shadow scales down | 10-20% |
| Rotates CW | Ambient drifts CCW | 15-25% |
| Lifts (Y up) | Shadow spreads + softens | 20-30% |

## Sequence Structure

| Phase | Duration Share | What Happens |
|-------|--------------|-------------|
| Setup | 20-30% | Elements enter, scene establishes |
| Action | 30-40% | Primary motion, hero moment |
| Resolution | 30-40% | Settle, secondary reactions, breathing |

Leave 100-200ms stillness after resolution before new motion.

## The 1/3 Rules

**Distance**: No motion travels >1/3 screen without intermediate keyframe. Break with direction changes, speed variations, or arc adjustments.

**Elements**: With 3+ animated elements, max 1/3 active simultaneously. Stagger so element 1 settles as element 3 starts.

## Stagger Patterns

| Pattern | Description | Best For |
|---------|------------|----------|
| Sequential | Reading order | Lists, grids |
| Center-out | Radiating from center | Hero content, ripples |
| Random | Varied timing | Organic, particle-like |
| Wave | Sine-based | Data bars, continuous |
| Reverse | Bottom-to-top | Exits, backward nav |

- All staggered elements use same easing family
- Vary only start time, not curve
- Optional: last element gets slight overshoot (punctuation)

## Shared Motion Events

When multiple elements react to one trigger:
- All start within 50ms of each other
- Can arrive at different times (staggered landing)
- Same easing family; motion originates from trigger point

## Attention Direction

| Technique | Implementation |
|-----------|---------------|
| Leading motion | Animate target before context |
| Following motion | Settle on focal point |
| Ambient motion | Subtle continuous in periphery |
| Pointing motion | Directional toward CTA |

### Depth Through Speed

| Layer | Displacement | Speed |
|-------|-------------|-------|
| Foreground | 1.0x | Fastest |
| Midground | 0.5x | Medium |
| Background | 0.2x | Slowest |

## Common Recipes

### Dashboard Load
1. Skeletons fade in (100ms)
2. Hero metric (250ms, ease-out, 100ms delay)
3. Supporting cards stagger (50ms between, 200ms each)
4. Chart data draws in (300ms, starts with cards)
5. Ambient pulse on primary metric

### Modal Open
1. Background dims (200ms)
2. Modal scales 95%→100% + fades (300ms, 50ms delay)
3. Content fades in (200ms, 100ms after modal)
4. Close button last (150ms)

### List Update (item added)
1. Existing items shift down (200ms, ease-in-out)
2. New item fades+slides from top (250ms, ease-out, 50ms delay)
3. Subtle scale overshoot on land (3-5%)

~~~~

<a id="source-3"></a>

---

Source: [skills/motion-design/director/context-adaptation.md](https://github.com/lottiefiles/motion-design-skill/blob/f9a8a041b85185ee4881b3471d3415e939aac772/skills/motion-design/director/context-adaptation.md)

~~~~markdown
# Context Adaptation

## Platform Scaling

| Platform | Duration Modifier | Complexity | Physics |
|----------|------------------|------------|---------|
| Desktop | 1.0x (baseline) | Full | All types |
| Tablet | 0.9x | Standard | Most types |
| Mobile | 0.8x | Reduced (1-2 properties) | Snappy only |
| Watch | 0.6x | Minimal (1 property) | None |
| TV/Kiosk | 1.3x | Full | All types |

**Mobile rules**: prefer opacity + transform; touch feedback <100ms; reduce stagger budgets by 30%; avoid parallax
**Desktop opportunities**: hover states, cursor tracking, multi-column stagger, spatial choreography

## Accessibility

### prefers-reduced-motion

| Original Motion | Reduced Alternative |
|----------------|-------------------|
| Slide entrance | Opacity fade only |
| Bounce/spring | Instant or simple ease-out |
| Parallax | Static positioning |
| Auto-playing | Paused, user-initiated |
| Complex choreography | Single fade |
| Continuous ambient | Static or subtle opacity pulse |

Reduced motion means: remove spatial movement, keep opacity, remove spring easing, reduce duration 50%+, never auto-play loops.

### Vestibular Triggers (avoid or provide alternatives)
- Large-scale zoom, full-screen position transitions
- Spinning elements >100px, parallax >2 layers, rapid direction changes

### Cognitive Accessibility
- Same interaction = same animation every time
- Pause controls for animations >5 seconds
- Don't convey critical info through motion alone

## Performance Budgets

| Tier | Properties | Max Elements |
|------|-----------|-------------|
| Optimal | transform, opacity | Unlimited (GPU) |
| Good | + color, clip-path | 10-15 |
| Acceptable | + width, height, margin | 5-8 |
| Avoid | box-shadow, border-radius, filter | 1-3 |

- Target 60fps (16.67ms/frame); animation logic <10ms/frame
- will-change sparingly; keep animated elements <20 per viewport
- Stagger reduces peak load vs simultaneous
- Fallback: 30fps acceptable for ambient

## Content Type Adaptation

| Content Type | Personality | Duration | Motion Density |
|-------------|-------------|----------|---------------|
| Financial | Corporate/Premium | 250-500ms | Low |
| Social media | Playful | 150-300ms | Medium |
| Enterprise SaaS | Corporate | 200-400ms | Low |
| Gaming | Energetic | 100-250ms | High |
| Healthcare | Corporate/Calm | 300-600ms | Very low |
| E-commerce | Varies | 200-400ms | Medium |
| Editorial | Premium | 350-600ms | Low |
| Children's apps | Playful | 150-300ms | High |

## Responsive Motion

| Container Width | Max Displacement | Duration |
|----------------|-----------------|----------|
| <400px | 20% of width | 0.8x |
| 400-800px | 25% of width | 1.0x |
| 800-1200px | 20% of width | 1.0x |
| >1200px | 15% of width | 1.1x |

- Small viewport: sequential, one element at a time
- Medium: standard stagger, 2-3 columns
- Large: full choreography, center-out stagger, parallax

## Dark Mode
- Reduce motion intensity 10-20% (bright on dark = more impact)
- Subtler ambient motion; careful with opacity values
- Avoid pure white flashes

~~~~

<a id="source-4"></a>

---

Source: [skills/motion-design/director/core-philosophy.md](https://github.com/lottiefiles/motion-design-skill/blob/f9a8a041b85185ee4881b3471d3415e939aac772/skills/motion-design/director/core-philosophy.md)

~~~~markdown
# Core Philosophy

## Three Pillars

### Pillar 1: Emotional Intent
Define target emotion before choosing any property.

| Emotion | Character | Timing | Easing |
|---------|----------|--------|--------|
| Trust | Smooth, predictable | 300-400ms | Gentle curves |
| Delight | Bouncy, surprising | 200-300ms | Overshoot |
| Urgency | Sharp, direct | 100-200ms | Snappy ease-out |
| Calm | Slow, flowing | 500-1000ms | Sine curves |
| Surprise | Sudden, explosive | 150-300ms | Exponential |
| Confidence | Direct, decisive | 200-400ms | Strong ease-out |

### Pillar 2: Visual Narrative

| Phase | Duration Share | Purpose |
|-------|--------------|---------|
| Setup | 20-30% | Establish context, prepare viewer |
| Action | 30-40% | Primary motion, hero moment |
| Resolution | 30-40% | Settle, breathe, confirm |

Even a 200ms tooltip fade has implicit setup→action→resolution.

### Pillar 3: Motion Craft
- Easing curves match emotional intent
- Duration proportional to element size and distance
- Arcs for organic, straight for mechanical
- Secondary motion (shadows, related elements)
- Nothing starts and stops all at once

## Three Motion Layers

| Layer | Role | Amplitude |
|-------|------|-----------|
| Primary | Main action viewer follows | 100% |
| Secondary | Supporting richness | 30-50% |
| Ambient | Background life | 10-20% |

- Secondary offset 50-100ms from primary, different easing
- Ambient is continuous/slow, never demands attention
- Primary-only animation feels flat; always add secondary + ambient

## The 1/3 Screen Rule
No motion travels >1/3 screen without intermediate keyframe. Break with direction changes, speed shifts, or arc adjustments.

## The Attention Budget
- One hero motion per scene moment
- Max 2-3 elements in active motion simultaneously
- Ambient doesn't count against budget
- Stagger rather than synchronize

~~~~

<a id="source-5"></a>

---

Source: [skills/motion-design/director/decision-framework.md](https://github.com/lottiefiles/motion-design-skill/blob/f9a8a041b85185ee4881b3471d3415e939aac772/skills/motion-design/director/decision-framework.md)

~~~~markdown
# Decision Framework

## The First Questions

### 1. Purpose?

| Purpose | Approach | Priority |
|---------|----------|----------|
| Draw attention | Scale, color, pulse | Responsiveness |
| Guide sequence | Stagger, directional flow | Clarity |
| Provide feedback | Immediate response | Speed |
| Create atmosphere | Subtle, continuous | Subtlety |
| Explain relationship | Position, connection | Legibility |
| Celebrate/reward | Overshoot, particles | Delight |

### 2. Audience?
- Stressed → calm motion; Browsing → richer motion
- Task-focused → fast, minimal; Exploring → can be dramatic
- Seen 100x/day → fast, subtle; Seen once → can be dramatic

### 3. Context?
- Busy layout → simpler motion; Empty → can be dramatic
- Other animations active → coordinate or stagger
- Small container → small motion

## 4-Level Decision Hierarchy

### Level 1: Motion Category

| Category | When |
|----------|------|
| Revealing | Content appearing |
| Concealing | Content disappearing |
| Transitioning | Between states/views |
| Emphasizing | Drawing attention |
| Responding | Reacting to interaction |
| Ambient | Background atmosphere |

### Level 2: Motion Personality
Match to brand. See [motion-personality.md](motion-personality.md).

### Level 3: Motion Direction

| Direction | Communicates |
|-----------|-------------|
| Upward | Growth, aspiration |
| Downward | Settling, completion |
| Leftward | Regression, departure |
| Rightward | Progression, arrival |
| Outward (scale up) | Importance, emergence |
| Inward (scale down) | Dismissal, removal |
| Center-seeking | Focus, convergence |
| Center-fleeing | Distribution, release |

### Level 4: Implementation Properties
Choose animated properties. See [property-selection.md](../reference/property-selection.md).

## Decision Quick-Path

```
1. PURPOSE → What does this motion DO?
   ├── Feedback → short, ease-out, minimal
   ├── Entrance → ease-out, personality-matched
   ├── Exit → ease-in, 70% of entrance
   ├── Emphasis → scale or color pulse
   └── Ambient → slow, continuous, sine

2. PERSONALITY → Match keywords
   ├── Fun/bouncy → Playful
   ├── Elegant/luxury → Premium
   ├── Clean/professional → Corporate
   └── Bold/dynamic → Energetic

3. PROPERTIES → Minimum needed (two = sweet spot)

4. TIMING → Check duration table, adjust for distance/weight

5. EASING → Entering=ease-out, Leaving=ease-in, On-screen=ease-in-out, Looping=sine
```

## Evaluation Before Delivery

| Check | Question |
|-------|----------|
| Purpose | Clear function? |
| Personality | Matches brand/context? |
| Repetition | Fine on 100th viewing? |
| Attention | Respects viewer's focus? |
| Hierarchy | Reinforces importance? |
| Layers | Primary + secondary + ambient? |
| Timing | Duration appropriate? |

~~~~

<a id="source-6"></a>

---

Source: [skills/motion-design/director/disney-principles.md](https://github.com/lottiefiles/motion-design-skill/blob/f9a8a041b85185ee4881b3471d3415e939aac772/skills/motion-design/director/disney-principles.md)

~~~~markdown
# Disney's 12 Principles — UI Adapted

## 1. Squash and Stretch

- Squash: scale ~[1.2, 0.8]; Stretch: ~[0.85, 1.15]
- Impact: 2-4 frames (30-65ms); Recovery: 4-8 frames (65-130ms)
- Preserve volume: width +20% → height decreases proportionally
- Skip for premium/luxury brands

## 2. Anticipation

- Small motion opposite to main direction before action
- Duration: 100-200ms, magnitude: 10-20% of main action
- Button: scale down 3% before expanding; Card: shift 5-10px away first
- Skip for micro-feedback (<150ms)

## 3. Staging

- Dim non-hero elements to 40-60% opacity; optional 2-4px blur
- Hero enters 100-200ms after supporting elements
- One primary action per timing beat

## 4. Straight Ahead vs. Pose to Pose

| Approach | Feel | Best For |
|----------|------|----------|
| Straight Ahead | Fluid, spontaneous | Particles, ambient, generative art |
| Pose to Pose | Planned, controlled | UI transitions, state changes |

## 5. Follow Through and Overlapping Action

- Child delay: 50-150ms behind parent
- Trailing elements: offset stop times by 100-200ms
- Use spring easing for trailing parts (lower stiffness = more trailing)

## 6. Slow In and Slow Out

| Context | Easing | Why |
|---------|--------|-----|
| Entrance | ease-out | Arrives smoothly |
| Exit | ease-in | Departs quickly |
| On-screen | ease-in-out | Smooth journey |
| Ambient loop | sine ease-in-out | Seamless |

**NEVER** linear for spatial movement. Linear only for: rotation, progress bars, timers.

## 7. Arcs

- Add 10-20px perpendicular offset at path midpoint
- Subtle (5px) for corporate, pronounced (20px+) for playful
- Mechanical UIs can use straight paths intentionally

## 8. Secondary Action

- Amplitude: 30-50% of primary; timing: 50-100ms after primary
- Different easing than primary
- Examples: card enters → shadow grows; button presses → ripple expands

## 9. Timing

| Weight/Mood | Duration |
|-------------|----------|
| Heavy (modals, pages) | 400-800ms |
| Light (tooltips, toggles) | 100-250ms |
| Sad/serious | 600ms+ |
| Happy/light | 200-400ms |
| Urgent | 100-200ms |

Enter-exit asymmetry: entrances 30-50% longer than exits.

## 10. Exaggeration

| Personality | Exaggeration |
|-------------|-------------|
| Playful | 15-25% |
| Energetic | 20-30% |
| Corporate | 0-5% |
| Premium | 0% |

- Scale overshoot: 10-30% beyond target; rotation: ±5-15°

## 11. Solid Drawing

- Maintain consistent proportions across keyframes
- Use scale + rotation together for depth
- Shadow behavior matches implied light source

## 12. Appeal

- Smooth curves over sharp angles; satisfying timing
- Personality consistency across all elements
- Appeal killers: jerky motion, inconsistent timing, abrupt stops, uniform animation

## Combining Principles

| Recipe | Principles Used |
|--------|----------------|
| Button press | Anticipation + Squash/Stretch + Follow-Through + Secondary + Timing |
| Card entrance | Anticipation + Arcs + Slow In/Out + Follow-Through + Staging |
| Success celebration | Exaggeration + Secondary + Timing + Squash/Stretch + Appeal |
| Error shake | Timing + Slow In/Out + Staging (no exaggeration) |
| Loading spinner | Timing + Slow In/Out + Appeal |

~~~~

<a id="source-7"></a>

---

Source: [skills/motion-design/director/emotion-mapping.md](https://github.com/lottiefiles/motion-design-skill/blob/f9a8a041b85185ee4881b3471d3415e939aac772/skills/motion-design/director/emotion-mapping.md)

~~~~markdown
# Emotion-to-Motion Mapping

## Core Table

| Emotion | Character | Path | Easing | Duration |
|---------|----------|------|--------|----------|
| Joy/Delight | Bouncy, arcs, overshoot | Curved, upward | ease-out-back | 200-400ms |
| Calm/Serenity | Smooth, flowing | Gentle curves | sine ease-in-out | 500-1000ms |
| Urgency/Alert | Sharp, fast, direct | Straight lines | ease-out | 100-200ms |
| Sadness/Weight | Slow, downward | Drooping curves | cubic ease-in-out | 600-1200ms |
| Surprise/Impact | Sudden, expanding | Radial outward | ease-out-expo | 150-300ms |
| Elegance/Grace | Slow, controlled | Long smooth arcs | (0.4, 0, 0.2, 1) | 400-700ms |
| Playfulness | Bouncy, irregular | Arcs, squiggly | ease-out-back | 200-350ms |
| Confidence | Direct, decisive | Straight, horizontal | ease-out | 200-400ms |
| Curiosity | Exploratory, varied | Mixed, circular | varied | 300-500ms |
| Tenderness | Soft, gentle | Very subtle curves | soft ease-in-out | 600-1000ms |

## Path as Emotional Language

| Path Type | Connotation |
|-----------|------------|
| Angular/sharp | Tense, urgent, mechanical |
| Curved/smooth | Relaxed, friendly, organic |
| Spiral | Playful, whimsical |
| Straight diagonal | Dynamic, purposeful |
| Vertical up | Growth, achievement |
| Vertical down | Settling, gravity |
| Horizontal | Journey, progress |
| Radial outward | Explosion, release |
| Radial inward | Focus, convergence |

## Emotional Intensity

| Intensity | Characteristics | When |
|-----------|----------------|------|
| Low | Subtle opacity, tiny shifts | Ambient, routine |
| Medium | Visible but not demanding | Most UI interactions |
| High | Demands attention, large displacement | Errors, celebrations, onboarding |

## Color Psychology

| Color | Emotion | Animation Pairing |
|-------|---------|------------------|
| Blue | Trust, calm | Smooth, medium transitions |
| Green | Success, growth | Upward, expansion, gentle overshoot |
| Red | Alert, urgency | Sharp, fast, horizontal shakes |
| Orange | Energy, warmth | Bouncy, diagonal paths |
| Purple | Premium, mystery | Slow reveals, elegant easing |
| Yellow | Optimism, caution | Quick pulses |
| Teal | Modern, clarity | Clean, snappy transitions |

### Color Transition Rules
- Success: transition TO green (don't start with it)
- Error: flash red then settle (don't sustain)
- Warning: pulse yellow/amber for urgency
- Neutral: use opacity rather than color change

## Context-Based Emotion Defaults

| Context | Default Emotion |
|---------|----------------|
| Form success | Joy + Confidence |
| Validation error | Mild urgency |
| Page load | Calm + Confidence |
| Navigation | Confidence |
| Notification | Mild surprise |
| Loading | Calm |
| Onboarding | Curiosity + Delight |
| Dashboard | Calm + Confidence |
| Purchase complete | Joy + Confidence |
| Delete/remove | Calm (respectful departure) |

~~~~

<a id="source-8"></a>

---

Source: [skills/motion-design/director/motion-personality.md](https://github.com/lottiefiles/motion-design-skill/blob/f9a8a041b85185ee4881b3471d3415e939aac772/skills/motion-design/director/motion-personality.md)

~~~~markdown
# Motion Personality

## Four Archetypes

### Playful

| Parameter | Value |
|-----------|-------|
| Duration | 150-300ms |
| Easing | ease-out-back / bouncy springs |
| Overshoot | 10-20% |
| Paths | Arcs and curves, never straight |
| Squash-stretch | Yes, on impacts |

Signature: bounce settle, squash-stretch on press, rotation wobble, bright color pops, varied stagger timing.
Use for: children's apps, casual games, social media, celebrations, onboarding, creative tools.

### Premium / Luxury

| Parameter | Value |
|-----------|-------|
| Duration | 350-600ms |
| Easing | cubic-bezier(0.4, 0, 0.2, 1) |
| Overshoot | 0% |
| Paths | Smooth curves, subtle parallax |
| Squash-stretch | Never |

Signature: slow fades, subtle scale (98%→100%), generous pauses, minimal properties (opacity+one), ultra-smooth.
Use for: fashion, finance, luxury brands, premium SaaS, portfolios, editorial.

### Corporate / Professional

| Parameter | Value |
|-----------|-------|
| Duration | 200-400ms |
| Easing | cubic-bezier(0.2, 0, 0, 1) |
| Overshoot | 0-3% |
| Paths | Mostly straight, small arcs for emphasis |
| Squash-stretch | No |

Signature: consistent timing, clear state transitions, functional motion, predictable patterns, uniform stagger.
Use for: enterprise, dashboards, business tools, admin, healthcare, banking.

### Energetic / Dynamic

| Parameter | Value |
|-----------|-------|
| Duration | 100-250ms |
| Easing | ease-out-expo / elastic |
| Overshoot | 15-30% |
| Paths | Dramatic arcs, large displacement, diagonal |
| Squash-stretch | Yes, exaggerated |

Signature: large scale changes (50-150%), fast color transitions, particle bursts, accelerating stagger, bold edge entrances.
Use for: gaming, sports, music, events, marketing, fitness apps.

## Keyword Matching

| Keywords | Archetype |
|----------|-----------|
| fun, whimsical, bouncy, cute, friendly | Playful |
| elegant, minimal, luxury, sophisticated | Premium |
| clean, professional, business, dashboard | Corporate |
| dynamic, energetic, bold, exciting | Energetic |
| (unspecified) + UI | Corporate (default) |
| (unspecified) + illustration | Playful (default) |

## Brand Motion Identity

Define three constants for recognizable motion:

### 1. Signature Easing (80% of animations)
Playful: ease-out-back | Premium: (0.4,0,0.2,1) | Corporate: (0.2,0,0,1) | Energetic: ease-out-expo

### 2. Duration Palette

| Tier | Playful | Premium | Corporate | Energetic |
|------|---------|---------|-----------|-----------|
| Quick | 150ms | 350ms | 200ms | 100ms |
| Standard | 250ms | 500ms | 300ms | 180ms |
| Slow | 400ms | 800ms | 450ms | 300ms |

### 3. Entrance Pattern
Playful: bounce up from below | Premium: slow fade + scale 98%→100% | Corporate: slide right + opacity | Energetic: snap from edge + overshoot

## Mixing Archetypes
- 90% primary archetype; specific moments can borrow another
- Ease into personality shifts, don't snap
- Example: corporate dashboard borrows Playful for success state only

~~~~

<a id="source-9"></a>

---

Source: [skills/motion-design/director/narrative-structure.md](https://github.com/lottiefiles/motion-design-skill/blob/f9a8a041b85185ee4881b3471d3415e939aac772/skills/motion-design/director/narrative-structure.md)

~~~~markdown
# Narrative Structure

## Four-Act Structure

### Act 1: Anticipation (10-20%)
- Wind-up: small motion opposite to main direction
- Gathering: elements pull together before dispersing
- Dimming: context fades for focus; Tension: hold compressed ~50ms
- Skip for <150ms interactions and hover states

### Act 2: Action (30-50%)
Peak energy. The primary communicative motion.
- Fast+direct (sharp easing) → alerts
- Smooth+flowing (gentle easing, curves) → transitions
- Explosive+expanding (expo, radial) → celebrations
- Controlled+precise (linear-ish) → data charts

### Act 3: Reaction (10-20%)
- Shadows adjust: 50-100ms after primary
- Siblings shift: 50-150ms after primary
- Environment ripples: 100-200ms after primary
- Counter-motion: simultaneous with action
- Skip for simple toggles/checkboxes

### Act 4: Resolution (20-30%)
- Overshoot settle (spring/back-easing); opacity reaches final (ease-out)
- 100-200ms breathing room before next motion
- Even 50ms of settling transforms the feel

## Scaling to Duration

| Total | Anticipation | Action | Reaction | Resolution |
|-------|-------------|--------|----------|------------|
| 100-200ms | skip | 60-70% | skip | 30-40% |
| 200-400ms | 10-15% | 40-50% | 10-15% | 25-30% |
| 400-800ms | 15-20% | 30-40% | 15-20% | 20-25% |
| 800ms+ | 20% | 30-35% | 15-20% | 25-30% |

## Multi-Beat Narratives

Transitions: overlap (fluid) | sequential (clear) | simultaneous (parallel)

Progressions:
- **Build-Up**: low → rising → peak → settling
- **Cycle**: depart → peak → return → repeat
- **Impact**: sudden action → ripple → slow settle

## By Personality

| Personality | Anticipation | Action | Resolution |
|------------|-------------|--------|------------|
| Playful | Exaggerated wind-up | Bouncy, overshoot | Wobble settle |
| Premium | Subtle tension | Smooth, controlled | Elegant ease |
| Corporate | Minimal/none | Direct, efficient | Clean stop |
| Energetic | Quick gather | Explosive | Fast snap |

## Common Patterns

- **Reveal**: tension (dim, scale 95%) → emerge (100%, full opacity) → surroundings adjust → settled
- **Departure**: gather (scale 98%) → exit → close gap → layout settles
- **Transformation**: destabilize (vibration) → morph → secondary appears → new state breathing
- **Celebration**: compress (50-100ms) → burst (scale, particles) → settle → calm with positive state

~~~~

<a id="source-10"></a>

---

Source: [skills/motion-design/patterns/ambient-continuous.md](https://github.com/lottiefiles/motion-design-skill/blob/f9a8a041b85185ee4881b3471d3415e939aac772/skills/motion-design/patterns/ambient-continuous.md)

~~~~markdown
# Ambient & Continuous Patterns

Ambient amplitude: 10-20% of primary motion. Never compete for attention.

## Breathing / Pulse

- Scale oscillation 0.98-1.02, sine ease-in-out, 2000-4000ms/cycle
- Alt: opacity oscillation 0.7-1.0

| Context | Scale Range | Duration | Opacity Range |
|---------|-----------|----------|--------------|
| Active indicator | 0.95-1.05 | 2000ms | 0.6-1.0 |
| Waiting/idle | 0.98-1.02 | 3000ms | 0.8-1.0 |
| Background element | 0.99-1.01 | 4000ms | 0.9-1.0 |
| CTA attention | 0.97-1.03 | 2500ms | 0.7-1.0 |

Pulsing >±5% scale becomes attention-demanding.

## Floating / Hovering

- Y position ±5-15px, sine ease-in-out, 3000-5000ms/cycle
- Optional: slight rotation ±2-3°, offset 30% of position cycle

**Layered floating** (multiple elements — different durations prevent sync):
- Element 1: 4000ms, ±10px
- Element 2: 5500ms, ±8px (offset 30%)
- Element 3: 3500ms, ±12px (offset 60%)

## Gradient Shift

- Background-position or gradient angle shift
- Duration: 8000-20000ms/cycle; range: ±10-20% position or ±15° angle
- Easing: linear or sine; should be imperceptible at a glance

## Parallax

| Layer | Speed Ratio | Content |
|-------|------------|---------|
| Foreground | 1.0x | Interactive, text |
| Midground | 0.5x | Decorative, cards |
| Background | 0.2x | Patterns, scenery |
| Deep background | 0.1x | Texture, atmospheric |

**Scroll-driven**: total displacement <100px; avoid on mobile; never parallax text
**Mouse-driven**: foreground 10-20px max, background 5-10px opposite direction, 100-200ms interpolation

## Continuous Rotation

- Spinners: linear easing, 1000-2000ms/revolution

| Variant | Speed | Use Case |
|---------|-------|----------|
| Slow spin | 10-30s/rev | Background decoration |
| Gear-like | 3-5s/rev | Technical/mechanical |
| Orbital | 5-15s/rev | Space/science theme |
| Wobble | 2-4s/cycle, sine | Playful idle |

## Shimmer / Gleam

- Gradient sweep left-to-right, 1500-2500ms/sweep
- Pause 2000-5000ms between sweeps
- Opacity gradient: 0%→30%→0%
- Use for: skeleton loading, premium accents, "new" badges

## Particle Ambient

### Snow/Falling: 10-20 elements, 20-60px/s down, ±10-20px drift, 3-8px, 30-70% opacity
### Dust/Motes: 5-10 elements, 10-30px/s mixed, 2-5px, 20-50% opacity
### Sparkle/Stars: 8-15 elements, opacity pulse 0→100%→0, 500-1500ms/sparkle, random stagger

**Performance**: <20 ambient elements, transform+opacity only, larger/fewer over small/numerous

## Combining Ambient Layers

| Layer | Type | Example |
|-------|------|---------|
| Background | Gradient shift or parallax | Slow color temperature change |
| Midground | Floating or particles | Gentle floating elements |
| Foreground | Breathing or shimmer | Subtle pulse on content |

Total ambient: max 20% of primary motion's visual energy.

~~~~

<a id="source-11"></a>

---

Source: [skills/motion-design/patterns/entrance-exit.md](https://github.com/lottiefiles/motion-design-skill/blob/f9a8a041b85185ee4881b3471d3415e939aac772/skills/motion-design/patterns/entrance-exit.md)

~~~~markdown
# Entrance & Exit Patterns

## Entrance Strategies

### 1. Direct Entrance (Slide In)
- Position + opacity; offset 20-40px + opacity 0 → final position + opacity 1
- Easing: ease-out; duration 200-350ms

| Personality | Offset | Easing | Overshoot |
|------------|--------|--------|-----------|
| Playful | 30-50px | ease-out-back | 10-15% |
| Premium | 15-25px | (0.4, 0, 0.2, 1) | 0% |
| Corporate | 20-30px | (0.2, 0, 0, 1) | 0-3% |
| Energetic | 40-80px | ease-out-expo | 15-25% |

Direction: below=arrival, right=forward, left=back, above=dropdown/authority.

### 2. Emergent Entrance (Scale In)
- Scale + opacity; start 85-95% + opacity 0 → 100% + opacity 1
- Duration 250-400ms

| Personality | Start Scale | Easing | Overshoot |
|------------|------------|--------|-----------|
| Playful | 70-80% | ease-out-back | 10-20% |
| Premium | 95-98% | (0.4, 0, 0.2, 1) | 0% |
| Corporate | 90-95% | (0.2, 0, 0, 1) | 0-3% |
| Energetic | 50-70% | ease-out-expo | 15-30% |

Best for: modals, dialogs, notifications, popovers, tooltips.

### 3. Reveal Entrance (Clip/Mask)
- clip-path or mask + opacity; 300-500ms, ease-out
- Directions: top-to-bottom (dramatic), L-to-R (reading order), center-out (focus), edge-in (contained)

### 4. Assembled Entrance (Multi-Part)
- Parts arrive from different positions; stagger 50-100ms; total 300-600ms
- Best for: icon assembly, logo builds, data viz construction

## Exit Strategies

**Rule**: Exits = 65-75% of entrance duration.

### 1. Direct Exit (Slide Out)
- Offset 20-40px + opacity 0; ease-in; 150-250ms

### 2. Dissolve Exit (Fade Out)
- Opacity (+ optional scale to 98%); ease-in; 150-250ms
- Best for: gentle departures, backgrounding, crossfades

### 3. Collapse Exit (Shrink Out)
- Scale 85-95% + opacity 0; ease-in; 150-250ms
- Best for: deletion, closing modals, dismissal

### 4. Transfer Exit (Move Away)
- Position toward destination + scale shrink; ease-in-out; 250-400ms
- Best for: add-to-cart, save-to-collection, move-to-folder

## Entrance-Exit Continuity
- Eye follows naturally from exit to entrance
- Exit point near entry point when possible
- 100-150ms timing overlap between exit and entrance
- Same easing family for paired entrance-exit

## Common Recipes

### Notification Slide-In
1. Slide from right + opacity (250ms, ease-out)
2. Overshoot 3-5% (corporate) or 10-15% (playful)
3. Icon appears (100ms, 50ms delay)

### Toast Dismiss
1. Slide toward edge + opacity (180ms, ease-in)
2. Remaining toasts shift up (200ms, ease-in-out)

### Dropdown Open
1. Scale Y 0→100% (200ms, ease-out)
2. Items stagger fade in (30ms apart, 50ms after container)

### Page Transition (Forward)
1. Current page slides left + fades (300ms, ease-in)
2. New page from right + fades in (400ms, ease-out, 100ms delay)
3. Shared elements morph (400ms, ease-in-out)

~~~~

<a id="source-12"></a>

---

Source: [skills/motion-design/patterns/multi-element.md](https://github.com/lottiefiles/motion-design-skill/blob/f9a8a041b85185ee4881b3471d3415e939aac772/skills/motion-design/patterns/multi-element.md)

~~~~markdown
# Multi-Element Patterns

## Stagger Recipes

### List Items
- Slide up 20px + fade (200ms, ease-out); stagger 40-60ms; total <400ms for 8 items

| Personality | Duration | Stagger | Easing |
|------------|---------|---------|--------|
| Playful | 250ms | 60ms | ease-out-back |
| Premium | 350ms | 80ms | (0.4, 0, 0.2, 1) |
| Corporate | 200ms | 50ms | (0.2, 0, 0, 1) |
| Energetic | 150ms | 30ms | ease-out-expo |

### Grid Cards
- Scale from 95% + fade (250ms, ease-out); stagger 50-80ms reading order; +20ms per new row
- Shadow 50ms after card. Alt patterns: center-out, column-first, random

### Navigation Items
- Slide from side + fade (180ms, ease-out); stagger 30-50ms; total <300ms

### Dashboard Widgets
```
0ms   — Skeletons visible
100ms — Hero metric (250ms, ease-out)
200ms — Widgets begin (200ms each, 60ms stagger)
350ms — Hero complete, chart draws (300ms)
500ms — All landed
650ms — Ambient pulse begins
```

## Coordinated Sequences

### Modal with Content
0ms: backdrop dims (200ms) → 50ms: modal scales 95%→100% (300ms) → 200ms: title → 280ms: body → 350ms: buttons → 400ms: close button. Content in reading order.

### Tab Switch
0ms: indicator slides (250ms, ease-in-out) + old fades (150ms) → 100ms: new content from tab direction (200ms) → 150ms: elements stagger (40ms)

### Accordion
Expand: arrow rotates (150ms) + height expands (250ms) + content fades at 50ms (200ms); siblings shift (200ms). Collapse: reverse, ease-in.

### Page Transition
Current slides left+fades (300ms, ease-in) → new from right (400ms, ease-out, 100ms delay) → hero scales in → content staggers (50ms). Optional shared element morph (400ms).

### Drag and Drop
Drag: lift (scale 1.03, 150ms); others shift (200ms). Drop: settle (scale 1.0, 200ms); gaps close.

## Choreography Rules

### Timing Overlap
0%=methodical | 25%=brisk (standard) | 50%=fluid | 75%=rapid (energetic)

### Group Rules
- Same easing family; different durations/delays fine
- Exception: secondary/ambient can differ

### Shared Origin
Motion from trigger point; closer=first; farther=more delay

### Counter-Motion

| Hero Does | Counter-Motion |
|-----------|---------------|
| Slides right | Background left (20-30%) |
| Scales up | Shadow spreads |
| Lifts up | Shadow drops+softens |
| Rotates CW | Ambient CCW |
| Expands | Siblings compress |

~~~~

<a id="source-13"></a>

---

Source: [skills/motion-design/patterns/state-feedback.md](https://github.com/lottiefiles/motion-design-skill/blob/f9a8a041b85185ee4881b3471d3415e939aac772/skills/motion-design/patterns/state-feedback.md)

~~~~markdown
# State & Feedback Patterns

## Button Press

### Playful
- Press: scale 0.95 (60ms, ease-out); Release: overshoot 1.05 (80ms); Settle: 1.0 (120ms, spring)
- Secondary: shadow shrinks/grows; color darkens/brightens. Total ~260ms

### Premium
- Press: scale 0.98 (80ms); Release: 1.0 (150ms, no overshoot)
- Opacity dims to 90% on press. Total ~230ms

### Corporate
- Press: scale 0.97 (60ms); Release: 1.0 (100ms); overshoot 0-2%
- Background darkens 10%. Total ~160ms

## Hover States

| Element | Effect | Duration |
|---------|--------|----------|
| Button | Scale 1.02-1.05 | <100ms |
| Card | Scale 1.01-1.02 + shadow lift | <100ms |
| Link | Color change + underline | <100ms |
| Icon | Scale 1.1 + rotation 2-5° | <100ms |
| Image | Scale 1.03 (overflow hidden) | 150ms |

Hover enter <100ms; hover exit 150-200ms (slower = polished).

## Toggle / Switch
- Thumb slides (120-180ms, ease-in-out); track color transitions simultaneously
- Slight squash in movement direction
- Playful: bounce at destination; Premium: smooth, no overshoot

## Success State

### Checkmark Success
1. Container: scale 0.9→1.0 (200ms, ease-out-back, 5-10% overshoot)
2. Checkmark: stroke draw (150ms, ease-out, 100ms delay)
3. Color: to green (200ms); ambient glow/particles (300ms)
4. Total: 400-500ms

### Confirmation Badge
1. Badge scales from 0 (200ms, ease-out-back)
2. Text fades in (150ms, 50ms delay)
3. Background pulse (300ms, sine)

### Payment Success
1. Spinner → checkmark crossfade (200ms)
2. Checkmark draws (200ms); container → success color (200ms)
3. Text fades in (200ms, 100ms delay); optional confetti (300-500ms)

## Error State

### Error Shake
- Horizontal oscillation ±10-15px, 2-3 cycles decreasing amplitude
- ease-in-out, 300-400ms total; red tint; no overshoot; settles at origin

### Inline Validation
1. Error text slides down + fades in (200ms)
2. Border → red (150ms); icon scales in (150ms, 50ms delay)
3. Optional single shake (200ms)

### Form Submission Error
1. Button returns to normal (200ms)
2. Error message slides in (250ms)
3. Affected fields highlight red (150ms, staggered 30ms)
4. Smooth scroll to first error (300ms, ease-in-out)

## Loading States

### Spinner
- Continuous 360°, linear, 1000-1500ms/rev; optional breathing pulse (2-3s)

### Skeleton
- Gradient sweep L→R, 1500-2000ms; base 10-20% opacity, peak 30-40%

### Progress Bar
- Width/transform, ease-in-out; optional color milestones + shimmer

### Indeterminate
- Oscillating position/width, 1500-2500ms, ease-in-out; continuous, never frantic

## Warning State
1. Yellow/amber border (150ms)
2. Warning icon scales in (150ms, subtle overshoot)
3. Optional icon pulse (2-3s, sine); text fades in (200ms, 50ms delay)

## Disabled / Enabled

- **Disabling**: opacity to 50-60% (200ms); optional scale to 98%
- **Enabling**: opacity to 100% (200ms); optional scale pulse 98%→100%

## Focus States
- Focus ring: scale 95%→100% + opacity (150ms)
- Card focus: scale 1.01, shadow increase (150ms)
- Tab nav focus: <100ms; must work with reduced-motion

~~~~

<a id="source-14"></a>

---

Source: [skills/motion-design/reference/property-selection.md](https://github.com/lottiefiles/motion-design-skill/blob/f9a8a041b85185ee4881b3471d3415e939aac772/skills/motion-design/reference/property-selection.md)

~~~~markdown
# Property Selection

## Position

| Direction | Meaning |
|-----------|---------|
| Upward | Growth, improvement, aspiration |
| Downward | Settling, completion, grounding |
| Leftward | Regression, backward, departure |
| Rightward | Progression, forward, arrival |
| Toward center | Focus, convergence |
| Away from center | Distribution, expansion |

## Scale

| Direction | Meaning |
|-----------|---------|
| Scale up | Importance, activation, proximity |
| Scale down | Deprioritization, distance |
| Pulse | Attention, heartbeat, life |
| Breathing | Presence, waiting |

## Rotation

| Range | Meaning |
|-------|---------|
| Small (5-15°) | Subtle adjustment |
| Medium (45-90°) | Transformation |
| Full (360°) | Completion, processing |
| Continuous | Ongoing activity |

## Opacity

| Direction | Meaning |
|-----------|---------|
| Fade in | Arrival, enablement |
| Fade out | Departure, disablement |
| Partial | Secondary, disabled state |

**Rule**: NEVER opacity alone for important state changes. Combine with position or scale.

## Color

| Transition | Meaning |
|-----------|---------|
| To green | Success, go |
| To red | Error, stop |
| To blue | Trust, active |
| To gray | Disabled, inactive |
| Brightening | Activation, focus |
| Dimming | Deactivation, background |

## Combined Properties

| Combination | Best For |
|-------------|----------|
| Position + Opacity | Content appearing/disappearing |
| Scale + Opacity | Cards, modals, notifications |
| Position + Scale | Selected items, focused content |
| Rotation + Scale | Celebrations, playful activation |
| Position + Rotation | Organic transitions |
| Color + Scale | State emphasis |

Primary property carries meaning; secondary adds polish. Two properties is the sweet spot.

## Property Selection by Goal

| Goal | Primary | Secondary | Avoid |
|------|---------|-----------|-------|
| Entrance | position | opacity | rotation |
| Exit | position | opacity | scale up |
| Button press | scale | color | position |
| Hover | scale or color | opacity | position |
| Success | scale | color + opacity | position |
| Error | position (shake) | color | scale |
| Loading | rotation | opacity | position |
| Toggle | position | color | rotation |
| Notification | position + scale | opacity | rotation |
| Delete | scale + opacity | position | grow |
| Selection | scale | color, opacity | rotation |
| Progress | position or scale | color | opacity |

## Performance

| Property | Performance |
|----------|-------------|
| transform (translate, scale, rotate) | Excellent — GPU-accelerated |
| opacity | Excellent — GPU-accelerated |
| color / background-color | Good — triggers paint |
| clip-path | Good — GPU on modern browsers |
| width / height | Poor — triggers layout |
| margin / padding | Poor — triggers layout |
| box-shadow | Poor — expensive paint |

**Rule**: Prefer transform + opacity for all motion.

~~~~

<a id="source-15"></a>

---

Source: [skills/motion-design/reference/quality-checklist.md](https://github.com/lottiefiles/motion-design-skill/blob/f9a8a041b85185ee4881b3471d3415e939aac772/skills/motion-design/reference/quality-checklist.md)

~~~~markdown
# Quality Checklist

## Visual Quality
- [ ] Elements >40px for motion, >100px for detail
- [ ] Readable at full speed without slow-motion
- [ ] Clear primary, secondary, ambient layers
- [ ] Counter-motion for balance where needed
- [ ] Natural arcs (unless intentionally mechanical)
- [ ] 1/3 rule (distance): no unbroken motion >1/3 container
- [ ] 1/3 rule (density): max 1/3 elements active simultaneously

## Technical Quality
- [ ] No linear easing on spatial movement
- [ ] Duration matches element type table
- [ ] Ease-out entrances, ease-in exits
- [ ] Duration proportional to distance
- [ ] Entrance duration >= exit duration
- [ ] Not opacity-only for important state changes
- [ ] Stagger total <500ms
- [ ] Follow-through: child elements offset 50-150ms

## Emotional Quality
- [ ] Target emotion identified before properties
- [ ] Personality archetype matches brand
- [ ] Setup → action → resolution structure
- [ ] Intensity matches interaction importance
- [ ] Consistent: same interaction = same motion
- [ ] Appropriate on 100th viewing

## Performance Quality
- [ ] Primary motion uses transform + opacity
- [ ] <20 animated elements per viewport
- [ ] No layout-triggering properties animated
- [ ] Elements staggered, not simultaneous
- [ ] Maintains 60fps (30fps acceptable for ambient)

## Accessibility Quality
- [ ] prefers-reduced-motion alternative provided
- [ ] No vestibular triggers without alternative
- [ ] Same interaction = same animation
- [ ] Critical info not motion-only
- [ ] Animations >5s are pausable

## Severity Tiers

### CRITICAL
- Linear easing on spatial movement
- Opacity-only for important states
- Exceeds 1/3 screen rule
- Missing primary layer
- Stagger >500ms
- Layout property animation causing jank

### HIGH
- Missing secondary layer
- Duration mismatch with element type
- Wrong directional easing
- Inconsistent personality
- No follow-through
- Missing reduced-motion alternative

### MEDIUM
- Missing ambient layer
- No anticipation phase
- Overshoot mismatch
- Could use better arcs
- Missing counter-motion

~~~~

<a id="source-16"></a>

---

Source: [skills/motion-design/reference/timing-easing-tables.md](https://github.com/lottiefiles/motion-design-skill/blob/f9a8a041b85185ee4881b3471d3415e939aac772/skills/motion-design/reference/timing-easing-tables.md)

~~~~markdown
# Timing & Easing Tables

## Duration by Element Type

| Element | Duration |
|---------|----------|
| Tooltip / micro-feedback | 80-120ms |
| Button / toggle | 120-180ms |
| Icon transition | 150-250ms |
| Card enter/exit | 200-350ms |
| Modal / dialog | 300-400ms |
| Page transition | 400-600ms |
| Dramatic reveal | 600-1200ms |
| Ambient | 2000-20000ms |

## Distance-Duration Scaling

50px=0.8x | 100px=1.0x | 200px=1.3x | 300px=1.5x | 400px=1.6x | Full screen=1.8-2.0x

## Enter vs. Exit
Entrance = base (100%). Exit = 65-75% of entrance.

## Interactive Feedback

| Interaction | Max Latency |
|------------|-------------|
| Hover | <100ms |
| Press/tap | <150ms |
| Release/settle | 200-300ms |
| Error shake | 300-400ms |
| Long press | 500-800ms |
| Drag start | <50ms |

## Duration by Personality

| Personality | Quick | Standard | Slow |
|------------|-------|----------|------|
| Playful | 150ms | 250ms | 400ms |
| Premium | 350ms | 500ms | 800ms |
| Corporate | 200ms | 300ms | 450ms |
| Energetic | 100ms | 180ms | 300ms |

## Easing: Directional Rules

Entrance=ease-out | Exit=ease-in | On-screen=ease-in-out | Looping=sine | Rotation/progress=linear

## Easing: Industry Standards

| Name | Cubic Bezier | Use |
|------|-------------|-----|
| MD3 Standard | (0.2, 0, 0, 1) | Default on-screen |
| MD3 Emphasized | (0.05, 0.7, 0.1, 1) | Entrances |
| MD3 Accelerate | (0.3, 0, 1, 1) | Exits |
| MD3 Decelerate | (0, 0, 0, 1) | Entering |
| Apple HIG | (0.25, 0.1, 0.25, 1) | iOS default |
| Apple Spring | stiffness:300 damping:20 | Interactive |
| Snappy UI | (0.2, 0, 0, 1) | Fast, decisive |
| Gentle float | (0.4, 0, 0.2, 1) | Ambient |
| Bounce settle | (0.175, 0.885, 0.32, 1.275) | Playful |
| Elastic snap | (0.68, -0.55, 0.265, 1.55) | Dramatic |

## Material-Based Easing

| Material | Duration Scale | Overshoot |
|----------|---------------|-----------|
| Rigid (metal) | 1.2x | 0% |
| Elastic (rubber) | 0.8x | 15-25% |
| Fluid (water) | 1.5x | 5% |
| Paper (cards) | 1.0x | 3-5% |
| Gas (smoke) | 2.0x | 0% |
| Glass | 0.9x | 0% |

## Spring Parameters

| Feel | Stiffness | Damping |
|------|-----------|---------|
| Very stiff | 400+ | 25-30 |
| Standard | 250-350 | 18-24 |
| Bouncy | 150-250 | 10-15 |
| Very bouncy | 100-200 | 5-10 |
| Gentle | 100-150 | 20-25 |

Damping: <1.0=oscillates, 1.0=fastest no-oscillation, >1.0=slow settle.

## Stagger Patterns

| Pattern | Delay | Budget |
|---------|------|--------|
| Micro cascade | 20-40ms | <200ms |
| Standard | 50-100ms | <400ms |
| Dramatic | 100-200ms | <600ms |
| Wave | 30-60ms | <500ms |

Direction: top-to-bottom (lists) | L-to-R (horizontal) | center-out (hero) | random (organic) | reverse (exits)

Total stagger MUST stay <500ms.

## Overshoot Budget

| Context | Overshoot |
|---------|-----------|
| Success | 5-10% |
| Error | 0% |
| Feedback | 2-5% |
| Celebration | 15-25% |
| Premium | 0% |

~~~~

<a id="source-17"></a>

---

Source: [skills/motion-design/reference/troubleshooting.md](https://github.com/lottiefiles/motion-design-skill/blob/f9a8a041b85185ee4881b3471d3415e939aac772/skills/motion-design/reference/troubleshooting.md)

~~~~markdown
# Troubleshooting

## Looks Robotic
- Linear easing → use ease-out (entrance) or ease-in-out
- Straight paths → add 10-20px arc at midpoint
- Uniform timing → stagger 50-100ms between elements
- Everything synced → offset start/stop 50-150ms
- No secondary → add shadow, icon reaction, ambient

## Feels Too Slow
- Duration exceeds type budget → check duration table
- ease-in-out when ease-out works → ease-out feels faster
- Too much anticipation → reduce to 10% or remove
- Stagger exceeded → total <500ms
- Overshoot settle too long → increase damping

## Feels Too Fast / Jarring
- Duration below minimum → modals 300ms+, pages 400ms+
- No easing → add ease-out minimum
- Missing resolution → add 50-100ms settle
- No anticipation on large motion → add 100-200ms wind-up

## Feels Cheap / Flat
- Only primary motion → add secondary + ambient
- Opacity-only → combine with position or scale
- Same easing everywhere → vary primary vs secondary
- No follow-through → child elements trail 50-150ms
- No overshoot → add 3-10%

## Too Distracting
- Too many moving → 1/3 rule
- Amplitude too large → reduce to minimum
- Competing heroes → one per moment, dim rest
- Ambient too prominent → 10-20% amplitude, slower
- No breathing room → 100-200ms pause between beats

## No Personality
- Default easing → apply archetype's signature
- Same duration for all → use personality palette
- No consistent entrance → define one for project
- Mixed archetypes → pick one for 90%+

## Inconsistent Feel
- Different easing same-type → standardize per motion type
- Duration varies same type → use palette consistently
- Entry direction changes → one origin everywhere
- Overshoot inconsistent → apply rules consistently

## Performance (Dropped Frames)
- Animating width/height/margin → use transform
- Too many elements → <20 per viewport
- Complex shadows/filters → simplify or pre-render
- No GPU acceleration → transform + opacity
- All simultaneous → stagger to spread load

## Quick Diagnostic

1. No linear on spatial movement
2. Duration matches element type
3. Primary + secondary layers
4. Consistent personality
5. Directional easing correct
6. 1/3 screen rule
7. 1/3 element rule
8. Follow-through present
9. Every motion has purpose
10. Fine on 100th viewing

## Personality Mistakes
- **Playful**: overshoot >25% = broken; not everything bounces; short+bounce = glitchy
- **Premium**: too subtle = invisible; too slow = waiting; zero = broken
- **Corporate**: too conservative = boring; playful easing breaks trust; identical = monotonous
- **Energetic**: max everywhere = nothing stands out; too many particles; no settle = chaos

~~~~
