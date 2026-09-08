import Constants from 'expo-constants';

const ENV_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
const DEFAULT_API_BASE_URL = 'http://localhost:8000';

const getExpoHostBaseUrl = () => {
	const hostUri = Constants.expoConfig?.hostUri;
	if (!hostUri) {
		return null;
	}

	const host = hostUri.split(':')[0];
	if (!host) {
		return null;
	}

	return `http://${host}:8000`;
};

const selectedBaseUrl = ENV_API_BASE_URL || getExpoHostBaseUrl() || DEFAULT_API_BASE_URL;

export const API_BASE_URL = selectedBaseUrl.replace(/\/+$/, '');