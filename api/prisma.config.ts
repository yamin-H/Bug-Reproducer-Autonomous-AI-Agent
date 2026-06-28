import dotenv from 'dotenv'
import { defineConfig } from "prisma/config";

dotenv.config();

// temporary debug — remove after fixing
console.log("DATABASE_URL starts with:", process.env["DATABASE_URL"]?.substring(0, 30));

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});