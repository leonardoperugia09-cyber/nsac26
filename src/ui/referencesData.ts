// ONE place for every reference HALO relies on. Add a new entry to REFERENCES and it appears
// on the Evidence page automatically, numbered, with its link.
//
//   checked  true once a teammate has opened the link and confirmed it says what "supports" claims.
//            Unchecked entries show a small "to verify" tag, so nothing looks more certain than it is.
//   url      leave "" if you do not have a link you have actually opened. Never guess a DOI.

export type Category = "Research papers" | "NASA data and programmes" | "Software and credits";

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
  { id: 1, category: "Research papers", citation: "Siew K. et al. (2024). Kidney stone risk in spaceflight. Nature Communications.", supports: "Fluid, sodium and bone calcium together raise kidney stone risk in flight", usedIn: "Kidney stone rule, Assistant evidence", url: "https://doi.org/10.1038/s41467-024-49212-1", checked: false },
  { id: 2, category: "Research papers", citation: "Trappe S. et al. (2009). Exercise in space, human skeletal muscle after 6 months aboard the ISS. Journal of Applied Physiology.", supports: "Calf muscle volume and power fall in flight even with exercise", usedIn: "Musculoskeletal rule", url: "https://doi.org/10.1152/japplphysiol.91578.2008", checked: false },
  { id: 3, category: "Research papers", citation: "Barger L. K. et al. (2014). Prevalence of sleep deficiency and hypnotic use among astronauts. Lancet Neurology.", supports: "Crews sleep well below the scheduled 8.5 hours", usedIn: "Cognitive readiness rule", url: "https://doi.org/10.1016/S1474-4422(14)70122-X", checked: false },
  { id: 4, category: "Research papers", citation: "Nasrini J. et al. (2020). Cognitive performance during confinement and sleep restriction in NASA analog missions. Frontiers in Physiology.", supports: "Sleep loss slows reaction time on vigilance tests", usedIn: "Cognitive readiness rule, EVA gate", url: "https://doi.org/10.3389/fphys.2020.00394", checked: false },
  { id: 5, category: "Research papers", citation: "Zeitlin C. et al. (2013). Measurements of energetic particle radiation in transit to Mars on the Mars Science Laboratory. Science.", supports: "About 1.8 mSv per day in Mars cruise", usedIn: "Radiation feed, mission profiles", url: "https://doi.org/10.1126/science.1235989", checked: false },
  { id: 6, category: "Research papers", citation: "Rooney B. V. et al. (2019). Herpes virus reactivation in astronauts during spaceflight. Frontiers in Microbiology.", supports: "Stress and sleep loss let latent viruses reactivate", usedIn: "Immune strain rule", url: "https://doi.org/10.3389/fmicb.2019.00016", checked: false },
  { id: 7, category: "Research papers", citation: "Marshall-Goebel K. et al. (2019). Assessment of jugular venous blood flow stasis and thrombosis during spaceflight. JAMA Network Open.", supports: "Headward fluid shift links to vision changes and venous stasis", usedIn: "Fluid shift rule", url: "https://doi.org/10.1001/jamanetworkopen.2019.15011", checked: false },
  { id: 8, category: "Research papers", citation: "Smith S. M. et al. (2005). Bone markers, calcium metabolism and calcium kinetics during extended-duration space flight. Journal of Nutrition.", supports: "Low energy and vitamin D intake speed bone and muscle loss", usedIn: "Under-fuelling rule", url: "https://doi.org/10.1093/jn/135.3.437", checked: false },
  { id: 9, category: "Research papers", citation: "Du B. et al. (2011). Evaluation of physical and chemical changes in pharmaceuticals flown on space missions. AAPS Journal 13, 299.", supports: "Medicines flown on the ISS broke down faster than ground controls", usedIn: "Potency tracker", url: "https://doi.org/10.1208/s12248-011-9270-0", checked: false },
  { id: 10, category: "Research papers", citation: "Wotring V. E. (2016). Chemical potency and degradation products of medications stored over 550 earth days at the ISS. AAPS Journal 18, 210.", supports: "Optimistic edge of the potency range, label date treated as a cautious 90 percent point", usedIn: "Potency tracker", url: "", checked: false },
  { id: 11, category: "Research papers", citation: "Blue R. S. et al. (2019). Supplying a pharmacy for NASA exploration spaceflight. npj Microgravity 5, 15.", supports: "Radiation effects on medicines cannot yet be predicted reliably, so HALO shows a range", usedIn: "Potency tracker", url: "", checked: false },
  { id: 12, category: "NASA data and programmes", citation: "NASA Open Science Data Repository RadLab Data API (ISS radiation dose rate).", supports: "Real ISS dose rate used for the radiation feed", usedIn: "Radiation, Assistant backend", url: "https://visualization.osdr.nasa.gov/radlab/", checked: false },
  { id: 13, category: "NASA data and programmes", citation: "NASA Open Science Data Repository, Inspiration4 and SOMA datasets.", supports: "Real biomarker ranges used to build the simulated crew baselines", usedIn: "Crew simulator", url: "https://osdr.nasa.gov/", checked: false },
  { id: 14, category: "NASA data and programmes", citation: "NASA Human Research Program, the five hazards of human spaceflight.", supports: "Every signal is tagged to one of Radiation, Isolation, Distance, Gravity or Environment", usedIn: "Body systems, Health page", url: "https://www.nasa.gov/hrp/hazards", checked: false },
  { id: 15, category: "NASA data and programmes", citation: "NASA Technical Reports Server, spaceflight associated neuro-ocular syndrome (SANS) brief.", supports: "About two thirds of long-duration astronauts show early signs", usedIn: "Vision guidance, Assistant evidence", url: "https://ntrs.nasa.gov/citations/20220016048", checked: false },
  { id: 16, category: "NASA data and programmes", citation: "NASA Earth-Independent Medical Operations (EIMO) concept of operations.", supports: "The medical officer on a delayed link, which HALO is a small working version of", usedIn: "Pitch and architecture", url: "", checked: false },
  { id: 17, category: "NASA data and programmes", citation: "NASA ExMC reanalysis of Du et al. 2011 (Reichard), NTRS 20220000500.", supports: "First-order breakdown model, spaceflight about 1.5 times faster on the ISS", usedIn: "Potency tracker", url: "https://ntrs.nasa.gov/citations/20220000500", checked: false },
  { id: 18, category: "Software and credits", citation: "Geist Sans and Geist Mono fonts (SIL Open Font License).", supports: "Typography", usedIn: "Whole app", url: "https://vercel.com/font", checked: true },
  { id: 19, category: "Software and credits", citation: "Phosphor Icons (MIT licence).", supports: "Icons", usedIn: "Whole app", url: "https://phosphoricons.com/", checked: true },
  { id: 20, category: "Software and credits", citation: "React, Vite and Recharts (MIT licence).", supports: "Interface and charts", usedIn: "Whole app", url: "https://react.dev/", checked: true },
  { id: 21, category: "Software and credits", citation: "FastAPI and Pydantic (MIT licence).", supports: "Backend server", usedIn: "backend/", url: "https://fastapi.tiangolo.com/", checked: true },
];

export const AI_USE_STATEMENT =
  "The Assistant can call a hosted language model (Claude, by Anthropic) only to explain a crew member's own data in plain language. Emergency detection is plain rules that run first and never depend on the model, and a filter removes any sentence that contains a medication amount. Without a key the app uses rule-based answers. Generative AI tools also helped the team write code and documentation, and the team reviewed the output. All crew data is simulated.";

export const CATEGORIES: Category[] = ["Research papers", "NASA data and programmes", "Software and credits"];
