import { Application, Router, Status } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { SERVER_PORT } from "./config.ts";
import { analyzeImageWithGPT } from "./services/imageAnalysis.ts";
import { searchCooperHewittAPI } from "./services/cooperHewitt.ts";
import type { AnalyzeResponse } from "./types.ts";

const app = new Application();
const router = new Router();
const isProduction = Deno.env.get("DENO_ENV") === "production";

app.use(async (context, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  context.response.headers.set("X-Response-Time", `${ms}ms`);
  console.log(`${context.request.method} ${context.request.url.pathname} ${ms}ms`);
});

router.post("/api/analyze", async (context) => {
  try {
    if (!context.request.hasBody) {
      context.throw(Status.BadRequest, "Request body is required.");
    }

    const body = context.request.body({ type: "json" });
    const payload = await body.value;
    const image = payload?.image;

    if (typeof image !== "string" || image.length === 0) {
      context.throw(Status.BadRequest, "Field 'image' is required.");
    }

    const analysis = await analyzeImageWithGPT(image);
    const galleryItems = await searchCooperHewittAPI(analysis);

    const responseBody: AnalyzeResponse = {
      analysis,
      galleryItems,
    };

    context.response.body = responseBody;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    context.response.status = Status.InternalServerError;
    context.response.body = { error: message };
    console.error("/api/analyze failed", error);
  }
});

app.use(router.routes());
app.use(router.allowedMethods());

if (isProduction) {
  app.use(async (context, next) => {
    try {
      await context.send({
        root: `${Deno.cwd()}/frontend/dist`,
        index: "index.html",
      });
    } catch {
      await next();
    }
  });
}

const abortController = new AbortController();
let isShuttingDown = false;

const shutdown = () => {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  abortController.abort();
};

const shutdownSignals: Deno.Signal[] = ["SIGINT", "SIGTERM"];
for (const signal of shutdownSignals) {
  Deno.addSignalListener(signal, shutdown);
}

console.log(`Server running on http://localhost:${SERVER_PORT}`);
try {
  await app.listen({ port: SERVER_PORT, signal: abortController.signal });
} finally {
  for (const signal of shutdownSignals) {
    Deno.removeSignalListener(signal, shutdown);
  }
}
