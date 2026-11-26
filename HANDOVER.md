# Handing over / moving this project

Everything needed to run WebXR Classes is in this repository. There is no build step, no database, no server of
our own, no passwords or API keys, and no account tied to the code. It can be moved to another GitHub account
or organisation (e.g. a school's or company's) or another computer, and it keeps working without code changes.

## Where it lives now

- Repository: https://github.com/JPInspired/WebXRProjects (Inspired Education Group), moved there on 18 November 2026
  with its full history and its restore points (git tags): `v1.0` (the first library), `v1.1` (every lesson
  polished, the shared lab kit, the frame-rate counter and safety net, the testing checklist) `v1.2` (the same
  feel in every lesson, teacher guides, lesson cards with time and ages, Inspired-style wording) `v1.3` (subject
  rooms and joining a class with only its code, before automatic reconnection) and `v2.0` (everything to 19 November
  2026: automatic reconnection, the Network Check page, bare hands, the loading screen and the Class tools; also a
  GitHub Release, downloadable as one zip from the Releases page), `v2.1` (just before the polish pass), `v2.2` (the
  polish pass: one house style for the panels, the lab's shadow and arrival in the real room, Hands in front, one
  family of sounds) and `v2.3` (the clean-up and security review: unused code removed, the teacher's key so only the
  real teacher runs a class, checked messages between headsets and the stronger Remove) and `v2.4` (23 November 2026: teacher-friendly start screen, Inspired-style wording, the checklist and network pages removed, and "see what the textbook only describes" in the Enzyme, Acid, Kinetics and Osmosis labs and Identifying Organs, each with Show Everyone for the teacher). Each newer feature also has an off
  switch: the rooms in `shared/fx/Classroom.js` (`ROOMS.enabled`), reconnection in `shared/net/config.js` (`autoReconnect`), bare-hand help in `shared/ui/Hands.js`
  (`HANDS.enabled`), the loading screen and fades in `shared/fx/Loading.js` (`LOADING.enabled`) the Class tools in
  `shared/ui/ClassTools.js` (`CLASS_TOOLS.enabled`), the visible room line-up and floor marks in `shared/net/RoomLineUp.js`
  (`ROOM_LINEUP.enabled`) the real-room features in `shared/fx/RealRoom.js` (`REAL_ROOM.enabled`), the shadow and arriving in `shared/fx/Grounding.js` (`GROUNDING.enabled`) and the house style of the panels in `shared/ui/CanvasPanel.js` (`STYLE.enabled`). Restore point `v2.1` is the library just before the house style, the shadows and the new sounds. To see or go back
  to one: `git checkout v1.2` (or download it from the repository's Tags page on GitHub). To put the live website
  back to one: `git revert --no-edit <tag>..HEAD`, then push: this undoes everything since, keeping the history.
- Offline copies: `Documents/WebXR-Backups/` on the original computer holds a git bundle of the whole history (every
  commit and restore point) of this project and of Edge Preview. To restore one: `git clone webxr-library-2026-11-19.bundle
  webxr-classes`, then `git remote add origin <repository address>`.
- Website: https://jpinspired.github.io/WebXRProjects/ (deployed by GitHub Actions on every push to `main`).
- The earlier home, `antoniosousapedro99-png/webxr-classes`, was a personal account and is no longer updated.

## What you need

- A copy of this repository (with its history, ideally).
- Somewhere that serves static files over **HTTPS** (WebXR requires it). GitHub Pages is free and already set up.

## Option A: transfer the GitHub repository (keeps history, issues and settings)

1. On GitHub: **Settings → General → Danger Zone → Transfer ownership**, and choose the new account or organisation.
2. In the new location: **Settings → Pages → Source: GitHub Actions**. The workflow in
   `.github/workflows/pages.yml` deploys every push to `main`.
3. The site address becomes `https://<new-owner>.github.io/webxr-classes/`. GitHub redirects the old
   *repository* address, but **not** the old Pages site, so share the new link (and bookmark it on the headsets).
4. Link previews (the picture shown when a link is shared) need the site's full address. Update them with
   `node tools/lesson-images/share-picture.mjs <served project> https://<new-owner>.github.io/webxr-classes/`
   (see `tools/lesson-images/README.md`). Everything else works under any address.

## Option B: copy to a new repository, or to another computer

```bash
git clone --mirror https://github.com/<old-owner>/webxr-classes.git
cd webxr-classes.git
git push --mirror https://github.com/<new-owner>/webxr-classes.git
```

Then turn on Pages as in A.2. Without git, **Code → Download ZIP** on GitHub gives every file (no history); upload
the files to the new repository.

To run on a computer without GitHub: serve the folder with any static web server (see *Running it* in the README).

## Nothing to edit in the code

- All links inside the project are relative, so it works under any address. The one exception is the link previews
  (the `link preview` block at the top of each page): update their address after a move (see A.4).
- Shared sessions keep working across the move: devices just need to open the lessons from the same address.
- The only settings files: `shared/net/config.js` (networking), and each lesson’s `config.js` (optional AI expert
  servers, all off by default).

## Outside services it relies on (all free, no account)

| What | Used for | Where it's set |
| --- | --- | --- |
| `cdn.jsdelivr.net` | three.js (3D engine) and the 3D-model decoders | the `importmap` in each lesson's `index.html` |
| Nostr relays `nos.lol`, `relay.primal.net`, `nostr.mom` | introducing devices in a shared session | `shared/net/config.js` |
| STUN servers (Google, Cloudflare) | checking devices are on the same network; connecting them | `shared/net/config.js` |
| GitHub Pages | hosting | `.github/workflows/pages.yml` |

## Licences: check before using commercially

The project's own code has **no licence file yet**: the owner should choose one (for company property, usually
"All rights reserved" / proprietary). Third-party parts:

| Part | Licence | Commercial use |
| --- | --- | --- |
| three.js, three-mesh-bvh, Trystero (`shared/vendor/TRYSTERO-LICENSE`) | MIT | yes, keep the licence notices |
| Most Reef Dive models | CC BY 4.0 | yes, keep the credits in the `CREDITS.md` files |
| Some Reef Dive models | CC0 | yes |
| **Heart Lab heart model** (`lessons/heart-lab/models/heart.glb`, `heart.json`) | CC BY-SA 2.1 Japan (BodyParts3D) | yes, keep the credit in its `CREDITS.md`; changes to these two files stay under the same licence |
| **Identifying Organs skeleton and organs** (`lessons/organs-lab/models/body.glb`) | CC BY-SA 2.1 Japan (BodyParts3D) | yes, keep the credit in its `CREDITS.md`; changes to this file stay under the same licence |
| Identifying Organs (everything else) | made in code for this project, following the original Inspired Education EngageVR lesson | yes (it is the project’s own) |
| Acid Lab (everything) | made in code for this project | yes (it is the project’s own) |
| Lithium Reactions (everything) | made in code for this project, following the original Inspired Education EngageVR lesson | yes (it is the project’s own) |
| Kinetics Lab (everything) | made in code for this project, following the original Inspired Education EngageVR lesson | yes (it is the project’s own) |
| Voltaic Lab (everything) | made in code for this project, following the original Inspired Education EngageVR lesson | yes (it is the project’s own) |
| Waves Lab (everything) | made in code for this project | yes (it is the project’s own) |
| Bounce Lab (everything) | made in code for this project | yes (it is the project’s own) |
| Radiation Lab (everything) | made in code for this project | yes (it is the project’s own) |
| Circular Motion (everything) | made in code for this project, following the original Inspired Education EngageVR lesson | yes (it is the project’s own) |
| Kinematics Lab (everything) | made in code for this project, following the original Inspired Education EngageVR lesson | yes (it is the project’s own) |
| Pendulum Lab (everything) | made in code for this project, following the original Inspired Education EngageVR lesson | yes (it is the project’s own) |
| Microscope Lab (everything) | made in code for this project, following the original Inspired Education EngageVR lesson | yes (it is the project’s own) |
| Enzyme Lab (everything) | made in code for this project, following the original Inspired Education EngageVR lesson | yes (it is the project’s own) |
| Osmosis Lab (everything) | made in code for this project, following the original Inspired Education EngageVR lesson | yes (it is the project’s own) |
| **Art Gallery paintings** (`lessons/art-gallery/paintings/`) | public domain (photographs of old paintings, from Wikimedia Commons; sources in its `CREDITS.md`) | yes |
| Art Gallery (everything else) | made in code for this project, following the Inspired Education "Seated Art Gallery" lesson plan | yes (it is the project’s own) |
| Hiroshima, 6 August 1945 | made in code for this project, plus five CC0 photo textures from Poly Haven (`lessons/hiroshima/textures/`, see its `CREDITS.md`) | yes |
| Heart Lab sounds, blood flow, ECG, backup heart | made in code for this project | yes (it is the project’s own) |
| **Reef Dive hammerhead** (`hammer.glb`) | CC BY-NC 4.0 | **no**: replace it before any commercial use |
| Lessons page pictures and link previews (`assets/lessons/`, `assets/share/`) | screenshots of the lessons; those showing third-party models carry their licences (see `assets/lessons/CREDITS.md`) | yes, except `reef-dive*` (shows the non-commercial hammerhead): re-capture it once the hammerhead is replaced |
| **Reef Dive manta ray** (`manta.glb`) | CC BY-NC-SA 4.0 | **no**: replace it before any commercial use |
| **Reef Dive parrotfish** (`parrotfish.glb`) | Sketchfab Standard, used with the owner's permission | get that permission confirmed for the new owner, or replace it |

Full sources: `lessons/reef-dive/models/CREDITS.md`.

## Rule for all future changes

Keep the project self-contained and portable:

- no hard-coded account names, personal addresses or absolute links to one GitHub account;
- no secrets in the repository (it is served publicly);
- never trust another headset's messages: check them (see "Security and safeguarding" in the README), and keep
  teacher-only actions behind the teacher's key (`shared/net/teacherKey.js`);
- every new model, texture or sound gets its source and licence recorded in a `CREDITS.md` beside it;
- any new outside service is added to the table above.
