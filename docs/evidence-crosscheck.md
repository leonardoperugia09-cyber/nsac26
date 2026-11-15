# Evidence cross-check and fact-check (2026-11-15)

How this was made: 41 NASA and open-access sources were read from their stored full text (or, for two NASA documents, from the PDF). Every claim in `backend/resources/evidence.json` carries a word-for-word quote with its location, and a test (`backend/tests/assistant.test.ts`) checks that each quote really appears in the stored source text. Source ids below refer to that library. Review status of every source stays "domain review pending"; nothing here is clinical validation.

## What was changed in HALO because of this check
- Assistant: SANS prevalence now says "about two in three show optic disc swelling on detailed eye scans, about four in five at least one SANS sign" (was "about 66% show early signs").
- Assistant: "a night without sleep slows reaction time; a single shortened night may not" (was "one short night slows reaction time").
- Assistant: dizziness on standing is "best documented after landing" (was "common in space"); headaches "can come from" fluid shift or CO2 (was "often").

## Recommended for the owners to review (not changed, because it changes the demo data or Leo's models)
- Simulator bone loss 1.0 to 1.5% per month: matches early long flights; ISS crews with heavy exercise lose less (about 2 to 4% over six months). Add an era note.
- Simulator body mass -2 to -4% in the first month: no source gives a first-month figure; sources say 1 to 5% over a mission.
- Simulator calf volume -13% at 6 months: sources give about 10 to 18%.
- Simulator Mars cruise 1.8 mSv/day: plausible (sources give 1 to 2 mSv/day) but the measured MSL RAD paper is not in this open library.
- Medicine potency: "extra ageing scales with radiation dose" is contradicted by the NASA pharmacology evidence report (exploration-level radiation has "no significant effect on drug stability"); the 1.5x faster loss is supported only as an ISS average for repackaged tablets with an unidentified cause. "Label date = 90% potency, the usual USP limit" is not stated by any source.
- Kidney stone rule: low fluid, high sodium and bone breakdown are supported; "dark urine" is not tested in any source; one 2024 study argues part of the risk is a primary kidney change, not only bone loss.
- Radiation limit, if HALO ever shows one: NASA-STD-3001 Vol 1 Rev C (2023), [V1 4030]: career effective dose "shall be less than 600 mSv. This limit is universal for all ages and sexes." Solar event protection: less than 250 mSv effective dose.


## Cross-check, group A (kidney, bone, muscle, nutrition)

### (a) Agreement and disagreement

**Kidney stones and hydration.** Agree: calcium in urine rises in flight and urine volume falls (hrp_renal_stone_2017, siew_cosmic_kidney_2024, okada_urolithiasis_2022). Urine volume was 47% lower early and 39% lower late in long missions (hrp_renal_stone_2017:x31). Disagree on cause: the NASA report and Rosenthal put bone loss first. Siew argues stone risk may partly be a primary kidney change, "rather than solely a secondary consequence of bone loss" (x2).

**Bone loss.** Rates differ by source and era:
- hrp_bone_fracture_2024: 1 to 1.5% per month (hip, spine), a Mir-era average.
- okada_urolithiasis_2022: about 1.5% per month, cited.
- stavnichuk_bone_2020: lower limb 0.8% per month (CI 0.5 to 1.1), 5.4% total; lumbar/pelvis 6.2%.
- scott_exercise_2023 (ISS, 178 days, ARED): mean BMD down 2.1 to 3.7%, about 0.4 to 0.6% per month.
- rosenthal_bisphosphonate_2024: up to 26% at the hip, a personal communication with no time span.
Exercise: Okada x6 says heavy ARED exercise can keep bone mass. Okada, Rosenthal and hrp_bone_fracture_2024:x147 say it does not stop the rise in bone breakdown markers or fully protect hip and spine.

**Muscle.** hrp_muscle_aerobic_2023: calf down 10 to 18%, thigh 4 to 7% (161 to 194 day ISS missions). scott_exercise_2023: lower leg size and strength fell significantly, upper body did not.

**Nutrition and body mass.** hrp_nutrition_2015: 1 to 5% mass loss is typical. laurens_energy_2019: 2 to 5% on ISS. scott_exercise_2023: mean body, lean and fat mass "virtually unchanged". Laurens suggests the exercise program may drive weight loss; Scott does not test this.

### (b) Fact-check of HALO numbers

- **Bone density -1.0 to -1.5% per month: partly.** Matches Mir-era and cited averages (hrp_bone_fracture_2024:x26, "1-1.5% BMD loss/month"). Modern ISS data with ARED are lower (Scott, Stavnichuk 0.8%). Suggested wording: "About 1 to 1.5% per month in early long flights; ISS crews with heavy exercise lose less, about 2 to 4% over six months."
- **Plasma volume -10 to -20% within 24-48 h: supported.** hrp_nutrition_2015:x165: "initial ~17% below preflight levels to ~11%" and "10% to 15% below" on long flights. hrp_muscle_aerobic_2023:x88: 17% on flight day 1. The 10% in 24 h is from bed rest (x246). Add "stays 10 to 15% low".
- **Calf muscle volume -13% after 6 months: partly.** No source gives 13%. hrp_muscle_aerobic_2023:x155: calf 10 to 18% (soleus 15 to 19%, gastrocnemius 10%), measured 4 to 5 days after landing. Say "about 10 to 18%".
- **Energy intake about 80% of need: supported.** hrp_nutrition_2015:x107: "ISS intakes on average about 80% of requirements" (70% earlier). Some crews met needs (x128).
- **Body mass -2 to -4% in the first month: not covered / partly.** No source gives a first-month figure. Use "1 to 5% over a mission" (hrp_nutrition_2015:x114) or "2 to 5%" on ISS (laurens_energy_2019:x5).
- **Kidney stone rule: supported with two fixes.** Low fluid or urine volume, high sodium and bone breakdown are all backed (hrp_renal_stone_2017:x11, x64; okada). "Dark urine" is not in any source; Siew x12 shows urine osmolality rose, which fits, but none tests colour. Do not present bone breakdown as the only driver (Siew). Also hrp_nutrition_2015:x167 says total body water falls only about 1% and "weightlessness-induced dehydration does not exist", so keep "low intake" and "fluid shift" separate.
- **Radiation limits, medicines, sleep, SANS, blood pressure, temperature:** not covered by group A.

### (c) Show as "not established"

1. Whether kidney stone risk is mainly a primary kidney change or follows bone loss (siew_cosmic_kidney_2024).
2. Whether exercise itself, not microgravity, causes in-flight weight loss (laurens_energy_2019).
3. Whether Moon or Mars partial gravity reduces bone changes (hrp_bone_fracture_2024:x38, "not known").

## Cross-check, group B (SANS, fluid shift, orthostatic, immune, sleep, cognition, behaviour)

### 1. SANS and vision (hrp_sans_2017, lee_sans_2020, gew_sans_consensus_2026)
Agree: SANS is a set of findings (disc oedema, globe flattening, folds, hyperopic shift). Headaches in astronauts are mild, unlike raised skull pressure on Earth (>90% of IIH patients).
Disagree on prevalence, because the metric differs: disc edema 16% (hrp_sans_2017 x23) vs 66% by an OCT 20 micrometre threshold (gew x47); any finding 38-51% (hrp_sans x23; x285 says 37-51%) vs 81% (52 of 64, gew x12).

### 2. Fluid shift, orthostatic, cardiovascular (hrp_orthostatic_2015, wood_legcuff_2019, marshall_goebel_jugular_2019)
Presyncope on landing day: 20-30% after short flights, 66% (4 of 6) ISS vs 20% Shuttle in tilt tests (x37, x41). Fluid shift is a trigger, but all tested crew are low in volume and only some faint (x15, x65). Leg cuff test did not predict who was affected (wood, 2 of 8).
Disagree: hrp_orthostatic x29 says in-flight blood pressure and heart rate fell; marshall_goebel x16 says heart rate and MAP were unchanged in flight (seated, n=11).

### 3. Immune (hrp_immune_2013, rooney_herpes_2019, crucian_immune_2018, jones_inspiration4_2024)
Agree: herpesvirus shedding in 53% of Shuttle (47/89) and 61% of ISS (14/23) astronauts, mostly without symptoms. The cause of immune dysregulation is "unknown" (hrp_immune x15).

### 4. Sleep, cognition, behaviour (hrp_sleep_circadian_2016, koller_sleep_2021, nasrini_hera_cognition_2020, dev_cognition_2024, hrp_behavioral_2016)
Agree: about 6 h per night in space (6.0 vs 7.9 h on Earth, x37), though Barger found only about 19 min less than preflight (x39). Dev (n=25): stable cognition, early-flight slowing.

### FACT-CHECK of HALO numbers
- SANS "66% show early signs": PARTLY. 66% is optic disc oedema by OCT threshold (gew x47: "66% of astronauts after LDSF may be diagnosed with optic disc oedema due to SANS"). Any finding is 81%; older NASA count was 16%. Fix: "About two in three long-duration astronauts show optic disc swelling on detailed eye scans; four in five show at least one SANS sign."
- Sleep about 6 h: SUPPORTED (hrp_sleep x36: "sleep duration in space is approximately six hours"). 8.5 h scheduled: NOT COVERED (8.5 appears only as adult need, x20).
- Reaction time after a short night: PARTLY. HERA partial restriction (bed about 3 am) did not slow tasks, only lowered emotion-recognition accuracy (nasrini x27); a full night awake did (x2). Jones x49: ISS sleep under 6 h linked to psychomotor slowing. Fix: "A night without sleep slows reaction time; one shortened night may not."
- Headache from fluid shift or CO2: SUPPORTED (hrp_sans x182 anecdotal fluid shift; x227 CO2 and headache association). Word as "can come from".
- Dizziness on standing: SUPPORTED for return to gravity (hrp_orthostatic x15, x37). Not shown in orbit. Fix: say "after landing".
- Blood pressure -8/-9 mmHg: NOT COVERED numerically. Only "decreased" (x29), and marshall x16 says MAP unchanged.
- Body temperature +0.6 C: NOT COVERED. crucian x102 only notes "elevations" with no number.
- Plasma volume -10 to -20% in 24-48 h: PARTLY. Skylab 8.4, 13.1, 15.9% measured after flight (x52); Apollo 4.4% (x50); shift "thought" to happen in first two days, no in-flight measure (x51). Fix: "about 4 to 16% lower at landing in older missions; timing inferred."
- Body mass -2 to -4% in month 1: NOT COVERED (Apollo about 5% mass loss, a third regained within 24 h, x50).

### Open questions to show as "not established"
1. Why optic disc swelling occurs (skull pressure vs trapped fluid in the optic nerve sheath).
2. Whether viral shedding leads to illness on long missions (hrp_immune, crucian).
3. Whether risk of behavioural problems rises with mission length on Mars (hrp_behavioral x23 vs x40, no cases so far).

## Cross-check, group C (radiation, medicines, Earth-independent medicine)

### Radiation
**Agree.** Deep-space dose is about 1 to 2 mSv/day: chancellor_radiation_2018 (1 to 2 interplanetary, 0.5 to 1 Mars surface), hrp_ars_spe_2016 (1.5 near solar minimum), nasa_std_3001_vol1_revc p46 (1.5 unshielded, 1.3 shielded).
**Disagree.**
- Career limit wording changed. 2016 sources (hrp_carcinogenesis_2016, ntrs_radiation_pel_2016) describe a 3% risk of exposure induced death with age and sex dependent limits. Rev C (2023) uses one flat 600 mSv for everyone; 3% is only the rationale.
- The OCHMO brief (2022) says a cosmic ray limit "has not been formally adopted"; Rev C p45 adopts 1.3 mSv/day (free space) and 0.9 (surface) for systems over 60 days. Rev C wins.
- Uncertainty: panels agree within a factor of two (hrp_carcinogenesis_2016); Rev C says model choices can move output 25%. Slaba's models are within about 5% of measured absorbed dose, not of risk.

### Fact-check
- **Mars cruise 1.8 mSv/day, SD 0.2: not covered.** No measured cruise dose in my sources. The range 1 to 2 is supported (chancellor_radiation_2018:x35). The MSL RAD source is outside my set. 1.8 is above the 1.3 shielded design target (Rev C p45), a vehicle requirement, not a measurement. SD: not covered.
- **Solar storm about 18 mSv over 2 days: partly.** Plausible: large historic events give 10 to 500 mGy behind average shielding (hrp_ars_spe_2016:x18), far below the 250 mSv event limit. The per-event MSL range is not in my set.
- **Radiation limit wording.** NASA-STD-3001 Vol 1 Rev C (approved 2023-09-15), p40, [V1 4030]: "An individual crewmember’s total career effective radiation dose due to spaceflight radiation exposure shall be less than 600 mSv. This limit is universal for all ages and sexes." [V1 4031], p42: protect from the design reference solar event "to less than an effective dose of 250 mSv." Caution: NASA effective dose uses a 35-year-old female model for all crew.

### Medicines
**Agree.** reichard_potency_2023 (~1.51-fold) and hrp_pharmacology_2023 (~50%) give the same flight vs ground rate ratio. Repackaged drugs drift more (41% vs 14% differed over 5%).
**Disagree.** Du's original paper: 25 of 36 flight drugs failed USP strength vs 17 of 36 controls; Reichard stresses all stayed within 10% of control. Ground controls failed too (9 of 24, hrp_pharmacology_2023:x81). The ratio is an average: ibuprofen 7.02, imipenem 9.43 (reichard_potency_2023:x20).

### Fact-check
- **About 1.5x faster: supported, with limits.** reichard_potency_2023:x28 ("~1.51-fold (51%) increased rate"). Data are ISS only, mostly repackaged tablets. Wording: "about 1.5 times faster on the ISS for repackaged tablets, on average, cause not identified".
- **Extra ageing scales with radiation dose (README mechanism): contradicted.** hrp_pharmacology_2023:x184: exploration-level radiation will have "no significant effect on drug stability". Reichard: cause uncharacterized. Call it a modelling choice.
- **Label date = 90% potency: partly.** No source says this. Reichard projects most drugs below 90% of label by a 3 year mission (x22). Diaz: the printed date is a minimum stability promise, true life may be longer, and the ICH range cited is 95 to 105%. "Usual USP limit": not covered.

### Earth-independent medicine
Mars missions 2 to 3 years, transit 6 to 9 months, delay 4 to 22 minutes in Mars orbit, possible 2 week blackout, no evacuation (ntrs_mars_med_conops_2019). Of 194 conditions screened: 135 plan to treat, 22 with conditions, 34 excluded; these sum to 191 (ntrs_mars_conditions_2019). Condition names are not listed.

### Open questions (show as not established)
1. What causes extra drug loss on the ISS (hrp_pharmacology_2023).
2. Whether low-dose-rate cosmic rays harm brain and heart in humans (hrp_cns_radiation_2016).
3. Whether the 3% cancer limit is conservative enough (chancellor_radiation_2018).
