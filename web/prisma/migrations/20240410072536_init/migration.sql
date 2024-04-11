-- CreateTable
CREATE TABLE "Workflow" (
    "id" SERIAL NOT NULL,
    "repo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,

    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Workflow_repo_key" ON "Workflow"("repo");
