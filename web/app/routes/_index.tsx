import { json, type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Octokit } from "@octokit/rest";

export const meta: MetaFunction = () => {
  return [
    { title: "Watch My CI" },
    { name: "description", content: "Get insights into CI workflows" },
  ];
};

export const loader = async () => {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  const user = await octokit.rest.users.getByUsername({ username: "vramana" });

  const runs = await octokit.rest.actions.listWorkflowRunsForRepo({
    owner: "vramana",
    repo: "watch-my-ci",
  });

  const workflows = await octokit.rest.actions.listRepoWorkflows({
    owner: "nodejs",
    repo: "node",
  });

  octokit
    .paginate(octokit.rest.actions.listWorkflowRunsForRepo, {
      owner: "vramana",
      repo: "watch-my-ci",
    })
    .then((issues) => {
      console.log("issues------>", issues);
      // issues is an array of all issue objects
    });

  const jobs = await octokit.rest.actions.listJobsForWorkflowRun({
    owner: "vramana",
    repo: "watch-my-ci",
    run_id: runs.data.workflow_runs[0].id,
  });

  return json({ user: user.data, runs: runs.data, workflows: workflows.data });
};

export default function Index() {
  const data = useLoaderData<typeof loader>();

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.8" }}>
      <h1>Watch My CI</h1>
      <p>{data.user.name}</p>
      <ul>
        {data.runs.workflow_runs.map((run) => (
          <li key={run.id}>
            {run.name} - {run.status} - {run.head_branch} - {run.workflow_id}
          </li>
        ))}
      </ul>
      <ul>
        {data.workflows.workflows.map((workflow) => (
          <li key={workflow.id}>
            {workflow.id} - {workflow.name} - {workflow.path}
          </li>
        ))}
      </ul>
    </div>
  );
}
