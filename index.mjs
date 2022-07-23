import * as core from '@actions/core';
import * as github from '@actions/github';
import { to } from 'await-to-js';
import _ from 'lodash';
import axios from "axios";
import { mapSeries } from 'modern-async';

const gitRefToEnv = async(gitRef, token) => {
	const envs = [
		'production',
		'staging',
		'branch1',
		'branch2',
		'branch3',
		'branch4',
		'branch5',
	];
	const found = [];

	const [errE] = await to(mapSeries(envs, async (config) => {
		const [errF, payload] = await to(secret('lever-action', config, 'GITHUB_REF_NAME', token));
		if (errF) {
			throw new Error(errF);
		}

		if (payload === gitRef) {
			found.push(config);
		}
	}));

	if (errE) {
		throw new Error(errE);
	}

	if (found.length === 0) {
		throw new Error(`Found no configured branch for ${gitRef}`);
	}

	if (found.length !== 1) {
		throw new Error(`Found more than 1 configured branch for ${gitRef}`);
	}

	return found[0];
}

const secret = async(project, cfg, name, token) => {
	const config = {
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json',
		},
		auth: {
			username: token,
			password: '',
		},
		params: {
			project,
			name,
			config: cfg,
		},
	};

	const url = 'https://api.doppler.com/v3/configs/config/secret';

	const [errA, response] = await to(axios.get(url, config));
	if (errA) {
		throw new Error(errA);
	}
	return _.get(response, 'data.value.computed', '');
}

const run = async() => {
	const doppler_token = core.getInput('doppler_token');
	if(!doppler_token) {
		throw new Error('doppler_token is not set');
	}

	const ref = core.getInput('git_ref');
	if(!ref) {
		throw new Error('git_ref is not set');
	}

	const [errA, doppler_config] = await to(gitRefToEnv(ref, doppler_token));
	if (errA) {
		throw new Error(errA);
	}

	core.setOutput("doppler_config", doppler_config);
	core.exportVariable('DOPPLER_CONFIG', doppler_config);
};

try {
	run();
} catch (error) {
	core.setFailed(error.message);
}
