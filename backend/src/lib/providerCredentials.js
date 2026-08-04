import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { PROJECT_ENV_FILE_PATH, updateEnvironmentFile } from './environmentFile.js';
import { providerLoginIsConfigured } from './providerLogins.js';

export const PROVIDER_CREDENTIALS_PATH =
  process.env.OPEN_KRITT_PROVIDER_CREDENTIALS_PATH || '/credentials/providers.json';

export const DEEPSEEK_DEFAULT_BASE_URL = 'https://api.deepseek.com/anthropic';

export const PROVIDER_DEFINITIONS = {
  codex: {
    label: 'Codex',
    envKeys: ['CODEX_API_KEY', 'OPENAI_API_KEY'],
    credentialLabel: 'Codex login',
    description: 'ChatGPT subscription account authenticated through Codex device login.',
    management: 'login',
  },
  claude: {
    label: 'Claude',
    envKeys: ['ANTHROPIC_API_KEY'],
    credentialLabel: 'Claude login',
    description: 'Claude subscription accounts authenticated through Claude Code.',
    management: 'login',
  },
  openrouter: {
    label: 'OpenRouter',
    envKeys: ['OPENROUTER_API_KEY'],
    credentialLabel: 'OpenRouter API key',
    description: 'OpenRouter-compatible models through a project API key.',
    management: 'api_key',
  },
  deepseek: {
    label: 'DeepSeek',
    envKeys: ['DEEPSEEK_API_KEY', 'DEEPSEEK_BASE_URL'],
    credentialLabel: 'DeepSeek API key',
    description: 'DeepSeek models driven through the Claude Code harness, via DeepSeek’s Anthropic-compatible endpoint.',
    management: 'api_key',
  },
};

const MANAGED_CREDENTIAL_PROVIDERS = new Set(['openrouter', 'deepseek']);

const MAX_CREDENTIAL_LENGTH = 16 * 1024;
let writeQueue = Promise.resolve();

function hasValue(value) {
  return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
}

function hasConfiguredFlag(value) {
  if (value === true) return true;
  if (typeof value !== 'string') return false;
  return ['1', 'true', 'yes'].includes(value.trim().toLowerCase());
}

function emptyStore() {
  return { version: 1, credentials: {}, baseUrls: {}, disabledEnvironmentProviders: [] };
}

function normalizeStore(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyStore();
  const source = value.credentials;
  const credentials = {};
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    for (const provider of MANAGED_CREDENTIAL_PROVIDERS) {
      if (hasValue(source[provider])) credentials[provider] = String(source[provider]);
    }
  }
  const disabledEnvironmentProviders = Array.isArray(value.disabledEnvironmentProviders)
    ? [...new Set(value.disabledEnvironmentProviders.filter((provider) => MANAGED_CREDENTIAL_PROVIDERS.has(provider)))]
    : [];
  const baseUrls = {};
  if (hasValue(value.baseUrls?.deepseek)) baseUrls.deepseek = String(value.baseUrls.deepseek);
  return { version: 1, credentials, baseUrls, disabledEnvironmentProviders };
}

export function readManagedCredentialStateSync(credentialsPath = PROVIDER_CREDENTIALS_PATH) {
  try {
    return normalizeStore(JSON.parse(readFileSync(credentialsPath, 'utf8')));
  } catch {
    return emptyStore();
  }
}

export function readManagedCredentialsSync(credentialsPath = PROVIDER_CREDENTIALS_PATH) {
  return readManagedCredentialStateSync(credentialsPath).credentials;
}

async function readStore(credentialsPath) {
  try {
    return normalizeStore(JSON.parse(await readFile(credentialsPath, 'utf8')));
  } catch (error) {
    if (error?.code === 'ENOENT') return emptyStore();
    if (error instanceof SyntaxError) {
      throw new Error('The managed provider credential file is invalid JSON.', { cause: error });
    }
    throw error;
  }
}

async function writeStore(credentialsPath, store) {
  await mkdir(dirname(credentialsPath), { recursive: true, mode: 0o700 });
  const tempPath = join(dirname(credentialsPath), `.providers.${process.pid}.${randomUUID()}.tmp`);
  await writeFile(tempPath, `${JSON.stringify(store, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await rename(tempPath, credentialsPath);
  await chmod(credentialsPath, 0o600);
}

function queuedWrite(operation) {
  const pending = writeQueue.then(operation);
  writeQueue = pending.catch(() => {});
  return pending;
}

export function validateProviderCredential(provider, credential) {
  if (!MANAGED_CREDENTIAL_PROVIDERS.has(provider)) {
    return { field: 'provider', message: 'This provider does not accept an API key in Accounts.' };
  }
  if (typeof credential !== 'string' || !credential.trim()) {
    return { field: 'credential', message: 'Enter an API key.' };
  }
  if (credential.length > MAX_CREDENTIAL_LENGTH || /[\r\n]/.test(credential)) {
    return { field: 'credential', message: 'The API key must be a single line under 16 KB.' };
  }
  return null;
}

export function validateProviderBaseUrl(provider, baseUrl) {
  if (provider !== 'deepseek') return null;
  // Optional: DeepSeek's Anthropic-compatible endpoint has a sane default
  // (DEEPSEEK_DEFAULT_BASE_URL) applied when the field is left blank.
  if (!hasValue(baseUrl)) return null;
  try {
    const url = new URL(String(baseUrl).trim());
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) throw new Error('invalid');
    return null;
  } catch {
    return { field: 'baseUrl', message: 'Enter a valid HTTP or HTTPS base URL.' };
  }
}

export async function saveManagedProviderCredential(
  provider,
  credential,
  { credentialsPath = PROVIDER_CREDENTIALS_PATH, environmentFilePath = PROJECT_ENV_FILE_PATH, baseUrl } = {}
) {
  const validationError = validateProviderCredential(provider, credential);
  const resolvedBaseUrl = hasValue(baseUrl) ? baseUrl : (process.env.DEEPSEEK_BASE_URL ?? '');
  const baseUrlError = validateProviderBaseUrl(provider, resolvedBaseUrl);
  if (validationError || baseUrlError) {
    const error = new Error((validationError || baseUrlError).message);
    error.validationError = validationError || baseUrlError;
    throw error;
  }

  return queuedWrite(async () => {
    const store = await readStore(credentialsPath);
    const previousStore = {
      ...store,
      credentials: { ...store.credentials },
      baseUrls: { ...(store.baseUrls || {}) },
      disabledEnvironmentProviders: [...store.disabledEnvironmentProviders],
    };
    store.credentials[provider] = credential.trim();
    if (provider === 'deepseek' && hasValue(resolvedBaseUrl)) {
      store.baseUrls = { ...(store.baseUrls || {}), deepseek: String(resolvedBaseUrl).trim() };
    }
    store.disabledEnvironmentProviders = store.disabledEnvironmentProviders.filter(
      (candidate) => candidate !== provider
    );
    await writeStore(credentialsPath, store);
    try {
      await updateEnvironmentFile(
        {
          [PROVIDER_DEFINITIONS[provider].envKeys[0]]: credential.trim(),
          ...(provider === 'deepseek' && hasValue(resolvedBaseUrl)
            ? { DEEPSEEK_BASE_URL: String(resolvedBaseUrl).trim() }
            : {}),
        },
        { environmentFilePath }
      );
    } catch (error) {
      await writeStore(credentialsPath, previousStore);
      throw error;
    }
  });
}

export async function removeManagedProviderCredential(
  provider,
  {
    credentialsPath = PROVIDER_CREDENTIALS_PATH,
    disableEnvironment = false,
    environmentFilePath = PROJECT_ENV_FILE_PATH,
  } = {}
) {
  if (!MANAGED_CREDENTIAL_PROVIDERS.has(provider)) return false;
  return queuedWrite(async () => {
    const store = await readStore(credentialsPath);
    const previousStore = {
      ...store,
      credentials: { ...store.credentials },
      baseUrls: { ...(store.baseUrls || {}) },
      disabledEnvironmentProviders: [...store.disabledEnvironmentProviders],
    };
    const existed = Object.hasOwn(store.credentials, provider);
    delete store.credentials[provider];
    if (store.baseUrls) delete store.baseUrls[provider];
    const wasDisabled = store.disabledEnvironmentProviders.includes(provider);
    if (disableEnvironment && !wasDisabled) store.disabledEnvironmentProviders.push(provider);
    await writeStore(credentialsPath, store);
    try {
      await updateEnvironmentFile(
        {
          [PROVIDER_DEFINITIONS[provider].envKeys[0]]: '',
          ...(provider === 'deepseek' ? { DEEPSEEK_BASE_URL: '' } : {}),
        },
        { environmentFilePath }
      );
    } catch (error) {
      await writeStore(credentialsPath, previousStore);
      throw error;
    }
    return existed || (disableEnvironment && !wasDisabled);
  });
}

export function providerCredentialStatuses({
  env = process.env,
  credentialsPath = PROVIDER_CREDENTIALS_PATH,
  loginOptions,
} = {}) {
  const store = readManagedCredentialStateSync(credentialsPath);
  const managed = store.credentials;
  const disabledEnvironmentProviders = new Set(store.disabledEnvironmentProviders);
  return Object.entries(PROVIDER_DEFINITIONS).map(([id, definition]) => {
    const managedCredential = hasValue(managed[id]);
    const environmentCredential =
      !disabledEnvironmentProviders.has(id) &&
      (id === 'deepseek' ? definition.envKeys.slice(0, 1) : definition.envKeys).some(
        (key) => hasValue(env[key]) || hasConfiguredFlag(env[`OPEN_KRITT_${key}_CONFIGURED`])
      );
    const savedLogin = providerLoginIsConfigured(id, { env, ...loginOptions });
    const configured = managedCredential || environmentCredential || savedLogin;
    const source = managedCredential
      ? 'managed_api_key'
      : savedLogin
        ? `${id}_login`
        : environmentCredential
          ? 'environment'
          : null;
    return {
      id,
      label: definition.label,
      description: definition.description,
      credentialLabel: definition.credentialLabel,
      management: definition.management,
      configured,
      source,
      canManage: definition.management === 'login' || MANAGED_CREDENTIAL_PROVIDERS.has(id),
      canRemove: MANAGED_CREDENTIAL_PROVIDERS.has(id) && (managedCredential || environmentCredential),
      managed: managedCredential,
    };
  });
}
