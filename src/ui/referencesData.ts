// ONE place for every reference HALO relies on. Add a new entry to REFERENCES and it appears
// on the Evidence page automatically, numbered, with its link.
//
//   checked  true once a teammate has opened the link and confirmed it says what "supports" claims.
//            Unchecked entries show a small "to verify" tag, so nothing looks more certain than it is.
//   url      leave "" if you do not have a link you have actually opened. Never guess a DOI.

export type Category =
  "Research papers" | "NASA data and programmes" | "Software and credits";

export type Reference = {
  id: number;
  category: Category;
  citation: string; // authors, year, title, journal in one line
  supports: string; // the exact HALO claim this backs up
  usedIn: string; // where in HALO it appears
  url: string;
  checked: boolean;
};

export const REFERENCES: Reference[] = [
  {
    id: 1,
    category: "Research papers",
    citation:
      "Siew K. et al. (2024). Cosmic kidney disease, an integrated pan-omic, physiological and morphological study into spaceflight-induced renal dysfunction. Nature Communications 15, 4923.",
    supports:
      "Spaceflight changes how the kidney handles salts, so stone risk is not only a result of bone loss",
    usedIn: "Kidney stone rule, Assistant evidence",
    url: "https://doi.org/10.1038/s41467-024-49212-1",
    checked: true,
  },
  {
    id: 2,
    category: "Research papers",
    citation:
      "Smith S. M. et al. (2005). Bone markers, calcium metabolism, and calcium kinetics during extended-duration space flight on the Mir Space Station. Journal of Bone and Mineral Research 20(2), 208 to 218.",
    supports:
      "In flight, bone resorption rose and calcium absorption fell, with about 250 mg of bone calcium lost per day",
    usedIn: "Kidney stone rule, bone loss",
    url: "https://ntrs.nasa.gov/citations/20050184836",
    checked: true,
  },
  {
    id: 3,
    category: "Research papers",
    citation:
      "Trappe S. et al. (2009). Exercise in space, human skeletal muscle after 6 months aboard the International Space Station. Journal of Applied Physiology 106(4), 1159 to 1168.",
    supports:
      "Calf muscle volume fell 13 percent and peak power 32 percent in 9 crew despite exercise",
    usedIn: "Musculoskeletal rule",
    url: "https://doi.org/10.1152/japplphysiol.91578.2008",
    checked: true,
  },
  {
    id: 4,
    category: "Research papers",
    citation:
      "Barger L. K. et al. (2014). Prevalence of sleep deficiency and use of hypnotic drugs in astronauts before, during, and after spaceflight, an observational study. Lancet Neurology 13, 904 to 912.",
    supports:
      "NASA schedules 8.5 hours of sleep but crews averaged about 6 hours in flight",
    usedIn: "Cognitive readiness rule",
    url: "https://doi.org/10.1016/S1474-4422(14)70122-X",
    checked: true,
  },
  {
    id: 5,
    category: "Research papers",
    citation:
      "Nasrini J. et al. (2020). Cognitive performance during confinement and sleep restriction in NASA's Human Exploration Research Analog (HERA). Frontiers in Physiology 11, 394.",
    supports:
      "One night of total sleep deprivation made crews slower and less accurate on vigilance tasks (1 to 2 week analog missions)",
    usedIn: "Cognitive readiness rule, EVA gate",
    url: "https://doi.org/10.3389/fphys.2020.00394",
    checked: true,
  },
  {
    id: 6,
    category: "Research papers",
    citation:
      "Zeitlin C. et al. (2013). Measurements of energetic particle radiation in transit to Mars on the Mars Science Laboratory. Science 340, 1080 to 1084.",
    supports:
      "Galactic cosmic ray dose equivalent averaged 1.8 mSv per day in cruise",
    usedIn: "Radiation feed, mission profiles",
    url: "https://doi.org/10.1126/science.1235989",
    checked: true,
  },
  {
    id: 7,
    category: "Research papers",
    citation:
      "Rooney B. V. et al. (2019). Herpes virus reactivation in astronauts during spaceflight and its application on Earth. Frontiers in Microbiology 10, 16.",
    supports:
      "Stress hormones and weaker cell-mediated immunity let latent herpes viruses reactivate. 53 percent of shuttle and 61 percent of ISS astronauts shed virus",
    usedIn: "Immune strain rule",
    url: "https://doi.org/10.3389/fmicb.2019.00016",
    checked: true,
  },
  {
    id: 8,
    category: "Research papers",
    citation:
      "Marshall-Goebel K. et al. (2019). Assessment of jugular venous blood flow stasis and thrombosis during spaceflight. JAMA Network Open 2(11), e1915011.",
    supports:
      "In 11 ISS crew, 6 showed stagnant or reversed jugular flow by about flight day 50 and 1 had a clot. A link to vision changes is suspected, not shown",
    usedIn: "Fluid shift rule",
    url: "https://doi.org/10.1001/jamanetworkopen.2019.15011",
    checked: true,
  },
  {
    id: 9,
    category: "Research papers",
    citation:
      "Smith S. M. et al. (2005). Nutritional status of astronauts after long-duration flight on the ISS. Journal of Nutrition 135, 437. Details not yet confirmed.",
    supports:
      "Under-fuelling rule. Vitamin D status and nutrition in long-duration crews",
    usedIn: "Under-fuelling rule",
    url: "",
    checked: false,
  },
  {
    id: 10,
    category: "Research papers",
    citation:
      "Du B., Daniels V. R., Vaksman Z., Boyd J. L., Crady C., Putcha L. (2011). Evaluation of physical and chemical changes in pharmaceuticals flown on space missions. AAPS Journal 13(2), 299 to 308.",
    supports:
      "After 28 months, 9 medicines from the ISS and 17 from the ground met the USP standard. Breakdown was faster in space for many",
    usedIn: "Potency tracker",
    url: "https://doi.org/10.1208/s12248-011-9270-0",
    checked: true,
  },
  {
    id: 11,
    category: "Research papers",
    citation:
      "Wotring V. E. (2016). Chemical potency and degradation products of medications stored over 550 Earth days at the International Space Station. AAPS Journal 18(1), 210 to 216.",
    supports:
      "9 medicines, no unusual breakdown products. 1 still met the USP standard 5 months after expiry and 4 more 8 months after",
    usedIn: "Potency tracker",
    url: "https://doi.org/10.1208/s12248-015-9834-5",
    checked: true,
  },
  {
    id: 12,
    category: "Research papers",
    citation:
      "Blue R. S., Chancellor J. C., Antonsen E. L., Bayuse T. M., Daniels V. R., Wotring V. E. (2019). Limitations in predicting radiation-induced pharmaceutical instability during long-duration spaceflight. npj Microgravity 5, 15.",
    supports:
      "Radiation effects on medicines cannot yet be predicted reliably, so HALO shows a range",
    usedIn: "Potency tracker",
    url: "https://doi.org/10.1038/s41526-019-0076-1",
    checked: true,
  },
  {
    id: 13,
    category: "Research papers",
    citation:
      "Blue R. S. et al. (2019). Supplying a pharmacy for NASA exploration spaceflight, challenges and current understanding. npj Microgravity 5, 14.",
    supports:
      "Too few studies exist to say how medicines keep in space on long missions without resupply",
    usedIn: "Potency tracker",
    url: "https://doi.org/10.1038/s41526-019-0075-2",
    checked: true,
  },
  {
    id: 14,
    category: "NASA data and programmes",
    citation:
      "NASA Open Science Data Repository RadLab Data API (ISS radiation dose rate).",
    supports: "Real ISS dose rate used for the radiation feed",
    usedIn: "Radiation, Assistant backend",
    url: "https://visualization.osdr.nasa.gov/radlab/",
    checked: false,
  },
  {
    id: 15,
    category: "NASA data and programmes",
    citation:
      "NASA Open Science Data Repository, Inspiration4 and SOMA datasets.",
    supports:
      "Real biomarker ranges used to build the simulated crew baselines",
    usedIn: "Crew simulator",
    url: "https://osdr.nasa.gov/",
    checked: false,
  },
  {
    id: 16,
    category: "NASA data and programmes",
    citation:
      "NASA Human Research Program, the five hazards of human spaceflight.",
    supports:
      "Every signal is tagged to one of Radiation, Isolation, Distance, Gravity or Environment",
    usedIn: "Body systems, Health page",
    url: "https://www.nasa.gov/hrp/hazards",
    checked: false,
  },
  {
    id: 17,
    category: "NASA data and programmes",
    citation:
      "NASA Technical Reports Server, spaceflight associated neuro-ocular syndrome (SANS) brief.",
    supports: "About two thirds of long-duration astronauts show early signs",
    usedIn: "Vision guidance, Assistant evidence",
    url: "https://ntrs.nasa.gov/citations/20220016048",
    checked: false,
  },
  {
    id: 18,
    category: "NASA data and programmes",
    citation:
      "NASA Earth-Independent Medical Operations (EIMO) concept of operations.",
    supports:
      "The medical officer on a delayed link, which HALO is a small working version of",
    usedIn: "Pitch and architecture",
    url: "",
    checked: false,
  },
  {
    id: 19,
    category: "NASA data and programmes",
    citation:
      "NASA ExMC reanalysis of Du et al. 2011 (Reichard), NTRS 20220000500.",
    supports:
      "First-order breakdown model, spaceflight about 1.5 times faster on the ISS",
    usedIn: "Potency tracker",
    url: "https://ntrs.nasa.gov/citations/20220000500",
    checked: false,
  },
  {
    id: 20,
    category: "Software and credits",
    citation: "Geist Sans and Geist Mono fonts (SIL Open Font License).",
    supports: "Typography",
    usedIn: "Whole app",
    url: "https://vercel.com/font",
    checked: true,
  },
  {
    id: 21,
    category: "Software and credits",
    citation: "Phosphor Icons (MIT licence).",
    supports: "Icons",
    usedIn: "Whole app",
    url: "https://phosphoricons.com/",
    checked: true,
  },
  {
    id: 22,
    category: "Software and credits",
    citation: "React, Vite and Recharts (MIT licence).",
    supports: "Interface and charts",
    usedIn: "Whole app",
    url: "https://react.dev/",
    checked: true,
  },
  {
    id: 23,
    category: "Software and credits",
    citation: "Fastify, Zod and Node.js SQLite (MIT licence).",
    supports: "HALO server and its stored daily records",
    usedIn: "backend/node",
    url: "https://fastify.dev/",
    checked: true,
  },
];

export const AI_USE_STATEMENT =
  "The Assistant answers from HALO's curated evidence summaries. If the crew member turns it on for the session, the HALO server can also ask a hosted language model (Claude by Anthropic, or alternatively OpenAI or Azure OpenAI) to word an answer from those same sources; HALO rejects any answer that cites a source it did not supply, names a dose or gives a diagnosis. Emergency detection is plain rules that run first and never depend on the model. Without the server or a key, the app uses rule-based answers. Generative AI tools also helped the team write code and documentation, and the team reviewed the output. All crew data is simulated.";

export const CATEGORIES: Category[] = [
  "Research papers",
  "NASA data and programmes",
  "Software and credits",
];
