import { prisma } from "../server/prisma.server";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useEffect } from "react";
import axios from "axios";
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
    workflows,
    workflowruns,
  });
};

export default function GetWorkflow() {
  const data = useLoaderData<typeof loader>();

  const groupByData = _.groupBy(data.workflowruns, "workflowId");

  return (
    <>
      <h3>List of workflows</h3>
      <button onClick={() => window.location.reload()}>refresh</button>
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
