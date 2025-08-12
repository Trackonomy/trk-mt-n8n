import type {
	IDataObject,
	ICredentialDataDecryptedObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
	IRequestOptions,
} from 'n8n-workflow';

/**
 * Make an API request to TrkAgents
 *
 */
export async function TrkAgentsApiRequest(
	this: IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	resource: string,
	body: object,
	query?: IDataObject,
) {
	const credentials: ICredentialDataDecryptedObject = await this.getCredentials('trkAgentsApi');
	console.log('credentials', credentials);
	const options: IRequestOptions = {
		headers: {
			'Content-Type': 'application/json',
			customer_id: credentials.customerId,
			authorized_groups: credentials.authorizedGroups,
			'x-api-key': credentials.apiKey,
		},
		method,
		body,
		qs: query,
		uri: credentials.uri + `${resource}`,
		json: true,
	};

	return await this.helpers.requestWithAuthentication.call(this, 'trkAgentsApi', options);
}
