import { DiscordSDK } from '@discord/embedded-app-sdk';

const params = new URLSearchParams(window.location.search);
const queryClientId = params.get('client_id') || '';
const hostClientId = window.location.hostname.match(/^(\d+)\.discordsays\.com$/i)?.[1] || '';
const clientId = queryClientId || hostClientId;
const shouldConnect = Boolean(clientId) || params.get('activity') === '1';

const activity = {
  enabled: shouldConnect,
  connected: false,
  clientId,
  instanceId: '',
  sdk: null,
  participants: [],
};

function emit(name, detail = {}) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

async function connect() {
  if (!shouldConnect) {
    emit('pasu-activity-disabled', { activity });
    return;
  }
  if (!clientId) {
    emit('pasu-activity-error', { message: 'Discord Client ID is missing. Add ?client_id=YOUR_APPLICATION_ID for local testing.' });
    return;
  }

  try {
    activity.sdk = new DiscordSDK(clientId);
    activity.instanceId = activity.sdk.instanceId || '';
    await activity.sdk.ready();
    activity.connected = true;
    try {
      activity.participants = await activity.sdk.commands.getInstanceConnectedParticipants();
    } catch (_error) {
      activity.participants = [];
    }
    emit('pasu-activity-ready', { ...activity });
  } catch (error) {
    activity.connected = false;
    emit('pasu-activity-error', { message: error?.message || 'Discord Activity handshake failed.' });
  }
}

window.PASUActivity = {
  get enabled() { return activity.enabled; },
  get connected() { return activity.connected; },
  get instanceId() { return activity.instanceId; },
  get clientId() { return activity.clientId; },
  get sdk() { return activity.sdk; },
};

connect();
