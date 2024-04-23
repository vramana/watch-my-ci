import { prisma } from "../server/prisma.server";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, type MetaFunction } from "@remix-run/node";
import { Form } from "@remix-run/react";
import { useLoaderData, useActionData } from "@remix-run/react";
import { Octokit } from "@octokit/rest";
import { useEffect } from "react";
import { useNavigation } from "@remix-run/react";
import dayjs from "dayjs";

export const meta: MetaFunction = () => {
  return [
    { title: "sync workflows" },
    { name: "description", content: "Sync" },
  ];
};

function run(a: { y: number }) {
  console.log(a.y);
}

export const action = async ({ request }: ActionFunctionArgs) => {
  console.log("hello0");

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

      const date = dayjs().subtract(3, "month").format("YYYY-MM-DD");
      const runs = await octokit.paginate(
        octokit.rest.actions.listWorkflowRunsForRepo,
        {
          owner: owner,
          repo: repo,
          created: ">=" + date,
        },
      );

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
              !existingRuns.some((w: any) => w.workflowId === run.workflow_id),
          )
          .map((r: any) => {
            const start = new Date(r.run_started_at);
            const end = new Date(r.updated_at);
            return {
              id: r.id,
              duration: (end.valueOf() - start.valueOf()) / 1000,
              success: r.conclusion === "success" ? true : false,
              repo: owner + "/" + repo,
              workflowId: r.workflow_id,
            };
          });

        const run = await prisma.workflowRun.createMany({
          data: newWorkflowRuns,
        });
        console.log("run", run);
        return newWorkflowRuns;
      };
      console.log("hello");
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

  return json({ owner: params.owner, repo: params.repo, workflows: workflows });
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
          return (
            <li key={w.id}>
              {w.name} - {w.path}
            </li>
          );
        })}
      </ul>
    </>
  );
}
