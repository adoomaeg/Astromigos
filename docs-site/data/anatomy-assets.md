---
title: 3D Anatomy Assets
description: Provenance of the 3D anatomical model of the Astronaut Health Intelligence Platform as a third party asset, Z-Anatomy under CC BY-SA 4.0, with required attribution, checksum, modifications, exclusions, naming rules and rebuild steps.
status: IMPLEMENTED
code:
  - frontend/web/public/anatomy/manifest.json
  - frontend/web/public/anatomy/LICENSE.md
  - frontend/web/scripts/anatomy/build.mjs
  - frontend/web/scripts/anatomy/fetch-source.mjs
  - frontend/web/scripts/anatomy/export_atlas.py
  - frontend/web/scripts/anatomy/build-kidneys.ts
  - frontend/web/scripts/anatomy/optimize.mjs
  - frontend/web/scripts/anatomy/validate.mjs
  - docs/anatomy-assets.md
tests:
  - frontend/web/src/features/anatomy/atlas/manifest.contract.test.ts
verified: 2026-11-14
---

# 3D Anatomy Assets

The 3D body of the Astronaut Health Intelligence Platform (AHI) is built from a **third party model**: the Z-Anatomy atlas. This page is the canonical record of where the model comes from, under which license it is shipped, what was changed, what was left out and how to rebuild it. How the viewer uses the files is in [3D anatomy rendering](../architecture/anatomy-3d).

::: warning Two licenses in one repository
The **application code** is released under the MIT License. The **anatomy files** in `frontend/web/public/anatomy/` (`*.glb` and `manifest.json`) are a derived work of Z-Anatomy and are distributed under **CC BY-SA 4.0**. The MIT License does not apply to them. If you reuse or modify these files you must keep the attribution below and share your version under the same license.
:::

The atlas is reference anatomy, not health data: it carries no `data_origin` label and nothing in it describes a crew member. Health data origins are defined in [Data origins and provenance](./data-origins).

## Source {#source}

| Item | Value |
| --- | --- |
| Model | Z-Anatomy, "Human male model" (the libre 3D atlas of anatomy), based on BodyParts3D |
| Project | [z-anatomy.com](https://www.z-anatomy.com/) |
| Repository | [github.com/Z-Anatomy/Models-of-human-anatomy](https://github.com/Z-Anatomy/Models-of-human-anatomy) |
| File | `Z-Anatomy.zip` (86,734,957 bytes), which contains `Z-Anatomy/Startup.blend` |
| Download URL | `https://raw.githubusercontent.com/Z-Anatomy/Models-of-human-anatomy/master/Z-Anatomy.zip` |
| SHA-256 of the zip | `e029688545627bd0214b269e1063143abb580aad72b2c2445d6d8a9a0d9da736` |
| Date obtained | 2026-11-14 |
| Source format | Blender file (.blend): meters, Z up, about 7,180 objects, flat material colors, no image textures |
| Published format | glTF 2.0 binary (GLB), one file per anatomical system, with `EXT_meshopt_compression` and `KHR_mesh_quantization`, plus `manifest.json` |
| Published location | `frontend/web/public/anatomy/` (nine GLB files, `manifest.json`, `LICENSE.md`) |

The same facts travel with the files: in `public/anatomy/LICENSE.md` and inside `manifest.json` under `source`. The source archive itself is not committed; the pipeline downloads it into a cache folder ignored by git and rejects it when the checksum differs.

## License and attribution {#license-and-attribution}

Z-Anatomy is distributed under the **Creative Commons Attribution-ShareAlike 4.0 International** license ([CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)). The derived GLB files and the manifest are distributed under the same license.

Attribution lines required by the upstream license file, exactly as written there:

```text
Z-Anatomy - The libre 3D atlas of anatomy - CC-BY-SA 4.0
BodyParts3D - The Database Center for Life Science - CC-BY-SA 2.1 Japan
```

| Authors listed upstream | Role |
| --- | --- |
| Kousaku Okubo | BodyParts3D |
| Gauthier Kervyn | Design, 3D, anatomy |
| Marcin Zielinski | Blender add-on |
| Lluis Vinent | Unity development |

The upstream license file also lists models that Z-Anatomy used as reference or included and adapted:

| Upstream model | License | In the AHI files |
| --- | --- | --- |
| "Brainder" and "White matter", University of Washington | no separate license recorded in the AHI files | Part of the upstream atlas |
| "Cranial Nerves and Foramina", University of Dundee, CAHID | CC BY 4.0 | Part of the upstream atlas |
| "Anatomy of the Inner Ear", University of Dundee School of Medicine | CC BY-NC-SA 4.0 (non commercial) | **Excluded** |
| "Kidney", Lissie Cowley | CC BY-NC 4.0 (non commercial) | **Excluded**, replaced by AHI procedural kidneys |

Where the attribution appears in the app: a caption under the 3D body ("Reference anatomy: Z-Anatomy atlas (CC BY-SA 4.0)") that is always visible, an "About the reference anatomy" popover with the credits, and a "Reference anatomy" badge on every selected structure.

## Modifications made by AHI {#modifications}

The upstream model was changed. Everything is done by scripts in `frontend/web/scripts/anatomy/`, headless, so the result is reproducible.

In Blender (`export_atlas.py`):

1. **Classification.** Every mesh and curve object of the used collections is matched by name and by its ancestor labels to one structure, or dropped. Unmatched objects are reported.
2. **Modifiers** are evaluated in a new empty scene, with Subdivision Surface limited to one level.
3. **Curves to tubes.** Vessels, nerves, bronchi and ducts are curves upstream. They become tube meshes with 4 to 8 sides. Tubes thinner than 0.55 mm are widened to that radius so small vessels and nerves stay visible at full body zoom.
4. **Join.** All source objects of a structure become one mesh named with the structure id (about 2,230 source objects become 250 structures).
5. **Cleanup.** Transforms applied, mirrored objects fixed so normals point outward, vertices welded, faces triangulated, smooth shading.
6. **Skin.** About 250 region patches are joined into one single layer surface, and the normals are blended across the seams between regions.
7. **Neutral body surface.** The external genital region of the skin is removed and closed with a smooth neutral surface that blends into the lower abdomen, the perineum and the inner thighs. The skin stays one single surface (see [What was excluded](#exclusions)).
8. **Decimation.** Each system has a triangle budget shared between its structures. About four fifths of the source triangles are removed.
9. **Frame.** The model is moved so the feet are on the ground and the body is centered, then exported with Y up.
10. **Materials.** The upstream materials are replaced by one neutral material per tissue class. The viewer assigns its own materials from the `tissue` field.
11. **Export.** One GLB per system: normals included, no UVs, tangents, vertex colors, cameras, lights, animations or skins.

In Node (`optimize.mjs`, with glTF Transform and meshoptimizer): the kidneys are added, then dedup, weld, prune, positions snapped to a 1/16384 m grid (0.06 mm), normals stored as 8 bit integers and every buffer compressed with meshopt. Mesh nodes keep an identity transform, so the viewer can scale a node freely (heartbeat, breathing).

## What was excluded and why {#exclusions}

The exact object names of the first three groups are recorded in `manifest.json` under `source.excluded`.

| Group | What | Why |
| --- | --- | --- |
| Ear | Internal ear, auditory ossicles, tympanic membrane, auditory tube, cochlear and vestibular nerves | The upstream "Anatomy of the Inner Ear" model has a **non commercial** license. When in doubt the whole ear was removed |
| Kidney | Kidney and renal pelvis meshes, intrarenal vessel curves | The upstream "Kidney" model has a **non commercial** license. Replaced by AHI geometry |
| Reproductive structures | 33 source objects: internal and external genital organs, the vessels, nerves and ducts that only serve them, and the urethra (its course in the source model runs through the external genitalia). The two urogenital patches of the skin are removed and the opening is closed with a smooth neutral surface | **Product decision**: the atlas stands for every crew member and no monitored metric relates to these structures, so the shipped model is a neutral reference body |
| Not physical bodies | Text labels and their leader lines, group titles, muscle origin and insertion maps, reference lines and planes, cross section planes, objects that only exist in the upstream "Bonus collection" | Helper objects of the Z-Anatomy Blender add-on, not anatomy |
| Left out for clarity | Lymph nodes, tonsils, fasciae, bursae, tendon sheaths, ligaments, joint capsules and membranes, meninges, pleura, peritoneum and omenta, ventricles and other cavities, hair, liver segments, small brainstem nuclei, inner white matter surface of the cerebrum | They wrap or hide other structures, or cost draw calls without helping the health view |

`validate.mjs` fails the build if an excluded kidney, ear or reproductive source object slips into a published structure.

## Procedural kidneys {#procedural-kidneys}

The structures `kidney-left` and `kidney-right` do **not** come from Z-Anatomy. `build-kidneys.ts` builds them with AHI's own signed distance field code (the same toolkit as the procedural fallback viewer): a tilted ellipsoid with a smooth hilum notch. `optimize.mjs` then fits each one to the bounding box (center and size) of the corresponding atlas kidney. Only those six numbers per kidney are read from the atlas; no upstream kidney geometry is used.

In the manifest they are marked `"origin": "ahi-procedural"`, and the app shows the badge "AHI procedural" for them. They are distributed under the same CC BY-SA 4.0 license as the rest of the folder.

## Structure naming rules {#naming-rules}

Every structure is one mesh node in the GLB of its system, and the node name is the structure id. The manifest fields are described in [Manifest contract](../architecture/anatomy-3d#manifest-contract).

| Rule | Example |
| --- | --- |
| Ids are kebab-case English anatomical names, meant to stay stable between builds | `rectus-abdominis` |
| A single paired structure ends with its side | `femur-left`, `lung-right`, `kidney-left` |
| A merged group of small structures names the side inside | `bones-of-left-hand`, `arteries-of-left-upper-limb` |
| Midline or merged structures have no side | `skull`, `heart`, `aorta` |
| `side` is `L`, `R` or `null`; left structures are at x > 0 | |
| `parent` is used for three structures | `coronary-arteries` and `cardiac-veins` (parent `heart`), `cerebrum-deep-structures` (parent `brain`) |
| Seven ids are required by the application | `skin`, `heart`, `lung-left`, `lung-right`, `brain`, `kidney-left`, `kidney-right` |

Grouping is a design choice: small muscles, hand and foot bones, vessels and nerves are merged by region to keep about 250 selectable structures. Structures, triangles and size per system: [Systems and files](../architecture/anatomy-3d#systems-and-files).

## Coordinate frame {#coordinate-frame}

Meters, Y up, body facing +Z, feet on y = 0, centered on x = 0 and z = 0. Anatomical left is +X, so the heart sits at x > 0. Bounds of the published model: x from -0.340 to 0.340, y from 0 to 1.710, z from -0.147 to 0.147. All mesh nodes have an identity transform.

The Blender source uses another frame (Z up, body facing -Y); the export script converts it.

## Rebuild {#rebuild}

Prerequisites:

| Requirement | Notes |
| --- | --- |
| Blender 4.5 LTS | Any install or portable build. Pass its path with `BLENDER_BIN` or `--blender` |
| Node.js 20 or newer | With the dependencies of `frontend/web` installed (`npm ci`). The pipeline uses the pinned dev dependencies `@gltf-transform/*`, `meshoptimizer` and `tsx` |
| Disk and time | About 500 MB for the cache and about 5 minutes |
| Network | One download from `raw.githubusercontent.com`, the only host the script contacts |

Run inside `frontend/web`:

```bash
# tell the pipeline where Blender is (PowerShell: $env:BLENDER_BIN = "C:\path\to\blender.exe")
export BLENDER_BIN="/path/to/blender"

npm run anatomy:build      # fetch, Blender export, kidneys, optimize, validate
npm run anatomy:validate   # only the contract checks on public/anatomy
```

| Option | Meaning |
| --- | --- |
| `--blend <path>` (or `ANATOMY_SOURCE_BLEND`) | Use an already extracted `Startup.blend`; skips the download |
| `--skip-blender` | Reuse the raw export of the previous run (kidneys, optimize and validate only) |
| `--previews` | Also render preview sheets of the published files into the cache folder |
| `--cache <dir>`, `--out <dir>` | Work folder (default `frontend/web/.cache/anatomy`) and output folder (default `public/anatomy`) |

Example: `npm run anatomy:build -- --blend D:/models/Startup.blend --previews`

Safety: the source is treated as untrusted data. The download is checked against the pinned SHA-256, and Blender starts with `--factory-startup --disable-autoexec`, so scripts embedded in the blend file never run.

## Update procedure {#update-procedure}

When Z-Anatomy publishes a new version:

1. Download the new archive, compute its SHA-256 and size, and read the upstream `License.txt` again: license, attribution text and the list of third party models. New non commercial content must be added to the exclusion rules.
2. Update the pinned checksum and size in `fetch-source.mjs`, and the source record (`sha256`, `retrievedAt`) in `optimize.mjs`.
3. Run `npm run anatomy:build -- --previews` and read the log: unmatched objects are renamed or new structures, and dropped structures lost all their source objects. Adjust the rule functions in `export_atlas.py`.
4. Keep the structure ids stable. If an id has to change, bump `version` in the manifest and update the health mapping ([How to add or rename a structure](../engineering/contributing#add-or-rename-an-anatomical-structure)).
5. Check the preview sheets, the size report and the validation. Then update the numbers and dates: `public/anatomy/LICENSE.md`, the repository guide and the [systems table](../architecture/anatomy-3d#systems-and-files).

The complete guide, with every grouping rule, budget and script option, is <CodeLink path="docs/anatomy-assets.md" /> in the repository.

## Limitations {#limitations}

- **Single reference model, made neutral.** The source is one adult male model, used as reference anatomy for every crew member. Only the groin was made neutral: the reproductive structures are not exported and that part of the skin is a smooth surface. The build, the proportions and the chest remain those of the male source model. It is not a scan of any astronaut and it does not adapt to sex, height or body composition.
- **Neutral groin surface.** It is a generated membrane, not anatomy. The urethra is not exported, so the urinary bladder has no outlet in the model.
- **Procedural kidneys.** Simple bean shaped surfaces placed where the atlas kidneys are, with no internal anatomy.
- **Missing structures.** No ear structures, no reproductive structures, no lymph nodes, fasciae, ligaments or meninges (see [What was excluded](#exclusions)).
- **No textures upstream.** All surface detail comes from geometry and from the viewer materials.
- **Decimation.** About four fifths of the source triangles are removed. Thin sheets and long tubes are the most simplified; the smallest vessels and nerves are drawn thicker than in reality.
- **Skin.** Built from region patches without thickness; a few faint shading seams remain. The eyes are separate structures with a single material.
- **Grouping.** Individual vertebrae, ribs and teeth are not selectable one by one.
- This is decision support and education material, not a medical device.

## Next steps

- [3D anatomy rendering](../architecture/anatomy-3d): how the viewer loads and draws these files.
- [Anatomy to health mapping](../architecture/data-model#anatomy-to-health-mapping): how structures relate to monitored metrics.
- [Governance and privacy](./governance-and-privacy#third-party-licenses): licenses of everything third party.
