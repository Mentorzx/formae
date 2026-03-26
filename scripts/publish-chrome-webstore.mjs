import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { packageExtension } from "./package-extension.mjs";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const chromeScope = "https://www.googleapis.com/auth/chromewebstore";

if (isMain(import.meta.url, process.argv[1])) {
  publishChromeWebStore({ repoRoot }).catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}

export async function publishChromeWebStore({
  repoRoot: providedRepoRoot = repoRoot,
  extensionId = process.env.CWS_EXTENSION_ID ?? null,
  publisherId = process.env.CWS_PUBLISHER_ID ?? null,
  clientId = process.env.CWS_CLIENT_ID ?? null,
  clientSecret = process.env.CWS_CLIENT_SECRET ?? null,
  refreshToken = process.env.CWS_REFRESH_TOKEN ?? null,
  publish = process.argv.includes("--publish"),
  skipReview = process.argv.includes("--skip-review"),
  staged = process.argv.includes("--staged"),
} = {}) {
  assertEnvValue(clientId, "CWS_CLIENT_ID");
  assertEnvValue(clientSecret, "CWS_CLIENT_SECRET");
  assertEnvValue(refreshToken, "CWS_REFRESH_TOKEN");
  assertEnvValue(publisherId, "CWS_PUBLISHER_ID");
  assertEnvValue(
    extensionId,
    "CWS_EXTENSION_ID",
    "Crie o item no dashboard primeiro e informe o item id para atualizar/publicar via API.",
  );

  const build = await packageExtension({ repoRoot: providedRepoRoot });
  const archivePath = build.archives.chrome;
  const archiveBody = await readFile(archivePath);
  const accessToken = await exchangeRefreshToken({
    clientId,
    clientSecret,
    refreshToken,
  });
  const itemName = `publishers/${publisherId}/items/${extensionId}`;

  const uploadResponse = await fetch(
    `https://chromewebstore.googleapis.com/upload/v2/${itemName}:upload`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/zip",
      },
      body: archiveBody,
    },
  );

  const uploadJson = await parseJsonResponse(uploadResponse, "Chrome upload");

  if (!publish) {
    process.stdout.write(
      `${JSON.stringify(
        {
          itemName,
          archivePath,
          uploadState: uploadJson.uploadState ?? null,
          itemId: uploadJson.itemId ?? extensionId,
          published: false,
        },
        null,
        2,
      )}\n`,
    );
    return uploadJson;
  }

  const publishResponse = await fetch(
    `https://chromewebstore.googleapis.com/v2/${itemName}:publish`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        publishType: staged ? "STAGED_PUBLISH" : "DEFAULT_PUBLISH",
        skipReview,
      }),
    },
  );

  const publishJson = await parseJsonResponse(
    publishResponse,
    "Chrome publish",
  );

  process.stdout.write(
    `${JSON.stringify(
      {
        itemName,
        archivePath,
        uploadState: uploadJson.uploadState ?? null,
        publishState: publishJson.state ?? null,
        itemId: publishJson.itemId ?? extensionId,
        published: true,
      },
      null,
      2,
    )}\n`,
  );

  return {
    upload: uploadJson,
    publish: publishJson,
  };
}

async function exchangeRefreshToken({ clientId, clientSecret, refreshToken }) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: chromeScope,
    }),
  });
  const payload = await parseJsonResponse(response, "Google OAuth token");

  if (typeof payload.access_token !== "string" || payload.access_token.length === 0) {
    throw new Error("Google OAuth token exchange did not return access_token.");
  }

  return payload.access_token;
}

async function parseJsonResponse(response, label) {
  const text = await response.text();
  const payload = text.length > 0 ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(
      `${label} failed with HTTP ${response.status}: ${JSON.stringify(payload)}`,
    );
  }

  return payload;
}

function assertEnvValue(value, name, help = "Configure o segredo no ambiente.") {
  if (typeof value === "string" && value.length > 0) {
    return;
  }

  throw new Error(`Missing ${name}. ${help}`);
}

function isMain(metaUrl, argvPath) {
  if (!argvPath) {
    return false;
  }

  return metaUrl === pathToFileURL(resolve(argvPath)).href;
}
