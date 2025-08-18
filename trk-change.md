# Change logs to make compatible with trk agent

## Env file

Please copy [.env.example](packages/cli/bin/.env.example) as `.env`(packages/cli/bin/.env)

`n8n` uses `sqlite` as default DB if you want to use postgres please add following envs

```bash
DB_TYPE=postgresdb # Fixed
DB_POSTGRESDB_DATABASE=n8n-db # Fixed
DB_POSTGRESDB_HOST=localhost # According to your DB setup
DB_POSTGRESDB_PASSWORD=potgres # According to your DB setup
DB_POSTGRESDB_USER=postgres # According to your DB setup
```

Added envs to disable analytics
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

## Code update to hide side nav in case of member

Open [MainSidebar.vue](packages/frontend/editor-ui/src/components/MainSidebar.vue) add following CSS in style block

```css
.hidden {
	display: none !important;
}
```

Please add following style in `<div id="side-menu">`

```html
<div
	id="side-menu"
	:class="{
    ['side-menu']: true,
    [$style.sideMenu]: true,
    [$style.sideMenuCollapsed]: isCollapsed,
    [$style.hidden]: !usersStore.isInstanceOwner, // Please add this
	}"
>
```

Also we wanted to remove unnecessary menu options as well in `mainMenuItems` function in the same file please comment following menu id options
  * cloud-admin
  * templates
  * templates
  * help
  * whats-new

---

## Changes to make full licensed Version

**File Name: `packages/@n8n/backend-common/src/license-state.ts`**

```js
isLicensed(feature: BooleanLicenseFeature) {
	this.assertProvider();
	return true; // Add this
	// return this.licenseProvider.isLicensed(feature); // Comment/remove this
}
```

```js
getValue<T extends keyof FeatureReturnType>(feature: T): FeatureReturnType[T] {
	this.assertProvider();
	return undefined; // Add this
	// return this.licenseProvider.getValue(feature); // Comment/remove this
}
```

```js
getMaxTeamProjects() {
	// Instead of returning 0 return -1 to increase infinite limit
	return this.getValue('quota:maxTeamProjects') ?? -1; 
}
```

```js
getMaxWorkflowsWithEvaluations() {
	// Instead of returning 0 return -1 to increase infinite limit
	return this.getValue('quota:evaluations:maxWorkflows') ?? -1;
}
```

**File Name: `packages/cli/src/license.ts`**

```js
isLicensed(feature: BooleanLicenseFeature) {
	return true; // Add this
	// return this.manager?.hasFeatureEnabled(feature) ?? false; // Comment/remove this
}
```

```js
isAPIDisabled() {
	// Sending true will disable to the API key option in setting
	return false; // Add this
	// return this.isLicensed(LICENSE_FEATURES.API_DISABLED); // Comment/remove this
}
```

```js
getValue<T extends keyof FeatureReturnType>(feature: T): FeatureReturnType[T] {
	return undefined; // Returning undefined will use the default values
	// return this.manager?.getFeatureValue(feature) as FeatureReturnType[T]; // Comment/remove this
}
```

```js
getTeamProjectLimit() {
	// Instead of returning 0 return -1 to increase infinite limit
	return this.getValue(LICENSE_QUOTAS.TEAM_PROJECT_LIMIT) ?? -1;
}
```

```js
getPlanName(): string {
	return "Business"; // Add Bussiness Plan
	// return this.getValue('planName') ?? 'Community'; // Comment/remove this
}
```

```js
isWithinUsersLimit() {
	return true; // For the max users add this
	// return this.getUsersLimit() === UNLIMITED_LICENSE_QUOTA; // Comment/remove this
}
```

```js
enableAutoRenewals() {
	return false; // To disable auto renewals
	// this.manager?.enableAutoRenewals(); // Comment/remove this
}
```

```js
disableAutoRenewals() {
	return true; // To disable auto renewals
	// this.manager?.disableAutoRenewals();  // Comment/remove this
}
```

**File Name: `packages/cli/src/license/license.service.ts`**

```js
async getLicenseData() {
	const triggerCount = await this.workflowRepository.getActiveTriggerCount();
	const workflowsWithEvaluationsCount =
		await this.workflowRepository.getWorkflowsWithEvaluationCount();
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
		license: {// Sample productId instead of ''
			planId: mainPlan?.productId ?? '031ebde1-0ebe-47b8-802a-29c084a2a4c3',
			planName: this.license.getPlanName(),
		},
	};
}
```

**FileName: `packages/frontend/editor-ui/src/stores/usage.store.ts`**

```js
const DEFAULT_PLAN_NAME = 'Business'; // Instead of Community return Business
```

**File Name: `packages/cli/src/services/frontend.service.ts`**

This will be the FE change to disable production banner in the dashboard
```js
showNonProdBanner: !this.license.isLicensed(LICENSE_FEATURES.SHOW_NON_PROD_BANNER),
```

---

## Changes in workflow API to add project from the payload

**FileName: `packages/cli/src/public-api/v1/handlers/workflows/workflows.handler.ts`**

Update function
```js
createWorkflow: [
		apiKeyHasScope('workflow:create'),
		async (req: WorkflowRequest.Create, res: express.Response): Promise<express.Response> => {
			const workflow = req.body;

			const projectId = workflow.staticData?.projectId as string ?? "" ; // Add this
			delete workflow.staticData?.projectId; // Add this

			workflow.active = false;
			workflow.versionId = uuid();

			await replaceInvalidCredentials(workflow);

			addNodeIds(workflow);

			let project = await Container.get(ProjectRepository).getPersonalProjectForUserOrFail(
				req.user.id,
			);

			// Add below code block
			if(projectId !== ""){
				project = await Container.get(ProjectRepository).getProjectsById(projectId);
			}

			const createdWorkflow = await createWorkflow(workflow, req.user, project, 'workflow:owner');

			await Container.get(WorkflowHistoryService).saveVersion(
				req.user,
				createdWorkflow,
				createdWorkflow.id,
			);

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

**FileName: `packages/@n8n/db/src/repositories/project.repository.ts`**
```js
// Add this code block
async getProjectsById(projectId: string, entityManager?: EntityManager){
	const em = entityManager ?? this.manager;
	return await em.findOne(Project, {
		where: { id: projectId },
	}) as Project;
}
```
---