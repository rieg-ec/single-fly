# Fly Swipe

A live portrait-swiping experiment using the full retained MaleCNS fly connectome and a **trained neural readout**. The browser simulates 166,700 neurons and 25,582,938 directed connections. A small logistic readout learns from human facial-attractiveness ratings; the connectome's synaptic weights stay fixed.

## Measured result

Training used 200 portraits; 66 separate portraits selected regularization and the neural feature family. The frozen model was then evaluated once on 70 held-out portraits (35 from each class).

| Model | Correct / 70 | Accuracy |
| --- | --- | --- |
| Deployed neural readout | 47 | 67.1% |
| Always like | 35 | 50.0% |
| Raw right-versus-left DNp20 readout, modified sensory input | 35 | 50.0% |
| Downstream-only neural readout | 43 | 61.4% |
| Image-only 8×8 grayscale logistic classifier | 56 | 80.0% |
| Brightness, contrast, symmetry and edge heuristic classifier | 47 | 67.1% |

The deployed model makes **32 likes and 38 passes**, without a balancing rule or random action override. Its exact binomial 95% accuracy interval is **54.9–77.9%**. One hundred shuffled-training-label controls averaged **49.6%** accuracy. The raw DNp20 binary baseline maps ties to pass solely for binary scoring; original-v1 ties were holds.

This demonstrates modest prediction of this dataset's ratings from simulated spike counts. **It does not show that the fly architecture outperforms simple image features, or that a living fly recognizes human attractiveness.** The image-only baseline performs better. No test results were used to tune the deployed model. Full metrics, predictions, dataset membership and audit features are in `research/`.

## 3D interface

The interface uses Three.js for a fly avatar facing a floating portrait and a separate rotatable 3D neuron cloud. Neuron positions use all three normalized soma-coordinate axes in the dataset, and their highlights are driven by the worker’s actual spike counts. The fly avatar, wing motion and card movement are illustrative; they do not simulate muscles or learned locomotion. Drag either view to orbit, or use its reset-camera button. Devices without WebGL get the portrait and 2D neuron fallback. Rendering is independent from the neural worker and never selects a swipe.

## What runs live

1. Each actual portrait is center-cropped to 3:4, resized with Lanczos to 32×32, converted to luminance and rounded to 8-bit pixels. Canonical sensory files accompany the photographs so Python training and browser inference receive identical pixels. These are image inputs, not precomputed neural responses or decisions. Portrait labels and IDs are not classifier inputs.
2. A 200 ms uniform-gray warmup creates a fixed starting state. That complete state is restored before **every portrait**, removing order/carryover effects. It is a standardized warmup, not a claim of biological steady state.
3. Upstream inferred UV coordinates map pixels onto 3,335 R1–R6 photoreceptors. The drive is `30 × luminance / (0.25 + luminance)`, with a 10 ms luminance filter; tonic lamina drive remains 12. The half-saturation parameter was increased from the original 0.02 **before training** to give portrait intensities a broader response range. This is an engineered sensory approximation, not an anatomical measurement.
4. The full retained connectome runs for 200 ms per portrait: dt 0.1 ms; membrane constant 20 ms; synapse constant 5 ms; rest/reset −52; threshold −45; delay 1.8 ms; refractory 2.2 ms. Fixed connection weights are synaptic contact counts × transmitter sign × 0.275.
5. The learned readout uses spatially pooled photoreceptor spike counts plus 256 downstream cells selected by variance on the training set alone, excluding directly driven retina/lamina cells. Standardized logistic regression is trained on the labels. Four regularization strengths and two neural feature families are compared using validation accuracy; the threshold stays 0.5. Learned scaling is folded into the exported coefficients.
6. Every 20 ms, the worker reports actual population spikes and sampled soma activity. Only a complete 200 ms exposure produces a like/pass result. The like score is a classifier output, **not a calibrated attractiveness rating**.

All displayed portraits were withheld from training and model selection. Their shuffled sequence repeats after 70 portraits. The page evaluates frozen readout weights; it is **not training live**. Each visitor runs an independent browser simulation. Pause/resume, one-portrait stepping, playback pace, history filtering, per-swipe inspection and JSON export are supported. Pace changes only the delay between updates. History keeps the most recent 2,000 observations locally, including older-version records labeled with their original decoder. No real Tinder account is connected.

## Dataset and limits

[SCUT-FBP5500 v2.1](https://github.com/HCIILAB/SCUT-FBP5500-Database-Release) contains human ratings on a 1–5 scale. We selected only CF portraits whose source workbook explicitly marks them as from the 10k US Adults Face Database: 506 eligible images. We took the lowest and highest thirds (168 each), leaving the middle third out. Rating ranges are 1.333333–2.55 and 2.9–4.516667. A fixed seed (20260911) creates balanced 200/66/70 train/validation/test sets.

This is a small, demographically narrow adult-source sample with subjective ratings, cropped faces and excluded ambiguous cases. Performance on ordinary dating photos, other populations or personal preferences is unknown. Splits are photograph-disjoint; source metadata does not reliably identify individuals, so identity independence cannot be guaranteed. Exact SHA-256 duplicates were excluded by an assertion. Two cross-split low-distance perceptual-hash pairs were visually inspected and were distinct portraits; this is not exhaustive identity verification.

SCUT images and ratings are **for non-commercial research only**, according to the dataset authors. The demo and included evaluation images are a research experiment. Source-code licensing does not override dataset restrictions. The external research workbooks are not bundled; the preparation script reads your downloaded dataset. Original placeholder portraits remain solely to render history from version 1.

## Deploy to GitHub Pages

The repository includes `.github/workflows/pages.yml`. Set **Settings → Pages → Build and deployment → Source → GitHub Actions** once. Every push to `main` then builds and deploys automatically.

For `rieg-ec/single-fly`, the default address is `https://rieg-ec.github.io/single-fly/`. The workflow sets the asset base path from the repository name. To build locally:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build:pages
```

The static output is `dist-pages/`. Brain downloads, portrait images, source downloads, and links all honor the project subdirectory. The complete simulation and trained classifier run on each visitor's device; GitHub Pages serves static files only. No GitHub token or other secret is shipped to the browser.

## Run locally

Open the information button in the app and choose **Download source**. The complete ZIP includes the prepared graph, trained readout, evaluation images, training/verification scripts, and results. Use Node 22.13+ and the pnpm version in `package.json`.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

To preview the GitHub Pages build locally:

```bash
pnpm build
pnpm start
```

Development runs at `http://localhost:5173/`; the built preview runs at `http://localhost:4173/single-fly/`. This is a static React app built with Vite. No AI API, GPU, Python backend, secrets, database, or server runtime is needed to run the demo.

## Reproduce training

Download and extract SCUT-FBP5500 v2.1 using the authors' repository above. Run with Python 3.11+, NumPy, SciPy, Pillow, openpyxl and scikit-learn. The external dataset is about 172 MB. The preparation script saves the exact split and canonical pixels; extraction runs the full graph for every image and never reads labels as simulator input.

```bash
python -m pip install -r research/requirements.txt
python scripts/prepare-training.py /path/to/SCUT-FBP5500_v2 /tmp/fly-training
node scripts/extract-training.mjs /tmp/fly-training/dataset.json /tmp/fly-training/counts
python scripts/train-readout.py /tmp/fly-training
node scripts/build-brain-worker.mjs
```

Extraction can be split across processes by supplying zero-based shard and total shard count as the final two arguments. Wait for all shards before training. Do not change hyperparameters after examining the test set and then report it as an untouched evaluation.

To verify the learned model using the included small feature audit bundle, without downloading SCUT or rerunning the brain:

```bash
python scripts/verify-training.py
```

## Verify the deployed implementation

```bash
pnpm test:kernel
pnpm test:worker
pnpm exec tsc --noEmit
pnpm build:pages
pnpm test:pages
```

`test:kernel` checks the JavaScript neural kernel against the unmodified upstream C++ fixture (exact spikes, bounded voltage/current errors). `test:worker` executes the **shipped bundled worker** with its real local assets and messaging protocol for all 70 held-out portraits; it requires scores to match offline evaluation to 1e-10 and checks repeated-image/order and changed-ID invariance. `test:pages` checks asset paths, built entrypoints, and the downloadable source. These tests do not substitute for visual/browser UI testing or biological validation.

## Attribution and resource use

- Simulator and procedural 3D avatar (`lib/fly-model.ts`): [nftechie/doomfly](https://github.com/nftechie/doomfly), MIT; pinned revision and retained original files in `vendor/doomfly/`.
- Wiring: [MaleCNS v1.0 / HHMI Janelia](https://male-cns.janelia.org/download/), CC BY 4.0. Source URLs, hashes and counts are in `public/brain/manifest.json`. All edges among retained neuronal entries remain, including weak/self edges. Upstream excludes explicit glia and unresolved segmentation objects; this is not every raw segmentation fragment. Forty-two unmapped photoreceptors remain; 3,718 uncertain transmitter signs retain the upstream positive assumption. Approximate spiking dynamics are not a literal living brain.
- SCUT-FBP5500: Liang, Lin, Jin, Xie and Li, ICPR 2018; [paper](https://arxiv.org/abs/1801.06345), non-commercial research only.
- Legacy placeholder photos: Pravatar / any individually documented Random User fallback in `public/profiles/sources.json`; their old names/bios are fictional.
- @noble/hashes 1.8.0, MIT, with included license. Native Web Crypto is used when available; a bundled fallback performs the same SHA-256 validation otherwise.

The 14 gzip graph chunks total 86.6 MB and are SHA-256 verified on load. The browser needs a few hundred MB of memory. Typical extraction took about 1.1–1.4 seconds of compute for 200 ms of brain time on this host; your device will differ. Assets are fetched on the page and transferred to a background worker. The downloadable ZIP is assembled in the browser from the source bundle and graph chunks.
