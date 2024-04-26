import { publicProcedure, router } from './trpc';
import { PrismaClient } from '@prisma/client'
import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import dotenv from "dotenv"
import { z } from 'zod';
import { Octokit } from "@octokit/rest";
import _ from "lodash";
import dayjs from "dayjs";


dotenv.config()

import PgBoss from 'pg-boss';

const boss = new PgBoss(process.env.DATABASE_URL!);
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });


boss.on('error', error => console.error(error));

await boss.start();

const workflowQueue = 'workflowQueue';
const workflowRunQueue = "workflowRunQueue"
const syncWorkflowsHandler = async (job:any) => {
  const  owner =job.data.owner;
  const repo= job.data.repo;
  const workflows = await octokit.rest.actions.listRepoWorkflows({
   owner,
   repo
  });
  const existingWorkflows = await prisma.workflow.findMany({
    where: {
      repo: owner + "/" + repo,
    },
  });

  const newWorkflows = workflows.data.workflows
    .filter(
      (workflow) => !existingWorkflows.some((w) => w.id === workflow.id),
    )
    .map((w) => {
      return {
        id: w.id,
        repo: owner + "/" + repo,
        name: w.name,
        path: w.path,
      };
    });
  await prisma.workflow.createMany({
    data: newWorkflows,
  });
  const isRepoAvailable = await prisma.repo.findMany({
    where:{
      repo: owner + "/" + repo
    }
  })
  if (isRepoAvailable.length === 0) {
    console.log("creating")
   
    await prisma.repo.create({
      data:{
        repo: owner + "/" + repo,
        workflowsSyncDate: dayjs().toISOString()
      }
    })
  } else {
    console.log("updating")
    await prisma.repo.update({
      where: {
        repo: owner + "/" + repo,
      },
      data: {
        workflowsSyncDate: dayjs().toISOString()

      },
    })
  }
  return newWorkflows;
  }
const syncWorkflowRunsHandler = async (job:any) => {
  const  owner =job.data.owner;
  const repo= job.data.repo;
  const iterator = octokit.paginate.iterator(
    octokit.rest.actions.listWorkflowRunsForRepo,
    {
      owner: owner,
      repo: repo,
      per_page: 100,
    },
  );
  let runs = [];
  for await (const res of iterator) {
    let data = Object.values(res.data);
    data = data.filter(
      (run) =>
        dayjs(run.run_started_at).isAfter(dayjs().subtract(3, "day")) &&
        typeof run === "object",
    );
    console.log("data", data.length);
    if (data.length === 0) {
      break;
    }
    runs.push(...data);
  }
  const existingRuns = await prisma.workflowRun.findMany({
    where: {
      repo: owner + "/" + repo,
    },
  });

  const newWorkflowRuns = runs
    .filter(
      (run) =>
        !existingRuns.some((w: any) => Number(w.id) === Number(run.id)),
    )
    .map((r: any) => {
      const start = new Date(r.run_started_at);
      const end = new Date(r.updated_at);
      return {
        id: r.id,
        duration: (end.valueOf() - start.valueOf()) / 1000,
        startedAt: r.run_started_at,
        success: r.conclusion === "success" ? true : false,
        repo: owner + "/" + repo,
        workflowId: r.workflow_id,
      };
    });
    console.log("newWorkflowRuns", newWorkflowRuns)

  const run = await prisma.workflowRun.createMany({
    data: newWorkflowRuns,
  });
  const isRepoAvailable = await prisma.repo.findMany({
    where:{
      repo: owner + "/" + repo
    }
  })
  if (isRepoAvailable.length === 0) {
    console.log("creating")
   
    await prisma.repo.create({
      data:{
        repo: owner + "/" + repo,
        runsSyncDate: dayjs().toISOString()
      }
    })
  } else {
    console.log("updating")
    await prisma.repo.update({
      where: {
        repo: owner + "/" + repo,
      },
      data: {
        runsSyncDate: dayjs().toISOString()

      },
    })
  }
  return newWorkflowRuns;

}

await boss.work(workflowQueue, syncWorkflowsHandler);
await boss.work(workflowRunQueue, syncWorkflowRunsHandler);



 const prisma = new PrismaClient()

const appRouter = router({
  workflowsCreate: publicProcedure.input(
    z.object({
      owner: z.string(),
      repo: z.string()
    }),
  ).mutation(async(opts) => {
    const {input} = opts
    let jobId = await boss.send(workflowQueue, { owner: input.owner, repo: input.repo })
    return jobId
  }),
  workflowrunsCreate: publicProcedure.input(
    z.object({
      owner: z.string(),
      repo: z.string()
    }),
  ).mutation(async(opts) => {
    const {input} = opts
    let jobId = await boss.send(workflowRunQueue, { owner: input.owner, repo: input.repo })
    return jobId
  })
});

export type AppRouter = typeof appRouter;   


createHTTPServer({
    router: appRouter,
    createContext() {
      console.log('context 3');
      return {};
    },
  }).listen(3000);



