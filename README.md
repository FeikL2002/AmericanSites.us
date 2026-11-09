# AmericanSites | Website Projects & Prototypes

Website source snapshots, reusable frontend concepts, and a sports-technology prototype from **Lewis Joseph Feik / AmericanSites**.

My work in this collection spans business website presentation, industry-specific page concepts, and an experimental camera interface for wrestling training. The repository keeps these project areas together while preserving their original directory paths.

**Business website:** [AmericanSites.us](https://americansites.us/)

## Explore the projects

| Area | What is committed | Start here |
|---|---|---|
| AmericanSites frontend | A static website snapshot with inline styling/scripts, Tailwind CDN usage, forms, and Stripe Buy Button markup. | [Website source](AmericanSites%20%20%22Live%22/) · [index.html](AmericanSites%20%20%22Live%22/index.html) |
| Industry page concepts | Seven HTML templates for different service or personal-brand ideas. | [Template directory](AmericanSites%20%20%22Live%22/templates/) |
| 330 LAB camera prototype | A Streamlit/OpenCV/MediaPipe pose-landmark preview with a camera activation control. | [330Lab_Wrestling/app.py](330Lab_Wrestling/app.py) |
| Deployment archives | Historical ZIP packages for website projects. | [Archive directory](Americansites.us%22websites%22/) |

The folder name `AmericanSites  "Live"` is a historical label. Repository files and archived deployment packages do not establish the current state of a hosted website, checkout, form delivery, or client deployment.

## Website template directory

| Concept | Source |
|---|---|
| Trades and emergency services | [24-hour trades](AmericanSites%20%20%22Live%22/templates/24hr-trades.html) |
| Automotive sales | [Car sales](AmericanSites%20%20%22Live%22/templates/car-sales.html) |
| Property maintenance | [Lawn care](AmericanSites%20%20%22Live%22/templates/lawn-care.html) |
| Barber services | [Master barber](AmericanSites%20%20%22Live%22/templates/master-barber.html) |
| Fitness and coaching | [Performance training](AmericanSites%20%20%22Live%22/templates/performance-training.html) |
| Personal branding | [Personal-brand concept](AmericanSites%20%20%22Live%22/templates/personal-brand-innovator.html) |
| Property presentation | [Real estate](AmericanSites%20%20%22Live%22/templates/real-estate.html) |

These are source examples. Their presence here does not imply a current client relationship or a deployed service.

## Preview a frontend snapshot locally

```bash
git clone https://github.com/FeikL2002/AmericanSites.us.git
cd AmericanSites.us
cd 'AmericanSites  "Live"'
python3 -m http.server 8080
```

Open `http://localhost:8080` in a browser. External CDN resources require an internet connection. A local static preview does not reproduce payment processing, hosted form handling, or external service configuration.

**Packaging note:** the committed `css/styles.css` and `js/main.js` currently contain HTML-document content. Review those assets and their references before using this snapshot as the basis for a deployment. This index documents the existing tree; it does not certify a deployment-ready build.

## 330 LAB pose-preview prototype

The Python app uses **Streamlit, OpenCV, NumPy, Pandas, and MediaPipe**. Its visible behavior is a camera preview with drawn pose landmarks after the operator enables the camera control. The current source does not implement performance scoring or establish the accuracy of an AI coaching system.

Create a fresh Python environment with compatible versions of those dependencies, then start the app from its folder:

```bash
cd 330Lab_Wrestling
streamlit run app.py
```

The repository includes a historical `.venv`; it is not a portable installation. A dependency manifest and compatible version pins are not currently committed. Camera access and MediaPipe compatibility need verification on the intended machine.

## Archive and review notes

The [ZIP archive directory](Americansites.us%22websites%22/) is useful for tracing earlier project packages. Inspect an archive's contents and configuration before reusing it. The source tree, third-party dependencies, and hosted application state can evolve independently.

## Agent HQ development preview

The isolated [Agent HQ subproject](agent-hq/README.md) adds a React/Three.js office, a persistent local task/event backend, evidence-based worker status, and a verified keyboard-accessibility task. It is not deployed to the live business website.

## Related work

- [Software and engineering projects](https://github.com/FeikL2002/Engineered-Solutions-self-made-)
- [Cybersecurity and networking portfolio](https://github.com/FeikL2002/HockingCollege)

## License

See [LICENSE](LICENSE). Third-party libraries, assets, and other bundled material retain their respective notices and terms.
