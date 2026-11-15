import { DurableObject } from "cloudflare:workers";
import { handle, Limiter } from "./logic.ts";

/** One global counter for the whole service: rate limits and the total-spend cap live here */
export class Budget extends DurableObject {
  private limiter = new Limiter({
    get: (k) => this.ctx.storage.get(k) as Promise<any>,
    put: (e) => this.ctx.storage.put(e),
  });
  take(ip: string, now: number) {
    return this.limiter.take(ip, now);
  }
  done(now: number) {
    return this.limiter.done(now);
  }
}

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const stub = env.BUDGET.get(env.BUDGET.idFromName("global"));
    return handle(request, {
      ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
      limiter: {
        take: (ip, now) => stub.take(ip, now),
        done: (now) => stub.done(now),
      },
    });
  },
};
