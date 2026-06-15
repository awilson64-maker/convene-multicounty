# CONVENE Multi-County Porting Plan

This file tracks how the working Fond du Lac edition should be converted into a reusable multi-county platform without changing the live FDL repo.

## Phase 1: Safe scaffold

Status: started.

- Create standalone multi-county repo.
- Add county-neutral app shell.
- Add county configuration layer.
- Add county-namespaced browser storage.
- Add county-labeled backup and restore behavior.
- Add CRM CSV append preview.
- Add census placeholder module.

## Phase 2: Port stable CRM features

- Bring over mature organization list behavior.
- Bring over existing field set and edit behavior.
- Bring over map filtering and marker popups.
- Bring over backup/restore safety improvements.
- Keep all county-specific language inside config.

## Phase 3: Port census gap lens

- Convert the FDL census page into a reusable census module.
- Generate separate county census JSON files.
- Add scoring logic using the active county's census file.
- Load county tract files based on `countyId`.
- Add a clear not-configured state when census data is missing.

## Phase 4: Waupaca pilot

- Add Waupaca census tract data.
- Add Waupaca county map data.
- Test Waupaca CRM import using county-specific storage.
- Verify backups identify Waupaca County.
- Confirm the FDL working edition remains untouched.

## Non-negotiable guardrail

No writes should be made to `awilson64-maker/fdl-community-crm` during this port unless specifically requested later.
