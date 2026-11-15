# Running and publishing Astromigos

## Local development

Use Node.js 24 and npm:

```sh
cd frontend/web
npm ci
npm run dev
```

The terminal prints the local address. No backend, database, or API key is required.

## Production checks

Run these commands inside `frontend/web`:

```sh
npm test
npm run build
npm run verify:pages
npm run preview
```

The output directory is `frontend/web/dist`. `vite preview` is a local verification server, not the public hosting service.

## GitHub Pages

The repository includes `.github/workflows/pages.yml`. It runs on a push to `main` or a manual workflow dispatch.

1. Publish the prepared source to a repository in your GitHub account.
2. Open the repository's Settings, then Pages.
3. Set the publishing source to **GitHub Actions**.
4. Push to `main`, or run **Publish Astromigos to GitHub Pages** from the Actions tab.
5. Wait for the deployment job to succeed. Its environment output is the verified public address.

For a normal project repository, the address has the form `https://OWNER.github.io/REPOSITORY/`. An account site or custom domain may use a host-root address instead. Use the URL returned by the actual deployment, not a guessed address.

The workflow reads the configured Pages base path and supplies `VITE_BASE_PATH` to Vite. Logos, crew portraits, the built application, and anatomy assets follow that base. This avoids the common failure where the HTML loads but files are requested from the wrong repository path.

The workflow uses the built-in `GITHUB_TOKEN` with job-scoped permissions. No personal access token belongs in this repository or in a `VITE_*` variable. Variables exposed through Vite become part of the public browser build.

## Verify a repository-path build locally

```sh
cd frontend/web
VITE_BASE_PATH=/astromigos/ npm run build
VITE_BASE_PATH=/astromigos/ npm run verify:pages
VITE_BASE_PATH=/astromigos/ npm run preview
```

Open the printed preview origin with `/astromigos/` appended. Replace `astromigos` if the repository has a different name. A normal `npm run build` without that variable returns to a host-root build.

`verify:pages` checks the built HTML references, the two logos, four crew portraits, anatomy notice, manifest, and referenced system files. It is a static artifact check, not a substitute for a browser review of WebGL and interactions.

## What gets published

The Pages artifact contains only `frontend/web/dist`. It does not contain the source tree, node_modules, local editor settings, or local-storage records. Source is visible separately in the GitHub repository according to its visibility setting.

The earlier `docs-site/` portal is retained as source reference. This workflow publishes the current Astromigos application, not that older portal. Current project documentation is in `README.md` and `docs/` and is readable directly on GitHub.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Pages configuration job fails | Enable Pages with GitHub Actions and verify repository/account permissions. |
| Blank page or missing images | Verify the Pages base path, then rerun the artifact check. |
| Anatomy unavailable | Confirm `anatomy/manifest.json` and referenced GLB files are in the deployed artifact. |
| npm installation fails | Use the committed lockfile and Node.js 24. |
| Deployment awaits approval | Review the repository's `github-pages` environment protection settings. |
| Local records differ between devices | Records are browser-local; synchronization is not implemented. |

## References

- [Vite: deploying a static site](https://vite.dev/guide/static-deploy).
- [GitHub: using custom workflows with Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
