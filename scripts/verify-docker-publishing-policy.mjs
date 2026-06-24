import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

const files = {
  workflow: resolve(root, ".github/workflows/docker-publish-dry-run.yml"),
  releaseWorkflow: resolve(root, ".github/workflows/docker-publish-release.yml"),
  docs: resolve(root, "docs/DOCKER_PUBLISHING.md"),
  docsChecklist: resolve(root, "docs/DOCKER_PUBLISHING_CHECKLIST.md"),
  readme: resolve(root, "README.md"),
  deployment: resolve(root, "DEPLOYMENT.md"),
};

const read = (file) => readFileSync(file, "utf8");
const label = (file) => relative(root, file).replaceAll("\\", "/");

const failures = [];

const expectIncludes = (name, file, text, snippets) => {
  for (const snippet of snippets) {
    if (!text.includes(snippet)) {
      failures.push(`${name}: expected ${label(file)} to include "${snippet}".`);
    }
  }
};

const expectNotMatches = (name, file, text, patterns) => {
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      failures.push(`${name}: ${label(file)} matched blocked pattern ${pattern}.`);
    }
  }
};

const workflow = read(files.workflow);
const releaseWorkflow = read(files.releaseWorkflow);
const docs = read(files.docs);
const docsChecklist = read(files.docsChecklist);
const readme = read(files.readme);
const deployment = read(files.deployment);

expectIncludes("manual dry run", files.workflow, workflow, [
  "workflow_dispatch:",
  "packages: read",
  "docker build",
  "docker run",
  "/api/meta",
  "Dry run only: no registry login and no docker push.",
]);

expectNotMatches("manual dry run", files.workflow, workflow, [
  /^\s+push:\s*$/m,
  /^\s+pull_request:\s*$/m,
  /packages:\s*write\b/,
  /docker\/login-action/i,
  /docker\/build-push-action/i,
  /^\s*docker\s+push\b/im,
  /^\s*push:\s*true\s*$/im,
]);

expectIncludes("release workflow", files.releaseWorkflow, releaseWorkflow, [
  "name: Docker Publish Release",
  "workflow_dispatch:",
  "DOCKER_PUBLISH_ENABLED",
  "publish",
  "inputs.publish",
  "packages: write",
]);

expectNotMatches("release workflow", files.releaseWorkflow, releaseWorkflow, [
  /^\s+push:\s*$/m,
  /^\s+pull_request:\s*$/m,
  /docker\s+push-action/i,
]);

expectIncludes("release publish guard", files.releaseWorkflow, releaseWorkflow, [
  "${{ inputs.publish }}",
  "vars.DOCKER_PUBLISH_ENABLED == 'true'",
  "docker push",
]);

expectIncludes("publishing policy", files.docs, docs, [
  "# Docker Publishing Policy",
  "manual, gated GHCR release workflow",
  "ghcr.io/martin123132/the-foundry:v0.1.0",
  "No `latest` tag is published yet.",
  "Do not publish from ordinary branch pushes or pull requests.",
  "docker push",
  "GHCR",
  "Publish Checklist",
]);

expectIncludes("publishing policy links", files.readme, readme, [
  "docs/DOCKER_PUBLISHING.md",
]);

expectIncludes("deployment policy links", files.deployment, deployment, [
  "docs/DOCKER_PUBLISHING.md",
]);

expectIncludes("publishing checklist", files.docs, docs, [
  "docs/DOCKER_PUBLISHING_CHECKLIST.md",
]);

expectIncludes("publishing checklist content", files.docsChecklist, docsChecklist, [
  "# Docker Publishing Readiness Checklist",
  "## Registry & Access",
  "## Trigger & Tag Policy",
  "## Sign-off",
]);

if (failures.length > 0) {
  console.error("Docker publishing policy verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Docker publishing policy verification passed.");
