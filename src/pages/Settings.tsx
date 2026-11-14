import card from "../components/Card.module.css";
import s from "./Settings.module.css";

export type Look = "field" | "plain";

const LOOKS: { id: Look; label: string; note: string }[] = [
  {
    id: "field",
    label: "Grey page",
    note: "White cards on a light grey page.",
  },
  {
    id: "plain",
    label: "White page",
    note: "Light grey cards on a white page.",
  },
];

export function Settings({
  look,
  onLook,
}: {
  look: Look;
  onLook: (l: Look) => void;
}) {
  return (
    <>
      <h1 className={s.title}>Settings</h1>
      <section
        className={`${card.card} ${s.group}`}
        aria-labelledby="look-title"
      >
        <div className={card.head}>
          <h2 id="look-title">Appearance</h2>
        </div>
        <div
          role="radiogroup"
          aria-labelledby="look-title"
          className={s.options}
        >
          {LOOKS.map((o) => (
            <label key={o.id} className={s.option}>
              <input
                type="radio"
                name="look"
                value={o.id}
                checked={look === o.id}
                onChange={() => onLook(o.id)}
              />
              <span>
                <b>{o.label}</b>
                <small>{o.note}</small>
              </span>
            </label>
          ))}
        </div>
      </section>
      {/* Manar's backend: only needed when the HALO server runs with HALO_API_TOKEN set */}
      <section className={`${card.card} ${s.group} ${s.server}`} aria-labelledby="server-title">
        <div className={card.head}><h2 id="server-title">HALO server</h2></div>
        <label className={s.field} htmlFor="server-token">Server token, optional</label>
        <input id="server-token" className={s.input} type="password" autoComplete="off"
          defaultValue={sessionStorage.getItem("halo-api-token") ?? ""}
          onChange={(e) => sessionStorage.setItem("halo-api-token", e.target.value)} />
        <p className={s.note}>Only needed when the on-board server asks for one. Kept for this session only.</p>
      </section>
    </>
  );
}
