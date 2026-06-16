# CONVENE Data Schema Audit

Status: updated after Phase 3D  
Last updated: 2026-06-16  
Repository: awilson64-maker/convene-multicounty

## Purpose

This document defines the current working data model for the CONVENE multi-county app. It is meant to prevent hidden data conflicts as the app expands beyond Fond du Lac County.

## Current official storage model

The core storage module currently treats these as the official workspace stores:

1. organizations
2. contacts
3. activities
4. relationships
5. coalitions

Each county uses its own localStorage namespace. The storage key pattern is:

```text
{county.storagePrefix}:{storeName}
```

Examples:

```text
convene:fdl:organizations
convene:fdl:contacts
convene:fdl:activities
convene:fdl:relationships
convene:fdl:coalitions
convene:waupaca:organizations
convene:waupaca:coalitions
```

This separation is central to preventing Fond du Lac data from leaking into Waupaca or future counties.

## Current implementation checkpoint

As of Phase 3D:

- Coalitions are official storage.
- Coalitions are included in JSON backup export.
- Coalitions are preserved during backup restore.
- Coalitions have a basic list/add/edit/delete UI.
- Coalitions can link to organizations and contacts.
- Reports do not yet summarize coalitions.
- The older core `app.js` workspace still directly manages organizations, contacts, activities, and relationships. Coalitions are handled through official storage and the Coalitions UI helper.

That last point is stable but should eventually be cleaned up. The long-term goal is for `app.js` to become fully coalition-aware instead of relying on storage preservation and a helper UI.

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

Note: the current map boundary helper draws the boundary from the county census GeoJSON file. `boundaryFile` is present in config and should remain part of the setup model, but it is not the active source for the current boundary overlay.

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

## Coalition schema

Coalitions are official active CONVENE data.

Current coalition fields:

| Field | Purpose | Required |
|---|---|---|
| id | Internal coalition id | Auto-generated |
| name | Coalition name | Yes |
| status | Active, Emerging, Paused, Inactive, or Historical | Recommended |
| type | Coalition type or issue area | Recommended |
| focus | Focus areas or tags | Recommended |
| organizationIds | Member or participating organization ids | Recommended |
| leadOrganizationId | Lead or backbone organization id | Optional |
| contactIds | Linked contact ids | Optional |
| geographicScope | Countywide, Municipal, Neighborhood, Regional, Multi-county, or Unknown | Recommended |
| meetingCadence | Monthly, quarterly, ad hoc, etc. | Optional |
| lastMetDate | Last known meeting date | Optional |
| nextMeetingDate | Next known meeting date | Optional |
| description | Plain-language coalition description | Recommended |
| notes | Internal notes | Optional |

Current coalition aliases for compatibility:

| Alias | Current field |
|---|---|
| tags | focus |
| memberOrganizationIds | organizationIds |
| members | organizationIds or organization names, depending on import context |
| leadOrgId | leadOrganizationId |
| scope | geographicScope |
| organizationNames | Derived from organizationIds during export |

Implementation caution:

Coalitions should not be jammed into relationships. Relationships describe direct org-to-org ties. Coalitions are a separate convening structure with members, status, cadence, scope, and notes.

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

### Coalitions

Required:

- name

Strongly recommended:

- status
- type or focus
- geographicScope
- organizationIds when known
- description

## Storage hardening needs

The current storage system catches JSON parse errors during reads and preserves coalitions during normal app saves and restores. Future hardening should add safer handling for:

- localStorage quota failures during save
- unavailable localStorage in restricted browser contexts
- invalid backup JSON shape
- backups with unknown stores
- fully native coalition awareness inside `app.js`

## Backup model

JSON backups should include:

```text
organizations
contacts
activities
relationships
coalitions
```

Backups are county-specific. If a backup appears to belong to another county, the app warns before restoring.

## Current next cleanup target

The safest next data-model cleanup is to make `app.js` fully coalition-aware, but that should wait until after the current stable report and coalition work has been used a bit more.
