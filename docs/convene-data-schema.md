# CONVENE Data Schema Audit

Status: Phase 2A draft  
Last updated: 2026-06-16  
Repository: awilson64-maker/convene-multicounty

## Purpose

This document defines the current working data model for the CONVENE multi-county app before additional cleanup. It is meant to prevent hidden data conflicts as the app expands beyond Fond du Lac County.

This is an audit of the current app behavior. It does not by itself change the live app.

## Current official storage model

The core storage module currently treats these as the official workspace stores:

1. organizations
2. contacts
3. activities
4. relationships

Each county uses its own localStorage namespace. The storage key pattern is:

```text
{county.storagePrefix}:{storeName}
```

Example:

```text
convene:fdl:organizations
convene:waupaca:organizations
```

This separation is central to preventing Fond du Lac data from leaking into Waupaca or future counties.

## County config schema

County definitions live in `js/county-config.js`.

Each county should include:

| Field | Purpose | Required |
|---|---|---|
| id | Internal county id used by the app | Yes |
| name | Display name | Yes |
| state | State name | Yes |
| stateCode | Census state FIPS code | Yes |
| countyCode | Census county FIPS code | Yes |
| mapCenter | Default map center as `[lat, lng]` | Yes |
| mapZoom | Default map zoom | Yes |
| storagePrefix | localStorage namespace prefix | Yes |
| censusFile | County census JSON path | Yes for Census Gap Lens |
| boundaryFile | County boundary GeoJSON path | Recommended |
| description | Dashboard description | Recommended |

## Organization schema

Core organization fields are currently defined in `js/crm.js`.

| Field | Purpose | Required |
|---|---|---|
| id | Internal organization id | Auto-generated |
| name | Organization name | Yes |
| type | Service/category type | Strongly recommended |
| status | Record status | Recommended |
| reach | Geographic scope/reach | Recommended |
| confidence | Confidence level | Recommended |
| phone | Phone number | Optional |
| website | Website URL | Optional |
| email | General email | Optional |
| address | Physical address | Strongly recommended for mapping |
| lat | Latitude | Required for map point |
| lng | Longitude | Required for map point |
| focus | Focus areas or tags | Recommended |
| mission | Mission or description | Recommended |
| notes | Internal notes | Optional |

### Organization fields accepted by import/export helpers

The bulk CSV importer and export helpers also recognize several extended fields. These are useful, but not all are fully represented in the core add/edit form yet.

| Field | Status |
|---|---|
| city | Accepted by import/export helpers |
| county | Accepted by import/export helpers |
| primaryContact | Accepted by import/export helpers |
| communitiesServed | Accepted by import/export helpers |
| reachNotes | Accepted by import/export helpers |
| reachBasis | Accepted by import/export helpers |
| reachSourceUrl | Accepted by import/export helpers |
| geocodeSource | Export helper field |

### Legacy organization aliases

Some helper scripts still preserve older field names so previous exports and local data remain usable.

| Legacy alias | Current field |
|---|---|
| tags | focus |
| description | mission |
| geographicReach | reach |
| reachConfidence | confidence |
| latitude | lat |
| longitude | lng |

## Contact schema

| Field | Purpose | Required |
|---|---|---|
| id | Internal contact id | Auto-generated |
| name | Contact name | Yes |
| organizationId | Linked organization id | Recommended |
| role | Title or role | Optional |
| email | Email address | Optional |
| phone | Phone number | Optional |
| strength | Relationship strength | Optional |
| notes | Internal notes | Optional |

Legacy alias:

| Legacy alias | Current field |
|---|---|
| title | role |

## Activity schema

| Field | Purpose | Required |
|---|---|---|
| id | Internal activity id | Auto-generated |
| date | Activity date | Defaults to today |
| type | Activity type | Recommended |
| organizationIds | Linked organization ids | Recommended |
| contactIds | Linked contact ids | Optional |
| summary | Activity summary | Yes |
| followUpDate | Follow-up due date | Optional |
| followUpCompleted | Follow-up completion flag | Optional |
| notes | Internal notes | Optional |

Legacy or helper aliases:

| Alias | Current field |
|---|---|
| orgIds | organizationIds |
| organizations | organizationIds |
| contacts | contactIds |
| nextStep | Used by some export helpers as older summary/follow-up text |

## Relationship schema

| Field | Purpose | Required |
|---|---|---|
| id | Internal relationship id | Auto-generated |
| fromOrgId | Source organization id | Yes |
| toOrgId | Target organization id | Yes |
| strength | Weak, Moderate, or Strong | Recommended |
| status | Potential, Active, or Historic | Recommended |
| summary | Relationship summary | Optional |
| notes | Internal notes | Optional |

Legacy or helper aliases:

| Alias | Current field |
|---|---|
| sourceOrgId | fromOrgId |
| targetOrgId | toOrgId |
| label | Export helper field, not currently core form field |

## Coalitions ambiguity

Coalitions are the main unresolved schema issue found in Phase 2A.

Core storage does not currently list coalitions as an official store. The official core stores are organizations, contacts, activities, and relationships.

However, `js/backup-export-tools.js` still references coalitions in JSON backup/export logic and offers a coalitions CSV export path.

This creates a confusing contract:

- Core storage does not officially save coalitions.
- The backup/export helper implies coalitions may exist.
- The UI may imply support for a data area that is not fully active.

Phase 2B should make one clear decision:

Option A: make coalitions real official data.

- Add `coalitions` to the official storage store list.
- Add restore support.
- Add a clear UI path if coalitions should be editable.
- Add documentation for coalition fields.

Option B: treat coalitions as legacy-only.

- Remove or hide coalition export buttons/references.
- Keep legacy read support only if needed for old backups.
- Do not advertise coalitions as an active data type.

Recommendation: choose Option B unless coalitions are needed soon. The current active app already has organizations, contacts, activities, relationships, map, reports, backup, CSV import, and Census Gap Lens. Adding another official store should not happen casually.

## Required field recommendations

These are recommended validation rules for future cleanup, not all currently enforced in code.

### Organizations

Required:

- name

Strongly recommended:

- type
- status
- reach
- confidence
- address or lat/lng

### Contacts

Required:

- name

Strongly recommended:

- organizationId

### Activities

Required:

- summary
- date

Strongly recommended:

- type
- at least one linked organization when applicable

### Relationships

Required:

- fromOrgId
- toOrgId

Strongly recommended:

- strength
- status

## Storage hardening needs

The current storage system already catches JSON parse errors during reads. However, Phase 2B should add safer handling for:

- localStorage quota failures during save
- unavailable localStorage in restricted browser contexts
- invalid backup JSON shape
- backups with unknown stores
- backups from another county
- restore attempts that would overwrite active county data

## Upload-ready CSV organization headers

The official upload-ready CSV should prefer these headers:

```text
Organization Name
Type
Status
Geographic Scope
Reach
Confidence
Phone
Email
Website
Address
City
County
Latitude
Longitude
Focus Areas / Tags
Mission / Description
Communities Served
Reach Notes
Reach Basis
Reach Source URL
Notes
```

The importer should continue accepting common aliases such as `name`, `organization`, `service type`, `physical address`, `lat`, `lng`, `description`, and `tags`.

## Phase 2B recommended work

1. Decide the coalitions question.
2. Update export/backup behavior to match that decision.
3. Add safer save handling in `js/storage.js`.
4. Add backup validation before restore.
5. Add a small user-facing warning when storage save fails.
6. Keep behavior unchanged for organizations, contacts, activities, relationships, map, reports, backup, and CSV import.

## Phase 2A status

Started on branch:

```text
schema-stabilization-phase-2a
```

This document is the first schema contract for the multi-county CONVENE app.
