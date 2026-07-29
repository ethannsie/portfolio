/* ============================================================
   PROJECTS DATA  —  this is the only file you edit to manage
   your portfolio. Add, remove, or reorder entries in the array
   below and every page updates automatically.

   FIELD REFERENCE
   ---------------
   id         short part-number style code shown on the card, e.g. "ME·01"
   slug       url-safe id, used in the address bar (project.html?p=driver-monitor)
              must be unique, lowercase, no spaces
   title      project name
   year       string or number
   blurb      one-line summary shown on the grid card
   tags       any of: "mechanical", "electronics", "firmware", "software", "math"
              these drive the filter buttons on the home page (see
              DISCIPLINES in js/app.js if you add a new tag category)
   thumb      path to the card image (assets/img/…). SVG or JPG/PNG both fine.
   icon       tabler icon name used as a fallback / accent (see tabler.io/icons)

   Everything below "detail" is OPTIONAL and only appears on the
   project page if you fill it in. Delete a block to hide it.

   overview   1–3 short paragraphs (array of strings)
   specs      key/value pairs shown as a spec table  [["Mass","4.2 kg"], …]
   gallery    array of image paths for the build gallery
   media      optional array of process photos/videos, e.g.
              [{ type: "video", src: "assets/media/x.mp4", poster: "…", caption: "…" },
               { type: "image", src: "assets/media/y.jpg", caption: "…" }]
              Shows nothing at all if omitted or empty — only add
              entries once you actually have photos/video to show.
   links      array of { label, url }  (GitHub, demo, writeup, video …)
   embed      { url, label, height } — embeds a live, interactive
              third-party demo (GlowScript/Web VPython, CodePen, a
              Jupyter/Colab share link, a hosted dashboard, etc.) in
              an iframe on the project page. label is optional,
              defaults to "Interactive demo". height (px) is optional,
              defaults to 950 — set it to whatever the embedded page
              actually needs so nothing gets clipped into an inner
              scrollbar.
   cad        path (or array of paths) to .step/.stp assemblies to
              show as interactive exploded-view viewers on the project
              page. Drop your exported file(s) into assets/cad/<slug>/
              and point this at it, e.g. "assets/cad/driver-monitor/model.step",
              or ["assets/cad/<slug>/a.step", "assets/cad/<slug>/b.step"]
              for more than one — multiple models render as a
              horizontally scrollable strip, one full viewer per model.
              Export the assembly (not a single fused/merged body) so
              each part lands as its own solid and can explode apart —
              Fusion 360, Onshape, and SolidWorks can all export
              STEP (AP214/AP242) directly, no conversion needed.
              STEP is parsed and tessellated right in the browser
              (via OpenCascade/WASM), so it can take a moment on
              large assemblies. Delete this field or leave the file(s)
              missing to hide the viewer.
   ============================================================ */

const PROJECTS = [
  {
    id: "CS·01",
    slug: "circuit-solver",
    title: "SPICE Solver for Resistor & EMF Networks",
    year: "2025",
    blurb: "Low-level SPICE-style solver for arbitrary resistor/EMF circuit networks.",
    tags: ["software"],
    thumb: "assets/img/circuit-solver.svg",
    icon: "ti-circuit-resistor",
    detail: {
      overview: [
        "A from-scratch circuit solver built in VPython: given an arbitrary network of resistors and EMF sources, it assembles Kirchhoff's Voltage and Current Laws together with Ohm's Law into a linear system and solves it directly, returning the current and voltage on every wire in the circuit.",
        "The whole network — resistor values, EMF values, and the number/topology of circuits — is configurable, so it works as a general-purpose low-level SPICE-style solver rather than a fixed demo circuit."
      ],
      specs: [
        ["Method", "KVL + KCL + Ohm's Law, solved via linear algebra"],
        ["Platform", "VPython (GlowScript) + JavaScript"],
        ["Output", "Current and voltage per wire"],
        ["Configurable", "Resistor values, EMF values, circuit topology"]
      ],
      embed: {
        url: "https://www.glowscript.org/#/user/sie.ethan/folder/MyPrograms/program/circuitBuilder",
        label: "Live simulation"
      }
    }
  },
  {
    id: "EE·01",
    slug: "driver-monitor",
    title: "IMU-Based Driver Monitoring System",
    year: "2026",
    blurb: "Camera-free driver-coaching wearable built in 36 hours at Purdue's StarkHacks, using dual ESP32-S3 IMUs and real-time audio feedback.",
    tags: ["firmware", "software"],
    thumb: "assets/img/driver-monitor.svg",
    icon: "ti-steering-wheel",
    detail: {
      overview: [
        "A non-invasive driver-monitoring co-pilot built in 36 hours at Purdue University's StarkHacks — one of the world's largest hardware hackathons — with a team of four. Instead of cameras or computer vision, a dashboard module and a wearable earpiece each carry an ESP32-S3 and an MPU-6050 IMU, fusing accelerometer/gyroscope data on-device to detect hard braking, sharp turns, aggressive acceleration, and lane changes, then relay coaching cues through audio alone so the driver never has to look away from the road.",
        "I worked the embedded side: configuring the dual ESP32-S3s and IMUs in Arduino/C++, the ESP-NOW link synchronizing the two devices, and the audio delivery pipeline — a WebSocket server hosted directly on the ESP32's Wi-Fi, serving ElevenLabs-generated voice lines out of LittleFS and using the Web Audio API for stereo panning in the browser. An animated OLED face on the dashboard keeps the system feeling approachable rather than clinical."
      ],
      specs: [
        ["Hardware", "Dual ESP32-S3 + MPU-6050 IMU (dashboard + earpiece)"],
        ["Sync", "ESP-NOW inter-device link"],
        ["Audio pipeline", "WebSocket server on ESP32 Wi-Fi → LittleFS → ElevenLabs voice lines → Web Audio API"],
        ["Display", "0.96\" OLED, animated face UI"],
        ["Detection", "Hard braking, sharp turns, aggressive acceleration, lane changes"],
        ["Event", "Purdue StarkHacks — 36-hour hackathon, team of 4"]
      ],
      gallery: [
        "assets/img/driver-monitor.svg",
        "assets/img/driver-monitor-demo.jpg",
        "assets/img/driver-monitor-dashboard.jpg",
        "assets/img/driver-monitor-earpiece-evolution.jpg",
        "assets/img/driver-monitor-system-overview.jpg",
        "assets/img/driver-monitor-team.jpg"
      ],
      links: [
        { label: "Devpost", url: "https://devpost.com/software/passenger-princess" },
        { label: "GitHub", url: "https://github.com/ethannsie/Amoeba-StarkHacks" }
      ]
    }
  },
  {
    id: "EE·02",
    slug: "posture-monitor",
    title: "Embedded Posture Training System",
    year: "2026",
    blurb: "Wearable dual-ESP32 posture coach that detects upper-body deviations and delivers real-time corrective feedback.",
    tags: ["firmware", "software"],
    thumb: "assets/img/posture-monitor.svg",
    icon: "ti-yoga",
    detail: {
      overview: [
        "A real-time wearable posture-training system, built at UC Berkeley, using dual ESP32-S3 microcontrollers and IMUs to detect upper-body posture deviations and deliver immediate corrective feedback through non-blocking actuator patterns.",
        "The architecture is distributed: sensing nodes read orientation data and publish posture states over MQTT, while a separate actuator node handles graduated feedback responses with its own timing so corrections stay responsive without blocking the sensing loop. Wi-Fi communication, JSON serialization, and state-based logic tie the loop together into a low-latency embedded feedback system, exploring how subtle, non-disruptive feedback can build long-term posture awareness."
      ],
      specs: [
        ["Hardware", "Dual ESP32-S3 + IMU sensing nodes + actuator node"],
        ["Sensing", "Upper (T4–T6) and lower (L3–L5) orientation tracking"],
        ["Messaging", "MQTT over Wi-Fi, JSON-serialized posture states"],
        ["Feedback", "Non-blocking, graduated actuator response"],
        ["Context", "University of California, Berkeley"]
      ],
      embed: {
        url: "https://phone-dashboard-five.vercel.app/",
        label: "Live dashboard",
        height: 1650
      }
    }
  },
  {
    id: "MATH·01",
    slug: "immc-2024",
    title: "Picking the Perfect Pet",
    year: "2024",
    blurb: "A household readiness model for pet ownership that promotes adoption and cuts abandonment.",
    tags: ["math"],
    thumb: "assets/img/immc-2024.svg",
    icon: "ti-paw",
    detail: {
      overview: [
        "A household pet-readiness model built for the 2024 International Mathematical Modeling Challenge (Team US-14839), centered on HR-SPLIT — Hyper-Rectangular Space Partitioning with Linear Inequalities Technique — a method we developed to score a household's readiness for a pet from ten or fewer inputs (living space, free time, budget, species-specific care knowledge) without collapsing everything to a binary yes/no.",
        "Fit the model to national data for the U.S., U.K., and Japan using normal and gamma distributions, then generalized it from cats to four more species — dogs, parakeets, goldfish, and red-tailed boas — and projected household counts and pet-retention rates 5, 10, and 15 years out using stochastic differential equations (Euler–Maruyama) and lifetime density functions."
      ],
      specs: [
        ["Method", "HR-SPLIT — custom hyper-rectangular space partitioning + linear inequalities"],
        ["Species modeled", "Cat, dog, parakeet, goldfish, red-tailed boa"],
        ["Regions", "United States, United Kingdom, Japan"],
        ["Forecasting", "Stochastic differential equations (Euler–Maruyama), lifetime density functions"],
        ["Key result", "29.2% of U.S. households ready for a cat; 95.3% cat retention vs. 88.8% dog retention"]
      ],
      gallery: [
        "assets/img/immc-2024.svg",
        "assets/img/immc-2024-retention-charts.png"
      ],
      links: [
        { label: "Read the paper", url: "assets/papers/immc-2024-picking-the-perfect-pet.pdf" }
      ]
    }
  },
  {
    id: "MATH·02",
    slug: "immc-2025",
    title: "Global Sports League Scheduling",
    year: "2025",
    blurb: "A fairness- and travel-optimized scheduling system for a 20-team global volleyball league.",
    tags: ["math"],
    thumb: "assets/img/immc-2025.svg",
    icon: "ti-world",
    detail: {
      overview: [
        "A scheduling system for a hypothetical 20-team Global Sports League (Team US-16158), commissioned to balance fairness, travel sustainability, and competitive equity across continents. We picked women's volleyball using a CEEG framework (Competitive equity, Economic sustainability, Environmental sustainability, Growth potential) built on Olympic-era medal data, then selected 20 founding teams spanning six continents with a FIVB-based strength-rating system.",
        "Match-ups were generated with a mixed-integer linear program plus a Markov-chain analysis to balance total travel distance against competitive fairness, and a second MILP scheduled those matches across an 8-month season while respecting rest days and home/away balance. We scored the resulting schedule for 'effectivity' (does the final standing reflect true team skill) and 'attractiveness' (closeness, intensity, entropy) via Monte Carlo simulation, and benchmarked it against the real FIVB Women's World Championship schedule."
      ],
      specs: [
        ["Method", "Mixed-integer linear programming (PuLP) + Markov chain analysis"],
        ["Sport selected", "Women's volleyball, via the CEEG selection framework"],
        ["Season", "20 teams (6 continents), expanded to 24; 8-month season"],
        ["Evaluation", "Monte Carlo simulation of effectivity & attractiveness"],
        ["Tools", "Python — PuLP, NetworkX, GeoPandas, SciPy"],
        ["Recognition", "Finalist, 2025 IM²C USA Regional Contest"]
      ],
      gallery: [
        "assets/img/immc-2025.svg",
        "assets/img/immc-2025-infographic.png"
      ],
      links: [
        { label: "Read the paper", url: "assets/papers/immc-2025-global-sports-league.pdf" }
      ]
    }
  },
  {
    id: "ME·01",
    slug: "me-awards",
    title: "Award Manufacturing [Berkeley Engineering Youth Academy]",
    year: "2026",
    blurb: "A project focused on the design and fabrication of custom awards for the Berkeley Engineering Youth Academy (BEYA).",
    tags: ["mechanical"],
    thumb: "assets/img/me-awards.svg",
    icon: "ti-trophy",
    detail: {
      overview: [
        "A project focused on the design and fabrication of custom awards for the Berkeley Engineering Youth Academy (BEYA). The awards were created using a combination of 3D printing and traditional manufacturing techniques, allowing for a high degree of customization and personalization.",
        "The project involved collaboration with BEYA staff and students to ensure the awards met their needs and expectations. Feedback was gathered throughout the design process, leading to several iterations and refinements."
      ],
      specs: [
        ["Method", "3D printing + traditional manufacturing"],
        ["Materials", "PLA filament, cast acrylic sheet, metal hardware"],
        ["Tools", "Fusion 360, Adobe Illustrator, Bambu Labs Slicer, Bambu Labs X1 Carbon"],
        ["Recognition", "Featured in BEYA 2026 showcase"]
      ],
      gallery: [
        "assets/img/me-awards.svg",
        "assets/img/me-awards-1.png",
        "assets/img/me-awards-2.png",
        "assets/img/me-awards-3.png"
      ],
      cad: [
        "assets/cad/me-awards/unique_award.step",
        "assets/cad/me-awards/straightest_line.step",
        "assets/cad/me-awards/first_place.step"
      ]
    }
  },
  {
    id: "MATH·03",
    slug: "mcm-2025",
    title: "Olympic Medal Tables",
    year: "2025",
    blurb: "A hierarchical statistical model forecasting the 2028 LA Olympics medal table from 128 years of IOC data.",
    tags: ["math"],
    thumb: "assets/img/mcm-2025.svg",
    icon: "ti-medal",
    detail: {
      overview: [
        "A hierarchical statistical model (Team 2522820, MCM/ICM Problem C) forecasting the medal table for the 2028 Los Angeles Summer Olympics from 128 years of IOC data. Started from a Tobit model — handling the fact that medal counts are zero-inflated, censored data — fit by maximum likelihood, then found it suffered from heteroscedasticity and moved to a hierarchical mixed-effects framework: countries were clustered by historical performance with DBSCAN, then modeled with Negative Binomial regression plus a Probit 'hurdle' stage for countries likely to earn zero medals.",
        "Beyond the medal forecast, used Singular Value Decomposition to rank which individual events most influence a country's ranking, and built a rolling-window time-series z-score model to detect the 'great coach effect' — anomalous, sustained performance jumps for a country in a given sport — cross-referencing the top hits against real historical Olympic coaches to sanity-check the model."
      ],
      specs: [
        ["Method", "Tobit model (MLE) → hierarchical mixed-effects Negative Binomial + Probit hurdle"],
        ["Clustering", "DBSCAN on historical country performance"],
        ["Data", "IOC medal & athlete data, 1896–2024, processed via SQLite"],
        ["Extensions", "SVD event-impact ranking; time-series 'great coach effect' detection"],
        ["Language", "Python 3"],
        ["Headline prediction", "USA 48 golds, Germany 28, China 25 for LA 2028"]
      ],
      gallery: [
        "assets/img/mcm-2025.svg",
        "assets/img/mcm-2025-fig1-regression.png",
        "assets/img/mcm-2025-fig2-dbscan.png"
      ],
      links: [
        { label: "Read the paper", url: "assets/papers/mcm-2025-olympic-medal-tables.pdf" }
      ]
    }
  },
];

/* ---- profile / contact  (edit these) ---- */
const PROFILE = {
  name: "Ethan Sie",
  role: "Mechanical Engineering + EECS",
  school: "University of California, Berkeley",
  email: "ethan.sie@berkeley.edu",
  github: "https://github.com/ethannsie",
  linkedin: "https://linkedin.com/in/ethansie",
  resume: "assets/resume.pdf"
};
