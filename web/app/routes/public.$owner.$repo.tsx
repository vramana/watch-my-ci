import { prisma } from "../server/prisma.server";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, type MetaFunction } from "@remix-run/node";
import { Form } from "@remix-run/react";
import { useLoaderData, useActionData } from "@remix-run/react";
import { Octokit } from "@octokit/rest";
import { useEffect } from "react";
import { useNavigation } from "@remix-run/react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import _ from "lodash";
import dayjs from "dayjs";

export const meta: MetaFunction = () => {
  return [
    { title: "sync workflows" },
    { name: "description", content: "Sync" },
  ];
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const body = await request.formData();
  const repo = body.get("repo");
  const owner = body.get("owner");
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  try {
    if (typeof repo === "string" && typeof owner === "string") {
      const workflows = await octokit.rest.actions.listRepoWorkflows({
        owner: owner,
        repo: repo,
      });

      type Workflows = typeof workflows;

      const syncWorkflows = async ({
        owner,
        repo,
        workflows,
      }: {
        owner: string;
        repo: string;
        workflows: Workflows;
      }) => {
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
        return newWorkflows;
      };

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

      console.log("runs", runs.length);
      type Runs = typeof runs;

      const syncRuns = async ({
        owner,
        repo,
        runs,
      }: {
        owner: string;
        repo: string;
        runs: Runs;
      }) => {
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

        const run = await prisma.workflowRun.createMany({
          data: newWorkflowRuns,
        });
        return newWorkflowRuns;
      };
      const newWorkflows = await syncWorkflows({ owner, repo, workflows });
      const newRuns = await syncRuns({ owner, repo, runs });
      return {
        message: `${newWorkflows.length} workflow/workflows synced and ${newRuns.length} workflowrun/workflowruns synced`,
      };
    } else {
      return { message: "Invalid owner or repo provided." };
    }
  } catch (err: any) {
    return { message: err.message };
  }
};

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const workflows = await prisma.workflow.findMany({
    where: {
      repo: params.owner + "/" + params.repo,
    },
  });

  let workflowruns = await prisma.workflowRun.findMany({
    where: {
      repo: params.owner + "/" + params.repo,
    },
    orderBy: {
      startedAt: "asc",
    },
  });
  workflowruns = workflowruns.map((run: any) => {
    return { ...run, id: Number(run.id) };
  });

  return json({
    owner: params.owner,
    repo: params.repo,
    workflows: workflows,
    workflowruns,
  });
};

export default function GetWorkflow() {
  const data = useLoaderData<typeof loader>();
  const sucess = useActionData<typeof action>();
  const { state } = useNavigation();
  useEffect(() => {
    if (sucess && state === "loading") {
      alert(sucess.message);
    }
  }, [state]);

  const groupByData = _.groupBy(data.workflowruns, "workflowId");

  return (
    <>
      <h3>List of workflows</h3>
      <Form method="post">
        <input type="hidden" name="repo" value={data.repo} />
        <input type="hidden" name="owner" value={data.owner} />

        <button disabled={state === "submitting"} type="submit">
          {state === "submitting" ? "Syncing Data" : "Sync Data"}
        </button>
      </Form>
      <ul>
        {data.workflows.map((w) => {
          const id = w.id;
          const chartData = groupByData[id]?.map((d: any) => {
            return {
              name: dayjs(d.startedAt).format("DD/MM/YYYY"),
              duration: d.duration,
            };
          });
          return (
            <li key={w.id}>
              <h3>
                {w.name} - {w.path}
              </h3>
              <LineChart width={1000} height={500} data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="duration"
                  stroke="#8884d8"
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </li>
          );
        })}
      </ul>
    </>
  );
}
