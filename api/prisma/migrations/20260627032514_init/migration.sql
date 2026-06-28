-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "issueUrl" TEXT NOT NULL,
    "repoUrl" TEXT,
    "issueTitle" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "testCode" TEXT,
    "fixCode" TEXT,
    "fixedFilePath" TEXT,
    "prUrl" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);
