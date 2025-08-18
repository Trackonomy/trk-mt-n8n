# trk Agent Compatibility Change Log

## 1. Environment Setup

- Copy `.env.example` from `packages/cli/bin/` to `.env` in the same directory.
- For Postgres DB, add/update these variables:
  ```bash
  DB_TYPE=postgresdb
  DB_POSTGRESDB_DATABASE=n8n-db
  DB_POSTGRESDB_HOST=localhost
  DB_POSTGRESDB_PASSWORD=postgres
  DB_POSTGRESDB_USER=postgres
  ```
- To disable analytics and licensing features, add:
  ```bash
  N8N_DIAGNOSTICS_POSTHOG_API_KEY=""
  N8N_DIAGNOSTICS_ENABLED=false
  N8N_TEMPLATES_ENABLED=false
  N8N_VERSION_NOTIFICATIONS_ENABLED=false
  N8N_LICENSE_SERVER_URL="#"
  N8N_LICENSE_AUTO_RENEW_ENABLED=false
  N8N_LICENSE_ACTIVATION_KEY=""
  N8N_LICENSE_DETACH_FLOATING_ON_SHUTDOWN=true
  N8N_LICENSE_TENANT_ID=1
  N8N_LICENSE_CERT=""
  N8N_DEPLOYMENT_TYPE="cloud"
  ```

---

## 2. UI Changes: Hide Side Nav for Members

**File:** `packages/frontend/editor-ui/src/components/MainSidebar.vue`

- Add to `<style>`:
  ```css
  .hidden {
    display: none !important;
  }
  ```
- Update `<div id="side-menu">`:
  ```html
  <div
    id="side-menu"
    :class="{
      ['side-menu']: true,
      [$style.sideMenu]: true,
      [$style.sideMenuCollapsed]: isCollapsed,
      [$style.hidden]: !usersStore.isInstanceOwner, // Add this
    }"
  >
  ```
- In `mainMenuItems` function, comment out these menu IDs:
  - cloud-admin
  - templates (twice)
  - help
  - whats-new

---

## 3. License & Feature Unlocks

### `packages/@n8n/backend-common/src/license-state.ts`
```js
isLicensed(feature: BooleanLicenseFeature) {
  this.assertProvider();
  return true; // Always licensed
  // return this.licenseProvider.isLicensed(feature);
}

getValue<T extends keyof FeatureReturnType>(feature: T): FeatureReturnType[T] {
  this.assertProvider();
  return undefined; // Use default values
  // return this.licenseProvider.getValue(feature);
}

getMaxTeamProjects() {
  return this.getValue('quota:maxTeamProjects') ?? -1; // Infinite
}

getMaxWorkflowsWithEvaluations() {
  return this.getValue('quota:evaluations:maxWorkflows') ?? -1; // Infinite
}
```

### `packages/cli/src/license.ts`
```js
isLicensed(feature: BooleanLicenseFeature) {
  return true;
  // return this.manager?.hasFeatureEnabled(feature) ?? false;
}

isAPIDisabled() {
  return false; // API key option enabled
  // return this.isLicensed(LICENSE_FEATURES.API_DISABLED);
}

getValue<T extends keyof FeatureReturnType>(feature: T): FeatureReturnType[T] {
  return undefined;
  // return this.manager?.getFeatureValue(feature) as FeatureReturnType[T];
}

getTeamProjectLimit() {
  return this.getValue(LICENSE_QUOTAS.TEAM_PROJECT_LIMIT) ?? -1;
}

getPlanName(): string {
  return "Business";
  // return this.getValue('planName') ?? 'Community';
}

isWithinUsersLimit() {
  return true;
  // return this.getUsersLimit() === UNLIMITED_LICENSE_QUOTA;
}

enableAutoRenewals() {
  return false;
  // this.manager?.enableAutoRenewals();
}

disableAutoRenewals() {
  return true;
  // this.manager?.disableAutoRenewals();
}
```

### `packages/cli/src/license/license.service.ts`
```js
async getLicenseData() {
  const triggerCount = await this.workflowRepository.getActiveTriggerCount();
  const workflowsWithEvaluationsCount = await this.workflowRepository.getWorkflowsWithEvaluationCount();
  const mainPlan = this.license.getMainPlan();

  return {
    usage: {
      activeWorkflowTriggers: {
        value: triggerCount,
        limit: this.license.getTriggerLimit(),
        warningThreshold: 0.8,
      },
      workflowsHavingEvaluations: {
        value: workflowsWithEvaluationsCount,
        limit: this.licenseState.getMaxWorkflowsWithEvaluations(),
      },
    },
    license: {
      planId: mainPlan?.productId ?? '031ebde1-0ebe-47b8-802a-29c084a2a4c3',
      planName: this.license.getPlanName(),
    },
  };
}
```

### `packages/frontend/editor-ui/src/stores/usage.store.ts`
```js
const DEFAULT_PLAN_NAME = 'Business';
```

### `packages/cli/src/services/frontend.service.ts`
```js
showNonProdBanner: !this.license.isLicensed(LICENSE_FEATURES.SHOW_NON_PROD_BANNER),
```

---

## 4. Workflow API: Project from Payload

### `packages/cli/src/public-api/v1/handlers/workflows/workflows.handler.ts`
```js
createWorkflow: [
  apiKeyHasScope('workflow:create'),
  async (req: WorkflowRequest.Create, res: express.Response): Promise<express.Response> => {
    const workflow = req.body;

    const projectId = workflow.staticData?.projectId as string ?? "";
    delete workflow.staticData?.projectId;

    workflow.active = false;
    workflow.versionId = uuid();

    await replaceInvalidCredentials(workflow);
    addNodeIds(workflow);

    let project = await Container.get(ProjectRepository).getPersonalProjectForUserOrFail(req.user.id);

    if (projectId !== "") {
      project = await Container.get(ProjectRepository).getProjectsById(projectId);
    }

    const createdWorkflow = await createWorkflow(workflow, req.user, project, 'workflow:owner');

    await Container.get(WorkflowHistoryService).saveVersion(req.user, createdWorkflow, createdWorkflow.id);
    await Container.get(ExternalHooks).run('workflow.afterCreate', [createdWorkflow]);
    Container.get(EventService).emit('workflow-created', {
      workflow: createdWorkflow,
      user: req.user,
      publicApi: true,
      projectId: project.id,
      projectType: project.type,
    });

    return res.json(createdWorkflow);
  },
],
```

### `packages/@n8n/db/src/repositories/project.repository.ts`
```js
async getProjectsById(projectId: string, entityManager?: EntityManager) {
  const em = entityManager ?? this.manager;
  return await em.findOne(Project, { where: { id: projectId } }) as Project;
}
```

---

## 5. Docker Build & Deployment

**Build locally:**
```bash
IMAGE_BASE_NAME=trk-mt-n8n IMAGE_TAG=0.0.1 pnpm run build:docker
```

**Run locally:**
```bash
docker run -it --rm \
  -p 5678:5678 \
  -e N8N_ENCRYPTION_KEY="GpGKESMJQhypu3fMYmmba9LJMvD55ukQ" \
  -e N8N_RUNNERS_ENABLED="true" \
  -e N8N_DIAGNOSTICS_POSTHOG_API_KEY="" \
  -e N8N_DIAGNOSTICS_ENABLED="false" \
  -e N8N_TEMPLATES_ENABLED="false" \
  -e N8N_VERSION_NOTIFICATIONS_ENABLED="false" \
  -e N8N_LICENSE_SERVER_URL="#" \
  -e N8N_LICENSE_AUTO_RENEW_ENABLED="false" \
  -e N8N_LICENSE_ACTIVATION_KEY="" \
  -e N8N_LICENSE_DETACH_FLOATING_ON_SHUTDOWN="true" \
  -e N8N_LICENSE_TENANT_ID="1" \
  -e N8N_LICENSE_CERT="" \
  -e N8N_DEPLOYMENT_TYPE="cloud" \
  -e N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true \
  -v ~/.n8n:/home/node/.n8n \
  trk-mt-n8n:0.0.1
```

**Sample GitHub Action CI:**
```yaml
name: Build and Push n8n
on:
  push:
    branches: [ main ]

jobs:
  docker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - name: Install pnpm
        run: npm install -g pnpm

      - name: Install deps
        run: pnpm install --frozen-lockfile

      - name: Build Docker image
        run: |
          IMAGE_BASE_NAME=trk-registry.company.com/n8n \
          IMAGE_TAG=${{ github.sha }} \
          pnpm run build:docker

      - name: Push to registry
        run: |
          echo "${{ secrets.REGISTRY_PASSWORD }}" | docker login my-registry.company.com -u "${{ secrets.REGISTRY_USER }}" --password-stdin
          docker push my-registry.company.com/n8n:${{ github.sha }}
```