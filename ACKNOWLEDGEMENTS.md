# Credits and provenance

## Earlier implementation and documentation

This workspace retains an earlier **Astronaut Health Intelligence / AHI** implementation and a substantial bilingual technical portal. Existing documentation identifies the reference repository as:

https://github.com/lucaspalharesbarbosa/astronaut-health-intelligence-platform

The Astromigos work builds on that foundation. The new branding and layout, public Artemis II presentation, individual demonstration-history workspace, numbered action guidance, and follow-up tracker must not be presented as authorship of every earlier component.

The supplied workspace had no Git history or root license file when publication preparation began. Existing anatomy documentation describes the earlier application code as MIT, but that is not a substitute for the original license notice. Maintainers should retain or restore the original applicable notice when its authoritative copy is available. This document does not assign a new blanket license to all source code.

## Anatomy assets

The derived atlas uses **Z-Anatomy** and **BodyParts3D** reference anatomy. The exported assets carry a **CC BY-SA 4.0** notice with upstream attribution, source details, modifications, and excluded content:

[Anatomy asset license](frontend/web/public/anatomy/LICENSE.md).

That notice applies to the anatomy assets, not automatically to application code, branding, datasets, or every dependency.

## Public crew identities and portraits

The Artemis II demonstration profiles use public names, roles, and official portraits from [NASA's crew page](https://www.nasa.gov/feature/our-artemis-crew/). The source-image identifiers are listed in [portrait credits](frontend/web/public/crew/CREDITS.md).

Reid Wiseman, Victor Glover, Christina Koch, and Jeremy Hansen have not supplied personal medical records to this project. Their simulated profile measurements, histories, symptoms, and outcomes must not be interpreted as real health information.

## NASA identifiers

The NASA insignia remains in the main header at the team's request. Its inclusion does not imply endorsement, sponsorship, certification, or participation by NASA. See [NASA's brand guidance](https://www.nasa.gov/nasa-brand-center/brand-guidelines/) for identifiers and their use.

## Astromigos artwork

The Astromigos Team artwork was supplied by the project team and is used as the small toolbar mark and browser icon. It is not NASA artwork. No separate public reuse license for that team artwork is assigned here.

## Historical public datasets

Existing files include NASA OSDR reference panels **OSD-569** and **OSD-575** from Inspiration4. Source metadata, file hashes, and collection context are retained in `data/` and the bundled panel metadata. Where the source did not state a license, the project records that uncertainty rather than assigning one.

These historical public panels are distinct from the fictional Artemis II demonstration profiles and the locally generated live simulation.

## Software dependencies

React, Vite, TypeScript, Tailwind CSS, Zustand, Three.js, React Three Fiber, Recharts, Lucide, Vitest, and other dependencies remain subject to their respective licenses. Dependency versions and resolved packages are recorded in the committed lockfiles.
