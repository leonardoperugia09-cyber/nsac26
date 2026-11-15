// MOCK: reference content for the Evidence page. Thresholds are demo parameters.

export type Rule = { name: string; combines: string; why: string; action: string; source: string };

export const RULES: Rule[] = [
  { name: "Kidney stone risk", combines: "bone loss trend, fluid intake, urine colour, sodium intake", why: "Bone calcium plus low fluid plus kidney remodelling", action: "Raise fluid intake, cut sodium, flag to the crew medical officer", source: "Siew et al. 2024" },
  { name: "Fluid shift syndrome", combines: "blood pressure, heart rate (headache, puffy face and vision check not logged yet)", why: "One headward fluid shift drives both SANS and neck-vein stasis", action: "Weekly vision self-test, report blurred vision at once", source: "NASA NTRS SANS brief; Marshall-Goebel et al. 2019" },
  { name: "Cognitive readiness", combines: "sleep hours, sleep debt, reaction time test, memory test, radiation dose today (workload not logged yet)", why: "Sleep loss and stress slow vigilance; radiation adds risk", action: "Go, caution or no-go before a spacewalk or docking", source: "Nasrini et al. 2020; Barger et al. 2014" },
  { name: "Musculoskeletal decline", combines: "exercise minutes, body mass, bone density, calf muscle volume, each against the normal in-flight decline", why: "Unloading drives muscle and bone loss together", action: "Adjusted resistance plan for today", source: "Trappe et al.; NASA risk of bone change" },
  { name: "Immune strain", combines: "sleep debt, stress check-in, mood (skin symptoms and cold sores not logged yet)", why: "Stress hormones let latent viruses wake up", action: "Rest first, hygiene, log symptoms", source: "Rooney et al. 2019" },
  { name: "Under-fuelling", combines: "calories eaten, body mass trend, vitamin D", why: "Low energy intake speeds bone and muscle loss", action: "Meal nudge, vitamin D reminder", source: "Smith et al., NASA" },
  { name: "Solar storm exposure", combines: "radiation dose today against the normal dose for the mission (ISS, Moon or Mars cruise)", why: "Solar particle events spike the dose fast", action: "Move to the shielded shelter, delay the spacewalk", source: "SwRI MSL RAD; Guo et al. 2015" },
];

export const DATA_ROWS: { data: string; status: string; source: string }[] = [
  { data: "Three crew members, their pre-flight baselines and 120 days of readings", status: "Simulated", source: "Crew simulator (seed 42) with planted events; baselines chosen by us to be realistic" },
  { data: "Rates of bone, muscle, fluid, blood pressure, temperature and sleep change", status: "Real published rates", source: "The papers above, used to drive the simulated readings" },
  { data: "Mars cruise radiation", status: "Real published rate, applied by us", source: "MSL RAD: 1.8 mSv per day, day-to-day spread 0.3 (Zeitlin 2013, Guo 2015)" },
  { data: "Day-40 solar storm", status: "Simulated", source: "About 18 mSv over 2 days, inside what MSL RAD measured per event" },
  { data: "ISS and Moon normal dose", status: "Real order of magnitude / demo estimate", source: "ISS about 0.4-0.55 mSv per day; Moon 1.4 is our estimate" },
  { data: "Live RadLab radiation feed", status: "Not connected yet", source: "NASA OSDR RadLab API is planned; no cached snapshot in the app" },
  { data: "Medicine potency forecast", status: "Real studies, our extrapolation", source: "Du 2011, Wotring 2016, NASA reanalysis; scaling by dose is our assumption" },
  { data: "Coupling rule and drift thresholds", status: "Demo parameters", source: "Our own, labelled as such" },
];

export const NASA_DATA: { name: string; use: string }[] = [
  { name: "NASA OSDR", use: "planned source for real biomarker ranges (not used yet)" },
  { name: "OSDR RadLab", use: "planned live radiation feed (not connected yet)" },
  { name: "Human Research Program five hazards", use: "every signal is tagged to one" },
  { name: "Inspiration4 and SOMA", use: "commercial crews need monitoring too" },
  { name: "EIMO concept of operations", use: "HALO is a small working version of it" },
];

export const IMAGE_CREDITS: { name: string; use: string }[] = [
  { name: "Body map", use: "Front and back anatomy drawn as SVG for HALO (src/bodymap). No third-party images." },
];

export const TESTS_TEXT = "20 test questions across body systems, scored on safety (no dose, right escalation), accuracy against the source, and clarity.";
