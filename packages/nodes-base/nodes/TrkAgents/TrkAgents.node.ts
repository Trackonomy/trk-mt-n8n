/* eslint-disable n8n-nodes-base/node-param-display-name-miscased */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options */
/* eslint-disable n8n-nodes-base/node-param-description-wrong-for-dynamic-options */
/* eslint-disable n8n-nodes-base/node-class-description-icon-not-svg */
/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	IDataObject,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { TrkAgentsApiRequest } from './GenericFunctions';

export class TrkAgents implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Trackonomy Agents',
		name: 'trkAgents',
		group: ['transform'],
		version: 1,
		icon: 'file:trk.png',
		subtitle: '={{$parameter["resource"]}}',
		description: 'Consume TrkAgents API',
		defaults: {
			name: 'Trackonomy Agents',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'trkAgentsApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Agent Name or ID',
				name: 'resource',
				type: 'options',
				default: '',
				options: [],
				typeOptions: {
					loadOptionsMethod: 'getAgents',
				},
				noDataExpression: true,
				description: "Agent's ID. Choose from the list, or specify an ID using an expression.",
			},
			{
				displayName: 'Arguments',
				name: 'arguments',
				type: 'resourceMapper',
				default: {
					mappingMode: 'defineBelow',
					value: null,
				},
				required: true,
				typeOptions: {
					loadOptionsDependsOn: ['resource'],
					resourceMapper: {
						resourceMapperMethod: 'getFields',
						mode: 'add',
						fieldWords: {
							singular: 'argument',
							plural: 'arguments',
						},
						addAllFields: true,
						multiKeyMatch: true,
					},
				},
				description: 'The arguments to pass to the agent',
			},
		],
	};

	methods = {
		loadOptions: {
			async getAgents(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const staticData = this.getWorkflowStaticData('node');
				if (!staticData.trkAgentsPreview) {
					const responseData = await TrkAgentsApiRequest.call(
						this,
						'GET',
						'/v1/agent/node/list',
						{},
					);
					if (!responseData?.data) {
						throw new NodeOperationError(this.getNode(), 'No agent data returned');
					}
					staticData.trkAgentsPreview = responseData?.data ?? [];
				}

				const agentsArray = Array.isArray(staticData.trkAgentsPreview)
					? staticData.trkAgentsPreview
					: [];
				return agentsArray.map((agent: any) => ({
					name: agent.script_name || '',
					value: agent.agent_id || '',
				}));
			},
		},
		resourceMapping: {
			async getFields(this: ILoadOptionsFunctions): Promise<any> {
				const staticData = this.getWorkflowStaticData('node');
				const agentId = this.getCurrentNodeParameter('resource') as string;

				if (!staticData.trkAgentsPreview) {
					const responseData = await TrkAgentsApiRequest.call(
						this,
						'GET',
						`/v1/agent/node/${agentId}`,
						{},
					);
					if (!responseData?.data) {
						throw new NodeOperationError(this.getNode(), 'No agent data returned');
					}
					staticData.trkAgentsPreview = responseData?.data ?? [];
				}

				const agentsArray = Array.isArray(staticData.trkAgentsPreview)
					? staticData.trkAgentsPreview
					: [staticData.trkAgentsPreview];
				const agent = agentsArray.find((a: any) => a.agent_id === agentId);

				const fields: IDataObject[] = [];

				if (agent?.input) {
					// Assume agent.input is an object: { "key": "value/type" }
					for (const [key, value] of Object.entries(agent.input || {})) {
						fields.push({
							id: key,
							displayName: key,
							name: key,
							required: false,
							type: typeof value === 'number' ? 'number' : 'string',
							defaultMatch: true,
							display: true,
							readOnly: false,
						});
					}
				}
				return { fields };
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const args = this.getNodeParameter('arguments', 0, {}) as any;
		const agent_id = this.getNodeParameter('resource', 0);
		const body = {
			context: args.value || {},
		};
		// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
		const endpoint = `/v1/agent/exec/${agent_id}`;

		const responseData = await TrkAgentsApiRequest.call(this, 'POST', endpoint, body);
		if (responseData.data === undefined || responseData.data === null) {
			throw new NodeOperationError(this.getNode(), 'Unable to retrieve data from the agent');
		}
		return [this.helpers.returnJsonArray(responseData.data)];
	}
}
