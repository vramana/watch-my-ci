import { prisma } from "../server/prisma.server";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useEffect, useState } from "react";
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
  const repoData = await prisma.repo.findFirst({
    where: {
      repo: params.owner + "/" + params.repo,
    },
  });
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
    repoData,
  });
};

export default function GetWorkflow() {
  const data = useLoaderData<typeof loader>();
  const [id, setId] = useState("");

  const groupByData = _.groupBy(data.workflowruns, "workflowId");
  const chartData = groupByData[id]?.map((d: any) => {
    return {
      name: dayjs(d.startedAt).format("DD/MM/YYYY"),
      duration: d.duration,
    };
  });

  useEffect(() => {
    const fetchData = async () => {
      if (
        !data.repoData?.workflowsSyncDate ||
        dayjs().isSame(dayjs(data.repoData?.workflowsSyncDate))
      ) {
        await axios.post("http://localhost:3000/workflowsCreate", {
          owner: data.owner,
          repo: data.repo,
        });
      }
      if (
        !data.repoData?.runsSyncDate ||
        dayjs().isSame(dayjs(data.repoData?.runsSyncDate))
      ) {
        await axios.post("http://localhost:3000/workflowrunsCreate", {
          owner: data.owner,
          repo: data.repo,
        });
      }
      setId(data.workflows[0]?.id);
    };

    fetchData();
  }, []);

  return (
    <div className="pt-10">
      {/* <button onClick={() => window.location.reload()}>refresh</button> */}

      <div className="flex flex-row">
        <div className="basis-1/2 overflow-y-auto h-[80vh]">
          <table className="w-full text-sm text-left rtl:text-right text-gray-900    ">
            <thead className="text-xs text-gray-100 uppercase bg-gray-800">
              <tr>
                <th scope="col" className="px-6 py-3">
                  Workflows
                </th>
                <th scope="col" className="px-6 py-3">
                  Avg. Time
                </th>
                <th scope="col" className="px-6 py-3">
                  Show Graph
                </th>
              </tr>
            </thead>
            <tbody>
              {data.workflows.map((w) => {
                return (
                  <tr key={w.id} className="bg-white border-b-2 ">
                    <td className="px-6 py-4">{w.name}</td>
                    <td className="px-6 py-4 "></td>
                    <td className="px-6 py-4 ">
                      <button onClick={() => setId(w.id)}>show</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="basis-1/2 mr-4">
          <h4 className="text-center text-3xl font-bold my-6">
            {data.workflows.find((w) => w.id === id)?.name || ""}
          </h4>
          <LineChart width={700} height={550} data={chartData}>
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
        </div>
      </div>
    </div>
  );
}
