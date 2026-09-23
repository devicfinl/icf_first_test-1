# Product Requirements Document

## Product
Organization Member Portal

## Problem
The organization has no central platform for managing members, sharing news/events/, and letting the public get in touch. Everything currently happens informally, making it hard to track membership, publicize events, and showcase activities. Additionally, the current site only has a single generic "organization" login — there is no way for individual members or office-bearers to log in with their own identity and position.

## Target Users
- **Public visitors** — browse events, blog/news, gallery, and contact the organization
- **General members** — maintain a profile, view/register for events, access member-only content
- **Committee members / office-bearers** (President, Vice President, Secretary, Treasurer, etc.) — hold elevated permissions tied to their position, in addition to regular member access
- **Super admin** — full technical control of the platform (site owner / developer account)

## Goal
Replace the single shared "organization" login with individual member accounts, each logged in under their own identity and position, so responsibility and permissions are tied to the actual person holding a role — not a shared credential.



## Roles & positions
Two things are tracked separately so permissions stay simple while titles stay meaningful:

| Field | Purpose | Example values |
|---|---|---|
| `role` | What the account can *do* (permission tier) | `SUPER_ADMIN`, `ADMIN`, `MEMBER`, `GUEST` |
| `position` | What the person *is called* in the org | `President`, `Vice President`, `Secretary`, `Treasurer`, `Committee Member`, `General Member` |

By default, office-bearer positions (President, Secretary, Treasurer, etc.) are assigned the `ADMIN` role; general members get `MEMBER`. This keeps permission logic simple (still just 4 roles to check in code) while letting the UI display each person's real position.

> **Open question:** should every office-bearer have full admin rights, or should permissions differ by position (e.g. Treasurer sees finance/membership data but not blog publishing)? Flagging this — confirm before we lock the role→permission mapping.

## MVP
- [ ] Individual member signup/login (replacing the shared organization login)
- [ ] Role-based access (SUPER_ADMIN, ADMIN, MEMBER, GUEST) + position field for display
- [ ] Member profile view/edit, including position
- [ ] Admin: approve/manage members, assign positions
- [ ] Create / list / view events
- [ ] Register for an event
- [ ] Create / edit / publish blog & news posts
- [ ] Create albums and upload media
- [ ] Public contact form + admin inbox with status tracking
- [ ] Notice board for organization-wide announcements
- [ ] Document library (upload/download for members)
- [ ] Public committee directory page

## Out of Scope (v1)
- Online payments / paid membership tiers
- Mobile app
- Real-time chat / notifications
- Multi-language support
- Comment system on posts
- Per-position granular permissions beyond the ADMIN/MEMBER split (revisit post-MVP)

## Success Criteria
A member should be able to:
1. Log in with their own account (not a shared organization login)
2. View their assigned position on their profile
3. View upcoming events and register for one
4. Read blog/news posts and organization announcements
5. Browse the photo gallery and download shared documents

An admin/office-bearer should be able to:
1. Approve or manage member accounts and assign positions
2. Create/edit an event
3. Publish a blog/news post or announcement
4. Upload photos to an album or documents to the library
5. View and resolve contact inquiries
