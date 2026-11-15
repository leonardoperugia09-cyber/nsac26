import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  CaretRight,
  ChartLineUp,
  Check,
  ClockCounterClockwise,
  FileText,
  Microphone,
  Paperclip,
  X,
  RocketLaunch,
  ShieldCheck,
  Stethoscope,
} from "@phosphor-icons/react";
import card from "../components/Card.module.css";
import { HaloMark } from "../components/HaloMark";
import { ACTION_MARK } from "../shared/assistantTopics.ts";
import { PageHero } from "../components/PageHero";
import { More } from "../components/More";
import { driftOn } from "../ui/systems.ts";
import {
  MISSION_PROFILE,
  contextOf,
  crewById,
  historyOf,
  isCustomScenario,
  readingOn,
} from "../data/crew.ts";
import type { MissionProfile } from "../engine/types.ts";
import { assessCrew } from "../engine/assessment.ts";
import { api } from "../shared/api.ts";
import type {
  AssistantReply,
  AssistantStatus,
  ConversationTurn,
} from "../shared/assistantTypes.ts";
import { answer } from "../shared/offlineAssistant.ts";
import { buildOverview } from "../ui/overviewData.ts";
import { GATE_OF, worstGate } from "../ui/missionData.ts";
import { SYSTEMS, systemStatus } from "../ui/systems.ts";
import {
  EMERGENCY_TEXT,
  EMPTY_QUICK,
  NOTE_TEXT,
  SEED_C2,
  haloMsg,
  safetyReply,
  userMsg,
  type Block,
  type Message,
} from "../ui/assistantData.ts";
import s from "./Assistant.module.css";

type Props = {
  crewId: string;
  day: number;
  profile?: MissionProfile;
  delay: string | null;
  urgent: boolean;
};

// POST /api/assistant returns an AssistantReply; shared/offlineAssistant.ts mirrors it when the server is unreachable
type Reply = AssistantReply;

const ON_BOARD: Block = { kind: "via", text: "Answered on board" };
const replyBlocks = (r: Reply): Block[] =>
  r.triage.urgent
    ? [
        {
          kind: "emergency",
          title: "This could be an emergency",
          text: EMERGENCY_TEXT,
        },
      ]
    : [
        ...r.explanation.split(/\n{2,}/).flatMap(splitAction),
        ...(r.citations.length
          ? [
              {
                kind: "sources",
                titles: r.citations.map((c) => c.title),
              } as const,
            ]
          : []),
        // A generated answer says what it is unsure about
        ...(r.mode === "grounded_ai" && r.uncertainties?.length
          ? [
              {
                kind: "via",
                text: `Limits: ${r.uncertainties.join(" ")}`,
              } as const,
            ]
          : []),
        { kind: "escalation", text: r.escalation },
        ...(r.followUp?.length
          ? [{ kind: "quick", options: r.followUp.slice(0, 3) } as const]
          : []),
      ];
/** "… What to do now: X" becomes the explanation plus a highlighted action line */
const splitAction = (text: string): Block[] => {
  const [said, todo] = text.split(ACTION_MARK);
  return todo
    ? [
        { kind: "text", text: said.trim() },
        { kind: "action", text: `${ACTION_MARK} ${todo.trim()}` },
      ]
    : [{ kind: "text", text }];
};
// Which path answered, in plain words (Manar's statuses from backend/node/assistant.ts)
const serverLine = (r: Reply) =>
  r.mode === "grounded_ai"
    ? "Written by hosted AI from HALO's sources. Check the sources listed"
    : r.modelStatus === "not_configured"
      ? "Answered by the HALO server from its sources. Hosted AI is not set up"
      : r.modelStatus === "invalid_configuration"
        ? "Answered by the HALO server from its sources. Hosted AI is set up wrong"
        : r.modelStatus === "failed_using_offline_fallback"
          ? "Answered by the HALO server from its sources. The hosted AI request failed"
          : r.modelStatus === "insufficient_evidence"
            ? "HALO's sources don't cover this, so the AI was not asked"
            : r.modelStatus === "safety_bypass"
              ? "Safety answer, the AI was not asked"
              : "Answered by the HALO server from its sources";
/** The last six turns go with each question so follow-ups make sense */
const turnsOf = (messages: Message[]): ConversationTurn[] =>
  messages.slice(-6).map((m) => ({
    role: m.from === "user" ? "user" : "assistant",
    content: (m.from === "user"
      ? m.text
      : m.blocks
          .map((b) => ("text" in b && typeof b.text === "string" ? b.text : ""))
          .filter(Boolean)
          .join(" ")
    ).slice(0, 2000),
  }));

const mono = (t: string) => <span className="mono">{t}</span>;

function Emergency({
  title,
  text,
  delay,
}: {
  title: string;
  text: string;
  delay: string | null;
}) {
  const [started, setStarted] = useState(false);
  return (
    <div className={s.emergency} role="alert">
      <h2 className={s.emTitle}>{title}</h2>
      <p className={s.emText}>{text}</p>
      <button
        type="button"
        className={s.emBtn}
        onClick={() => setStarted(true)}
      >
        Start emergency protocol
      </button>
      {started ? (
        <p className={s.emNote}>
          Protocol started. Report sent; it reaches Houston{" "}
          {delay ? <>in {mono(delay)}</> : "right away"}.
        </p>
      ) : (
        <p className={s.emNote}>A report goes to Houston now.</p>
      )}
    </div>
  );
}

function NoteRow({ delay }: { delay: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={s.noteRow}>
      <div className={s.noteLine}>
        <span>
          Note drafted for your flight surgeon. Arrives in{" "}
          {mono(delay ?? "moments")}.
        </span>
        <button
          type="button"
          className={s.secondary}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? "Hide note" : "View note"}
        </button>
      </div>
      {open && <p className={s.notePreview}>{NOTE_TEXT}</p>}
    </div>
  );
}

export function Assistant({
  crewId,
  day,
  profile = MISSION_PROFILE,
  delay,
  urgent,
}: Props) {
  const drift = useMemo(() => driftOn(crewId, day), [crewId, day]);
  const risk = useMemo(() => buildOverview(crewId, day).risk, [crewId, day]);
  // Start screen first: when you're fine it should be obvious what this page is for
  const [mode, setMode] = useState<"start" | "chat">(urgent ? "chat" : "start");
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const area = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [allowAI, setAllowAI] = useState(
    () => sessionStorage.getItem("halo-allow-ai") === "true",
  );
  const [aiStatus, setAiStatus] = useState<AssistantStatus | null>(null);
  useEffect(() => {
    let cancelled = false;
    api<AssistantStatus>("/assistant/status")
      .then((r) => {
        if (!cancelled) setAiStatus(r);
      })
      .catch(() => {
        if (!cancelled) setAiStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, [allowAI]);
  // The conversation card runs to the bottom of the screen: tiles at the top, the typing bar at the bottom
  const convo = useRef<HTMLElement>(null);
  const [convoH, setConvoH] = useState<number>();
  useLayoutEffect(() => {
    const fit = () => {
      let y = 0;
      for (
        let n: HTMLElement | null = convo.current;
        n;
        n = n.offsetParent as HTMLElement | null
      )
        y += n.offsetTop;
      setConvoH(Math.max(480, window.innerHeight - y - 24));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [mode]);

  useEffect(() => {
    setMessages([]);
    setMode(urgent ? "chat" : "start");
  }, [crewId, urgent]);
  useEffect(() => {
    if (urgent) input.current?.focus();
  }, [urgent]);
  useEffect(() => {
    const el = area.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // The HALO server answers first; if it is down, the on-board copy gives the same answers (src/shared/assistantTopics.ts)
  const ask = async (
    q: string,
    history: ConversationTurn[],
  ): Promise<Block[]> => {
    const context = contextOf(crewId, day);
    try {
      const r = await api<Reply>("/assistant", {
        crewId,
        day,
        profile,
        question: q,
        symptoms: context.symptoms ?? [],
        history,
        allowAI,
      });
      return [...replyBlocks(r), { kind: "via", text: serverLine(r) }];
    } catch {
      const local = replyBlocks(
        answer(
          q,
          assessCrew(historyOf(crewId), day, profile, context),
          context.symptoms ?? [],
          readingOn(crewId, day) as Record<string, unknown> | undefined,
        ),
      );
      return [...local, ON_BOARD];
    }
  };
  const send = (raw: string) => {
    const t = [raw.trim(), file ? `Attached: ${file.name}` : ""]
      .filter(Boolean)
      .join("\n");
    if (!t) return;
    setFile(null);
    setMode("chat");
    setText("");
    // Red flags and medicine questions are answered on board at once, before any server or AI call
    const safety = safetyReply(t);
    const reply = haloMsg(
      safety ? [...safety, ON_BOARD] : [{ kind: "pending" }],
    );
    const history = turnsOf(messages);
    setMessages((m) => [...m, userMsg(t), reply]);
    if (!safety)
      void ask(t, history).then((blocks) =>
        setMessages((m) =>
          m.map((x) => (x.id === reply.id ? { ...reply, blocks } : x)),
        ),
      );
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(text);
    }
  };

  const fluid = drift.fluid_intake_ml,
    urine = drift.urine_color_1to8,
    sodium = drift.sodium_mg;
  const today = readingOn(crewId, day); // shown values = today's reading, like Overview and Health
  const litres = (v: number) => (v / 1000).toFixed(2);
  const fluidText = fluid && today ? `${litres(today.fluid_intake_ml)} L` : "";
  const fluidBand = fluid
    ? `(your normal ${litres(fluid.bandLo)}-${litres(fluid.bandHi)} L)`
    : "";
  const urineText = urine && today ? `${today.urine_color_1to8} of 8` : "";
  const urineBand = urine
    ? `(your normal up to ${Math.round(urine.bandHi)})`
    : "";
  const sodiumText =
    sodium && today ? `${today.sodium_mg.toLocaleString("en-US")} mg` : "";
  const sodiumBand =
    sodium && sodium.status !== "inside band" ? "(above your normal)" : "";

  const renderBlock = (b: Block, i: number): ReactNode => {
    switch (b.kind) {
      case "text":
        return (
          <p key={i} className={s.p}>
            {b.text}
          </p>
        );
      case "check":
        return (
          <div key={i} className={s.check}>
            <ShieldCheck size={20} color="var(--ink-2)" />
            <span>{b.text}</span>
          </div>
        );
      case "evidence":
        return (
          <ul key={i} className={s.evidence}>
            <li>
              Fluid intake today: {mono(fluidText)} {fluidBand}
            </li>
            <li>
              Urine colour: {mono(urineText)} {urineBand}
            </li>
            <li>
              Sodium: {mono(sodiumText)} {sodiumBand}
            </li>
          </ul>
        );
      case "action":
        return (
          <p key={i} className={`${s.p} ${s.action}`}>
            {b.text}
          </p>
        );
      case "escalation":
        return b.text ? (
          <p key={i} className={s.escalation}>
            Next step:{" "}
            {b.text[0].toLowerCase() + b.text.slice(1).replace(/\.?$/, ".")}
          </p>
        ) : (
          <p key={i} className={s.escalation}>
            If the pain becomes severe, or you see blood in your urine, use
            Urgent help.{" "}
            {delay ? (
              <>Houston hears you in {mono(delay)}.</>
            ) : (
              "Houston hears you right away."
            )}
          </p>
        );
      case "quick":
        return (
          <div key={i} className={s.quick}>
            {b.options.map((o) => (
              <button
                key={o}
                type="button"
                className={s.quickBtn}
                onClick={() => send(o)}
              >
                {o}
              </button>
            ))}
          </div>
        );
      case "note":
        return <NoteRow key={i} delay={delay} />;
      case "emergency":
        return (
          <Emergency key={i} title={b.title} text={b.text} delay={delay} />
        );
      case "sources":
        return (
          <ul key={i} className={`${s.evidence} ${s.sources}`}>
            {b.titles.map((t) => (
              <li key={t}>Source: {t}</li>
            ))}
          </ul>
        );
      case "pending":
        return (
          <p key={i} className={s.pending} role="status">
            HALO is checking your readings
          </p>
        );
      case "via":
        return (
          <p key={i} className={s.via}>
            {b.text}
          </p>
        );
    }
  };

  const rowVal = (out: boolean) => (out ? `mono ${s.out}` : "mono");

  // One-line status so you know where you stand before choosing anything
  const flagged = SYSTEMS.filter((d) => systemStatus(d, drift) === "watch").map(
    (d) => d.label,
  );
  const status = risk ? (
    <>
      <b className={risk.level === "act" ? s.act : s.watch}>
        {risk.level === "act" ? "Act" : "Watch"}
      </b>
      &nbsp;&nbsp;{risk.title.replace(/ is rising$/, "")} since Day{" "}
      {risk.sinceDay}.
    </>
  ) : flagged.length ? (
    <>
      No linked risks. {flagged.join(" and ")}{" "}
      {flagged.length === 1 ? "is" : "are"} outside your normal range on{" "}
      {flagged.length === 1 ? "its" : "their"} own.
    </>
  ) : (
    <>Your readings are inside your normal range today.</>
  );

  // MOCK openers for each choice (scripted; no model call in this prototype)
  const readiness = worstGate(
    ["sleep_hours", "reaction_time_ms", "radiation_mSv_today"].map(
      (k) => GATE_OF[drift[k]?.status ?? "inside band"],
    ),
  );
  const start = (kind: "symptom" | "readings" | "task") => {
    setMode("chat");
    if (kind === "symptom") {
      setMessages([
        haloMsg([
          {
            kind: "text",
            text: "Tell me what you feel and where. I check for emergency signs first, then compare it with your readings.",
          },
          { kind: "quick", options: EMPTY_QUICK },
        ]),
      ]);
      setTimeout(() => input.current?.focus(), 0);
    } else if (kind === "readings") {
      setMessages([
        haloMsg(
          risk
            ? [
                { kind: "text", text: "Here's what stands out today:" },
                { kind: "evidence" },
                {
                  kind: "text",
                  text: "Together these raise your kidney stone risk.",
                },
                { kind: "quick", options: ["What should I do?"] },
              ]
            : [
                {
                  kind: "text",
                  text: flagged.length
                    ? `${flagged.join(" and ")} ${flagged.length === 1 ? "is" : "are"} outside your normal range, but nothing is linked to it. Everything else is inside your normal range.`
                    : "Every reading is inside your own normal range today. Nothing needs you.",
                },
              ],
        ),
      ]);
    } else {
      setMessages([
        haloMsg([
          {
            kind: "text",
            text: `Readiness today: ${readiness}. HALO checks your sleep, reaction time and radiation against your own normal.`,
          },
          {
            kind: "text",
            text:
              readiness === "Go"
                ? "You're clear for a spacewalk or docking today. The full check is on Mission."
                : "Look at the full check on Mission before any spacewalk or docking.",
          },
        ]),
      ]);
    }
  };

  return (
    <div>
      <PageHero
        page="Assistant"
        state={risk?.level ?? "normal"}
        title={
          <span className={s.heroTitle}>
            <HaloMark size={48} className={s.heroMark} />
            {mode === "start"
              ? `How are you feeling, ${crewById(crewId).name.split(" ").slice(-2)[0]}?`
              : "HALO is listening"}
          </span>
        }
        line={
          mode === "start"
            ? status
            : "Offline on board. Emergency rules run before the AI."
        }
      />
      <div className={s.grid}>
        <section
          ref={convo}
          className={`${card.card} ${s.convo}`}
          style={{ height: convoH }}
          aria-label="Conversation with HALO"
        >
          <div className={s.messages} ref={area}>
            {mode === "start" && (
              <div className={s.start}>
                <div className={s.choices}>
                  {(
                    [
                      [
                        "symptom",
                        Stethoscope,
                        "Report a symptom",
                        "Pain, headache, vision, anything that feels off.",
                      ],
                      [
                        "readings",
                        ChartLineUp,
                        "Ask about my readings",
                        "What changed, and what's normal for you.",
                      ],
                      [
                        "task",
                        RocketLaunch,
                        "Prepare for a task",
                        "Spacewalk or docking: are you ready today?",
                      ],
                    ] as const
                  ).map(([k, Icon, t, d]) => (
                    <button
                      key={k}
                      type="button"
                      className={s.choice}
                      onClick={() => start(k)}
                    >
                      <span className={s.choiceIcon}>
                        <Icon size={22} />
                      </span>
                      <b>{t}</b>
                      <small>{d}</small>
                      <CaretRight size={18} className={s.choiceGo} />
                    </button>
                  ))}
                </div>
                {crewId === "C2" && !isCustomScenario() && (
                  <button
                    type="button"
                    className={s.earlier}
                    onClick={() => {
                      setMessages(SEED_C2);
                      setMode("chat");
                    }}
                  >
                    <ClockCounterClockwise size={18} />
                    Earlier today at <span className="mono">09:14</span>: lower
                    back ache<span className={s.open}>Open</span>
                  </button>
                )}
              </div>
            )}
            {mode === "chat" && (
              <button
                type="button"
                className={s.back}
                onClick={() => {
                  setMessages([]);
                  setMode("start");
                }}
              >
                <ArrowLeft size={16} />
                New conversation
              </button>
            )}
            {urgent && (
              <Emergency
                title="Urgent help"
                text="Tell me what's happening, or start the emergency protocol now."
                delay={delay}
              />
            )}
            {messages.map((m) =>
              m.from === "user" ? (
                <div key={m.id} className={s.user}>
                  {m.text}
                </div>
              ) : (
                <div key={m.id} className={s.halo}>
                  <div className={s.label}>HALO</div>
                  {m.blocks.map(renderBlock)}
                </div>
              ),
            )}
          </div>
          {file && (
            <div className={s.fileChip}>
              <FileText size={16} />
              {file.name}
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                onClick={() => setFile(null)}
              >
                <X size={14} weight="bold" />
              </button>
            </div>
          )}
          <div className={s.composer}>
            <input
              id="assistant-file"
              type="file"
              className={s.vh}
              accept="image/*,.pdf,.txt,.csv"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
            <label htmlFor="assistant-file" className={s.attach}>
              <Paperclip size={18} />
              Upload file
            </label>
            <label htmlFor="assistant-input" className={s.vh}>
              Describe how you feel
            </label>
            <textarea
              id="assistant-input"
              ref={input}
              className={s.input}
              rows={1}
              placeholder={
                mode === "start"
                  ? "Or describe it in your own words"
                  : "Describe how you feel"
              }
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKey}
            />
            <button type="button" className={s.mic} aria-label="Speak">
              <Microphone size={20} />
            </button>
            <button type="button" className={s.cta} onClick={() => send(text)}>
              Send
            </button>
          </div>
        </section>

        <div className={s.context}>
          <section className={card.card} aria-labelledby="using-h">
            <div className={card.head}>
              <h2 id="using-h">What HALO is using</h2>
            </div>
            <dl className={s.rows}>
              <div>
                <dt>Mission day</dt>
                <dd>Day {mono(String(day))}, Mars transit</dd>
              </div>
              <div>
                <dt>Houston delay</dt>
                <dd>{delay ? <>{mono(delay)} one way</> : "Live"}</dd>
              </div>
              <div>
                <dt>Linked risk</dt>
                <dd>
                  {risk
                    ? `${risk.title.replace(/ is rising$/, "")}, ${risk.level === "act" ? "Act" : "Watch"} since Day ${risk.sinceDay}`
                    : "None right now"}
                </dd>
              </div>
              {fluid && (
                <div>
                  <dt>Fluid intake</dt>
                  <dd className={rowVal(fluid.status !== "inside band")}>
                    {fluidText}
                  </dd>
                </div>
              )}
              {urine && (
                <div>
                  <dt>Urine colour</dt>
                  <dd className={rowVal(urine.status !== "inside band")}>
                    {urineText}
                  </dd>
                </div>
              )}
              {sodium && (
                <div>
                  <dt>Sodium</dt>
                  <dd className={rowVal(sodium.status !== "inside band")}>
                    {sodiumText}
                  </dd>
                </div>
              )}
            </dl>
          </section>
          <section className={card.card} aria-labelledby="guard-h">
            <div className={card.head}>
              <h2 id="guard-h">Guardrails</h2>
            </div>
            <p className={s.guardLine}>
              Safety rules run before the AI. It never gives doses or diagnoses.
            </p>
            <More label="All 5 rules">
              <ul className={s.guards}>
                {[
                  "Emergency rules run before the AI",
                  "Never gives drug doses or changes medicines",
                  "Says what data is consistent with, never a diagnosis",
                  "Says when it's unsure or data is old",
                  "Prototype, not a medical device",
                ].map((g) => (
                  <li key={g}>
                    <Check size={16} color="var(--ink-2)" />
                    {g}
                  </li>
                ))}
              </ul>
            </More>
            {/* Manar: hosted AI is opt-in per session, and the page says exactly what leaves the device */}
            <label className={s.aiToggle}>
              <input
                type="checkbox"
                checked={allowAI}
                onChange={(e) => {
                  setAllowAI(e.target.checked);
                  sessionStorage.setItem(
                    "halo-allow-ai",
                    String(e.target.checked),
                  );
                }}
              />
              Use hosted AI for this session
            </label>
            <p className={s.aiNote} role="status">
              {aiStatus
                ? aiStatus.message
                : "The HALO server isn't reachable, so answers come from the on-board rules."}{" "}
              When on, your question, the last six messages and this astronaut's
              simulated readings go to{" "}
              {aiStatus?.provider === "azure"
                ? "Azure OpenAI"
                : aiStatus?.provider === "openai"
                  ? "OpenAI"
                  : aiStatus?.provider === "anthropic"
                    ? "Anthropic (Claude)"
                    : "the configured AI provider"}
              . Names are left out.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
