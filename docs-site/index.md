---
layout: home

title: Astronaut Health Intelligence Platform
titleTemplate: Documentation

hero:
  name: Astronaut Health Intelligence Platform
  text: Explainable health monitoring for long missions
  tagline: Every signal is compared with each astronaut's own normal, explained in plain words and shown on a 3D body. Statistical and rule based, decision support only. Built for the NASA Space Apps Challenge 2026.
  image:
    src: /logo.svg
    alt: Astronaut Health Intelligence Platform logo
  actions:
    - theme: brand
      text: Get started
      link: /overview/introduction
    - theme: alt
      text: Product tour
      link: /product/product-tour
    - theme: alt
      text: Feature status
      link: /overview/feature-status

features:
  - icon: 🫀
    title: 3D anatomy at a glance
    details: A realistic anatomical atlas (Z-Anatomy) with 250 selectable structures in system layers. A body system that needs attention lights up in its status color, the heart beats at the live heart rate and the lungs breathe at the live breathing rate.
    link: /architecture/anatomy-3d
    linkText: How the body is built
  - icon: 📈
    title: Personal baselines
    details: Status comes from each astronaut's own normal range (median and MAD per activity context), not from a population average. Missing data is never shown as normal.
    link: /intelligence/personal-baseline
    linkText: Baseline method
  - icon: 🧭
    title: Explainable risk
    details: Transparent rules with ids, a documented 0 to 100 score, contributing factors and confidence. No machine learning model and no language model decides anything.
    link: /intelligence/risk-assessment
    linkText: Risk score
  - icon: 🛰️
    title: Earth delay aware decisions
    details: ISS, Moon and Mars link profiles (up to 22 minutes one way). Messages travel with the delay, and on board first steps come before ground review.
    link: /intelligence/self-report-and-earth-link
    linkText: Earth link
  - icon: 🧪
    title: Real NASA data with provenance
    details: Two public NASA OSDR datasets (Inspiration4 blood panels, OSD-569 and OSD-575) shown as historical reference with accession, file and SHA-256.
    link: /data/dataset-catalog
    linkText: Dataset catalog
  - icon: ✅
    title: Measured, not claimed
    details: 143 automated tests and a headless evaluation of six scenarios on simulated data. Every number on these pages links back to code or to a generated file.
    link: /validation/results
    linkText: Results and evidence
---

<div class="ahi-home">

<figure>

![Ground view of the Astronaut Health Intelligence Platform: crew rail, 3D body, what needs attention panel, status timeline and live vitals](/screenshots/ground-view.png)

<figcaption>Ground view during a simulated scenario. All device data in this prototype is simulated and labeled <code>SIMULATED</code>.</figcaption>
</figure>

## See it in action

<p class="lead">Real screenshots of the running prototype. Every value on screen is simulated, except the NASA OSDR lab panels in the Data and model dialog.</p>

<div class="ahi-shot-grid">
<figure>

![Critical banner during the acute cardio event, with the heart and lungs highlighted on the 3D body](/screenshots/critical-alert.png)

<figcaption><b>Acute event.</b> A combined rule fires within simulated minutes; actions say who can act.</figcaption>
</figure>
<figure>

![Crew view with a large status word, two actions and the daily check-in](/screenshots/crew-view.png)

<figcaption><b>Crew view.</b> Plain language, at most two things to do, a 30 second check-in.</figcaption>
</figure>
<figure>

![Body system detail with the personal normal band, history and forecast cone](/screenshots/body-detail.png)

<figcaption><b>Your normal, not an average.</b> Personal band, history and an 80% forecast interval.</figcaption>
</figure>
<figure>

![Earth link drawer with the Mars far profile and messages in transit](/screenshots/mars-comms.png)

<figcaption><b>Far from Earth.</b> Under Mars delays the crew gets an on board first step.</figcaption>
</figure>
</div>

## Architecture at a glance

<p class="lead">Everything runs in the browser today: no backend, no database, no external service. The app only loads its own static files, including the 3D anatomy. A backend is planned behind the same contracts (see <a href="./architecture/target-architecture">Target architecture</a>).</p>

<div class="ahi-arch">

```mermaid
flowchart LR
    SIM["Device simulators<br/>SIMULATED"] --> OBS["Canonical<br/>HealthObservation"]
    CHK["Check-in<br/>MANUAL"] --> OBS
    OBS --> ENG["Health engine<br/>baseline, anomaly, risk,<br/>forecast, recommendations"]
    ENG --> ST["zustand store"]
    ST --> UI["React UI and<br/>3D anatomy"]
    OSDR["NASA OSDR panels<br/>REAL_PUBLIC"] -.-> UI
```

</div>

<div class="ahi-links">
  <a href="./intelligence/overview">Methods and their status</a>
  <a href="./intelligence/ai-and-analytics">AI and analytics approach</a>
  <a href="./architecture/overview">Architecture overview</a>
  <a href="./engineering/quick-start">Run it locally</a>
</div>

<div class="ahi-disclaimer">
<strong>Decision support only.</strong> The Astronaut Health Intelligence Platform does not diagnose, does not recommend medication and does not replace the flight surgeon or Mission Control. Fixed thresholds are demo configuration, not official NASA limits. Simulated data is not clinical evidence. Read <a href="./overview/responsible-use">Responsible use</a>.
</div>

</div>
