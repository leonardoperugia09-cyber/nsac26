import card from "./Card.module.css";
import { PageHero } from "./PageHero";

/** Medicines for the "You" profile: nothing is invented; schedules come from a flight surgeon */
export function NoMedicines() {
  return (
    <>
      <PageHero page="Medicines" state="normal" title="No medicines set up for you" line="Schedules come from your flight surgeon. HALO never adds a medicine or a dose by itself." />
      <section className={card.card} style={{ maxWidth: 640 }}>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: "var(--ink-2)" }}>
          The three simulated astronauts have demo schedules. Your own profile starts empty, like the rest of your data.
        </p>
      </section>
    </>
  );
}
