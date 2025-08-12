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
				displayName: 'Input Preview',
				name: 'inputPreview',
				type: 'options',
				default: '',
				options: [],
				typeOptions: {
					reloadOptions: true,
					loadOptionsDependsOn: ['resource'],
					loadOptionsMethod: 'getInputPreview',
				},
				description: 'Request preview sent to /v1/agent/list',
				noDataExpression: false,
			},
			{
				displayName: 'Output Preview',
				name: 'outputPreview',
				type: 'options',
				default: '',
				options: [],
				typeOptions: {
					reloadOptions: true,
					loadOptionsDependsOn: ['resource'],
					loadOptionsMethod: 'getOutputPreview',
				},
				description: 'Response preview for selected agent from /v1/agent/list',
				noDataExpression: false,
			},
			{
				displayName: 'Additional Input Fields',
				name: 'additionalFields',
				type: 'fixedCollection',
				placeholder: 'Add Input Field',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				options: [
					{
						name: 'fields',
						displayName: 'Field',
						values: [
							{
								displayName: 'Field Name',
								name: 'fieldName',
								type: 'string',
								default: '',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
							},
						],
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			async getAgents(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const staticData = this.getWorkflowStaticData('node');
				if (!staticData.trkAgentsPreview) {
					const responseData = await TrkAgentsApiRequest.call(this, 'GET', '/v1/agent/list', {});
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

			async getInputPreview(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const staticData = this.getWorkflowStaticData('node');
				const agentId = this.getCurrentNodeParameter('resource') as string;
				// Defensive fallback
				if (!staticData.trkAgentsPreview) {
					const responseData = await TrkAgentsApiRequest.call(this, 'GET', '/v1/agent/list', {});
					if (!responseData?.data) {
						throw new NodeOperationError(this.getNode(), 'No agent data returned');
					}
					staticData.trkAgentsPreview = responseData.data || {};
				}
				const agentsArray = Array.isArray(staticData.trkAgentsPreview)
					? staticData.trkAgentsPreview
					: [];
				const agent = agentsArray.find((a) => a.agent_id === agentId);

				const str = JSON.stringify(agent.input, null, 2);
				return [{ name: str, value: str }];
			},

			async getOutputPreview(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const staticData = this.getWorkflowStaticData('node');
				const agentId = this.getCurrentNodeParameter('resource') as string;
				// Defensive fallback
				if (!staticData.trkAgentsPreview) {
					const responseData = await TrkAgentsApiRequest.call(this, 'GET', '/v1/agent/list', {});
					if (!responseData?.data) {
						throw new NodeOperationError(this.getNode(), 'No agent data returned');
					}
					staticData.trkAgentsPreview = responseData.data || {};
				}
				const agentsArray = Array.isArray(staticData.trkAgentsPreview)
					? staticData.trkAgentsPreview
					: [];
				const agent = agentsArray.find((a) => a.agent_id === agentId);
				const str = JSON.stringify(
					agent.output || { message: 'Agent not found in cached data' },
					null,
					2,
				);
				return [{ name: str, value: str }];
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const additionalFields = this.getNodeParameter('additionalFields', 0);
		const agent_id = this.getNodeParameter('resource', 0);
		const body = {
			context: additionalFields,
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
