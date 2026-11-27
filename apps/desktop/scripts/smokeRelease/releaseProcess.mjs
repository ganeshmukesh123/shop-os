// Start, watch and stop a packaged binary for smoke-release.mjs. Each start gets a throwaway data
// folder (SHOPOS_USER_DATA), so a smoke run never touches the shop's real database.
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { setTimeout as pause } from "node:timers/promises";
import { DESKTOP_FOLDER } from "../packagedApp/packagedApp.mjs";

const POLL_EVERY_MILLISECONDS = 250;

/** Polls until isDone() is true or the time runs out; returns the last answer. */
export async function waitUntil(isDone, timeoutMilliseconds) {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    const isFinished = await isDone();
    if (isFinished) {
      return true;
    }
    await pause(POLL_EVERY_MILLISECONDS);
  }
  return isDone();
}

export function startBinary(executable, commandArguments, extraEnvironment = {}) {
  const dataFolder = fs.mkdtempSync(path.join(os.tmpdir(), "shopos-smoke-"));
  const environment = { ...process.env, SHOPOS_USER_DATA: dataFolder, ...extraEnvironment };
  const child = spawn(executable, commandArguments, { env: environment });
  const started = { child, dataFolder, outputText: "", exitCode: undefined };
  const appendOutput = (chunk) => {
    started.outputText += chunk;
  };
  child.stdout.on("data", appendOutput);
  child.stderr.on("data", appendOutput);
  child.once("exit", (exitCode) => {
    started.exitCode = exitCode;
  });
  child.on("error", (processError) => {
    started.processError = processError;
  });
  started.closed = new Promise((resolve) => {
    child.once("close", resolve);
  });
  return started;
}

export async function stopBinary(started) {
  const isRunning = started.exitCode === undefined && started.processError === undefined;
  if (isRunning) {
    started.child.kill();
  }
  await started.closed;
  fs.rmSync(started.dataFolder, { recursive: true, force: true });
  if (started.processError) {
    throw started.processError;
  }
}

/** Applied migrations in the started app's database, or -1 while it cannot be read yet. */
export function countAppliedMigrations(started) {
  const databaseFile = path.join(started.dataFolder, "shopos.sqlite");
  try {
    const statement = "select count(*) from __drizzle_migrations";
    // stderr ignored: "no such table" is expected until the app has migrated.
    const countText = execFileSync("sqlite3", [databaseFile, statement], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return Number(countText.trim());
  } catch {
    return -1;
  }
}

export function countJournalMigrations() {
  const journalFile = path.join(DESKTOP_FOLDER, "drizzle", "meta", "_journal.json");
  return JSON.parse(fs.readFileSync(journalFile, "utf8")).entries.length;
}

export function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect(port, "127.0.0.1");
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}
