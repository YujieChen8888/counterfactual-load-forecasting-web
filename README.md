# NACF Counterfactual Load Forecasting Website

Academic project website for `Quantifying Event-Driven Demand Perturbations in Load Forecasting Using News-Aware Representation Learning`.

The interactive demo is browser-only. It uses preprocessed prediction curves and structured news metadata in `public/data/nacf-demo.json`; it does not load model checkpoints or expose trained weights.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Build

```bash
npm run build
```

## Publish on GitHub Pages

This project can be published as static files from the `gh-pages` branch.

1. Build with the repository base path:

```bash
NEXT_PUBLIC_BASE_PATH=/counterfactual-load-forecasting-web npm run build
```

2. Publish the generated `out/` directory to the `gh-pages` branch.
3. In the GitHub repository, open `Settings` -> `Pages`.
4. Set `Source` to `Deploy from a branch`, select `gh-pages`, and choose `/ (root)`.

For a normal project repository, the published URL will be:

```text
https://<your-github-username>.github.io/counterfactual-load-forecasting-web/
```

For a user/organization Pages repository named `<your-github-username>.github.io`, the URL will be:

```text
https://<your-github-username>.github.io/
```

When publishing under a different repository name, set `NEXT_PUBLIC_BASE_PATH` to `/<repository-name>` before building.

## Main Files

- `src/app/page.tsx`: academic website and interactive counterfactual demo.
- `src/app/globals.css`: responsive visual design.
- `public/data/nacf-demo.json`: lightweight demo database generated from processed results.
- `public/figures/`: manuscript figures reused by the website.
