---
status: accepted
---

# Generate reference-directed animation through a video model

[Issue #69](https://github.com/MathBorgess/skills-catalog/issues/69) requests replacing reference-animation's code-rendered production with video-model generation, preserving authored direction and requiring five separate human review gates. The requested integration target is Google Flow through gflow-cli. The author selected `co-direct-animation` as the name, a scope covering various animation styles, a user-selected image tool and an assembled film with agent-managed audio. Dedicated human audio exploration is deferred to [issue #70](https://github.com/MathBorgess/skills-catalog/issues/70). The author confirmed this complete responsibility boundary: start with authored design and human briefing, preserve the whole plan and decisions in external TO-SPEC, then generate through gflow. The [design interview](../../docs/co-direct-animation/gflow-design.md) records the evidence and accepted choices.

Code may support project records, inspection, archiving and assembly of generated clips, including static captions/text/marks and color finishing, but cannot generate a replacement animation when Flow is unavailable. The author selected shot-by-shot generation and human review of every visual attempt before the next generation; the multi-scene runner is therefore not the default. This trades deterministic control over geometry, exact typography and trajectories for model-generated visual possibilities. Accepted source images and prompt settings do not guarantee final fidelity, and a new generation cannot inherit approval of an earlier clip solely because the requested quality increased. Missing generation capability leaves the current creative gate pending with its prepared review packet.
