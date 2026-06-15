# CONVENE Multi-County

CONVENE stands for Community Organizations, Needs, Visualization, Engagement & Network Explorer.

This repository is the county-neutral, scalable version of CONVENE. It is intentionally separate from the existing Fond du Lac working CRM so the live FDL tool can remain stable while the multi-county edition is developed.

## Current purpose

This repo is being structured as a shared static web platform with county-specific configuration. The goal is to let educators use the same CONVENE core tools while keeping each county's settings, browser storage, census files, and map defaults separate.

## Guardrails

- Do not edit the existing `fdl-community-crm` repo from this project.
- Keep county-specific assumptions in `/js/county-config.js`.
- Keep browser storage namespaced by county.
- Keep exports county-labeled so backups cannot be accidentally restored without a warning.
- Treat Fond du Lac and Waupaca as initial county profiles, not hardcoded app logic.

## Initial structure

```text
index.html
assets/styles.css
js/county-config.js
js/storage.js
js/access.js
js/app.js
js/crm.js
js/census-gap.js
data/fdl/
data/waupaca/
```

## Development note

This is an early scaffold. The current goal is to establish safe structure first, then progressively port mature CRM and census behavior from the FDL working edition into reusable modules.
