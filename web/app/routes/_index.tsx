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
    <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.8" }}>
      <h1>Watch My CI</h1>

      <Form action={`/public/${repo}`}>
        <input
          type="text"
          placeholder="Repo"
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
        />
        <p>Example: nodejs/nodejs</p>
        <button type="submit">Go</button>
      </Form>
    </div>
  );
}
