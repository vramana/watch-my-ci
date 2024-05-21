import { json, type MetaFunction } from "@remix-run/node";
import { Form } from "@remix-run/react";
import { useState } from "react";

export const meta: MetaFunction = () => {
  return [
    { title: "Watch My CI" },
    { name: "description", content: "Get insights into CI workflows" },
  ];
};

export default function Index() {
  const [repo, setRepo] = useState("");

  return (
    <div className="text-center py-10">
      <h4 className="text-gray-900 py-6 font-black text-5xl">
        Enter your GIT repo to watch and track CI
      </h4>
      <Form action={`/public/${repo}`}>
        <input
          type="text"
          placeholder="fastify/fastify"
          className="p-2 rounded-md"
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
        />
        <button
          className="mx-4 text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2"
          type="submit"
        >
          Go
        </button>
      </Form>
    </div>
  );
}
