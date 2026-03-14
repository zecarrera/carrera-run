import { Router } from "express";
import {
  createActivitySchema,
  createPlanSchema,
  updateActivitySchema,
  updatePlanSchema,
} from "../schemas/plans.js";
import {
  addPlanActivity,
  createPlan,
  deletePlanActivity,
  getPlanById,
  listPlans,
  updatePlan,
  updatePlanActivity,
} from "../services/planning.js";

const plansRouter = Router();

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
    const plans = await listPlans(request.planUserId!);
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
