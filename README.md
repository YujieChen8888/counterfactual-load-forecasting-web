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

This project is configured for static GitHub Pages deployment through `.github/workflows/deploy.yml`.

1. Push this repository to GitHub.
2. In the GitHub repository, open `Settings` -> `Pages`.
3. Set `Source` to `GitHub Actions`.
4. Push to the `main` branch, or manually run the `Deploy GitHub Pages` workflow.

For a normal project repository, the published URL will be:

```text
https://<your-github-username>.github.io/counterfactual-load-forecasting-web/
```

For a user/organization Pages repository named `<your-github-username>.github.io`, the URL will be:

```text
https://<your-github-username>.github.io/
```

The workflow automatically sets the correct base path for either case.

## Main Files

- `src/app/page.tsx`: academic website and interactive counterfactual demo.
- `src/app/globals.css`: responsive visual design.
- `public/data/nacf-demo.json`: lightweight demo database generated from processed results.
- `public/figures/`: manuscript figures reused by the website.
