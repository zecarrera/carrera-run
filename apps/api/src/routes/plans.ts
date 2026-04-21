import { Router } from "express";
import {
  createActivitySchema,
  createPlanSchema,
  importPlanSchema,
  updateActivitySchema,
  updatePlanSchema,
} from "../schemas/plans.js";
import {
  addPlanActivity,
  createPlan,
  deletePlan,
  deletePlanActivity,
  getPlanById,
  importPlan,
  listPlans,
  updatePlan,
  updatePlanActivity,
} from "../services/planning.js";
import { autoCompletePlanActivities } from "../services/sync.js";

const plansRouter = Router();

// Per-user timestamp (ms) of the last auto-complete run. Kept in-memory so it
// resets on server restart — that's fine, it just triggers one extra run.
const lastAutoCompleteAt = new Map<string, number>();
const AUTO_COMPLETE_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes

plansRouter.use((request, response, next) => {
  const athleteId = request.session.strava?.athlete?.id;
  if (!athleteId) {
    response.status(401).json({ message: "Connect your Strava account first." });
    return;
  }

  request.planUserId = String(athleteId);
  next();
});

plansRouter.get("/", async (request, response, next) => {
  try {
    const userId = request.planUserId!;
    const tokens = request.session.strava?.tokens;
    const now = Date.now();
    const lastRun = lastAutoCompleteAt.get(userId) ?? 0;

    if (tokens && now - lastRun > AUTO_COMPLETE_THROTTLE_MS) {
      lastAutoCompleteAt.set(userId, now);
      await autoCompletePlanActivities(userId, tokens.access_token).catch((err: unknown) => {
        console.warn("[Plans] Auto-complete plan activities failed:", err);
      });
    }

    const plans = await listPlans(userId);
    response.json({ plans });
  } catch (error) {
    next(error);
  }
});

plansRouter.get("/:id", async (request, response, next) => {
  try {
    const plan = await getPlanById(request.planUserId!, request.params.id);
    if (!plan) {
      response.status(404).json({ message: "Plan not found." });
      return;
    }

    response.json({ plan });
  } catch (error) {
    next(error);
  }
});

plansRouter.post("/import", async (request, response, next) => {
  try {
    const body = importPlanSchema.parse(request.body);
    const plan = await importPlan({
      userId: request.planUserId!,
      ...body,
    });

    response.status(201).json({ plan });
  } catch (error) {
    next(error);
  }
});

plansRouter.post("/", async (request, response, next) => {
  try {
    const body = createPlanSchema.parse(request.body);
    const plan = await createPlan({
      userId: request.planUserId!,
      ...body,
    });

    response.status(201).json({ plan });
  } catch (error) {
    next(error);
  }
});

plansRouter.patch("/:id", async (request, response, next) => {
  try {
    const body = updatePlanSchema.parse(request.body);
    const plan = await updatePlan(request.planUserId!, request.params.id, body);

    if (!plan) {
      response.status(404).json({ message: "Plan not found." });
      return;
    }

    response.json({ plan });
  } catch (error) {
    next(error);
  }
});

plansRouter.post("/:id/activities", async (request, response, next) => {
  try {
    const body = createActivitySchema.parse(request.body);
    const plan = await addPlanActivity(request.planUserId!, request.params.id, body);

    if (!plan) {
      response.status(404).json({ message: "Plan not found." });
      return;
    }

    response.status(201).json({ plan });
  } catch (error) {
    next(error);
  }
});

plansRouter.patch("/:id/activities/:activityId", async (request, response, next) => {
  try {
    const body = updateActivitySchema.parse(request.body);
    const plan = await updatePlanActivity(request.planUserId!, request.params.id, request.params.activityId, body);

    if (!plan) {
      response.status(404).json({ message: "Plan or activity not found." });
      return;
    }

    response.json({ plan });
  } catch (error) {
    next(error);
  }
});

plansRouter.delete("/:id", async (request, response, next) => {
  try {
    const deleted = await deletePlan(request.planUserId!, request.params.id);

    if (!deleted) {
      response.status(404).json({ message: "Plan not found." });
      return;
    }

    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

plansRouter.delete("/:id/activities/:activityId", async (request, response, next) => {
  try {
    const plan = await deletePlanActivity(request.planUserId!, request.params.id, request.params.activityId);

    if (!plan) {
      response.status(404).json({ message: "Plan not found." });
      return;
    }

    response.json({ plan });
  } catch (error) {
    next(error);
  }
});

export { plansRouter };
