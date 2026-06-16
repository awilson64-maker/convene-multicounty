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

Phase 2A decision: coalitions are needed and should become an official CONVENE data store in Phase 2B.

The future official workspace stores should be:

1. organizations
2. contacts
3. activities
4. relationships
5. coalitions

Each county uses its own localStorage namespace. The storage key pattern is:

```text
{county.storagePrefix}:{storeName}
```

Example:

```text
convene:fdl:organizations
convene:waupaca:organizations
convene:fdl:coalitions
convene:waupaca:coalitions
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

## Coalition schema

Phase 2A decision: coalitions are needed and should become an official active CONVENE data type.

The current app has partial coalition support through backup/export helper logic, but coalitions are not yet included in the core storage store list. Phase 2B should promote coalitions from partial helper behavior into the official storage, backup, restore, export, and UI model.

Recommended coalition fields:

| Field | Purpose | Required |
|---|---|---|
| id | Internal coalition id | Auto-generated |
| name | Coalition name | Yes |
| status | Active, emerging, inactive, paused, or historical | Recommended |
| type | Coalition type or issue area | Recommended |
| focus | Focus areas or tags | Recommended |
| organizationIds | Member or participating organization ids | Recommended |
| leadOrganizationId | Lead or backbone organization id | Optional |
| contactIds | Linked contact ids | Optional |
| geographicScope | Countywide, municipal, neighborhood, regional, or multi-county | Recommended |
| meetingCadence | Monthly, quarterly, ad hoc, etc. | Optional |
| lastMetDate | Last known meeting date | Optional |
| nextMeetingDate | Next known meeting date | Optional |
| description | Plain-language coalition description | Recommended |
| notes | Internal notes | Optional |

Recommended coalition aliases for import/export compatibility:

| Alias | Current field |
|---|---|
| tags | focus |
| organizationNames | Derived from organizationIds during export |
| memberOrganizationIds | organizationIds |
| members | organizationIds or organization names, depending on import context |
| leadOrgId | leadOrganizationId |
| scope | geographicScope |

## Coalitions implementation decision

Coalitions were the main unresolved schema issue found in Phase 2A. That decision is now resolved:

Coalitions should be official active data.

That means Phase 2B should not hide coalition export references. Instead, it should make coalition handling honest and complete.

Phase 2B should:

1. Add `coalitions` to the official storage store list.
2. Add coalitions to backup/export/restore as a first-class store.
3. Preserve backwards compatibility with any existing localStorage `coalitions` data.
4. Add or preserve CSV export for coalitions.
5. Add a simple coalition UI only after storage/export/restore are stable.
6. Document whether coalitions are linked to organizations only, or to both organizations and contacts.

Implementation caution: coalitions should not be jammed into relationships. Relationships describe direct org-to-org ties. Coalitions are a separate convening structure with members, status, cadence, scope, and notes.

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

The current storage system already catches JSON parse errors during reads. However, Phase 2B should add safer handling for:

- localStorage quota failures during save
- unavailable localStorage in restricted browser contexts
- invalid backup JSON shape
- backups with unknown stores
- backups from another county
- restore attempts that would overwrite active county data
- partial restores where some stores are valid and others are invalid

## Upload-ready CSV organization headers

The official upload-ready organization CSV should prefer these headers:

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

## Upload-ready CSV coalition headers

A future upload-ready coalition CSV should prefer these headers:

```text
Coalition Name
Status
Type
Focus Areas / Tags
Geographic Scope
Lead Organization
Member Organizations
Meeting Cadence
Last Met Date
Next Meeting Date
Description
Notes
```

Phase 2B does not need to build coalition CSV import immediately, but it should avoid designing storage in a way that blocks it.

## Phase 2B recommended work

1. Promote `coalitions` to an official store in `js/storage.js`.
2. Update backup restore/export behavior so coalitions are included consistently.
3. Add safer save handling in `js/storage.js`.
4. Add backup validation before restore.
5. Add a small user-facing warning when storage save fails.
6. Keep behavior unchanged for organizations, contacts, activities, relationships, map, reports, backup, and CSV import.
7. Add coalition UI only after storage and backup behavior are stable.

## Phase 2A status

Started on branch:

```text
schema-stabilization-phase-2a
```

This document is the first schema contract for the multi-county CONVENE app.
