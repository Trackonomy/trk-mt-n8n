import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class TrkAgentsApi implements ICredentialType {
	name = 'trkAgentsApi';

	displayName = 'Trackonomy Agents API';

	documentationUrl = 'trkAgentsApi';

	icon = { light: 'file:icons/trk.png', dark: 'file:icons/trk.png' } as const;

	properties: INodeProperties[] = [
		{
			displayName: 'Host',
			name: 'uri',
			type: 'string',
			required: true,
			default: '',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
		},
		{
			displayName: 'Customer ID',
			name: 'customerId',
			type: 'string',
			required: true,
			default: '',
		},
		{
			displayName: 'Authorized Groups',
			name: 'authorizedGroups',
			type: 'string',
			required: true,
			default: '',
		},
	];
}
