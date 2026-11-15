import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import rateLimit from "@fastify/rate-limit";
import { z } from "zod";
import { randomUUID, timingSafeEqual, createHash } from "node:crypto";
import { resolve } from "node:path";
import { Store } from "./store.ts";
import { responseContracts } from "./responses.ts";
import { loadDataset, historyFor } from "./data.ts";
import {
  Selection,
  Ask,
  Checkin,
  ReportDraft,
  QueueReport,
  Medication,
  MedicationDay,
  Adherence,
  TestResult,
  WhatIf,
  UNITS,
  MeasurementReview,
  MeasurementBatch,
} from "./contracts.ts";
import { assessCrew, readiness } from "../../src/engine/assessment.ts";
import { answer, assistantStatus } from "./assistant.ts";
import { evidence, evidenceBundle, protocols } from "./evidence.ts";
import { radiationCache, fetchRadiation } from "./radiation.ts";
import { fhirBundle } from "../../src/shared/fhir.ts";
import type { MissionProfile, Reading } from "../../src/engine/types.ts";
import type { ModelOptions } from "./model-config.ts";
export type Options = ModelOptions & {
  dbPath?: string;
  apiToken?: string;
  now?: () => number;
  datasetPath?: string;
};
const PROFILES = {
  iss: { oneWaySeconds: 0, label: "ISS" },
  moon: { oneWaySeconds: 1.3, label: "Moon surface" },
  mars_transit: { oneWaySeconds: 1200, label: "Mars transit" },
};
export async function makeServer(options: Options = {}) {
  const app = Fastify({
    logger: false,
    bodyLimit: 65536,
    requestIdHeader: false,
  });
  const now = options.now ?? Date.now;
  const store = new Store(options.dbPath ?? resolve("backend/var/halo.sqlite"));
  const { data, sha256 } = loadDataset(options.datasetPath);
  await app.register(cors, {
    origin: (process.env.HALO_ALLOWED_ORIGINS ?? "http://localhost:5173").split(
      ",",
    ),
  });
  await app.register(rateLimit, { max: 180, timeWindow: "1 minute" });
  await app.register(swagger, {
    openapi: {
      info: { title: "HALO demonstration backend", version: "1.0.0" },
      components: {
        securitySchemes: { bearer: { type: "http", scheme: "bearer" } },
      },
    },
  });
  await app.register(swaggerUI, { routePrefix: "/docs" });
  // Route handler validation is performed with the same Zod schemas documented below.
  app.setValidatorCompiler(() => (value) => ({ value }));
  app.addHook("onRequest", async (req, reply) => {
    if (!options.apiToken || !req.url.startsWith("/api/")) return;
    const token = req.headers.authorization?.replace(/^Bearer /, "") ?? "";
    const a = createHash("sha256").update(token).digest(),
      b = createHash("sha256").update(options.apiToken).digest();
    if (!timingSafeEqual(a, b))
      return reply.code(401).send({
        error: {
          code: "UNAUTHORIZED",
          message: "Valid bearer token required",
          requestId: req.id,
        },
      });
  });
  app.addHook("onSend", async (req, reply, payload) => {
    reply
      .header("Cache-Control", "no-store")
      .header("X-Request-ID", req.id)
      .header("X-Content-Type-Options", "nosniff");
    return payload;
  });
  app.setErrorHandler((err: any, req, reply) => {
    const status = err instanceof z.ZodError ? 422 : (err.statusCode ?? 500);
    reply.code(status).send({
      error: {
        code:
          status === 422
            ? "INVALID_INPUT"
            : status >= 500
              ? "SERVICE_ERROR"
              : "REQUEST_ERROR",
        message:
          status >= 500
            ? "The service could not complete this operation"
            : status === 422
              ? "Input does not match the documented contract"
              : "Request could not be accepted",
        issues:
          err instanceof z.ZodError
            ? err.issues.map((i) => ({ path: i.path, code: i.code }))
            : undefined,
        requestId: req.id,
      },
    });
  });
  app.addHook("onResponse", async (req, reply) => {
    store.put("audit", randomUUID(), "system", {
      requestId: req.id,
      method: req.method,
      route: req.routeOptions.url ?? "not_found",
      status: reply.statusCode,
      at: new Date(now()).toISOString(),
    });
    store.db.exec(
      "DELETE FROM documents WHERE kind='audit' AND rowid NOT IN (SELECT rowid FROM documents WHERE kind='audit' ORDER BY rowid DESC LIMIT 1000)",
    );
  });
  app.addHook("onClose", async () => store.close());
  function route(
    method: "GET" | "POST",
    url: string,
    schema: z.ZodType | undefined,
    handler: (input: any, req: any, reply: any) => any,
  ) {
    const part = method === "GET" ? "querystring" : "body";
    app.route({
      method,
      url,
      ...(url === "/api/assistant"
        ? { config: { rateLimit: { max: 12, timeWindow: "1 minute" } } }
        : {}),
      schema: {
        description:
          "Research prototype. Demo parameters; no clinical validation.",
        security: [{ bearer: [] }],
        ...(schema ? { [part]: z.toJSONSchema(schema, { io: "input" }) } : {}),
        ...(responseContracts[url]
          ? { response: { 200: z.toJSONSchema(responseContracts[url]) } }
          : {}),
      },
      handler: async (req, reply) => {
        const result = await handler(
          schema
            ? schema.parse(method === "GET" ? req.query : req.body)
            : undefined,
          req,
          reply,
        );
        return reply.sent
          ? result
          : responseContracts[url]
            ? responseContracts[url].parse(result)
            : result;
      },
    });
  }
  const read = (s: any) => historyFor(data, store, s.crewId);
  const context = (s: any) => {
    const history = read(s);
    return {
      selection: s,
      crew: data.crew.find((c) => c.id === s.crewId),
      reading: history.find((r) => r.day === s.day),
      assessment: assessCrew(history, s.day, s.profile, {
        ...store.get("checkin", `${s.crewId}:${s.day}`),
        vision_score: store.get("test", `${s.crewId}:${s.day}:vision`)?.average,
        sourceProfile: data.meta.mission_profile,
      }),
      readiness: readiness(history, s.day, s.profile, {
        ...store.get("checkin", `${s.crewId}:${s.day}`),
        vision_score: store.get("test", `${s.crewId}:${s.day}:vision`)?.average,
        sourceProfile: data.meta.mission_profile,
      }),
      checkin: store.get("checkin", `${s.crewId}:${s.day}`),
      provenance: {
        kind: "simulated",
        datasetSha256: sha256,
        source: "data/crew_sim.json",
        timeBasis: "mission_day",
      },
      mission: PROFILES[s.profile as MissionProfile],
    };
  };
  app.get("/health", () => ({
    status: "ok",
    version: "1.0.0",
    prototype: true,
    externalServicesRequired: false,
  }));
  app.get("/openapi.json", () => app.swagger());
  route("GET", "/api/crew", undefined, () => ({
    crew: data.crew,
    days: 120,
    readings: 360,
    simulated: true,
    datasetSha256: sha256,
  }));
  route("GET", "/api/missions", undefined, () => ({
    profiles: PROFILES,
    notice:
      "Delay is scenario configuration, not ephemeris prediction. Mars-simulated dose is not transformed by selecting another profile.",
  }));
  route("GET", "/api/signals", undefined, () => ({
    units: UNITS,
    notice:
      "No clinical reference ranges or medically validated thresholds are implied.",
  }));
  route("GET", "/api/snapshot", Selection, (s) => context(s));
  route("GET", "/api/history", Selection, (s) => ({
    readings: read(s).filter((r) => r.day <= s.day),
    provenance: "simulated",
    baselineKind: "inflight_adaptation_days_7_20",
  }));
  route("POST", "/api/checkins", Checkin, (s) => {
    store.put("checkin", `${s.crewId}:${s.day}`, s.crewId, {
      ...s,
      provenance: "user_entered_demo",
      recordedAt: new Date(now()).toISOString(),
    });
    return context({ ...s, profile: "mars_transit" });
  });
  route("GET", "/api/checkins", Selection, (s) =>
    store.list("checkin", s.crewId).filter((l) => l.day <= s.day),
  );
  // Instruments: readings from straps, file imports or manual entry, stored per astronaut and day
  route("POST", "/api/measurements", MeasurementBatch, (s, _req, reply) => {
    const wrong = s.measurements.find((m: any) => m.unit !== UNITS[m.signal]);
    if (wrong)
      return reply.code(422).send({
        error: {
          code: "INVALID_INPUT",
          message: `Unit for ${wrong.signal} must be ${UNITS[wrong.signal]}`,
        },
      });
    if (!data.crew.some((c) => c.id === s.crewId))
      return reply
        .code(404)
        .send({ error: { code: "NOT_FOUND", message: "Unknown astronaut" } });
    const recordedAt = new Date(now()).toISOString();
    for (const m of s.measurements)
      store.put(
        "measurement",
        `${s.crewId}:${m.missionDay ?? "none"}:${m.signal}:${m.sourceId}`,
        s.crewId,
        { ...m, crewId: s.crewId, recordedAt },
      );
    return { stored: s.measurements.length };
  });
  route("GET", "/api/measurements", Selection, (s) =>
    store
      .list("measurement", s.crewId)
      .filter((m) => (m.missionDay ?? 0) <= s.day),
  );
  // FHIR R4 export: the day's readings as Observations (LOINC codes, UCUM units)
  route("GET", "/api/fhir/Observation", Selection, (s) =>
    fhirBundle(
      data.crew.find((c) => c.id === s.crewId)?.name ?? s.crewId,
      s.crewId,
      s.day,
      store.list("measurement", s.crewId).filter((m) => m.missionDay === s.day),
      data.readings.find((r) => r.crew_id === s.crewId && r.day === s.day),
      UNITS,
    ),
  );
  route("GET", "/api/risks", Selection, (s) => context(s).assessment);
  route("GET", "/api/readiness", Selection, (s) => context(s).readiness);
  route("GET", "/api/crew-overview", Selection.omit({ crewId: true }), (s) => ({
    crew: data.crew
      .map((c) => ({ crewId: c.id, ...context({ ...s, crewId: c.id }) }))
      .sort(
        (a, b) =>
          (b.assessment.priority?.level === "Act"
            ? 2
            : b.assessment.priority
              ? 1
              : 0) -
          (a.assessment.priority?.level === "Act"
            ? 2
            : a.assessment.priority
              ? 1
              : 0),
      ),
    notice: "Demo prioritization, not validated clinical triage.",
  }));
  route(
    "GET",
    "/api/evidence",
    z.object({ q: z.string().max(300).optional() }),
    (s) =>
      evidence.filter(
        (e: any) =>
          !s.q || JSON.stringify(e).toLowerCase().includes(s.q.toLowerCase()),
      ),
  );
  route("GET", "/api/offline-bundle", undefined, () => ({
    ...evidenceBundle(),
    protocols,
    ruleVersion: "halo-demo-2.0",
  }));
  route("GET", "/api/protocols", undefined, () => protocols);
  route("GET", "/api/audit", undefined, () => store.list("audit").slice(-100));
  route("GET", "/api/assistant/status", undefined, () =>
    assistantStatus(options),
  );
  route("POST", "/api/assistant", Ask, async (s) => {
    const c = context(s);
    return answer(
      {
        ...s,
        symptoms: Array.from(
          new Set([...(c.checkin?.symptoms ?? []), ...s.symptoms]),
        ),
      },
      c.assessment,
      options,
      c.reading,
    );
  });
  route("POST", "/api/reports/draft", ReportDraft, (s) => {
    const c = context(s);
    const id = randomUUID();
    return store.put("report", id, s.crewId, {
      id,
      crewId: s.crewId,
      createdAt: new Date(now()).toISOString(),
      status: "draft",
      approved: false,
      transmitted: false,
      purpose: s.purpose,
      snapshot: c,
      summary:
        c.assessment.priority?.name ?? "No active demo pattern established",
      limitations:
        "Review all inputs and uncertainty before approving simulated delivery.",
    });
  });
  route("POST", "/api/reports/queue", QueueReport, (s, req, reply) => {
    const report = store.get("report", s.reportId);
    if (!report)
      return reply
        .code(404)
        .send({ error: { code: "NOT_FOUND", message: "Unknown report" } });
    const existing = store.get("outbox", s.idempotencyKey);
    if (existing) {
      if (existing.requestFingerprint !== JSON.stringify(s))
        return reply.code(409).send({
          error: {
            code: "IDEMPOTENCY_CONFLICT",
            message: "Key already used for another request",
          },
        });
      return existing;
    }
    const sendAt = Math.max(
      now(),
      s.windowOpensAt ? Date.parse(s.windowOpensAt) : now(),
    );
    return store.put("outbox", s.idempotencyKey, report.crewId, {
      id: s.idempotencyKey,
      reportId: s.reportId,
      crewId: report.crewId,
      approved: true,
      requestFingerprint: JSON.stringify(s),
      queuedAt: new Date(now()).toISOString(),
      sendAt: new Date(sendAt).toISOString(),
      arrivalAt: new Date(sendAt + s.delaySeconds * 1000).toISOString(),
      earliestReplyAt: new Date(sendAt + s.delaySeconds * 2000).toISOString(),
      transmitted: false,
      transport: "simulation_only",
    });
  });
  route("GET", "/api/reports", Selection, (s) =>
    store.list("report", s.crewId),
  );
  route("GET", "/api/outbox", Selection, (s) =>
    store.list("outbox", s.crewId).map(({ requestFingerprint, ...q }) => ({
      ...q,
      status:
        now() >= Date.parse(q.arrivalAt)
          ? "delivered_simulated"
          : now() >= Date.parse(q.sendAt)
            ? "in_transit_simulated"
            : "queued_simulated",
    })),
  );
  route("POST", "/api/medications", Medication, (s) =>
    store.put("medication", `${s.crewId}:${s.id}`, s.crewId, s),
  );

  route("POST", "/api/medication-day", MedicationDay, (s) =>
    store.put("medication_day", `${s.crewId}:${s.day}`, s.crewId, {
      ...s,
      provenance: "user_entered_demo",
      transmitted: false,
    }),
  );
  route(
    "GET",
    "/api/medication-day",
    Selection,
    (s) =>
      store.get("medication_day", `${s.crewId}:${s.day}`) ?? {
        crewId: s.crewId,
        day: s.day,
        state: { taken: {}, skipped: {}, extra: [], notes: [] },
        transmitted: false,
      },
  );
  route("POST", "/api/adherence", Adherence, (s, req, reply) => {
    if (!store.get("medication", `${s.crewId}:${s.medicationId}`))
      return reply
        .code(404)
        .send({ error: { code: "NOT_FOUND", message: "Unknown medication" } });
    return store.put(
      "adherence",
      `${s.crewId}:${s.medicationId}:${s.day}`,
      s.crewId,
      s,
    );
  });
  route("GET", "/api/medications", Selection, (s) => ({
    items: store.list("medication", s.crewId).map((m) => ({
      ...m,
      expired: Date.parse(m.expiresAt) <= now(),
      adherence: store
        .list("adherence", s.crewId)
        .filter((a) => a.medicationId === m.id),
      potency: null,
      potencyStatus:
        "No validated product-specific model; laboratory confirmation required",
    })),
    notice:
      "Schedule references are entered by a human; HALO does not prescribe or verify clinician approval.",
  }));
  route("POST", "/api/tests", TestResult, (s) => {
    const average =
      s.values.reduce((a: number, b: number) => a + b, 0) / s.values.length;
    if (
      s.type === "reaction" &&
      s.values.some((n: number) => n < 100 || n > 60000)
    )
      throw Object.assign(new Error("Invalid reaction duration"), {
        statusCode: 422,
      });
    if (s.type !== "reaction" && s.values.some((n: number) => n < 0 || n > 100))
      throw Object.assign(new Error("Invalid test scale"), { statusCode: 422 });
    return store.put("test", `${s.crewId}:${s.day}:${s.type}`, s.crewId, {
      ...s,
      average,
      validated: false,
      notice: "Task-specific demo result, not a cognitive or vision diagnosis.",
    });
  });
  route("GET", "/api/tests", Selection, (s) =>
    store.list("test", s.crewId).filter((t) => t.day <= s.day),
  );
  route("POST", "/api/what-if", WhatIf, (s) => {
    const current = read(s).filter((r) => r.day <= s.day);
    const last = current.at(-1)!;
    const projected = Array.from({ length: s.horizon }, (_, i) => ({
      ...last,
      ...s.changes,
      day: s.day + i + 1,
      events: ["what_if_simulation"],
    })) as Reading[];
    return {
      baseline: context(s).assessment,
      scenario: assessCrew(
        [...current, ...projected],
        s.day + s.horizon,
        s.profile,
      ),
      assumptions:
        "Holds the latest values constant except explicit changes. No physiological forecasting, causal model or clinical validation.",
      projectedDays: projected,
    };
  });
  route("GET", "/api/radiation", undefined, () =>
    radiationCache(store.get("radiation", "latest") ?? undefined, now()),
  );
  route(
    "POST",
    "/api/radiation/refresh",
    z
      .object({
        start: z.iso.datetime(),
        end: z.iso.datetime(),
        instrument: z
          .string()
          .regex(/^[\w-]{1,80}$/)
          .default("DosTel1"),
      })
      .strict(),
    async (s, req, reply) => {
      try {
        const snapshot = await fetchRadiation(s.start, s.end, s.instrument);
        store.put("radiation", "latest", "public", snapshot);
        return radiationCache(snapshot, now());
      } catch {
        return reply.code(502).send({
          error: {
            code: "UPSTREAM_UNAVAILABLE",
            message: "NASA query failed; previous cache preserved",
          },
        });
      }
    },
  );
  route(
    "POST",
    "/api/measurements/review",
    MeasurementReview,
    (s, req, reply) => {
      const seen = new Set();
      return {
        interpretation:
          "Data quality only; no clinical normality or diagnosis.",
        signals: s.measurements.map((m: any) => {
          if (
            seen.has(m.signal) ||
            (m.signal === "bone_resorption_index" &&
              m.provenance !== "simulated") ||
            m.unit !== UNITS[m.signal] ||
            (m.provenance === "simulated"
              ? !m.missionDay || m.observedAt
              : !m.observedAt)
          )
            throw Object.assign(new Error("Invalid measurement semantics"), {
              statusCode: 422,
            });
          seen.add(m.signal);
          const age = m.observedAt
            ? (now() - Date.parse(m.observedAt)) / 1000
            : null;
          return {
            signal: m.signal,
            state:
              m.value === null
                ? "missing"
                : m.quality !== "valid"
                  ? m.quality
                  : m.provenance === "simulated"
                    ? "simulated"
                    : age! < 0
                      ? "future"
                      : s.maxAgeSeconds === undefined
                        ? "freshness_not_assessed"
                        : age! > s.maxAgeSeconds
                          ? "stale"
                          : "fresh",
            ageSeconds: age,
            provenance: m.provenance,
          };
        }),
      };
    },
  );
  await app.ready();
  return app;
}
