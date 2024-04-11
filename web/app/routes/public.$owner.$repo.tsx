import { prisma } from "../server/prisma.server";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, type MetaFunction } from "@remix-run/node";
import { Form } from "@remix-run/react";
import { useLoaderData, useActionData } from "@remix-run/react";
import { Octokit } from "@octokit/rest";
import { useEffect, useState } from "react";
import { useNavigation } from "@remix-run/react";

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

      await Promise.all(
        workflows.data.workflows.map(async (workflow) => {
          const existingWorkflow = await prisma.workflow.findFirst({
            where: {
              id: workflow.id,
            },
          });
          console.log("existingWorkflow", existingWorkflow);
          if (!existingWorkflow) {
            const newWorkflow = await prisma.workflow.create({
              data: {
                id: workflow.id,
                repo: owner + "/" + repo,
                name: workflow.name,
                path: workflow.path,
              },
            });
          }
        }),
      );
      return { message: "sync done" };
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